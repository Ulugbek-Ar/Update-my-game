import { describe, expect, it } from "vitest";
import { SCENE_W, owlPerch } from "./menuScene";
import { spriteSize } from "./sprites";

/**
 * Menyu matni (sarlavha, qahramon kartalari, ko'rsatmalar, tugmalar) sahnaning o'rta ustunida.
 * Telefonda (compact) u ~40..280, kompyuterda ~85..235 sahna pikselini egallaydi.
 */
const TEXT_COLUMN = { compact: [40, 280], full: [85, 235] } as const;

describe("Menyu sahnasi: boyo'g'li", () => {
  for (const compact of [true, false]) {
    it(`does not sit behind the menu text (${compact ? "telefon" : "kompyuter"})`, () => {
      const o = owlPerch(compact);
      const half = (spriteSize("owl") * o.scale) / 2;
      const [, right] = compact ? TEXT_COLUMN.compact : TEXT_COLUMN.full;
      expect(o.x - half).toBeGreaterThan(right);
      expect(o.x + half).toBeLessThanOrEqual(SCENE_W);
      expect(Number.isInteger(o.y)).toBe(true);
    });
  }
});
