/**
 * SAMURAY PORTRETI — MING KESIM anime cut-in kartasi uchun katta piksel-art (96x96, faqat ko'rinish;
 * o'yindagi Samuray spraytiga tegmaydi). Anime ilhomidagi yaqin plan (faqat Samurayda ruxsat):
 * boshi to'liq kadrda, yuz biroz 3/4 o'ngga burilgan. Qora uzun soch — peshonada alohida uchli
 * tutamlar, yon tutamlar yuzni o'raydi, orqada qizil lenta bilan bog'langan baland dum; yumaloq-oval
 * yuz, katta anime ko'zlar (qorachiq, yaltirash, kipriklar), ingichka qoshlar, kichik jiddiy lablar.
 * Pastda oq-pushti kimono yoqasi, o'ng yelka ortidan katana dastasi (ito o'rami, oltin tsuba).
 *
 * Soyalash: har material 4–5 tonda, yorug'lik yuqori-chapdan (sirt normali bo'yicha), qarama-qarshi
 * (o'ng) chetda pushti rim light; peshonaga soch soyasi tushadi. Ranglar qahramonning 5 rangli
 * palitrasidan hosil qilinadi — skinlar (Tungi gul, Qor lotos, Qizil oy) o'z ranglarida chiqadi.
 * Math.random yo'q.
 *
 * Kadrlar: 0 — ko'zlar yumuq, soch tinch; 1 — ko'zlar keskin ochiladi (ichida pushti yaltirash),
 * dum va kokil shamolda ko'tariladi; 2 — ko'zlarda chaqnash, tezlik chiziqlari, sakura gulbarglari.
 */
export const SAMURAI_PORTRAIT_GRID = 96;
/** Kadrlar soni (kartada almashadi) */
export const SAMURAI_PORTRAIT_FRAMES = 3;
/** Yaqin (chap) ko'z markazi portret to'rida — karta shu nuqtaga "kamera" qaratadi */
export const SAMURAI_PORTRAIT_EYE: readonly [number, number] = [41, 49];
/** Uzoq (o'ng) ko'z markazi */
export const SAMURAI_PORTRAIT_FAR_EYE: readonly [number, number] = [61, 49];

const N = SAMURAI_PORTRAIT_GRID;
type V2 = readonly [number, number];

// rang indekslari (1 dan; portraitColors tartibi)
const INK = 1,
  H0 = 2,
  H1 = 3,
  H2 = 4,
  H3 = 5,
  H4 = 6,
  S0 = 7,
  S1 = 8,
  S2 = 9,
  S3 = 10,
  S4 = 11,
  A0 = 12,
  A1 = 13,
  A2 = 14,
  A3 = 15,
  W0 = 16,
  W1 = 17,
  W2 = 18,
  WH = 19,
  R0 = 20,
  R1 = 21,
  G0 = 22,
  G1 = 23,
  G2 = 24,
  BL = 25,
  RIM = 26,
  LIP = 27;

const hex2 = (v: number) =>
  Math.round(Math.max(0, Math.min(255, v)))
    .toString(16)
    .padStart(2, "0");
function mix(a: string, b: string, k: number) {
  const n = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) || 0;
  return `#${[0, 1, 2].map((i) => hex2(n(a, i) + (n(b, i) - n(a, i)) * k)).join("")}`;
}

/**
 * 27 rang (indeks − 1) qahramonning 5 rangidan (siyoh, soch, kimono/ko'z, obi/lenta, teri/oq):
 * 1 siyoh; 2..6 soch (soya → yaltirash); 7..11 iliq teri; 12..15 ko'z va kimono (to'q → och);
 * 16..19 oq yoqa va sklera; 20, 21 qizil lenta; 22..24 oltin (tsuba); 25 yonoq qizarishi;
 * 26 pushti rim light; 27 lab.
 */
export function samuraiPortraitColors(five: readonly string[]): string[] {
  const [ink = "#140a12", hair = "#2a1e3c", acc = "#ff8fb8", red = "#d8324a", pale = "#fff0ec"] =
    five;
  const W = "#ffffff";
  const shadeT = mix(ink, acc, 0.18);
  const lightT = mix(W, acc, 0.3);
  const skin = (warm: string, k: number) => mix(warm, pale, k);
  return [
    ink,
    mix(hair, shadeT, 0.62),
    mix(hair, shadeT, 0.3),
    hair,
    mix(hair, lightT, 0.26),
    mix(hair, lightT, 0.52),
    skin("#9a4f5c", 0.12),
    skin("#d98a86", 0.22),
    skin("#f2b9a6", 0.3),
    skin("#ffdcca", 0.4),
    skin("#fff6ee", 0.4),
    mix(acc, ink, 0.62),
    mix(acc, ink, 0.3),
    acc,
    mix(acc, W, 0.5),
    mix(pale, mix(ink, acc, 0.4), 0.42),
    mix(pale, acc, 0.22),
    mix(pale, W, 0.3),
    W,
    mix(red, ink, 0.45),
    red,
    "#6a4512",
    "#c8962e",
    "#ffe08a",
    mix("#ff9aa8", acc, 0.35),
    mix(acc, W, 0.38),
    mix("#7a2a3a", red, 0.25),
  ];
}

