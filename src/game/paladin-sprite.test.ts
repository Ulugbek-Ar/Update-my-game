import { describe, expect, it } from "vitest";
import {
  PALADIN_GRID,
  PALADIN_SWORD,
  PALETTES,
  spriteGrid,
  spritePixels,
  spriteSize,
} from "./sprites";
import { HERO_LIST, HERO_THEME, MAX_HEROES, PALADIN_PRICE, GUNNER_PRICE } from "./hero";
import { Player } from "./player";
import type { AnimState } from "./animation";

const counts: Record<AnimState, number> = { idle: 2, walk: 4, attack: 4, hurt: 1, death: 3 };
const N = PALADIN_GRID;
const OFF = (N - 32) / 2;

/** Tana (32x32 markaz) tashqarisidagi rangli piksellar soni — qilich shu yerga chiqadi */
function outside(frame: Uint8Array) {
  let n = 0;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const inBody = x >= OFF && x < OFF + 32 && y >= OFF && y < OFF + 32;
      if (!inBody && frame[y * N + x]! > 1) n++;
    }
  return n;
}

describe("Paladin ko'rinishi", () => {
  it("is the 5th hero, sold in the shop, with an orange theme", () => {
    const i = HERO_LIST.findIndex((h) => h.id === "paladin");
    expect(i).toBe(4);
    expect(HERO_LIST.length).toBeLessThanOrEqual(MAX_HEROES);
    expect(HERO_LIST[i]!.name).toBe("PALADIN");
    expect(PALADIN_PRICE).toBeGreaterThan(GUNNER_PRICE);
    expect(HERO_THEME.paladin).toMatchObject({
      accent: "#ff8c1a",
      accentDark: "#a8500f",
      glow: "#ffd27a",
    });
  });

  for (const [state, count] of Object.entries(counts) as [AnimState, number][]) {
    it(`has ${count} distinct ${state} frames within five colors`, () => {
      const frames = Array.from({ length: count }, (_, f) => spritePixels("paladin", state, f));
      expect(new Set(frames.map((p) => p.join(","))).size).toBe(count);
      for (const frame of frames) {
        expect(frame.length).toBe(N * N);
        expect(Math.max(...frame)).toBeLessThanOrEqual(5);
        expect(frame.some((c) => c === 1)).toBe(true);
        // chegarada faqat kontur yoki bo'sh — qilich kesilmaydi
        for (let i = 0; i < N; i++)
          for (const edge of [i, (N - 1) * N + i, i * N, i * N + N - 1])
            expect(frame[edge]).toBeLessThanOrEqual(1);
      }
    });
  }

  it("uses exactly five palette colors", () => {
    expect(PALETTES.paladin).toHaveLength(5);
  });

  it("draws the giant sword outside the 32x32 body in every living frame", () => {
    for (const state of ["idle", "walk", "attack", "hurt"] as const)
      for (let f = 0; f < counts[state]; f++)
        expect(outside(spritePixels("paladin", state, f))).toBeGreaterThan(8);
  });

  it("sword is ~1.5x the hero's height (body ~24 px)", () => {
    for (const s of PALADIN_SWORD.idle) {
      const len = Math.hypot(s.tip[0] - s.hand[0], s.tip[1] - s.hand[1]);
      expect(len).toBeGreaterThan(30);
      expect(len).toBeLessThan(42);
    }
    // urish kadrida uchi tanadan oldinga uzoq chiqadi (zarba yo'lagi oxirigacha)
    expect(PALADIN_SWORD.attack[2]!.tip[0]).toBeGreaterThan(48);
  });

  it("has a different back view and drops the sword on death", () => {
    expect(spritePixels("paladin", "idle", 0, true).join(",")).not.toBe(
      spritePixels("paladin", "idle", 0).join(","),
    );
    const lying = spritePixels("paladin", "death", 2);
    // qilich yerda: tananing o'ng tomonida rangli piksellar
    expect(outside(lying)).toBeGreaterThan(8);
  });

  it("keeps visual size independent of collision size", () => {
    expect(spriteGrid("paladin")).toBe(N);
    // 1 to'r piksel = 1 px: tana boshqa qahramonlardek 32 px ko'rinadi
    expect(spriteSize("paladin")).toBe(N);
    expect(new Player("paladin").size).toBe(new Player("knight").size);
  });
});
