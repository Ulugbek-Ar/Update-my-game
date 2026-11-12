import { beforeEach, describe, expect, it } from "vitest";
import { UPGRADES, cardFor, pickUpgrades, upgradeIcon } from "./waves";
import { UPGRADE_ICONS } from "./sprites";
import {
  DODGE_WINDOW,
  DODGE_WINDOW_CARD,
  IAI_CHARGE,
  IAI_DELAY,
  IAI_MAX_DIST,
  IAI_RANGE_CARD,
  KATANA_CD,
  KATANA_TIME,
  PARRY_BOOST,
  Player,
} from "./player";
import { Game, PETAL_RADIUS } from "./game";
import { Enemy } from "./enemy";
import { unlockHero } from "./save";
import { HERO_TAG, SYNERGY_AT, TAGS, TAG_ICONS, addTag, type TagCounts } from "./synergy";
import { ARTIFACTS, artifactPool } from "./artifacts";
import { heroDps } from "./bossPower";
import type { Input } from "./input";

const card = (id: string) => UPGRADES.find((u) => u.id === id)!;
const DT = 1 / 60;

function keys(o: Partial<{ attack: boolean; held: boolean; dash: boolean; x: number; y: number }>) {
  return {
    consumeAttack: () => !!o.attack,
    consumeDash: () => !!o.dash,
    attackHeld: () => !!o.held,
    dashHeld: () => false,
    axis: () => ({ x: o.x ?? 0, y: o.y ?? 0 }),
  } as unknown as Input;
}

function makeGame() {
  unlockHero("samurai");
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement, "samurai");
  g.hints = [];
  const keeper = new Enemy("blob", 290, 30);
  keeper.spawn = 99;
  g.enemies = [keeper];
  const p = g.player;
  p.x = 100;
  p.y = 120;
  p.fx = 1;
  p.fy = 0;
  return { g, p };
}

function dummy(g: Game, x: number, y: number) {
  const e = new Enemy("rammer", x, y);
  e.spawn = 0;
  e.hp = e.maxHp = 40;
  e.update = () => {};
  g.enemies.push(e);
  return e;
}

function tick(g: Game, seconds: number) {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    g.update(DT);
    g.input.endFrame();
  }
}

beforeEach(() => localStorage.clear());

