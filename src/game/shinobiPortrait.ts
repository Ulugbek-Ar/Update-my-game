/**
 * NINJA PORTRETI — SOYA BO'RONI cut-in kartasi uchun 96x96 piksel-art (faqat ko'rinish). Olddan,
 * simmetrik, beldan yuqori, QIZIL OY FONIDA: qora qalpoq (tepadan tushgan burmalar) va yuzni o'ragan
 * niqob (gorizontal burmalar, burun qirrasi), ko'z tirqishi chuqur soyada — undan ikki qizil porlagan
 * ko'z; bo'yinda o'ralgan qizil sharf, tuguni o'ngda, ikki uchi shamolda o'ngga uchadi; kimono yoqasi
 * ostida kusari (zanjir to'r), yelkalarda qora sovut plastinkalari; OLDDA ikki katana X shaklida —
 * dastalari pastki burchaklarda qo'lqopli mushtlarda, tig'lar iyak ostida kesishib, uchlari qalpoq
 * yonidan chiqadi (orqa qirra to'q, o'rta, hamon chizig'i va yorug' tig' qirrasi).
 *
 * Soyalash portraitKit.ts bilan, har mato 5 tonda (yorug'lik yuqori-chapdan); oy orqadan yoritadi —
 * qomat chetida ingichka qizil rim light, oy bilan qomat orasida siyoh kontur. Math.random yo'q —
 * portret har safar aynan bir xil.
 *
 * Kadrlar: 0 — ko'zlar yonadi (tirqishga va qosh/niqob chetiga qizil nur tushadi); 1 — tig'larda oq
 * yaltirash (yulduzcha va tig' qirrasi bo'ylab chiziq); 2 — sharf uchlari shamolda baland ko'tariladi,
 * ko'zlardan gorizontal chaqnash, tig' uchlarida yaltirash.
 */
import { Pixels } from "./sprites";
import { domeNormal, inPolygon, overlay, put, shade, sym, type Pt } from "./portraitKit";

export const SHINOBI_PORTRAIT_GRID = 96;
export const SHINOBI_PORTRAIT_FRAMES = 3;

/**
 * Ranglar (indeks − 1): 1 siyoh; 2..6 qora mato (5 ton); 7..10 qizil oy; 11 oy cheti; 12..14 po'lat;
 * 15 oq yaltirash; 16..19 qizil sharf (4 ton); 20 ko'z nuri; 21 ko'z yadrosi; 22 tirqish soyasi;
 * 23 bronza tsuba; 24 qizil rim light; 25 matoga tushgan qizil nur.
 */
export const SHINOBI_PORTRAIT_COLORS = [
  "#050407",
  "#0c0a10",
  "#16131c",
  "#221e2a",
  "#322d3c",
  "#4a4456",
  "#3a0a12",
  "#6a1220",
  "#9a1c2a",
  "#c83040",
  "#e85a5a",
  "#3e4450",
  "#7e8696",
  "#c8d0de",
  "#ffffff",
  "#4a0810",
  "#8a1222",
  "#c8202e",
  "#ff5a5e",
  "#ff3a46",
  "#ffe0dc",
  "#060408",
  "#8a6a3a",
  "#ff4a50",
  "#3c0c14",
] as const;

const CLOTH = [2, 3, 4, 5, 6] as const;
const MOON = [7, 8, 9, 10] as const;
const SCARF = [16, 17, 18, 19] as const;
const N = 96;

/** Yelka va gavda (chap yarmi, tepadan pastga) */
const BODY: Pt[] = sym([
  [38, 58],
  [28, 63],
  [16, 68],
  [8, 76],
  [4, 86],
  [3, 95],
]);
/** Niqob: burun va og'izni o'raydi */
const MASK: Pt[] = sym([
  [32, 43],
  [31, 50],
  [34, 57],
  [40, 61],
  [46, 62],
]);

/** Qalpoq: tepasi gumbaz, yonlari bo'yingacha tushadi */
function inHood(x: number, y: number) {
  const dx = x - 48;
  if (y < 40) return (dx / 21) ** 2 + ((y - 39) / 27) ** 2 < 1;
  return y < 63 && Math.abs(dx) < 21 - (y - 40) * 0.12;
}

/** Katana geometriyasi (chap qo'l; o'ng qo'l — ko'zgu): tsuba (garda) va tig' uchi */
const GUARD: Pt = [24, 88];
const TIP: Pt = [86, 38];

