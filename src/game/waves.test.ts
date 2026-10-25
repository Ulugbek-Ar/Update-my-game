import { describe, expect, it } from "vitest";
import {
  WAVES,
  BOSS_WAVE,
  UPGRADES,
  pickUpgrades,
  isBossWave,
  bossHp,
  waveEnemies,
  waveSpeed,
} from "./waves";
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

  it("adds archers to waves 3 and 4", () => {
    expect(WAVES[2]).toContain("archer");
    expect(WAVES[3]).toContain("archer");
  });

  it("endless mode grows waves and brings the boss back every 5th wave with more HP", () => {
    expect(isBossWave(BOSS_WAVE)).toBe(true);
    expect(isBossWave(BOSS_WAVE + 1)).toBe(false);
    expect(isBossWave(BOSS_WAVE + 5)).toBe(true);
    expect(isBossWave(BOSS_WAVE + 10)).toBe(true);
    expect(bossHp(BOSS_WAVE)).toBe(30);
    expect(bossHp(BOSS_WAVE + 5)).toBeGreaterThan(30);
    expect(bossHp(BOSS_WAVE + 10)).toBeGreaterThan(bossHp(BOSS_WAVE + 5));
    expect(waveEnemies(BOSS_WAVE + 2).length).toBeGreaterThan(waveEnemies(BOSS_WAVE + 1).length);
    expect(waveSpeed(BOSS_WAVE + 2)).toBeGreaterThan(waveSpeed(BOSS_WAVE + 1));
    expect(waveSpeed(BOSS_WAVE + 1)).toBeGreaterThan(waveSpeed(BOSS_WAVE));
    expect(waveEnemies(0)).toEqual(WAVES[0]);
  });

  it("double dash allows two dashes back to back", () => {
    const p = new Player();
    UPGRADES.find((u) => u.id === "dash2")!.apply(p);
    expect(p.dashMax).toBe(2);
  });
});
