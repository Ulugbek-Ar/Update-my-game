/** Holati saqlanadigan (serializatsiya qilinadigan) tasodifiy sonlar — RealmSim determinizmi uchun. */
export class Rng {
  constructor(public s: number) {
    this.s = s >>> 0;
  }

  /** Mulberry32: [0, 1) */
  next() {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a: number, b: number) {
    return a + (b - a) * this.next();
  }

  int(n: number) {
    return Math.floor(this.next() * n);
  }
}

/** Koordinatadan barqaror [0, 1) qiymat (relyef va plitka bezaklari uchun). */
export function hash2(seed: number, x: number, y: number) {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(x | 0, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) ^ Math.imul(y | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 13), 0x297a2d39);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Silliq qiymatli shovqin (value noise): seed + masshtab bilan relyef qatlamlari uchun. */
export function valueNoise(seed: number, x: number, y: number) {
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  const fx = x - x0,
    fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const a = hash2(seed, x0, y0),
    b = hash2(seed, x0 + 1, y0),
    c = hash2(seed, x0, y0 + 1),
    d = hash2(seed, x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Ikki oktavali shovqin (tabiiyroq o'rmon chegaralari). */
export function fbm(seed: number, x: number, y: number) {
  return valueNoise(seed, x, y) * 0.65 + valueNoise(seed + 101, x * 2.1, y * 2.1) * 0.35;
}