interface Blade {
  /** tig' bo'ylab nuqta (0 — garda, 1 — uch) va tig' qirrasi tomoni normali */
  at(t: number, off: number): Pt;
  len: number;
  ux: number;
  uy: number;
}

function blade(mirror: boolean): Blade {
  const g: Pt = mirror ? [N - GUARD[0], GUARD[1]] : GUARD;
  const tp: Pt = mirror ? [N - TIP[0], TIP[1]] : TIP;
  const len = Math.hypot(tp[0] - g[0], tp[1] - g[1]);
  const ux = (tp[0] - g[0]) / len;
  const uy = (tp[1] - g[1]) / len;
  // tig' qirrasi pastga qaragan normal
  const sx = mirror ? uy : -uy;
  const sy = mirror ? -ux : ux;
  const nx = sy > 0 ? sx : -sx;
  const ny = sy > 0 ? sy : -sy;
  return {
    len,
    ux,
    uy,
    at(t, off) {
      // sori: tig' orqaga biroz egilgan (o'rtada 1.6 px)
      const bow = Math.sin(Math.PI * t) * 1.6;
      return [g[0] + ux * len * t - nx * (bow - off), g[1] + uy * len * t - ny * (bow - off)];
    },
  };
}

/** Katana: siyoh chetlar, orqa qirra, tana, hamon va yorug' tig'; tsuba va dasta o'rami */
function katana(p: Pixels, b: Blade) {
  const steps = Math.ceil(b.len * 3);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // kissaki: uchga yaqin tig' torayadi
    const w = t > 0.9 ? Math.max(0.3, (1 - t) * 14) : 1.4;
    const set = (off: number, c: number) => {
      const [x, y] = b.at(t, off);
      put(p, c, Math.round(x), Math.round(y));
    };
    set(-w - 0.9, 1);
    set(w + 0.9, 1);
  }
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const w = t > 0.9 ? Math.max(0.3, (1 - t) * 14) : 1.4;
    const set = (off: number, c: number) => {
      const [x, y] = b.at(t, off);
      put(p, c, Math.round(x), Math.round(y));
    };
    for (let o = -w; o <= w + 0.01; o += 0.5) {
      const k = (o + w) / (2 * w || 1);
      // hamon: to'lqinsimon oqish chiziq tig' qirrasiga yaqin
      const hamon = Math.sin(t * 46) > 0.55;
      set(o, k < 0.3 ? 12 : k > 0.75 ? (hamon ? 15 : 14) : 13);
    }
  }
  // dasta: gardadan qo'lgacha qora o'ram, qizil olmos naqsh
  for (let d = 1; d <= 16; d++) {
    const x = b.at(0, 0)[0] - b.ux * d;
    const y = b.at(0, 0)[1] - b.uy * d;
    for (let o = -2; o <= 2; o++) {
      const px = Math.round(x - b.uy * o);
      const py = Math.round(y + b.ux * o);
      const edge = Math.abs(o) === 2;
      const diamond = !edge && (d + Math.abs(o) * 2) % 4 === 0;
      put(p, edge ? 1 : diamond ? 18 : o < 0 ? 4 : 3, px, py);
    }
  }
  // tsuba: tig'ga ko'ndalang oval, bronza cheti
  const [gx, gy] = b.at(0, 0);
  for (let o = -4; o <= 4; o++)
    for (let a = -1; a <= 1; a++) {
      const px = Math.round(gx - b.uy * o + b.ux * a * 0.8);
      const py = Math.round(gy + b.ux * o + b.uy * a * 0.8);
      put(p, Math.abs(o) >= 4 || a === 1 ? 1 : Math.abs(o) === 3 ? 23 : a < 0 ? 13 : 2, px, py);
    }
}

/** Sharf uchi: tugundan o'ngga to'lqinlanib uchadi (rise — ko'tarilish qiyaligi) */
function scarfTail(p: Pixels, x0: number, y0: number, len: number, rise: number, phase: number) {
  const cy = (d: number) => y0 - d * rise + Math.sin(d * 0.22 + phase) * (0.5 + d * 0.05);
  for (let d = 0; d <= len; d++) {
    const x = x0 + d;
    const slope = Math.abs(cy(d + 0.5) - cy(d - 0.5));
    const w = (4.5 - (d / len) * 2) * Math.sqrt(1 + slope * slope);
    const top = cy(d) - w / 2;
    const crest = Math.cos(d * 0.22 + phase) > 0.5;
    for (let y = Math.floor(top); y <= Math.ceil(top + w); y++) {
      const k = (y - top) / w;
      if (k < 0 || k > 1) continue;
      put(p, k > 0.72 ? 16 : k < 0.3 ? (crest ? 19 : 18) : 17, x, y);
    }
  }
}

