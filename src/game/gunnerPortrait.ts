/**
 * MERGAN PORTRETI — CHEKSIZ O'Q cut-in kartasi uchun katta piksel-art (96x96, faqat ko'rinish; o'yindagi
 * Mergan spraytiga tegmaydi). Olddan, beldan yuqori. Keng shlyapali kovboy: shlyapa cheti yuzning
 * yuqorisini qalin soyaga botiradi — soyadan faqat BIR ko'z to'q sariq porlaydi, ikkinchisi zulmatda;
 * qalin mo'ylov, soqol-mo'ylov tuklari, uzun jigarrang plash, qo'lda to'pponcha — stvoli TEPAGA.
 *
 * Soyalash: har material 4–5 tonda, yorug'lik yuqori-chapdan; o'ng chetda iliq to'q sariq rim light.
 * Math.random yo'q.
 *
 * Kadrlar: 0 — tinch, ko'z xira; 1 — baraban aylanadi (chiziqlar), ko'z yonadi; 2 — stvoldan tutun,
 * po'latda yaltirash, ko'zdan chaqnash, gilzalar uchadi.
 * Uslublar (tanlov uchun): 0 — dasht qo'riqchisi (yuzi ochiq, to'pponcha ko'krak oldida markazda);
 * 1 — niqobli bosqinchi (qizil ro'mol yuzda, to'pponcha yuz yonida ko'tarilgan).
 */
import { Pixels } from "./sprites";
import { at, clamp, domeNormal, inPolygon, overlay, put, shade, sym, type Pt } from "./portraitKit";

export const GUNNER_PORTRAIT_GRID = 96;
export const GUNNER_PORTRAIT_FRAMES = 3;
export const GUNNER_PORTRAIT_STYLES = 2;
/** O'yinga ulangan uslub (tanlangan nomzod) */
export const GUNNER_PORTRAIT_STYLE = 0;

/**
 * Ranglar (indeks − 1): 1 siyoh; 2..6 shlyapa va kamzul (porox-qora); 7..10 plash (jigarrang);
 * 11..14 oftobda qoraygan teri; 15..17 mo'ylov; 18..21 qizil ro'mol; 22..25 po'lat; 26..27 mis;
 * 28 ko'z nuri, 29 ko'z yadrosi; 30 rim light; 31 yog'och dasta; 32..33 tutun; 34 oq yaltirash.
 */
export const GUNNER_PORTRAIT_COLORS = [
  "#0a0806",
  "#110d0b",
  "#1e1814",
  "#2e2620",
  "#433830",
  "#5e4f42",
  "#2a160c",
  "#47261a",
  "#6a3c24",
  "#935a34",
  "#2c1a10",
  "#5a3622",
  "#8e5a3a",
  "#bc8558",
  "#160e0a",
  "#2e1e14",
  "#4a3222",
  "#3a0a0a",
  "#6e1414",
  "#a8281e",
  "#d24a30",
  "#1c1e22",
  "#3a3e46",
  "#6a7078",
  "#a8b0b8",
  "#a87a2a",
  "#f0cc6a",
  "#ffa020",
  "#fff2c0",
  "#ff9a3c",
  "#5a3218",
  "#6e6660",
  "#a09890",
  "#ffffff",
] as const;

const HAT = [2, 3, 4, 5, 6] as const;
const COAT = [7, 8, 9, 10] as const;
const SKIN = [11, 12, 13, 14] as const;
const RED = [18, 19, 20, 21] as const;
const STEEL = [22, 23, 24, 25] as const;
const RIM = 30;

/**
 * Tik turgan to'pponcha (yon ko'rinish, stvol tepaga): cx — stvol markazi, top — og'iz.
 * Qaytaradi: dastani ushlagan qo'l markazi.
 */
