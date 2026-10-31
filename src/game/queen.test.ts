import { beforeEach, describe, expect, it } from "vitest";
import { Game } from "./game";
import { BEAM_WARN, ENCASE_TAPS, ICE_WARN, MIRROR_COUNT, MIRROR_SWAP, Queen } from "./boss";
import { PHASE_GUARD } from "./bossPower";
import { ENCASE_MAX, Player, type Target } from "./player";
import { BOSS_WAVE } from "./waves";
import { ROOM } from "./animation";

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

/** 2-dunyo Boss xonasi: Malika shu fazada, daxlsizlik tugagan, xonada boshqa mob yo'q. */
function queenFight(phase: 1 | 2 | 3) {
  const { g, gi } = makeGame();
  g.chapter = 2;
  gi.startWave(BOSS_WAVE);
  g.skipIntro();
  g.enemies = [];
  const q = g.boss as Queen;
  expect(q).toBeInstanceOf(Queen);
  q.spawn = 0;
  if (phase > 1) q.hp = q.maxHp * (phase === 2 ? 0.5 : 0.25);
  tick(g, PHASE_GUARD + 0.1);
  g.enemies = [];
  return { g, gi, q };
}

describe("Qor Malikasi 2-faza: MUZ POL", () => {
  it("freezes floor patches after a crack warning, one under the player", () => {
    const { g, q } = queenFight(2);
    g.player.takeHit = () => false;
    q.ice = [];
    (q as unknown as { iceTimer: number }).iceTimer = 0;
    tick(g, 0.04);
    expect(q.ice.length).toBe(3);
    const p = g.player;
    // ogohlantirish paytida hali sirpanchiq emas
    expect(q.onIce(p.x, p.y + 4)).toBe(false);
    tick(g, ICE_WARN);
    expect(q.ice.some((b) => p.x > b.x && p.x < b.x + b.w)).toBe(true);
  });

  it("on ice the player slides on and hardly stops", () => {
    const { g, q } = queenFight(2);
    const p = g.player;
    p.takeHit = () => false;
    q.update = () => {};
    p.x = 100;
    p.y = 120;
    q.ice = [{ x: 30, y: 60, w: 260, h: 120, warn: 0, life: 99 }];
    // o'ngga yuguradi, so'ng tugmani qo'yib yuboradi
    g.input.setTouchAxis(1, 0);
    tick(g, 1);
    g.input.setTouchAxis(0, 0);
    const x0 = p.x;
    tick(g, 0.3);
    expect(p.x - x0).toBeGreaterThan(8);
    // muzsiz polda darhol to'xtaydi
    q.ice = [];
    tick(g, 0.1);
    const x1 = p.x;
    tick(g, 0.3);
    expect(p.x).toBeCloseTo(x1, 5);
  });
});

