import { beforeEach, describe, expect, it } from "vitest";
import { Game } from "./game";
import {
  DARK_EXTRA,
  FLOWER_COUNT,
  FLOWER_GROW,
  FLOWER_HEAL,
  ForestKing,
  KING_ROOT_WARN,
  THORN_GAP,
  THORN_WARN,
  flowerHp,
} from "./boss";
import { PHASE_GUARD, PHASE2_AT } from "./bossPower";
import { Player, type Target } from "./player";
import { BOSS_WAVE } from "./waves";

type GI = { startWave(i: number): void; damageTarget(t: unknown, dmg: number): void };

function makeGame() {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement);
  return { g, gi: g as unknown as GI };
}

function tick(g: Game, seconds: number, dt = 0.02) {
  for (let t = 0; t < seconds; t += dt) g.update(dt);
}

beforeEach(() => localStorage.clear());

function kingFight(phase: 2 | 3) {
  const { g, gi } = makeGame();
  g.chapter = 3;
  gi.startWave(BOSS_WAVE);
  g.skipIntro();
  g.enemies = [];
  const k = g.boss as ForestKing;
  expect(k).toBeInstanceOf(ForestKing);
  k.spawn = 0;
  g.player.takeHit = () => false;
  gi.damageTarget(k, k.maxHp * 0.45);
  tick(g, 0.04);
  if (phase === 3) {
    tick(g, PHASE_GUARD);
    gi.damageTarget(k, k.maxHp * 0.35);
    tick(g, 0.04);
  }
  return { g, gi, k };
}

describe("O'rmon Shohi 2-faza: hayot gullari", () => {
  it("3 flowers grow and heal the King while they live, never past the phase line", () => {
    const { g, gi, k } = kingFight(2);
    expect(k.phase).toBe(2);
    expect(k.flowers.length).toBe(FLOWER_COUNT);
    expect(k.flowers[0]!.maxHp).toBe(flowerHp(k.maxHp));
    tick(g, PHASE_GUARD + FLOWER_GROW);
    g.enemies = [];
    gi.damageTarget(k, k.maxHp * 0.1);
    const hp = k.hp;
    tick(g, 1);
    // 3 gul: har soniyada ~1.2% (o'rgimchaklar zarari yo'q — o'yinchi tegmaydi)
    expect(k.hp - hp).toBeGreaterThan(k.maxHp * FLOWER_HEAL * 3 * 0.9);
    tick(g, 30);
    expect(k.hp).toBeLessThanOrEqual(k.maxHp * PHASE2_AT);
    expect(k.phase).toBe(2);
  });

  it("flowers take damage and wilt — then the healing stops", () => {
    const { g, gi, k } = kingFight(2);
    tick(g, PHASE_GUARD + FLOWER_GROW);
    g.enemies = [];
    for (const f of [...k.flowers]) {
      g.bolts = [{ x: f.x - 12, y: f.y, vx: 240, vy: 0, size: 6, left: 1, hit: [] }];
      for (let i = 0; i < 40 && f.hp > 0; i++) {
        if (!g.bolts.length)
          g.bolts = [{ x: f.x - 12, y: f.y, vx: 240, vy: 0, size: 6, left: 1, hit: [] }];
        tick(g, 0.04);
      }
      expect(f.hp).toBeLessThanOrEqual(0);
    }
    tick(g, 0.04);
    expect(k.flowers.length).toBe(0);
    gi.damageTarget(k, k.maxHp * 0.1);
    const hp = k.hp;
    tick(g, 2);
    expect(k.hp).toBe(hp);
  });

  it("a thorn wall splits the arena after a warning; touching it hurts, dashing passes", () => {
    const k = new ForestKing(1000);
    k.spawn = 0;
    k.hp = 500;
    const p = new Player();
    p.x = 160;
    p.y = 60;
    let hits = 0;
    p.takeHit = (d, x, y, f) => {
      if (p.evading) return false;
      hits++;
      return Player.prototype.takeHit.call(p, d, x, y, f) || true;
    };
    k.update(0.01, p as Target);
    for (let t = 0; t < PHASE_GUARD; t += 0.05)
      k.update(0.05, { ...p, x: 300, evading: false } as unknown as Target);
    k.thorns = [];
    (k as unknown as { thornTimer: number }).thornTimer = 0;
    p.x = 160;
    k.update(0.02, p as Target);
    expect(k.thorns.length).toBe(1);
    const t = k.thorns[0]!;
    expect(t.vertical).toBe(true);
    expect(t.at).toBe(160);
    // ogohlantirish paytida zarar yo'q
    expect(hits).toBe(0);
    p.y = t.gap > 100 ? 40 : 200;
    for (let s = 0; s < THORN_WARN + 0.1; s += 0.02) k.update(0.02, p as Target);
    expect(hits).toBe(1);
    // itarildi — devor tashqarisida
    expect(Math.abs(p.x - t.at)).toBeGreaterThan(8);
    // o'tish joyidan zararsiz o'tadi
    p.invuln = 0;
    p.x = t.at;
    p.y = t.gap + THORN_GAP / 2;
    k.update(0.02, p as Target);
    expect(hits).toBe(1);
  });
});

describe("O'rmon Shohi 3-faza: zulmat", () => {
  it("the room goes fully dark; roots get a longer warning", () => {
    const { g, k } = kingFight(3);
    expect(k.phase).toBe(3);
    expect(k.dark).toBe(true);
    tick(g, 1.2);
    expect(g.darkness).toBe(1);
    k.roots = [];
    (k as unknown as { castTimer: number }).castTimer = 0;
    g.player.x = k.x + 80;
    g.player.y = k.y;
    tick(g, 0.04);
    expect(k.roots.length).toBeGreaterThan(0);
    expect(k.roots[0]!.warn).toBeGreaterThan(KING_ROOT_WARN + DARK_EXTRA - 0.1);
  });

  it("regrows wilted flowers (2) and divides the arena with a thorn cross", () => {
    const { g, k } = kingFight(3);
    expect(k.flowers.filter((f) => f.hp > 0).length).toBeGreaterThanOrEqual(2);
    k.thorns = [];
    (k as unknown as { thornTimer: number }).thornTimer = 0;
    tick(g, 0.04);
    expect(k.thorns.map((t) => t.vertical).sort()).toEqual([false, true]);
  });
});
