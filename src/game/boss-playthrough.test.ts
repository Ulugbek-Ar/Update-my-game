import { beforeEach, describe, expect, it } from "vitest";
import { Game } from "./game";
import { ForestKing, Queen } from "./boss";
import { BOSS_WAVE } from "./waves";
import type { Hero } from "./hero";
import type { World } from "./waves";

type GI = { startWave(i: number): void };

beforeEach(() => localStorage.clear());

/**
 * Bot bilan to'liq boss jangi: o'yinchi zarar olmaydi (faqat jang uzunligi va hamma fazalar
 * ishlashi tekshiriladi). Bot nishonga (gul bo'lsa — avval gulga) bir o'qda turib uradi.
 */
function playBoss(hero: Hero, world: World) {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement, hero);
  g.chapter = world;
  (g as unknown as GI).startWave(BOSS_WAVE);
  const p = g.player;
  p.takeHit = () => false;
  p.encase = () => false;
  const b = g.boss!;
  const phases = new Set<number>();
  const dt = 1 / 50;
  let t = 0;
  for (; t < 400 && !b.dead; t += dt) {
    g.enemies = g.enemies.filter((e) => e.kind !== "spider" && e.kind !== "frost");
    const flower = b instanceof ForestKing ? b.flowers.find((f) => f.hp > 0) : undefined;
    const tgt = flower ?? b;
    const range = p.ranged ? 50 : flower ? 12 : 22;
    // nishon bilan bir gorizontal chiziqda, chap tomonda turish
    const want = { x: Math.max(30, tgt.x - range), y: tgt.y };
    const dx = want.x - p.x,
      dy = want.y - p.y;
    const near = Math.abs(dx) < 4 && Math.abs(dy) < 3;
    g.input.setTouchAxis(
      near ? 0 : Math.sign(dx) * Math.min(1, Math.abs(dx) / 4),
      near ? 0 : Math.sign(dy) * Math.min(1, Math.abs(dy) / 4),
    );
    if (near) {
      p.fx = tgt.x >= p.x ? 1 : -1;
      p.fy = 0;
      g.input.pressAttack();
    }
    g.update(dt);
    phases.add(b.phase);
    if (b instanceof Queen)
      expect(b.mirrors.length).toBe(b.phase === 3 && !b.dead ? 2 : b.mirrors.length);
  }
  return { t, dead: b.dead, phases, maxHp: b.maxHp };
}

describe("Har qahramon bilan har boss (bot jangi)", () => {
  for (const hero of ["knight", "mage", "hunter", "gunner"] as Hero[])
    for (const world of [1, 2, 3] as World[])
      it(`${hero} vs ${world === 1 ? "Iblis" : world === 2 ? "Qor Malikasi" : "O'rmon Shohi"}`, () => {
        const r = playBoss(hero, world);
        expect(r.dead).toBe(true);
        expect([...r.phases].sort()).toEqual([1, 2, 3]);
        // bot ideal emas (yuradi, faza daxlsizligi, gullar) — lekin 60 s dan tez emas
        expect(r.t).toBeGreaterThan(60);
        expect(r.t).toBeLessThan(160);
      });
});
