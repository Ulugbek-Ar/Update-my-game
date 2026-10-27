import { beforeEach, describe, expect, it } from "vitest";
import {
  GOLD_KEY,
  SHOP_ITEMS,
  SHOP_KEY,
  addGold,
  applyShop,
  buy,
  dropBonus,
  emptyLevels,
  loadGold,
  loadShop,
} from "./shop";
import { Player, PLAYER_MAX_HP } from "./player";
import { UPGRADE_ICONS } from "./sprites";

beforeEach(() => localStorage.clear());

describe("Oltin hisobi", () => {
  it("starts at 0 and accumulates across runs", () => {
    expect(loadGold()).toBe(0);
    expect(addGold(12)).toBe(12);
    expect(addGold(5)).toBe(17);
    expect(Number(localStorage.getItem(GOLD_KEY))).toBe(17);
  });

  it("ignores broken or negative values", () => {
    localStorage.setItem(GOLD_KEY, "abc");
    expect(loadGold()).toBe(0);
    expect(addGold(-5)).toBe(0);
  });
});

describe("Do'kon", () => {
  it("has the four upgrades with rising prices and the right number of levels", () => {
    const levels = Object.fromEntries(SHOP_ITEMS.map((i) => [i.id, i.costs.length]));
    expect(levels).toEqual({ heart: 3, dash: 3, blade: 1, luck: 3 });
    for (const item of SHOP_ITEMS)
      for (let i = 1; i < item.costs.length; i++)
        expect(item.costs[i]!).toBeGreaterThan(item.costs[i - 1]!);
  });

  it("buys a level only with enough gold and stops at max level", () => {
    expect(buy("blade")).toBe(false);
    addGold(80);
    expect(buy("blade")).toBe(true);
    expect(loadGold()).toBe(0);
    expect(loadShop().blade).toBe(1);
    addGold(500);
    expect(buy("blade")).toBe(false);
    expect(loadGold()).toBe(500);
  });

  it("charges the next level's price", () => {
    addGold(30 + 60);
    expect(buy("heart")).toBe(true);
    expect(buy("heart")).toBe(true);
    expect(loadGold()).toBe(0);
    expect(loadShop().heart).toBe(2);
  });

  it("clamps saved levels and survives broken JSON", () => {
    localStorage.setItem(SHOP_KEY, JSON.stringify({ heart: 9, dash: -2, blade: "x" }));
    expect(loadShop()).toEqual({ heart: 3, dash: 0, blade: 0, luck: 0 });
    localStorage.setItem(SHOP_KEY, "{buzuq");
    expect(loadShop()).toEqual(emptyLevels());
  });

  it("without purchases the player keeps base stats (game stays winnable unchanged)", () => {
    const p = new Player();
    applyShop(p, emptyLevels());
    const base = new Player();
    expect([p.maxHp, p.hp, p.dashCd, p.damage]).toEqual([
      base.maxHp,
      base.hp,
      base.dashCd,
      base.damage,
    ]);
    expect(dropBonus(emptyLevels())).toBe(0);
  });

  it("applies maxed upgrades as easier starting stats", () => {
    const p = new Player();
    const full = { heart: 3, dash: 3, blade: 1, luck: 3 };
    applyShop(p, full);
    expect(p.maxHp).toBe(PLAYER_MAX_HP + 3);
    expect(p.hp).toBe(p.maxHp);
    expect(p.dashCd).toBeCloseTo(0.8 * 0.9 ** 3);
    expect(p.damage).toBe(2);
    expect(dropBonus(full)).toBeCloseTo(0.15);
  });

  it("every shop item and the coin have a 12x12 code-drawn icon", () => {
    for (const id of [...SHOP_ITEMS.map((i) => i.icon), "coin"]) {
      const rows = UPGRADE_ICONS[id];
      expect(rows, id).toBeDefined();
      expect(rows!.length).toBe(12);
      for (const row of rows!) expect(row).toMatch(/^[.Xogkrd]{12}$/);
    }
  });
});
