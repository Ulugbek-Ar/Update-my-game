import { beforeEach, describe, expect, it } from "vitest";
import {
  AMBUSH_CARD,
  AMBUSH_GRACE,
  AMBUSH_MUL,
  Player,
  SHINOBI_MAX_HP,
  SHINOBI_SPEED,
  SHURIKEN_CARD,
  SHURIKEN_CD,
  SHURIKEN_CHARGE,
  SHURIKEN_N,
  TWIN_CD,
  TWIN_MUL,
  VANISH_TIME,
} from "./player";
import { Game } from "./game";
import { Enemy } from "./enemy";
import { Boss } from "./boss";
import { heroDps } from "./bossPower";
import { HERO_LIST, SHINOBI_PRICE } from "./hero";
import { buyHero, addGold, heroPrice, loadGold } from "./shop";
import { isHeroUnlocked, unlockHero } from "./save";
import { SKINS, SKINS_KEY, SKIN_PRICES } from "./skins";
import { SUPERS, superFor } from "./super";
import { UPGRADES } from "./waves";
import { goldenNumbers } from "./golden";
import { SHINOBI_PORTRAIT_VARIANTS, portraitGrid, portraitPixels } from "./portrait";
import { PALETTES, spriteGrid, spritePixels } from "./sprites";
import { SHINOBI_FRAME, SHINOBI_FRAMES, SHINOBI_SUPER_FRAME } from "./shinobiSprites";
import { sceneFor } from "./superScene";
import { StormScene } from "./stormFx";
import { ROOM } from "./animation";
import { RealmSim, TICK_DT, type PlayerCommand, type RealmPlayer } from "@/realm/sim";
import { loadRealmData } from "@/realm/data";
import { netPlayer } from "@/realm/net/room";
import { HERO_VERSION } from "./heroCompat";
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

function ninja(x = 100, y = 120) {
  const p = new Player("shinobi");
  p.x = x;
  p.y = y;
  p.fx = 1;
  p.fy = 0;
  return p;
}

/** Shurikenlarni otish: zaryad to'lguncha bosib turish, so'ng qo'yib yuborish */
function throwStars(p: Player) {
  run(p, SHURIKEN_CHARGE + 0.05, keys({ held: true }));
  p.update(DT, keys({}));
  return p.bolts.filter((b) => b.shuriken);
}

function makeGame() {
  unlockHero("shinobi");
  const g = new Game(canvas as unknown as HTMLCanvasElement, "shinobi");
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

describe("Ninja: do'kon", () => {
  it("is the 7th hero, a warrior, sold for 600 gold", () => {
    const info = HERO_LIST.find((h) => h.id === "shinobi")!;
    expect(HERO_LIST.indexOf(info)).toBe(6);
    expect(info.name).toBe("NINJA");
    expect(info.role).toBe("warrior");
    expect(SHINOBI_PRICE).toBe(600);
    expect(heroPrice("shinobi")).toBe(600);
  });

  it("cannot be bought without enough gold; with 600 it unlocks once", () => {
    addGold(599);
    expect(buyHero("shinobi")).toBe(false);
    expect(isHeroUnlocked("shinobi")).toBe(false);
    addGold(1);
    expect(buyHero("shinobi")).toBe(true);
    expect(loadGold()).toBe(0);
    expect(isHeroUnlocked("shinobi")).toBe(true);
    addGold(600);
    expect(buyHero("shinobi")).toBe(false);
    expect(loadGold()).toBe(600);
  });
});

describe("Ninja: ikki katana", () => {
  it("4 hearts like the Samurai, fast, light and quick strikes", () => {
    const p = ninja();
    expect(p.maxHp).toBe(SHINOBI_MAX_HP);
    expect(SHINOBI_MAX_HP).toBe(new Player("samurai").maxHp);
    expect(p.speed).toBe(SHINOBI_SPEED);
    expect(p.attackCd).toBe(TWIN_CD);
    expect(p.hitDamage).toBeCloseTo(TWIN_MUL, 5);
    expect(p.ranged).toBe(false);
  });

  it("left and right blades alternate on every strike", () => {
    const p = ninja();
    const sides: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      p.update(DT, keys({ attack: true }));
      expect(p.attackBox()).not.toBeNull();
      sides.push(p.blade);
      run(p, TWIN_CD + 0.02);
    }
    expect(sides).toEqual([true, false, true, false]);
  });

  it("balance: ideal DPS sits between the Paladin and the Knight", () => {
    const [knight, paladin, nin] = (["knight", "paladin", "shinobi"] as const).map((h) =>
      heroDps(new Player(h)),
    );
    expect(nin).toBeGreaterThan(paladin!);
    expect(nin).toBeLessThan(knight!);
    expect(nin).toBeCloseTo(TWIN_MUL / TWIN_CD, 5);
  });
});

