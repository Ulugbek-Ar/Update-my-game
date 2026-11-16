/**
 * SEHRGAR PORTRETI — OSMON TOSHI cut-in kartasi uchun katta piksel-art (96x96, faqat ko'rinish;
 * o'yindagi Sehrgar spraytiga tegmaydi). YOVUZ sehrgar: olddan qaragan, simmetrik, beldan yuqori.
 * Keng chetli, cheti yirtiq uchli qora shlyapa (uchi o'tkir va egilgan, kumush yulduzlar va oy);
 * oqish-kulrang rangsiz ingichka yuz — o'tkir yonoq suyaklari, ilgak burun, bir tomonga qiyshaygan
 * yovuz kulgi; qattiq chimirilgan qoshlar ostida shlyapa soyasidan qip-qizil porlagan ko'zlar; uzun,
 * uchi o'tkir kulrang-oq soqol (ichida qorong'i tolalar); qora-qizil plash, yoqasi baland va o'tkir;
 * qo'lda to'q binafsha-qizil kristalli tayoq — ichida qora-qizil olov, atrofida qorong'i aura va tutun.
 *
 * Soyalash: har material 4–5 tonda. Kiyim va shlyapaga yorug'lik yuqori-chapdan; YUZGA esa pastdan
 * kristall nuri tushadi (yovuz ko'rinish), peshona va ko'z atrofi shlyapa cheti soyasida. Qarama-
 * qarshi (o'ng) tomonda kristalldan qizg'ish ingichka rim light. Math.random ishlatilmaydi.
 *
 * Kadrlar: 0 — tayoq pastroq (kristall ko'krak oldida), ko'zlar xira; 1 — tayoq yuqorida, kristall
 * yorishadi; 2 — ko'zlar va kristall chaqnaydi, soqol va plash uchi shamolda ko'tariladi.
 * Uslublar (tanlov uchun): 0 — hukmdor, 1 — soya (cho'kkan yuz), 2 — qon toj (o'tkir yoqa, katta
 * kristall).
 */
import { Pixels } from "./sprites";
import { inPoly } from "./knightPortrait";

export const MAGE_PORTRAIT_GRID = 96;
export const MAGE_PORTRAIT_FRAMES = 3;
export const MAGE_PORTRAIT_STYLES = 3;

/**
 * Ranglar (indeks − 1): 1 siyoh; 2..6 qora-qizil mato (plash, shlyapa, yeng); 7..10 qon qizil
 * (astar, tasma); 11..15 soqol (qorong'i → oq); 16..19 oqish-kulrang teri; 20..23 qora yog'och;
 * 24..27 kristall (to'q binafsha-qizil); 28 qip-qizil ko'z/olov, 29 ko'z yadrosi; 30 kristall nuri
 * (rim light); 31 qorong'i aura; 32 tutun.
 */
export const MAGE_PORTRAIT_COLORS = [
  "#07040a",
  "#0b070b",
  "#140c13",
  "#20131c",
  "#2f1a28",
  "#452538",
  "#3a0610",
  "#6a0c18",
  "#a3141f",
  "#d8303a",
  "#2a2630",
  "#56525e",
  "#8e8a98",
  "#c6c2ce",
  "#eeecf2",
  "#221e2a",
  "#4e4a5c",
  "#8a8698",
  "#bcb8c8",
  "#140a0a",
  "#2a1612",
  "#46261c",
  "#683a2a",
  "#1c0418",
  "#4a0a3e",
  "#8a1a5c",
  "#d04a90",
  "#ff2434",
  "#ffd6dc",
  "#b8306a",
  "#2e0a32",
  "#1e141e",
] as const;

const ROBE = [2, 3, 4, 5, 6] as const;
const RED = [7, 8, 9, 10] as const;
const BEARD = [11, 12, 13, 14, 15] as const;
const SKIN = [16, 17, 18, 19] as const;
const WOOD = [20, 21, 22, 23] as const;
const RIM = 30;

type P = Pixels;
type Inside = (x: number, y: number) => boolean;
const put = (p: P, c: number, x: number, y: number) => p.rect(c, x, y, 1, 1);
const at = (p: P, x: number, y: number) => p.data[y * p.n + x] ?? 0;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Yorug'lik yo'nalishi: yuqori-chapdan, biroz oldindan */
const L = (() => {
  const v = [-0.55, -0.65, 0.55];
  const m = Math.hypot(...v);
  return v.map((x) => x / m) as [number, number, number];
})();

