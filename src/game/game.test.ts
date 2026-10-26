import { beforeEach, describe, expect, it } from "vitest";
import { Game, BEST_KEY, ENDLESS_BEST_KEY } from "./game";
import { Enemy } from "./enemy";
import { BOSS_WAVE, UPGRADES } from "./waves";

/** Game ning test uchun kerakli ichki a'zolari. */
type GameInternals = {
  startWave(i: number): void;
  startEndless(): void;
  onPlayerHurt(): void;
  damageTarget(t: unknown, dmg: number): void;
  choose(i: number): void;
};

function makeGame() {
  // update() chizmaydi — soxta canvas yetarli
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement);
  return { g, gi: g as unknown as GameInternals };
}

function tick(g: Game, seconds: number, dt = 0.02) {
  for (let t = 0; t < seconds; t += dt) g.update(dt);
}

beforeEach(() => localStorage.clear());

describe("Tikanli zirh", () => {
  it("deals 1 damage to the nearest enemy when the player is hit", () => {
    const { g, gi } = makeGame();
    UPGRADES.find((u) => u.id === "thorns")!.apply(g.player);
    const near = new Enemy("rammer", g.player.x + 14, g.player.y);
    const far = new Enemy("rammer", g.player.x + 100, g.player.y);
    g.enemies = [near, far];
    g.player.takeHit(1, near.x, near.y, 0);
    gi.onPlayerHurt();
    expect(near.hp).toBe(near.maxHp - 1);
    expect(far.hp).toBe(far.maxHp);
  });

  it("does nothing without the upgrade", () => {
    const { g, gi } = makeGame();
    const near = new Enemy("rammer", g.player.x + 14, g.player.y);
    g.enemies = [near];
    gi.onPlayerHurt();
    expect(near.hp).toBe(near.maxHp);
  });
});

describe("Cheksiz rejim", () => {
  function winCampaign() {
    const { g, gi } = makeGame();
    gi.startWave(BOSS_WAVE);
    g.enemies = [];
    g.boss!.spawn = 0;
    g.score = 500;
    gi.damageTarget(g.boss, 999);
    tick(g, 2);
    return { g, gi };
  }

  it("beating the boss shows victory, then Enter-path starts endless with kept upgrades", () => {
    const { g, gi } = winCampaign();
    expect(g.phase).toBe("victory");
    expect(Number(localStorage.getItem(BEST_KEY))).toBe(800);
    g.player.damage = 2;
    gi.startEndless();
    expect(g.phase).toBe("play");
    expect(g.endless).toBe(true);
    expect(g.wave).toBe(BOSS_WAVE + 1);
    expect(g.score).toBe(0);
    expect(g.player.damage).toBe(2);
    expect(g.boss).toBeNull();
    expect(g.enemies.length).toBeGreaterThan(5);
  });

  it("an endless boss wave leads to an upgrade, not another victory", () => {
    const { g, gi } = winCampaign();
    gi.startEndless();
    g.enemies = [];
    gi.startWave(BOSS_WAVE + 5);
    expect(g.boss!.maxHp).toBe(45);
    g.enemies = [];
    g.boss!.spawn = 0;
    gi.damageTarget(g.boss, 999);
    tick(g, 2);
    expect(g.phase).toBe("play");
    expect(g.stage).toBe("upgrade");
  });

  it("dying in endless saves a separate record and does not add an attempt", () => {
    const { g, gi } = winCampaign();
    const attempt = g.attempt;
    gi.startEndless();
    g.score = 300;
    g.player.hp = 1;
    g.player.takeHit(1, g.player.x + 5, g.player.y, 0);
    tick(g, 1.5);
    expect(g.phase).toBe("attempt");
    expect(g.attempt).toBe(attempt);
    expect(Number(localStorage.getItem(ENDLESS_BEST_KEY))).toBe(300);
    expect(Number(localStorage.getItem(BEST_KEY))).toBe(800);
    tick(g, 3);
    expect(g.phase).toBe("play");
    expect(g.endless).toBe(false);
    expect(g.wave).toBe(0);
  });
});

describe("Kamonchi o'qlari o'yinda", () => {
  it("arrows hurt the player and the sword destroys them", () => {
    const { g, gi } = makeGame();
    gi.startWave(0);
    // to'lqin tugamasligi uchun uzoqda hali paydo bo'layotgan dushman
    const idle = new Enemy("blob", 30, 30);
    idle.spawn = 99;
    g.enemies = [idle];
    const p = g.player;
    g.shots = [{ x: p.x + 30, y: p.y, vx: -110, vy: 0, size: 4, arrow: true }];
    tick(g, 0.4);
    expect(p.hp).toBe(p.maxHp - 1);

    // zarba yegandan keyingi qotish tugagan deb olamiz
    p.invuln = 0;
    p.hurtTimer = 0;
    p.cooldown = 0;
    p.anim.set("idle");
    p.fx = 1;
    p.fy = 0;
    g.shots = [{ x: p.x + 12, y: p.y, vx: 0, vy: 0, size: 4, arrow: true }];
    g.input.pressAttack();
    tick(g, 0.04);
    expect(g.shots.length).toBe(0);
  });
});
