import { describe, expect, it } from "vitest";
import { spritePixels, type SpriteKind } from "./sprites";
import { Player } from "./player";
import { Enemy } from "./enemy";
import { Boss } from "./boss";
import type { AnimState } from "./animation";

const counts: Record<AnimState, number> = { idle: 2, walk: 4, attack: 3, hurt: 1, death: 3 };

describe("Code-drawn character frames", () => {
  for (const kind of ["knight", "skeleton", "demon", "slime", "bat"] as SpriteKind[]) {
    for (const [state, count] of Object.entries(counts) as [AnimState, number][]) {
      it(`${kind} has ${count} distinct ${state} frames within five colors`, () => {
        const frames = Array.from({ length: count }, (_, frame) => spritePixels(kind, state, frame));
        expect(new Set(frames.map((pixels) => pixels.join(","))).size).toBe(count);
        for (const frame of frames) {
          expect(frame.length).toBe(32 * 32);
          expect(Math.max(...frame)).toBeLessThanOrEqual(5);
          expect(frame.some((color) => color === 1)).toBe(true);
        }
      });
    }
  }

  it("connects frame counts to the existing state machine and preserves collision sizes", () => {
    const characters = [new Player(), new Enemy("rammer", 80, 110), new Boss()];
    expect(characters.map((c) => c.size)).toEqual([12, 14, 28]);
    for (const character of characters) {
      for (const [state, count] of Object.entries(counts) as [AnimState, number][]) {
        expect(character.anim.defs[state].frames).toBe(count);
        character.anim.set(state, true);
        character.anim.update(character.anim.defs[state].frameTime + 0.001);
        expect(character.anim.frame).toBe(count === 1 ? 0 : 1);
      }
    }
  });

  it("gives slime and bat the same frame-by-frame state machine", () => {
    for (const kind of ["blob", "wisp"] as const) {
      const enemy = new Enemy(kind, 50, 50);
      expect(Object.values(enemy.anim.defs).map((def) => def.frames)).toEqual([2, 4, 3, 1, 3]);
    }
  });
});