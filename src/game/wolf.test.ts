import { beforeEach, describe, expect, it } from "vitest";
import {
  BLOOD_HITS,
  CLAW_CD,
  CLAW_MUL,
  CLAW_REACH,
  LEAP_CARD,
  LEAP_LAND,
  LEAP_MUL,
  LEAP_R,
  LEAP_TIME,
  Player,
  RAGE_HASTE,
  RAGE_HIT,
  RAGE_IDLE,
  RAGE_TIME,
  RUSH_MUL,
  WOLF_MAX_HP,
  WOLF_SPEED,
} from "./player";
import { Game } from "./game";
import { Enemy } from "./enemy";
import { Boss } from "./boss";
import { heroDps } from "./bossPower";
import { HERO_LIST, WOLF_PRICE } from "./hero";
import { buyHero, addGold, heroPrice, loadGold } from "./shop";
import { isHeroUnlocked, unlockHero } from "./save";
import { SKINS, SKINS_KEY, SKIN_PRICES } from "./skins";
import { SUPERS, superFor } from "./super";
import { UPGRADES } from "./waves";
import { ARTIFACTS } from "./artifacts";
import { HERO_TAG } from "./synergy";
import { WOLF_PORTRAIT_VARIANTS, portraitGrid, portraitPixels } from "./portrait";
import { ENEMY_SPRITE } from "./enemy";
import { PALETTES, spriteGrid, spritePixels } from "./sprites";
import { WOLF_FRAME, WOLF_FRAMES, WOLF_SUPER_FRAME, wolfEyes, wolfTuft } from "./wolfSprites";
import { sceneFor } from "./superScene";
import { HowlScene, PACK_SIZE, PACK_SIZE_REDUCED } from "./howlFx";
import { RealmSim, TICK_DT } from "@/realm/sim";
import { loadRealmData } from "@/realm/data";
import { netPlayer } from "@/realm/net/room";
import { PF_FURY, PF_LEAP, PF_LEFT } from "@/realm/net/protocol";
import { endRealmSuper } from "@/realm/supers";
import { HERO_VERSION } from "./heroCompat";
import { setLang, t, type Lang } from "@/i18n";
import type { Input } from "./input";

const DT = 1 / 60;
const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };

function keys(o: Partial<{ attack: boolean; held: boolean; dash: boolean; x: number; y: number }>) {
  return {
    consumeAttack: () => !!o.attack,
    consumeDash: () => !!o.dash,
    attackHeld: () => !!o.held,
    dashHeld: () => false,
    axis: () => ({ x: o.x ?? 0, y: o.y ?? 0 }),
  } as unknown as Input;
}

function run(p: Player, seconds: number, input = keys({})) {
  for (let t = 0; t < seconds - 1e-9; t += DT) p.update(DT, input);
}

function wolf(x = 100, y = 120) {
  const p = new Player("wolf");
  p.x = x;
  p.y = y;
  p.fx = 1;
  p.fy = 0;
  return p;
}

function makeGame() {
  unlockHero("wolf");
  const g = new Game(canvas as unknown as HTMLCanvasElement, "wolf");
  g.hints = [];
  g.enemies = [];
  g.banner.timer = 0;
  g.player.x = 60;
  g.player.y = 170;
  return { g, p: g.player };
}

function foe(g: Game, x: number, y: number, hp = 50) {
  const e = new Enemy("rammer", x, y);
  e.spawn = 0;
  e.hp = e.maxHp = hp;
  e.update = () => {};
  g.enemies.push(e);
  return e;
}

beforeEach(() => localStorage.clear());

describe("Varvar: do'kon", () => {
  it("is the 9th hero, a warrior, sold for 600 gold", () => {
    const info = HERO_LIST.find((h) => h.id === "wolf")!;
    expect(HERO_LIST.indexOf(info)).toBe(8);
    expect(info.name).toBe("VARVAR");
    expect(info.role).toBe("warrior");
    expect(WOLF_PRICE).toBe(600);
    expect(heroPrice("wolf")).toBe(600);
  });

  it("cannot be bought without enough gold; with 600 it unlocks once", () => {
    addGold(599);
    expect(buyHero("wolf")).toBe(false);
    expect(isHeroUnlocked("wolf")).toBe(false);
    addGold(1);
    expect(buyHero("wolf")).toBe(true);
    expect(loadGold()).toBe(0);
    expect(isHeroUnlocked("wolf")).toBe(true);
    addGold(600);
    expect(buyHero("wolf")).toBe(false);
    expect(loadGold()).toBe(600);
  });

  it("the ice-wolf mob keeps its own sprite (renamed to icewolf), the hero owns 'wolf'", () => {
    expect(ENEMY_SPRITE.wolf).toBe("icewolf");
    expect(PALETTES.icewolf).toHaveLength(5);
    expect(spriteGrid("wolf")).toBe(48);
  });
});

