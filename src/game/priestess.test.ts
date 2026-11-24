import { beforeEach, describe, expect, it } from "vitest";
import {
  BEAM_CARD,
  BEAM_LEN,
  BEAM_MUL,
  MEND_GAP,
  MERCY_CARD,
  MERCY_HITS,
  PALM_CD,
  PALM_MUL,
  Player,
  PRIESTESS_MAX_HP,
  PRIESTESS_SPEED,
  TRAIL_CARD,
  TRAIL_HEAL_TIME,
  TRAIL_LIFE,
  inTrail,
} from "./player";
import { Game } from "./game";
import { Enemy } from "./enemy";
import { Boss } from "./boss";
import { heroDps } from "./bossPower";
import { HERO_LIST, PRIESTESS_PRICE } from "./hero";
import { buyHero, addGold, heroPrice, loadGold } from "./shop";
import { isHeroUnlocked, unlockHero } from "./save";
import { SKINS, SKINS_KEY, SKIN_PRICES } from "./skins";
import { SUPERS, superFor } from "./super";
import { UPGRADES } from "./waves";
import { ARTIFACTS } from "./artifacts";
import { HERO_TAG } from "./synergy";
import { PRIESTESS_PORTRAIT_VARIANTS, portraitGrid, portraitPixels } from "./portrait";
import { PALETTES, spriteGrid, spritePixels } from "./sprites";
import { PRIESTESS_FRAME, PRIESTESS_FRAMES, PRIESTESS_SUPER_FRAME } from "./priestessSprites";
import { sceneFor } from "./superScene";
import { LotusScene } from "./lotusFx";
import { RealmSim, TICK_DT, type RealmPlayer } from "@/realm/sim";
import { loadRealmData } from "@/realm/data";
import { netPlayer } from "@/realm/net/room";
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

function nun(x = 100, y = 120) {
  const p = new Player("priestess");
  p.x = x;
  p.y = y;
  p.fx = 1;
  p.fy = 0;
  return p;
}

function makeGame() {
  unlockHero("priestess");
  const g = new Game(canvas as unknown as HTMLCanvasElement, "priestess");
  g.hints = [];
  g.enemies = [];
  g.banner.timer = 0;
  g.player.x = 60;
  g.player.y = 170;
  return { g, p: g.player };
}

function foe(g: Game, x: number, y: number) {
  const e = new Enemy("rammer", x, y);
  e.spawn = 0;
  g.enemies.push(e);
  return e;
}

beforeEach(() => localStorage.clear());

describe("Rohiba: do'kon", () => {
  it("is the 8th hero, a warrior, sold for 600 gold", () => {
    const info = HERO_LIST.find((h) => h.id === "priestess")!;
    expect(HERO_LIST.indexOf(info)).toBe(7);
    expect(info.name).toBe("ROHIBA");
    expect(info.role).toBe("warrior");
    expect(PRIESTESS_PRICE).toBe(600);
    expect(heroPrice("priestess")).toBe(600);
  });

  it("cannot be bought without enough gold; with 600 it unlocks once", () => {
    addGold(599);
    expect(buyHero("priestess")).toBe(false);
    expect(isHeroUnlocked("priestess")).toBe(false);
    addGold(1);
    expect(buyHero("priestess")).toBe(true);
    expect(loadGold()).toBe(0);
    expect(isHeroUnlocked("priestess")).toBe(true);
    addGold(600);
    expect(buyHero("priestess")).toBe(false);
    expect(loadGold()).toBe(600);
  });
});

