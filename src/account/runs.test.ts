import { beforeEach, describe, expect, it } from "vitest";
import { Game, type RunResult } from "@/game/game";
import { BOSS_WAVE } from "@/game/waves";
import { judgeRun } from "./scoring";

type Internals = { startWave(i: number): void; damageTarget(t: unknown, dmg: number): void };

function makeGame(opts: { daily?: string } = {}) {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement, "knight", opts);
  const runs: RunResult[] = [];
  g.onRunEnd = (r) => runs.push(r);
  return { g, gi: g as unknown as Internals, runs };
}
const tick = (g: Game, s: number) => {
  for (let t = 0; t < s; t += 0.02) g.update(0.02);
};
function die(g: Game) {
  g.player.hp = 0;
  g.player.anim.set("death", true);
  g.player.anim.done = true;
  tick(g, 0.1);
}

beforeEach(() => localStorage.clear());

describe("run results for the leaderboard", () => {
  it("a world-1 death reports the world-1 score", () => {
    const { g, gi, runs } = makeGame();
    gi.startWave(2);
    g.score = 640;
    g.stats.time = 95;
    die(g);
    expect(runs).toEqual([
      {
        mode: "world",
        hero: "knight",
        score: 640,
        wave: 3,
        time: expect.closeTo(95, 0) as number,
        won: false,
        date: null,
      },
    ]);
    expect(judgeRun(runs[0]!)).toBe("ok");
  });

  it("a won world 1 reports once with won = true", () => {
    const { g, gi, runs } = makeGame();
    gi.startWave(BOSS_WAVE);
    g.enemies = [];
    g.boss!.spawn = 0;
    g.stats.time = 170;
    gi.damageTarget(g.boss, 99999);
    tick(g, 6);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ mode: "world", wave: 5, won: true });
  });

  it("the daily challenge reports with its date (also when leaving mid-run)", () => {
    const { g, runs } = makeGame({ daily: "2026-11-04" });
    g.score = 120;
    g.exitToMenu();
    expect(runs).toEqual([
      expect.objectContaining({ mode: "daily", date: "2026-11-04", score: 120, won: false }),
    ]);
  });

  it("leaving a normal run does not submit (as with the record)", () => {
    const { g, runs } = makeGame();
    g.score = 500;
    g.exitToMenu();
    expect(runs).toEqual([]);
  });
});
