import { describe, expect, it } from "vitest";
import { GAME_VERSION } from "@/game/version";

// android/app/build.gradle versiyani shu fayldan oladi: major*10000 + minor*100 + patch
describe("Android versiyasi", () => {
  it("GAME_VERSION versionCode uchun yaroqli (x.y.z, y va z 0..99)", () => {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(GAME_VERSION);
    expect(m).not.toBeNull();
    const [major, minor, patch] = m!.slice(1).map(Number) as [number, number, number];
    expect(minor).toBeLessThan(100);
    expect(patch).toBeLessThan(100);
    expect(major * 10000 + minor * 100 + patch).toBeGreaterThan(0);
  });
});
