/**
 * BO'RI-QIZ VARVAR PORTRETI — BO'RI UVLASHI cut-in kartasi uchun 96x96 piksel-art (faqat ko'rinish).
 * Olddan, simmetrik, beldan yuqori, OY FONIDA: bosh ortida katta to'lin oy; boshida bo'ri quloqlari
 * (ichi mo'yna), uzun qora soch (chap old tutami qizil), ko'k ko'zlar va qat'iy qoshlar; yelkada
 * oq-kulrang mo'ynali plash; YOPIQ ko'kish po'lat zirh (ko'krak to'liq yopiq), bo'ynida oltin
 * taqinchoq; ikki qo'l yuqoriga ko'tarilgan — temir qo'lqop-panjalar, bilaklarda oltin bilaguzuk.
 * Anime emas: katta ko'z yo'q, keskin siluet, kam detal. Bolalar uchun ham munosib.
 *
 * Soyalash portraitKit.ts bilan (yorug'lik yuqori-chapdan). Math.random yo'q — portret har safar aynan
 * bir xil.
 *
 * Kadrlar: 0 — sokin, ko'k ko'zlar; 1 — G'AZAB: ko'zlar qizil porlaydi; 2 — oy yonadi, panjalar
 * yaltiraydi, ko'zlardan qizil chaqnash.
 */
import { Pixels } from "./sprites";
import { domeNormal, inPolygon, overlay, put, shade, sym, type Pt } from "./portraitKit";

export const WOLF_PORTRAIT_GRID = 96;
export const WOLF_PORTRAIT_FRAMES = 3;

/**
 * Ranglar (indeks − 1): 1 siyoh; 2..5 oy; 6..9 po'lat zirh; 10 po'lat yaltirog'i; 11..13 mo'yna;
 * 14..16 oltin; 17..19 teri; 20..22 qora soch; 23..24 qizil tutam; 25 ko'k ko'z; 26 g'azab ko'zi;
 * 27 lab.
 */
export const WOLF_PORTRAIT_COLORS = [
  "#0e0a10",
  "#5a6078",
  "#9aa2b8",
  "#d2d6e2",
  "#f4f2e4",
  "#1c2744",
  "#34487a",
  "#5a74a8",
  "#8ea8d8",
  "#d0e0ff",
  "#868c98",
  "#bcc2cc",
  "#eef0f4",
  "#8a5a12",
  "#d8a02a",
  "#ffe08a",
  "#a86a4a",
  "#d8a07a",
  "#f0c8a0",
  "#120e14",
  "#262030",
  "#3e3850",
  "#d8283a",
  "#8a1420",
  "#4aa8ff",
  "#ff3b3b",
  "#b06a5a",
] as const;

const MOON = [2, 3, 4, 5] as const;
const STEEL = [6, 7, 8, 9] as const;
const FUR = [11, 12, 13] as const;
const SKIN = [17, 18, 19] as const;
const HAIR = [20, 21, 22] as const;

/** Simmetrik shakllar (chap yarmi, tepadan pastga) */
const CHEST: Pt[] = sym([
  [42, 60],
  [32, 64],
  [26, 72],
  [26, 95],
]);
/** Mo'yna plash yelkada: keng yoqa */
const FUR_COLLAR: Pt[] = sym([
  [40, 58],
  [26, 60],
  [14, 66],
  [10, 76],
  [16, 80],
  [30, 72],
  [40, 68],
]);
/** Chap ko'tarilgan qo'l (bilakdan tirsakkacha), o'ngi — ko'zgu */
const ARM: Pt[] = [
  [12, 95],
  [12, 66],
  [14, 54],
  [22, 54],
  [24, 66],
  [24, 95],
];
const mirrorPts = (pts: readonly Pt[]) => pts.map(([x, y]) => [96 - x, y] as Pt);

