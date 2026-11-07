import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  FX_SLOTS,
  PLAIN_FX,
  THEME_SLOTS,
  defaultLook,
  heroBurst,
  heroTrail,
} from "./skinFx";
import { DANGER_COLORS, dangerDistance } from "./danger";
import { HEROES, HERO_THEME, chargeRingColor, hudBarColors } from "./hero";
import { SKINS, buySkin, skinLook } from "./skins";
import { Effects, MAX_PARTICLES, REDUCED_MAX_PARTICLES } from "./effects";
import { Game } from "./game";
import { unlockHero } from "./save";

beforeEach(() => localStorage.clear());

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
  return { canvas: canvas as unknown as HTMLCanvasElement, fills, strokes };
}

const wallet = () => {
  let g = 9999;
  return { get: () => g, set: (n: number) => (g = n) };
};

type Internals = { renderSlash(c: unknown): void; ctx: unknown };

describe("Skin effekt tizimi", () => {
  it("default skin keeps the exact v3.6 theme and plain effects", () => {
    for (const h of HEROES) {
      const l = defaultLook(h);
      expect(skinLook(h, "default")).toMatchObject({ tier: "default", fx: PLAIN_FX });
      for (const k of Object.keys(HERO_THEME[h]) as (keyof typeof HERO_THEME.knight)[])
        expect(l.theme[k], `${h}.${k}`).toBe(HERO_THEME[h][k]);
      // HUD va zaryad halqasi — default skinda aynan eski ranglar
      expect(hudBarColors(l.theme)).toEqual(hudBarColors(h));
      expect(chargeRingColor(l.theme, true, 1)).toBe(chargeRingColor(h, true, 1));
    }
    // asl qattiq yozilgan ranglar slotlarga ko'chgan
    expect(DEFAULT_THEME.knight.edge).toBe("#ffffff");
    expect(DEFAULT_THEME.mage.edge).toBe("#d62832");
    expect(DEFAULT_THEME.gunner.ink).toBe("#0b0907");
  });

  it("every skin has a full theme (all slots) and effects", () => {
    for (const h of HEROES)
      for (const s of SKINS[h]) {
        for (const k of THEME_SLOTS) expect(s.theme[k], `${s.id}.${k}`).toMatch(/^#[0-9a-f]{6}$/);
        expect(s.theme.trail).toMatch(/^rgba\(\d+,\d+,\d+,0\.8\)$/);
        expect(s.fx.particle).toBeTruthy();
        expect(s.fx.trail).toBeTruthy();
        expect(Array.isArray(s.fx.bits)).toBe(true);
      }
  });

  it("paid skin effect colours stay far from enemy danger colours", () => {
    expect(DANGER_COLORS.length).toBeGreaterThan(8);
    for (const h of HEROES)
      for (const s of SKINS[h].slice(1)) {
        for (const k of FX_SLOTS)
          expect(dangerDistance(s.theme[k]), `${s.id}.${k} ${s.theme[k]}`).toBeGreaterThan(100);
        for (const b of s.fx.bits)
          expect(dangerDistance(b), `${s.id} bit ${b}`).toBeGreaterThan(100);
      }
  });

  it("the knight slash is drawn in the skin colours (default: white + accent)", () => {
    const run = () => {
      const r = recordingCanvas();
      const g = new Game(r.canvas, "knight");
      g.player.attackTimer = 0.2;
      (g as unknown as Internals).renderSlash((g as unknown as Internals).ctx);
      return r.strokes;
    };
    const plain = run();
    expect(plain.some((s) => s.startsWith("rgba(255,255,255,"))).toBe(true);
    expect(plain.some((s) => s.startsWith("rgba(104,205,228,"))).toBe(true);
    buySkin("knight", "knight-black", wallet());
    const black = run();
    expect(black.some((s) => s.startsWith("rgba(228,224,255,"))).toBe(true);
    expect(black.some((s) => s.startsWith("rgba(255,255,255,"))).toBe(false);
  });

  it("the game and HUD use the active skin theme", () => {
    unlockHero("paladin");
    buySkin("paladin", "paladin-silver", wallet());
    const g = new Game(recordingCanvas().canvas, "paladin");
    expect(g.look.id).toBe("paladin-silver");
    expect(g.theme.accent).toBe(SKINS.paladin[1]!.theme.accent);
  });
});

describe("Zarrachalar chegarasi va kamaytirish", () => {
  it("never keeps more than MAX_PARTICLES at once", () => {
    const fx = new Effects();
    fx.reduced = false;
    for (let i = 0; i < 100; i++) fx.burst(0, 0, "#fff", 20);
    expect(fx.particles.length).toBe(MAX_PARTICLES);
  });

  it("reduce-effects shrinks bursts and trails and skips impact flashes", () => {
    const count = (reduced: boolean) => {
      const fx = new Effects();
      fx.reduced = reduced;
      const look = skinLook("knight", "knight-ice");
      for (let i = 0; i < 10; i++) {
        heroBurst(fx, look, 0, 0, "#fff", 12);
        heroTrail(fx, look, 0, 0, look.theme.trail);
        fx.impact(0, 0, "crystal", "#fff", "#fff");
      }
      return { n: fx.particles.length, imp: fx.impacts.length };
    };
    const full = count(false),
      low = count(true);
    expect(low.n).toBeLessThan(full.n / 2);
    expect(low.imp).toBe(0);
    const fx = new Effects();
    fx.reduced = true;
    for (let i = 0; i < 100; i++) fx.burst(0, 0, "#fff", 20);
    expect(fx.particles.length).toBe(REDUCED_MAX_PARTICLES);
  });
});
