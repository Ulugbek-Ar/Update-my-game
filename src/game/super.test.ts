import { beforeEach, describe, expect, it } from "vitest";
import { Game, SUPER_TIP_KEY } from "./game";
import { Enemy, ENEMY_HP } from "./enemy";
import { Boss } from "./boss";
import { HEROES, type Hero } from "./hero";
import { Player } from "./player";
import { unlockHero } from "./save";
import { DEFAULT_KEYS, keyConflicts, sanitizeKeys } from "./keys";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings";
import { Input } from "./input";
import { DANGER_COLORS, colorDistance } from "./danger";
import { SKINS } from "./skins";
import {
  GAIN_COMBO,
  GAIN_COMBO_MAX,
  GAIN_HURT,
  SUPERS,
  SUPERS_ENABLED,
  SUPER_STAGES,
  SuperCast,
  SuperMeter,
  bossDamage,
  planStrikes,
  superById,
  superFor,
} from "./super";
import { ORB_DRAIN, SuperOrb, mixColor } from "./superFx";
import {
  PALADIN_PORTRAIT_VARIANTS,
  portraitColors,
  portraitGrid,
  portraitPixels,
} from "./portrait";
import { BOSS_WAVE, WAVES, WAVES2 } from "./waves";
import { RealmSim } from "@/realm/sim";
import { RealmClient } from "@/realm/client";
import { loadRealmData } from "@/realm/data";

type GI = {
  startWave(i: number): void;
  damageTarget(t: unknown, d: number): void;
  onPlayerHurt(): void;
  onKill(e: Enemy): void;
};
const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
const DT = 1 / 60;
/** Superi ochiq qahramonlar (har versiyada qo'shiladi) */
const SUPER_HEROES: Hero[] = ["paladin", "samurai", "knight", "mage", "hunter"];

function makeGame(hero: Hero = "paladin") {
  if (hero !== "knight" && hero !== "mage" && hero !== "hunter") unlockHero(hero);
  const g = new Game(canvas as unknown as HTMLCanvasElement, hero);
  g.hints = [];
  g.enemies = [];
  g.banner.timer = 0;
  const p = g.player;
  p.x = 160;
  p.y = 150;
  return { g, gi: g as unknown as GI, p };
}

function tick(g: Game, seconds: number) {
  for (let t = 0; t < seconds - 1e-9; t += DT) g.update(DT);
}

/** Paydo bo'lib bo'lgan dushman; still — qimirlamaydi (update o'chirilgan) */
function foe(
  g: Game,
  kind: ConstructorParameters<typeof Enemy>[0],
  x: number,
  y: number,
  still = true,
) {
  const e = new Enemy(kind, x, y);
  e.spawn = 0;
  if (still) e.update = () => {};
  g.enemies.push(e);
  return e;
}

/** Sharni to'ldiradi */
function fill(g: Game) {
  const d = g.superMeter.def!;
  g.superMeter.value = d.charge;
}

/** Super tugaguncha yuritadi; o'tgan vaqtni qaytaradi */
function untilCastEnds(g: Game, max = 10) {
  let t = 0;
  for (; t < max && g.cast; t += DT) g.update(DT);
  return t;
}

beforeEach(() => {
  localStorage.clear();
  saveSettings({ ...DEFAULT_SETTINGS });
});