export function wolfPortraitPixels(frame = 0): Uint8Array {
  const n = WOLF_PORTRAIT_GRID;
  const p = new Pixels(n);
  const f = Math.max(0, Math.min(WOLF_PORTRAIT_FRAMES - 1, frame));

  // to'lin oy: bosh ortida katta disk, dog'lari bilan
  const mx = 48,
    my = 38;
  const moon = (x: number, y: number) => Math.hypot(x - mx, y - my) < 34;
  shade(p, moon, [12, 2, 84, 74], domeNormal(mx, my, 34, 34), MOON, { lift: f === 2 ? 0.35 : 0.2 });
  for (const [cx, cy, r] of [
    [30, 22, 5],
    [68, 52, 4],
    [70, 20, 3],
    [24, 50, 3],
  ] as const)
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        if (Math.hypot(x - cx, y - cy) < r && moon(x, y)) put(p, 3, x, y);

  // ko'krak zirhi: yopiq po'lat, o'rtada chok, ikki plastinka
  const chest = inPolygon(CHEST);
  shade(p, chest, [20, 58, 76, 95], (x, y) => [(x - 48) / 26, (y - 76) / 40 - 0.2], STEEL, {
    rim: 10,
    lift: 0.05,
  });
  for (let y = 66; y < 95; y++) put(p, 6, 48, y);
  for (let x = 30; x < 66; x++) {
    put(p, 6, x, 80);
    if (x > 34 && x < 62) put(p, 9, x, 81);
  }

  // ko'tarilgan qo'llar: zirhli bilak, oltin bilaguzuk, temir qo'lqop va uchta panja
  for (const pts of [ARM, mirrorPts(ARM)]) {
    const arm = inPolygon(pts);
    const cx = pts[0]![0] < 48 ? 18 : 78;
    shade(p, arm, [cx - 8, 50, cx + 8, 95], (x) => [(x - cx) / 7, -0.1], STEEL, { rim: 10 });
    for (let x = cx - 6; x <= cx + 6; x++) {
      put(p, 15, x, 57);
      put(p, 16, x, 58);
      put(p, 14, x, 59);
    }
    // qo'lqop (kaft) va barmoq bo'g'imlari
    const glove = (x: number, y: number) => Math.abs(x - cx) < 7 && y > 42 && y < 56;
    shade(p, glove, [cx - 8, 40, cx + 8, 56], domeNormal(cx, 48, 7, 8), STEEL, { rim: 10 });
    // panjalar: uchta egilgan temir tirnoq (siyoh chekka bilan — oy fonida ham ko'rinadi)
    for (const dx of [-5, 0, 5]) {
      const bend = dx === 0 ? 0 : Math.sign(dx);
      for (let y = 28; y < 43; y++) {
        const x = cx + dx + (y < 33 ? bend : 0);
        put(p, 1, x - 1, y);
        put(p, y < 32 ? 10 : 9, x, y);
        put(p, y < 32 ? 9 : 8, x + 1, y);
        put(p, 1, x + 2, y);
      }
      put(p, 1, cx + dx + bend, 27);
      put(p, 1, cx + dx + bend + 1, 27);
      put(p, 6, cx + dx, 44);
    }
  }

  // mo'ynali plash yoqasi: tuklar (pastki chekka tishli)
  const collar = inPolygon(FUR_COLLAR);
  const tuft = (x: number, y: number) => ((x * 7 + y * 3) % 5) / 20 - 0.1;
  shade(p, collar, [8, 56, 88, 82], domeNormal(48, 66, 40, 14), FUR, { lift: 0.1, noise: tuft });
  for (let x = 12; x < 85; x += 3) {
    const y = x < 48 ? 78 - Math.round((x - 12) * 0.25) : 78 - Math.round((84 - x) * 0.25);
    put(p, 11, x, y);
    put(p, 11, x, y + 1);
  }

  // bo'yin va oltin taqinchoq
  shade(
    p,
    (x, y) => Math.abs(x - 48) < 6 && y > 52 && y < 62,
    [40, 50, 56, 62],
    () => [0, 0.4],
    SKIN,
  );

  // uzun qora soch: yelkagacha yon tomonlardan tushadi (yuz ortida)
  const hairBack = (x: number, y: number) =>
    Math.abs(x - 48) < 17 && y > 28 && y < 64 - Math.abs(x - 48) * 0.3;
  shade(p, hairBack, [30, 26, 66, 64], domeNormal(48, 44, 17, 22), HAIR, { lift: -0.1 });

  // yuz
  const face = (x: number, y: number) => ((x - 48) / 12) ** 2 + ((y - 43) / 15) ** 2 < 1;
  shade(p, face, [35, 27, 61, 58], domeNormal(48, 41, 12, 15), SKIN, { lift: 0.4 });

  // soch qopqog'i va peshona tutamlari
  const hairTop = (x: number, y: number) =>
    ((x - 48) / 15) ** 2 + ((y - 34) / 13) ** 2 < 1 &&
    y < 36 - Math.abs(x - 48) * 0.1 + (Math.abs(x - 48) > 9 ? 6 : 0);
  shade(p, hairTop, [32, 20, 64, 44], domeNormal(48, 32, 15, 13), HAIR);
  // fringe: uchli tutamlar peshonada
  for (const [x0, len] of [
    [40, 6],
    [44, 4],
    [52, 4],
    [56, 6],
  ] as const)
    for (let k = 0; k < len; k++) put(p, 21, x0 + (x0 < 48 ? 1 : -1) * Math.floor(k / 3), 34 + k);

  // bo'ri quloqlari: qora, ichi mo'yna
  for (const s of [-1, 1]) {
    const ear = inPolygon([
      [48 + s * 6, 24],
      [48 + s * 13, 6],
      [48 + s * 16, 26],
    ]);
    shade(p, ear, [30, 4, 66, 28], () => [s * 0.3, -0.3], HAIR);
    const inner = inPolygon([
      [48 + s * 10, 22],
      [48 + s * 13, 13],
      [48 + s * 14, 22],
    ]);
    shade(p, inner, [30, 8, 66, 26], () => [0, 0], FUR, { lift: -0.2 });
  }

  // qizil tutam: chap old soch bo'ylab ikki piksel kenglikda
  for (let k = 0; k < 14; k++) {
    const x = 37 + Math.floor(k / 4),
      y = 28 + k;
    put(p, k % 3 ? 23 : 24, x, y);
    put(p, 23, x + 1, y);
  }

  // qoshlar (qat'iy, ichkariga pastlagan), ko'zlar, burun, lab
  for (const s of [-1, 1]) {
    for (let k = 0; k <= 6; k++) put(p, 1, 48 + s * (3 + k), 38 - Math.floor(k / 3));
    // ko'z: yuqori kiprik, oq, 2x2 qorachiq (ko'k yoki g'azabda qizil), pastki qovoq
    const ex = 48 + s * 6;
    for (let k = -3; k <= 3; k++) put(p, 1, ex + k, 41);
    for (let k = -2; k <= 2; k++) {
      put(p, 13, ex + k, 42);
      put(p, 13, ex + k, 43);
      put(p, 17, ex + k, 44);
    }
    for (const k of [-1, 0]) {
      put(p, f === 0 ? 25 : 26, ex + k + (s > 0 ? 1 : 0), 42);
      put(p, f === 0 ? 25 : 26, ex + k + (s > 0 ? 1 : 0), 43);
    }
  }
  put(p, 17, 48, 46);
  put(p, 17, 48, 47);
  put(p, 17, 47, 48);
  for (let x = 45; x <= 51; x++) put(p, 27, x, 52);
  // oltin bo'yin taqinchog'i (iyak ostida, mo'yna yoqasi ustida) va o'rtasida osilgan tosh
  for (let x = 40; x <= 56; x++) {
    put(p, 14, x, 59);
    put(p, 16, x, 60);
    put(p, 15, x, 61);
  }
  for (const [dx, dy, c] of [
    [0, 62, 15],
    [-1, 62, 14],
    [1, 62, 14],
    [0, 63, 16],
  ] as const)
    put(p, c, 48 + dx, dy);

  const out = p.outlined();
  const o = overlay(out, n);
  if (f >= 1) {
    // g'azab: ko'zlardan yon tomonga qizil porlash
    for (const s of [-1, 1])
      for (let k = 1; k < (f === 2 ? 6 : 3); k++)
        o(48 + s * (9 + k), 42 - (k > 3 ? 1 : 0), 26, true);
  }
  if (f === 2) {
    // oy cheti yonadi va panja uchlari yaltiraydi
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const x = Math.round(mx + Math.cos(a) * 33.5),
        y = Math.round(my + Math.sin(a) * 33.5);
      if (out[y * n + x] && out[y * n + x]! <= 5) o(x, y, 10, true);
    }
    for (const cx of [18, 78]) for (const dx of [-4, 0, 4]) o(cx + dx, 29, 10, true);
  }
  return out;
}