function revolver(p: Pixels, cx: number, top: number, f: number): Pt {
  // stvol
  for (let y = top; y < top + 14; y++)
    for (let x = cx - 2; x <= cx + 1; x++) put(p, [25, 24, 23, 22][x - (cx - 2)]!, x, y);
  put(p, 1, cx - 1, top - 1);
  // ejektor tayoqchasi
  for (let y = top + 4; y < top + 14; y++) put(p, 23, cx + 2, y);
  put(p, 24, cx + 2, top + 4);
  // baraban
  const cy = top + 18;
  const drum = (x: number, y: number) => Math.abs(x - (cx + 0.5)) <= 4.6 && Math.abs(y - cy) <= 4;
  shade(
    p,
    drum,
    [cx - 5, cy - 4, cx + 5, cy + 4],
    (x) => [clamp((x + 0.5 - cx - 0.5) / 5, -1, 1), 0],
    STEEL,
  );
  if (f === 1)
    // aylanayotgan baraban: gorizontal chiziqlar
    for (let y = cy - 3; y <= cy + 3; y += 2)
      for (let x = cx - 3; x <= cx + 4; x++) put(p, (x + y) % 3 ? 25 : 24, x, y);
  else
    for (const dx of [-2, 1, 3])
      for (let y = cy - 3; y <= cy + 3; y++) if (at(p, cx + dx, y)) put(p, 22, cx + dx, y);
  // ramka, tepki va tepki halqasi
  shade(
    p,
    (x, y) => x >= cx - 3 && x <= cx + 3 && y >= cy + 4 && y <= cy + 8,
    [cx - 3, cy + 4, cx + 4, cy + 8],
    () => [-0.3, -0.3],
    STEEL,
  );
  for (let y = cy + 1; y <= cy + 5; y++) put(p, 23, cx + 5, y);
  put(p, 24, cx + 6, cy + 1);
  put(p, 22, cx + 6, cy);
  for (let i = 0; i < 5; i++) put(p, 23, cx - 4 - (i > 0 && i < 4 ? 1 : 0), cy + 6 + i);
  put(p, 22, cx - 2, cy + 8);
  // yog'och dasta: pastga-o'ngga qiya, uchida mis qopqoq
  const grip = inPolygon([
    [cx - 2, cy + 8],
    [cx + 4, cy + 8],
    [cx + 9, cy + 20],
    [cx + 3, cy + 22],
  ]);
  shade(
    p,
    grip,
    [cx - 3, cy + 8, cx + 10, cy + 23],
    (x) => [(x - cx - 3) / 6, -0.2],
    [11, 31, 9, 10],
  );
  for (const [x, y] of [
    [cx + 4, cy + 21],
    [cx + 6, cy + 21],
    [cx + 8, cy + 20],
  ] as const)
    put(p, 26, x, y);
  return [cx + 3, cy + 13];
}