// ---------------- yordamchilar ----------------
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16 - 0.5;
const L3 = (() => {
  const v = [-0.55, -0.65, 0.55];
  const m = Math.hypot(...v);
  return v.map((x) => x / m) as [number, number, number];
})();
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
/** n tonli kvantlash (v 0..1), dither — Bayer amplitudasi (tonlar orasida yumshoq o'tish) */
const q = (v: number, x: number, y: number, n: number, dither: number) =>
  Math.floor(clamp(v + bayer(x, y) * dither, 0, 0.999) * n);
const quad = (a: V2, b: V2, c: V2, t: number): V2 => {
  const u = 1 - t;
  return [
    u * u * a[0] + 2 * u * t * b[0] + t * t * c[0],
    u * u * a[1] + 2 * u * t * b[1] + t * t * c[1],
  ];
};

type Strand = { pts: V2[]; nrm: V2[]; rad: number[] };
/** Kubik bezye tutam: eni w0 → w1, wave — uchiga qarab kuchayadigan shamol to'lqini */
function strand(a: V2, b: V2, c: V2, d: V2, w0: number, w1: number, wave = 0, phase = 0) {
  const M = 90;
  const raw: V2[] = [];
  for (let i = 0; i <= M; i++) {
    const t = i / M,
      u = 1 - t;
    raw.push([
      u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
      u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
    ]);
  }
  const s: Strand = { pts: [], nrm: [], rad: [] };
  for (let i = 0; i <= M; i++) {
    const p0 = raw[Math.max(0, i - 1)]!,
      p1 = raw[Math.min(M, i + 1)]!;
    const m = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
    const tx = (p1[0] - p0[0]) / m,
      ty = (p1[1] - p0[1]) / m;
    const t = i / M;
    const off = wave * Math.sin(t * 7 + phase) * t * t;
    const p = raw[i]!;
    s.nrm.push([-ty, tx]);
    s.pts.push([p[0] - ty * off, p[1] + tx * off]);
    s.rad.push(Math.max(0.35, (w0 + (w1 - w0) * Math.pow(t, 0.9)) / 2));
  }
  return s;
}
/** Tutam ichidami: u — ko'ndalang (−1..1), t — uzunlik bo'yicha (0..1), n — normal */
function hit(s: Strand, x: number, y: number) {
  let best = 0,
    bd = 1e9;
  for (let i = 0; i < s.pts.length; i++) {
    const p = s.pts[i]!;
    const d = (x - p[0]) ** 2 + (y - p[1]) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  const r = s.rad[best]!;
  if (bd > r * r) return null;
  const p = s.pts[best]!,
    n = s.nrm[best]!;
  const u = clamp(((x - p[0]) * n[0] + (y - p[1]) * n[1]) / r, -1, 1);
  return { u, t: best / (s.pts.length - 1), n };
}
function inPoly(pts: readonly V2[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!,
      b = pts[j]!;
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside;
}
/** Silliq yopiq kontur (Chaikin) */
function smooth(pts: readonly V2[], it: number): V2[] {
  let p = pts.slice();
  for (let k = 0; k < it; k++) {
    const o: V2[] = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i]!,
        b = p[(i + 1) % p.length]!;
      o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      o.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = o;
  }
  return p;
}
const sphere = (x: number, y: number, c: V2, r: V2) => {
  const nx = (x - c[0]) / r[0],
    ny = (y - c[1]) / r[1];
  const r2 = nx * nx + ny * ny;
  if (r2 > 1) return null;
  const nz = Math.sqrt(1 - r2);
  return { lum: nx * L3[0] + ny * L3[1] + nz * L3[2], nx, ny, r2 };
};
/** Tutam normali bo'yicha yorug'lik yo'nalishi */
const lightAcross = (n: V2) => n[0] * L3[0] + n[1] * L3[1];

// materiallar (keyingi o'tishlar uchun)
const M_HAIR = 1,
  M_SKIN = 2,
  M_CLOTH = 3,
  M_WHITE = 4,
  M_EYE = 5,
  M_METAL = 6,
  M_LINE = 7,
  M_BANG = 8;

/** Portret piksellari (0 — bo'sh, 1..27 — samuraiPortraitColors), siyoh kontur bilan. frame: 0..2 */
export function samuraiPortraitPixels(frame: number): Uint8Array {
  const col = new Uint8Array(N * N);
  const mat = new Uint8Array(N * N);
  const f = Math.max(0, Math.min(2, Math.floor(frame)));
  const dither = 0.08;
  let onlySkin = false;
  const set = (X: number, Y: number, c: number, m: number) => {
    if (X < 0 || Y < 0 || X >= N || Y >= N) return;
    if (onlySkin && mat[Y * N + X] !== M_SKIN) return;
    col[Y * N + X] = c;
    mat[Y * N + X] = m;
  };
  /** har piksel markazi uchun (x, y — to'r koordinatasi) */
  const each = (fn: (x: number, y: number, X: number, Y: number) => void) => {
    for (let Y = 0; Y < N; Y++) for (let X = 0; X < N; X++) fn(X + 0.5, Y + 0.5, X, Y);
  };
  const dot = (x: number, y: number, c: number, m = M_LINE) =>
    set(Math.floor(x), Math.floor(y), c, m);
  const line = (a: V2, b: V2, c: number, m = M_LINE) => {
    const A = [Math.floor(a[0]), Math.floor(a[1])] as const,
      B = [Math.floor(b[0]), Math.floor(b[1])] as const;
    const n = Math.max(Math.abs(B[0] - A[0]), Math.abs(B[1] - A[1]), 1);
    for (let i = 0; i <= n; i++)
      set(
        Math.round(A[0] + ((B[0] - A[0]) * i) / n),
        Math.round(A[1] + ((B[1] - A[1]) * i) / n),
        c,
        m,
      );
  };
  const curve = (a: V2, b: V2, c: V2, color: number, w = 1, m = M_LINE) => {
    for (let i = 0; i <= 40; i++) {
      const [x, y] = quad(a, b, c, i / 40);
      for (let k = 0; k < w; k++) dot(x, y + k * 0.9, color, m);
    }
  };
  const hairTone = (v: number, X: number, Y: number) =>
    [H0, H1, H2, H3, H4][q(v, X, Y, 5, dither)]!;
  const skinTone = (v: number, X: number, Y: number) =>
    [S0, S1, S2, S3, S4][q(v, X, Y, 5, dither * 0.35)]!;

  const HC: V2 = [45, 36],
    HR: V2 = [25, 26];
  /** "farishta halqasi" — sochdagi yaltiroq yoy (kranium va kokilda bir xil) */
  const ring = (x: number, y: number) => {
    const rr = Math.hypot((x - HC[0] + 4) / HR[0], (y - HC[1] + 5) / HR[1]);
    return rr > 0.6 && rr < 0.74 && y < HC[1] - 4 ? 0.42 * (1 - Math.abs(rr - 0.67) * 12) : 0;
  };
  const tie: V2 = [24, 17];

  // ---------- 1. dum: tinch osilgan → shamolda chapga keng yoy bo'lib uchadi ----------
  const lift = f === 0 ? 0 : f === 1 ? 1 : 1.25;
  const tails: { s: Strand; base: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const k = i / 4 - 0.5;
    const lp = (a: V2, b: V2): V2 => [a[0] + (b[0] - a[0]) * lift, a[1] + (b[1] - a[1]) * lift];
    const hi = f === 2 ? -8 : 0;
    const s = strand(
      [tie[0] + k * 3, tie[1] + k * 2],
      lp([tie[0] - 12, tie[1] - 4 + k * 4], [6, 4 + k * 6 + hi * 0.3]),
      lp([3 + k * 8, 56 + k * 6], [-7 + k * 3, 40 + k * 7 + hi]),
      lp([10 + k * 10, 94], [3 + k * 22, 74 + k * 26 + hi]),
      13 - Math.abs(k) * 5,
      1.2,
      1.2 + lift * 3.2,
      i * 1.7 + f * 2.1,
    );
    tails.push({ s, base: -0.1 - Math.abs(k) * 0.15 });
  }
  each((x, y, X, Y) => {
    for (const { s, base } of tails) {
      const h = hit(s, x, y);
      if (!h) continue;
      const nd = lightAcross(h.n);
      let v = 0.42 + h.u * nd * 0.7 + Math.sqrt(1 - h.u * h.u) * 0.15 + base - h.t * 0.18;
      // tutamlar orasidagi to'q ajratgich (soya tomonida)
      if (Math.abs(h.u) > 0.82 && h.u * nd < 0) v = 0.05;
      set(X, Y, hairTone(clamp(v), X, Y), M_HAIR);
    }
  });

  // ---------- 2. orqa soch (bo'yin ortida, soyada) ----------
  const back = smooth(
    [
      [22, 30],
      [44, 22],
      [70, 32],
      [74, 60],
      [72, 84],
      [60, 90],
      [34, 90],
      [22, 80],
      [18, 56],
    ],
    2,
  );
  each((x, y, X, Y) => {
    if (!inPoly(back, x, y)) return;
    const flow = Math.sin(x * 1.3 + y * 0.12) > 0.75 ? -0.12 : 0;
    const v = 0.22 - (y - 40) * 0.004 + flow + (x < 30 ? 0.08 : 0);
    set(X, Y, hairTone(clamp(v), X, Y), M_HAIR);
  });

  // ---------- 3. katana dastasi (o'ng yelka ortida) ----------
  {
    const ts: V2 = [77, 82],
      kz: V2 = [92, 54];
    const len = Math.hypot(kz[0] - ts[0], kz[1] - ts[1]);
    const ux = (kz[0] - ts[0]) / len,
      uy = (kz[1] - ts[1]) / len;
    each((x, y, X, Y) => {
      const rx = x - ts[0],
        ry = y - ts[1];
      const s = rx * ux + ry * uy;
      const v = -rx * uy + ry * ux;
      if (s > 1.5 && s < len && Math.abs(v) < 3.2) {
        const uu = v / 3.2;
        // kashira — oltin qalpoq
        if (s > len - 3) return set(X, Y, uu < -0.2 ? G2 : uu < 0.4 ? G1 : G0, M_METAL);
        // ito o'rami: to'q ip X shaklida kesishadi, oralarida oq same (romb)
        const ph = (s / 5.5) % 1;
        if (Math.abs(ph - 0.5) * 2 + Math.abs(uu) * 1.25 < 0.55)
          set(X, Y, uu < 0 ? W2 : W0, M_METAL);
        else set(X, Y, Math.abs(uu) > 0.78 ? INK : uu < -0.2 ? A1 : A0, M_METAL);
        return;
      }
      // tsuba — dastaga perpendikulyar oltin halqa
      if (s >= -0.6 && s <= 1.6 && Math.abs(v) < 7.5)
        set(X, Y, s < 0.4 ? (v / 7.5 < -0.3 ? G2 : G1) : G0, M_METAL);
    });
  }

  // ---------- 4. bo'yin, kimono va oq yoqa ----------
  const neck: V2[] = [
    [40, 60],
    [58, 62],
    [59, 82],
    [39, 84],
  ];
  each((x, y, X, Y) => {
    if (inPoly(neck, x, y)) set(X, Y, skinTone(clamp(0.35 - (x - 40) * 0.012), X, Y), M_SKIN);
  });
  const body = smooth(
    [
      [6, 99],
      [10, 88],
      [30, 79],
      [42, 76],
      [58, 77],
      [74, 81],
      [88, 90],
      [94, 99],
    ],
    2,
  );
  const band = (a: V2, b: V2, w: number) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    return (x: number, y: number) => {
      const s = ((x - a[0]) * dx + (y - a[1]) * dy) / len;
      const v = ((x - a[0]) * -dy + (y - a[1]) * dx) / len;
      return s >= -2 && s <= len + 6 && Math.abs(v) <= w / 2 ? v / (w / 2) : null;
    };
  };
  const collarL = band([39, 76], [56, 100], 7); // ostki panel (ko'ruvchiga chap)
  const collarR = band([61, 77], [44, 100], 7); // ustki panel
  const vNeck: V2[] = [
    [40, 74],
    [60, 74],
    [50, 89],
  ];
  each((x, y, X, Y) => {
    if (!inPoly(body, x, y)) return;
    const cr = collarR(x, y),
      cl = collarL(x, y);
    // V ochiq joy — ko'krak terisi
    if (cr === null && cl === null && inPoly(vNeck, x, y))
      return set(X, Y, skinTone(clamp(0.3 - (y - 76) * 0.015), X, Y), M_SKIN);
    const cu = cr ?? cl;
    if (cu !== null) {
      // oq yoqa: ichki chetida pushti qavat
      if (Math.abs(cu) > 0.72 && cu > 0) return set(X, Y, A2, M_CLOTH);
      const lum = 0.6 - cu * 0.25 - (x - 40) * 0.01 - (cr === null ? 0.2 : 0);
      return set(X, Y, [W0, W1, W2, WH][q(clamp(lum), X, Y, 4, dither)]!, M_WHITE);
    }
    // pushti kimono: burmalar, o'ngga qarab soya
    const lum = 0.62 - (x - 20) * 0.007 + Math.sin(x * 0.45 + y * 0.2) * 0.12 - (y - 80) * 0.01;
    set(X, Y, [A0, A1, A2, A3][q(clamp(lum), X, Y, 4, dither)]!, M_CLOTH);
  });

  // ---------- 5. kranium: tugundan tarqaluvchi soch tolalari va yaltiroq halqa ----------
  each((x, y, X, Y) => {
    const s = sphere(x, y, HC, HR);
    if (!s) return;
    const ang = Math.atan2(y - tie[1], x - tie[0]);
    const fl = (ang * 9 + Math.sin(Math.hypot(x - tie[0], y - tie[1]) * 0.25) * 0.6) % 1;
    let v = 0.38 + s.lum * 0.55 + ((fl + 1) % 1 < 0.14 ? -0.16 : 0);
    if (x < HC[0] + 12) v += ring(x, y);
    set(X, Y, hairTone(clamp(v), X, Y), M_HAIR);
  });

  // ---------- 6. quloq (yon tutam ortida) ----------
  each((x, y, X, Y) => {
    const s = sphere(x, y, [29, 52], [3.6, 6]);
    if (s)
      set(X, Y, s.r2 < 0.35 && x > 28.5 ? S1 : skinTone(clamp(0.3 + s.lum * 0.4), X, Y), M_SKIN);
  });

  // ---------- 7. yuz: yumaloq-oval, iyak o'ngda (3/4) ----------
  const chinX = 56;
  const face = smooth(
    [
      [27, 28],
      [46, 25],
      [66, 28],
      [69, 40],
      [68, 53],
      [63, 63],
      [chinX + 2, 70],
      [chinX - 2, 73],
      [47, 70],
      [36, 63],
      [29, 53],
    ],
    3,
  );
  each((x, y, X, Y) => {
    if (!inPoly(face, x, y)) return;
    const s = sphere(x, y, [46, 46], [24, 30]);
    const nx = s ? s.nx : 1,
      ny = s ? s.ny : 1;
    // anime cel soyalash: asosiy yorug' ton, uzoq chekkada soya, yonoq suyagida yaltirash
    let c = S3;
    if (nx > 0.8) c = S1;
    else if (nx > 0.6 || (nx > 0.5 && bayer(X, Y) > 0.1)) c = S2;
    if (!inPoly(face, x, y + 2.6) && x < chinX + 1) c = Math.min(c, S2);
    if (!inPoly(face, x, y + 1.2) && x < chinX - 1) c = S1;
    if (nx > -0.62 && nx < -0.28 && ny > 0.05 && ny < 0.22) c = S4;
    set(X, Y, c, M_SKIN);
  });
  // jag' ostida bo'yinga tushgan soya
  for (let Y = 1; Y < N; Y++)
    for (let X = 0; X < N; X++) {
      const i = Y * N + X;
      if (mat[i] !== M_SKIN || !inPoly(neck, X + 0.5, Y + 0.5) || inPoly(face, X + 0.5, Y + 0.5))
        continue;
      for (let k = 1; k <= 4; k++)
        if (inPoly(face, X + 0.5, Y + 0.5 - k)) {
          col[i] = k <= 1 ? S0 : S1;
          break;
        }
    }

  // ---------- 8. yuz detallari ----------
  const [nearX, eyeY] = SAMURAI_PORTRAIT_EYE;
  const farX = SAMURAI_PORTRAIT_FAR_EYE[0];
  const nearW = 14,
    farW = 9;
  const openEye = (cx: number, w: number, outer: -1 | 1) => {
    const l = cx - w / 2,
      r = cx + w / 2;
    const o: V2 = outer < 0 ? [l, eyeY - 2.5] : [r, eyeY - 3.5];
    const inn: V2 = outer < 0 ? [r, eyeY - 1] : [l, eyeY - 1.5];
    const a = outer < 0 ? o : inn,
      b = outer < 0 ? inn : o;
    const lid = (x: number) =>
      quad(a, [cx + outer, eyeY - 8], b, clamp((x - a[0]) / (b[0] - a[0])))[1];
    const lowY = (x: number) =>
      eyeY + 4.5 - Math.pow((x - cx) / (w / 2), 2) * 2.2 + (outer * (x - cx)) / w;
    const ic: V2 = [cx - outer * 0.3 + (outer < 0 ? 0.3 : 0.2), eyeY + 0.5];
    const irx = w * (outer < 0 ? 0.29 : 0.3),
      iry = 5.8;
    each((x, y, X, Y) => {
      if (x < l || x > r) return;
      const top = lid(x);
      if (y < top + 0.6 || y > lowY(x)) return;
      // sklera: qovoq ostida soya
      let c = y < top + 2 ? W0 : y < top + 3 ? W1 : WH;
      const ix = (x - ic[0]) / irx,
        iy = (y - ic[1]) / iry;
      if (ix * ix + iy * iy <= 1) {
        // qorachiq: tepasi to'q, pastga qarab ochiladi; ichida pushti yaltirash halqasi
        const t = (y - (ic[1] - iry)) / (iry * 2);
        c = t < 0.32 ? A0 : t < 0.55 ? A1 : t < 0.8 ? A2 : A3;
        if (t > 0.7) c = (X + Y) % 2 ? RIM : A3;
        if (ix * ix + iy * iy > 0.72 && t > 0.4) c = RIM;
        const px = (x - ic[0] - outer * 0.2) / (irx * 0.42),
          py = (y - ic[1] + 0.2) / (iry * 0.5);
        if (px * px + py * py <= 1) c = INK;
      }
      set(X, Y, c, M_EYE);
    });
    // yaltirash nuqtalari: katta (yuqori-chap) va kichik (pastki-o'ng)
    const hx = ic[0] - irx * 0.45,
      hy = ic[1] - iry * 0.45;
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const)
      dot(hx + dx, hy + dy, WH, M_EYE);
    if (outer < 0) dot(hx, hy + 2, WH, M_EYE);
    dot(ic[0] + irx * 0.45, ic[1] + iry * 0.55, WH, M_EYE);
    dot(ic[0] + irx * 0.45 - 1, ic[1] + iry * 0.55, RIM, M_EYE);
    // ustki qovoq: qalin siyoh, tashqi tomonda qalinroq
    for (let x = l - 0.5; x <= r + 0.5; x += 0.5) {
      const y = lid(x);
      dot(x, y, INK);
      dot(x, y - 1, INK);
      if ((outer < 0 && x < cx - 1) || (outer > 0 && x > cx + 1)) dot(x, y - 1.5, INK);
    }
    // kiprik uchlari
    line(o, [o[0] + outer * 2.5, o[1] - 1.5], INK);
    line([o[0], o[1] + 1], [o[0] + outer * 3, o[1] + 0.5], INK);
    line([o[0] + outer, o[1] - 1], [o[0] + outer * 2, o[1] - 3.5], INK);
    // qovoq burmasi
    curve([l + 2, eyeY - 7.5], [cx, eyeY - 9.5], [r - 1, eyeY - 7.8], S1);
    // pastki kiprik: tashqi yarmi
    for (let x = l + 0.5; x <= r - 0.5; x += 0.5)
      if (outer < 0 ? x < cx + 1 : x > cx - 1)
        dot(x, lowY(x) + 1, x === l + 0.5 || x === r - 0.5 ? A0 : S0);
  };
  const closedEye = (cx: number, w: number, outer: -1 | 1) => {
    const l = cx - w / 2,
      r = cx + w / 2;
    const a: V2 = outer < 0 ? [l, eyeY] : [l + 0.5, eyeY + 0.5];
    const b: V2 = outer < 0 ? [r, eyeY + 0.5] : [r, eyeY - 0.5];
    // pastga egilgan yumuq qovoq va osilgan kipriklar
    curve(a, [cx, eyeY + 4], b, INK, 2);
    const o = outer < 0 ? a : b;
    line([o[0], o[1] + 1], [o[0] + outer * 2, o[1] + 3], INK);
    line([o[0] - outer * 2, o[1] + 2.5], [o[0] - outer, o[1] + 4.5], INK);
    curve([l + 1, eyeY - 1], [cx, eyeY + 1.5], [r - 1, eyeY - 1], S1);
    curve([l + 2, eyeY - 4], [cx, eyeY - 6], [r - 1, eyeY - 4], S1);
  };
  if (f === 0) {
    closedEye(nearX, nearW, -1);
    closedEye(farX, farW, 1);
  } else {
    openEye(nearX, nearW, -1);
    openEye(farX, farW, 1);
  }
  // burun: kichik soya va yaltirash (3/4 — o'ngga qaragan)
  const nx0 = 56;
  dot(nx0 - 1, 54, S4, M_SKIN);
  dot(nx0, 57, S1, M_SKIN);
  dot(nx0, 58, S1, M_SKIN);
  dot(nx0 + 1, 58, S0, M_SKIN);
  // og'iz: kichik, jiddiy
  const my = 63.5;
  line([nx0 - 4, my], [nx0, my], LIP);
  dot(nx0 - 5, my + 0.6, S1, M_SKIN);
  dot(nx0 + 1, my + 0.6, S1, M_SKIN);
  line([nx0 - 3, my + 2], [nx0 - 1, my + 2], S2, M_SKIN);
  // yonoq qizarishi: anime uslubidagi qiya chiziqchalar
  for (const bx of [nearX - 4, nearX - 1, nearX + 2, farX - 1, farX + 2]) {
    dot(bx, eyeY + 8, BL, M_SKIN);
    dot(bx + 1, eyeY + 7, BL, M_SKIN);
  }

  // ---------- 9. yon tutamlar va kokil (alohida uchli tutamlar) ----------
  const up = f === 0 ? 0 : f === 1 ? 1 : 1.4;
  const tip = (x: number, y: number, side = 0): V2 => [x - up * 1.5 + side * up, y - up * 2];
  type Lock = [V2, V2, V2, V2, number];
  const sideLocks: Lock[] = [
    [[30, 26], [26, 40], [27, 58], tip(24, 76, -3), 8], // yaqin (quloq oldida)
    [[64, 28], [70, 40], [71, 54], tip(73, 68, 4), 6], // uzoq
  ];
  const bangs: Lock[] = [
    [[29, 22], [27, 32], [26, 40], tip(25, 50), 9],
    [[35, 20], [34, 30], [33, 38], tip(32, 45), 9],
    [[41, 19], [41, 27], [40, 32], tip(39.5, 36), 8],
    [[47, 19], [48, 30], [49, 40], tip(50, 50), 7],
    [[53, 19], [54, 27], [55, 31], tip(56, 35.5), 8],
    [[59, 20], [61, 27], [62, 32], tip(63, 37), 8],
    [[65, 22], [67, 30], [68, 38], tip(69, 46), 7],
  ];
  const drawLocks = (list: Lock[], base: number) => {
    const ss = list.map(([a, b, c, d, w], i) => strand(a, b, c, d, w, 0.6, up * 0.6, i * 2.3 + f));
    each((x, y, X, Y) => {
      for (const s of ss) {
        const h = hit(s, x, y);
        if (!h) continue;
        const nd = lightAcross(h.n);
        let v = base + h.u * nd * 0.75 + Math.sqrt(1 - h.u * h.u) * 0.12 - h.t * 0.08;
        if (Math.abs(h.u) < 0.6 && x < HC[0] + 14) v += ring(x, y);
        if (Math.abs(h.u) > 0.8 && h.u * nd < 0) v = 0.02;
        set(X, Y, hairTone(clamp(v), X, Y), M_BANG);
      }
    });
  };
  drawLocks(sideLocks, 0.36);
  drawLocks(bangs, 0.44);

  // ---------- 10. qizil lenta: ikki halqa va shamolda uchgan uchlari ----------
  {
    const flap = f === 0 ? 0 : 1;
    const loops: Lock[] = [
      [[24, 17], [18, 8], [12, 10], [16, 18], 5],
      [[24, 17], [28, 8], [33, 10], [28, 17], 4],
      [
        [23, 18],
        [18, 26 - flap * 8],
        [10 - flap * 6, 30 - flap * 10],
        [4 - flap * 8, 38 - flap * 18],
        3.4,
      ],
      [
        [24, 18],
        [22, 28 - flap * 6],
        [16 - flap * 4, 34 - flap * 6],
        [12 - flap * 8, 42 - flap * 12],
        3,
      ],
    ];
    const ss = loops.map(([a, b, c, d, w], i) =>
      strand(a, b, c, d, w, i < 2 ? w : 1.5, flap * 1.2, i),
    );
    each((x, y, X, Y) => {
      for (const s of ss) {
        const h = hit(s, x, y);
        if (!h) continue;
        const v = 0.5 + h.u * lightAcross(h.n) * 0.8;
        set(X, Y, v > 0.75 ? A3 : v > 0.45 ? R1 : v > 0.2 ? R0 : INK, M_CLOTH);
      }
      const k = sphere(x, y, tie, [2.6, 2.6]);
      if (k) set(X, Y, k.lum > 0.3 ? R1 : R0, M_CLOTH);
    });
  }

  // ---------- 11. soch soyasi peshonada, kokil uchlarida ichki chiziq ----------
  const msrc = mat.slice();
  const hairAt = (j: number) => msrc[j] === M_BANG || msrc[j] === M_HAIR;
  for (let Y = 3; Y < N; Y++)
    for (let X = 2; X < N; X++) {
      const i = Y * N + X;
      if (msrc[i] !== M_SKIN) continue;
      const above = (dx: number, dy: number) => hairAt((Y - dy) * N + X - dx);
      if (above(0, 1)) col[i] = S0;
      else if (above(1, 1) || above(0, 2) || above(1, 2)) col[i] = Math.min(col[i]!, S1);
      else if (above(2, 3) || above(1, 3)) col[i] = Math.min(col[i]!, S2);
    }
  for (let Y = 1; Y < N - 1; Y++)
    for (let X = 0; X < N; X++) {
      const i = Y * N + X;
      if (msrc[i] === M_BANG && (msrc[i + N] === M_SKIN || msrc[i + N] === M_EYE)) col[i] = H0;
    }
  // ingichka qat'iyatli qoshlar (yumuqda — xotirjam yoy): faqat ochiq peshona terisida
  onlySkin = true;
  if (f > 0) {
    line([nearX - 7, eyeY - 12], [nearX + 5, eyeY - 10], H0);
    line([nearX - 6, eyeY - 13], [nearX - 2, eyeY - 12.5], H0);
    line([farX - 4, eyeY - 10], [farX + 5, eyeY - 12.5], H0);
  } else {
    curve([nearX - 7, eyeY - 11], [nearX - 1, eyeY - 13.5], [nearX + 5, eyeY - 11.5], H1);
    curve([farX - 4, eyeY - 11.5], [farX + 1, eyeY - 13.5], [farX + 5, eyeY - 12], H1);
  }
  onlySkin = false;
  // yuz konturi: teri soch bilan chegarada to'q chiziq
  {
    const c2 = col.slice();
    const hairNow = (j: number) => mat[j] === M_HAIR || mat[j] === M_BANG;
    for (let Y = 1; Y < N - 1; Y++)
      for (let X = 1; X < N - 1; X++) {
        const i = Y * N + X;
        if (mat[i] === M_SKIN && (hairNow(i - 1) || hairNow(i + 1) || hairNow(i + N))) c2[i] = S0;
      }
    col.set(c2);
  }

  // ---------- 12. pushti rim light (o'ng chetda) ----------
  const rimSrc = col.slice();
  for (let Y = 0; Y < N; Y++)
    for (let X = 36; X < N - 2; X++) {
      const i = Y * N + X;
      const m = mat[i];
      if (!m || m === M_LINE || m === M_EYE || m === M_METAL) continue;
      const upRight = Y > 0 && !rimSrc[i - N + 1] && !rimSrc[i - N];
      if (!rimSrc[i + 1] || (upRight && X > 50)) col[i] = RIM;
      else if (!rimSrc[i + 2] && (m === M_HAIR || m === M_BANG)) col[i] = A1;
    }

  // ---------- 13. tashqi siyoh kontur ----------
  const out = col.slice();
  for (let Y = 0; Y < N; Y++)
    for (let X = 0; X < N; X++) {
      const i = Y * N + X;
      if (col[i]) continue;
      if (
        (X > 0 && col[i - 1]) ||
        (X < N - 1 && col[i + 1]) ||
        (Y > 0 && col[i - N]) ||
        (Y < N - 1 && col[i + N])
      )
        out[i] = INK;
    }

  // ---------- 14. 3-kadr: ko'z chaqnashi, tezlik chiziqlari, sakura gulbarglari ----------
  if (f === 2) {
    const put = (X: number, Y: number, c: number, onlyEmpty = false) => {
      if (X < 0 || Y < 0 || X >= N || Y >= N || (onlyEmpty && out[Y * N + X])) return;
      out[Y * N + X] = c;
    };
    for (let k = 0; k < 22; k++) {
      const h = (k * 2654435761) >>> 0;
      const y = 4 + ((h >> 3) % 88);
      const x0 = (h >> 11) % 60;
      const len = 10 + ((h >> 17) % 26);
      for (let x = x0; x < x0 + len; x++) put(x, y, k % 3 ? A3 : WH, true);
    }
    const petalA = [
      [1, 0, A3],
      [2, 0, A2],
      [0, 1, A3],
      [1, 1, WH],
      [2, 1, A2],
      [3, 1, A2],
      [1, 2, A2],
      [2, 2, A1],
      [3, 2, A1],
      [2, 3, A0],
    ] as const;
    const petalB = [
      [0, 1, A2],
      [1, 0, A3],
      [2, 0, A3],
      [1, 1, WH],
      [2, 1, A2],
      [3, 1, A2],
      [4, 1, A1],
      [2, 2, A1],
      [3, 2, A1],
      [5, 2, A0],
    ] as const;
    const petals: V2[] = [
      [8, 8],
      [80, 12],
      [88, 30],
      [14, 70],
      [72, 40],
      [6, 44],
      [86, 72],
      [36, 6],
    ];
    petals.forEach(([px, py], i) => {
      for (const [dx, dy, c] of i % 2 ? petalA : petalB) put(px + dx, py + dy, c);
    });
    // "kira" chaqnashi: tik uzun nur, kalta ko'ndalang va diagonal uchqunlar
    const star = (X: number, Y: number, r: number) => {
      for (let d = -r; d <= r; d++) {
        const a = Math.abs(d);
        const c = a < r * 0.45 ? WH : RIM;
        put(X, Y + d, c);
        if (a <= r * 0.45) put(X + d, Y, c);
        if (a <= r * 0.2) {
          put(X + d, Y + d, a <= 1 ? WH : RIM);
          put(X + d, Y - d, a <= 1 ? WH : RIM);
        }
      }
      for (const [dx, dy] of [
        [-1, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
      ] as const)
        put(X + dx, Y + dy, WH);
      put(X - 2, Y - 1, A3);
      put(X + 2, Y + 1, A3);
    };
    star(nearX - 2, eyeY - 2, 11);
    star(farX - 1, eyeY - 2, 6);
  }
  return out;
}
