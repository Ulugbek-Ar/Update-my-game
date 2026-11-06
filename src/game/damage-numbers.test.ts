import { beforeEach, describe, expect, it } from "vitest";
import { Game } from "./game";
import { Enemy } from "./enemy";
import { DAMAGE_LIFE, Effects } from "./effects";

type GameInternals = { damageTarget(t: unknown, dmg: number): void };

function makeGame() {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement);
  return { g, gi: g as unknown as GameInternals };
}

beforeEach(() => localStorage.clear());

describe("zarar raqamlari", () => {
  it("shows the damage above the enemy", () => {
    const { g, gi } = makeGame();
    const e = new Enemy("rammer", 100, 100);
    e.hp = 5;
    g.enemies = [e];
    gi.damageTarget(e, 2);
    expect(g.fx.damages).toHaveLength(1);
    expect(g.fx.damages[0]!.n).toBe(2);
    expect(g.fx.damages[0]!.y).toBeLessThan(e.y);
    expect(e.hp).toBe(3);
  });

  it("only counts the hp actually lost on the killing blow", () => {
    const { g, gi } = makeGame();
    const e = new Enemy("rammer", 100, 100);
    e.hp = 1;
    g.enemies = [e];
    gi.damageTarget(e, 3);
    expect(g.fx.damages[0]!.n).toBe(1);
  });

  it("float up, then fade out", () => {
    const fx = new Effects();
    fx.damage(50, 50, 3);
    const y0 = fx.damages[0]!.y;
    fx.update(0.1);
    expect(fx.damages[0]!.y).toBeLessThan(y0);
    fx.update(DAMAGE_LIFE);
    expect(fx.damages).toHaveLength(0);
  });

  it("are always the normal (white) color", () => {
    const fx = new Effects();
    fx.damage(10, 10, 1);
    fx.damage(20, 10, 5);
    const colors: string[] = [];
    fx.renderDamages((_s, _x, _y, _size, color) => colors.push(color));
    expect(new Set(colors)).toEqual(new Set(["#ffffff"]));
  });

  it("ignores zero damage", () => {
    const fx = new Effects();
    fx.damage(10, 10, 0);
    expect(fx.damages).toHaveLength(0);
  });
});