describe("Samuray kuch kartalari", () => {
  const expected: Record<string, [string, string]> = {
    heart: ["SAKURA YURAGI", "sheart"],
    blade: ["O'TKIR KATANA", "katana"],
    reach: ["UZUN IAI", "longiai"],
    haste: ["TEZ QIN", "quickdraw"],
    wind: ["SHAMOL QADAMI", "windstep"],
    vamp: ["TIG' TASHNALIGI", "thirst"],
    thorns: ["QAYTGAN PO'LAT", "steelback"],
    dash2: ["IKKI KARRA QADAM", "step2"],
    mend: ["YASHIL CHOY", "tea"],
  };

  it("every shared card has its own Samurai name and code-drawn icon", () => {
    const knight = new Player("knight");
    const p = new Player("samurai");
    for (const [id, [name, icon]] of Object.entries(expected)) {
      const k = cardFor(card(id), knight);
      const c = cardFor(card(id), p);
      expect(c.name).toBe(name);
      expect(c.name).not.toBe(k.name === "SHAMOL QADAMI" ? "" : k.name);
      expect(upgradeIcon(c)).toBe(icon);
      expect(UPGRADE_ICONS[icon]).toHaveLength(12);
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(c.desc).not.toMatch(/[Tt]eleport|[Qq]ilich|aylana/);
    }
  });

  it("Samurai has 12 cards: 9 shared variants + IKKI KESIM, GULBARG BO'RONI, SOVUQ QON", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const p = new Player("samurai");
      p.hp = 1;
      for (const u of pickUpgrades(p, 3)) seen.add(u.name);
    }
    expect([...seen].sort()).toEqual(
      [
        ...Object.values(expected).map(([n]) => n),
        "IKKI KESIM",
        "GULBARG BO'RONI",
        "SOVUQ QON",
      ].sort(),
    );
    // boshqa qahramonga Samuray kartalari chiqmaydi
    for (let i = 0; i < 200; i++)
      for (const u of pickUpgrades(new Player("knight"), 3))
        expect(["twincut", "petalstorm", "coldblood"]).not.toContain(u.id);
  });

  it("UZUN IAI lengthens the slide (twice at most)", () => {
    const p = new Player("samurai");
    const c = cardFor(card("reach"), p);
    expect(c.tags).toEqual(["gul"]);
    c.apply(p);
    expect(p.iaiRange).toBe(IAI_RANGE_CARD);
    expect(c.ok(p)).toBe(true);
    c.apply(p);
    expect(c.ok(p)).toBe(false);
    // katana masofasi o'zgarmaydi
    expect(p.reach).toBe(new Player("samurai").reach);
    p.x = 40;
    p.y = 120;
    p.fx = 1;
    p.fy = 0;
    for (let t = 0; t < IAI_CHARGE + 0.05; t += DT) p.update(DT, keys({ held: true }));
    p.update(DT, keys({}));
    const x0 = p.x;
    for (let i = 0; i < 60 && p.dashing; i++) p.update(DT, keys({}));
    expect(p.x - x0).toBeCloseTo(IAI_MAX_DIST + IAI_RANGE_CARD * 2, 0);
  });

  it("TEZ QIN speeds the katana up but never below the slash itself", () => {
    const p = new Player("samurai");
    const c = cardFor(card("haste"), p);
    c.apply(p);
    expect(p.attackCd).toBeCloseTo(KATANA_CD * 0.75);
    while (c.ok(p)) c.apply(p);
    expect(p.attackCd).toBeGreaterThan(KATANA_TIME);
  });

  it("SHAMOL QADAMI widens the perfect dodge window", () => {
    const p = new Player("samurai");
    const speed = p.speed;
    const c = cardFor(card("wind"), p);
    c.apply(p);
    expect(p.speed).toBeCloseTo(speed * 1.15);
    expect(p.dodgeWindow).toBeCloseTo(DODGE_WINDOW + DODGE_WINDOW_CARD);
    // kengroq oyna: oddiy oynadan kech, lekin yangi oyna ichida
    p.update(DT, keys({ dash: true }));
    for (let t = 0; t < DODGE_WINDOW + 0.03; t += DT) p.update(DT, keys({}));
    p.takeHit(1, p.x + 4, p.y, 100);
    expect(p.perfect).toBe(true);
  });

  it("QAYTGAN PO'LAT: a parry gives 2 s of speed", () => {
    const { g, p } = makeGame();
    cardFor(card("thorns"), p).apply(p);
    expect(p.parryBoost).toBe(true);
    expect(p.thorns).toBe(false);
    const foe = dummy(g, 111, 120);
    g.input.pressAttack();
    g.update(DT);
    p.takeHit(1, foe.x, foe.y, 180);
    g.update(DT);
    expect(p.boost).toBeGreaterThan(PARRY_BOOST - 0.1);
  });

  it("IKKI KESIM: Iai cuts every marked enemy twice", () => {
    const { g, p } = makeGame();
    card("twincut").apply(p);
    const a = dummy(g, 130, 120);
    g.input.setTouchAttack(true);
    tick(g, IAI_CHARGE + 0.05);
    g.input.setTouchAttack(false);
    tick(g, IAI_DELAY + 0.8);
    expect(a.hp).toBe(40 - 2 * 2 * p.damage);
    // boss joni formulasi ham ikki kesimni hisobga oladi
    const plain = new Player("samurai");
    expect(heroDps(p)).toBeGreaterThan(heroDps(plain));
  });

  it("GULBARG BO'RONI: a perfect dodge hits everyone around", () => {
    const { g, p } = makeGame();
    card("petalstorm").apply(p);
    const near = dummy(g, p.x + PETAL_RADIUS - 6, 120);
    const far = dummy(g, p.x + PETAL_RADIUS + 30, 120);
    p.perfect = true;
    g.update(DT);
    expect(near.hp).toBe(40 - p.damage);
    expect(far.hp).toBe(40);
  });

  it("cards carry over to the next world and survive a retry", () => {
    const { g, p } = makeGame();
    for (const id of ["reach", "wind", "thorns", "twincut", "petalstorm", "coldblood"])
      cardFor(card(id), p).apply(p);
    g.startChapter(2);
    g.retryChapter();
    const q = g.player;
    expect([q.iaiRange, q.iaiDouble, q.parryBoost, q.petalStorm, q.coldBlood]).toEqual([
      IAI_RANGE_CARD,
      true,
      true,
      true,
      true,
    ]);
    expect(q.dodgeWindow).toBeCloseTo(DODGE_WINDOW + DODGE_WINDOW_CARD);
  });
});

