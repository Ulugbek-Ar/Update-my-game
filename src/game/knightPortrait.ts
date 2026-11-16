/**
 * RITSAR PORTRETI — UFQ KESIMI cut-in kartasi uchun katta piksel-art (96x96, faqat ko'rinish; o'yindagi
 * Ritsar spraytiga tegmaydi). Olddan qaragan, simmetrik ritsar, beldan yuqori: cho'zinchoq dubulg'a
 * (o'rtasidan vertikal qirra, yuzida gorizontal panjara tirqishlari, ichidan ingichka ko'k-oq nur),
 * tepasidan chapga-orqaga uchgan to'q ko'k pat, ikki yelkada katta yumaloq qavat-qavat plastinka,
 * chap yelkadan ko'krakni qisman yopib tushgan yirtiq chetli to'q ko'k plash, jigarrang kamar;
 * markazda vertikal qilich — garda gorizontal, tig' pastga, ikki temir qo'lqop dastada biri
 * ikkinchisining ustida.
 *
 * Soyalash: har material 4–5 tonda, yorug'lik yuqori-chapdan (sirt normali bo'yicha hisoblanadi),
 * qarama-qarshi tomonda ingichka sovuq rim light. Math.random ishlatilmaydi.
 */
import { Pixels } from "./sprites";

export const KNIGHT_PORTRAIT_GRID = 96;
/** Kadrlar soni (kartada almashadi) */
export const KNIGHT_PORTRAIT_FRAMES = 3;

/**
 * Ranglar (indeks − 1): 1 siyoh; 2..6 kumush (to'q → yaltirash); 7..10 ko'k mato (plash, pat);
 * 11..13 jigarrang charm; 14, 15 tirqish nuri va tosh; 16 sovuq rim light.
 */
export const KNIGHT_PORTRAIT_COLORS = [
  "#0b0d16",
  "#2a303d",
  "#525d70",
  "#8390a4",
  "#bcc6d4",
  "#f0f4fa",
  "#0c1730",
  "#18305a",
  "#2a4d88",
  "#4a76b4",
  "#3a2212",
  "#6a4024",
  "#a06c3a",
  "#68cde4",
  "#e8fbff",
  "#9fdcff",
] as const;

const L = (() => {
  const v = [-0.55, -0.65, 0.55];
  const m = Math.hypot(...v);
  return v.map((x) => x / m) as [number, number, number];
})();

type P = Pixels;
const put = (p: P, c: number, x: number, y: number) => p.rect(c, x, y, 1, 1);

/** Yorug'lik bo'yicha kumush toni (5 ton) */
function silver(lum: number) {
  return lum > 0.9 ? 6 : lum > 0.66 ? 5 : lum > 0.36 ? 4 : lum > 0.08 ? 3 : 2;
}

/** Ellipsoid (dubulg'a, yelka, boldoq): normal bo'yicha soyalash, o'ngda sovuq rim */
function sphere(
  p: P,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  opt: { below?: number; above?: number; rim?: boolean; lift?: number } = {},
) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (opt.below !== undefined && y > opt.below) continue;
      if (opt.above !== undefined && y < opt.above) continue;
      const nx = (x + 0.5 - cx) / rx,
        ny = (y + 0.5 - cy) / ry;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2);
      const lum = nx * L[0] + ny * L[1] + nz * L[2] + (opt.lift ?? 0);
      let c = silver(lum);
      if (opt.rim !== false && nx > 0.62 && r2 > 0.72 && ny < 0.6) c = 16;
      put(p, c, x, y);
    }
}

/** Gorizontal silindr/bochka (ko'krak, bilak): faqat x bo'yicha normal */
function barrel(
  p: P,
  inside: (x: number, y: number) => boolean,
  cx: number,
  rx: number,
  y0: number,
  y1: number,
  tilt = -0.25,
  lift = 0,
) {
  for (let y = y0; y <= y1; y++)
    for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const nx = Math.max(-1, Math.min(1, (x + 0.5 - cx) / rx));
      const nz = Math.sqrt(1 - nx * nx);
      const lum = nx * L[0] + tilt * L[1] + nz * L[2] - ((y - y0) / (y1 - y0 + 1)) * 0.25 + lift;
      put(p, nx > 0.86 ? 16 : silver(lum), x, y);
    }
}

