import { beforeEach, describe, expect, it } from "vitest";
import { Game } from "./game";
import { CHARGE_TIME } from "./player";
import { ACHIEVEMENTS } from "./achievements";
import {
  FREE_HEROES,
  HEROES,
  HERO_LIST,
  HERO_THEME,
  MAX_HEROES,
  chargeRingColor,
  hudBarColors,
  withAlpha,
  type Hero,
} from "./hero";
import {
  SAVE_VERSION,
  SAVE_VERSION_KEY,
  UNLOCKED_HEROES_KEY,
  isHeroUnlocked,
  loadUnlockedHeroes,
  migrateSave,
  unlockHero,
} from "./save";

/** Chizilgan ranglarni yozib boradigan soxta canvas konteksti. */
function recordingCanvas() {
  const fills: string[] = [];
  const strokes: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_, k) =>
        k === "measureText"
          ? () => ({ width: 0 })
          : k === "canvas"
            ? { width: 960, height: 540 }
            : () => {},
      set: (_, k, v) => {
        if (k === "fillStyle") fills.push(v);
        if (k === "strokeStyle") strokes.push(v);
        return true;
      },
    },
  );
  const canvas = { getContext: () => ctx, width: 960, height: 540 };
  return { canvas: canvas as unknown as HTMLCanvasElement, ctx, fills, strokes };
}

type Internals = {
  renderSlash(c: unknown): void;
  renderHud(): void;
  renderToast(): void;
};

beforeEach(() => localStorage.clear());

describe("HERO_THEME", () => {
  it("every hero has a full colour theme", () => {
    for (const h of HEROES) {
      const t = HERO_THEME[h];
      for (const k of ["accent", "accentDark", "glow", "uiText", "empty"] as const)
        expect(t[k], `${h}.${k}`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.trail).toMatch(/^rgba\(/);
    }
    expect(HERO_THEME.knight.accent).toBe("#68cde4");
    expect(HERO_THEME.mage.accent).toBe("#ff4d4d");
    expect(HERO_THEME.hunter.accent).toBe("#a6f08e");
  });

  it("hero list keeps metadata and fits the 10-card menu row", () => {
    expect(HERO_LIST.map((h) => h.id)).toEqual(["knight", "mage", "hunter", "gunner", "paladin"]);
    expect(new Set(HEROES).size).toBe(HEROES.length);
    expect(HERO_LIST.length).toBeLessThanOrEqual(MAX_HEROES);
    HERO_LIST.forEach((h, i) => {
      // dastlabki 3 tasi bepul, 4-qahramondan boshlab oltinga sotiladi
      if (i < FREE_HEROES) expect(h.price, h.id).toBe(0);
      else expect(h.price, h.id).toBeGreaterThan(0);
      expect(h.theme).toBe(HERO_THEME[h.id]);
      expect(h.name).toBeTruthy();
      expect(h.desc).toBeTruthy();
    });
  });

  it("withAlpha converts hex to rgba", () => {
    expect(withAlpha("#68cde4", 0.5)).toBe("rgba(104,205,228,0.5)");
  });
});

describe("Zaryad halqasi va HUD qahramon rangida", () => {
  // pullik qahramonlar ham sotib olingan
  beforeEach(() => HEROES.forEach(unlockHero));

  it("charge ring uses the hero accent, and glow when full", () => {
    const seen = new Set<string>();
    for (const h of HEROES) {
      const { canvas, ctx, strokes } = recordingCanvas();
      const g = new Game(canvas, h);
      const gi = g as unknown as Internals;
      g.player.charge = g.player.chargeTime * 0.5;
      gi.renderSlash(ctx);
      expect(strokes[0]).toBe(withAlpha(HERO_THEME[h].accent, 0.65));
      expect(strokes[0]).toBe(chargeRingColor(h, false, 0));
      seen.add(strokes[0]!);
      g.player.charge = g.player.chargeTime;
      strokes.length = 0;
      gi.renderSlash(ctx);
      const glow = withAlpha(HERO_THEME[h].glow, 0).replace(/,0\)$/, "");
      expect(strokes[0]!.startsWith(glow)).toBe(true);
      // eski sariq rang qolmagan
      expect(strokes[0]).not.toMatch(/255,(204|236)/);
    }
    expect(seen.size).toBe(HEROES.length);
  });

  it("HUD dash and power bars take the hero colours", () => {
    for (const h of HEROES as Hero[]) {
      const { canvas, fills } = recordingCanvas();
      const g = new Game(canvas, h);
      (g as unknown as Internals).renderHud();
      const { on } = hudBarColors(h);
      expect(on).toBe(HERO_THEME[h].accent);
      // dash va kuchli zarba ikkalasi to'la — accent rangi kamida 2 marta
      expect(fills.filter((f) => f === on).length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("Yutuq xabari kuch tanlash paytida", () => {
  it("waits in the queue while the upgrade screen is open, then shows", () => {
    const { canvas, fills } = recordingCanvas();
    const g = new Game(canvas, "knight");
    g.stage = "upgrade";
    g.toasts.push({ a: ACHIEVEMENTS[0]!, timer: 3 });
    for (let t = 0; t < 5; t += 0.02) g.update(0.02);
    expect(g.toasts).toHaveLength(1);
    expect(g.toasts[0]!.timer).toBe(3);
    (g as unknown as Internals).renderToast();
    expect(fills).toHaveLength(0);
    g.stage = "fight";
    expect(g.toastHeld).toBe(false);
    (g as unknown as Internals).renderToast();
    expect(fills.length).toBeGreaterThan(0);
  });
});

describe("unlockedHeroes migratsiyasi", () => {
  it("an old v2 save keeps every free hero and the selected one unlocked", () => {
    localStorage.setItem(SAVE_VERSION_KEY, "2");
    localStorage.setItem("pixel-rpg-hero", "hunter");
    localStorage.setItem("pixel-rpg-gold", "50");
    expect(migrateSave()).toBe(true);
    expect(localStorage.getItem(SAVE_VERSION_KEY)).toBe(String(SAVE_VERSION));
    expect(JSON.parse(localStorage.getItem(UNLOCKED_HEROES_KEY)!).sort()).toEqual(
      ["hunter", "knight", "mage"].sort(),
    );
    expect(localStorage.getItem("pixel-rpg-gold")).toBe("50");
    expect(migrateSave()).toBe(false);
  });

  it("free heroes are always unlocked, even with a broken record", () => {
    localStorage.setItem(UNLOCKED_HEROES_KEY, "{not json");
    expect([...loadUnlockedHeroes()].sort()).toEqual(["hunter", "knight", "mage"]);
    localStorage.setItem(UNLOCKED_HEROES_KEY, JSON.stringify(["dragon", "mage"]));
    expect(loadUnlockedHeroes().size).toBe(3);
    expect(isHeroUnlocked("knight")).toBe(true);
    unlockHero("mage");
    expect(JSON.parse(localStorage.getItem(UNLOCKED_HEROES_KEY)!)).not.toContain("dragon");
  });
});