describe("Samuray tegi va sinergiyasi", () => {
  it("SAKURA is the Samurai's own tag: three of them make a full Iai deal 3x", () => {
    expect(HERO_TAG.samurai).toBe("gul");
    expect(TAGS.gul.name).toBe("SAKURA");
    expect(TAG_ICONS.gul).toHaveLength(7);
    for (const row of TAG_ICONS.gul) expect(row).toMatch(/^[.kXw]{7}$/);
    const p = new Player("samurai");
    const tags: TagCounts = {};
    const charge = p.chargeTime;
    expect(addTag(tags, "gul", p)).toBeNull();
    // 2 ta: zaryad 20% tez
    expect(addTag(tags, "gul", p)).toBe("two");
    expect(p.chargeTime).toBeCloseTo(charge * 0.8);
    expect(p.strongMul).toBe(2);
    expect(addTag(tags, "gul", p)).toBe("three");
    expect(tags.gul).toBe(SYNERGY_AT);
    expect(p.strongMul).toBe(3);
    // to'liq zaryadlangan Iai endi 3 baravar
    p.fx = 1;
    p.fy = 0;
    for (let t = 0; t < p.chargeTime + 0.05; t += DT) p.update(DT, keys({ held: true }));
    p.update(DT, keys({}));
    expect(p.iai!.mul).toBe(3);
  });

  it("four cards carry the SAKURA tag, so the synergy is reachable", () => {
    const p = new Player("samurai");
    const own = UPGRADES.filter((u) => !u.hero || u.hero === "samurai")
      .map((u) => cardFor(u, p))
      .filter((u) => u.tags.includes("gul"))
      .map((u) => u.name);
    expect(own.sort()).toEqual(["GULBARG BO'RONI", "IKKI KESIM", "SOVUQ QON", "UZUN IAI"]);
  });
});

describe("Samuray va artefaktlar", () => {
  it("gets the 12 shared artifacts plus her own SAKURA SHAMOLI", () => {
    const pool = artifactPool("samurai", []);
    expect(pool).toHaveLength(13);
    expect(pool.filter((a) => a.hero).map((a) => a.id)).toEqual(["iaireset"]);
    expect(ARTIFACTS.find((a) => a.id === "iaireset")?.name).toBe("SAKURA SHAMOLI");
  });

  it("SAKURA SHAMOLI: a perfect dodge makes the Iai ready at once", () => {
    const { g, p } = makeGame();
    g.artifacts = ["iaireset"];
    p.spinCooldown = 2.5;
    p.perfect = true;
    g.update(DT);
    expect(p.spinCooldown).toBeLessThanOrEqual(0);
  });

  it("shared artifacts work with the katana: O'NINCHI ZARB and OLOV IZI", () => {
    const { g, p } = makeGame();
    g.artifacts = ["tenth", "flame"];
    const foe = dummy(g, 114, 120);
    for (let i = 0; i < 10; i++) {
      g.input.pressAttack();
      // zarba orasi + hit-stop kadrlari
      tick(g, KATANA_CD + 0.15);
    }
    // 9 ta oddiy + 10-zarba ikki baravar
    expect(foe.hp).toBeCloseTo(40 - 9 * 0.75 - 1.5, 5);
    // dash izidan olov qoladi
    g.input.pressDash();
    tick(g, 0.1);
    expect(g.flames.length).toBeGreaterThan(0);
    expect(p.dashing || p.guarded).toBe(true);
  });
});