describe("Ninja: shuriken", () => {
  it("holding the attack throws 3 stars in a fan; then it has to cool down", () => {
    const p = ninja();
    const stars = throwStars(p);
    expect(stars).toHaveLength(SHURIKEN_N);
    expect(SHURIKEN_N).toBe(3);
    const angles = stars.map((b) => Math.atan2(b.vy, b.vx));
    expect(angles[0]!).toBeLessThan(angles[1]!);
    expect(angles[1]!).toBeCloseTo(0, 5);
    expect(angles[2]!).toBeCloseTo(-angles[0]!, 5);
    for (const b of stars) expect(b.range).toBeGreaterThan(100);
    // melee maydoni yo'q — faqat shurikenlar
    expect(p.attackBox()).toBeNull();
    p.bolts = [];
    expect(throwStars(p)).toHaveLength(0);
    run(p, SHURIKEN_CD);
    expect(throwStars(p)).toHaveLength(3);
  });

  it("KO'P SHURIKEN card: +2 stars (5), offered once", () => {
    const p = ninja();
    const card = UPGRADES.find((u) => u.id === "manystars")!;
    expect(card.hero).toBe("shinobi");
    expect(card.ok(p)).toBe(true);
    card.apply(p);
    expect(card.ok(p)).toBe(false);
    expect(throwStars(p)).toHaveLength(SHURIKEN_N + SHURIKEN_CARD);
  });

  it("stars fly through the game and hurt enemies", () => {
    const { g, p } = makeGame();
    p.fx = 1;
    p.fy = 0;
    const e = foe(g, p.x + 60, p.y);
    e.update = () => {};
    const hp = e.hp;
    g.update(DT);
    (p as unknown as { charge: number }).charge = p.chargeTime;
    p.spinCooldown = 0;
    // zaryad to'lgan holatda qo'yib yuborish
    g.input.attackHeld = () => false;
    for (let i = 0; i < 40 && e.hp === hp; i++) g.update(DT);
    expect(e.hp).toBeLessThan(hp);
  });
});

