import { beforeEach, describe, expect, it } from "vitest";
import { Game } from "./game";
import { Enemy } from "./enemy";
import { BOSS_WAVE, UPGRADES, cardFor } from "./waves";
import { GUNNER_PRICE, HERO_ROLE, PALADIN_PRICE, ROLE_INFO, bestKeys } from "./hero";
import { isHeroUnlocked, loadPlayableHero, selectHero, unlockHero } from "./save";
import { addGold, applyShop, buyHero, goldShort, loadGold } from "./shop";
import { loadAchievements, unlockAchievement } from "./achievements";
import { worldWins } from "./progress";
import { loadDaily } from "./daily";
import { heroBadge } from "./map";
import { SHANG_WINDUP } from "./player";
import { loadRealmData } from "@/realm/data";
import { RealmSim } from "@/realm/sim";

type GI = {
  startWave(i: number): void;
  damageTarget(t: unknown, d: number): void;
  onPlayerHurt(): void;
};
const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };

function makeGame(opts: { daily?: string; world?: 1 | 2 | 3 } = {}) {
  unlockHero("paladin");
  const g = new Game(canvas as unknown as HTMLCanvasElement, "paladin", opts);
  g.hints = [];
  return { g, gi: g as unknown as GI };
}

function tick(g: Game, seconds: number) {
  for (let t = 0; t < seconds; t += 0.02) g.update(0.02);
}

beforeEach(() => localStorage.clear());

describe("Paladin do'konda", () => {
  it("is locked until bought for more gold than Mergan", () => {
    expect(PALADIN_PRICE).toBeGreaterThan(GUNNER_PRICE);
    expect(isHeroUnlocked("paladin")).toBe(false);
    expect(selectHero("paladin")).toBe(false);
    // qulfli qahramon bilan o'yin — Ritsar
    localStorage.setItem("pixel-rpg-hero", "paladin");
    expect(loadPlayableHero()).toBe("knight");
    expect(new Game(canvas as unknown as HTMLCanvasElement, "paladin").player.hero).toBe("knight");
    addGold(PALADIN_PRICE - 1);
    expect(goldShort("paladin")).toBe(1);
    expect(buyHero("paladin")).toBe(false);
    addGold(1);
    expect(buyHero("paladin")).toBe(true);
    expect(loadGold()).toBe(0);
    expect(isHeroUnlocked("paladin")).toBe(true);
    expect(selectHero("paladin")).toBe(true);
    expect(loadPlayableHero()).toBe("paladin");
    // bir martalik
    addGold(PALADIN_PRICE);
    expect(buyHero("paladin")).toBe(false);
    expect(loadGold()).toBe(PALADIN_PRICE);
  });

  it("has the TANK role; the others keep theirs", () => {
    expect(HERO_ROLE).toEqual({
      knight: "warrior",
      mage: "caster",
      hunter: "ranged",
      gunner: "ranged",
      paladin: "tank",
    });
    expect(ROLE_INFO.tank.name).toBe("TANK");
    expect(ROLE_INFO.warrior.name).toBe("JANGCHI");
  });
});

describe("Paladin hamma rejimlarda", () => {
  it("winning with the Paladin: own achievement, world win and separate records", () => {
    const { g, gi } = makeGame();
    gi.startWave(BOSS_WAVE);
    g.enemies = [];
    g.boss!.spawn = 0;
    g.score = 555;
    gi.damageTarget(g.boss, 999);
    tick(g, 2);
    expect(g.phase).toBe("victory");
    const got = loadAchievements();
    expect(got.has("winPaladin")).toBe(true);
    // zarar olmasdan boss yengildi — QALQONSIZ DEVOR
    expect(got.has("wallNoShield")).toBe(true);
    expect(worldWins()[1]).toContain("paladin");
    expect(Number(localStorage.getItem(bestKeys("paladin").best))).toBeGreaterThanOrEqual(555);
  });

  it("QALQONSIZ DEVOR needs a boss fight without losing a heart", () => {
    const { g, gi } = makeGame();
    gi.startWave(BOSS_WAVE);
    g.enemies = [];
    g.boss!.spawn = 0;
    gi.onPlayerHurt();
    gi.damageTarget(g.boss, 999);
    expect(loadAchievements().has("wallNoShield")).toBe(false);
  });

  it("SHANG! — four enemies with one slam", () => {
    const { g } = makeGame();
    const p = g.player;
    p.x = 60;
    p.y = 120;
    p.fx = 1;
    p.fy = 0;
    g.enemies = [0, 1, 2, 3].map((i) => {
      const e = new Enemy("blob", 74 + i * 10, 120 + (i % 2 ? 6 : -6));
      e.spawn = 0;
      e.hp = 2;
      e.update = () => {};
      return e;
    });
    g.enemies.push(Object.assign(new Enemy("blob", 300, 220), { spawn: 99 }));
    g.input.pressAttack();
    tick(g, SHANG_WINDUP + 0.1);
    expect(g.stats.kills).toBe(4);
    expect(loadAchievements().has("shang4")).toBe(true);
  });

  it("shop upgrades fit the Paladin", () => {
    const { g } = makeGame();
    const p = g.player;
    applyShop(p, { heart: 3, dash: 3, blade: 1, luck: 0 });
    expect(p.maxHp).toBe(11);
    expect(p.dashCd).toBeCloseTo(0.9 ** 3);
    expect(p.hitDamage).toBe(4);
  });

  it("cards carry over to the next world and survive a world retry", () => {
    const { g } = makeGame();
    const p = g.player;
    for (const id of ["shockwave", "aura", "reach"]) {
      cardFor(
        UPGRADES.find((x) => x.id === id)!,
        p,
      ).apply(p);
    }
    g.startChapter(2);
    g.retryChapter();
    const q = g.player;
    expect([q.shockwave, q.aura, q.reach]).toEqual([true, true, 25]);
  });

  it("daily challenge, other worlds and endless start with the Paladin", () => {
    const { g } = makeGame({ daily: "2026-10-31" });
    expect(g.player.paladin).toBe(true);
    expect(loadDaily("2026-10-31")?.hero).toBe("paladin");
    const w2 = makeGame({ world: 2 }).g;
    expect(w2.player.paladin).toBe(true);
    expect(w2.chapter).toBe(2);
  });

  it("the adventure map shows an orange helmet badge", () => {
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
    heroBadge(ctx, "paladin", 10, 10, true);
    expect(fills).toContain("#ff8c1a");
  });

  it("works in the Realm (offline sim): SHANG hits a mob, QASAM taunts it", () => {
    const s = new RealmSim(loadRealmData());
    const rp = s.addPlayer("p1", "paladin");
    rp.p.takeHit = () => false;
    const m = s.mobs.find((m) => m.kind === "boar")!;
    rp.p.x = m.x - 24;
    rp.p.y = m.y;
    rp.p.fx = 1;
    rp.p.fy = 0;
    const hp = m.hp;
    s.command(rp, { type: "attack", down: true });
    s.command(rp, { type: "attack", down: false });
    for (let t = 0; t < SHANG_WINDUP + 0.15; t += 0.05) s.step();
    expect(m.hp).toBeLessThan(hp);
    expect(unlockAchievement("first")).not.toBeNull();
  });
});
