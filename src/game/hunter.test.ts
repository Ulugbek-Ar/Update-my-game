import { beforeEach, describe, expect, it } from "vitest";
import { Game, MAX_TRAPS, POISON_TIME, TRAP_STUN } from "./game";
import {
  CHARGE_TIME,
  HUNTER_MAX_HP,
  JUMP_TIME,
  POWER_SHOT_CD,
  Player,
  TRAP_CD,
  TRAP_HOLD,
} from "./player";
import { Enemy } from "./enemy";
import { BOSS_WAVE, UPGRADES, cardFor, pickUpgrades, upgradeIcon } from "./waves";
import { HEROES, HERO_NAMES, bestKeys, loadHero, saveHero } from "./hero";
import { SHOP_KEY, applyShop, loadShop } from "./shop";
import { loadAchievements } from "./achievements";
import { loadDaily } from "./daily";
import { worldWins } from "./progress";
import type { Input } from "./input";

type GI = { startWave(i: number): void; damageTarget(t: unknown, dmg: number): void };

function makeGame(opts: { daily?: string } = {}) {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement, "hunter", opts);
  return { g, gi: g as unknown as GI };
}

function tick(g: Game, seconds: number, dt = 0.02) {
  for (let t = 0; t < seconds; t += dt) g.update(dt);
}

/** Boshqaruv: bosilgan/bosib turilgan tugmalar. */
function keys(o: Partial<{ attack: boolean; held: boolean; dash: boolean; shift: boolean }>) {
  return {
    consumeAttack: () => !!o.attack,
    consumeDash: () => !!o.dash,
    attackHeld: () => !!o.held,
    dashHeld: () => !!o.shift,
    axis: () => ({ x: 0, y: 0 }),
  } as unknown as Input;
}

beforeEach(() => localStorage.clear());

