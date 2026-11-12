import { beforeEach, describe, expect, it } from "vitest";
import { Game } from "./game";
import { Enemy } from "./enemy";
import { BOSS_WAVE } from "./waves";
import { HEROES, type Hero } from "./hero";
import { unlockHero } from "./save";
import { loadAchievements } from "./achievements";
import {
  ARTIFACTS,
  ARTIFACT_CHEST,
  COLLECTOR_AT,
  artifactPool,
  rollArtifact,
  type ArtifactId,
} from "./artifacts";
import { iconColorCount } from "./pixelIcon";

type GI = {
  startWave(i: number): void;
  damageTarget(t: unknown, d: number): void;
  strike(t: unknown, d: number): void;
};

beforeEach(() => localStorage.clear());

function game(hero: Hero = "knight", opts: { daily?: string } = {}) {
  unlockHero(hero);
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement, hero, opts);
  return { g, gi: g as unknown as GI };
}

function tick(g: Game, s: number, dt = 0.02) {
  for (let t = 0; t < s; t += dt) g.update(dt);
}

function killBoss(g: Game, gi: GI) {
  gi.startWave(BOSS_WAVE);
  g.enemies = [];
  g.boss!.spawn = 0;
  gi.damageTarget(g.boss, 9999);
}

describe("Artefaktlar ro'yxati", () => {
  it("12 shared + 1 per hero = 18, unique ids, code-drawn 9x9 icons within five colours", () => {
    expect(ARTIFACTS).toHaveLength(18);
    expect(ARTIFACTS.filter((a) => !a.hero)).toHaveLength(12);
    for (const h of HEROES) expect(ARTIFACTS.filter((a) => a.hero === h)).toHaveLength(1);
    expect(new Set(ARTIFACTS.map((a) => a.id)).size).toBe(18);
    for (const a of ARTIFACTS) {
      expect(a.icon).toHaveLength(9);
      for (const row of a.icon) expect(row).toHaveLength(9);
      expect(iconColorCount(a.icon)).toBeLessThanOrEqual(5);
      // kontur doim to'q
      expect(a.icon.join("")).toContain("k");
      expect(a.name).toBe(a.name.toUpperCase());
      expect(a.name.length).toBeLessThanOrEqual(16);
      expect(a.desc.length).toBeGreaterThan(10);
    }
  });

  it("each hero gets the 12 shared ones and only its own special one", () => {
    for (const h of HEROES) {
      const pool = artifactPool(h, []);
      expect(pool).toHaveLength(13);
      expect(pool.filter((a) => a.hero).map((a) => a.hero)).toEqual([h]);
    }
  });

  it("never repeats within a run, then runs out", () => {
    const owned: ArtifactId[] = [];
    for (let i = 0; i < 13; i++) {
      const a = rollArtifact("mage", owned, () => 0.5)!;
      expect(owned).not.toContain(a.id);
      owned.push(a.id);
    }
    expect(rollArtifact("mage", owned)).toBeNull();
  });
});

describe("Artefaktlar o'yinda", () => {
  it("a boss always drops one", () => {
    for (const hero of HEROES) {
      const { g, gi } = game(hero);
      killBoss(g, gi);
      expect(g.artifacts).toHaveLength(1);
      expect(artifactPool(hero, []).map((a) => a.id)).toContain(g.artifacts[0]);
    }
  });

  it("a chest drops one with 15% chance", () => {
    const { g } = game();
    g.spawnChest(100, 100);
    // tasodif: oltin, yurak, karta, artefakt — artefakt chegarasidan pastda
    let n = 0;
    expect(g.openChest(() => (n++ === 3 ? ARTIFACT_CHEST - 0.01 : 0.99))!.artifact).not.toBeNull();
    expect(g.artifacts).toHaveLength(1);
    g.spawnChest(100, 100);
    expect(g.openChest(() => 0.99)!.artifact).toBeNull();
    expect(g.artifacts).toHaveLength(1);
  });

  it("no artifacts in the daily challenge", () => {
    const { g, gi } = game("knight", { daily: "2026-11-06" });
    killBoss(g, gi);
    expect(g.artifacts).toHaveLength(0);
  });

  it("kept for the whole run (next world), lost on death and on restart", () => {
    const { g, gi } = game();
    killBoss(g, gi);
    tick(g, 2.5);
    expect(g.phase).toBe("victory");
    const got = [...g.artifacts];
    g.startChapter(2);
    expect(g.artifacts).toEqual(got);
    // 2-dunyoda o'lim: dunyo boshidan, artefaktlarsiz
    g.player.ward = 0;
    g.player.invuln = 0;
    g.player.hp = 1;
    g.artifacts = g.artifacts.filter((a) => a !== "lastbreath");
    g.player.takeHit(1, g.player.x + 5, g.player.y, 0);
    tick(g, 1.5);
    expect(g.phase).toBe("attempt");
    g.retryChapter();
    expect(g.artifacts).toEqual([]);
    killBoss(g, gi);
    expect(g.artifacts).toHaveLength(1);
    g.restart();
    expect(g.artifacts).toEqual([]);
  });

  it("KOLLEKTSIONER after 5 artifacts in one run", () => {
    const { g } = game();
    for (let i = 0; i < COLLECTOR_AT - 1; i++) g.gainArtifact(100, 100);
    expect(loadAchievements().has("collector")).toBe(false);
    g.gainArtifact(100, 100);
    expect(g.artifacts).toHaveLength(COLLECTOR_AT);
    expect(loadAchievements().has("collector")).toBe(true);
  });

  it("SEHRLI KALIT opens a chest with one hit and always gives a heart", () => {
    const { g } = game();
    g.artifacts = ["key"];
    g.spawnChest(100, 100);
    g.hitChest();
    expect(g.chest!.openT).toBeGreaterThanOrEqual(0);
    expect(g.drops.length).toBeGreaterThan(0);
  });

  it("O'NINCHI ZARB: every 10th hit deals double damage", () => {
    const { g, gi } = game();
    g.artifacts = ["tenth"];
    const e = new Enemy("golem", 100, 100);
    e.spawn = 0;
    e.hp = e.maxHp = 100;
    g.enemies = [e];
    for (let i = 0; i < 10; i++) gi.strike(e, 1);
    expect(e.hp).toBe(100 - 11);
  });

  it("SO'NGGI NAFAS: at 1 heart — 3 s of invulnerability, once per run", () => {
    const { g } = game();
    g.artifacts = ["lastbreath"];
    const p = g.player;
    // o'yinchiga tegib turgan dushman
    const e = new Enemy("blob", p.x, p.y);
    e.spawn = 0;
    g.enemies = [e];
    p.hp = 2;
    g.update(0.02);
    expect(p.hp).toBe(1);
    expect(p.invuln).toBeGreaterThan(2.5);
    tick(g, 2.5);
    expect(p.hp).toBe(1);
    // ikkinchi marta ishlamaydi
    p.hp = 2;
    p.invuln = 0;
    e.x = p.x;
    e.y = p.y;
    g.update(0.02);
    expect(p.hp).toBe(1);
    expect(p.invuln).toBeLessThan(1);
  });
});