describe("Varvar: panjalar va balans", () => {
  it("7 hearts (between the Knight and the Paladin), the fastest hero, the shortest reach", () => {
    const p = wolf();
    expect(p.maxHp).toBe(WOLF_MAX_HP);
    expect(p.maxHp).toBeGreaterThan(new Player("knight").maxHp);
    expect(p.maxHp).toBeLessThan(new Player("paladin").maxHp);
    expect(p.speed).toBe(WOLF_SPEED);
    for (const h of HERO_LIST)
      if (h.id !== "wolf") {
        const o = new Player(h.id);
        expect(p.speed, h.id).toBeGreaterThan(o.speed);
        if (!o.ranged) expect(p.reach, h.id).toBeLessThan(o.reach);
        if (!o.ranged) expect(p.attackCd, h.id).toBeLessThanOrEqual(o.attackCd);
      }
    expect(p.reach).toBe(CLAW_REACH);
    expect(p.attackCd).toBe(CLAW_CD);
    expect(p.hitDamage).toBeCloseTo(CLAW_MUL, 5);
  });

  it("claws strike left-right-left, very close to the body", () => {
    const p = wolf();
    const sides: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      p.update(DT, keys({ attack: true }));
      const box = p.attackBox()!;
      expect(box).not.toBeNull();
      expect(box.x - p.x).toBeLessThan(12);
      sides.push(p.clawLeft);
      run(p, CLAW_CD + 0.02);
    }
    expect(sides).toEqual([true, false, true, true]);
  });

  it("balance: ideal DPS between the Paladin and the Knight (rage is skill, not in the formula)", () => {
    const [knight, paladin, w] = (["knight", "paladin", "wolf"] as const).map((h) =>
      heroDps(new Player(h)),
    );
    expect(w).toBeGreaterThan(paladin!);
    expect(w).toBeLessThan(knight!);
  });
});

describe("Varvar: BO'RI SAKRASHI", () => {
  it("holding the attack leaps forward; in the air nothing hits her and she hits nothing", () => {
    const p = wolf();
    run(p, p.chargeTime + 0.05, keys({ held: true }));
    const x0 = p.x;
    p.update(DT, keys({}));
    expect(p.spinning).toBe(true);
    expect(p.airborne).toBe(true);
    expect(p.attackBox()).toBeNull();
    expect(p.takeHit(1, p.x + 10, p.y, 100)).toBe(false);
    run(p, LEAP_TIME - LEAP_LAND - 0.03);
    expect(p.x - x0).toBeGreaterThan(30);
    expect(p.hitDamage).toBeCloseTo(LEAP_MUL, 5);
  });

  it("the landing hits everyone around (radius leapR) and stuns them", () => {
    const { g, p } = makeGame();
    p.x = 100;
    p.y = 120;
    p.fx = 1;
    p.fy = 0;
    // qo'nish joyi ~ x 140: ikki tomonda ham dushman
    const a = foe(g, 160, 120, 50);
    const b = foe(g, 125, 132, 50);
    const far = foe(g, 230, 120, 50);
    p.invuln = 99;
    g.input.setTouchAttack(true);
    for (let t = 0; t < p.chargeTime + 0.05; t += DT) g.update(DT);
    g.input.setTouchAttack(false);
    for (let t = 0; t < LEAP_TIME + 0.1; t += DT) g.update(DT);
    expect(a.hp).toBeLessThan(50);
    expect(b.hp).toBeLessThan(50);
    expect(far.hp).toBe(50);
    expect(a.stun).toBeGreaterThan(0);
  });

  it("WIDE LEAP card grows the landing area", () => {
    const p = wolf();
    const card = UPGRADES.find((u) => u.id === "wideleap")!;
    expect(card.ok!(p)).toBe(true);
    card.apply(p);
    expect(p.leapR).toBe(LEAP_R + LEAP_CARD);
    expect(card.ok!(p)).toBe(false);
  });
});