describe("Rohiba: kaft zarbalari va balans", () => {
  it("6 hearts — medium (more than the Samurai, fewer than the Paladin), quick light palms", () => {
    const p = nun();
    expect(p.maxHp).toBe(PRIESTESS_MAX_HP);
    expect(p.maxHp).toBeGreaterThan(new Player("samurai").maxHp);
    expect(p.maxHp).toBeLessThan(new Player("paladin").maxHp);
    expect(p.speed).toBe(PRIESTESS_SPEED);
    expect(p.speed).toBeGreaterThan(new Player("paladin").speed);
    expect(p.attackCd).toBe(PALM_CD);
    expect(p.hitDamage).toBeCloseTo(PALM_MUL, 5);
    expect(p.ranged).toBe(false);
  });

  it("left and right palms alternate on every strike, the wave is short", () => {
    const p = nun();
    const sides: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      p.update(DT, keys({ attack: true }));
      const box = p.attackBox()!;
      expect(box).not.toBeNull();
      expect(box.x - p.x).toBeLessThan(20);
      sides.push(p.palm);
      run(p, PALM_CD + 0.02);
    }
    expect(sides).toEqual([true, false, true, false]);
  });

  it("balance: ideal DPS a bit below the Knight, above the Paladin", () => {
    const [knight, paladin, priest] = (["knight", "paladin", "priestess"] as const).map((h) =>
      heroDps(new Player(h)),
    );
    expect(priest).toBeGreaterThan(paladin!);
    expect(priest).toBeLessThan(knight!);
    expect(priest! / knight!).toBeGreaterThan(0.9);
  });
});

describe("Rohiba: NUR KAFTI", () => {
  it("holding the attack fires a long golden beam that hits along its whole lane", () => {
    const p = nun();
    run(p, p.chargeTime + 0.05, keys({ held: true }));
    p.update(DT, keys({}));
    expect(p.spinning).toBe(true);
    expect(p.hitDamage).toBeCloseTo(BEAM_MUL, 5);
    const box = p.attackBox() as unknown as { x: number; w: number };
    expect(box.w).toBe(BEAM_LEN);
    expect(box.x - p.x).toBeGreaterThan(BEAM_LEN / 2);
  });

  it("the beam pierces: a far enemy and a near one are both hit in the game", () => {
    const { g, p } = makeGame();
    p.fx = 1;
    p.fy = 0;
    const near = foe(g, p.x + 24, p.y);
    const far = foe(g, p.x + 80, p.y);
    near.update = far.update = () => {};
    const hp = [near.hp, far.hp];
    g.input.setTouchAttack(true);
    for (let t = 0; t < p.chargeTime + 0.05; t += DT) g.update(DT);
    g.input.setTouchAttack(false);
    for (let t = 0; t < 0.1; t += DT) g.update(DT);
    expect(near.hp < hp[0]! || near.dead).toBe(true);
    expect(far.hp < hp[1]! || far.dead).toBe(true);
  });
});

