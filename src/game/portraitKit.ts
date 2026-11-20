/**
 * PORTRET ASBOBLARI — 96x96 cut-in portretlari uchun umumiy soyalash (Ovchi va Mergan portretlari;
 * Sehrgar portreti — magePortrait.ts — xuddi shu usulni o'zi ichida takrorlaydi). Faqat sof mantiq:
 * shaklni normal bo'yicha 4–5 tonda bo'yash, o'ng chetga rim light, ko'zgu va kesma masofasi.
 * Math.random ishlatilmaydi — portret har safar aynan bir xil chiziladi (kesh va sinov uchun).
 */
import type { Pixels } from "./sprites";

export type Pt = [number, number];
export type Inside = (x: number, y: number) => boolean;

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const put = (p: Pixels, c: number, x: number, y: number) => p.rect(c, x, y, 1, 1);
export const at = (p: Pixels, x: number, y: number) => p.data[y * p.n + x] ?? 0;

const norm = (v: [number, number, number]) => {
  const m = Math.hypot(...v);
  return v.map((x) => x / m) as [number, number, number];
};
/** Asosiy yorug'lik: yuqori-chapdan, biroz oldindan */
export const LIGHT = norm([-0.55, -0.65, 0.55]);

export function lit(nx: number, ny: number, light: readonly [number, number, number] = LIGHT) {
  const r2 = Math.min(1, nx * nx + ny * ny);
  const nz = Math.sqrt(1 - r2);
  return nx * light[0] + ny * light[1] + nz * light[2];
}

/** Yorug'lik bo'yicha ton tanlash (4 yoki 5 ton) */
export function pick(tones: readonly number[], v: number) {
  const th = tones.length >= 5 ? [0.06, 0.34, 0.62, 0.9] : [0.08, 0.4, 0.75];
  let i = 0;
  while (i < th.length && i < tones.length - 1 && v > th[i]!) i++;
  return tones[i]!;
}

/** Ko'zgu: chap tomondagi nuqtalar o'ng tomonga (markaz 48), tartib teskari — ko'pburchak yopiladi */
export const mirror = (pts: readonly Pt[]) => pts.map(([x, y]) => [96 - x, y] as Pt).reverse();

/** Chap yarmi berilgan simmetrik ko'pburchak (tepadan pastga): chap + ko'zgudagi o'ng */
export const sym = (left: readonly Pt[]) => [...left, ...mirror(left)];

/** Nuqta ko'pburchak ichidami (juft-toq qoida) */
export function inPolygon(pts: readonly (readonly [number, number])[]): Inside {
  return (x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i]!,
        b = pts[j]!;
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
        inside = !inside;
    }
    return inside;
  };
}

/** Kesmagacha masofa va kesmadagi ulush (0..1) */
export function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax,
    dy = by - ay;
  const k = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return { d: Math.hypot(x - ax - dx * k, y - ay - dy * k), k };
}

export interface ShadeOpts {
  /** Rim light rangi va qaysi qatorlarda (o'ng chetda, tashqarisi bo'sh bo'lsa) */
  rim?: number;
  rimFrom?: number;
  rimTo?: number;
  /** Yorug'likka qo'shimcha (manfiy — qorong'iroq) */
  lift?: number;
  noise?: (x: number, y: number) => number;
  light?: readonly [number, number, number];
}

/** Shaklni normal bo'yicha soyalab bo'yash (box ichida) */
export function shade(
  p: Pixels,
  inside: Inside,
  box: readonly [number, number, number, number],
  normal: (x: number, y: number) => readonly [number, number],
  tones: readonly number[],
  opt: ShadeOpts = {},
) {
  const [x0, y0, x1, y1] = box;
  const n = p.n;
  for (let y = Math.max(1, y0); y <= Math.min(n - 2, y1); y++)
    for (let x = Math.max(1, x0); x <= Math.min(n - 2, x1); x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const [nx, ny] = normal(x, y);
      let c = pick(tones, lit(nx, ny, opt.light) + (opt.lift ?? 0) + (opt.noise?.(x, y) ?? 0));
      if (
        opt.rim &&
        nx > 0.2 &&
        !inside(x + 1.5, y + 0.5) &&
        y >= (opt.rimFrom ?? 0) &&
        y <= (opt.rimTo ?? 99)
      )
        c = opt.rim;
      put(p, c, x, y);
    }
}

/** Ellips ichidagi nuqtaning normali (gumbazsimon shakl uchun) */
export const domeNormal =
  (cx: number, cy: number, rx: number, ry: number) =>
  (x: number, y: number): [number, number] => [
    clamp((x + 0.5 - cx) / rx, -1, 1),
    clamp((y + 0.5 - cy) / ry, -1, 1),
  ];

/** Konturdan keyingi qatlam: bo'sh (yoki `over` bo'lsa — istalgan) piksel ustiga rang qo'yish */
export function overlay(out: Uint8Array, n: number) {
  return (x: number, y: number, c: number, over = false) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 1 || y < 1 || x >= n - 1 || y >= n - 1) return;
    const i = y * n + x;
    if (over || !out[i]) out[i] = c;
  };
}
