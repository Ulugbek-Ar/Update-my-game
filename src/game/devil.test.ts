import { beforeEach, describe, expect, it } from "vitest";
import { Game } from "./game";
import {
  Boss,
  EDGE_MAX,
  EDGE_WARN,
  FIRE_LIFE,
  MAX_IMPS,
  RUSH_TIME,
  RUSH_WINDUP,
  SPIRAL_SHOTS,
  impSummonCount,
} from "./boss";
import { PHASE_GUARD } from "./bossPower";
import { Enemy, IMP_WINDUP } from "./enemy";
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

/** Zarba hisoblaydigan o'yinchi (zarar yemaydi, joyida turadi). */
function dummy(x: number, y: number) {
  const p = new Player();
  p.x = x;
  p.y = y;
  const hits: number[] = [];
  p.takeHit = (dmg: number) => {
    hits.push(dmg);
    return true;
  };
  return { p: p as Target & Player, hits };
}

/** Boss shu fazada, daxlsizlik tugagan holda. */
function devilAt(phase: 2 | 3, p: Target) {
  const b = new Boss(1000);
  b.spawn = 0;
  b.hp = phase === 2 ? 500 : 250;
  b.update(0.01, p);
  for (let t = 0; t < PHASE_GUARD; t += 0.05) b.update(0.05, { ...p, x: b.x, y: b.y } as Target);
  return b;
}

describe("Iblis 1-faza", () => {
  it("keeps the old slam (2 hearts) and the fireball ring", () => {
    const { p, hits } = dummy(160, 100);
    const b = new Boss(1000);
    b.spawn = 0;
    b.x = 160;
    b.y = 80;
    b.slamTimer = 0;
    for (let t = 0; t < 1 && !b.shots.length; t += 0.02) b.update(0.02, p);
    expect(b.phase).toBe(1);
    expect(hits).toContain(2);
    expect(b.shots.length).toBe(8);
  });
});

describe("Iblis 2-faza: OLOV YO'LAGI", () => {
  it("warns with a locked line, then rushes and leaves a 3 s fire trail", () => {
    const { p, hits } = dummy(260, 200);
    const b = devilAt(2, p);
    b.x = 60;
    b.y = 60;
    b.slamTimer = 99;
    (b as unknown as { rushTimer: number }).rushTimer = 0;
    b.update(0.02, p);
    expect(b.rushWindup).toBeGreaterThan(0);
    const dir = { ...b.rushDir };
    // o'yinchi qochsa ham yo'nalish o'zgarmaydi
    p.x = 60;
    p.y = 200;
    for (let t = 0; t < RUSH_WINDUP; t += 0.02) b.update(0.02, p);
    expect(b.rushDir).toEqual(dir);
    expect(b.rushT).toBeGreaterThan(0);
    const x0 = b.x;
    for (let t = 0; t < RUSH_TIME / 2; t += 0.02) b.update(0.02, p);
    expect(b.x).toBeGreaterThan(x0 + 40);
    expect(b.fires.length).toBeGreaterThan(3);
    // olov izi kuydiradi
    const f = b.fires[0]!;
    p.x = f.x;
    p.y = f.y - 4;
    b.update(0.02, p);
    expect(hits).toContain(1);
    for (let t = 0; t < FIRE_LIFE + RUSH_TIME; t += 0.1)
      b.update(0.1, { ...p, x: 300, y: 30 } as Target);
    expect(b.fires.length).toBe(0);
  });

  it("the rush itself hits for 2 hearts", () => {
    const { p, hits } = dummy(140, 60);
    const b = devilAt(2, p);
    b.x = 60;
    b.y = 60;
    b.slamTimer = 99;
    (b as unknown as { rushTimer: number }).rushTimer = 0;
    for (let t = 0; t < RUSH_WINDUP + 0.8; t += 0.02) b.update(0.02, p);
    expect(hits).toContain(2);
  });

  it("summons up to 2 fire imps in the game", () => {
    expect([impSummonCount(0), impSummonCount(1), impSummonCount(2)]).toEqual([2, 1, 0]);
    const { g, gi } = makeGame();
    gi.startWave(BOSS_WAVE);
    g.skipIntro();
    g.enemies = [];
    const b = g.boss!;
    b.spawn = 0;
    g.player.takeHit = () => false;
    gi.damageTarget(b, b.maxHp * 0.45);
    tick(g, 1.2);
    expect(g.enemies.filter((e) => e.kind === "imp").length).toBe(MAX_IMPS);
    b.wantSummon = true;
    tick(g, 0.02);
    expect(g.enemies.filter((e) => e.kind === "imp").length).toBe(MAX_IMPS);
  });
});

