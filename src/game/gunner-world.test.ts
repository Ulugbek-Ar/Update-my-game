import { beforeEach, describe, expect, it } from "vitest";
import { Game } from "./game";
import { Enemy } from "./enemy";
import { BOSS_WAVE, UPGRADES, cardFor } from "./waves";
import { GUNNER_PRICE, bestKeys } from "./hero";
import { unlockHero } from "./save";
import { addGold, applyShop, buyHero } from "./shop";
import { ACHIEVEMENTS, loadAchievements } from "./achievements";
import { worldWins } from "./progress";
import { loadDaily } from "./daily";
import { heroBadge } from "./map";
import type { Bolt } from "./player";

type GI = { startWave(i: number): void; damageTarget(t: unknown, d: number): void };
const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };

function makeGame(opts: { daily?: string; world?: 1 | 2 | 3 } = {}) {
  unlockHero("gunner");
  const g = new Game(canvas as unknown as HTMLCanvasElement, "gunner", opts);
  g.hints = [];
  return { g, gi: g as unknown as GI };
}

function tick(g: Game, seconds: number) {
  for (let t = 0; t < seconds; t += 0.02) g.update(0.02);
}

const bullet = (x: number, y: number, load: number): Bolt => ({
  x,
  y,
  vx: 300,
  vy: 0,
  size: 4,
  left: 1,
  hit: [],
  bullet: true,
  range: 170,
  bounce: 0,
  load,
});

/** 6 ta bir jonli dushman va har biriga bittadan o'q (loads — har o'qning barabani). */
function sixKills(loads: number[]) {
  const { g } = makeGame();
  g.player.update = () => {};
  g.player.x = 30;
  g.player.y = 220;
  g.enemies = loads.map((_, i) => {
    const e = new Enemy("blob", 120 + i * 28, 40 + i * 26);
    e.spawn = 0;
    e.hp = 1;
    e.update = () => {};
    return e;
  });
  g.enemies.push(Object.assign(new Enemy("blob", 300, 220), { spawn: 99 }));
  g.bolts = loads.map((l, i) => bullet(108 + i * 28, 40 + i * 26, l));
  tick(g, 0.2);
  return g;
}

beforeEach(() => localStorage.clear());

describe("Mergan hamma rejimlarda", () => {
  it("winning with Mergan: own achievement, world win and separate records", () => {
    const { g, gi } = makeGame();
    gi.startWave(BOSS_WAVE);
    g.enemies = [];
    g.boss!.spawn = 0;
    g.score = 777;
    gi.damageTarget(g.boss, 999);
    tick(g, 2);
    expect(g.phase).toBe("victory");
    const got = loadAchievements();
    expect(got.has("winGunner")).toBe(true);
    expect(got.has("winKnight")).toBe(false);
    expect(worldWins()[1]).toContain("gunner");
    expect(Number(localStorage.getItem(bestKeys("gunner").best))).toBeGreaterThanOrEqual(777);
    expect(localStorage.getItem(bestKeys("knight").best)).toBeNull();
    expect(bestKeys("gunner").endless).toBe("pixel-rpg-endless-best-gunner");
  });

  it("OLTI O'Q: six kills with one cylinder", () => {
    sixKills([0, 0, 0, 0, 0, 0]);
    expect(loadAchievements().has("drumKills")).toBe(true);
  });

  it("OLTI O'Q needs the same cylinder: a reload in between does not count", () => {
    const g = sixKills([0, 0, 0, 1, 1, 1]);
    expect(g.stats.kills).toBe(6);
    expect(loadAchievements().has("drumKills")).toBe(false);
  });

  it("buying the first hero unlocks YANGI QAHRAMON; 19 achievements in total", () => {
    // v2.6: + SODIQ O'YINCHI (kunlik sovg'a)
    expect(ACHIEVEMENTS).toHaveLength(19);
    addGold(GUNNER_PRICE);
    expect(loadAchievements().has("firstHero")).toBe(false);
    expect(buyHero("gunner")).toBe(true);
    expect(loadAchievements().has("firstHero")).toBe(true);
  });

  it("shop upgrades fit Mergan: damage per bullet, faster slide, more hearts", () => {
    const { g } = makeGame();
    const p = g.player;
    applyShop(p, { heart: 3, dash: 3, blade: 1, luck: 0 });
    expect(p.maxHp).toBe(8);
    expect(p.dashCd).toBeCloseTo(0.9 * 0.9 ** 3);
    expect(p.damage).toBe(2);
    p.update = () => {};
    p.x = 40;
    p.y = 120;
    const e = new Enemy("rammer", 140, 120);
    e.spawn = 0;
    e.aiTimer = 99;
    g.enemies = [e, Object.assign(new Enemy("blob", 300, 30), { spawn: 99 })];
    g.bolts = [bullet(128, 120, 0)];
    tick(g, 0.1);
    expect(e.hp).toBe(e.maxHp - 2);
  });

  it("Mergan's cards carry over to the next world and survive a world retry", () => {
    const { g } = makeGame();
    const p = g.player;
    for (const id of ["drum", "ricochet", "haste", "reach"]) {
      const u = cardFor(
        UPGRADES.find((x) => x.id === id)!,
        p,
      );
      u.apply(p);
    }
    p.ammo = 1;
    g.startChapter(2);
    expect([g.player.ammoMax, g.player.ammo]).toEqual([8, 8]);
    g.retryChapter();
    const q = g.player;
    expect([q.ammoMax, q.ammo, q.bounce]).toEqual([8, 8, 1]);
    expect(q.reloadTime).toBeCloseTo(1.2 * 0.7);
    expect(q.range).toBe(170 + 60);
  });

  it("daily challenge and other worlds start with Mergan once he is bought", () => {
    const { g } = makeGame({ daily: "2026-10-30" });
    expect(g.player.gunner).toBe(true);
    expect(loadDaily("2026-10-30")?.hero).toBe("gunner");
    const w3 = makeGame({ world: 3 }).g;
    expect(w3.player.gunner).toBe(true);
    expect(w3.chapter).toBe(3);
  });

  it("the adventure map shows a hat badge for Mergan", () => {
    const fills: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get: () => () => {},
        set: (_, k, v) => {
          if (k === "fillStyle") fills.push(v);
          return true;
        },
      },
    ) as CanvasRenderingContext2D;
    heroBadge(ctx, "gunner", 10, 10, true);
    expect(fills).toContain("#d9a441");
    fills.length = 0;
    heroBadge(ctx, "gunner", 10, 10, false);
    expect(fills).not.toContain("#d9a441");
  });
});