describe("Ovchi", () => {
  it("is the third hero: 5 hearts, the fastest walker, same collision size", () => {
    expect(HEROES).toEqual(["knight", "mage", "hunter"]);
    expect(HERO_NAMES.hunter).toBe("OVCHI");
    saveHero("hunter");
    expect(loadHero()).toBe("hunter");
    const h = new Player("hunter");
    expect(h.hp).toBe(HUNTER_MAX_HP);
    expect(h.maxHp).toBe(5);
    expect(h.speed).toBeGreaterThan(new Player("knight").speed);
    expect(h.speed).toBeGreaterThan(new Player("mage").speed);
    expect(h.size).toBe(new Player("knight").size);
  });

  it("Space shoots an arrow in the facing direction, not a melee swing", () => {
    const p = new Player("hunter");
    p.fx = 0;
    p.fy = -1;
    p.update(0.016, keys({ attack: true }));
    expect(p.bolts.length).toBe(1);
    const a = p.bolts[0]!;
    expect(a.arrow).toBe(true);
    expect(a.power).toBe(1);
    expect(a.vy).toBeLessThan(0);
    expect(Math.abs(a.vx)).toBeLessThan(1e-9);
    expect(p.attackBox()).toBeNull();
  });

  it("holding Space releases a piercing power arrow with 2x damage", () => {
    const p = new Player("hunter");
    p.fx = 1;
    p.fy = 0;
    for (let t = 0; t < CHARGE_TIME + 0.05; t += 0.02) p.update(0.02, keys({ held: true }));
    expect(p.charged).toBe(true);
    p.update(0.016, keys({}));
    const a = p.bolts.at(-1)!;
    expect(a.power).toBe(2);
    expect(a.left).toBeGreaterThan(10);
    expect(p.spinCooldown).toBeCloseTo(POWER_SHOT_CD, 1);
  });

  it("the power arrow goes through every enemy in a line", () => {
    const { g } = makeGame();
    const p = g.player;
    p.x = 60;
    p.y = 120;
    const line = [100, 140, 180].map((x) => {
      const e = new Enemy("rammer", x, 120);
      e.spawn = 0;
      e.aiTimer = 99;
      return e;
    });
    g.enemies = line;
    g.bolts = [
      { x: 70, y: 118, vx: 260, vy: 0, size: 7, left: 99, hit: [], arrow: true, power: 2 },
    ];
    p.update = () => {};
    tick(g, 0.6);
    // 4 jonli skeletlar 2x zarar oldi
    for (const e of line) expect(e.hp).toBe(2);
  });

  it("a short Shift is a back jump away from the nearest enemy", () => {
    const { g } = makeGame();
    const p = g.player;
    p.x = 160;
    p.y = 120;
    p.fx = 1;
    p.fy = 0;
    const e = new Enemy("blob", 190, 120);
    e.spawn = 0;
    g.enemies = [e];
    e.update = () => {};
    g.input.pressDash();
    g.update(0.016);
    // qo'yib yuborildi — sakrash
    g.update(0.016);
    expect(p.dashing).toBe(true);
    expect(p.takeHit(1, p.x, p.y, 0)).toBe(false);
    tick(g, JUMP_TIME + 0.05);
    expect(p.x).toBeLessThan(130);
    // yuzi hali ham nishonga qaragan
    expect(p.fx).toBe(1);
  });

  it("holding Shift sets a trap at the feet with a 6s cooldown", () => {
    const p = new Player("hunter");
    p.update(0.016, keys({ dash: true, shift: true }));
    for (let t = 0; t < TRAP_HOLD; t += 0.02) p.update(0.02, keys({ shift: true }));
    expect(p.traps.length).toBe(1);
    expect(p.dashing).toBe(false);
    expect(p.trapCooldown).toBeCloseTo(TRAP_CD, 1);
    p.traps = [];
    p.update(0.016, keys({}));
    // qayta tiklanmaguncha yangi tuzoq yo'q
    p.update(0.016, keys({ dash: true, shift: true }));
    for (let t = 0; t < TRAP_HOLD + 0.05; t += 0.02) p.update(0.02, keys({ shift: true }));
    expect(p.traps.length).toBe(0);
    expect(p.trapDenied).toBe(true);
    expect(TRAP_CD).toBe(6);
  });

  it("an enemy stepping on the trap is frozen for 2s; the boss is not trapped", () => {
    const { g, gi } = makeGame();
    const p = g.player;
    p.update = () => {};
    const e = new Enemy("rammer", 100, 120);
    e.spawn = 0;
    g.enemies = [e];
    g.traps = [{ x: 100, y: 122, life: 20, snapT: -1 }];
    g.update(0.02);
    expect(e.stun).toBeGreaterThan(TRAP_STUN - 0.1);
    const [x, y] = [e.x, e.y];
    tick(g, TRAP_STUN - 0.2);
    expect([e.x, e.y]).toEqual([x, y]);
    tick(g, 0.4);
    expect(e.stun).toBeLessThanOrEqual(0);
    expect(g.traps.length).toBe(0);
    // Boss tuzoqqa tushmaydi
    gi.startWave(BOSS_WAVE);
    g.enemies = [];
    g.boss!.spawn = 0;
    g.traps = [{ x: g.boss!.x, y: g.boss!.y, life: 20, snapT: -1 }];
    g.update(0.02);
    expect(g.traps[0]!.snapT).toBe(-1);
  });

  it("keeps at most 2 open traps in the room", () => {
    const { g } = makeGame();
    const p = g.player;
    g.enemies = [Object.assign(new Enemy("blob", 30, 30), { spawn: 99 })];
    for (let k = 0; k < 3; k++) {
      p.x = 60 + k * 40;
      p.traps.push({ x: p.x, y: p.y });
      g.update(0.016);
    }
    expect(g.traps.length).toBe(MAX_TRAPS);
    expect(g.traps.map((t) => t.x)).toEqual([100, 140]);
  });
});