describe("Super tizimi: ma'lumot", () => {
  it("is open: the Paladin, the Samurai, the Knight, the Mage and the Hunter have supers", () => {
    expect(SUPERS_ENABLED).toBe(true);
    expect(superFor("paladin")?.name).toBe("ILOHIY HUKM");
    // v4.0: ikkinchi super — Samurayning MING KESIMI
    expect(superFor("samurai")?.name).toBe("MING KESIM");
    // v4.0: uchinchi super — Ritsarning UFQ KESIMI
    expect(superFor("knight")?.name).toBe("UFQ KESIMI");
    // v4.0: to'rtinchi super — Sehrgarning OSMON TOSHI
    expect(superFor("mage")?.name).toBe("OSMON TOSHI");
    // v3.14: beshinchi super — Ovchining O'N O'Q OVI
    expect(superFor("hunter")?.name).toBe("O'N O'Q OVI");
    for (const h of HEROES) if (!SUPER_HEROES.includes(h)) expect(superFor(h), h).toBeNull();
    expect(SUPERS.samurai?.open).toBe(true);
    expect(superById("divine-judgment")).toBe(superFor("paladin"));
    expect(superById("thousand-cuts")).toBe(superFor("samurai"));
    expect(superById("horizon-cut")).toBe(superFor("knight"));
    expect(superById("sky-stone")).toBe(superFor("mage"));
    expect(superById("ten-arrows")).toBe(superFor("hunter"));
    expect(superById("yo'q")).toBeNull();
  });

  it("every super is described by data: three stages, damage, boss cap, sounds and effects", () => {
    for (const d of Object.values(SUPERS)) {
      expect(SUPER_STAGES).toEqual(["prep", "strike", "after"]);
      for (const s of SUPER_STAGES) {
        expect(d.stages[s]).toBeGreaterThan(0);
        expect(d.slow[s]).toBeGreaterThan(0);
        expect(d.slow[s]).toBeLessThanOrEqual(1);
      }
      expect(d.time).toBeCloseTo(d.stages.prep + d.stages.strike + d.stages.after, 5);
      expect(d.dmg.boss).toBeLessThanOrEqual(d.dmg.bossCap);
      // QAT'IY QOIDA: bitta superdan bossga zarar maksimal jonining 10% idan oshmaydi
      expect(d.dmg.bossCap).toBeLessThanOrEqual(0.1);
      expect(d.card.short).toBeLessThan(d.card.time);
      for (const snd of Object.values(d.sounds)) expect(typeof snd).toBe("string");
      expect(d.fx.length).toBeGreaterThan(0);
      expect(d.name).toBe(d.name.toUpperCase());
    }
    const d = superFor("paladin")!;
    // jami ~3.5–4 s (kartasiz), karta ~0.6 s, qisqartirilgani 0.25 s
    expect(d.time).toBeGreaterThanOrEqual(3.5);
    expect(d.time).toBeLessThanOrEqual(4);
    expect(d.card.time).toBeCloseTo(0.6);
    expect(d.card.short).toBeCloseTo(0.25);
    // bossga 8% — "8–10%" oralig'ining pastki cheti, chegara 10%
    expect(d.dmg.boss).toBeCloseTo(0.08);
    expect(d.dmg.bossCap).toBeCloseTo(0.1);
  });

  it("an average game fills the orb about once every 1–2 waves", () => {
    const d = superFor("paladin")!;
    // to'lqindagi dushmanlar joni = shu to'lqinda beriladigan zarar (boss to'lqinisiz)
    for (const waves of [WAVES, WAVES2]) {
      const hp = waves.slice(0, BOSS_WAVE).map((w) => w.reduce((s, k) => s + ENEMY_HP[k], 0));
      const avg = hp.reduce((a, b) => a + b, 0) / hp.length;
      const wavesPerFill = d.charge / avg;
      expect(wavesPerFill).toBeGreaterThanOrEqual(0.7);
      expect(wavesPerFill).toBeLessThanOrEqual(2);
      // eng kichik ikki to'lqin ham sharni deyarli to'ldiradi
      expect(hp[0]! + hp[1]!).toBeGreaterThanOrEqual(d.charge * 0.85);
    }
  });
});