describe("Olov imp", () => {
  it("glows before it shoots a fireball at the player", () => {
    const e = new Enemy("imp", 100, 100);
    e.spawn = 0;
    const { p } = dummy(180, 100);
    e.aiTimer = 0.01;
    e.update(0.02, p);
    expect(e.impWindup).toBeGreaterThan(0);
    expect(e.shots.length).toBe(0);
    for (let t = 0; t < IMP_WINDUP + 0.05; t += 0.02) e.update(0.02, p);
    expect(e.shots.length).toBe(1);
    expect(e.shots[0]!.vx).toBeGreaterThan(0);
    expect(e.hp).toBe(2);
  });

  it("its fireball is a fire shot in the game, not an arrow", () => {
    const { g, gi } = makeGame();
    gi.startWave(0);
    const e = new Enemy("imp", 100, 100);
    e.spawn = 0;
    e.shots.push({ x: 100, y: 100, vx: 50, vy: 0 });
    g.enemies = [e];
    tick(g, 0.02);
    expect(g.shots.some((s) => !s.arrow)).toBe(true);
  });
});

describe("Iblis 3-faza: yonayotgan arena", () => {
  it("edges burn after a warning, the safe area shrinks and comes back", () => {
    const { p, hits } = dummy(160, 120);
    const b = devilAt(3, p);
    b.slamTimer = 99;
    expect(b.edge.stage === "warn" || b.edge.stage === "grow").toBe(true);
    let maxM = 0,
      after = Infinity;
    for (let t = 0; t < 14; t += 0.05) {
      b.x = 160;
      b.y = 120;
      b.update(0.05, p);
      maxM = Math.max(maxM, b.edge.m);
      if (maxM >= EDGE_MAX - 0.01) after = Math.min(after, b.edge.m);
    }
    expect(maxM).toBeCloseTo(EDGE_MAX, 0);
    // so'ng chetlar o'chadi — maydon qaytadi
    expect(after).toBe(0);
    // o'rtada turgan o'yinchi kuymaydi
    expect(hits.filter((h) => h === 1).length).toBe(0);
  });

  it("standing at the wall when the edge burns hurts", () => {
    const { p, hits } = dummy(30, 120);
    const b = devilAt(3, p);
    b.slamTimer = 99;
    b.edge = { stage: "warn", t: EDGE_WARN, m: 0 };
    for (let t = 0; t < EDGE_WARN + 2; t += 0.05) b.update(0.05, p);
    expect(hits.length).toBeGreaterThan(0);
  });

  it("slams scatter fireballs in a spiral", () => {
    const { p } = dummy(160, 100);
    const b = devilAt(3, p);
    b.x = 160;
    b.y = 80;
    b.slamTimer = 0;
    (b as unknown as { rushTimer: number }).rushTimer = 99;
    let first = 0;
    for (let t = 0; t < 1 && !first; t += 0.02) {
      b.update(0.02, p);
      first = b.shots.length;
    }
    // birdaniga emas, ketma-ket chiqadi
    expect(first).toBeLessThan(SPIRAL_SHOTS);
    let total = first;
    for (let t = 0; t < 2; t += 0.02) {
      b.shots = [];
      b.update(0.02, p);
      total += b.shots.length;
    }
    expect(total).toBeGreaterThanOrEqual(SPIRAL_SHOTS);
  });
});
