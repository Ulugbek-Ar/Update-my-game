import { describe, expect, it } from "vitest";
import { spritePixels, PALETTES, type SpriteKind } from "./sprites";
import type { AnimState } from "./animation";
import { RealmMob } from "@/realm/mobs";

const counts: Record<AnimState, number> = { idle: 2, walk: 4, attack: 3, hurt: 1, death: 3 };
const REALM: SpriteKind[] = ["boar", "rat", "sentinel", "wisp", "warden", "elder", "merchant"];

describe("Abadiyat olami spritelari (faqat kod bilan, 5 rang)", () => {
  for (const kind of REALM) {
    it(`${kind}: five-color palette`, () => {
      expect(PALETTES[kind]).toHaveLength(5);
    });
    for (const [state, count] of Object.entries(counts) as [AnimState, number][]) {
      it(`${kind} has ${count} distinct ${state} frames within five colors`, () => {
        const frames = Array.from({ length: count }, (_, f) => spritePixels(kind, state, f));
        expect(new Set(frames.map((px) => px.join(","))).size).toBe(count);
        for (const frame of frames) {
          expect(frame.length).toBe(32 * 32);
          expect(Math.max(...frame)).toBeLessThanOrEqual(5);
          expect(frame.some((c) => c === 1)).toBe(true);
        }
      });
    }
  }

  it("realm mobs use the shared Animator frame counts", () => {
    for (const kind of ["boar", "rat", "sentinel", "wisp", "warden"] as const) {
      const m = new RealmMob(1, kind, 0, 0, "z");
      for (const [state, count] of Object.entries(counts) as [AnimState, number][])
        expect(m.anim.defs[state].frames).toBe(count);
    }
  });
});