describe("Rohiba: muqaddas qadam va davolash", () => {
  it("the dash leaves a golden trail that burns for 2 s, then fades", () => {
    const p = nun();
    p.update(DT, keys({ dash: true, x: 1 }));
    run(p, 0.2, keys({ x: 1 }));
    expect(p.trail.length).toBeGreaterThan(2);
    expect(p.trail[0]!.life).toBeLessThanOrEqual(TRAIL_LIFE);
    run(p, TRAIL_LIFE + 0.1);
    expect(p.trail.length).toBe(0);
  });

  it("standing in the trail slowly restores a heart; walking away does not", () => {
    const p = nun();
    p.hp = 3;
    p.update(DT, keys({ dash: true, x: 1 }));
    run(p, 0.25);
    expect(inTrail(p.trail, { x: p.x, y: p.y + 4 })).toBe(true);
    run(p, TRAIL_HEAL_TIME - 0.5);
    expect(p.hp).toBe(3);
    run(p, 0.5);
    expect(p.hp).toBe(4);
    // izdan chiqib ketsa — tiklanmaydi
    const q = nun();
    q.hp = 3;
    q.update(DT, keys({ dash: true, x: 1 }));
    run(q, 0.2);
    run(q, TRAIL_HEAL_TIME + 0.2, keys({ y: 1 }));
    expect(q.hp).toBe(3);
  });

  it("every 10 hits restore 1 heart, never above the max", () => {
    const p = nun();
    p.hp = 3;
    for (let i = 0; i < MERCY_HITS - 1; i++) expect(p.landHit()).toBe(false);
    expect(p.landHit()).toBe(true);
    expect(p.hp).toBe(4);
    p.hp = p.maxHp;
    p.mendT = 0;
    for (let i = 0; i < MERCY_HITS * 2; i++) p.landHit();
    expect(p.hp).toBe(p.maxHp);
  });

  it("heal cap: at most one heart per MEND_GAP seconds from hits and the trail together", () => {
    const p = nun();
    p.hp = 1;
    let healed = 0;
    // 3 s davomida tinimsiz uradi (har kadrda zarba) va izda turadi
    p.update(DT, keys({ dash: true, x: 1 }));
    run(p, 0.25);
    for (let t = 0; t < 3; t += DT) {
      if (p.landHit()) healed++;
      p.update(DT, keys({}));
    }
    expect(p.hp).toBe(2);
    expect(healed).toBe(1);
    run(p, MEND_GAP);
    for (let i = 0; i < MERCY_HITS; i++) p.landHit();
    expect(p.hp).toBe(3);
  });

  it("the game counts real hits: 10 palm strikes on an enemy restore a heart", () => {
    const { g, p } = makeGame();
    p.hp = 2;
    const e = foe(g, p.x + 12, p.y);
    e.hp = e.maxHp = 999;
    e.update = () => {};
    let hits = 0;
    for (let i = 0; i < 40 && hits < MERCY_HITS; i++) {
      const before = e.hp;
      // dushman tegib itarib yubormasin: Rohiba joyida, o'ngga qarab turadi
      p.invuln = 99;
      p.x = 60;
      p.y = 170;
      p.fx = 1;
      p.fy = 0;
      g.input.pressAttack();
      g.update(DT);
      for (let t = 0; t < PALM_CD + 0.02; t += DT) g.update(DT);
      if (e.hp < before) hits++;
    }
    expect(hits).toBe(MERCY_HITS);
    expect(p.hp).toBe(3);
  });

  it("own cards: RAHM (every 7 hits), UZUN NUR, UZOQ IZ, a stun beam + 2 super cards", () => {
    const own = UPGRADES.filter((u) => u.hero === "priestess");
    expect(own.filter((u) => !u.super).map((u) => u.id)).toEqual([
      "mercy",
      "longbeam",
      "longtrail",
      "dazzle",
    ]);
    expect(own.filter((u) => u.super === "golden-lotus")).toHaveLength(2);
    for (const u of own) expect(u.tags).toContain(u.super ? "super" : HERO_TAG.priestess);
    const p = nun();
    const card = (id: string) => UPGRADES.find((u) => u.id === id)!;
    card("mercy").apply!(p);
    expect(p.mercyHits).toBe(MERCY_CARD);
    expect(card("mercy").ok!(p)).toBe(false);
    card("longbeam").apply!(p);
    expect(p.beamLen).toBe(BEAM_LEN + BEAM_CARD);
    card("longtrail").apply!(p);
    expect(p.trailLife).toBe(TRAIL_LIFE + TRAIL_CARD);
    expect(card("longtrail").ok!(p)).toBe(false);
    expect(ARTIFACTS.filter((a) => a.hero === "priestess").map((a) => a.id)).toEqual([
      "prayerbeads",
    ]);
  });
});