/** Pastdan (kristalldan) tushadigan yuz yorug'ligi: yovuz ko'rinish */
const UNDER = (() => {
  const v = [0.3, 0.8, 0.5];
  const m = Math.hypot(...v);
  return v.map((x) => x / m) as [number, number, number];
})();

function lit(nx: number, ny: number, light: readonly [number, number, number] = L) {
  const r2 = Math.min(1, nx * nx + ny * ny);
  const nz = Math.sqrt(1 - r2);
  return nx * light[0] + ny * light[1] + nz * light[2];
}

/** Yorug'lik bo'yicha ton (4 yoki 5 ton) */
function pick(tones: readonly number[], v: number) {
  const th = tones.length >= 5 ? [0.06, 0.34, 0.62, 0.9] : [0.08, 0.4, 0.75];
  let i = 0;
  while (i < th.length && v > th[i]!) i++;
  return tones[i]!;
}

/**
 * Shaklni normal bo'yicha soyalab bo'yash; o'ng chetida (tashqarida bo'sh bo'lsa) iliq rim light.
 */
function fill(
  p: P,
  inside: Inside,
  box: [number, number, number, number],
  normal: (x: number, y: number) => [number, number],
  tones: readonly number[],
  opt: {
    rim?: number;
    rimTo?: number;
    noise?: ((x: number, y: number) => number) | undefined;
    lift?: number;
    light?: readonly [number, number, number];
  } = {},
) {
  const [x0, y0, x1, y1] = box;
  for (let y = Math.max(1, y0); y <= Math.min(94, y1); y++)
    for (let x = Math.max(1, x0); x <= Math.min(94, x1); x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const [nx, ny] = normal(x, y);
      let c = pick(tones, lit(nx, ny, opt.light) + (opt.lift ?? 0) + (opt.noise?.(x, y) ?? 0));
      const rim = opt.rim ?? 0;
      if (rim > 0 && nx > 0.25 && !inside(x + 1.5, y + 0.5) && y >= rim && y <= (opt.rimTo ?? 99))
        c = RIM;
      put(p, c, x, y);
    }
}

/** Ko'zgu: chap tomondagi nuqtalar o'ng tomonga (markaz 48) */
const mirror = (pts: [number, number][]) =>
  pts.map(([x, y]) => [96 - x, y] as [number, number]).reverse();

/** Kesmagacha masofa */
function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax,
    dy = by - ay;
  const k = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return { d: Math.hypot(x - ax - dx * k, y - ay - dy * k), k };
}

/**
 * Portret piksellari (siyoh kontur bilan, so'ng konturdan tashqaridagi aura, tutun va chaqnash).
 * frame: 0..2, style: 0..2 (yuqoridagi izoh).
 */