export function shinobiPortraitPixels(frame = 0): Uint8Array {
  const n = SHINOBI_PORTRAIT_GRID;
  const p = new Pixels(n);
  const f = Math.max(0, Math.min(SHINOBI_PORTRAIT_FRAMES - 1, frame));

  // QIZIL OY: gumbaz bo'yicha soyalangan, kraterlar, chetida yorqin halqa
  const mx = 48,
    my = 40,
    mr = 40;
  const inMoon = (x: number, y: number) => Math.hypot(x - mx, y - my) < mr;
  shade(p, inMoon, [0, 0, 95, 95], domeNormal(mx, my, mr, mr), MOON, { rim: 11, lift: 0.12 });
  for (const [cx, cy, r] of [
    [24, 22, 5],
    [72, 20, 4],
    [17, 48, 3],
    [78, 52, 5],
    [60, 6, 3],
    [34, 6, 2],
  ] as const)
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        if (Math.hypot(x - cx, y - cy) < r && inMoon(x, y))
          put(p, Math.hypot(x - cx + 1, y - cy + 1) < r - 1 ? 8 : 7, x, y);

  // GAVDA: qora kurtka, yengil vertikal burmalar
  const body = inPolygon(BODY);
  shade(p, body, [0, 56, 95, 95], (x, y) => [(x - 48) / 46, (y - 72) / 40 - 0.25], CLOTH, {
    lift: 0.08,
    noise: (x, y) => Math.sin((x - 48) * 0.42 + y * 0.08) * 0.16,
  });
  // kusari (zanjir to'r): V yoqa ichida
  for (let y = 62; y < 95; y++)
    for (let x = 30; x <= 66; x++) {
      const half = (y - 62) * 0.32 + 3;
      if (Math.abs(x - 48) > half || !body(x + 0.5, y + 0.5)) continue;
      // zanjir halqalari: siyrak po'lat nuqtalar, yuqorisi soyada
      const ring = (x + (y % 4 < 2 ? 0 : 1)) % 2 === 0 && y % 2 === 0;
      put(p, ring ? (y < 70 ? 2 : 12) : y % 2 ? 2 : 3, x, y);
    }
  // kimono yoqasi: ikki yorug' tasma V shaklida
  for (const s of [-1, 1])
    for (let y = 60; y < 95; y++) {
      const x = 48 + s * ((y - 62) * 0.32 + 3);
      for (let k = 0; k < 5; k++) {
        const c = k === 0 ? 2 : k === 4 ? 3 : s < 0 ? (k === 1 ? 6 : 5) : k === 1 ? 5 : 4;
        put(p, c, Math.round(x + s * k), y);
      }
    }
  // yelka sovut plastinkalari: gumbazsimon, uch qavat (qora lak), pastki chetida po'lat hoshiya
  for (const s of [-1, 1]) {
    const cx = 48 + s * 30;
    const cy = 73;
    const plate = (x: number, y: number) =>
      ((x - cx) / 15) ** 2 + ((y - cy) / 10) ** 2 < 1 && y < cy + 6 && body(x, y);
    shade(p, plate, [0, 60, 95, 95], domeNormal(cx, cy - 2, 15, 12), CLOTH, { lift: 0.18 });
    for (let x = cx - 15; x <= cx + 15; x++) {
      for (const [y0, c] of [
        [cy - 2, 2],
        [cy + 2, 2],
      ] as const) {
        const y = Math.round(y0 + ((x - cx) / 15) ** 2 * 3);
        if (plate(x, y)) put(p, c, x, y);
      }
      const yb = cy + 5;
      if (plate(x, yb)) put(p, (x - cx) * s < 0 ? 13 : 12, x, yb);
    }
    put(p, 14, cx - 4 * s, cy - 6);
  }

  // SHARF UCHLARI (yelka ustida, qalpoq ortidan): shamolda o'ngga
  const rise = f === 2 ? 1.05 : 0.28;
  scarfTail(p, 60, 60, f === 2 ? 30 : 33, rise, f === 2 ? 0.8 : 0);
  scarfTail(p, 60, 66, f === 2 ? 24 : 27, rise * 0.7, f === 2 ? 2.2 : 1.6);

  // QALPOQ: gumbaz, tepadan (toj nuqtasidan) tushgan burmalar, yonlarida vertikal burmalar
  shade(p, inHood, [20, 10, 76, 64], domeNormal(48, 38, 21, 27), CLOTH, {
    lift: 0.12,
    noise: (x, y) => {
      if (y < 36) return Math.sin(Math.atan2(y - 6, x - 48) * 7) * 0.2 * Math.min(1, (y - 9) / 6);
      return Math.sin((x - 48) * 0.7) * 0.16;
    },
  });
  // qalpoq burmalari: tojdan chakkalarga egilgan chuqur chiziqlar, yonida yorug' qirra
  for (const sd of [-1, 1])
    for (const k of [1, 2, 3]) {
      for (let t = 0; t <= 1; t += 0.02) {
        const x = 48 + sd * (3 * k + t * (5 + 3 * k) + Math.sin(t * Math.PI) * 2);
        const y = 13 + k * 1.5 + t * (19 - k * 2);
        const xi = Math.round(x),
          yi = Math.round(y);
        if (!inHood(xi + 0.5, yi + 0.5)) continue;
        put(p, 2, xi, yi);
        // yorug'lik chapdan: burmaning chap qirrasi yorug' (o'ngda xira)
        put(p, sd < 0 ? 6 : 4, xi - 1, yi);
      }
    }
  // qalpoq choki (o'rtada) va yuz ochig'i cheti (lab: yorug' qirra, ichkari soya)
  for (let y = 13; y < 33; y++) put(p, y % 4 === 0 ? 5 : 2, 48, y);
  for (let y = 34; y < 62; y++) {
    const half = y < 44 ? 17 : 17 - (y - 44) * 0.25;
    put(p, 6, Math.round(48 - half - 1), y);
    put(p, 2, Math.round(48 - half), y);
    put(p, 5, Math.round(48 + half + 1), y);
    put(p, 2, Math.round(48 + half), y);
  }

  // NIQOB: yuzni o'ragan mato, burun qirrasi, gorizontal burmalar (yon tomonga pastga egiladi)
  const mask = inPolygon(MASK);
  const bump = (x: number, y: number) => Math.max(0, 1 - Math.hypot(x - 48, (y - 47) * 0.7) / 4);
  shade(
    p,
    mask,
    [28, 42, 68, 64],
    (x, y) => {
      const [nx, ny] = domeNormal(48, 49, 17, 15)(x, y);
      return [nx * (1 - bump(x, y)) + (x < 48 ? -0.3 : 0.3) * bump(x, y), ny];
    },
    CLOTH,
    {
      lift: 0.14,
      noise: (x, y) => {
        const v = y - 44 - ((x - 48) / 15) ** 2 * 3.5;
        return Math.sin(v * 1.15) * 0.3 + bump(x, y) * 0.25;
      },
    },
  );
  // burun qirrasi (yorug') va burun ostidagi soya
  for (let y = 44; y <= 50; y++) put(p, y < 48 ? 6 : 5, 47, y);
  put(p, 2, 46, 51);
  put(p, 2, 49, 51);

  // KO'Z TIRQISHI: chuqur soya, uchlari torayadi; tepasida qalpoq qoshi (yorug' lab)
  for (let x = 31; x <= 65; x++) {
    const d = Math.abs(x - 48) / 17;
    const top = 37 + Math.round(d * d * 1.5);
    const bot = 44 - Math.round(d * d * 2.5);
    for (let y = top; y <= bot; y++) put(p, 22, x, y);
    put(p, x < 48 ? 6 : 5, x, top - 1);
    put(p, 2, x, top - 3);
    put(p, 2, x, bot + 1);
  }

  // SHARF: bo'yinga o'ralgan, diagonal burmalar; tugun o'ngda
  const wrap = (x: number, y: number) =>
    y >= 57 && y <= 66 && Math.abs(x - 48) < 16 + (y - 57) * 0.55;
  shade(p, wrap, [26, 56, 70, 67], (x, y) => [(x - 48) / 22, (y - 61.5) / 8], SCARF, {
    lift: -0.05,
    noise: (x, y) => Math.sin(x * 0.55 - y * 1.1) * 0.25,
  });
  for (let x = 32; x <= 64; x++) put(p, 16, x, 66);
  // tugun
  shade(
    p,
    (x, y) => ((x - 61) / 3.6) ** 2 + ((y - 63) / 3.2) ** 2 < 1,
    [56, 58, 66, 68],
    domeNormal(61, 63, 3.6, 3.2),
    SCARF,
    { lift: 0.1 },
  );

  // IKKI KATANA X shaklida, oldda; dastalari pastki chetdan chiqadi (qo'llar kadrdan pastda)
  const left = blade(false);
  const right = blade(true);
  katana(p, left);
  katana(p, right);

  // oy va qomat orasida siyoh kontur; qomat chetida ingichka qizil rim light (oy orqadan):
  // o'ngda yorqin, chapda xira
  const isMoon = (v: number) => v >= 7 && v <= 11;
  const d = p.data;
  const ink: number[] = [];
  const rim: number[] = [];
  for (let y = 1; y < n - 1; y++)
    for (let x = 1; x < n - 1; x++) {
      const i = y * n + x;
      const v = d[i]!;
      if (isMoon(v) || !v) continue;
      const nb = [i - 1, i + 1, i - n].filter((j) => isMoon(d[j]!));
      ink.push(...nb);
      if (v >= 2 && v <= 6 && nb.length) rim.push(i);
    }
  for (const i of rim) d[i] = i % n >= 48 ? 24 : 9;
  for (const i of ink) d[i] = 1;

  const out = p.outlined();
  const o = overlay(out, n);

  // KO'ZLAR: bodomsimon, ichki burchagi pastroq (qahrli nigoh), qizil porlaydi
  const eye = (x: number, y: number, s: number) => {
    const ax = 48 + s * 4,
      bx = 48 + s * 12;
    const k = Math.max(0, Math.min(1, (x - ax) / (bx - ax)));
    const cy = 41.2 - k * 1.6;
    const h = Math.sin(Math.PI * Math.max(0.08, k)) * 1.4;
    return {
      dx: Math.abs(y - cy) / Math.max(0.5, h),
      inX: (x - ax) * s >= -0.5 && (x - bx) * s <= 0.5,
    };
  };
  for (const s of [-1, 1])
    for (let y = 35; y <= 47; y++)
      for (let x = 30; x <= 66; x++) {
        const e = eye(x, y, s);
        const slit = out[y * n + x] === 22;
        if (e.inX && e.dx < 0.55) o(x, y, 21, true);
        else if (e.inX && e.dx < 1.25) o(x, y, 20, true);
        else if (slit && Math.abs(x - 48 - s * 8) < 8.5 && e.dx < 3) o(x, y, 25, true);
        // qosh va niqob chetiga tushgan nur
        else if (
          (y === 36 || y === 45 || y === 46) &&
          Math.abs(x - 48 - s * 8) < 6 &&
          [2, 3, 4].includes(out[y * n + x]!)
        )
          o(x, y, 25, true);
      }

  const sparkle = (x: number, y: number, r: number) => {
    o(x, y, 15, true);
    for (let k = 1; k <= r; k++) {
      const c = k < r ? 15 : 14;
      o(x + k, y, c, true);
      o(x - k, y, c, true);
      o(x, y + k, c, true);
      o(x, y - k, c, true);
    }
    o(x + 1, y + 1, 14, true);
    o(x - 1, y - 1, 14, true);
    o(x + 1, y - 1, 14, true);
    o(x - 1, y + 1, 14, true);
  };

  if (f === 1) {
    // tig'larda yaltirash: qirra bo'ylab oq chiziq va yulduzcha
    for (const b of [left, right]) {
      for (let t = 0.42; t <= 0.72; t += 0.01) {
        const [x, y] = b.at(t, 1.5);
        o(x, y, 15, true);
      }
      const [sx, sy] = b.at(0.6, 1);
      sparkle(Math.round(sx), Math.round(sy), 4);
    }
  }
  if (f === 2) {
    // tig' uchlarida yaltirash va ko'zlardan gorizontal chaqnash
    for (const b of [left, right]) {
      const [sx, sy] = b.at(0.93, 0);
      sparkle(Math.round(sx), Math.round(sy), 3);
    }
    for (const s of [-1, 1])
      for (let k = 0; k < 16; k++) {
        const x = 48 + s * (13 + k);
        o(x, 40, k < 7 ? 21 : 20, true);
        if (k < 9) o(x, 39, 20, true);
      }
  }
  return out;
}