describe("Super shari: to'lishi va bo'shashi", () => {
  it("fills from damage dealt (main), combo kills and a little from being hit", () => {
    const m = new SuperMeter("paladin");
    const d = m.def!;
    expect(m.ratio).toBe(0);
    m.add(5);
    expect(m.value).toBe(5);
    expect(m.ratio).toBeCloseTo(5 / d.charge);
    // kombo: x1 — yo'q, x2 dan boshlab oshib boradi, chegarasi bor
    m.addCombo(1);
    expect(m.value).toBe(5);
    m.addCombo(2);
    expect(m.value).toBeCloseTo(5 + GAIN_COMBO);
    m.addCombo(50);
    expect(m.value).toBeCloseTo(5 + GAIN_COMBO + GAIN_COMBO_MAX);
    const before = m.value;
    m.addHurt();
    expect(m.value).toBeCloseTo(before + GAIN_HURT);
    // zarba yeyish — "ozgina": bitta zarba sharning 10% idan kam
    expect(GAIN_HURT).toBeLessThan(d.charge * 0.1);
    // manfiy va nol zarar hisoblanmaydi
    m.add(-3);
    m.add(0);
    expect(m.value).toBeCloseTo(before + GAIN_HURT);
  });

  it("becomes ready exactly when full, never overfills and empties when used", () => {
    const m = new SuperMeter("paladin");
    const d = m.def!;
    m.add(d.charge - 1);
    expect(m.ready).toBe(false);
    expect(m.use()).toBe(false);
    expect(m.value).toBe(d.charge - 1);
    m.add(999);
    expect(m.value).toBe(d.charge);
    expect(m.ratio).toBe(1);
    expect(m.ready).toBe(true);
    expect(m.justFilled).toBe(true);
    expect(m.use()).toBe(true);
    expect(m.value).toBe(0);
    expect(m.ready).toBe(false);
    expect(m.use()).toBe(false);
  });

  it("in a game: hitting enemies fills it, a new game starts with an empty orb", () => {
    const { g, gi } = makeGame();
    const e = foe(g, "golem", 200, 150);
    gi.damageTarget(e, 3);
    expect(g.superMeter.value).toBe(3);
    // ortiqcha zarar hisoblanmaydi: faqat haqiqatda ketgan jon
    gi.damageTarget(e, 99);
    expect(g.superMeter.value).toBe(ENEMY_HP.golem);
    gi.onPlayerHurt();
    expect(g.superMeter.value).toBe(ENEMY_HP.golem + GAIN_HURT);
    g.reset();
    expect(g.superMeter.value).toBe(0);
    expect(g.orb.level).toBe(0);
    expect(g.cast).toBeNull();
  });

  it("the liquid rises smoothly, sloshes when hit and drains with a whoosh when used", () => {
    const orb = new SuperOrb();
    orb.update(DT, 1, false);
    // sakrab emas — silliq: bir kadrda to'lib qolmaydi
    expect(orb.level).toBeGreaterThan(0);
    expect(orb.level).toBeLessThan(0.2);
    for (let i = 0; i < 180; i++) orb.update(DT, 1, true);
    expect(orb.level).toBeCloseTo(1, 2);
    expect(orb.readyT).toBeGreaterThan(0);
    // to'lganda pufakchalar ko'payadi va uchqun sochadi
    expect(orb.bubbles.length).toBeGreaterThan(5);
    expect(orb.sparks.length).toBeGreaterThan(0);
    // zarba: chayqaladi, so'ng tinadi
    orb.kick();
    orb.update(DT, 1, true);
    expect(Math.abs(orb.tilt)).toBeGreaterThan(0);
    expect(orb.slosh).toBeGreaterThan(0.5);
    for (let i = 0; i < 600; i++) orb.update(DT, 1, true);
    expect(Math.abs(orb.tilt)).toBeLessThan(0.02);
    // ishlatildi: darhol emas, ORB_DRAIN ichida bo'shaydi
    orb.drain();
    orb.update(DT, 0, false);
    expect(orb.level).toBeGreaterThan(0.8);
    expect(orb.draining).toBeGreaterThan(0);
    for (let t = 0; t < ORB_DRAIN + 0.1; t += DT) orb.update(DT, 0, false);
    expect(orb.level).toBe(0);
    expect(orb.draining).toBe(-1);
    expect(orb.sparks.length).toBe(0);
  });

  it("'Effektlarni kamaytirish': fewer bubbles and sparks, same level", () => {
    const full = new SuperOrb();
    const calm = new SuperOrb();
    for (let i = 0; i < 300; i++) {
      full.update(DT, 1, true, 0, false);
      calm.update(DT, 1, true, 0, true);
    }
    expect(calm.bubbles.length).toBeLessThan(full.bubbles.length);
    expect(calm.sparks.length).toBeLessThan(full.sparks.length);
    expect(calm.level).toBeCloseTo(full.level, 5);
  });

  it("the orb never uses Math.random (visuals must not disturb the game's randomness)", () => {
    const real = Math.random;
    let calls = 0;
    Math.random = () => {
      calls++;
      return real();
    };
    try {
      const orb = new SuperOrb();
      for (let i = 0; i < 200; i++) orb.update(DT, 1, true, 0.5);
      orb.kick();
      orb.drain();
      for (let i = 0; i < 60; i++) orb.update(DT, 0, false);
    } finally {
      Math.random = real;
    }
    expect(calls).toBe(0);
  });

  it("liquid colours come from the skin theme and stay away from danger colours and blood red", () => {
    const blood = "#c1121f";
    const looks = SKINS.paladin.map((sk) => sk.theme);
    expect(looks.length).toBeGreaterThan(1);
    for (const T of looks)
      for (const c of [T.accent, T.glow, mixColor(T.accent, T.glow, 0.5)]) {
        expect(colorDistance(c, blood), c).toBeGreaterThan(150);
        for (const d of DANGER_COLORS)
          expect(colorDistance(c, d), `${c} vs ${d}`).toBeGreaterThan(60);
      }
  });
});