describe("Ninja: tutun bombasi va ko'rinmaslik", () => {
  it("the dash drops a smoke cloud and makes him invisible for 1 s", () => {
    const p = ninja();
    p.update(DT, keys({ dash: true }));
    expect(p.smokes).toHaveLength(1);
    expect(p.hidden).toBe(true);
    expect(p.hideT).toBeCloseTo(VANISH_TIME, 1);
    run(p, VANISH_TIME - 0.1);
    expect(p.hidden).toBe(true);
    run(p, 0.15);
    expect(p.hidden).toBe(false);
  });

  it("enemies lose him: they aim at the smoke, even after he jumps out of it", () => {
    const { g, p } = makeGame();
    const aim = () => (g as unknown as { aiTarget(): { x: number; y: number } }).aiTarget();
    foe(g, 260, 60);
    expect(aim()).toBe(p);
    g.input.consumeDash = () => true;
    g.update(DT);
    g.input.consumeDash = () => false;
    const at = { x: g.smokes[0]!.x, y: g.smokes[0]!.y };
    for (let i = 0; i < 20; i++) g.update(DT);
    // Ninja tutundan uzoqlashgan, lekin hali ko'rinmaydi
    expect(p.hidden).toBe(true);
    expect(aim()).not.toBe(p);
    expect(aim()).toMatchObject(at);
    for (let i = 0; i < 60; i++) g.update(DT);
    expect(p.hidden).toBe(false);
    expect(aim()).toBe(p);
  });

  it("the first strike after vanishing deals x2 (backstab), the next one is normal", () => {
    const p = ninja();
    p.update(DT, keys({ dash: true }));
    run(p, 0.3);
    p.update(DT, keys({ attack: true }));
    expect(p.hitDamage).toBeCloseTo(TWIN_MUL * AMBUSH_MUL, 5);
    expect(p.ambushed).toBe(true);
    // hujum ko'rinmaslikni buzadi
    expect(p.hidden).toBe(false);
    run(p, TWIN_CD + 0.02);
    p.update(DT, keys({ attack: true }));
    expect(p.hitDamage).toBeCloseTo(TWIN_MUL, 5);
  });

  it("the backstab also powers up the stars; it waits only a short grace after vanishing", () => {
    const p = ninja();
    p.update(DT, keys({ dash: true }));
    for (const b of throwStars(p)) expect(b.power).toBe(AMBUSH_MUL);
    const q = ninja();
    q.update(DT, keys({ dash: true }));
    run(q, VANISH_TIME + AMBUSH_GRACE + 0.1);
    q.update(DT, keys({ attack: true }));
    expect(q.hitDamage).toBeCloseTo(TWIN_MUL, 5);
  });

  it("cards: UZUN SOYA makes invisibility longer, ORQADAN ZARBA makes the backstab x2.5", () => {
    const p = ninja();
    UPGRADES.find((u) => u.id === "longshadow")!.apply(p);
    UPGRADES.find((u) => u.id === "backstab")!.apply(p);
    p.update(DT, keys({ dash: true }));
    run(p, VANISH_TIME + 0.2);
    expect(p.hidden).toBe(true);
    p.update(DT, keys({ attack: true }));
    expect(p.hitDamage).toBeCloseTo(TWIN_MUL * AMBUSH_CARD, 5);
  });

  it("has 4 own cards with the SOYA tag plus 2 super cards", () => {
    const own = UPGRADES.filter((u) => u.hero === "shinobi");
    expect(own.filter((u) => !u.super).map((u) => u.tags)).toEqual([
      ["soya"],
      ["soya"],
      ["soya"],
      ["soya"],
    ]);
    expect(own.filter((u) => u.super === "shadow-storm")).toHaveLength(2);
  });
});

describe("Ninja: sprayt va skinlar", () => {
  it("5 colours, a 48 px grid, own frames for both blades, stars, smoke and the super", () => {
    expect(PALETTES.shinobi).toHaveLength(5);
    expect(new Set(PALETTES.shinobi).size).toBe(5);
    expect(spriteGrid("shinobi")).toBe(48);
    expect(SHINOBI_FRAMES.idle).toBe(4);
    expect(SHINOBI_FRAMES.walk).toBe(6);
    const frames = [
      0,
      1,
      SHINOBI_FRAME.left,
      SHINOBI_FRAME.left + 1,
      SHINOBI_FRAME.aim,
      SHINOBI_FRAME.throw,
      SHINOBI_FRAME.dash,
      SHINOBI_SUPER_FRAME.seal,
      SHINOBI_SUPER_FRAME.draw,
      SHINOBI_SUPER_FRAME.sheathe,
    ];
    const keyOf = (f: number) => Array.from(spritePixels("shinobi", "attack", f)).join("");
    expect(new Set(frames.map(keyOf)).size).toBe(frames.length);
    // qizil (4) va po'lat (5) bor: sharf va ikki tig'
    const idle = spritePixels("shinobi", "idle", 0);
    expect(idle.includes(4)).toBe(true);
    expect(idle.includes(5)).toBe(true);
  });

  it("three skins at 80 / 150 / 250 gold that give no power at all", () => {
    expect(SKINS.shinobi.slice(1).map((s) => s.price)).toEqual([...SKIN_PRICES]);
    expect(SKINS.shinobi[3]!.tier).toBe("legendary");
    const plain = (goldenNumbers() as Record<string, unknown>)["hero:shinobi"];
    for (const s of SKINS.shinobi.slice(1)) {
      localStorage.setItem(SKINS_KEY, JSON.stringify({ owned: [s.id], sel: { shinobi: s.id } }));
      const { p } = makeGame();
      expect(p.skin?.id).toBe(s.id);
      const fresh = new Player("shinobi");
      for (const k of ["speed", "damage", "attackCd", "dashCd", "maxHp", "reach", "vanishTime"])
        expect((p as unknown as Record<string, number>)[k], `${s.id}.${k}`).toBe(
          (fresh as unknown as Record<string, number>)[k],
        );
      expect(heroDps(p)).toBe(heroDps(fresh));
    }
    expect(plain).toBeDefined();
  });
});

