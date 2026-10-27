import { beforeEach, describe, expect, it } from "vitest";
import { HERO_KEY, bestKeys, loadHero, saveHero } from "./hero";
import { MAGE_MAX_HP, Player, TELEPORT_DIST, CHARGE_TIME, SPIN_CD } from "./player";
import { Input } from "./input";
import { UPGRADES, upgradeText } from "./waves";
import { Game, BEST_KEY } from "./game";
import { Enemy } from "./enemy";
import { applyShop, emptyLevels } from "./shop";
import { spritePixels } from "./sprites";

beforeEach(() => localStorage.clear());

function step(p: Player, input: Input, seconds: number, dt = 0.02) {
  for (let t = 0; t < seconds; t += dt) {
    p.update(dt, input);
    input.endFrame();
  }
}

function makeGame(hero: "knight" | "mage") {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  return new Game(canvas as unknown as HTMLCanvasElement, hero);
}

describe("Qahramon tanlovi", () => {
  it("defaults to the knight and remembers the choice", () => {
    expect(loadHero()).toBe("knight");
    saveHero("mage");
    expect(localStorage.getItem(HERO_KEY)).toBe("mage");
    expect(loadHero()).toBe("mage");
    localStorage.setItem(HERO_KEY, "dragon");
    expect(loadHero()).toBe("knight");
  });

  it("the game starts with the saved hero", () => {
    saveHero("mage");
    const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
    const g = new Game(canvas as unknown as HTMLCanvasElement);
    expect(g.hero).toBe("mage");
    expect(g.player.mage).toBe(true);
  });
});

describe("Sehrgar", () => {
  it("has 5 hearts, speed 95 and the same collision size", () => {
    const p = new Player("mage");
    expect(p.maxHp).toBe(MAGE_MAX_HP);
    expect(p.hp).toBe(5);
    expect(p.speed).toBe(95);
    expect(p.attackCd).toBe(0.45);
    expect(p.dashCd).toBe(0.9);
    expect(p.size).toBe(new Player().size);
  });

  it("attack fires a bolt in the facing direction instead of a melee box", () => {
    const p = new Player("mage");
    const input = new Input();
    p.fx = 1;
    p.fy = 0;
    input.pressAttack();
    step(p, input, 0.02);
    expect(p.bolts).toHaveLength(1);
    expect(p.bolts[0]!.vx).toBe(p.boltSpeed);
    expect(p.bolts[0]!.vy).toBe(0);
    expect(p.attackBox()).toBeNull();
    expect(p.cooldown).toBeGreaterThan(0.4);
  });

  it("holding attack releases a magic ring with 2x damage and 3s cooldown", () => {
    const p = new Player("mage");
    const input = new Input();
    input.pressAttack();
    input.setTouchAttack(true);
    step(p, input, CHARGE_TIME + 0.06);
    input.setTouchAttack(false);
    step(p, input, 0.02);
    expect(p.spinning).toBe(true);
    expect(p.spinCooldown).toBeCloseTo(SPIN_CD, 1);
    expect(p.hitDamage).toBe(p.damage * 2);
    expect(p.attackBox()!.x).toBe(p.x);
  });

  it("dash is a short teleport with 0.9s cooldown and brief invulnerability", () => {
    const p = new Player("mage");
    const input = new Input();
    p.x = 100;
    p.y = 120;
    p.fx = 1;
    p.fy = 0;
    input.pressDash();
    step(p, input, 0.02);
    expect(p.x).toBeCloseTo(100 + TELEPORT_DIST);
    expect(p.y).toBe(120);
    expect(p.teleportFrom).toEqual({ x: 100, y: 120 });
    expect(p.dashing).toBe(true);
    expect(p.takeHit(1, p.x, p.y, 0)).toBe(false);
    expect(p.dashCooldown).toBeCloseTo(0.9, 1);
  });

  it("a bolt flies and damages the first enemy it touches", () => {
    const g = makeGame("mage");
    const p = g.player;
    const e = new Enemy("rammer", p.x + 60, p.y);
    e.spawn = 0;
    g.enemies = [e, new Enemy("rammer", 40, 40)];
    g.bolts = [{ x: p.x + 8, y: p.y, vx: 170, vy: 0 }];
    for (let i = 0; i < 25; i++) g.update(0.02);
    expect(e.hp).toBe(e.maxHp - p.damage);
    expect(g.bolts).toHaveLength(0);
  });
});

describe("Kuch kartalari ikkala qahramonda", () => {
  const card = (id: string) => UPGRADES.find((u) => u.id === id)!;

  it("Uzun tig' speeds up the mage's bolt", () => {
    const p = new Player("mage");
    const before = p.boltSpeed;
    card("reach").apply(p);
    expect(p.boltSpeed).toBeGreaterThan(before);
    expect(upgradeText(card("reach"), p).desc).toContain("Shar");
    expect(upgradeText(card("reach"), new Player()).desc).toBe("Zarba maydoni kattaroq");
  });

  it("every card is valid and has text for both heroes", () => {
    for (const hero of ["knight", "mage"] as const) {
      const p = new Player(hero);
      for (const u of UPGRADES) {
        const t = upgradeText(u, p);
        expect(t.name.length).toBeGreaterThan(0);
        expect(t.desc.length).toBeGreaterThan(0);
        expect(u.ok(p) || u.id === "mend").toBe(true);
      }
    }
    expect(upgradeText(card("dash2"), new Player("mage")).name).toBe("IKKI KARRA TELEPORT");
  });

  it("shop upgrades apply to the mage too", () => {
    const p = new Player("mage");
    applyShop(p, { ...emptyLevels(), heart: 1, dash: 1, blade: 1 });
    expect(p.maxHp).toBe(6);
    expect(p.dashCd).toBeCloseTo(0.81);
    expect(p.damage).toBe(2);
  });
});

describe("Rekordlar har qahramon uchun alohida", () => {
  it("knight keeps the old keys, mage has its own", () => {
    expect(bestKeys("knight").best).toBe(BEST_KEY);
    expect(bestKeys("mage").best).not.toBe(BEST_KEY);
    expect(bestKeys("mage").endless).not.toBe(bestKeys("knight").endless);
  });

  it("a mage record does not overwrite the knight record", () => {
    localStorage.setItem(BEST_KEY, "500");
    const g = makeGame("mage");
    expect(g.best).toBe(0);
    g.score = 120;
    (g as unknown as { commitBest(): void }).commitBest();
    expect(Number(localStorage.getItem(bestKeys("mage").best))).toBe(120);
    expect(Number(localStorage.getItem(BEST_KEY))).toBe(500);
    expect(makeGame("knight").best).toBe(500);
  });
});

describe("Sehrgar sprite", () => {
  it("is drawn differently from the knight", () => {
    expect(spritePixels("mage", "idle", 0).join()).not.toBe(
      spritePixels("knight", "idle", 0).join(),
    );
  });
});
