import { describe, expect, it } from "vitest";
import { CLONE_WARN, Queen, RING_CLOSE, RING_WARN } from "./boss";
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