describe("Rohiba: sprayt va skinlar", () => {
  it("5 colours, a 48 px grid, own frames for both palms, the beam, the step and the super", () => {
    expect(PALETTES.priestess).toHaveLength(5);
    expect(new Set(PALETTES.priestess).size).toBe(5);
    expect(spriteGrid("priestess")).toBe(48);
    expect(PRIESTESS_FRAMES.idle).toBe(4);
    expect(PRIESTESS_FRAMES.walk).toBe(6);
    const frames = [
      0,
      1,
      PRIESTESS_FRAME.left,
      PRIESTESS_FRAME.left + 1,
      PRIESTESS_FRAME.aim,
      PRIESTESS_FRAME.beam,
      PRIESTESS_FRAME.dash,
      PRIESTESS_SUPER_FRAME.pray,
      PRIESTESS_SUPER_FRAME.rise,
      PRIESTESS_SUPER_FRAME.float,
    ];
    const keyOf = (f: number) => Array.from(spritePixels("priestess", "attack", f)).join("");
    expect(new Set(frames.map(keyOf)).size).toBe(frames.length);
    // oq libos (2), oltin halo va kamar (4), teri (5) — hammasi bor
    const idle = spritePixels("priestess", "idle", 0);
    for (const c of [1, 2, 3, 4, 5]) expect(idle.includes(c), `rang ${c}`).toBe(true);
    // super: ko'tarilgan kadrda gavda yuqoriroq
    const top = (px: Uint8Array) => px.findIndex((v) => v === 2);
    const pray = spritePixels("priestess", "attack", PRIESTESS_SUPER_FRAME.pray);
    const float = spritePixels("priestess", "attack", PRIESTESS_SUPER_FRAME.float);
    expect(top(float)).toBeLessThan(top(pray));
  });

  it("three skins at 80 / 150 / 250 gold that give no power at all", () => {
    expect(SKINS.priestess.slice(1).map((s) => s.price)).toEqual([...SKIN_PRICES]);
    expect(SKINS.priestess[3]!.tier).toBe("legendary");
    for (const s of SKINS.priestess.slice(1)) {
      localStorage.setItem(SKINS_KEY, JSON.stringify({ owned: [s.id], sel: { priestess: s.id } }));
      const { p } = makeGame();
      expect(p.skin?.id).toBe(s.id);
      const fresh = new Player("priestess");
      for (const k of [
        "speed",
        "damage",
        "attackCd",
        "dashCd",
        "maxHp",
        "reach",
        "beamLen",
        "trailLife",
        "mercyHits",
      ])
        expect((p as unknown as Record<string, number>)[k], `${s.id}.${k}`).toBe(
          (fresh as unknown as Record<string, number>)[k],
        );
      expect(heroDps(p)).toBe(heroDps(fresh));
    }
  });
});

