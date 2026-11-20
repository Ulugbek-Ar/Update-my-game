/**
 * OVCHI PORTRETI — O'N O'Q OVI cut-in kartasi uchun katta piksel-art (96x96, faqat ko'rinish; o'yindagi
 * Ovchi spraytiga tegmaydi). Olddan, simmetrik, beldan yuqori. Uchli yashil qalpoq, ostida chuqur soya —
 * undan faqat ikki keskin, yashil-oltin porlagan ko'z ko'rinadi; kamon gorizontal ushlangan va tomoshabinga
 * qarab TORTILGAN: o'q uchi markazda bizga qaragan, ip ikki uchdan iyakdagi tortuvchi qo'lga keladi.
 *
 * Soyalash: har material 4–5 tonda, yorug'lik yuqori-chapdan; qalpoqning o'ng chetida yashil-sariq rim
 * light. Math.random yo'q.
 *
 * Kadrlar: 0 — ip yarim tortilgan, ko'zlar xira; 1 — to'liq tortilgan (yelkalar bukiladi), ko'zlar
 * yonadi; 2 — o'q uchida yaltirash, ko'zlarda chaqnash, barglar shamolda uchadi.
 * Uslublar (tanlov uchun): 0 — o'rmon qo'riqchisi (yuzi ochiq, bargli yelkapo'sh);
 * 1 — soya ovchi (yuzi niqobda, charm yelkaliklar, uzun qalpoq).
 */
import { Pixels } from "./sprites";
import { at, clamp, domeNormal, inPolygon, overlay, put, shade, sym, type Pt } from "./portraitKit";

export const HUNTER_PORTRAIT_GRID = 96;
export const HUNTER_PORTRAIT_FRAMES = 3;
export const HUNTER_PORTRAIT_STYLES = 2;
/** O'yinga ulangan uslub (tanlangan nomzod) */
export const HUNTER_PORTRAIT_STYLE = 0;

/**
 * Ranglar (indeks − 1): 1 siyoh; 2..6 qalpoq yashili; 7..10 charm; 11..14 teri; 15..18 kamon yog'ochi;
 * 19 ip; 20 ko'z nuri, 21 ko'z yadrosi; 22 rim light; 23..24 po'lat; 25 yaltirash; 26 qalpoq ichi
 * (chuqur soya); 27 to'g'nog'ich toshi; 28..29 barg; 30 xira ko'z.
 */
export const HUNTER_PORTRAIT_COLORS = [
  "#060a06",
  "#0b170c",
  "#142a16",
  "#1f4322",
  "#326232",
  "#4f8a42",
  "#1e1009",
  "#3a2112",
  "#5e391e",
  "#8a5a30",
  "#2e1c12",
  "#5e3a26",
  "#996246",
  "#c98e66",
  "#24160a",
  "#46301a",
  "#6e4c26",
  "#9c7438",
  "#e6dcc0",
  "#c8ff5a",
  "#f4ffe0",
  "#a6e060",
  "#353c40",
  "#9aa6ac",
  "#ffffff",
  "#030603",
  "#e0c040",
  "#7ab84a",
  "#3c6e2c",
  "#4e7a2a",
] as const;

const HOOD = [2, 3, 4, 5, 6] as const;
const LEATHER = [7, 8, 9, 10] as const;
const SKIN = [11, 12, 13, 14] as const;
const RIM = 22;
const DEEP = 26;

/** Kamon yelkasi (chap): dastadan uchigacha; o'ng — ko'zgu */
function limb(drawn: boolean, big: boolean): Pt[] {
  const lift = big ? 2 : 0;
  return drawn
    ? [
        [44, 79],
        [34, 77],
        [24, 73 - lift],
        [15, 68 - lift],
        [9, 63 - lift],
        [6, 58 - lift],
        [3, 56 - lift],
      ]
    : [
        [44, 79],
        [34, 78],
        [24, 76 - lift],
        [15, 73 - lift],
        [9, 70 - lift],
        [6, 66 - lift],
        [3, 64 - lift],
      ];
}

