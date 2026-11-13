import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WORLD_KINDS, type World } from "./waves";

interface Step {
  eval?: string;
  spawn?: { kind: string };
  click?: string;
}

const DIR = path.resolve(__dirname, "../../screenshots");

/** Sahna dunyosi: startChapter2/3/4 (yoki chapter = n, startWorld = n) bo'lmasa — 1-dunyo */
function worldOf(steps: Step[]): World {
  const ev = steps.map((s) => s.eval ?? "").join(" ");
  if (/startChapter\(4\)|chapter = 4|startWorld = 4/.test(ev)) return 4;
  if (/startChapter3\(|startChapter\(3\)|chapter = 3/.test(ev)) return 3;
  if (/startChapter2\(|startChapter\(2\)|chapter = 2/.test(ev)) return 2;
  return 1;
}

describe("Skrinshot ssenariylari", () => {
  it("spawn only the mobs of the scene's world (no snowman in world 1)", () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      const scenes = JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as {
        title: string;
        steps: Step[];
      }[];
      for (const sc of scenes) {
        const w = worldOf(sc.steps);
        // Iblis chaqiradigan imp — 1-dunyo bossining yordamchisi
        const allowed = [...WORLD_KINDS[w], ...(w === 1 ? ["imp"] : [])];
        for (const s of sc.steps)
          if (s.spawn) expect(allowed, `${f}: ${sc.title}`).toContain(s.spawn.kind);
      }
    }
  });
});
