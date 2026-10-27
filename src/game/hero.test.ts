import { beforeEach, describe, expect, it } from "vitest";
import { HERO_KEY, bestKeys, loadHero, saveHero } from "./hero";
import { MAGE_MAX_HP, Player, TELEPORT_DIST, CHARGE_TIME, SPIN_CD } from "./player";
import { Input } from "./input";
import { UPGRADES, cardFor, pickUpgrades, upgradeIcon } from "./waves";
import { Game, BEST_KEY } from "./game";
import { Enemy } from "./enemy";
import { applyShop, emptyLevels } from "./shop";
import { spritePixels, UPGRADE_ICONS } from "./sprites";
import { Boss } from "./boss";

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
    g.bolts = [{ x: p.x + 8, y: p.y, vx: 170, vy: 0, size: 6, left: 1, hit: [] }];
    for (let i = 0; i < 25; i++) g.update(0.02);
    expect(e.hp).toBe(e.maxHp - p.damage);
    expect(g.bolts).toHaveLength(0);
  });
});

describe("Kuch kartalari ikkala qahramonda", () => {
  const card = (id: string) => UPGRADES.find((u) => u.id === id)!;
  const knight = new Player("knight");
  const mage = new Player("mage");
  const SWORDS = ["blade", "reach", "dash2", "thorns", "haste", "wind", "vamp", "heart", "mend"];

  // id -> [Ritsar nomi, Sehrgar nomi, Sehrgar ikonkasi]
  const expected: Record<string, [string, string, string]> = {
    heart: ["TEMIR YURAK", "SEHRLI YURAK", "mheart"],
    blade: ["O'TKIR QILICH", "KUCHLI SEHR", "fireball"],
    reach: ["UZUN TIG'", "KENG HALQA", "ring"],
    haste: ["CHAQQON QO'L", "TEZ AFSUN", "book"],
    wind: ["SHAMOL QADAMI", "EFIR QADAMI", "wstar"],
    vamp: ["QON TOMIRI", "RUH SO'RISH", "spirit"],
    thorns: ["TIKANLI ZIRH", "MUZ QALQONI", "ice"],
    dash2: ["IKKI KARRA DASH", "IKKI KARRA TELEPORT", "portal"],
    mend: ["SHIFO", "SHIFOBAXSH IKSIR", "elixir"],
  };

  it("each shared card has its own name, icon and color per hero", () => {
    for (const [id, [kName, mName, mIcon]] of Object.entries(expected)) {
      const k = cardFor(card(id), knight);
      const m = cardFor(card(id), mage);
      expect(k.name).toBe(kName);
      expect(upgradeIcon(k)).toBe(id);
      expect(m.name).toBe(mName);
      expect(upgradeIcon(m)).toBe(mIcon);
      expect(m.color).not.toBe(k.color);
      expect(UPGRADE_ICONS[mIcon]).toBeDefined();
      // Sehrgar kartasida qilich/tig'/">>" ikonkasi yo'q
      expect(SWORDS).not.toContain(upgradeIcon(m));
      expect(m.name).not.toMatch(/\b(QILICH|TIG|DASH|ZIRH|QON|TEMIR|CHAQQON|SHAMOL)\b/);
      expect(m.desc).not.toMatch(/[Qq]ilich|[Dd]ash|[Zz]arba/);
    }
  });

  it("knight cards are unchanged and never show mage-only powers", () => {
    for (let i = 0; i < 200; i++) {
      for (const u of pickUpgrades(new Player("knight"))) {
        expect(["triple", "pierce"]).not.toContain(u.id);
        expect(u.name).toBe(expected[u.id]![0]);
      }
    }
  });

  it("mage-only cards use magic words and their own icons", () => {
    for (const id of ["triple", "pierce"]) {
      const u = card(id);
      expect(u.hero).toBe("mage");
      expect(SWORDS).not.toContain(upgradeIcon(u));
      expect(UPGRADE_ICONS[upgradeIcon(u)]).toBeDefined();
      expect(u.desc).not.toMatch(/[Qq]ilich|[Dd]ash|[Zz]arba/);
    }
  });

  it("the mage can get UCH SHAR and TESHUVCHI SHAR", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) for (const u of pickUpgrades(new Player("mage"))) seen.add(u.id);
    expect(seen.has("triple")).toBe(true);
    expect(seen.has("pierce")).toBe(true);
    const picks = pickUpgrades(new Player("mage"), 20);
    expect(picks.find((u) => u.id === "triple")?.name).toBe("UCH SHAR");
    expect(picks.find((u) => u.id === "pierce")?.name).toBe("TESHUVCHI SHAR");
  });

  it("applies the right effect for each hero", () => {
    const apply = (id: string, hero: "knight" | "mage") => {
      const p = new Player(hero);
      cardFor(card(id), p).apply(p);
      return p;
    };
    expect(apply("blade", "knight").damage).toBe(2);
    expect(apply("blade", "mage").damage).toBe(2);
    expect(apply("reach", "knight").reach).toBe(21);
    expect(apply("reach", "knight").boltSize).toBe(6);
    expect(apply("reach", "mage").reach).toBe(21);
    expect(apply("reach", "mage").boltSize).toBe(8);
    expect(apply("haste", "mage").attackCd).toBeCloseTo(0.45 * 0.75);
    expect(apply("wind", "mage").dashCd).toBeCloseTo(0.9 * 0.75);
    expect(apply("dash2", "mage").dashMax).toBe(2);
    expect(apply("vamp", "mage").lifesteal).toBe(6);
    expect(apply("heart", "mage").maxHp).toBe(6);
    const kt = apply("thorns", "knight");
    expect([kt.thorns, kt.frost]).toEqual([true, false]);
    const mt = apply("thorns", "mage");
    expect([mt.thorns, mt.frost]).toEqual([false, true]);
    expect(cardFor(card("thorns"), mt).ok(mt)).toBe(false);
  });

  it("UCH SHAR fires a fan of 3 bolts", () => {
    const p = new Player("mage");
    card("triple").apply(p);
    p.fx = 1;
    p.fy = 0;
    const input = new Input();
    input.pressAttack();
    step(p, input, 0.02);
    expect(p.bolts).toHaveLength(3);
    const vy = p.bolts.map((b) => Math.sign(Math.round(b.vy)));
    expect(vy).toEqual([-1, 0, 1]);
    expect(p.bolts.every((b) => b.vx > 0)).toBe(true);
  });

  it("TESHUVCHI SHAR passes through one enemy and hits the next", () => {
    const g = makeGame("mage");
    const p = g.player;
    card("pierce").apply(p);
    const a = new Enemy("rammer", p.x + 40, p.y);
    const b = new Enemy("rammer", p.x + 80, p.y);
    a.spawn = b.spawn = 0;
    g.enemies = [a, b, new Enemy("rammer", 40, 40)];
    g.bolts = [{ x: p.x + 8, y: p.y, vx: 170, vy: 0, size: 6, left: 1 + p.pierce, hit: [] }];
    for (let i = 0; i < 40; i++) g.update(0.02);
    expect(a.hp).toBe(a.maxHp - 1);
    expect(b.hp).toBe(b.maxHp - 1);
    expect(g.bolts).toHaveLength(0);
  });

  it("without pierce a bolt stops at the first enemy", () => {
    const g = makeGame("mage");
    const p = g.player;
    const a = new Enemy("rammer", p.x + 40, p.y);
    const b = new Enemy("rammer", p.x + 80, p.y);
    a.spawn = b.spawn = 0;
    g.enemies = [a, b];
    g.bolts = [{ x: p.x + 8, y: p.y, vx: 170, vy: 0, size: 6, left: 1, hit: [] }];
    for (let i = 0; i < 40; i++) g.update(0.02);
    expect(b.hp).toBe(b.maxHp);
  });

  it("MUZ QALQONI slows nearby enemies and the boss for 1.5s when hit", () => {
    const g = makeGame("mage");
    const p = g.player;
    card("thorns").mage!.apply!(p);
    const near = new Enemy("blob", p.x + 20, p.y);
    const far = new Enemy("blob", p.x + 150, p.y);
    near.spawn = far.spawn = 0;
    g.enemies = [near, far];
    g.boss = new Boss();
    g.boss.spawn = 0;
    g.boss.x = p.x;
    g.boss.y = p.y - 40;
    p.takeHit(1, near.x, near.y, 0);
    (g as unknown as { onPlayerHurt(): void }).onPlayerHurt();
    expect(near.slow).toBe(1.5);
    expect(g.boss.slow).toBe(1.5);
    expect(far.slow).toBe(0);
    expect(near.hp).toBe(near.maxHp);
  });

  it("a slowed enemy moves at half speed", () => {
    const p = new Player();
    const run = (slow: number) => {
      const e = new Enemy("rammer", 200, 120);
      e.spawn = 0;
      e.aiTimer = 99;
      e.slow = slow;
      e.anim.set("walk");
      e.update(0.1, p);
      return 200 - e.x;
    };
    expect(run(1.5)).toBeCloseTo(run(0) / 2, 1);
  });
});

describe("Ochko", () => {
  it("clearing wave 1 with the mage gives a normal score (not thousands)", () => {
    for (const hero of ["knight", "mage"] as const) {
      const g = makeGame(hero);
      const gi = g as unknown as { damageTarget(t: unknown, d: number): void };
      for (const e of g.enemies) {
        e.spawn = 0;
        gi.damageTarget(e, 99);
      }
      for (let i = 0; i < 60 && g.stage === "fight"; i++) g.update(0.02);
      expect(g.stage).toBe("upgrade");
      expect(g.score).toBeGreaterThanOrEqual(150);
      expect(g.score).toBeLessThanOrEqual(300);
    }
  });

  it("each bolt hit scores only through kills, not per hit", () => {
    const g = makeGame("mage");
    const p = g.player;
    const e = new Enemy("rammer", p.x + 40, p.y);
    e.spawn = 0;
    g.enemies = [e, new Enemy("rammer", 40, 40)];
    g.bolts = [{ x: p.x + 8, y: p.y, vx: 170, vy: 0, size: 6, left: 1, hit: [] }];
    for (let i = 0; i < 30; i++) g.update(0.02);
    expect(e.hp).toBe(e.maxHp - 1);
    expect(g.score).toBe(0);
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