describe("Varvar: YOVVOYI YUGURISH", () => {
  it("the rush shoves every enemy on the way once, for a little damage", () => {
    const { g, p } = makeGame();
    p.x = 100;
    p.y = 120;
    p.fx = 1;
    p.fy = 0;
    const e = foe(g, 125, 120, 50);
    g.input.pressDash();
    for (let t = 0; t < 0.3; t += DT) g.update(DT);
    const dealt = 50 - e.hp;
    expect(dealt).toBeGreaterThan(0);
    // bir marta, kichik zarar (kritik bo'lsa ham 2× dan oshmaydi)
    expect(dealt).toBeLessThanOrEqual(RUSH_MUL * p.damage * 2 + 1e-6);
  });
});

describe("Varvar: G'AZAB", () => {
  it("every hit builds rage; full rage lasts 5 s with faster claws and red eyes", () => {
    const p = wolf();
    const hits = Math.ceil(1 / RAGE_HIT - 1e-9);
    for (let i = 0; i < hits - 1; i++) p.clawHit();
    expect(p.fury).toBe(false);
    expect(p.rage).toBeCloseTo((hits - 1) * RAGE_HIT, 5);
    p.clawHit();
    expect(p.fury).toBe(true);
    expect(p.furyT).toBeCloseTo(RAGE_TIME, 5);
    // g'azabda zarbalar orasi qisqa
    p.update(DT, keys({ attack: true }));
    expect(p.cooldown).toBeLessThan(CLAW_CD * 0.75);
    expect(p.cooldown).toBeGreaterThanOrEqual(Math.max(p.attackTime, CLAW_CD * RAGE_HASTE) - 1e-9);
    expect(wolfEyes("idle", 0, false)).toHaveLength(2);
    run(p, RAGE_TIME + 0.1);
    expect(p.fury).toBe(false);
    expect(p.rage).toBe(0);
  });

  it("getting hit builds rage too; without fighting rage slowly fades", () => {
    const p = wolf();
    p.takeHit(1, p.x + 10, p.y, 50);
    expect(p.rage).toBeGreaterThan(0);
    p.rage = 0.5;
    p.rageIdle = 0;
    run(p, RAGE_IDLE - 0.2);
    expect(p.rage).toBe(0.5);
    run(p, 2);
    expect(p.rage).toBeLessThan(0.5);
    expect(p.rage).toBeGreaterThan(0);
  });

  it("the game builds rage from real claw hits", () => {
    const { g, p } = makeGame();
    p.x = 100;
    p.y = 120;
    p.fx = 1;
    const e = foe(g, 108, 120, 1000);
    let hits = 0;
    for (let i = 0; i < 20 && hits < 4; i++) {
      e.x = 108;
      e.y = 120;
      e.vx = e.vy = 0;
      p.invuln = 99;
      p.x = 100;
      p.y = 120;
      p.fx = 1;
      p.fy = 0;
      const before = e.hp;
      g.input.pressAttack();
      g.update(DT);
      for (let t = 0; t < CLAW_CD + 0.02; t += DT) g.update(DT);
      if (e.hp < before) hits++;
    }
    expect(hits).toBe(4);
    expect(p.rage).toBeCloseTo(4 * RAGE_HIT, 5);
  });

  it("own cards: rage fire, wide leap, blood claw (1 heart every 15 hits), long rage + 2 super cards", () => {
    const own = UPGRADES.filter((u) => u.hero === "wolf");
    expect(own.map((u) => u.id).sort()).toEqual(
      ["bloodclaw", "longrage", "moonrage", "packrun", "ragefire", "wideleap"].sort(),
    );
    expect(own.filter((u) => u.super === "wolf-howl")).toHaveLength(2);
    const p = wolf();
    UPGRADES.find((u) => u.id === "bloodclaw")!.apply(p);
    expect(p.bloodHits).toBe(BLOOD_HITS);
    p.hp = 3;
    for (let i = 0; i < BLOOD_HITS - 1; i++) expect(p.clawHit()).toBe(false);
    expect(p.clawHit()).toBe(true);
    expect(p.hp).toBe(4);
    // davolash chegarasi: darhol yana 15 zarba — tiklanmaydi
    for (let i = 0; i < BLOOD_HITS; i++) p.clawHit();
    expect(p.hp).toBe(4);
    expect(HERO_TAG.wolf).toBe("bori");
    expect(ARTIFACTS.find((a) => a.hero === "wolf")?.id).toBe("wolffang");
  });
});