describe("Rohiba: OLTIN LOTOS", () => {
  const def = () => superFor("priestess")!;

  it("is open, uses the super.ts pattern, a strict boss cap and heals 3 hearts", () => {
    expect(SUPERS.priestess?.name).toBe("OLTIN LOTOS");
    expect(def().dmg).toEqual({ kill: true, boss: 0.08, bossCap: 0.1 });
    expect(def().heal).toBe(3);
    expect(def().allyHeal).toEqual({ near: 2, far: 1, nearR: 60 });
    expect(sceneFor(def().fx)).toBeInstanceOf(LotusScene);
  });

  it("she rises, a lotus opens, rays from its petals kill every enemy, she heals 3 hearts", () => {
    const { g, p } = makeGame();
    p.hp = 2;
    const es = [foe(g, 240, 60), foe(g, 80, 60), foe(g, 250, 190)];
    for (const e of es) e.update = () => {};
    g.superMeter.value = g.superMeter.def!.charge;
    expect(g.useSuper()).toBe(true);
    let open = 0,
      rays = 0,
      floated = false;
    for (let t = 0; t < 8 && g.cast; t += DT) {
      g.update(DT);
      const s = g.scene as LotusScene;
      open = Math.max(open, s.open);
      rays = Math.max(rays, s.rays.length);
      if (p.superFrame === PRIESTESS_SUPER_FRAME.float) floated = true;
      expect(p.superHidden).toBe(false);
    }
    expect(open).toBeGreaterThan(0.9);
    expect(rays).toBeGreaterThan(0);
    expect(floated).toBe(true);
    expect(es.every((e) => e.dead)).toBe(true);
    expect(p.hp).toBe(5);
    expect(p.casting).toBe(false);
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
    expect(portraitGrid("priestess")).toBe(96);
    const frames = PRIESTESS_PORTRAIT_VARIANTS.map((v) => portraitPixels("priestess", v)!);
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

describe("Rohiba onlayn", () => {
  const data = loadRealmData();

  function world() {
    const sim = new RealmSim(data);
    const rp = sim.addPlayer("a", "priestess");
    return { sim, rp };
  }

  function stepN(sim: RealmSim, rp: RealmPlayer, seconds: number) {
    for (let t = 0; t < seconds; t += TICK_DT) sim.step([]);
  }

  it("old clients see a knight; new ones see the Priestess", () => {
    const { rp } = world();
    expect(netPlayer(rp, "A", 1, "", "", 2)[1]).toBe("knight");
    expect(netPlayer(rp, "A", 1, "", "", HERO_VERSION)[1]).toBe("priestess");
  });

  it("an ally standing in her golden trail is healed by the server (with the cap)", () => {
    const { sim, rp } = world();
    const ally = sim.addPlayer("b", "knight");
    sim.step([{ pid: rp.id, cmd: { type: "ability", down: true } }]);
    sim.step([{ pid: rp.id, cmd: { type: "ability", down: false } }]);
    stepN(sim, rp, 0.2);
    expect(rp.p.trail.length).toBeGreaterThan(0);
    const dot = rp.p.trail[0]!;
    ally.p.x = dot.x;
    ally.p.y = dot.y - 4;
    ally.p.hp = 1;
    // Rohiba izdan uzoqlashadi — iz qoladi
    rp.p.x += 60;
    rp.lastHurt = ally.lastHurt = sim.tick;
    stepN(sim, rp, TRAIL_HEAL_TIME + 0.2);
    expect(ally.p.hp).toBe(2);
    stepN(sim, rp, 0.5);
    expect(ally.p.hp).toBe(2);
  });

  it("the super works in the realm: a mob dies, near allies get 2 hearts, farther ones 1", () => {
    const { sim, rp } = world();
    const near = sim.addPlayer("b", "knight");
    const far = sim.addPlayer("c", "knight");
    near.p.x = rp.p.x + 20;
    near.p.y = rp.p.y;
    far.p.x = rp.p.x + 100;
    far.p.y = rp.p.y;
    near.p.hp = far.p.hp = 1;
    rp.p.hp = 1;
    const m = sim.addMob("boar", rp.p.x + 40, rp.p.y);
    m.spawnT = 0;
    rp.meter.value = rp.meter.def!.charge;
    for (let t = 0; t < 8 && (t === 0 || rp.cast); t += TICK_DT)
      sim.step(t === 0 ? [{ pid: rp.id, cmd: { type: "super" } }] : []);
    if (rp.cast) endRealmSuper(rp);
    expect(m.dead).toBe(true);
    expect(rp.p.hp).toBe(4);
    expect(near.p.hp).toBe(3);
    expect(far.p.hp).toBe(2);
    expect(rp.p.casting).toBe(false);
  });
});

describe("Rohiba: uch tilda matnlar", () => {
  const KEYS = [
    "hero.priestess.name",
    "hero.priestess.desc",
    "super.priestess.name",
    "super.priestess.desc",
    "up.mercy.name",
    "up.longbeam.name",
    "up.longtrail.name",
    "up.dazzle.name",
    "up.lotusgrace.name",
    "up.lightflow.name",
    "art.prayerbeads.name",
    "skin.priestess-dawn",
    "skin.priestess-jade",
    "skin.priestess-moon",
    "skin.priestess.default",
    "tb.palm",
    "tb.step",
    "ach.winPriestess.name",
  ] as const;

  it("every Priestess text exists in Uzbek, Russian and English, and they differ", () => {
    const by: Record<Lang, string[]> = { uz: [], ru: [], en: [] };
    for (const lang of ["uz", "ru", "en"] as const) {
      setLang(lang);
      by[lang] = KEYS.map((k) => t(k));
      for (const [i, s] of by[lang].entries())
        expect(s.length, `${lang} ${KEYS[i]}`).toBeGreaterThan(1);
    }
    setLang("uz");
    expect(by.uz[0]).toBe("ROHIBA");
    expect(by.ru[0]).toBe("МОНАХИНЯ");
    expect(by.en[0]).toBe("PRIESTESS");
    expect(by.ru[2]).toBe("ЗОЛОТОЙ ЛОТОС");
    expect(by.en[2]).toBe("GOLDEN LOTUS");
    for (let i = 0; i < KEYS.length; i++) expect(by.ru[i]).not.toBe(by.en[i]);
  });
});