export function magePortraitPixels(frame: number, style = 0) {
  const p = new Pixels(MAGE_PORTRAIT_GRID);
  const f = clamp(Math.round(frame), 0, 2);
  const s = clamp(Math.round(style), 0, 2);
  const wind = f === 2;
  const raised = f >= 1;
  const hand: [number, number] = raised ? [79, 46] : [73, 77];
  const crystal: [number, number] = raised ? [81, 14] : [76, 59];

  // ---------- plash (gavda) ----------
  const hemR: [number, number][] = wind
    ? [
        [86, 76],
        [93, 67],
        [91, 75],
        [94, 80],
        [91, 85],
        [93, 92],
      ]
    : [
        [86, 82],
        [88, 94],
      ];
  const hemL: [number, number][] = wind
    ? [
        [7, 94],
        [4, 84],
        [10, 80],
      ]
    : [
        [8, 94],
        [10, 82],
      ];
  const cloak = inPoly([
    ...hemL,
    [13, 68],
    [22, 60],
    [36, 55],
    [60, 55],
    [74, 60],
    [83, 68],
    ...hemR,
    [88, 96],
    [8, 96],
  ]);
  fill(
    p,
    cloak,
    [3, 54, 94, 95],
    (x, y) => [clamp((x - 48) / 42, -1, 1), y < 70 ? -0.75 + (y - 56) * 0.04 : -0.15],
    ROBE,
    {
      rim: 56,
      rimTo: 70,
      lift: -0.04,
      noise: (x, y) =>
        0.24 * Math.sin(x * 0.52 + Math.sin(y * 0.09) * 1.4) * clamp((y - 64) / 16, 0, 1),
    },
  );
  if (wind) {
    // shamolda ko'tarilgan plash uchi: ichki qizil astar ko'rinadi
    const flap = inPoly([
      [86, 78],
      [92, 69],
      [90, 76],
      [92, 80],
      [88, 84],
    ]);
    fill(p, flap, [84, 68, 94, 84], () => [0.2, -0.3], RED);
  }
  // old tomondagi qizil astar va ichki qorong'i to'n
  const lining: [number, number][] = [
    [33, 57],
    [38, 57],
    [36, 96],
    [27, 96],
  ];
  fill(p, inPoly(lining), [24, 56, 40, 95], (x) => [-0.4 + (x - 30) * 0.05, -0.1], RED, {
    lift: -0.2,
  });
  fill(p, inPoly(mirror(lining)), [56, 56, 72, 95], (x) => [0.1 + (x - 58) * 0.06, -0.1], RED, {
    lift: -0.25,
  });
  const inner = inPoly([
    [38, 57],
    [58, 57],
    [60, 96],
    [36, 96],
  ]);
  fill(p, inner, [34, 56, 62, 95], (x) => [(x - 48) / 14, 0.3], ROBE, { lift: -0.3 });

  // ---------- baland o'tkir yoqa ----------
  const tip: [number, number] = s === 2 ? [8, 19] : [11, 25];
  const collarOut: [number, number][] = [
    [15, 70],
    ...(s === 2
      ? ([
          [10, 53],
          [15, 50],
        ] as [number, number][])
      : []),
    tip,
    [22, 34],
    [33, 38],
    [40, 50],
    [38, 63],
  ];
  const collarIn: [number, number][] = [
    [19, 66],
    [tip[0] + 4, tip[1] + 6],
    [32, 41],
    [37, 51],
    [35, 61],
  ];
  for (const side of [0, 1]) {
    const out = inPoly(side ? mirror(collarOut) : collarOut);
    const inn = inPoly(side ? mirror(collarIn) : collarIn);
    const box: [number, number, number, number] = side ? [54, 17, 90, 71] : [6, 17, 42, 71];
    fill(p, out, box, (x) => [side ? 0.7 : -0.5 + (x - 14) * 0.01, -0.5], ROBE, { rim: 20 });
    // ichki qizil: pastdan kristall nuri — yuzga yaqin pastki qismi yorug'roq
    fill(
      p,
      inn,
      box,
      (x, y) => {
        const toFace = side ? (61 - x) / 20 : (x - 15) / 20;
        return [side ? -0.25 - toFace * 0.3 : 0.05 + toFace * 0.3, -0.85 + (y - 30) * 0.024];
      },
      RED,
      { lift: side ? -0.45 : -0.3 },
    );
  }

  // ---------- yuz: ingichka, oqish-kulrang, pastdan yoritilgan ----------
  const faceHw = (y: number) => 8 * (1 - clamp((y - 47) / 10, 0, 1) * 0.5);
  const face: Inside = (x, y) =>
    y >= 36.5 && y <= 55.5 && ((x - 48) / faceHw(y)) ** 2 + ((y - 46) / 9.6) ** 2 <= 1.05;
  fill(p, face, [38, 36, 58, 56], (x, y) => [(x - 48) / 8, (y - 46) / 9.6], SKIN, {
    light: UNDER,
    lift: 0.38,
    // shlyapa cheti soyasi: peshona va ko'z atrofi
    noise: (_x, y) => (y < 43.5 ? -2 : y < 44.5 ? -0.7 : 0),
  });
  // o'tkir yonoq suyaklari va ostidagi botiq
  for (const side of [0, 1]) {
    const sx = (x: number) => (side ? 95 - x : x);
    put(p, 19, sx(41), 47);
    put(p, 19, sx(42), 47);
    put(p, 18, sx(43), 47);
    put(p, 16, sx(42), 49);
    put(p, 16, sx(43), 50);
    put(p, 17, sx(43), 49);
    if (s === 1) {
      // soya: cho'kkan yuz
      put(p, 16, sx(42), 50);
      put(p, 16, sx(44), 51);
      put(p, 16, sx(41), 45);
    }
    // qattiq chimirilgan qoshlar: ichki uchi pastga (V)
    for (const [x, y, c] of [
      [39, 40, 13],
      [40, 40, 14],
      [41, 41, 14],
      [42, 41, 14],
      [43, 42, 13],
      [44, 42, 14],
      [45, 43, 13],
      [46, 43, 12],
      [40, 41, 12],
      [41, 42, 12],
    ] as const)
      put(p, c, sx(x), y);
    // ko'z kosasi soyasi va qip-qizil ko'z
    const ex = side ? 52 : 42;
    put(p, 16, ex - 1, 44);
    put(p, 16, ex + 2, 44);
    put(p, 16, ex, 45);
    put(p, 16, ex + 1, 45);
    const eye = f === 0 ? 9 : 28;
    const core = f === 0 ? 10 : f === 1 ? 10 : 29;
    put(p, eye, ex, 44);
    put(p, eye, ex + 1, 44);
    put(p, core, side ? ex : ex + 1, 44);
  }
  // ilgak burun: qirrasi chapda, uchi pastga egilgan (pastdan yoritilgan)
  for (const [x, y, c] of [
    [47, 43, 17],
    [48, 43, 16],
    [47, 44, 17],
    [48, 44, 16],
    [47, 45, 18],
    [48, 45, 17],
    [47, 46, 18],
    [48, 46, 17],
    [49, 46, 16],
    [47, 47, 19],
    [48, 47, 18],
    [49, 47, 17],
    [47, 48, 19],
    [48, 48, 19],
    [49, 48, 18],
    [48, 49, 18],
    [49, 49, 16],
    [46, 49, 16],
  ] as const)
    put(p, c, x, y);

  // ---------- soqol: uzun, uchi o'tkir, ichida qorong'i tolalar ----------
  const tipY = wind ? 89 : 93;
  const sway = wind ? 6 : 0;
  const thin = s === 1 ? 0.86 : 1;
  const beardHw = (y: number) => {
    if (y < 50) return 0;
    if (y < 56) return (10 + (y - 50) * 0.6) * thin;
    if (y < 64) return (13.6 + (y - 56) * 0.15) * thin;
    return 14.8 * thin * Math.max(0, (tipY - y) / (tipY - 64)) ** 1.25;
  };
  const beardCx = (y: number) => 48 + (y > 62 ? sway * ((y - 62) / (tipY - 62)) ** 2 : 0);
  const beard: Inside = (x, y) => {
    if (y < 50 || y > tipY) return false;
    const dx = x - beardCx(y);
    if (Math.abs(dx) > beardHw(y)) return false;
    // iyak va og'iz ochiq
    if (y < 56.5 && Math.abs(dx) < 5.5) return false;
    return true;
  };
  fill(
    p,
    beard,
    [26, 49, 72, 94],
    (x, y) => [clamp((x - beardCx(y)) / Math.max(4, beardHw(y)), -1, 1), -0.25 + (y - 50) * 0.012],
    BEARD,
    {
      rim: 54,
      lift: -0.02,
      // tolalar va ichidagi qorong'i soyalar
      noise: (x, y) =>
        0.2 * Math.sin(x * 1.85 + Math.sin(y * 0.23) * 2.2 - sway * 0.2) +
        ((x * 3 + Math.floor(y / 6)) % 7 === 0 ? -0.55 : 0),
    },
  );
  // ingichka osilgan mo'ylov
  const moustache: [number, number][] = [
    [47, 50],
    [45, 50],
    [41, 52],
    [39, 59],
    [41, 58],
    [44, 53],
    [47, 51],
  ];
  for (const side of [0, 1])
    fill(
      p,
      inPoly(side ? mirror(moustache) : moustache),
      side ? [48, 48, 60, 60] : [36, 48, 48, 60],
      (x, y) => [(x - 48) / 12, -0.4 + (y - 49) * 0.08],
      BEARD,
      { lift: side ? -0.05 : 0.1 },
    );
  // yovuz kulgi: o'ng burchagi yuqoriga qiyshaygan, bitta qoziq tish ko'rinadi
  for (let x = 45; x <= 50; x++) put(p, 1, x, 53);
  put(p, 1, 51, 52);
  put(p, 1, 52, 51);
  put(p, 16, 53, 51);
  put(p, 19, 52, 52);
  put(p, 15, 50, 54);
  for (let x = 45; x <= 49; x++) put(p, 17, x, 52);
  put(p, 19, 46, 54);
  put(p, 19, 47, 54);
  put(p, 18, 48, 54);
  if (wind)
    for (const [x, y] of [
      [62, 82],
      [64, 80],
      [66, 85],
      [58, 88],
    ] as const)
      put(p, 13, x, y);

  // ---------- shlyapa ----------
  const brimRx = 35;
  const droop = 4.5;
  const torn = (x: number) =>
    (x * 7) % 9 < 2 ? 1.5 : x === 22 || x === 23 || x === 70 || x === 71 ? 2.5 : 0;
  const brimTop = (x: number) => {
    const t = (x + 0.5 - 48) / brimRx;
    return 33.5 - 3 * Math.sqrt(Math.max(0, 1 - t * t)) + droop * t * t;
  };
  const brimBot = (x: number) => {
    const t = (x + 0.5 - 48) / brimRx;
    return 36.5 + 1.8 * Math.sqrt(Math.max(0, 1 - t * t)) + droop * t * t - torn(Math.floor(x));
  };
  const brim: Inside = (x, y) => Math.abs(x - 48) <= brimRx && y >= brimTop(x) && y <= brimBot(x);
  fill(
    p,
    brim,
    [10, 28, 86, 44],
    (x, y) => {
      const front = y > (brimTop(x) + brimBot(x)) / 2 + 0.5;
      return [((x - 48) / brimRx) * 0.9, front ? 0.35 : -0.85];
    },
    ROBE,
    { rim: 30, lift: 0.04 },
  );
  for (let x = 48 - brimRx + 2; x <= 48 + brimRx - 2; x++) {
    const y = Math.floor(brimBot(x));
    if (at(p, x, y)) put(p, x < 48 ? 8 : 7, x, y);
  }
  // konus: o'tkir, uchi egilib osilgan
  const coneTop = 2,
    coneBase = 33;
  const bend = s === 1 ? -13 : 11;
  const dir = Math.sign(bend);
  const coneU = (y: number) => clamp((y - coneTop) / (coneBase - coneTop), 0, 1);
  const coneCx = (y: number) => {
    const u = coneU(y);
    let c = 48 + bend * (1 - u) ** 2;
    if (u < 0.28) c += dir * 7 * ((0.28 - u) / 0.28) ** 2;
    return c;
  };
  const coneHw = (y: number) => 15.5 * coneU(y) ** 1.15 + 0.3;
  const cone: Inside = (x, y) =>
    y >= coneTop && y <= coneBase + 1 && Math.abs(x - coneCx(y)) <= coneHw(y);
  fill(p, cone, [20, 1, 80, 35], (x, y) => [(x - coneCx(y)) / Math.max(1, coneHw(y)), -0.3], ROBE, {
    rim: 4,
    lift: 0.08,
    // g'ijim burmalar
    noise: (x, y) => (Math.abs(((x + y * 0.6) % 11) - 5) < 0.6 ? -0.25 : 0),
  });
  const band: Inside = (x, y) => y >= 28 && y <= 31 && cone(x, y);
  fill(p, band, [30, 27, 66, 32], (x, y) => [(x - coneCx(y)) / coneHw(y), -0.1], RED, { rim: 28 });
  for (let x = 34; x <= 62; x += 4) if (band(x + 0.5, 29.5)) put(p, 14, x, 29);
  // kumush yulduzlar va yarim oy
  const star = (x: number, y: number, big: boolean) => {
    put(p, 15, x, y);
    put(p, 14, x - 1, y);
    put(p, 13, x + 1, y);
    put(p, 14, x, y - 1);
    put(p, 13, x, y + 1);
    if (big) {
      put(p, 13, x - 2, y);
      put(p, 12, x + 2, y);
      put(p, 13, x, y - 2);
      put(p, 12, x, y + 2);
    }
  };
  star(Math.round(coneCx(21)) - 6, 21, true);
  star(Math.round(coneCx(25)) + 7, 25, false);
  star(Math.round(coneCx(13)) - dir, 13, false);
  const mx = Math.round(coneCx(18)) + 4;
  for (const [dx, dy, c] of [
    [0, -2, 14],
    [-1, -1, 15],
    [-1, 0, 15],
    [-1, 1, 14],
    [0, 2, 13],
  ] as const)
    put(p, c, mx + dx, 18 + dy);

  // ---------- qo'l va tayoq ----------
  const shoulder: [number, number] = [67, 63];
  const sleeve: Inside = (x, y) => {
    const { d, k } = segDist(x, y, shoulder[0], shoulder[1], hand[0], hand[1] + 3);
    return d < 7 - k * 2.5;
  };
  fill(
    p,
    sleeve,
    [56, 44, 86, 84],
    (x, y) => {
      const { d } = segDist(x, y, shoulder[0], shoulder[1], hand[0], hand[1] + 3);
      const side = x - (shoulder[0] + (hand[0] - shoulder[0]) * 0.5);
      return [clamp(Math.sign(side) * (d / 6), -1, 1), -0.2];
    },
    ROBE,
    { rim: 40, lift: 0.1 },
  );
  if (raised) {
    // ko'tarilgan qo'lda keng yeng bilakdan pastga osiladi
    fill(
      p,
      inPoly([
        [72, 53],
        [79, 52],
        [77, 63],
        [72, 71],
        [67, 66],
      ]),
      [64, 48, 82, 72],
      (x, y) => [(x - 72) / 7, 0.2 + (y - 52) * 0.02],
      ROBE,
      { rim: 50 },
    );
    fill(
      p,
      inPoly([
        [74, 54],
        [78, 53],
        [76, 61],
        [73, 64],
      ]),
      [70, 50, 80, 66],
      () => [0.3, -0.2],
      RED,
      { lift: -0.2 },
    );
  }
  const cuff: Inside = (x, y) => {
    const { d, k } = segDist(x, y, shoulder[0], shoulder[1], hand[0], hand[1] + 3);
    return k > 0.72 && k < 0.9 && d < 5;
  };
  fill(p, cuff, [60, 44, 86, 84], (x) => [(x - hand[0]) / 5, -0.2], RED, { rim: 40 });
  // qora tayoq
  const [cx, cy] = crystal;
  const big = s === 2;
  const crH = big ? 11 : 9,
    crW = big ? 6 : 5;
  const staffBot: [number, number] = [hand[0] - (raised ? 5 : 2), 95];
  const staffTop: [number, number] = [cx, cy + crH - 1];
  const steps = staffBot[1] - staffTop[1];
  for (let i = 0; i <= steps; i++) {
    const y = staffBot[1] - i;
    const x = Math.round(staffBot[0] + ((staffTop[0] - staffBot[0]) * i) / steps);
    const knot = (y * 5) % 13 === 0;
    put(p, knot ? 22 : 23, x - 1, y);
    put(p, knot ? 21 : 22, x, y);
    put(p, y < hand[1] + 2 && y > staffTop[1] + 4 ? RIM : 21, x + 1, y);
  }
  // kristallni ushlagan tirnoqsimon panjalar: uchlari ichkariga qayrilgan
  for (const side of [-1, 1])
    for (let i = 0; i <= 11; i++) {
      const y = cy + crH - 2 - Math.round(i * 1.55);
      const x = Math.round(cx + side * (1.5 + Math.sin((i / 11) * Math.PI * 0.85) * (crW + 1.5)));
      put(p, side < 0 ? 23 : 21, x, y);
      if (i < 9) put(p, 22, x - side, y);
    }
  // musht
  const fist: Inside = (x, y) =>
    Math.abs(x - hand[0]) <= 3.6 &&
    Math.abs(y - hand[1]) <= 3.2 &&
    !(Math.abs(x - hand[0]) > 2.6 && Math.abs(y - hand[1]) > 2.4);
  fill(
    p,
    fist,
    [hand[0] - 5, hand[1] - 5, hand[0] + 5, hand[1] + 5],
    (x, y) => [(x - hand[0]) / 4, (y - hand[1]) / 4],
    SKIN,
    { rim: 40 },
  );
  for (let y = hand[1] - 2; y <= hand[1] + 2; y += 2) put(p, 16, hand[0] + 1, y);

  // ---------- kristall: to'q binafsha-qizil, ichida qora-qizil olov ----------
  const gem: Inside = (x, y) =>
    Math.abs(x - cx - 0.5) / crW + Math.abs(y - cy - 0.5) / crH <= 1 ||
    (Math.abs(x - cx - 0.5) <= crW - 1.5 && Math.abs(y - cy - 0.5) <= crH - 5);
  const gemTones = f === 0 ? [24, 24, 25, 26] : f === 1 ? [24, 25, 26, 27] : [25, 26, 27, 30];
  fill(
    p,
    gem,
    [cx - 8, cy - 12, cx + 8, cy + 12],
    (x, y) => [(x - cx) / crW, (y - cy) / crH],
    gemTones,
    {
      lift: 0.05,
    },
  );
  for (let y = cy - crH + 2; y <= cy + crH - 2; y++) {
    if (at(p, cx - 1, y)) put(p, f === 0 ? 25 : 27, cx - 1, y);
    if (at(p, cx + 2, y)) put(p, 24, cx + 2, y);
  }
  // ichki olov: qora va qon qizil tillar, uchida qip-qizil
  for (let y = cy - 3; y <= cy + 5; y++) {
    const w = y > cy + 2 ? 1 : 0;
    put(p, (y + f) % 2 ? 2 : 7, cx, y);
    if (w) put(p, 8, cx + 1, y);
  }
  put(p, f === 0 ? 8 : 28, cx, cy - 4);
  put(p, f === 0 ? 7 : 9, cx + 1, cy - 2);
  if (f >= 1) put(p, 28, cx, cy - 1);
  if (f === 2) {
    put(p, 29, cx, cy - 4);
    put(p, 28, cx - 1, cy - 3);
    put(p, 28, cx + 1, cy - 3);
  }

  const out = p.outlined();

  // ---------- konturdan tashqari: qorong'i aura, tutun, nur, ko'z chaqnashi ----------
  const n = MAGE_PORTRAIT_GRID;
  const glow = (x: number, y: number, c: number, over = false) => {
    if (x < 1 || y < 1 || x >= n - 1 || y >= n - 1) return;
    const i = y * n + x;
    if (over || !out[i]) out[i] = c;
  };
  // aura: kristall atrofida nuqtali (dither) qorong'i halqa
  const aura = f === 0 ? 3 : f === 1 ? 5 : 7;
  for (let r = crH + 1; r <= crH + aura; r++)
    for (let a = 0; a < 48; a++) {
      const ang = (a / 48) * Math.PI * 2;
      if ((a + r + f) % (r - crH > aura / 2 ? 3 : 2)) continue;
      glow(
        Math.round(cx + 0.5 + Math.cos(ang) * r * (crW / crH + 0.35)),
        Math.round(cy + 0.5 + Math.sin(ang) * r),
        r - crH <= 2 ? 25 : 31,
      );
    }
  // tutun: kristalldan yuqoriga buralib ko'tariladi
  for (const [ox, ph] of [
    [-3, 0],
    [3, 2.1],
    [0, 4.2],
  ] as const)
    for (let i = 0; i < 18 + f * 4; i++) {
      const y = cy - crH - 2 - i;
      const x = Math.round(cx + ox + Math.sin(i * 0.45 + ph + f * 0.8) * (2 + i * 0.18));
      if (i % 3 === 2) continue;
      glow(x, y, i < 6 ? 31 : 32);
    }
  // nurlar: qisqa, qon qizil va binafsha
  if (f >= 1) {
    const rays = f === 1 ? 5 : 10;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2 + Math.PI / 8;
      const len = a % 2 ? rays * 0.6 : rays;
      for (let r = crH + 2; r < crH + 2 + len; r++) {
        const fade = (r - crH - 2) / len;
        if (fade > 0.4 && Math.floor(r) % 2) continue;
        glow(
          Math.round(cx + 0.5 + Math.cos(ang) * r * (crW / crH + 0.4)),
          Math.round(cy + 0.5 + Math.sin(ang) * r),
          fade < 0.3 ? 30 : a % 2 ? 28 : 26,
          true,
        );
      }
    }
  }
  if (f === 2) {
    // ko'zlar chaqnaydi: tashqariga ingichka qizil chiziq
    for (const [x, y] of [
      [40, 44],
      [39, 43],
      [55, 44],
      [56, 43],
    ] as const)
      glow(x, y, 28, true);
  }
  return out;
}
