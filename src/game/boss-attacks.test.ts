import { describe, expect, it } from "vitest";
import { Oni, ONI_THROW_TIME, ONI_THROW_WINDUP, clubPoint } from "./oni";
import {
  Boss,
  PILLAR_WARN,
  CLONE_WARN,
  ForestKing,
  GRID_LANE,
  GRID_WARN,
  GRID_WARN_FAST,
  GUARD_SHIELD,
  Queen,
  RING_CLOSE,
  RING_WARN,
} from "./boss";
import type { Target } from "./player";

/** Zarba olishni yozib boradigan soxta o'yinchi */
function dummy(x: number, y: number) {
  const hits: number[] = [];
  const p = {
    x,
    y,
    size: 12,
    evading: false,
    takeHit: (n: number) => (hits.push(n), true),
    encase: () => false,
    ensnare: () => {},
  };
  return { p: p as unknown as Target & { x: number; y: number }, hits };
}

/** Bossni jang holatiga keltirish (kirish sahnasisiz, kerakli fazada) */
function ready<
  T extends { spawn: number; hp: number; maxHp: number; update(dt: number, p: Target): void },
>(b: T, share: number, p: Target) {
  b.spawn = 0;
  b.hp = b.maxHp * share;
  b.update(1 / 60, p);
  return b;
}

const run = (b: { update(dt: number, p: Target): void }, p: Target, s: number) => {
  for (let t = 0; t < s; t += 1 / 60) b.update(1 / 60, p);
};

describe("Qor Malikasi: muz nusxalari va muz halqa", () => {
  it("2-fazada ogohlantirishdan keyin 2 ta nusxa chiqadi; nusxa urilsa sinadi, zarar yo'q", () => {
    const { p } = dummy(60, 200);
    const q = ready(new Queen(100), 0.5, p);
    expect(q.phase).toBe(2);
    run(q, p, 3.2);
    expect(q.cloneSpots.length).toBe(3);
    expect(q.cloneWarn).toBeGreaterThanOrEqual(0.6 - 0.05);
    expect(CLONE_WARN).toBeGreaterThanOrEqual(0.6);
    run(q, p, CLONE_WARN + 0.05);
    expect(q.clones.length).toBe(2);
    const hp = q.hp;
    const c = q.clones[0]!;
    expect(q.strikePart(c)).toBe(false);
    expect(q.clones.length).toBe(1);
    expect(q.hp).toBe(hp);
  });

  it("muz halqa: ogohlantirish, so'ng torayadi — tashqarida qolgan o'yinchi zarar oladi", () => {
    const { p, hits } = dummy(160, 120);
    const q = ready(new Queen(100), 0.5, p);
    expect(RING_WARN).toBeGreaterThanOrEqual(0.6);
    run(q, p, 9.1);
    const r = q.iceRing!;
    expect(r.stage).toBe("warn");
    // o'yinchini doiradan uzoq chetga olib chiqamiz
    p.x = r.x > 160 ? 24 : 296;
    p.y = 24;
    const before = hits.length;
    run(q, p, RING_WARN + RING_CLOSE);
    expect(hits.length).toBeGreaterThan(before);
  });

  it("xavfsiz doira ichida turgan o'yinchiga halqa tegmaydi", () => {
    const { p, hits } = dummy(160, 120);
    const q = ready(new Queen(100), 0.5, p);
    run(q, p, 9.1);
    const r = q.iceRing!;
    q.spikes = [];
    const n = hits.length;
    // nayzalar ham tegishi mumkin — faqat halqani tekshirish uchun nayzalarni o'chirib turamiz
    for (let t = 0; t < RING_WARN + RING_CLOSE; t += 1 / 60) {
      p.x = r.x;
      p.y = r.y;
      q.spikes = [];
      q.beam = null;
      q.update(1 / 60, p);
    }
    expect(hits.length).toBe(n);
  });
});

