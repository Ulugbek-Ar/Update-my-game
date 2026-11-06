import { beforeEach, describe, expect, it } from "vitest";
import { Game } from "./game";
import { Enemy } from "./enemy";
import { BOSS_WAVE } from "./waves";
import {
  COIN_RAIN,
  CRIT_AVG,
  CRIT_CHANCE,
  CRIT_COLOR,
  CRIT_FREEZE,
  CRIT_MUL,
  SLOWMO_SPEED,
  rollCrit,
} from "./crit";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings";

type GI = {
  startWave(i: number): void;
  damageTarget(t: unknown, d: number): void;
  strike(t: unknown, d: number): void;
  freeze: number;
};

beforeEach(() => localStorage.clear());

function game() {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement);
  return { g, gi: g as unknown as GI };
}

function target(hp = 50) {
  const e = new Enemy("golem", 120, 100);
  e.spawn = 0;
  e.hp = e.maxHp = hp;
  return e;
}

/** Qat'iy tasodif: berilgan qiymatlar navbat bilan */
function seq(...v: number[]) {
  let i = 0;
  return () => v[i++ % v.length]!;
}

describe("Kritik zarba", () => {
  it("base chance 8%, double damage; average adds +8% to the boss formula", () => {
    expect(CRIT_CHANCE).toBe(0.08);
    expect(CRIT_MUL).toBe(2);
    expect(CRIT_AVG).toBeCloseTo(1.08);
    expect(rollCrit(() => 0.079)).toBe(true);
    expect(rollCrit(() => 0.08)).toBe(false);
    // qat'iy tasodif bilan 10 000 urinishda ~8%
    let s = 7;
    const lcg = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    let n = 0;
    for (let i = 0; i < 10000; i++) if (rollCrit(lcg)) n++;
    expect(n / 10000).toBeGreaterThan(0.07);
    expect(n / 10000).toBeLessThan(0.09);
  });

  it("a crit deals 2x, shows a yellow KRIT! and a bigger burst; a normal hit does not", () => {
    const { g, gi } = game();
    const e = target();
    g.enemies = [e];
    g.critRand = seq(0.5);
    gi.strike(e, 1);
    expect(e.hp).toBe(49);
    expect(g.fx.texts.some((t) => t.s === "KRIT!")).toBe(false);
    const parts = g.fx.particles.length;
    g.critRand = seq(0.01);
    gi.strike(e, 1);
    expect(e.hp).toBe(47);
    const krit = g.fx.texts.find((t) => t.s === "KRIT!");
    expect(krit?.color).toBe(CRIT_COLOR);
    expect(g.fx.particles.length - parts).toBeGreaterThanOrEqual(20);
    expect(g.fx.damages.at(-1)).toMatchObject({ n: 2, crit: true });
  });

  it("hit-stop: 0.06 s on a crit, the old 0.045 s on a normal sword hit", () => {
    const { g, gi } = game();
    const p = g.player;
    const e = target();
    e.x = p.x;
    e.y = p.y - 14;
    const idle = target();
    idle.spawn = 999;
    g.enemies = [e, idle];
    g.critRand = seq(0.9);
    p.fx = 0;
    p.fy = -1;
    g.input.pressAttack();
    g.update(0.016);
    expect(gi.freeze).toBeCloseTo(0.045, 3);
    expect(e.hp).toBe(49);
    const { g: g2, gi: gi2 } = game();
    const p2 = g2.player;
    const e2 = target();
    e2.x = p2.x;
    e2.y = p2.y - 14;
    g2.enemies = [e2, idle];
    g2.critRand = seq(0.01);
    g2.input.pressAttack();
    g2.update(0.016);
    expect(gi2.freeze).toBeCloseTo(CRIT_FREEZE, 3);
    expect(e2.hp).toBe(48);
  });

  it("damage numbers can be turned off in the settings", () => {
    expect(loadSettings().damageNumbers).toBe(true);
    saveSettings({ ...DEFAULT_SETTINGS, damageNumbers: false });
    const { g, gi } = game();
    const e = target();
    g.enemies = [e];
    gi.damageTarget(e, 1);
    expect(g.fx.damages).toHaveLength(0);
    expect(e.hp).toBe(49);
  });
});

describe("Boss o'limi", () => {
  it("1 s slow motion (speed 0.3) and a coin rain that does not change the gold", () => {
    const { g, gi } = game();
    gi.startWave(BOSS_WAVE);
    g.enemies = [];
    g.boss!.spawn = 0;
    const gold = g.runGold;
    gi.damageTarget(g.boss, 9999);
    expect(g.slowmo).toBeGreaterThan(0.9);
    expect(g.coinRain).toHaveLength(COIN_RAIN);
    const t0 = g.time;
    g.update(0.1);
    expect(g.time - t0).toBeCloseTo(0.1 * SLOWMO_SPEED);
    for (let i = 0; i < 12; i++) g.update(0.1);
    const t1 = g.time;
    g.update(0.1);
    expect(g.time - t1).toBeCloseTo(0.1);
    // tanga yomg'iri faqat ko'rinish: boss xazinasi (5 tanga) terilgan oltin
    expect(g.runGold - gold).toBeGreaterThanOrEqual(0);
    expect(g.runGold - gold).toBeLessThanOrEqual(30);
  });
});