describe("Qor Malikasi 2-faza: MUZ QAMOQ", () => {
  it("the beam warns along a locked line, then encases the player", () => {
    const q = new Queen(1000);
    q.spawn = 0;
    q.x = 80;
    q.y = 120;
    const p = new Player();
    p.x = 220;
    p.y = 120;
    p.takeHit = () => true;
    q.hp = 500;
    q.update(0.01, p as Target);
    for (let t = 0; t < PHASE_GUARD; t += 0.05) q.update(0.05, p as Target);
    (q as unknown as { castN: number; castTimer: number }).castN = 2;
    (q as unknown as { castTimer: number }).castTimer = 0;
    q.update(0.02, p as Target);
    expect(q.beam).not.toBeNull();
    expect(q.beam!.warn).toBeGreaterThan(0);
    for (let t = 0; t < BEAM_WARN + 0.05; t += 0.02) q.update(0.02, p as Target);
    expect(p.encased).toBe(true);
    expect(p.ice).toBe(ENCASE_TAPS);
  });

  it("stepping out of the line (or dashing) avoids the beam", () => {
    const q = new Queen(1000);
    q.spawn = 0;
    q.x = 80;
    q.y = 120;
    const p = new Player();
    p.x = 220;
    p.y = 120;
    q.beam = { x: 80, y: 120, dx: 1, dy: 0, warn: 0.02, show: 0 };
    p.y = 160;
    q.update(0.05, p as Target);
    expect(p.encased).toBe(false);
    const p2 = new Player();
    p2.x = 220;
    p2.y = 120;
    p2.dashTimer = 0.1;
    q.beam = { x: 80, y: 120, dx: 1, dy: 0, warn: 0.02, show: 0 };
    q.update(0.05, p2 as Target);
    expect(p2.encased).toBe(false);
  });

  it("mashing attack/dash breaks the ice — on the phone too; it melts by itself", () => {
    const { g } = queenFight(2);
    const p = g.player;
    p.takeHit = () => false;
    (g.boss as Queen).update = () => {};
    p.encase(ENCASE_TAPS);
    const x0 = p.x;
    g.input.setTouchAxis(1, 0);
    tick(g, 0.3);
    // qotgan: yurolmaydi
    expect(p.x).toBe(x0);
    for (let i = 0; i < ENCASE_TAPS / 2; i++) {
      // telefondagi ZARBA va SAKRASH tugmalari
      g.input.pressAttack();
      tick(g, 0.02);
      g.input.pressDash();
      tick(g, 0.02);
    }
    expect(p.encased).toBe(false);
    tick(g, 0.3);
    expect(p.x).toBeGreaterThan(x0);
    // bosmasa ham ENCASE_MAX dan keyin eriydi
    p.encase(ENCASE_TAPS);
    tick(g, ENCASE_MAX + 0.1);
    expect(p.encased).toBe(false);
  });
});

describe("Qor Malikasi 3-faza: ko'zgu nusxalari", () => {
  it("makes 2 mirror copies around the room", () => {
    const { q } = queenFight(3);
    expect(q.phase).toBe(3);
    expect(q.mirrors.length).toBe(MIRROR_COUNT);
    for (const m of q.mirrors) {
      expect(Math.hypot(m.x - q.x, m.y - q.y)).toBeGreaterThan(40);
      expect(m.x).toBeGreaterThan(ROOM.wall);
      expect(m.x).toBeLessThan(ROOM.w - ROOM.wall);
    }
  });

  it("mirrors never take damage: bolts and sword hits are absorbed", () => {
    const { g, q } = queenFight(3);
    const p = g.player;
    p.takeHit = () => false;
    q.update = () => {};
    const m = q.mirrors[0]!;
    const hp = q.hp;
    // sehrli shar ko'zguga tegadi va yo'qoladi
    g.bolts = [{ x: m.x - 10, y: m.y, vx: 200, vy: 0, size: 6, left: 1, hit: [] }];
    tick(g, 0.1);
    expect(g.bolts.length).toBe(0);
    expect(q.hp).toBe(hp);
    expect(q.mirrors.length).toBe(MIRROR_COUNT);
    // qilich bilan ham
    p.x = m.x - 14;
    p.y = m.y;
    p.fx = 1;
    p.fy = 0;
    g.input.pressAttack();
    tick(g, 0.1);
    expect(q.hp).toBe(hp);
    // haqiqiysi esa zarar oladi
    g.bolts = [{ x: q.x - 10, y: q.y, vx: 200, vy: 0, size: 6, left: 1, hit: [] }];
    tick(g, 0.1);
    expect(q.hp).toBeLessThan(hp);
  });

  it("the real queen swaps places with a mirror (warned by a flash)", () => {
    const { q } = queenFight(3);
    const p = new Player();
    p.x = 160;
    p.y = 200;
    p.takeHit = () => false;
    q.swapT = 0.7;
    const before = { x: q.x, y: q.y };
    let warned = false;
    for (let t = 0; t < 0.8; t += 0.02) {
      q.update(0.02, p as Target);
      warned ||= q.justWarned;
      q.justWarned = false;
    }
    expect(warned).toBe(true);
    expect(Math.hypot(q.x - before.x, q.y - before.y)).toBeGreaterThan(40);
    expect(q.swapT).toBeGreaterThan(MIRROR_SWAP - 0.2);
  });
});