describe("Varvar: sprayt va skinlar", () => {
  it("5 colours, a 48 px grid, own frames for both claws, the leap, the rush and the howl", () => {
    expect(PALETTES.wolf).toHaveLength(5);
    expect(new Set(PALETTES.wolf).size).toBe(5);
    expect(WOLF_FRAMES.idle).toBe(4);
    expect(WOLF_FRAMES.walk).toBe(6);
    const frames = [
      0,
      1,
      WOLF_FRAME.left,
      WOLF_FRAME.left + 1,
      WOLF_FRAME.aim,
      WOLF_FRAME.leap,
      WOLF_FRAME.land,
      WOLF_FRAME.rush,
      WOLF_SUPER_FRAME.howl,
      WOLF_SUPER_FRAME.call,
    ];
    const keyOf = (f: number) => Array.from(spritePixels("wolf", "attack", f)).join("");
    expect(new Set(frames.map(keyOf)).size).toBe(frames.length);
    const idle = spritePixels("wolf", "idle", 0);
    for (const c of [1, 2, 3, 4, 5]) expect(idle.includes(c), `rang ${c}`).toBe(true);
    expect(Math.max(...idle)).toBe(5);
    // qizil tutam qora soch ustida
    const hair = wolfTuft("idle", 0, false).filter(([x, y]) => idle[y * 48 + x] === 1);
    expect(hair.length).toBeGreaterThan(3);
  });

  it("three skins at 80 / 150 / 250 gold that give no power at all", () => {
    expect(SKINS.wolf.slice(1).map((s) => s.price)).toEqual([...SKIN_PRICES]);
    expect(SKINS.wolf[3]!.tier).toBe("legendary");
    for (const s of SKINS.wolf.slice(1)) {
      localStorage.setItem(SKINS_KEY, JSON.stringify({ owned: [s.id], sel: { wolf: s.id } }));
      const { p } = makeGame();
      expect(p.skin?.id).toBe(s.id);
      const fresh = new Player("wolf");
      for (const k of [
        "speed",
        "damage",
        "attackCd",
        "dashCd",
        "maxHp",
        "reach",
        "leapR",
        "rageGain",
        "rageTime",
        "bloodHits",
      ])
        expect((p as unknown as Record<string, number>)[k], `${s.id}.${k}`).toBe(
          (fresh as unknown as Record<string, number>)[k],
        );
      expect(heroDps(p)).toBe(heroDps(fresh));
    }
  });
});

describe("Varvar: BO'RI UVLASHI", () => {
  const def = () => superFor("wolf")!;

  it("is open, uses the super.ts pattern and a strict boss cap", () => {
    expect(SUPERS.wolf?.name).toBe("BO'RI UVLASHI");
    expect(def().dmg).toEqual({ kill: true, boss: 0.08, bossCap: 0.1 });
    expect(sceneFor(def().fx)).toBeInstanceOf(HowlScene);
  });

  it("she howls at the moon, 4–6 spirit wolves bite every enemy, fade to mist; rage is full after", () => {
    const { g, p } = makeGame();
    const es = [foe(g, 240, 60), foe(g, 80, 60), foe(g, 250, 190)];
    g.superMeter.value = g.superMeter.def!.charge;
    expect(g.useSuper()).toBe(true);
    let moon = 0,
      pack = 0,
      bites = 0,
      howled = false;
    for (let t = 0; t < 8 && g.cast; t += DT) {
      g.update(DT);
      const s = g.scene as HowlScene;
      moon = Math.max(moon, s.moon);
      pack = Math.max(pack, s.wolves.length);
      bites = Math.max(bites, s.bites.length);
      if (p.superFrame === WOLF_SUPER_FRAME.howl) howled = true;
    }
    expect(moon).toBeGreaterThan(0.8);
    expect(pack).toBeGreaterThanOrEqual(PACK_SIZE_REDUCED);
    expect(pack).toBeLessThanOrEqual(PACK_SIZE);
    expect(bites).toBeGreaterThan(0);
    expect(howled).toBe(true);
    expect(es.every((e) => e.dead)).toBe(true);
    expect(p.casting).toBe(false);
    expect(p.fury).toBe(true);
    expect(p.rage).toBe(1);
    // bo'rilar tumanga aylanib yo'qoladi
    for (let t = 0; t < 2; t += DT) g.update(DT);
    expect((g.scene as HowlScene | null)?.wolves.length ?? 0).toBe(0);
  });

  it("a boss loses at least 8% and at most 10% of its max HP", () => {
    const { g } = makeGame();
    const b = new Boss(1000);
    b.spawn = 0;
    b.x = 250;
    b.y = 80;
    g.boss = b;
    g.superMeter.value = g.superMeter.def!.charge;
    expect(g.useSuper()).toBe(true);
    for (let t = 0; t < 8 && g.cast; t += DT) g.update(DT);
    const dealt = b.maxHp - b.hp;
    expect(dealt).toBeGreaterThanOrEqual(b.maxHp * 0.08 - 1e-6);
    expect(dealt).toBeLessThanOrEqual(b.maxHp * 0.1 + 1e-6);
  });

  it("cut-in portrait: 96 px, front-facing and symmetric, 3 distinct frames", () => {
    expect(portraitGrid("wolf")).toBe(96);
    const frames = WOLF_PORTRAIT_VARIANTS.map((v) => portraitPixels("wolf", v)!);
    expect(new Set(frames.map((f) => f.join(""))).size).toBe(3);
    const f = frames[0]!;
    let same = 0,
      all = 0;
    for (let y = 0; y < 96; y++)
      for (let x = 0; x < 48; x++) {
        if (!f[y * 96 + x] && !f[y * 96 + 95 - x]) continue;
        all++;
        if (!!f[y * 96 + x] === !!f[y * 96 + 95 - x]) same++;
      }
    expect(same / all).toBeGreaterThan(0.9);
  });
});