describe("Super boshqaruvi", () => {
  it("L or Q by default; old saved key bindings get the new action", () => {
    expect(DEFAULT_KEYS.super).toEqual(["KeyL", "KeyQ"]);
    expect(keyConflicts(DEFAULT_KEYS)).toEqual([]);
    // v3.8 saqlanishi: "super" yo'q edi
    const old = sanitizeKeys({ attack: ["KeyX"], dash: ["KeyC"] });
    expect(old.super).toEqual(["KeyL", "KeyQ"]);
    expect(old.attack).toEqual(["KeyX"]);
  });

  it("the key and the phone orb button both queue the super", () => {
    const input = new Input();
    expect(input.consumeSuper()).toBe(false);
    input.pressSuper();
    expect(input.consumeSuper()).toBe(true);
    expect(input.consumeSuper()).toBe(false);
    input.pressSuper();
    input.clearQueued();
    expect(input.consumeSuper()).toBe(false);
  });

  it("pressing it with a full orb starts the super; with a partly filled orb nothing happens", () => {
    const { g } = makeGame();
    foe(g, "blob", 220, 150);
    g.superMeter.value = g.superMeter.def!.charge - 0.5;
    g.input.pressSuper();
    tick(g, 0.1);
    expect(g.cast).toBeNull();
    expect(g.superMeter.value).toBe(g.superMeter.def!.charge - 0.5);
    expect(g.useSuper()).toBe(false);
    fill(g);
    g.input.pressSuper();
    g.update(DT);
    expect(g.cast).not.toBeNull();
    expect(g.cast!.stage).toBe("card");
    expect(g.superMeter.value).toBe(0);
    expect(g.orb.draining).toBeGreaterThanOrEqual(0);
    // ikkinchi marta bosish — super allaqachon ketmoqda
    expect(g.useSuper()).toBe(false);
  });

  it("a press during the card-pick screen does not leak into the next fight", () => {
    const { g } = makeGame();
    fill(g);
    (g as unknown as { stage: string }).stage = "upgrade";
    g.input.pressSuper();
    tick(g, 0.5);
    (g as unknown as { stage: string }).stage = "fight";
    foe(g, "blob", 220, 150);
    tick(g, 0.1);
    expect(g.cast).toBeNull();
    expect(g.superMeter.ready).toBe(true);
  });

  it("first time the orb fills: a one-time tip; later fills only ring the bell", () => {
    const { g, gi } = makeGame();
    const e = foe(g, "golem", 220, 150);
    e.hp = e.maxHp = 100;
    gi.damageTarget(e, g.superMeter.def!.charge);
    g.update(DT);
    expect(g.banner.title).toBe("SUPER TAYYOR!");
    expect(g.banner.sub).toBe("L / Q yoki shar tugmasini bos.");
    expect(g.banner.timer).toBeGreaterThan(2);
    expect(localStorage.getItem(SUPER_TIP_KEY)).toBe("1");
    // keyingi safar — maslahat yo'q
    g.banner.timer = 0;
    g.banner.title = "";
    g.superMeter.value = 0;
    gi.damageTarget(e, g.superMeter.def!.charge);
    g.update(DT);
    expect(g.banner.title).toBe("");
  });
});

