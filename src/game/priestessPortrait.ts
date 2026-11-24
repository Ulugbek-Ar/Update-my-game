/**
 * ROHIBA PORTRETI — OLTIN LOTOS cut-in kartasi uchun 96x96 piksel-art (faqat ko'rinish). Olddan,
 * simmetrik, beldan yuqori: bosh ortida katta oltin nur halqasi (halo) va qisqa nurlar; qora soch
 * o'rtadan ajratilgan, tepada tugun va oltin to'g'nog'ich; xotirjam yuz, peshonada oltin nuqta;
 * yopiq oq-oltin libos (yoqasi va yelka hoshiyasi oltin); kaftlar ko'krak oldida birlashtirilgan,
 * bilaklarda oltin bilaguzuklar. Anime emas: katta ko'z yo'q, keskin siluet, kam detal.
 *
 * Soyalash portraitKit.ts bilan (yorug'lik yuqori-chapdan). Math.random yo'q — portret har safar aynan
 * bir xil.
 *
 * Kadrlar: 0 — ko'zlar yumuq, ibodat; 1 — halo yonadi (nurlar uzayadi); 2 — ko'zlar ochiladi,
 * kaftlar orasidan oltin nur chaqnaydi.
 */
import { Pixels } from "./sprites";
import { domeNormal, inPolygon, overlay, put, shade, sym, type Pt } from "./portraitKit";

export const PRIESTESS_PORTRAIT_GRID = 96;
export const PRIESTESS_PORTRAIT_FRAMES = 3;

/**
 * Ranglar (indeks − 1): 1 siyoh; 2..5 oq libos; 6..9 halo oltini; 10 halo yorqin cheti; 11..13 oltin
 * hoshiya va bilaguzuk; 14 oq yaltirash; 15..17 teri; 18..20 qora soch; 21 qosh va kiprik; 22 lab.
 */
export const PRIESTESS_PORTRAIT_COLORS = [
  "#120c08",
  "#8a7a62",
  "#c8bca4",
  "#ece4d0",
  "#fffaf0",
  "#6a4410",
  "#a8701a",
  "#e0a83a",
  "#ffd77a",
  "#fff2b0",
  "#8a5a12",
  "#d8a02a",
  "#ffe08a",
  "#ffffff",
  "#a86a4a",
  "#d8a07a",
  "#f0c8a0",
  "#1e1610",
  "#3a2c22",
  "#5a463a",
  "#3a2418",
  "#c07a6a",
] as const;

const ROBE = [2, 3, 4, 5] as const;
const HALO = [6, 7, 8, 9] as const;
const GOLD = [11, 12, 13] as const;
const SKIN = [15, 16, 17] as const;
const HAIR = [18, 19, 20] as const;

/** Simmetrik shakllar (chap yarmi, tepadan pastga) */
const SHOULDERS: Pt[] = sym([
  [40, 60],
  [28, 66],
  [16, 74],
  [10, 95],
]);
/** Birlashgan kaftlar: uchlari tepada (iyak ostida), bilaklar pastda */
const PALMS: Pt[] = sym([
  [47, 66],
  [44, 70],
  [43, 80],
  [44, 88],
]);
/** Keng yeng og'izlari: bilak atrofida */
const SLEEVES: Pt[] = sym([
  [44, 86],
  [34, 88],
  [30, 95],
]);

