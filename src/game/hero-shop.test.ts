import { beforeEach, describe, expect, it } from "vitest";
import { FREE_HEROES, GUNNER_PRICE, HERO_KEY, HERO_LIST, loadHero, saveHero } from "./hero";
import {
  SAVE_VERSION_KEY,
  UNLOCKED_HEROES_KEY,
  isHeroUnlocked,
  loadPlayableHero,
  loadUnlockedHeroes,
  migrateSave,
  selectHero,
  unlockHero,
} from "./save";
import { BOSS_GOLD, KILL_GOLD, addGold, buyHero, goldShort, heroPrice, loadGold } from "./shop";
import { CHEST_CHANCE, CHEST_GOLD, Game } from "./game";
import { WAVES, isChestWave } from "./waves";
import { RealmClient } from "@/realm/client";

const canvas = () =>
  ({ getContext: () => ({ imageSmoothingEnabled: false }) }) as unknown as HTMLCanvasElement;

beforeEach(() => localStorage.clear());

describe("Qahramonlar do'koni", () => {
  it("Mergan is the first hero for sale, the first three stay free", () => {
    const paid = HERO_LIST.filter((h) => h.price > 0);
    expect(paid[0]?.id).toBe("gunner");
    expect(HERO_LIST.findIndex((h) => h.price > 0)).toBe(FREE_HEROES);
    expect(heroPrice("gunner")).toBe(GUNNER_PRICE);
    expect(heroPrice("knight")).toBe(0);
    expect([...loadUnlockedHeroes()].sort()).toEqual(["hunter", "knight", "mage"]);
    expect(isHeroUnlocked("gunner")).toBe(false);
  });

  it("does not sell without enough gold and tells how much is missing", () => {
    addGold(GUNNER_PRICE - 40);
    expect(goldShort("gunner")).toBe(40);
    expect(buyHero("gunner")).toBe(false);
    expect(loadGold()).toBe(GUNNER_PRICE - 40);
    expect(isHeroUnlocked("gunner")).toBe(false);
  });

  it("with enough gold the hero unlocks, is saved and paid for once", () => {
    addGold(GUNNER_PRICE + 25);
    expect(goldShort("gunner")).toBe(0);
    expect(buyHero("gunner")).toBe(true);
    expect(loadGold()).toBe(25);
    expect(JSON.parse(localStorage.getItem(UNLOCKED_HEROES_KEY)!)).toContain("gunner");
    expect(isHeroUnlocked("gunner")).toBe(true);
    // bir martalik: qayta sotib olinmaydi va oltin yechilmaydi
    addGold(GUNNER_PRICE);
    expect(buyHero("gunner")).toBe(false);
    expect(loadGold()).toBe(25 + GUNNER_PRICE);
    expect(goldShort("gunner", 0)).toBe(GUNNER_PRICE);
  });

  it("free heroes are never sold", () => {
    addGold(999);
    for (const h of ["knight", "mage", "hunter"] as const) expect(buyHero(h)).toBe(false);
    expect(loadGold()).toBe(999);
  });
});

describe("Qulfli qahramon", () => {
  it("cannot be selected; a stored locked choice falls back to the knight", () => {
    expect(selectHero("gunner")).toBe(false);
    expect(localStorage.getItem(HERO_KEY)).toBeNull();
    // buzilgan yoki qo'lda yozilgan tanlov
    saveHero("gunner");
    expect(loadHero()).toBe("gunner");
    expect(loadPlayableHero()).toBe("knight");
    unlockHero("gunner");
    expect(selectHero("gunner")).toBe(true);
    expect(loadPlayableHero()).toBe("gunner");
  });

  it("a game, the daily challenge and the realm never start with a locked hero", () => {
    expect(new Game(canvas(), "gunner").hero).toBe("knight");
    expect(new Game(canvas(), "gunner").player.hero).toBe("knight");
    expect(new Game(canvas(), "gunner", { daily: "2026-10-29" }).hero).toBe("knight");
    expect(new RealmClient(canvas(), "gunner").hero).toBe("knight");
    expect(new RealmClient(canvas(), "gunner").me.hero).toBe("knight");
    unlockHero("gunner");
    expect(new Game(canvas(), "gunner").player.hero).toBe("gunner");
    expect(new Game(canvas(), "gunner", { daily: "2026-10-29" }).hero).toBe("gunner");
    expect(new RealmClient(canvas(), "gunner").me.hero).toBe("gunner");
  });
});

describe("Saqlash migratsiyasi", () => {
  it("old saves keep the three free heroes; a paid hero is not unlocked for free", () => {
    localStorage.setItem(SAVE_VERSION_KEY, "2");
    localStorage.setItem(HERO_KEY, "gunner");
    localStorage.setItem("pixel-rpg-gold", "120");
    expect(migrateSave()).toBe(true);
    expect([...loadUnlockedHeroes()].sort()).toEqual(["hunter", "knight", "mage"]);
    expect(loadPlayableHero()).toBe("knight");
    expect(loadGold()).toBe(120);
  });

  it("a bought hero stays unlocked after later loads and migrations", () => {
    addGold(GUNNER_PRICE);
    expect(buyHero("gunner")).toBe(true);
    migrateSave();
    migrateSave();
    expect(loadUnlockedHeroes().has("gunner")).toBe(true);
    expect([...loadUnlockedHeroes()].sort()).toEqual(["gunner", "hunter", "knight", "mage"]);
  });
});

describe("Narx oltin iqtisodidan", () => {
  it("Mergan costs about 4–6 full world-1 runs", () => {
    // 1-dunyo: hamma to'lqin dushmanlari + Iblis + sandiq to'lqinlaridagi o'rtacha sandiq oltini
    const kills = WAVES.flat().reduce((s, k) => s + KILL_GOLD[k], 0) + BOSS_GOLD;
    const chestWaves = WAVES.filter((_, i) => isChestWave(i)).length;
    const chests = (chestWaves * CHEST_CHANCE * (CHEST_GOLD[0] + CHEST_GOLD[1])) / 2;
    const run = kills + chests;
    expect(kills).toBe(59);
    expect(run).toBeCloseTo(67, 0);
    // hamma tangani tergan o'yinchi ham, ~85% tergan o'rtacha o'yinchi ham 4–6 o'yinda yig'adi
    for (const collected of [run, run * 0.85]) {
      expect(GUNNER_PRICE / collected).toBeGreaterThanOrEqual(4);
      expect(GUNNER_PRICE / collected).toBeLessThanOrEqual(6);
    }
  });
});