export function gunnerPortraitPixels(frame: number, style = GUNNER_PORTRAIT_STYLE) {
  const n = GUNNER_PORTRAIT_GRID;
  const p = new Pixels(n);
  const f = clamp(Math.round(frame), 0, 2);
  const s = clamp(Math.round(style), 0, 1);
  const masked = s === 1;

  // ---------- uzun plash ----------
  const coat = inPolygon(
    sym([
      [2, 95],
      [4, 83],
      [9, 73],
      [18, 66],
      [32, 62],
      [48, 61],
    ]),
  );
  shade(
    p,
    coat,
    [1, 58, 95, 95],
    (x, y) => [clamp((x - 48) / 44, -1, 1), -0.7 + (y - 62) * 0.03],
    COAT,
    {
      rim: RIM,
      rimFrom: 63,
      rimTo: 84,
    },
  );
  // plash burmalari: tik soya chiziqlari
  for (const x of [14, 24, 72, 82])
    for (let y = 80; y <= 94; y++)
      if (at(p, x, y) >= 7 && at(p, x, y) <= 10)
        put(p, at(p, x, y) > 7 ? at(p, x, y) - 1 : 7, x, y);
  // ichki qora kamzul va ko'ylak
  const vest = inPolygon([
    [38, 63],
    [58, 63],
    [56, 95],
    [40, 95],
  ]);
  shade(p, vest, [37, 62, 59, 95], (x) => [(x - 48) / 12, 0.1], HAT, { lift: -0.2 });
  for (const y of [74, 81, 88]) {
    put(p, 27, 45, y);
    put(p, 26, 45, y + 1);
    put(p, 27, 51, y);
    put(p, 26, 51, y + 1);
  }
  // keng yoqa (lackan): ikki tomonda
  for (const side of [-1, 1]) {
    const lap = inPolygon(
      (
        [
          [36, 62],
          [44, 63],
          [47, 78],
          [42, 74],
          [33, 70],
        ] as Pt[]
      ).map(([x, y]) => [side < 0 ? x : 96 - x, y] as Pt),
    );
    shade(p, lap, [30, 61, 66, 79], (x) => [side * 0.3 + (x - 48) / 40, -0.6], COAT, { lift: 0.1 });
  }

  // ---------- bo'yin va ro'mol tuguni ----------
  shade(
    p,
    (x, y) => x >= 42 && x <= 54 && y >= 56 && y <= 64,
    [42, 56, 54, 64],
    (x) => [(x - 48) / 8, 0.4],
    SKIN,
    {
      lift: -0.35,
    },
  );
  const scarf = inPolygon(
    sym([
      [40, 62],
      [44, 61],
      [48, 61],
      [48, 73],
    ]),
  );
  shade(p, scarf, [38, 60, 58, 74], (x, y) => [(x - 48) / 10, (y - 62) / 14], RED);
  p.rect(20, 46, 62, 4, 3);
  put(p, 21, 46, 62);

  // ---------- yuz ----------
  const face = inPolygon(
    sym([
      [48, 28],
      [39, 29],
      [35, 34],
      [34, 43],
      [35, 51],
      [38, 57],
      [43, 61],
      [48, 62],
    ]),
  );
  shade(p, face, [33, 27, 63, 63], domeNormal(48, 46, 14, 17), SKIN, {
    noise: (_x, y) => -1.1 + clamp((y - 41) / 6, 0, 1) * 1.1,
  });
  // shlyapa soyasining keskin chegarasi
  for (let x = 34; x <= 62; x++) {
    const y = 41 + (Math.abs(x - 48) > 10 ? 1 : 0);
    if (at(p, x, y)) put(p, 11, x, y);
  }
  // quloqlar
  for (const x of [33, 62]) {
    p.rect(12, x, 42, 2, 6);
    put(p, 11, x + (x < 48 ? 1 : 0), 44);
  }
  // ko'zlar: chap (tomoshabinga) — zulmatda, o'ng — porlaydi
  for (let x = 39; x <= 44; x++) put(p, 2, x, 38);
  put(p, 11, 40, 39);
  put(p, 11, 43, 39);
  const g = f === 0 ? 26 : 28;
  for (const [x, y, c] of [
    [52, 39, g],
    [53, 39, f === 0 ? 28 : 29],
    [54, 39, g],
    [55, 39, g],
    [53, 38, g],
    [54, 38, g],
    [51, 38, 1],
    [52, 37, 1],
    [53, 37, 1],
    [54, 37, 1],
    [55, 37, 1],
    [56, 38, 1],
  ] as const)
    put(p, c, x, y);
  // burun: pastki qismi yorug'da
  for (let y = 40; y <= 47; y++) put(p, y < 43 ? 11 : 12, 49, y);
  put(p, 13, 47, 46);
  put(p, 14, 47, 47);
  put(p, 14, 48, 47);
  put(p, 11, 45, 48);
  put(p, 11, 50, 48);
  // yonoq chiziqlari (ajin)
  for (let y = 44; y <= 52; y++) {
    if (y % 2 === 0) put(p, 12, 39, y);
    if (y % 2 === 0) put(p, 11, 57, y);
  }

  if (!masked) {
    // qalin osilgan mo'ylov
    const stache = inPolygon(
      sym([
        [48, 49],
        [44, 49],
        [40, 51],
        [38, 55],
        [38, 59],
        [40, 58],
        [42, 54],
        [48, 53],
      ]),
    );
    shade(p, stache, [36, 48, 60, 60], (x, y) => [(x - 48) / 12, (y - 51) / 6], [15, 16, 17, 33]);
    put(p, 15, 48, 50);
    // tuklar (soqol-mo'ylov qirqilmagan)
    for (let y = 57; y <= 61; y++)
      for (let x = 37; x <= 59; x++)
        if ((x + y) % 2 === 0 && at(p, x, y) >= 11 && at(p, x, y) <= 14 && Math.abs(x - 48) > 5)
          put(p, at(p, x, y) >= 13 ? 12 : 11, x, y);
    // pastki lab
    for (let x = 45; x <= 51; x++) put(p, 13, x, 55);
  } else {
    // qizil ro'mol: burun ustidan bo'yingacha, uchburchak bo'lib tushadi, oq nuqtali naqsh
    const mask = inPolygon(
      sym([
        [48, 44],
        [42, 45],
        [36, 46],
        [34, 50],
        [37, 58],
        [43, 64],
        [48, 72],
      ]),
    );
    shade(p, mask, [32, 43, 64, 73], domeNormal(48, 54, 14, 16), RED, {
      noise: (x, y) => 0.15 * Math.sin((x - y) * 0.9),
    });
    for (let y = 48; y <= 68; y += 4)
      for (let x = 38 + (y % 8 ? 2 : 0); x <= 58; x += 4)
        if (at(p, x, y) >= 18 && at(p, x, y) <= 21) put(p, 21, x, y);
  }

  // ---------- shlyapa ----------
  const crown = inPolygon(
    sym([
      [48, 10],
      [44, 7],
      [38, 5],
      [33, 7],
      [30, 12],
      [29, 20],
      [28, 29],
    ]),
  );
  shade(p, crown, [27, 4, 69, 30], domeNormal(46, 14, 22, 20), HAT, {
    rim: RIM,
    rimFrom: 6,
    rimTo: 30,
    noise: (x) => -0.2 * Math.max(0, 1 - Math.abs(x - 48) / 3),
  });
  // tasma: charm, mis kumushlar (konchalar)
  const band = (x: number, y: number) => crown(x, y) && y >= 23 && y < 28;
  shade(p, band, [27, 23, 69, 27], (x) => [(x - 48) / 22, -0.2], COAT);
  for (const x of [34, 41, 55, 62]) {
    put(p, 27, x, 24);
    put(p, 26, x, 25);
    put(p, 26, x + 1, 25);
  }
  // keng chet: uchlari yuqoriga qayrilgan; tepasi yorug', osti qalin soya
  const brim = inPolygon([
    [2, 22],
    [6, 26],
    [14, 28],
    [26, 29],
    [48, 29],
    [70, 29],
    [82, 28],
    [90, 26],
    [94, 22],
    [94, 25],
    [90, 30],
    [82, 33],
    [70, 35],
    [48, 36],
    [26, 35],
    [14, 33],
    [6, 30],
    [2, 25],
  ]);
  shade(
    p,
    brim,
    [1, 21, 95, 37],
    (x, y) => [clamp((x - 48) / 46, -1, 1), y < 31 ? -0.9 : 0.7],
    HAT,
    {
      rim: RIM,
      rimFrom: 21,
      rimTo: 31,
      lift: -0.05,
    },
  );
  // chet qirrasi (old tomon) ingichka yorug' chiziq
  for (let x = 6; x <= 90; x++) {
    const y =
      29 +
      (Math.abs(x - 48) < 22 ? 0 : Math.abs(x - 48) < 34 ? 0 : -1) +
      (Math.abs(x - 48) > 40 ? -2 : 0);
    if (at(p, x, y)) put(p, x < 48 ? 6 : 5, x, y);
  }

  // ---------- to'pponcha ----------
  let hand: Pt;
  let muzzle: Pt;
  if (!masked) {
    hand = revolver(p, 48, 58, f);
    muzzle = [47, 57];
  } else {
    // yengdan chiqqan qo'l, to'pponcha yuz yonida
    const sleeve = inPolygon([
      [66, 95],
      [84, 95],
      [78, 70],
      [70, 66],
      [64, 70],
    ]);
    shade(p, sleeve, [62, 64, 86, 95], (x) => [(x - 72) / 12, -0.4], COAT, {
      rim: RIM,
      rimFrom: 66,
      rimTo: 95,
    });
    hand = revolver(p, 70, 26, f);
    muzzle = [69, 25];
  }
  // musht dastani ushlaydi; bosh barmoq tepkiga
  const fist = (x: number, y: number) => ((x - hand[0]) / 5.5) ** 2 + ((y - hand[1]) / 5) ** 2 <= 1;
  shade(
    p,
    fist,
    [hand[0] - 6, hand[1] - 5, hand[0] + 6, hand[1] + 6],
    domeNormal(hand[0] - 1, hand[1] - 2, 6, 5),
    SKIN,
  );
  for (const dy of [-1, 1, 3]) put(p, 11, hand[0] - 3, hand[1] + dy);
  put(p, 14, hand[0] - 2, hand[1] - 3);

  const out = p.outlined();
  const glowAt = overlay(out, n);

  // ---------- konturdan tashqari ----------
  if (f >= 1) {
    glowAt(56, 39, 26, true);
    glowAt(51, 39, 26, true);
  }
  if (f === 2) {
    // ko'zdan tashqariga uzun chaqnash
    for (let i = 0; i < 9; i++)
      glowAt(57 + i, 39 - Math.floor(i / 4), i < 3 ? 29 : i < 6 ? 28 : 26, true);
    // stvol bo'ylab yaltirash
    glowAt(muzzle[0] - 1, muzzle[1] + 6, 34, true);
    glowAt(muzzle[0] - 1, muzzle[1] + 7, 34, true);
    // stvoldan buralib chiqqan tutun
    for (let i = 0; i < 16; i++) {
      const x = muzzle[0] + 0.5 + Math.sin(i * 0.55) * (1 + i * 0.25);
      if (i % 4 === 3) continue;
      glowAt(x, muzzle[1] - 1 - i, i < 6 ? 33 : 32);
    }
    // uchib ketayotgan gilzalar
    for (const [x, y] of [
      [14, 12],
      [22, 6],
      [82, 10],
      [88, 20],
      [8, 22],
    ] as const) {
      glowAt(x, y, 27);
      glowAt(x + 1, y, 26);
      glowAt(x + 2, y + 1, 1);
    }
  }
  return out;
}