export function priestessPortraitPixels(frame = 0): Uint8Array {
  const n = PRIESTESS_PORTRAIT_GRID;
  const p = new Pixels(n);
  const f = Math.max(0, Math.min(PRIESTESS_PORTRAIT_FRAMES - 1, frame));

  // halo: bosh ortida katta oltin halqa (gumbazsimon soyalangan) va tashqi qisqa nurlar
  const hx = 48,
    hy = 38;
  const ring = (x: number, y: number) => {
    const d = Math.hypot(x - hx, y - hy);
    return d < 31 && d > 25;
  };
  shade(p, ring, [10, 0, 86, 75], domeNormal(hx, hy, 31, 31), HALO, { rim: 10, lift: 0.15 });
  const rayLen = f >= 1 ? 9 : 5;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
    if (Math.sin(a) > 0.55) continue; // pastki nurlar yelka ortida
    for (let r = 33; r < 33 + rayLen; r++) {
      const x = Math.round(hx + Math.cos(a) * r),
        y = Math.round(hy + Math.sin(a) * r);
      put(p, r < 33 + rayLen / 2 ? 9 : 8, x, y);
    }
  }

  // yelka va gavda: yopiq oq libos, V yoqa oltin hoshiyali, burmalar
  const body = inPolygon(SHOULDERS);
  shade(p, body, [0, 58, 95, 95], (x, y) => [(x - 48) / 40, (y - 72) / 50 - 0.3], ROBE, {
    lift: 0.1,
  });
  for (let y = 62; y < 95; y++) {
    const k = (y - 62) * 0.5;
    // yelka ustidagi oltin hoshiya (yoqadan pastga ikki chiziq)
    put(p, 12, Math.round(40 - k), y);
    put(p, 12, Math.round(56 + k), y);
    put(p, 13, Math.round(41 - k), y);
    put(p, 13, Math.round(55 + k), y);
    // burmalar
    if (y > 70) {
      put(p, 3, Math.round(26 - k * 0.3), y);
      put(p, 3, Math.round(70 + k * 0.3), y);
    }
  }

  // bo'yin
  shade(
    p,
    (x, y) => Math.abs(x - 48) < 6 && y > 52 && y < 64,
    [40, 50, 56, 64],
    () => [0, 0.4],
    SKIN,
  );

  // keng yenglar va birlashgan kaftlar
  const sleeves = inPolygon(SLEEVES);
  shade(p, sleeves, [20, 84, 76, 95], domeNormal(48, 92, 20, 10), ROBE, { lift: 0.05 });
  const palms = inPolygon(PALMS);
  shade(p, palms, [40, 64, 56, 90], domeNormal(48, 78, 6, 14), SKIN, { lift: 0.1 });
  // kaftlar orasidagi chiziq va barmoqlar
  for (let y = 67; y < 86; y++) put(p, 15, 48, y);
  for (const y of [71, 74, 77]) {
    put(p, 15, 45, y);
    put(p, 15, 51, y);
  }
  // oltin bilaguzuklar
  for (let x = 41; x <= 55; x++) {
    put(p, GOLD[x % 3]!, x, 86);
    put(p, 12, x, 87);
  }

  // yuz: tuxumsimon, gumbaz bo'yicha soyalangan
  const face = (x: number, y: number) => ((x - 48) / 13) ** 2 + ((y - 42) / 16) ** 2 < 1;
  shade(p, face, [34, 26, 62, 58], domeNormal(48, 40, 13, 16), SKIN, { lift: 0.15 });

  // soch: o'rtadan ajratilgan, quloqlarni yopib tushadi; tepada tugun va to'g'nog'ich
  const hair = (x: number, y: number) => {
    const top = ((x - 48) / 15) ** 2 + ((y - 36) / 14) ** 2 < 1 && y < 33 + Math.abs(x - 48) * 0.45;
    const side = Math.abs(x - 48) > 11 && Math.abs(x - 48) < 16 && y > 30 && y < 52;
    return top || side;
  };
  shade(p, hair, [30, 20, 66, 54], domeNormal(48, 34, 15, 14), HAIR, { lift: -0.05 });
  for (let y = 23; y < 30; y++) put(p, 18, 48, y);
  const bun = (x: number, y: number) => Math.hypot(x - 48, (y - 17) * 1.15) < 7.5;
  shade(p, bun, [38, 8, 58, 26], domeNormal(48, 16, 7.5, 6.5), HAIR);
  for (let x = 37; x <= 59; x++) put(p, x < 39 || x > 57 ? 13 : 12, x, 18);

  // yuz detali: qoshlar, ko'zlar (yumuq — pastga egilgan yoy), burun, lab, peshonada oltin nuqta
  for (const s of [-1, 1]) {
    for (let k = 0; k <= 6; k++) put(p, 21, 48 + s * (3 + k), 37 - (k > 1 && k < 5 ? 1 : 0));
    const ex = 48 + s * 6;
    if (f < 2) {
      for (let k = -3; k <= 3; k++) put(p, 21, ex + k, 42 + (Math.abs(k) < 2 ? 1 : 0));
    } else {
      for (let k = -3; k <= 3; k++) put(p, 21, ex + k, 41);
      put(p, 1, ex, 42);
      put(p, 1, ex + s, 42);
      put(p, 9, ex - s, 42);
    }
  }
  put(p, 15, 48, 46);
  put(p, 15, 48, 47);
  put(p, 16, 47, 48);
  put(p, 16, 49, 48);
  for (let x = 45; x <= 51; x++) put(p, 22, x, 52);
  put(p, 12, 48, 33);
  put(p, 13, 48, 32);

  const out = p.outlined();
  const o = overlay(out, n);

  if (f >= 1) {
    // halo yonadi: ichki chekkasi bo'ylab oq-oltin nur
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const x = Math.round(hx + Math.cos(a) * 25.5),
        y = Math.round(hy + Math.sin(a) * 25.5);
      if (out[y * n + x] === 1) o(x, y, f === 2 ? 14 : 10, true);
    }
  }
  if (f === 2) {
    // kaftlar orasidan oltin nur: tepaga ingichka chaqnash va yon uchqunlar
    for (let y = 56; y < 66; y++) o(48, y, y < 60 ? 14 : 10, true);
    for (const s of [-1, 1])
      for (let k = 1; k < 5; k++) o(48 + s * (2 + k), 66 - k, k < 3 ? 13 : 10, true);
  }
  return out;
}
