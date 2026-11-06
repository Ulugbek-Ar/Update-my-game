import { beforeEach, describe, expect, it } from "vitest";
import { Game, CRIT_STOP, HIT_STOP, RANGED_STOP, RANGED_STOP_GAP } from "./game";
import { Enemy } from "./enemy";
import { DAMAGE_LIFE, Effects, SHAKE_BIG, SHAKE_SMALL } from "./effects";
import { HIT_FLASH, applyHit, hitFlash } from "./animation";
import { spriteShards } from "./sprites";

type GameInternals = {
  freeze: number;
  hitStop(sec: number, ranged?: boolean): void;
  damageTarget(t: unknown, dmg: number, knock?: boolean | number, crit?: boolean): void;
  ghosts: unknown[];
  updateGhosts(dt: number): void;
};

function makeGame() {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement);
  return { g, gi: g as unknown as GameInternals };
}

beforeEach(() => localStorage.clear());

describe("hit-stop", () => {
  it("is 50–70 ms for a normal hit and 100 ms for a crit", () => {
    expect(HIT_STOP).toBeGreaterThanOrEqual(0.05);
    expect(HIT_STOP).toBeLessThanOrEqual(0.07);
    expect(RANGED_STOP).toBeGreaterThanOrEqual(0.05);
    expect(CRIT_STOP).toBe(0.1);
  });

  it("does not stack ranged hit-stops faster than the gap", () => {
    const { g, gi } = makeGame();
    gi.hitStop(RANGED_STOP, true);
    expect(gi.freeze).toBe(RANGED_STOP);
    gi.freeze = 0;
    gi.hitStop(RANGED_STOP, true);
    expect(gi.freeze).toBe(0);
    g.stats.time += RANGED_STOP_GAP;
    gi.hitStop(RANGED_STOP, true);
    expect(gi.freeze).toBe(RANGED_STOP);
  });
});

describe("damage numbers", () => {
  it("shows the real damage above the enemy; crit is flagged", () => {
    const { g, gi } = makeGame();
    const e = new Enemy("rammer", 100, 100);
    e.hp = 5;
    g.enemies = [e];
    gi.damageTarget(e, 2, true, true);
    expect(g.fx.damages).toHaveLength(1);
    expect(g.fx.damages[0]).toMatchObject({ n: 2, crit: true });
    expect(g.fx.damages[0]!.y).toBeLessThan(e.y);
  });

  it("only counts the hp actually lost on the killing blow", () => {
    const { g, gi } = makeGame();
    const e = new Enemy("rammer", 100, 100);
    e.hp = 1;
    g.enemies = [e];
    gi.damageTarget(e, 3);
    expect(g.fx.damages[0]!.n).toBe(1);
  });

  it("float up and fade out", () => {
    const fx = new Effects();
    fx.damage(50, 50, 3);
    const y0 = fx.damages[0]!.y;
    fx.update(0.1);
    expect(fx.damages[0]!.y).toBeLessThan(y0);
    fx.update(DAMAGE_LIFE);
    expect(fx.damages).toHaveLength(0);
  });
});

describe("death shatter", () => {
  it("killing an enemy scatters its sprite pixels with gravity", () => {
    const { g, gi } = makeGame();
    const e = new Enemy("rammer", 100, 100);
    e.hp = 1;
    g.enemies = [e];
    const before = g.fx.particles.length;
    gi.damageTarget(e, 1);
    const shards = g.fx.particles.slice(before).filter((p) => p.g);
    expect(shards.length).toBeGreaterThan(10);
  });

  it("sprite shards use the sprite's own colors and stay capped", () => {
    const list = spriteShards("skeleton", "hurt", 0, false, 40);
    expect(list.length).toBeGreaterThan(5);
    expect(list.length).toBeLessThanOrEqual(40);
    for (const s of list) expect(s.color).toMatch(/^#/);
  });
});

describe("white flash", () => {
  it("is solid white only for ~2 frames after a hit", () => {
    const e = new Enemy("rammer", 100, 100);
    e.hp = 5;
    applyHit(e, 1, 90, 100, 220);
    expect(e.flash).toBe(HIT_FLASH);
    expect(hitFlash(e)).toBe(true);
    e.flash -= 1 / 60;
    expect(hitFlash(e)).toBe(true);
    e.flash -= 2 / 60;
    expect(hitFlash(e)).toBe(false);
  });

  it("knockback still pushes the enemy away", () => {
    const e = new Enemy("rammer", 100, 100);
    e.hp = 5;
    applyHit(e, 1, 90, 100, 220);
    expect(e.vx).toBeGreaterThan(0);
  });
});

describe("screen shake", () => {
  it("boss/death shakes harder than a normal hit", () => {
    const fx = new Effects();
    fx.addShake(0.3);
    const small = fx.shakeAmount();
    fx.update(1);
    fx.addShake(0.3, SHAKE_BIG);
    expect(fx.shakeAmount()).toBeGreaterThan(small);
    expect(small).toBeLessThanOrEqual(SHAKE_SMALL);
  });
});

describe("dash trail", () => {
  it("leaves fading copies only while dashing", () => {
    const { g, gi } = makeGame();
    gi.updateGhosts(0.05);
    expect(gi.ghosts).toHaveLength(0);
    g.player.dashTimer = 0.1;
    gi.updateGhosts(0.01);
    gi.updateGhosts(0.04);
    expect(gi.ghosts.length).toBeGreaterThanOrEqual(2);
    g.player.dashTimer = 0;
    gi.updateGhosts(1);
    expect(gi.ghosts).toHaveLength(0);
  });
});