export function hunterPortraitPixels(frame: number, style = HUNTER_PORTRAIT_STYLE) {
  const n = HUNTER_PORTRAIT_GRID;
  const p = new Pixels(n);
  const f = clamp(Math.round(frame), 0, 2);
  const s = clamp(Math.round(style), 0, 1);
  const drawn = f >= 1;
  const masked = s === 1;

  // ---------- gavda va plash ----------
  const body = inPolygon(
    sym([
      [3, 95],
      [5, 84],
      [10, 75],
      [19, 67],
      [32, 62],
      [48, 61],
    ]),
  );
  shade(
    p,
    body,
    [2, 58, 94, 95],
    (x, y) => [clamp((x - 48) / 44, -1, 1), -0.7 + (y - 62) * 0.03],
    HOOD,
    {
      rim: RIM,
      rimFrom: 64,
      rimTo: 82,
      lift: -0.18,
      noise: (x, y) => 0.18 * Math.sin(x * 0.7) * clamp((y - 80) / 10, 0, 1),
    },
  );
  // old tomonda to'q kamzul va charm kamar
  const vest = inPolygon(
    sym([
      [40, 66],
      [38, 95],
      [48, 95],
    ]),
  );
  shade(p, vest, [36, 64, 60, 95], (x) => [(x - 48) / 12, 0.2], HOOD, { lift: -0.42 });
  // kamzul ustidagi charm tasma va mis to'qa
  shade(
    p,
    (x, y) => y >= 88 && y < 91 && vest(x, y),
    [36, 88, 60, 90],
    (x) => [(x - 48) / 12, -0.4],
    LEATHER,
  );
  p.rect(27, 47, 88, 3, 3);
  put(p, 25, 47, 88);

  if (!masked) {
    // bargli yelkapo'sh: etagi barg shaklida tishli
    const pts: Pt[] = [];
    for (let i = 0; i <= 14; i++) {
      const x = 8 + i * (80 / 14);
      pts.push([
        x,
        i % 2 ? 77 + (Math.abs(i - 7) < 3 ? 3 : 0) : 72 + (Math.abs(i - 7) < 3 ? 3 : 0),
      ]);
    }
    const cape = inPolygon([
      [30, 60],
      [66, 60],
      [80, 66],
      [88, 73],
      ...pts.reverse(),
      [8, 73],
      [16, 66],
    ]);
    shade(
      p,
      cape,
      [6, 58, 90, 82],
      (x, y) => [clamp((x - 48) / 40, -1, 1), -0.8 + (y - 60) * 0.06],
      HOOD,
      {
        rim: RIM,
        rimFrom: 60,
        rimTo: 80,
        noise: (x, y) => 0.22 * Math.sin((x + y * 0.4) * 0.9),
      },
    );
    // barg tomirlari
    for (let i = 1; i < 14; i += 2) {
      const x = Math.round(8 + i * (80 / 14));
      for (let y = 70; y < 76; y++) if (at(p, x, y + 2)) put(p, 3, x, y + 2);
    }
  } else {
    // charm yelkaliklar (ikkala yelkada), mis bosmalar bilan
    for (const cx of [17, 79]) {
      const pad = (x: number, y: number) =>
        ((x - cx) / 13) ** 2 + ((y - 72) / 8) ** 2 <= 1 && y < 77;
      shade(p, pad, [cx - 14, 63, cx + 14, 78], domeNormal(cx, 72, 13, 8), LEATHER, {
        rim: RIM,
        rimFrom: 64,
        rimTo: 76,
      });
      for (const dx of [-7, 0, 7]) {
        put(p, 18, cx + dx, 70);
        put(p, 15, cx + dx, 71);
      }
      for (let x = cx - 12; x <= cx + 12; x++) if (at(p, x, 76)) put(p, 7, x, 76);
    }
  }

  // ---------- qalpoq ----------
  const peak = masked ? 1 : 4;
  const hoodPts = sym([
    [48, peak],
    [42, peak + 4],
    [34, 10],
    [27, 18],
    [23, 28],
    [21, 40],
    [21, 52],
    [23, 61],
    [28, 68],
    [36, 71],
  ]);
  const hood = inPolygon(hoodPts);
  shade(p, hood, [18, 0, 78, 72], domeNormal(48, 40, 29, 36), HOOD, {
    rim: RIM,
    rimFrom: 8,
    rimTo: 66,
    noise: (x, y) =>
      // yon burmalar: pastga tushgan sari chuqurroq
      0.16 * Math.sin(Math.abs(x - 48) * 0.55 + 1) * clamp((y - 30) / 30, 0, 1),
  });
  if (masked)
    // qalpoq choki: tepadan peshonagacha
    for (let y = 3; y < 22; y++) if (at(p, 48, y)) put(p, y % 3 ? 3 : 2, 48, y);

  // qalpoq og'zi: ichki lab (qalin chet), so'ng chuqur soya
  const lipPts = sym([
    [48, 21],
    [40, 22],
    [34, 27],
    [30, 35],
    [29, 45],
    [30, 54],
    [34, 61],
    [40, 66],
    [48, 68],
  ]);
  shade(p, inPolygon(lipPts), [28, 20, 68, 69], (x, y) => [-(x - 48) / 20, -(y - 44) / 24], HOOD, {
    lift: -0.25,
  });
  const holePts = sym([
    [48, 24],
    [41, 25],
    [36, 29],
    [33, 36],
    [32, 45],
    [33, 53],
    [36, 59],
    [41, 64],
    [48, 66],
  ]);
  const hole = inPolygon(holePts);
  for (let y = 22; y <= 67; y++)
    for (let x = 31; x <= 65; x++) if (hole(x + 0.5, y + 0.5)) put(p, DEEP, x, y);

  // ---------- yuz (yuqorisi qalpoq soyasida) ----------
  const face = inPolygon(
    sym([
      [48, 33],
      [41, 34],
      [37, 39],
      [36, 47],
      [38, 54],
      [42, 60],
      [48, 63],
    ]),
  );
  shade(p, face, [34, 32, 62, 64], domeNormal(48, 48, 13, 16), SKIN, {
    noise: (_x, y) => -1.25 + clamp((y - 43) / 14, 0, 1) * 1.3,
  });
  // peshona butunlay soyada
  for (let y = 33; y <= 40; y++)
    for (let x = 34; x <= 62; x++) if (face(x + 0.5, y + 0.5)) put(p, y < 38 ? DEEP : 11, x, y);

  // qoshlar: ichki uchi past (qahrli, keskin nigoh)
  const brow: Pt[] = [
    [37, 40],
    [38, 40],
    [39, 40],
    [40, 41],
    [41, 41],
    [42, 41],
    [43, 42],
    [44, 42],
  ];
  for (const [x, y] of brow) {
    put(p, 1, x, y);
    put(p, 1, 96 - x - 1, y);
  }
  // ko'zlar: ingichka, keskin, porlagan
  const glow = f === 0 ? 30 : 20;
  const eye: [number, number, number][] = [
    [38, 43, glow],
    [39, 43, glow],
    [40, 43, glow],
    [41, 43, f === 0 ? glow : 21],
    [42, 43, f === 0 ? glow : 21],
    [43, 43, glow],
    [40, 42, glow],
    [41, 42, glow],
    [42, 42, glow],
    [44, 44, 11],
  ];
  for (const [x, y, c] of eye) {
    put(p, c, x, y);
    put(p, c, 96 - x - 1, y);
  }
  // ko'z ostidagi soya chizig'i
  for (let x = 38; x <= 43; x++) {
    put(p, 11, x, 44);
    put(p, 11, 96 - x - 1, 44);
  }

  if (!masked) {
    // burun: o'ng yonida soya, uchida yorug'lik
    for (let y = 45; y <= 51; y++) put(p, 12, 49, y);
    for (let y = 46; y <= 50; y++) put(p, 13, 47, y);
    put(p, 14, 47, 51);
    put(p, 14, 48, 51);
    put(p, 11, 45, 52);
    put(p, 11, 50, 52);
    put(p, 12, 49, 52);
    // lablar: qattiq yumilgan
    for (let x = 43; x <= 52; x++) put(p, 11, x, 56);
    for (let x = 45; x <= 50; x++) put(p, 13, x, 57);
    put(p, 12, 43, 55);
    put(p, 12, 52, 55);
    // yonoq soyasi (o'ng tomonda)
    for (let y = 46; y <= 54; y++) if (at(p, 57, y)) put(p, 12, 57, y);
    // iyak ostidagi soya
    for (let x = 42; x <= 54; x++) if (at(p, x, 61)) put(p, 12, x, 61);
  } else {
    // niqob: burun ustidan bo'yingacha, gorizontal burmalar
    const mask = inPolygon(
      sym([
        [48, 46],
        [44, 47],
        [38, 48],
        [35, 50],
        [36, 58],
        [41, 65],
        [48, 67],
      ]),
    );
    shade(p, mask, [33, 45, 63, 68], domeNormal(48, 54, 14, 14), HOOD, {
      lift: -0.12,
      noise: (_x, y) => 0.2 * Math.sin(y * 1.3),
    });
    // burun uchi niqob ostida — yorug' chiziq
    put(p, 6, 47, 49);
    put(p, 6, 47, 50);
    put(p, 3, 49, 50);
  }

  // ---------- ko'krak to'g'nog'ichi (barg shaklida) ----------
  const brooch = (x: number, y: number) => Math.abs(x - 48) / 4 + Math.abs(y - 70) / 3 <= 1;
  for (let y = 67; y <= 73; y++)
    for (let x = 43; x <= 53; x++)
      if (brooch(x + 0.5, y + 0.5)) put(p, x + y < 117 ? 27 : 18, x, y);
  put(p, 25, 47, 69);

  // ---------- tortuvchi qo'l (ip shu yerda) ----------
  const draw: Pt = drawn ? [48, 64] : [48, 71];
  const handBox = (x: number, y: number) =>
    Math.abs(x - draw[0]) <= 4.5 && y >= draw[1] - 2.5 && y <= draw[1] + 3.5;
  shade(
    p,
    handBox,
    [draw[0] - 5, draw[1] - 3, draw[0] + 5, draw[1] + 4],
    domeNormal(draw[0], draw[1], 6, 5),
    SKIN,
    {
      lift: -0.15,
    },
  );
  for (const dx of [-2, 0, 2]) put(p, 11, draw[0] + dx, draw[1] + 1);
  // charm qo'lqop barmoqlari (ip ilinadigan joy)
  for (let x = draw[0] - 4; x <= draw[0] + 4; x++) put(p, 8, x, draw[1] - 2);

  // ---------- kamon ----------
  const L = limb(drawn, masked);
  const R = L.map(([x, y]) => [96 - x, y] as Pt);
  const tipL = L[L.length - 1]!,
    tipR = R[R.length - 1]!;
  // ip (kamon orqasida, tortuvchi qo'lga)
  p.line(19, tipL, draw, 1);
  p.line(19, tipR, draw, 1);
  for (const arm of [L, R]) {
    for (let i = 0; i < arm.length - 1; i++) {
      const a = arm[i]!,
        b = arm[i + 1]!;
      const w = i < 2 ? 3 : i < 4 ? 2 : 1;
      p.line(16, a, b, w);
      if (w >= 2) {
        p.line(18, [a[0], a[1] - 1], [b[0], b[1] - 1], 1);
        p.line(15, [a[0], a[1] + (w - 1)], [b[0], b[1] + (w - 1)], 1);
      } else p.line(17, a, b, 1);
    }
    // uchidagi suyak halqa
    const t = arm[arm.length - 1]!;
    put(p, 19, t[0], t[1]);
  }
  // dasta: charm o'ram
  shade(
    p,
    (x, y) => x >= 43 && x <= 53 && y >= 76 && y <= 84,
    [42, 76, 54, 84],
    domeNormal(48, 79, 6, 5),
    LEATHER,
  );
  for (let x = 44; x <= 52; x += 2) put(p, 7, x, 76);
  // kamon ushlagan musht
  const fist = (x: number, y: number) => ((x - 48) / 6) ** 2 + ((y - 81) / 4) ** 2 <= 1;
  shade(p, fist, [41, 77, 55, 85], domeNormal(47, 79, 6, 4), SKIN);
  for (const x of [45, 47, 49, 51]) {
    put(p, 11, x, 80);
    put(p, 11, x, 81);
  }

  // ---------- o'q uchi: bizga qaragan to'rt qirrali uch ----------
  const tipY = drawn ? 73 : 75;
  const rad = drawn ? 5 : 4;
  for (let y = tipY - rad; y <= tipY + rad; y++)
    for (let x = 48 - rad; x <= 48 + rad; x++) {
      const dx = x + 0.5 - 48.5,
        dy = y + 0.5 - (tipY + 0.5);
      if (Math.abs(dx) + Math.abs(dy) > rad + 0.3) continue;
      // qirralar: chap-yuqori yorug', o'ng-past qorong'i, markaz chizig'i
      const c = dx === 0 || dy === 0 ? 24 : dx < 0 && dy < 0 ? 24 : dx > 0 && dy > 0 ? 1 : 23;
      put(p, c, x, y);
    }
  put(p, f === 0 ? 24 : 25, 48, tipY);

  const out = p.outlined();
  const glowAt = overlay(out, n);

  // ---------- konturdan tashqari ----------
  if (f >= 1)
    // ko'z nuri qalpoq soyasiga tarqaladi
    for (const [x, y] of [
      [37, 42],
      [36, 43],
    ] as const) {
      glowAt(x, y, 30, true);
      glowAt(96 - x - 1, y, 30, true);
    }
  if (f === 2) {
    // ko'zlardan tashqariga ingichka chaqnash
    for (let i = 0; i < 5; i++) {
      glowAt(36 - i, 43 - (i > 2 ? 1 : 0), i < 2 ? 20 : 30, true);
      glowAt(59 + i, 43 - (i > 2 ? 1 : 0), i < 2 ? 20 : 30, true);
    }
    // o'q uchida yulduz yaltirash
    for (let r = rad + 1; r <= rad + 6; r++) {
      const c = r <= rad + 2 ? 25 : RIM;
      if (r % 2 && r > rad + 3) continue;
      glowAt(48, tipY - r, c, true);
      glowAt(48, tipY + r, c, true);
      glowAt(48 - r, tipY, c, true);
      glowAt(48 + r, tipY, c, true);
    }
    // shamolda uchgan barglar (o'ngdan chapga)
    for (const [x, y, big] of [
      [10, 20, 1],
      [80, 14, 1],
      [86, 40, 0],
      [8, 44, 0],
      [74, 30, 0],
      [16, 8, 0],
    ] as const) {
      glowAt(x, y, 28);
      glowAt(x + 1, y, 29);
      glowAt(x, y + 1, 29);
      if (big) {
        glowAt(x - 1, y - 1, 28);
        glowAt(x + 2, y + 1, 29);
      }
    }
  }
  return out;
}
