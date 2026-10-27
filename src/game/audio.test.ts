import { afterEach, describe, expect, it } from "vitest";
import { TRACKS, sfx } from "./audio";

afterEach(() => sfx.stopMusic());

describe("Fon musiqasi", () => {
  it("each track is a full loop with matching lead and bass", () => {
    for (const t of Object.values(TRACKS)) {
      expect(t.lead.length).toBe(32);
      expect(t.bass.length).toBe(t.lead.length);
    }
  });

  it("boss track is faster and lower than the normal one", () => {
    const avg = (a: (number | null)[]) => {
      const n = a.filter((x): x is number => x !== null);
      return n.reduce((s, x) => s + x, 0) / n.length;
    };
    expect(TRACKS.boss.step).toBeLessThan(TRACKS.normal.step);
    expect(avg(TRACKS.boss.lead)).toBeLessThan(avg(TRACKS.normal.lead));
  });

  it("playMusic switches tracks and stopMusic clears it", () => {
    sfx.playMusic("normal");
    expect(sfx.music).toBe("normal");
    sfx.playMusic("boss");
    expect(sfx.music).toBe("boss");
    sfx.stopMusic();
    expect(sfx.music).toBeNull();
  });
});