describe("Varvar onlayn", () => {
  const data = loadRealmData();

  it("old clients see a knight; new ones see the Wolf girl with her flags", () => {
    const sim = new RealmSim(data);
    const rp = sim.addPlayer("a", "wolf");
    expect(netPlayer(rp, "A", 1, "", "", 3)[1]).toBe("knight");
    rp.p.startFury();
    rp.p.spinTimer = 0.2;
    rp.p.clawStep = 0;
    const net = netPlayer(rp, "A", 1, "", "", HERO_VERSION);
    expect(net[1]).toBe("wolf");
    expect(net[11] & PF_FURY).toBe(PF_FURY);
    expect(net[11] & PF_LEAP).toBe(PF_LEAP);
    expect(net[11] & PF_LEFT).toBe(PF_LEFT);
  });

  it("claws build rage on the server; the super kills a mob and leaves full rage", () => {
    const sim = new RealmSim(data);
    const rp = sim.addPlayer("a", "wolf");
    const m = sim.addMob("boar", rp.p.x + 40, rp.p.y);
    m.spawnT = 0;
    rp.meter.value = rp.meter.def!.charge;
    for (let t = 0; t < 8 && (t === 0 || rp.cast); t += TICK_DT)
      sim.step(t === 0 ? [{ pid: rp.id, cmd: { type: "super" } }] : []);
    if (rp.cast) endRealmSuper(rp);
    expect(m.dead).toBe(true);
    expect(rp.p.casting).toBe(false);
    expect(rp.p.fury).toBe(true);
  });
});

describe("Varvar: uch tilda matnlar", () => {
  const KEYS = [
    "hero.wolf.name",
    "hero.wolf.desc",
    "super.wolf.name",
    "super.wolf.desc",
    "up.ragefire.name",
    "up.wideleap.name",
    "up.bloodclaw.name",
    "up.longrage.name",
    "up.moonrage.name",
    "up.packrun.name",
    "up.blade.wolf.name",
    "art.wolffang.name",
    "skin.wolf-ash",
    "skin.wolf-frost",
    "skin.wolf-moon",
    "skin.wolf.default",
    "tb.claw",
    "tb.rush",
    "g.wolfRage",
    "ach.winWolf.name",
  ] as const;

  it("every Wolf girl text exists in Uzbek, Russian and English, and they differ", () => {
    const by: Record<Lang, string[]> = { uz: [], ru: [], en: [] };
    for (const lang of ["uz", "ru", "en"] as const) {
      setLang(lang);
      by[lang] = KEYS.map((k) => t(k));
      for (const [i, s] of by[lang].entries())
        expect(s.length, `${lang} ${KEYS[i]}`).toBeGreaterThan(1);
    }
    setLang("uz");
    expect(by.uz[0]).toBe("VARVAR");
    expect(by.ru[0]).toBe("ВАРВАРА");
    expect(by.en[0]).toBe("VARVARA");
    expect(by.uz[2]).toBe("BO'RI UVLASHI");
    expect(by.ru[2]).toBe("ВОЙ ВОЛКА");
    expect(by.en[2]).toBe("WOLF HOWL");
    for (let i = 0; i < KEYS.length; i++) {
      expect(by.ru[i]).not.toBe(by.en[i]);
      expect(by.uz[i]).not.toBe(by.en[i]);
    }
  });
});