describe("Ovchi kuch kartalari", () => {
  it("each shared card has its own green-brown name, icon and color for the hunter", () => {
    const h = new Player("hunter");
    const k = new Player("knight");
    const m = new Player("mage");
    for (const u of UPGRADES.filter((u) => !u.hero)) {
      const hc = cardFor(u, h);
      expect(u.hunter, u.id).toBeDefined();
      expect(hc.name).not.toBe(cardFor(u, k).name);
      expect(hc.name).not.toBe(cardFor(u, m).name);
      expect(upgradeIcon(hc)).not.toBe(upgradeIcon(cardFor(u, k)));
    }
    const names = UPGRADES.filter((u) => !u.hero).map((u) => cardFor(u, h).name);
    expect(names).toContain("OVCHI YURAGI");
    expect(names).toContain("IKKI KARRA SAKRASH");
  });

  it("UCH O'Q and ZAHARLI UCH are hunter-only", () => {
    for (const hero of ["knight", "mage"] as const)
      for (let i = 0; i < 30; i++)
        for (const u of pickUpgrades(new Player(hero), 3))
          expect(["htriple", "venom"]).not.toContain(u.id);
    const ids = new Set<string>();
    for (let i = 0; i < 80; i++)
      for (const u of pickUpgrades(new Player("hunter"), 3)) ids.add(u.id);
    expect(ids.has("htriple")).toBe(true);
    expect(ids.has("venom")).toBe(true);
    // Sehrgarning Uch shari Ovchiga chiqmaydi
    expect(ids.has("triple")).toBe(false);
  });

  it("UCH O'Q fires a fan of 3 arrows", () => {
    const p = new Player("hunter");
    UPGRADES.find((u) => u.id === "htriple")!.apply(p);
    p.update(0.016, keys({ attack: true }));
    expect(p.bolts.length).toBe(3);
    expect(new Set(p.bolts.map((b) => Math.atan2(b.vy, b.vx).toFixed(3))).size).toBe(3);
  });

  it("ZAHARLI UCH poisons: 1 damage every second for 3 seconds", () => {
    const { g } = makeGame();
    const p = g.player;
    UPGRADES.find((u) => u.id === "venom")!.apply(p);
    expect(p.poisonTip).toBe(true);
    p.update = () => {};
    const e = new Enemy("treant", 120, 120);
    e.spawn = 0;
    e.update = () => {};
    g.enemies = [e];
    g.bolts = [
      {
        x: 100,
        y: 120,
        vx: 200,
        vy: 0,
        size: 5,
        left: 1,
        hit: [],
        arrow: true,
        power: 1,
        poison: true,
      },
    ];
    tick(g, 0.2);
    expect(e.hp).toBe(7);
    expect(e.poison).toBeGreaterThan(POISON_TIME - 0.3);
    tick(g, POISON_TIME + 0.2);
    expect(e.hp).toBe(4);
    expect(e.poison).toBeLessThanOrEqual(0);
  });
});

describe("Ovchi: do'kon, yutuqlar, rekordlar, kunlik sinov", () => {
  it("shop upgrades work for the hunter", () => {
    localStorage.setItem(SHOP_KEY, JSON.stringify({ heart: 2, dash: 1, blade: 1, luck: 0 }));
    const p = new Player("hunter");
    applyShop(p, loadShop());
    expect(p.maxHp).toBe(7);
    expect(p.hp).toBe(7);
    expect(p.damage).toBe(2);
    expect(p.dashCd).toBeLessThan(new Player("hunter").dashCd);
  });

  it("winning with the hunter unlocks OVCHI BILAN YUT and marks the map", () => {
    const { g, gi } = makeGame();
    gi.startWave(BOSS_WAVE);
    g.enemies = [];
    g.boss!.spawn = 0;
    gi.damageTarget(g.boss, 999);
    tick(g, 2.5);
    expect(g.phase).toBe("victory");
    expect(loadAchievements().has("winHunter")).toBe(true);
    expect(worldWins()[1]).toEqual(["hunter"]);
    expect(Number(localStorage.getItem(bestKeys("hunter").best))).toBe(g.score);
    expect(localStorage.getItem(bestKeys("knight").best)).toBeNull();
  });

  it("has its own record keys", () => {
    expect(bestKeys("hunter")).toEqual({
      best: "pixel-rpg-best-hunter",
      endless: "pixel-rpg-endless-best-hunter",
      ch2: "pixel-rpg-best-ch2-hunter",
      ch3: "pixel-rpg-best-ch3-hunter",
    });
  });

  it("the daily challenge saves the hunter as the hero", () => {
    const { g } = makeGame({ daily: "2026-10-28" });
    expect(g.player.hunter).toBe(true);
    expect(loadDaily("2026-10-28")).toMatchObject({ hero: "hunter" });
  });
});