describe("Super vaqt chizig'i", () => {
  it("card → prep → strike → after, with the world stopped during the card and slow after it", () => {
    const d = superFor("paladin")!;
    const c = new SuperCast(d);
    expect(c.stage).toBe("card");
    expect(c.worldSpeed).toBe(0);
    let ev = c.update(d.card.time - 0.01);
    expect(ev.entered).toEqual([]);
    ev = c.update(0.02);
    expect(ev.entered).toEqual(["prep"]);
    expect(c.t).toBe(0);
    expect(c.worldSpeed).toBe(d.slow.prep);
    ev = c.update(d.stages.prep + 0.01);
    expect(ev.entered).toEqual(["strike"]);
    expect(c.worldSpeed).toBe(d.slow.strike);
    ev = c.update(d.stages.strike);
    expect(ev.entered).toEqual(["after"]);
    // oqibatda vaqt asta oddiy tezlikka qaytadi
    const early = c.worldSpeed;
    c.update(d.stages.after * 0.8);
    expect(c.worldSpeed).toBeGreaterThan(early);
    ev = c.update(d.stages.after);
    expect(ev.done).toBe(true);
    expect(c.worldSpeed).toBe(1);
    // kartasiz (onlayn kuzatuvchi): darhol tayyorlanish
    expect(new SuperCast(d, 0).stage).toBe("prep");
  });

  it("strikes run nearest-first in a quick rhythm, bosses last, and always fit the stage", () => {
    const d = superFor("paladin")!;
    const from = { x: 100, y: 100 };
    const mobs = [
      { x: 300, y: 100, id: "far" },
      { x: 120, y: 100, id: "near" },
      { x: 200, y: 100, id: "mid" },
    ];
    const boss = { x: 110, y: 100, id: "boss" };
    const { strikes, time } = planStrikes(d, from, mobs, [boss]);
    expect(strikes.map((s) => s.target.id)).toEqual(["near", "mid", "far", "boss"]);
    expect(strikes.map((s) => s.boss)).toEqual([false, false, false, true]);
    for (const [i, s] of strikes.entries()) {
      // belgi 0.15 s oldin chaqnaydi
      expect(s.hitAt - s.markAt).toBeCloseTo(d.strike.mark);
      if (i) expect(s.markAt).toBeGreaterThan(strikes[i - 1]!.markAt);
    }
    expect(time).toBeLessThanOrEqual(d.stages.strike);
    // 30 ta dushman ham bosqichga sig'adi
    const many = Array.from({ length: 30 }, (_, i) => ({ x: 100 + i * 5, y: 100 }));
    const big = planStrikes(d, from, many);
    expect(big.time).toBeLessThanOrEqual(d.stages.strike + 1e-9);
    expect(Math.max(...big.strikes.map((s) => s.hitAt))).toBeLessThan(d.stages.strike);
    // bitta dushman — bosqich qisqa, lekin eng kamidan qisqa emas
    const one = planStrikes(d, from, [mobs[0]!]);
    expect(one.time).toBeCloseTo(d.strike.min);
    expect(planStrikes(d, from, []).time).toBeCloseTo(d.strike.min);
  });

  it("boss damage per super is a share of max HP and can never pass the cap", () => {
    const d = superFor("paladin")!;
    expect(bossDamage(d, 100, 0)).toBeCloseTo(8);
    // ikkinchi to'lqin (yarim kuch): 4 emas — chegaragacha qolgan 2
    expect(bossDamage(d, 100, 8, 0.5)).toBeCloseTo(2);
    expect(bossDamage(d, 100, 10)).toBe(0);
    expect(bossDamage(d, 100, 50)).toBe(0);
    for (const hp of [30, 47, 200])
      for (const power of [0.5, 1, 3, 100]) {
        let dealt = 0;
        for (let i = 0; i < 5; i++) dealt += bossDamage(d, hp, dealt, power);
        expect(dealt).toBeLessThanOrEqual(hp * 0.1 + 1e-9);
      }
  });
});

