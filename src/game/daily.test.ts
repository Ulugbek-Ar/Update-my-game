import { beforeEach, describe, expect, it } from "vitest";
import { DAILY_KEY, loadDaily, seedFrom, seededRandom, todayKey } from "./daily";
import { Game, BEST_KEY } from "./game";
import { BOSS_WAVE } from "./waves";

beforeEach(() => localStorage.clear());

type GI = { startWave(i: number): void; damageTarget(t: unknown, d: number): void };

function makeGame(daily?: string, hero: "knight" | "mage" = "knight") {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement, hero, daily ? { daily } : {});
  return { g, gi: g as unknown as GI };
}

/** To'lqinni tozalab, kartalar ekranigacha olib boradi. */
function clear(g: Game) {
  g.enemies = [];
  g.update(0.02);
}

const spawns = (g: Game) => g.enemies.map((e) => [Math.round(e.x), Math.round(e.y), e.kind]);

describe("Seed", () => {
  it("formats the local date and is deterministic per seed", () => {
    expect(todayKey(new Date(2026, 9, 7))).toBe("2026-10-07");
    const a = seededRandom(seedFrom("2026-10-27"));
    const b = seededRandom(seedFrom("2026-10-27"));
    const c = seededRandom(seedFrom("2026-10-28"));
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    expect([c(), c(), c()]).not.toEqual(xs);
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true);
  });
});

describe("Kunlik sinov", () => {
  it("the same date gives the same waves and the same card choices", () => {
    const runs = [makeGame("2026-10-27").g, makeGame("2026-10-27").g];
    expect(spawns(runs[1]!)).toEqual(spawns(runs[0]!));
    for (let w = 0; w < 3; w++) {
      for (const g of runs) clear(g);
      expect(runs[1]!.choices.map((u) => u.id)).toEqual(runs[0]!.choices.map((u) => u.id));
      for (const g of runs) g.update(0.7); // kartalar qulfi
      for (const g of runs) {
        g.input.pressAttack();
        g.update(0.02);
      }
      expect(runs[1]!.wave).toBe(w + 1);
      expect(spawns(runs[1]!)).toEqual(spawns(runs[0]!));
    }
  });

  it("another date gives different spawn points", () => {
    expect(spawns(makeGame("2026-10-28").g)).not.toEqual(spawns(makeGame("2026-10-27").g));
  });

  it("the single attempt is used as soon as it starts", () => {
    expect(loadDaily("2026-10-27")).toBeNull();
    makeGame("2026-10-27");
    expect(loadDaily("2026-10-27")).toMatchObject({ score: 0, wave: 1, won: false });
    expect(loadDaily("2026-10-28")).toBeNull();
  });

  it("dying ends the daily run: result saved, back to menu, no attempt or normal record", () => {
    const { g } = makeGame("2026-10-27");
    let exited = false;
    g.onExit = () => (exited = true);
    g.score = 420;
    g.player.takeHit(99, g.player.x + 5, g.player.y, 0);
    for (let i = 0; i < 200 && g.phase !== "attempt"; i++) g.update(0.02);
    expect(g.phase).toBe("attempt");
    expect(loadDaily("2026-10-27")).toMatchObject({ score: 420, wave: 1, won: false });
    expect(localStorage.getItem(BEST_KEY)).toBeNull();
    expect(localStorage.getItem("pixel-rpg-attempt")).toBeNull();
    for (let i = 0; i < 200 && !exited; i++) g.update(0.02);
    expect(exited).toBe(true);
  });

  it("winning the daily saves won=true and Enter goes back to the menu (no endless)", () => {
    const { g, gi } = makeGame("2026-10-27", "mage");
    let exited = false;
    g.onExit = () => (exited = true);
    gi.startWave(BOSS_WAVE);
    g.enemies = [];
    g.boss!.spawn = 0;
    gi.damageTarget(g.boss, 999);
    for (let i = 0; i < 100 && g.phase !== "victory"; i++) g.update(0.02);
    expect(g.phase).toBe("victory");
    expect(loadDaily("2026-10-27")).toMatchObject({ won: true, hero: "mage", wave: 5 });
    expect(JSON.parse(localStorage.getItem(DAILY_KEY)!).score).toBe(g.score);
    (g.input as unknown as { enterQueued: boolean }).enterQueued = true;
    g.update(0.02);
    expect(exited).toBe(true);
    expect(g.endless).toBe(false);
  });
});
