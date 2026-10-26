import { describe, expect, it } from "vitest";
import { Player, CHARGE_TIME, SPIN_CD } from "./player";
import { Input } from "./input";
import { UPGRADES } from "./waves";

function step(p: Player, input: Input, seconds: number, dt = 0.02) {
  for (let t = 0; t < seconds; t += dt) {
    p.update(dt, input);
    input.endFrame();
  }
}

function hold(p: Player, input: Input, seconds: number) {
  input.pressAttack();
  input.setTouchAttack(true);
  step(p, input, seconds);
  input.setTouchAttack(false);
  step(p, input, 0.02);
}

describe("Kuchli (aylana) zarba", () => {
  it("spins after holding attack for 0.6s and releasing", () => {
    const p = new Player();
    const input = new Input();
    hold(p, input, CHARGE_TIME + 0.06);
    expect(p.spinning).toBe(true);
    expect(p.spinCooldown).toBeCloseTo(SPIN_CD, 1);
    expect(p.hitDamage).toBe(p.damage * 2);
    const box = p.attackBox()!;
    expect(box.x).toBe(p.x);
    expect(box.y).toBe(p.y);
    expect(box.size).toBeCloseTo(p.reach * 2.4);
  });

  it("a short tap is a normal slash, not a spin", () => {
    const p = new Player();
    const input = new Input();
    hold(p, input, 0.2);
    expect(p.spinning).toBe(false);
    expect(p.hitDamage).toBe(p.damage);
    expect(p.spinCooldown).toBeLessThanOrEqual(0);
  });

  it("cannot charge again during the 3s cooldown", () => {
    const p = new Player();
    const input = new Input();
    hold(p, input, 0.7);
    step(p, input, 0.5);
    hold(p, input, 0.7);
    expect(p.spinning).toBe(false);
    expect(p.spinCooldown).toBeGreaterThan(1);
  });

  it("taking a hit cancels the charge", () => {
    const p = new Player();
    const input = new Input();
    input.setTouchAttack(true);
    step(p, input, 0.5);
    p.takeHit(1, p.x + 5, p.y, 0);
    expect(p.charge).toBe(0);
  });
});

describe("Ikki karra dash", () => {
  function dash(p: Player, input: Input) {
    input.pressDash();
    step(p, input, 0.02);
    const started = p.dashing;
    step(p, input, 0.2); // dash tugashini kutish
    return started;
  }

  it("without the upgrade a second dash waits for the cooldown", () => {
    const p = new Player();
    const input = new Input();
    expect(dash(p, input)).toBe(true);
    expect(dash(p, input)).toBe(false);
  });

  it("with the upgrade two dashes chain, the third waits", () => {
    const p = new Player();
    const input = new Input();
    UPGRADES.find((u) => u.id === "dash2")!.apply(p);
    step(p, input, 0.02);
    expect(dash(p, input)).toBe(true);
    expect(dash(p, input)).toBe(true);
    expect(dash(p, input)).toBe(false);
    step(p, input, p.dashCd);
    expect(dash(p, input)).toBe(true);
  });
});