describe("Super ijrosi (o'yinda)", () => {
  it("kills every enemy on screen, waits for the scene to finish, then the wave ends", () => {
    const { g } = makeGame();
    // haqiqiy (harakatlanadigan) dushmanlar: o'lgach o'zlari yo'qoladi
    const foes = [
      foe(g, "blob", 200, 150, false),
      foe(g, "rammer", 60, 60, false),
      foe(g, "archer", 280, 200, false),
      foe(g, "wisp", 160, 40, false),
    ];
    // hali yerdan chiqayotgan dushman ham qutulmaydi
    const rising = new Enemy("blob", 40, 200);
    rising.spawn = 2;
    g.enemies.push(rising);
    fill(g);
    expect(g.useSuper()).toBe(true);
    const d = g.cast!.def;
    // karta: o'yin vaqti to'xtagan — hech kim o'lmagan
    tick(g, d.card.time - 0.05);
    expect(g.cast!.stage).toBe("card");
    expect(foes.every((e) => !e.dead)).toBe(true);
    tick(g, 0.1 + d.stages.prep - 0.1);
    expect(g.cast!.stage).toBe("prep");
    expect(foes.every((e) => !e.dead)).toBe(true);
    // zarba bosqichi tugaguncha hammasi o'lgan
    for (let i = 0; i < 400 && g.cast?.stage !== "after"; i++) g.update(DT);
    expect(g.cast!.stage).toBe("after");
    expect(foes.every((e) => e.dead)).toBe(true);
    expect(rising.dead).toBe(true);
    expect(g.cast!.kills).toBe(5);
    expect(g.stats.kills).toBe(5);
    // super tugamaguncha to'lqin yakunlanmaydi
    expect(g.stage).toBe("fight");
    untilCastEnds(g);
    expect(g.cast).toBeNull();
    tick(g, 0.2);
    expect(g.stage).toBe("upgrade");
  });

  it("the whole super takes about 3.5–4 s with a crowd and is shorter against a single enemy", () => {
    const crowd = makeGame();
    for (let i = 0; i < 10; i++) foe(crowd.g, "blob", 40 + i * 25, 60 + (i % 3) * 40);
    fill(crowd.g);
    crowd.g.useSuper();
    const d = crowd.g.cast!.def;
    const long = untilCastEnds(crowd.g) - d.card.time;
    expect(long).toBeGreaterThan(3.3);
    expect(long).toBeLessThanOrEqual(4.05);
    const solo = makeGame();
    foe(solo.g, "blob", 200, 150);
    fill(solo.g);
    solo.g.useSuper();
    const short = untilCastEnds(solo.g) - d.card.time;
    expect(short).toBeLessThan(long);
    expect(short).toBeGreaterThan(2.5);
  });

  it("the player is untouchable during the super and vulnerable the very frame it ends", () => {
    const { g, p } = makeGame();
    foe(g, "blob", 220, 150);
    fill(g);
    g.useSuper();
    const hp = p.hp;
    let frames = 0;
    while (g.cast) {
      // har kadrda zarba, muz qamoq va to'r: hech biri ta'sir qilmaydi
      expect(p.takeHit(1, p.x + 5, p.y, 100)).toBe(false);
      expect(p.encase(5)).toBe(false);
      expect(p.ensnare(2)).toBe(false);
      g.update(DT);
      if (++frames > 2000) throw new Error("super tugamadi");
    }
    expect(p.hp).toBeGreaterThanOrEqual(hp);
    expect(p.casting).toBe(false);
    // super tugagan kadrdayoq: hech qanday ortiqcha daxlsizlik qolmagan
    expect(p.invuln).toBeLessThanOrEqual(0);
    expect(p.evading).toBe(false);
    const before = p.hp;
    expect(p.takeHit(1, p.x + 5, p.y, 100)).toBe(true);
    expect(p.hp).toBe(before - 1);
  });

  it("an old hit-invulnerability timer does not outlive the super either", () => {
    const { g, p } = makeGame();
    foe(g, "blob", 220, 150);
    fill(g);
    p.invuln = 60;
    g.useSuper();
    untilCastEnds(g);
    expect(p.invuln).toBeLessThanOrEqual(0);
    expect(p.takeHit(1, p.x + 5, p.y, 100)).toBe(true);
  });

  it("the player stands still and cannot attack or dash while casting; control returns after", () => {
    const { g, p } = makeGame();
    const far = foe(g, "golem", 40, 40);
    far.hp = far.maxHp = 5;
    fill(g);
    g.useSuper();
    const at = { x: p.x, y: p.y };
    g.input.setTouchAxis(1, 0);
    g.input.pressAttack();
    g.input.pressDash();
    tick(g, 1.5);
    expect(g.cast).not.toBeNull();
    expect(p.x).toBe(at.x);
    expect(p.y).toBe(at.y);
    expect(p.attackTimer).toBe(0);
    expect(p.dashing).toBe(false);
    untilCastEnds(g);
    // super tugadi: boshqaruv qaytdi (to'lqin tugab, kuch tanlash ochilgan bo'lsa ham o'yinchi yura oladi)
    expect(p.casting).toBe(false);
    for (let i = 0; i < 12; i++) p.update(DT, g.input);
    expect(p.x).toBeGreaterThan(at.x);
  });

  it("the super frees the player from ice and snares, and cancels a dash in progress", () => {
    const p = new Player("paladin");
    p.ice = 5;
    p.iceT = 3;
    p.snare = 2;
    p.dashTimer = 0.1;
    p.attackTimer = 0.2;
    expect(p.beginCast()).toBe(true);
    expect(p.encased).toBe(false);
    expect(p.snare).toBe(0);
    expect(p.dashing).toBe(false);
    expect(p.attackTimer).toBe(0);
    expect(p.casting).toBe(true);
    // o'lgan o'yinchi super boshlay olmaydi
    const dead = new Player("paladin");
    dead.anim.set("death", true);
    expect(dead.beginCast()).toBe(false);
  });

  it("enemies that appear during the strike (a split snowman) get their own hit too", () => {
    const { g } = makeGame();
    foe(g, "golem", 220, 150);
    fill(g);
    g.useSuper();
    for (let i = 0; i < 600 && g.cast?.stage !== "after"; i++) g.update(DT);
    // qor odam + undan chiqqan ikkita muz slime
    expect(g.stats.kills).toBe(3);
    expect(g.enemies.every((e) => e.dead)).toBe(true);
  });

  it("the super's own hits do not refill the orb", () => {
    const { g } = makeGame();
    for (let i = 0; i < 6; i++) foe(g, "treant", 40 + i * 40, 60);
    fill(g);
    g.useSuper();
    untilCastEnds(g);
    expect(g.stats.kills).toBe(6);
    expect(g.superMeter.value).toBe(0);
  });

  it("a boss takes one big hit of 8% of its max HP — never more than 10% — and kneels for 1 s", () => {
    const { g, gi } = makeGame();
    gi.startWave(BOSS_WAVE);
    g.enemies = [];
    g.skipIntro();
    tick(g, 0.6);
    const b = g.boss!;
    expect(b.active).toBe(true);
    const hp = b.hp;
    fill(g);
    expect(g.useSuper()).toBe(true);
    const d = g.cast!.def;
    for (let i = 0; i < 600 && g.cast?.stage !== "after"; i++) g.update(DT);
    const dealt = hp - b.hp;
    expect(dealt).toBeCloseTo(b.maxHp * 0.08, 5);
    expect(dealt).toBeLessThanOrEqual(b.maxHp * 0.1);
    expect(b.dead).toBe(false);
    // tiz cho'kkan: hujum qilmaydi, o'z "tiz cho'kdi" kadri bilan chiziladi
    expect(b.kneel).toBeGreaterThan(0);
    expect(b.kneel).toBeLessThanOrEqual(d.after.bossKneel);
    const frame = (b as unknown as { showFrame(): { state: string; frame: number } }).showFrame();
    expect(frame).toEqual({ state: "death", frame: 0 });
    const slam = b.slamTimer;
    b.update(0.2, g.player);
    expect(b.slamTimer).toBe(slam);
    untilCastEnds(g);
    tick(g, 1.2);
    expect(b.kneel).toBeLessThanOrEqual(0);
  });

  it("boss cap holds for every boss size and through a phase edge", () => {
    for (const maxHp of [30, 55, 140]) {
      const { g } = makeGame();
      const b = new Boss(maxHp);
      b.spawn = 0;
      g.boss = b;
      foe(g, "blob", 40, 40);
      fill(g);
      g.useSuper();
      untilCastEnds(g);
      const dealt = maxHp - b.hp;
      expect(dealt).toBeGreaterThan(0);
      expect(dealt).toBeLessThanOrEqual(maxHp * 0.1 + 1e-9);
    }
  });

  it("the Paladin heals a little at the end — capped at max HP", () => {
    const { g, p } = makeGame();
    const d = g.superMeter.def!;
    // "ozgina": Paladin jonining 15% idan oshmaydi
    expect(d.heal).toBeGreaterThan(0);
    expect(d.heal).toBeLessThanOrEqual(p.maxHp * 0.15);
    foe(g, "blob", 220, 150);
    p.hp = 3;
    fill(g);
    g.useSuper();
    for (let i = 0; i < 600 && g.cast?.stage !== "after"; i++) g.update(DT);
    expect(p.hp).toBe(3 + d.heal);
    untilCastEnds(g);
    expect(p.hp).toBe(3 + d.heal);
    // to'liq jonda — oshib ketmaydi
    const full = makeGame();
    foe(full.g, "blob", 220, 150);
    fill(full.g);
    full.g.useSuper();
    untilCastEnds(full.g);
    expect(full.p.hp).toBe(full.p.maxHp);
  });

  it("'Super kartasini qisqartirish' shortens only the card", () => {
    expect(loadSettings().superCardShort).toBe(false);
    const normal = makeGame();
    foe(normal.g, "blob", 220, 150);
    fill(normal.g);
    normal.g.useSuper();
    expect(normal.g.cast!.cardTime).toBeCloseTo(0.6);
    saveSettings({ ...DEFAULT_SETTINGS, superCardShort: true });
    const quick = makeGame();
    foe(quick.g, "blob", 220, 150);
    fill(quick.g);
    quick.g.useSuper();
    expect(quick.g.cast!.cardTime).toBeCloseTo(0.25);
    const a = untilCastEnds(normal.g),
      b = untilCastEnds(quick.g);
    expect(a - b).toBeCloseTo(0.35, 1);
    // eski saqlanish (maydon yo'q) — asl qiymat
    localStorage.setItem("pixel-rpg-settings", JSON.stringify({ music: 10 }));
    expect(loadSettings().superCardShort).toBe(false);
  });
});

