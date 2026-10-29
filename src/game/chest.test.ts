import { beforeEach, describe, expect, it } from "vitest";
import { Game, CHEST_CHANCE } from "./game";
import { Enemy } from "./enemy";
import { BOSS_WAVE, isChestWave } from "./waves";
import { loadAchievements } from "./achievements";
import type { Bolt } from "./player";

beforeEach(() => localStorage.clear());

function makeGame(hero: "knight" | "mage" = "knight") {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement, hero);
  g.hints = [];
  return g;
}

function tick(g: Game, seconds: number, dt = 0.02) {
  for (let t = 0; t < seconds; t += dt) g.update(dt);
}

/** To'lqin tugamasligi uchun uzoqda hali paydo bo'layotgan dushman. */
function idle(g: Game) {
  const e = new Enemy("blob", 30, 30);
  e.spawn = 99;
  g.enemies = [e];
}

type Rand = { spawnRand: () => number };

describe("Xazina sandig'i", () => {
  it("can appear on waves 2 and 4 and every 3rd endless wave", () => {
    expect([0, 1, 2, 3, 4].map(isChestWave)).toEqual([false, true, false, true, false]);
    expect(isChestWave(BOSS_WAVE + 1)).toBe(false);
    expect(isChestWave(BOSS_WAVE + 3)).toBe(true);
    expect(isChestWave(BOSS_WAVE + 6)).toBe(true);
  });

  it("spawns with a 35% chance at the start of a chest wave", () => {
    const g = makeGame();
    const gi = g as unknown as Rand & { startWave(i: number): void };
    gi.spawnRand = () => CHEST_CHANCE - 0.01;
    gi.startWave(1);
    expect(g.chest).not.toBeNull();
    expect(g.chest!.hp).toBe(3);
    gi.spawnRand = () => CHEST_CHANCE + 0.01;
    gi.startWave(3);
    expect(g.chest).toBeNull();
    gi.spawnRand = () => 0;
    gi.startWave(2);
    expect(g.chest).toBeNull();
  });

  it("knight opens it with 3 sword hits", () => {
    const g = makeGame();
    // qat'iy lut: 12 oltin, yurak va bepul karta yo'q (karta chiqsa o'yin to'xtab, openT o'smaydi)
    (g as unknown as Rand).spawnRand = () => 0.5;
    idle(g);
    const p = g.player;
    p.fx = 1;
    p.fy = 0;
    g.spawnChest(p.x + 16, p.y);
    for (let i = 0; i < 3; i++) {
      expect(g.chest!.openT).toBe(-1);
      g.input.pressAttack();
      tick(g, 0.5);
    }
    expect(g.chest!.openT).toBeGreaterThan(0);
    expect(g.chestsOpened).toBe(1);
    // yaqin tangalarni o'yinchi allaqachon terib olgan bo'lishi mumkin
    const gold = g.coins.reduce((s, c) => s + c.value, 0) + g.runGold;
    expect(gold).toBe(12);
  });

  it("mage opens it with 3 bolts", () => {
    const g = makeGame("mage");
    idle(g);
    const p = g.player;
    g.spawnChest(p.x + 60, p.y);
    for (let i = 0; i < 3; i++) {
      const b: Bolt = { x: p.x + 20, y: p.y, vx: 170, vy: 0, size: 6, left: 1, hit: [] };
      g.bolts.push(b);
      tick(g, 0.4);
    }
    expect(g.chest!.openT).toBeGreaterThanOrEqual(0);
  });

  it("loot: 8–15 gold, 40% heart, 10% free upgrade card that keeps the wave going", () => {
    const g = makeGame();
    idle(g);
    g.spawnChest(100, 100);
    const lucky = g.openChest(() => 0)!;
    expect(lucky).toEqual({ gold: 8, heart: true, card: true });
    expect(g.drops.length).toBe(1);
    expect(g.stage).toBe("upgrade");
    expect(g.bonusPick).toBe(true);
    const wave = g.wave;
    (g as unknown as { choose(i: number): void }).choose(0);
    expect(g.stage).toBe("fight");
    expect(g.wave).toBe(wave);

    const g2 = makeGame();
    idle(g2);
    g2.spawnChest(100, 100);
    expect(g2.openChest(() => 0.99)).toEqual({ gold: 15, heart: false, card: false });
    expect(g2.drops.length).toBe(0);
    expect(g2.stage).toBe("fight");
    expect(g2.coins.reduce((s, c) => s + c.value, 0)).toBe(15);
  });

  it("an unopened chest disappears when the wave ends", () => {
    const g = makeGame();
    g.spawnChest(100, 100);
    g.enemies = [];
    tick(g, 0.04);
    expect(g.stage).toBe("upgrade");
    expect(g.chest).toBeNull();
  });

  it("opening 3 chests in one run unlocks Xazinachi", () => {
    const g = makeGame();
    idle(g);
    for (let i = 0; i < 3; i++) {
      expect(loadAchievements().has("chests")).toBe(false);
      g.spawnChest(100, 100);
      g.openChest(() => 0.99);
    }
    expect(loadAchievements().has("chests")).toBe(true);
    expect(g.toasts.some((t) => t.a.name === "XAZINACHI")).toBe(true);
  });
});
