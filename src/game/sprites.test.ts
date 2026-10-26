import { describe, expect, it } from "vitest";
import { spritePixels, UPGRADE_ICONS, type SpriteKind } from "./sprites";
import { UPGRADES } from "./waves";
import { Player } from "./player";
import { Enemy } from "./enemy";
import { Boss } from "./boss";
import type { AnimState } from "./animation";

const counts: Record<AnimState, number> = { idle: 2, walk: 4, attack: 3, hurt: 1, death: 3 };

describe("Code-drawn character frames", () => {
  for (const kind of ["knight", "skeleton", "archer", "demon", "slime", "bat"] as SpriteKind[]) {
    for (const [state, count] of Object.entries(counts) as [AnimState, number][]) {
      it(`${kind} has ${count} distinct ${state} frames within five colors`, () => {
        const frames = Array.from({ length: count }, (_, frame) =>
          spritePixels(kind, state, frame),
        );
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

describe("Kamonchi skelet sprite", () => {
  const count = (frame: Uint8Array, color: number) => frame.filter((c) => c === color).length;

  it("draws a bow instead of the skeleton's sword in every living state", () => {
    for (const [state, n] of Object.entries(counts) as [AnimState, number][]) {
      if (state === "death") continue;
      for (let f = 0; f < n; f++) {
        expect(spritePixels("archer", state, f).join(",")).not.toBe(
          spritePixels("skeleton", state, f).join(","),
        );
      }
    }
  });

  it("shows the arrow only while drawing, not after release", () => {
    const [nock, drawn, released] = [0, 1, 2].map((f) => spritePixels("archer", "attack", f));
    // 5 — qizil: ko'zlar (hamma kadrda bir xil) + o'q uchi; qo'yib yuborilganda o'q yo'q
    expect(count(drawn!, 5)).toBeGreaterThan(count(released!, 5));
    expect(count(nock!, 5)).toBeGreaterThan(count(released!, 5));
  });

  it("has red eye sockets while the plain skeleton keeps black ones", () => {
    // idle 0 pozasida bosh suyagi siljimagan: ko'z teshiklari (12..14, 8..10) va (17..19, 8..10)
    const archer = spritePixels("archer", "idle", 0);
    const skeleton = spritePixels("skeleton", "idle", 0);
    for (const ex of [12, 17])
      for (let y = 8; y < 11; y++)
        for (let x = ex; x < ex + 3; x++) {
          expect(archer[y * 32 + x]).toBe(5);
          expect(skeleton[y * 32 + x]).toBe(1);
        }
  });

  it("uses a red arrowhead on the drawn arrow", () => {
    const eyes = 18;
    expect(count(spritePixels("archer", "attack", 1), 5)).toBeGreaterThan(eyes);
    expect(count(spritePixels("archer", "attack", 2), 5)).toBe(eyes);
  });

  it("keeps the wooden bow visible while it falls in every death frame", () => {
    for (let f = 0; f < 3; f++) {
      expect(count(spritePixels("archer", "death", f), 4)).toBeGreaterThan(6);
    }
  });
});

describe("Upgrade card icons", () => {
  it("draws a 12x12 icon for every upgrade", () => {
    for (const u of UPGRADES) {
      const rows = UPGRADE_ICONS[u.id];
      expect(rows, u.id).toBeDefined();
      expect(rows!.length).toBe(12);
      for (const row of rows!) expect(row).toMatch(/^[.Xogk]{12}$/);
    }
  });
});
