import { beforeEach, describe, expect, it } from "vitest";
import { SAVE_VERSION, SAVE_VERSION_KEY, migrateSave } from "./save";
import { loadGold, loadShop } from "./shop";
import { loadAchievements } from "./achievements";
import { DEFAULT_SETTINGS, loadSettings } from "./settings";
import { loadDaily } from "./daily";
import { loadHero } from "./hero";
import { MapState } from "./map";
import { WORLD2_WON_KEY, worldWins } from "./progress";
import { Game } from "./game";

/** v1.9.0 o'yinchisining localStorage'i: Ritsar va Sehrgar bilan yutgan, Qor Malikasini yenggan. */
const V19: Record<string, string> = {
  "pixel-rpg-gold": "347",
  "pixel-rpg-shop": JSON.stringify({ heart: 2, dash: 1, blade: 1, luck: 3 }),
  "pixel-rpg-achievements": JSON.stringify(["first", "boss", "winKnight", "winMage", "queen"]),
  "pixel-rpg-best": "4210",
  "pixel-rpg-endless-best": "990",
  "pixel-rpg-best-ch2": "6100",
  "pixel-rpg-best-mage": "3870",
  "pixel-rpg-endless-best-mage": "120",
  "pixel-rpg-hero": "mage",
  "pixel-rpg-settings": JSON.stringify({ music: 35, sfx: 70, shake: false }),
  "pixel-rpg-daily": JSON.stringify({
    date: "2026-10-28",
    hero: "knight",
    score: 880,
    wave: 3,
    won: false,
  }),
  "pixel-rpg-muted": "1",
  "pixel-rpg-tutorial-done": "1",
  "pixel-rpg-attempt": "7",
  "pixel-rpg-world1-won": "1",
  "pixel-rpg-seen-version": "1.9.0",
};

beforeEach(() => {
  localStorage.clear();
  for (const [k, v] of Object.entries(V19)) localStorage.setItem(k, v);
});

describe("Saqlash migratsiyasi (v1.9 -> 2.0)", () => {
  it("keeps every old key exactly as it was", () => {
    expect(migrateSave()).toBe(true);
    for (const [k, v] of Object.entries(V19)) expect(localStorage.getItem(k), k).toBe(v);
    expect(localStorage.getItem(SAVE_VERSION_KEY)).toBe(String(SAVE_VERSION));
  });

  it("gold, shop, achievements, settings, daily and hero still load the same", () => {
    migrateSave();
    expect(loadGold()).toBe(347);
    expect(loadShop()).toEqual({ heart: 2, dash: 1, blade: 1, luck: 3 });
    expect([...loadAchievements()].sort()).toEqual(
      ["boss", "first", "queen", "winKnight", "winMage"].sort(),
    );
    // v2.5: eski sozlamalar saqlanadi, boshqaruv bo'limi asl qiymatlar bilan qo'shiladi
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, music: 35, sfx: 70, shake: false });
    expect(loadDaily("2026-10-28")).toMatchObject({ score: 880, wave: 3 });
    expect(loadHero()).toBe("mage");
  });

  it("fills in the map: world 1 won by both heroes, world 2 won, so world 3 is open", () => {
    migrateSave();
    expect(worldWins()[1]).toEqual(["knight", "mage"]);
    expect(worldWins()[2]).toEqual(["knight"]);
    expect(localStorage.getItem(WORLD2_WON_KEY)).toBe("1");
    const s = new MapState();
    expect(s.open).toEqual({ 1: true, 2: true, 3: true });
    expect(s.best[1]).toBe(4210);
    expect(s.best[2]).toBe(6100);
  });

  it("runs only once and the old records still feed the game", () => {
    expect(migrateSave()).toBe(true);
    expect(migrateSave()).toBe(false);
    const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
    const g = new Game(canvas as unknown as HTMLCanvasElement, "knight");
    expect(g.best).toBe(4210);
    expect(g.endlessBest).toBe(990);
    expect(g.ch2Best).toBe(6100);
    expect(g.attempt).toBe(7);
    // do'kon kuchaytirishlari yangi o'yinda ham beriladi
    expect(g.player.maxHp).toBe(8);
    expect(g.player.damage).toBe(2);
  });

  it("an empty (new) player gets a clean start", () => {
    localStorage.clear();
    expect(migrateSave()).toBe(true);
    expect(loadGold()).toBe(0);
    expect(new MapState().open).toEqual({ 1: true, 2: false, 3: false });
  });
});