function inPoly(pts: readonly (readonly [number, number])[]) {
  return (x: number, y: number) => {
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

/** Mato (plash, pat): burmalar bo'yicha 4 ton, chapdan yorug' */
function cloth(
  p: P,
  inside: (x: number, y: number) => boolean,
  box: [number, number, number, number],
  fold: (x: number, y: number) => number,
) {
  const [x0, y0, x1, y1] = box;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const v = fold(x, y);
      put(p, v > 0.55 ? 10 : v > 0.15 ? 9 : v > -0.35 ? 8 : 7, x, y);
    }
}

/**
 * Portret piksellari (siyoh kontur bilan). frame: 0 — pat va plash uchi past, 1 — shamolda
 * ko'tarilgan, 2 — qilich tig'ida oq yaltirash va tirqishlardagi nur kuchli.
 */
export function knightPortraitPixels(frame: number) {
  const p = new Pixels(KNIGHT_PORTRAIT_GRID);
  const f = frame;
  const up = f === 1 ? 1 : 0;
  const cx = 48; // dubulg'a markazi
  const fx = 48; // yuz o'rta qirrasi
  const helmet = (x: number, y: number) =>
    ((x + 0.5 - cx) / 15.5) ** 2 + ((y + 0.5 - 31) / 21) ** 2 <= 1 && y <= 49;

  // ---------- pat: dubulg'a tepasidan chapga-orqaga uchadi ----------
  const plume = up
    ? ([
        [cx + 3, 13],
        [cx + 1, 6],
        [cx - 6, 2],
        [cx - 16, 1],
        [cx - 27, 3],
        [cx - 37, 2],
        [cx - 46, 5],
        [cx - 38, 8],
        [cx - 45, 12],
        [cx - 33, 12],
        [cx - 40, 18],
        [cx - 26, 15],
        [cx - 14, 16],
        [cx - 2, 18],
      ] as const)
    : ([
        [cx + 3, 13],
        [cx + 1, 6],
        [cx - 6, 4],
        [cx - 16, 6],
        [cx - 25, 11],
        [cx - 32, 19],
        [cx - 36, 28],
        [cx - 29, 25],
        [cx - 32, 33],
        [cx - 23, 26],
        [cx - 24, 34],
        [cx - 16, 23],
        [cx - 8, 18],
        [cx - 2, 18],
      ] as const);
  cloth(
    p,
    inPoly(plume),
    [0, 0, 70, 50],
    (x, y) =>
      0.75 -
      (up ? (y - 3) / 8 : (Math.hypot(x - cx, y - 4) - 4) / 26) +
      Math.sin(x * 0.9 + y * 1.3) * 0.25,
  );
  // tolalar
  if (up)
    for (const [a, b] of [
      [
        [cx - 6, 6],
        [cx - 40, 7],
      ],
      [
        [cx - 8, 11],
        [cx - 34, 14],
      ],
    ] as const)
      p.line(7, a, b, 1);
  else
    for (const [a, b] of [
      [
        [cx - 8, 8],
        [cx - 30, 24],
      ],
      [
        [cx - 10, 14],
        [cx - 24, 30],
      ],
    ] as const)
      p.line(7, a, b, 1);

  // ---------- orqadagi plash (chap yelkadan, shamolda) ----------
  const flap = up ? -9 : 0;
  const back = [
    [24, 54],
    [10, 58],
    [3, 64 + flap],
    [0, 72 + flap],
    [5, 74 + flap / 2],
    [1, 82 + flap / 3],
    [5, 86],
    [2, 95],
    [24, 95],
  ] as const;
  cloth(p, inPoly(back), [0, 40, 30, 95], (x, y) => Math.sin(x * 0.75 + y * 0.1) * 0.55 - 0.4);

  // ---------- ko'krak zirhi ----------
  const chest = inPoly([
    [28, 56],
    [68, 56],
    [66, 95],
    [30, 95],
  ]);
  barrel(p, chest, cx, 21, 56, 95, -0.25, -0.28);
  for (let y = 58; y < 86; y++) {
    put(p, 5, fx, y);
    put(p, 3, fx + 1, y);
  }
  for (const y of [86]) p.line(2, [31, y], [65, y], 1);

  // ---------- kamar ----------
  for (let x = 30; x <= 66; x++) {
    put(p, 1, x, 87);
    put(p, 13, x, 88);
    put(p, 12, x, 89);
    put(p, 12, x, 90);
    put(p, 11, x, 91);
    put(p, 1, x, 92);
  }
  for (const bx of [38, 58]) {
    p.rect(5, bx, 88, 3, 4);
    p.rect(3, bx + 1, 89, 1, 2);
  }

  // ---------- old plash: chap yelkadan ko'krakni qisman yopib tushadi, eti yirtiq ----------
  const tear = up ? 3 : 0;
  const drape = [
    [16, 54],
    [33, 53],
    [38, 60],
    [40, 72],
    [38, 84 - tear],
    [35, 90 - tear],
    [32, 86 - tear],
    [29, 95 - tear],
    [26, 88],
    [22, 95],
    [19, 87],
    [15, 93],
    [14, 70],
  ] as const;
  cloth(
    p,
    inPoly(drape),
    [8, 50, 42, 95],
    (x, y) => 0.55 - (x - 14) / 30 + Math.sin(x * 0.9 - y * 0.06) * 0.4,
  );
  p.line(7, [25, 60], [22, 90], 1);
  p.line(7, [33, 62], [32, 84], 1);
  p.line(10, [18, 58], [17, 86], 1);
  // plash to'g'nog'ichi
  sphere(p, 30, 57, 3, 3, { rim: false });
  put(p, 14, 30, 57);

  // ---------- bo'yin zirhi (gorjet) ----------
  sphere(p, cx, 54, 17, 6.5, { lift: -0.05, rim: false });
  sphere(p, cx, 51, 14, 5, { lift: 0.1, rim: false });
  p.line(2, [cx - 14, 55], [cx + 14, 55], 1);

  // ---------- dubulg'a ----------
  sphere(p, cx, 31, 15.5, 21, { below: 49 });
  p.rect(2, cx - 11, 49, 22, 1);
  // yuz plastinkasi chegarasi (qosh chizig'i va yonlari)
  for (let x = cx - 14; x <= cx + 14; x++) if (helmet(x, 21)) put(p, x < fx ? 5 : 3, x, 21);
  // o'rta vertikal qirra
  for (let y = 9; y < 49; y++) {
    if (!helmet(fx, y)) continue;
    put(p, y < 21 ? 6 : 5, fx, y);
    if (helmet(fx + 1, y)) put(p, 3, fx + 1, y);
  }
  const glow = f === 2;
  const slit = (y: number, w: number) => {
    const out: number[] = [];
    for (let x = fx - w; x <= fx + w + 1; x++)
      if (Math.abs(x - fx - 0.5) > 1.2 && helmet(x - 1, y) && helmet(x + 1, y)) out.push(x);
    return out;
  };
  // ko'z tirqishi: keng, qorong'i, ichidan ingichka ko'k-oq nur
  for (let y = 25; y <= 27; y++) for (const x of slit(y, 13)) put(p, 1, x, y);
  for (const x of slit(26, 11)) {
    const near = Math.abs(x - fx) < 7;
    put(p, glow ? (near ? 15 : 14) : near ? 14 : 8, x, 26);
  }
  if (glow) for (const x of slit(25, 5)) put(p, 14, x, 25);
  // nafas panjarasi: gorizontal tirqishlar, pastga toraygan
  for (const [y, w] of [
    [31, 10],
    [35, 9],
    [39, 7],
    [43, 5],
  ] as const) {
    for (const x of slit(y, w)) {
      put(p, 1, x, y);
      if (x < fx) put(p, 5, x, y + 1);
    }
    if (glow) for (const x of slit(y, 2)) put(p, 14, x, y);
  }
  // parchin mixlar
  for (const [x, y] of [
    [cx - 13, 18],
    [cx + 12, 18],
    [cx - 11, 40],
    [cx + 10, 40],
  ] as const)
    if (helmet(x, y)) {
      put(p, 6, x, y);
      put(p, 2, x + 1, y + 1);
    }

  // ---------- yelka plastinkalari: katta, yumaloq, qavat-qavat ----------
  const shoulders = [
    [21, 1],
    [75, 1],
  ] as const;
  for (const [sx, s] of shoulders) {
    sphere(p, sx, 72, 11 * s, 5, { rim: sx > 48 });
    sphere(p, sx, 67, 12 * s, 6, { rim: sx > 48 });
    sphere(p, sx, 60, 14 * s, 10, { below: 65, rim: sx > 48 });
    p.line(1, [sx - 12 * s, 65], [sx + 12 * s, 65], 1);
    p.line(2, [sx - 10 * s, 70], [sx + 10 * s, 70], 1);
  }
  // plash chap yelkadan osilib tushadi: yelka ustida ham
  cloth(
    p,
    inPoly([
      [12, 55],
      [30, 52],
      [33, 58],
      [24, 62],
      [14, 62],
    ]),
    [10, 50, 34, 64],
    (x) => 0.6 - (x - 12) / 20,
  );

  // ---------- bilaklar: tirsakdan (yelka ostida) qo'lqopgacha, ichki siyoh kontur bilan ----------
  const limb = (a: [number, number], b: [number, number], w: number, light: boolean) => {
    p.line(1, a, b, w + 2);
    p.line(light ? 4 : 3, a, b, w);
    p.line(light ? 5 : 4, [a[0] - 1, a[1] - 1], [b[0] - 1, b[1] - 1], Math.max(1, w - 4));
    p.line(light ? 6 : 5, [a[0] - 2, a[1] - 2], [b[0] - 2, b[1] - 2], 1);
  };
  limb([20, 80], [36, 74], 7, true);
  limb([77, 78], [61, 66], 7, false);

  // ---------- qilich: tig' pastga, garda gorizontal ----------
  for (let y = 80; y < 96; y++)
    for (let x = 44; x <= 52; x++) {
      const c = x === 44 || x === 52 ? 1 : x === 48 ? 6 : x < 48 ? 5 : x === 51 ? 16 : 4;
      put(p, c, x, y);
    }
  if (f === 2)
    for (let y = 82; y < 92; y++)
      for (let x = 45; x <= 51; x++) put(p, Math.abs(y - 86.5) < 2.2 ? 15 : 6, x, y);
  // garda: bezakli, uchlari pastga burilgan
  for (let x = 30; x <= 66; x++) {
    put(p, 1, x, 76);
    put(p, x < 48 ? 6 : 5, x, 77);
    put(p, 4, x, 78);
    put(p, 2, x, 79);
    put(p, 1, x, 80);
  }
  // garda uchlari: pastga egilgan ilgaklar
  for (const s of [-1, 1]) {
    const ex = 48 + s * 18;
    p.rect(1, ex - 2, 76, 5, 8);
    p.rect(s < 0 ? 5 : 4, ex - 1, 77, 3, 6);
    put(p, 6, ex - 1, 77);
    put(p, 1, ex + s, 83);
  }
  sphere(p, 48, 78, 5.5, 4, { rim: false });
  p.rect(1, 46, 76, 5, 4);
  p.rect(14, 47, 77, 3, 2);
  put(p, 15, 47, 77);

  // ---------- qo'lqoplar: biri ikkinchisining ustida ----------
  for (const [y, from] of [
    [69, -1],
    [62, 1],
  ] as const) {
    // musht: yumaloq siyoh kontur, tanasi, bo'g'im plastinkasi va bukilgan barmoqlar
    const wx = from > 0 ? 56 : 32;
    p.polygon(1, [
      [Math.min(38, wx), y],
      [Math.max(58, wx + 9), y],
      [Math.max(59, wx + 10), y + 2],
      [Math.max(59, wx + 10), y + 8],
      [Math.max(58, wx + 9), y + 9],
      [Math.min(38, wx), y + 9],
      [Math.min(37, wx - 1), y + 8],
      [Math.min(37, wx - 1), y + 2],
    ]);
    const fist = (x: number, yy: number) =>
      x > 38.5 &&
      x < 57.5 &&
      yy > y + 1 &&
      yy < y + 8.5 &&
      !((x < 40 || x > 56) && (yy < y + 2.5 || yy > y + 7.5));
    barrel(p, fist, 48, 10, y + 1, y + 8, -0.3, -0.18);
    // bo'g'im bo'rtiqlari (yuqorida) va barmoq oraliqlari
    for (const x of [41, 45, 49, 53]) {
      put(p, 5, x, y + 2);
      put(p, 5, x + 1, y + 2);
      put(p, 2, x + 3, y + 3);
      put(p, 2, x + 3, y + 5);
      put(p, 2, x + 3, y + 6);
    }
    for (let x = 40; x <= 56; x++) put(p, 2, x, y + 8);
    // manjet: bilakka kengayib tutashadi
    const cuff = (x: number, yy: number) =>
      x > wx + 0.5 && x < wx + 8.5 && yy > y + 0.5 && yy < y + 8.5;
    barrel(p, cuff, wx + 4.5, 4, y + 1, y + 8, -0.4, from > 0 ? -0.25 : 0);
    p.line(1, [from > 0 ? wx : wx + 8, y + 1], [from > 0 ? wx : wx + 8, y + 8], 1);
  }
  // dasta va boldoq
  p.rect(12, 46, 58, 5, 4);
  p.rect(13, 47, 58, 1, 4);
  sphere(p, 48, 55, 4.5, 3.5, { rim: false });
  put(p, 14, 48, 55);
  put(p, 15, 47, 54);

  return p.outlined();
}
