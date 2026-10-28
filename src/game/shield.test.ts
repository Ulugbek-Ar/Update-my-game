import { beforeEach, describe, expect, it } from "vitest";
import { Enemy, BASH_WINDUP, SHIELD_TURN, angleDiff } from "./enemy";
import { Player, CHARGE_TIME } from "./player";
import { Game } from "./game";
import { WAVES, BOSS_WAVE, ENDLESS_SHIELD_FROM, waveEnemies } from "./waves";
import { KILL_GOLD } from "./shop";
import type { Bolt } from "./player";

beforeEach(() => localStorage.clear());

function run(e: Enemy, p: Player, seconds: number, dt = 0.02) {
  for (let t = 0; t < seconds; t += dt) e.update(dt, p);
}

function makeGame(hero: "knight" | "mage" = "knight") {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  return new Game(canvas as unknown as HTMLCanvasElement, hero);
}

function tick(g: Game, seconds: number, dt = 0.02) {
  for (let t = 0; t < seconds; t += dt) g.update(dt);
}

/** O'yinchi chapda, qalqonli skelet o'ngda 14px masofada; qalqon burchagi berilgan. */
function duel(hero: "knight" | "mage", shieldAngle: number) {
  const g = makeGame(hero);
  g.hints = [];
  const p = g.player;
  p.x = 160;
  p.y = 150;
  p.fx = 1;
  p.fy = 0;
  const e = new Enemy("shield", p.x + 14, p.y);
  e.shieldAngle = shieldAngle;
  g.enemies = [e];
  g.chest = null;
  return { g, p, e };
}

describe("Qalqonli skelet", () => {
  it("has 5 HP, skeleton-sized collision, gives 3 gold and walks slower than the skeleton warrior", () => {
    const p = new Player();
    p.x = 60;
    p.y = 120;
    const e = new Enemy("shield", 200, 120);
    expect(e.hp).toBe(5);
    expect(e.size).toBe(14);
    expect(KILL_GOLD.shield).toBe(3);
    run(e, p, 1);
    const moved = 200 - e.x;
    expect(moved).toBeGreaterThan(10);
    // skelet jangchi 160 tezlikda yuguradi, qalqonli skelet esa ~26
    expect(moved).toBeLessThan(40);
  });

  it("turns the shield toward the player at about 90 degrees per second", () => {
    const p = new Player();
    p.x = 60;
    p.y = 120;
    const e = new Enemy("shield", 200, 120);
    e.shieldAngle = 0; // o'yinchiga orqasi bilan
    run(e, p, 0.5);
    expect(Math.abs(e.shieldAngle)).toBeCloseTo(SHIELD_TURN * 0.5, 1);
    run(e, p, 2);
    expect(Math.abs(angleDiff(e.shieldAngle, Math.PI))).toBeLessThan(0.01);
  });

  it("blocks hits from the front only", () => {
    const e = new Enemy("shield", 100, 100);
    e.shieldAngle = Math.PI;
    expect(e.blocks(80, 100)).toBe(true);
    expect(e.blocks(80, 110)).toBe(true);
    expect(e.blocks(120, 100)).toBe(false);
    expect(e.blocks(100, 130)).toBe(false);
    expect(new Enemy("rammer", 100, 100).blocks(80, 100)).toBe(false);
  });

  it("bashes with the shield after a 0.5s windup: 1 damage", () => {
    const p = new Player();
    p.x = 160;
    p.y = 120;
    const e = new Enemy("shield", 180, 120);
    e.shieldAngle = Math.PI;
    run(e, p, 0.1);
    expect(e.anim.state).toBe("attack");
    expect(p.hp).toBe(6);
    run(e, p, BASH_WINDUP);
    expect(p.hp).toBe(5);
    expect(e.anim.frame).toBe(2);
  });

  it("knight: a sword hit from the front is blocked, from behind it deals damage", () => {
    const front = duel("knight", Math.PI);
    front.g.input.pressAttack();
    tick(front.g, 0.12);
    expect(front.e.hp).toBe(5);
    expect(front.e.blockFlash).toBeGreaterThan(0);
    // o'yinchi biroz orqaga itariladi
    expect(front.p.x).toBeLessThan(160);

    const back = duel("knight", 0);
    back.g.input.pressAttack();
    tick(back.g, 0.06);
    expect(back.e.hp).toBe(4);
  });

  it("knight's spin attack pierces the shield for 1 damage", () => {
    const { g, p, e } = duel("knight", Math.PI);
    p.spinCooldown = 0;
    p.charge = CHARGE_TIME;
    tick(g, 0.06);
    expect(p.spinning).toBe(true);
    expect(e.hp).toBe(4);
  });

  it("mage: a bolt from the front is blocked, from behind it hits; the ring pierces for 1", () => {
    const bolt = (x: number, vx: number): Bolt => ({
      x,
      y: 150,
      vx,
      vy: 0,
      size: 6,
      left: 1,
      hit: [],
    });
    const front = duel("mage", Math.PI);
    front.e.x = 230;
    front.g.bolts = [bolt(205, 170)];
    tick(front.g, 0.2);
    expect(front.e.hp).toBe(5);
    expect(front.g.bolts.length).toBe(0);

    const back = duel("mage", Math.PI);
    back.e.x = 230;
    back.g.bolts = [bolt(255, -170)];
    tick(back.g, 0.2);
    expect(back.e.hp).toBe(4);

    const ring = duel("mage", Math.PI);
    ring.p.spinCooldown = 0;
    ring.p.charge = CHARGE_TIME;
    tick(ring.g, 0.06);
    expect(ring.e.hp).toBe(4);
  });

  it("both heroes can defeat it", () => {
    for (const hero of ["knight", "mage"] as const) {
      const { g, p, e } = duel(hero, 0);
      for (let i = 0; i < 12 && !e.dead; i++) {
        e.shieldAngle = 0; // har safar orqasidan
        e.x = p.x + 14;
        e.y = p.y;
        p.cooldown = 0;
        p.hurtTimer = 0;
        p.anim.set("idle");
        p.fx = 1;
        p.fy = 0;
        g.input.pressAttack();
        tick(g, 0.3);
      }
      expect(e.dead).toBe(true);
    }
  });

  it("appears once in wave 4 and in endless mode from wave 6", () => {
    expect(WAVES[3]!.filter((k) => k === "shield").length).toBe(1);
    for (let w = 0; w < 3; w++) expect(WAVES[w]).not.toContain("shield");
    const last = () => 0.99;
    for (let n = 1; n < ENDLESS_SHIELD_FROM; n++)
      expect(waveEnemies(BOSS_WAVE + n, last)).not.toContain("shield");
    expect(waveEnemies(BOSS_WAVE + ENDLESS_SHIELD_FROM, last)).toContain("shield");
  });
});
