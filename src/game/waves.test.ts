import { describe, expect, it } from "vitest";
import { WAVES, BOSS_WAVE, UPGRADES, pickUpgrades } from "./waves";
import { Player } from "./player";

describe("Waves and upgrades", () => {
  it("has five waves with the boss on the last one", () => {
    expect(WAVES.length).toBe(5);
    expect(BOSS_WAVE).toBe(4);
    for (const w of WAVES) expect(w.length).toBeGreaterThan(0);
  });

  it("offers three distinct, currently useful upgrades", () => {
    const p = new Player();
    const picks = pickUpgrades(p);
    expect(picks.length).toBe(3);
    expect(new Set(picks.map((u) => u.id)).size).toBe(3);
    expect(picks.some((u) => u.id === "mend")).toBe(false);
  });

  it("stops offering capped upgrades", () => {
    const p = new Player();
    const blade = UPGRADES.find((u) => u.id === "blade")!;
    blade.apply(p);
    blade.apply(p);
    expect(p.damage).toBe(3);
    for (let i = 0; i < 30; i++) expect(pickUpgrades(p).some((u) => u.id === "blade")).toBe(false);
  });

  it("dash makes the player untouchable", () => {
    const p = new Player();
    p.dashTimer = 0.1;
    expect(p.takeHit(1, 0, 0, 100)).toBe(false);
    expect(p.hp).toBe(6);
  });
});