describe("Ninja: SOYA BO'RONI", () => {
  const def = () => superFor("shinobi")!;

  it("is open, uses the super.ts pattern and a strict boss cap", () => {
    expect(SUPERS.shinobi?.name).toBe("SOYA BO'RONI");
    expect(def().dmg).toEqual({ kill: true, boss: 0.08, bossCap: 0.1 });
    expect(def().center).toBe(true);
    expect(sceneFor(def().fx)).toBeInstanceOf(StormScene);
  });

  it("vanishes into smoke, a shadow clone cuts every enemy, he reappears in the middle", () => {
    const { g, p } = makeGame();
    const es = [foe(g, 240, 60), foe(g, 80, 60), foe(g, 250, 190)];
    for (const e of es) e.update = () => {};
    g.superMeter.value = g.superMeter.def!.charge;
    expect(g.useSuper()).toBe(true);
    let hiddenInStrike = false;
    let clones = 0;
    for (let t = 0; t < 8 && g.cast; t += DT) {
      g.update(DT);
      if (g.cast?.stage === "strike" && p.superHidden) hiddenInStrike = true;
      clones = Math.max(clones, (g.scene as StormScene).clones.length);
    }
    expect(hiddenInStrike).toBe(true);
    expect(clones).toBeGreaterThan(0);
    expect(es.every((e) => e.dead)).toBe(true);
    expect(Math.abs(p.x - ROOM.w / 2)).toBeLessThan(60);
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
    expect(portraitGrid("shinobi")).toBe(96);
    const frames = SHINOBI_PORTRAIT_VARIANTS.map((v) => portraitPixels("shinobi", v)!);
    expect(new Set(frames.map((f) => f.join(""))).size).toBe(3);
    const f = frames[0]!;
    let same = 0,
      all = 0;
    for (let y = 0; y < 96; y++)
      for (let x = 0; x < 48; x++) {
        if (!f[y * 96 + x] && !f[y * 96 + 95 - x]) continue;
        all++;
        // siluet simmetrik (ranglar yorug'lik tufayli farq qiladi)
        if (!!f[y * 96 + x] === !!f[y * 96 + 95 - x]) same++;
      }
    expect(same / all).toBeGreaterThan(0.9);
  });
});

describe("Ninja onlayn", () => {
  const data = loadRealmData();

  function world() {
    const sim = new RealmSim(data);
    const rp = sim.addPlayer("a", "shinobi");
    return { sim, rp };
  }

  function step(sim: RealmSim, rp: RealmPlayer, cmd?: PlayerCommand["cmd"]) {
    sim.step(cmd ? [{ pid: rp.id, cmd }] : []);
  }

  it("old clients see a knight; new ones see the Ninja with its own flags", () => {
    const { rp } = world();
    expect(netPlayer(rp, "A", 1, "", "", 1)[1]).toBe("knight");
    expect(netPlayer(rp, "A", 1, "", "", HERO_VERSION)[1]).toBe("shinobi");
  });

  it("the smoke bomb hides him online too, even out of the smoke", () => {
    const { sim, rp } = world();
    step(sim, rp, { type: "ability", down: true });
    step(sim, rp, { type: "ability", down: false });
    expect(sim.smokes.length).toBeGreaterThan(0);
    const at = sim.smokes[0]!;
    // 0.6 s yuradi: tutundan chiqib ketadi, lekin hali ko'rinmaydi
    for (let t = 0; t < 0.6; t += TICK_DT) step(sim, rp, { type: "move", x: 1, y: 0 });
    expect(Math.hypot(rp.p.x - at.x, rp.p.y - at.y)).toBeGreaterThan(30);
    expect(rp.p.hidden).toBe(true);
    for (let t = 0; t < VANISH_TIME; t += TICK_DT) step(sim, rp);
    expect(rp.p.hidden).toBe(false);
  });

  it("the super works in the realm: a mob on screen dies", () => {
    const { sim, rp } = world();
    const m = sim.addMob("boar", rp.p.x + 40, rp.p.y);
    m.spawnT = 0;
    rp.meter.value = rp.meter.def!.charge;
    for (let t = 0; t < 8 && (t === 0 || rp.cast); t += TICK_DT)
      sim.step(t === 0 ? [{ pid: rp.id, cmd: { type: "super" } }] : []);
    expect(m.dead).toBe(true);
    expect(rp.p.casting).toBe(false);
  });
});
