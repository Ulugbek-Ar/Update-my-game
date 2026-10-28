import { beforeEach, describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_KEY,
  loadAchievements,
  unlockAchievement,
} from "./achievements";
import { Game } from "./game";
import { Enemy } from "./enemy";
import { BOSS_WAVE } from "./waves";

beforeEach(() => localStorage.clear());

type GI = {
  startWave(i: number): void;
  startEndless(): void;
  damageTarget(t: unknown, dmg: number): void;
  onKill(e: Enemy): void;
  pickCoin(c: { x: number; y: number; life: number; value: number }): void;
};

function makeGame(hero: "knight" | "mage" = "knight", opts: { daily?: string } = {}) {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement, hero, opts);
  return { g, gi: g as unknown as GI };
}

function tick(g: Game, seconds: number, dt = 0.02) {
  for (let t = 0; t < seconds; t += dt) g.update(dt);
}

function winCampaign(hero: "knight" | "mage") {
  const { g, gi } = makeGame(hero);
  gi.startWave(BOSS_WAVE);
  g.enemies = [];
  g.boss!.spawn = 0;
  gi.damageTarget(g.boss, 999);
  tick(g, 2);
  return g;
}

describe("Yutuqlar ro'yxati", () => {
  it("has 11 achievements with unique ids and Uzbek names", () => {
    expect(ACHIEVEMENTS.length).toBe(11);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    const names = ACHIEVEMENTS.map((a) => a.name);
    for (const n of [
      "BENUQSON TO'LQIN",
      "IBLISNI YENG",
      "CHEKSIZDA 10-TO'LQIN",
      "50 KOMBO",
      "SEHRGAR BILAN YUT",
      "XAZINACHI",
    ])
      expect(names).toContain(n);
  });

  it("unlocks once and survives reloads; ignores broken data", () => {
    expect(unlockAchievement("boss")?.name).toBe("IBLISNI YENG");
    expect(unlockAchievement("boss")).toBeNull();
    expect([...loadAchievements()]).toEqual(["boss"]);
    localStorage.setItem(ACHIEVEMENTS_KEY, '["boss", "nope", 5]');
    expect([...loadAchievements()]).toEqual(["boss"]);
    localStorage.setItem(ACHIEVEMENTS_KEY, "{bad");
    expect(loadAchievements().size).toBe(0);
  });
});

describe("Yutuqlar o'yinda ochiladi", () => {
  it("first kill shows an in-game toast exactly once", () => {
    const { g, gi } = makeGame();
    const e = new Enemy("blob", 50, 50);
    gi.onKill(e);
    gi.onKill(e);
    expect(g.toasts.map((t) => t.a.id)).toEqual(["first"]);
    expect(loadAchievements().has("first")).toBe(true);
    tick(g, 3.1);
    expect(g.toasts).toHaveLength(0);
  });

  it("combo 10 and 50", () => {
    const { g, gi } = makeGame();
    const e = new Enemy("blob", 50, 50);
    for (let i = 0; i < 9; i++) gi.onKill(e);
    expect(loadAchievements().has("combo10")).toBe(false);
    gi.onKill(e);
    expect(loadAchievements().has("combo10")).toBe(true);
    for (let i = 0; i < 40; i++) gi.onKill(e);
    expect(g.combo).toBe(50);
    expect(loadAchievements().has("combo50")).toBe(true);
  });

  it("a wave cleared without damage unlocks BENUQSON TO'LQIN; a hurt wave does not", () => {
    const { g } = makeGame();
    g.waveHurt = true;
    g.enemies = [];
    g.update(0.02);
    expect(loadAchievements().has("clean")).toBe(false);
    const { g: g2 } = makeGame();
    g2.enemies = [];
    g2.update(0.02);
    expect(loadAchievements().has("clean")).toBe(true);
  });

  it("beating the boss and winning with each hero", () => {
    winCampaign("knight");
    let got = loadAchievements();
    expect(got.has("boss")).toBe(true);
    expect(got.has("winKnight")).toBe(true);
    expect(got.has("winMage")).toBe(false);
    winCampaign("mage");
    got = loadAchievements();
    expect(got.has("winMage")).toBe(true);
  });

  it("50 gold in one run and endless wave 10", () => {
    const { g, gi } = makeGame();
    gi.pickCoin({ x: 0, y: 0, life: 1, value: 49 });
    expect(loadAchievements().has("rich")).toBe(false);
    gi.pickCoin({ x: 0, y: 0, life: 1, value: 1 });
    expect(loadAchievements().has("rich")).toBe(true);
    g.endless = true;
    gi.startWave(BOSS_WAVE + 9);
    expect(loadAchievements().has("endless10")).toBe(false);
    gi.startWave(BOSS_WAVE + 10);
    expect(loadAchievements().has("endless10")).toBe(true);
  });

  it("reaching wave 3 in the daily challenge", () => {
    const { gi } = makeGame("knight");
    gi.startWave(2);
    expect(loadAchievements().has("daily")).toBe(false);
    const { gi: d } = makeGame("knight", { daily: "2026-10-27" });
    d.startWave(2);
    expect(loadAchievements().has("daily")).toBe(true);
  });
});