describe("Superi yo'q qahramonlar", () => {
  for (const hero of HEROES.filter((h) => !SUPER_HEROES.includes(h)))
    it(`${hero}: no meter, no orb, no super — and the game runs as before`, () => {
      const { g, gi } = makeGame(hero);
      expect(g.superMeter.def).toBeNull();
      const e = foe(g, "golem", 220, 150);
      e.hp = e.maxHp = 500;
      gi.damageTarget(e, 300);
      gi.onPlayerHurt();
      expect(g.superMeter.value).toBe(0);
      expect(g.superMeter.ratio).toBe(0);
      expect(g.superMeter.ready).toBe(false);
      expect(g.canSuper()).toBe(false);
      expect(g.useSuper()).toBe(false);
      // tugma bosilsa ham hech narsa bo'lmaydi, o'yin davom etadi
      g.input.pressSuper();
      tick(g, 1);
      expect(g.cast).toBeNull();
      expect(g.scene).toBeNull();
      expect(g.player.casting).toBe(false);
      expect(g.phase).toBe("play");
      expect(g.banner.title).not.toBe("SUPER TAYYOR!");
      expect(g.orb.level).toBe(0);
    });
});

describe("Onlayn olam: super hozircha yo'q", () => {
  it("the realm has no super meter, orb or button — the Paladin there plays exactly as before", () => {
    const sim = new RealmSim(loadRealmData());
    const rp = sim.addPlayer("p1", "paladin");
    // olamda zaryad ham, shar ham yo'q — telefon tugmasi (TouchControls) ularsiz chizilmaydi
    for (const key of ["superMeter", "orb", "cast", "scene"]) {
      expect(key in sim, key).toBe(false);
      expect(key in rp, key).toBe(false);
      expect(key in RealmClient.prototype, key).toBe(false);
    }
    expect("useSuper" in RealmClient.prototype).toBe(false);
    // simulyatsiya ishlayveradi: Paladin hech qachon super holatiga kirmaydi
    const hp = rp.p.hp;
    for (let i = 0; i < 60; i++) sim.step([]);
    expect(rp.p.casting).toBe(false);
    expect(rp.p.superFrame).toBe(-1);
    expect(rp.p.sunShield).toBe(0);
    expect(rp.p.hp).toBe(hp);
    // L / Q olamda bosilsa ham hech narsa bo'lmaydi: bosish shunchaki navbatda qoladi
    const input = new Input();
    input.setContext("realm");
    input.pressSuper();
    expect(input.consumeAttack()).toBe(false);
    expect(input.consumeDash()).toBe(false);
  });
});