describe("O'rmon Shohi: ildiz panjarasi va daraxt qo'riqchilar", () => {
  it("panjara: yoriqlar kamida 0.6 s oldin, yo'lakdan tashqarida zarar, yo'lak ichida xavfsiz", () => {
    expect(GRID_WARN_FAST).toBeGreaterThanOrEqual(0.6);
    for (const inside of [false, true]) {
      const { p, hits } = dummy(160, 120);
      const k = ready(new ForestKing(100), 0.9, p);
      for (let t = 0; t < 10 && !k.grid; t += 1 / 60) k.update(1 / 60, p);
      const g = k.grid!;
      expect(g.warn).toBeGreaterThanOrEqual(0.6);
      const lane = g.lanes[0]!;
      // yo'lak o'yinchi yonida — ogohlantirish ichida yetib boriladi
      expect(Math.abs((lane.vertical ? p.x : p.y) - lane.at)).toBeLessThan(80);
      const off = inside ? 0 : GRID_LANE;
      const n = hits.length;
      for (let t = 0; t < GRID_WARN + 0.1; t += 1 / 60) {
        k.roots = [];
        k.thorns = [];
        if (lane.vertical) p.x = lane.at + off;
        else p.y = lane.at + off;
        if (!inside && g.lanes[1]) p.y = g.lanes[1].at + GRID_LANE;
        k.update(1 / 60, p);
      }
      if (inside) expect(hits.length).toBe(n);
      else expect(hits.length).toBeGreaterThan(n);
    }
  });

  it("2-fazada 2 ta qo'riqchi: tirik ekan Shoh zarari 70% kam, yiqilgach to'liq", () => {
    const { p } = dummy(160, 200);
    const k = ready(new ForestKing(1000), 0.59, p);
    expect(k.phase).toBe(2);
    expect(k.guards.length).toBe(2);
    expect(k.shielded).toBe(true);
    k.guard = 0;
    let hp = k.hp;
    k.takeDamage(10);
    expect(hp - k.hp).toBeCloseTo(10 * (1 - GUARD_SHIELD));
    for (const g of [...k.guards]) k.strikePart(g, 999);
    k.update(1 / 60, p);
    expect(k.guards.length).toBe(0);
    expect(k.shielded).toBe(false);
    hp = k.hp;
    k.takeDamage(10);
    expect(hp - k.hp).toBeCloseTo(10);
  });
});

describe("Oni: kanabo bumerangi", () => {
  it("otishdan oldin yo'l ko'rinadi, kaltak borishda ham, qaytishda ham uradi", () => {
    expect(ONI_THROW_WINDUP * 0.8).toBeGreaterThanOrEqual(0.6);
    const { p, hits } = dummy(240, 74);
    const o = new Oni(100);
    o.spawn = 0;
    o.turn = 2; // 1-fazada navbat: urish, supurish, OTISH
    o.cd = 0;
    o.update(1 / 60, p);
    expect(o.attack?.kind).toBe("throw");
    expect(o.attack!.t).toBeGreaterThanOrEqual(0.6);
    for (let t = 0; t < 2 && !o.club; t += 1 / 60) o.update(1 / 60, p);
    const c = o.club!;
    expect(c).toBeTruthy();
    // yo'l yopiq: boshida va oxirida Oni qo'lida
    const end = clubPoint(c, 1);
    expect(Math.hypot(end.x - c.x0, end.y - c.y0)).toBeLessThan(0.01);
    // o'yinchini borish va qaytish yo'li ustida ushlab turamiz
    const n = hits.length;
    for (let t = 0; t < ONI_THROW_TIME; t += 1 / 60) {
      const k = Math.min(1, (c.t + 1 / 60) / ONI_THROW_TIME);
      const q = clubPoint(c, k < 0.5 ? 0.25 : 0.75);
      p.x = q.x;
      p.y = q.y;
      o.update(1 / 60, p);
    }
    expect(hits.length - n).toBe(2);
  });
});

describe("Iblis: olov ustunlari (faqat 2-faza)", () => {
  it("1-fazada yo'q, 2-fazada o'yinchi tomon qator — har biri kamida 0.6 s ogohlantiriladi", () => {
    const { p } = dummy(40, 200);
    const b = ready(new Boss(100), 0.95, p);
    run(b, p, 10);
    expect(b.pillars.length).toBe(0);
    const b2 = ready(new Boss(100), 0.5, p);
    expect(b2.phase).toBe(2);
    for (let t = 0; t < 6 && !b2.pillars.length; t += 1 / 60) b2.update(1 / 60, p);
    expect(b2.pillars.length).toBeGreaterThan(2);
    expect(PILLAR_WARN).toBeGreaterThanOrEqual(0.6);
    for (const q of b2.pillars) expect(q.warn).toBeGreaterThan(0.55);
    // qator o'yinchi tomon: oxirgisi o'yinchiga yaqinroq
    const d = (q: { x: number; y: number }) => Math.hypot(q.x - p.x, q.y - p.y);
    expect(d(b2.pillars.at(-1)!)).toBeLessThan(d(b2.pillars[0]!));
  });
});