describe("Super kartasi portreti", () => {
  it("the Paladin portrait: 96x96 front-facing great helm with a dark T slit, 3 distinct frames", () => {
    const n = portraitGrid("paladin");
    expect(n).toBeGreaterThanOrEqual(96);
    const frames = PALADIN_PORTRAIT_VARIANTS.map((v) => portraitPixels("paladin", v)!);
    for (const data of frames) {
      expect(data.length).toBe(n * n);
      // 16 ton: siyoh, 5 oltin, 4 mato, 3 kumush, 2 nur, rim light
      expect(Math.max(...data)).toBeLessThanOrEqual(16);
      expect(data.filter((c) => c > 0).length).toBeGreaterThan(data.length * 0.5);
    }
    // uchala kadr farqli, nur (14, 15) kadr sayin ko'payadi
    expect(new Set(frames.map((f) => f.join(","))).size).toBe(3);
    const glow = frames.map((f) => f.filter((c) => c === 14 || c === 15).length);
    expect(glow[1]).toBeGreaterThan(glow[0]!);
    expect(glow[2]).toBeGreaterThan(glow[1]!);
    // "T" tirqish: ko'z tirqishi qatori va o'rta ustun pastida qorong'i (siyoh) piksellar
    const at = (x: number, y: number) => frames[0]![y * n + x];
    expect(at(36, 24)).toBe(1);
    expect(at(60, 24)).toBe(1);
    expect(at(46, 40)).toBe(1);
    // simmetriya: dubulg'a (tepa 50 qator) chap-o'ng shakli bir xil
    let same = 0,
      all = 0;
    for (let y = 0; y < 50; y++)
      for (let x = 0; x < 48; x++) {
        all++;
        if (!at(x, y) === !at(96 - x, y)) same++;
      }
    expect(same / all).toBeGreaterThan(0.97);
    // skin ranglari: Qora Paladin portreti boshqa rangda
    expect(
      portraitColors("paladin", {
        id: "x",
        colors: ["#050307", "#2a1a30", "#4a3a5a", "#aab4c4", "#b02a2a"],
      })[4],
    ).toBe("#4a3a5a");
    // superli har qahramonda portret bor (96x96): Sehrgar — yovuz sehrgar, Ovchi — yashil qalpoq
    for (const h of SUPER_HEROES) expect(portraitPixels(h)?.length, h).toBe(portraitGrid(h) ** 2);
    // Merganning portreti superidan oldin tayyorlangan
    for (const h of HEROES)
      if (!SUPER_HEROES.includes(h) && h !== "gunner") expect(portraitPixels(h), h).toBeNull();
  });
});
