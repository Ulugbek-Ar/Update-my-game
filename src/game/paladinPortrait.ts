/**
 * PALADIN PORTRETI — ILOHIY HUKM cut-in kartasi uchun katta piksel-art (96x96, faqat ko'rinish).
 * Olddan qaragan, simmetrik paladin, beldan yuqori: tekis tepali silindr "chelak" dubulg'a (great
 * helm) — peshonada uch tishli toj, yuzda qorong'i "T" tirqish (ichidan oltin nur), ikki yonoqda
 * nafas teshikchalari; ikki yelkada qavat-qavat oltin plastinka, oq tabardda quyosh belgisi, ikki
 * qo'lqop ulkan qilich dastasida, tig' pastga.
 *
 * Soyalash: har material 4–5 tonda, yorug'lik yuqori-chapdan, o'ng chetda ingichka sovuq rim light
 * (yordamchilar — knightPortrait.ts). Ranglar qahramonning 5 rangli palitrasidan hosil qilinadi,
 * shuning uchun skinlar (Olov, Qora, Kumush Paladin) o'z ranglarida chiqadi. Math.random yo'q.
 */
import { barrel, cloth, inPoly, put, sphere } from "./knightPortrait";
import { Pixels } from "./sprites";

export const PALADIN_PORTRAIT_GRID = 96;
/** Kadrlar: 0 — tirqishda xira nur, 1 — nur kuchayadi va toj yaltiraydi, 2 — to'liq porlash */
export const PALADIN_PORTRAIT_FRAMES = 3;

const hex2 = (v: number) => Math.round(v).toString(16).padStart(2, "0");
function mix(a: string, b: string, k: number) {
  const n = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) || 0;
  return `#${[0, 1, 2].map((i) => hex2(n(a, i) + (n(b, i) - n(a, i)) * k)).join("")}`;
}

/**
 * 16 rang (indeks − 1) qahramonning 5 rangidan: 1 siyoh; 2..6 oltin (to'q bronza → yaltirash);
 * 7..10 oq tabard; 11..13 kumush tig'; 14, 15 tirqish nuri (oltin → oq yadro); 16 sovuq rim light.
 */
export function paladinPortraitColors(five: readonly string[]): string[] {
  const [
    ink = "#000000",
    bronze = "#7a5a12",
    gold = "#f2c14e",
    steel = "#aab4c4",
    holy = "#fbf8ec",
  ] = five;
  const W = "#ffffff";
  return [
    ink,
    mix(ink, bronze, 0.5),
    bronze,
    mix(bronze, gold, 0.5),
    gold,
    mix(gold, W, 0.55),
    mix(holy, ink, 0.55),
    mix(holy, bronze, 0.42),
    mix(holy, bronze, 0.16),
    holy,
    mix(steel, ink, 0.55),
    steel,
    mix(steel, W, 0.6),
    mix(gold, holy, 0.4),
    mix(holy, W, 0.6),
    mix(steel, W, 0.45),
  ];
}

const L = (() => {
  const v = [-0.55, -0.65, 0.55];
  const m = Math.hypot(...v);
  return v.map((x) => x / m) as [number, number, number];
})();
const gold = (lum: number) =>
  lum > 0.9 ? 6 : lum > 0.66 ? 5 : lum > 0.36 ? 4 : lum > 0.08 ? 3 : 2;

/**
 * Portret piksellari (siyoh kontur bilan). frame: 0..2 (PALADIN_PORTRAIT_FRAMES).
 */
export function paladinPortraitPixels(frame: number) {
  const p = new Pixels(PALADIN_PORTRAIT_GRID);
  const f = Math.max(0, Math.min(2, frame));
  const cx = 48;

  // ---------- ko'krak zirhi va oq tabard ----------
  barrel(
    p,
    inPoly([
      [27, 58],
      [69, 58],
      [67, 95],
      [29, 95],
    ]),
    cx,
    22,
    58,
    95,
    -0.25,
    -0.22,
  );
  const tabard = inPoly([
    [36, 60],
    [60, 60],
    [63, 95],
    [33, 95],
  ]);
  cloth(
    p,
    tabard,
    [30, 58, 66, 95],
    (x, y) => 0.5 - (x - 36) / 34 + Math.sin(x * 0.85 + y * 0.04) * 0.3,
  );
  // tabard hoshiyasi: oltin chetlar
  for (let y = 61; y < 96; y++) {
    const k = (y - 60) / 35;
    put(p, 5, Math.round(36 - 3 * k), y);
    put(p, 4, Math.round(60 + 3 * k), y);
  }
  // quyosh belgisi
  for (let a = 0; a < 8; a++) {
    const t = (a / 8) * Math.PI * 2;
    p.line(
      a % 2 ? 4 : 5,
      [cx + Math.round(Math.cos(t) * 5), 67 + Math.round(Math.sin(t) * 5)],
      [cx + Math.round(Math.cos(t) * 7), 67 + Math.round(Math.sin(t) * 7)],
      1,
    );
  }
  sphere(p, cx + 0.5, 67.5, 3.6, 3.6, { rim: false, lift: 0.25 });

  // ---------- yelka plastinkalari: katta, qavat-qavat ----------
  for (const s of [-1, 1]) {
    const sx = cx + s * 30;
    const rim = s > 0;
    sphere(p, sx, 75, 11, 4.5, { rim, lift: -0.1 });
    sphere(p, sx, 70, 12.5, 5, { rim });
    sphere(p, sx, 61, 15, 10.5, { below: 66, rim, lift: 0.05 });
    p.line(1, [sx - 13, 66], [sx + 13, 66], 1);
    p.line(2, [sx - 11, 72], [sx + 11, 72], 1);
    // gumbaz hoshiyasidagi oltin qirra
    for (let x = sx - 12; x <= sx + 12; x++) if ((x - sx) * s > -8) put(p, 6, x, 65);
  }

  // ---------- bo'yin zirhi (gorjet) ----------
  sphere(p, cx, 55, 16, 6, { lift: -0.05, rim: false });
  sphere(p, cx, 52, 13, 4.5, { lift: 0.1, rim: false });
  p.line(2, [cx - 13, 56], [cx + 13, 56], 1);

  // ---------- dubulg'a: tekis tepali silindr ----------
  const R = 18.5;
  const top = 8;
  const bottomAt = (x: number) => {
    const nx = (x + 0.5 - cx) / R;
    return 46 + Math.round(3 * Math.sqrt(Math.max(0, 1 - nx * nx)));
  };
  for (let x = cx - 18; x <= cx + 18; x++) {
    const nx = (x + 0.5 - cx) / R;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx));
    const by = bottomAt(x);
    for (let y = top; y <= by; y++) {
      const lum = nx * L[0] - 0.15 * L[1] + nz * L[2] - ((y - top) / (by - top)) * 0.18 + 0.05;
      put(p, nx > 0.84 ? 16 : gold(lum), x, y);
    }
    put(p, 1, x, by + 1);
  }
  // tekis qopqoq: yuqoridan ko'rinadigan yupqa ellips, oldingi qirrasi yorug'
  for (let x = cx - 18; x <= cx + 18; x++) {
    const nx = (x + 0.5 - cx) / R;
    const h = Math.sqrt(Math.max(0, 1 - nx * nx)) * 3;
    for (let y = Math.round(top - h); y <= Math.round(top + h); y++) {
      const lip = y >= Math.round(top + h) - 0;
      put(p, lip ? (nx < 0.35 ? 6 : 5) : nx < -0.2 ? 5 : 4, x, y);
    }
  }
  // tepa hoshiyasi (mustahkamlovchi tasma) va parchinlar
  for (let x = cx - 18; x <= cx + 18; x++) {
    const nx = (x + 0.5 - cx) / R;
    const ty = top + Math.round(Math.sqrt(Math.max(0, 1 - nx * nx)) * 3);
    put(p, nx > 0.84 ? 16 : nx < -0.25 ? 5 : 4, x, ty + 2);
    put(p, 2, x, ty + 4);
    put(p, 2, x, bottomAt(x) - 3);
  }
  for (const dx of [-14, -7, 7, 14]) {
    const x = cx + dx;
    const nx = (x + 0.5 - cx) / R;
    const ty = top + Math.round(Math.sqrt(1 - nx * nx) * 3) + 2;
    put(p, 6, x, ty);
    put(p, 2, x + 1, ty + 1);
    const by = bottomAt(x) - 1;
    put(p, 6, x, by);
    put(p, 2, x + 1, by + 1);
  }

  // ---------- "T" tirqish ----------
  const sy0 = 24; // ko'z tirqishi tepasi
  const sh = 5; // balandligi
  const sw = 15; // yarim kengligi
  const stemW = 2; // tik tirqish yarim kengligi (o'rta piksel ± stemW)
  const stemEnd = 43;
  const inSlit = (x: number, y: number) =>
    (y >= sy0 &&
      y < sy0 + sh &&
      Math.abs(x - cx) <= sw - (y === sy0 || y === sy0 + sh - 1 ? 1 : 0)) ||
    (y >= sy0 + sh && y <= stemEnd && Math.abs(x - cx) <= stemW);
  // qirralar: tepa labi yorug', past labi va tik tirqishning chap devori soyada
  for (let x = cx - sw; x <= cx + sw; x++) {
    put(p, x < cx + 6 ? 6 : 5, x, sy0 - 1);
    if (Math.abs(x - cx) > stemW) put(p, 2, x, sy0 + sh);
  }
  for (let y = sy0 + sh; y <= stemEnd + 1; y++) {
    put(p, 2, cx - stemW - 1, y);
    put(p, 6, cx + stemW + 1, y);
  }
  for (let x = cx - stemW; x <= cx + stemW; x++) put(p, 2, x, stemEnd + 1);
  // ichidagi nur: tirqish qorong'i qoladi, o'rtasidan ingichka oltin nur chizig'i — kadr sayin
  // uzayadi va oq yadro paydo bo'ladi
  const midRow = sy0 + Math.floor((sh - 1) / 2);
  const reach = [5, 10, 13][f]!;
  const core = [0, 3, 7][f]!;
  const stemLen = [3, 9, 99][f]!;
  for (let y = sy0; y <= stemEnd; y++)
    for (let x = cx - sw; x <= cx + sw; x++) {
      if (!inSlit(x, y)) continue;
      const d = Math.abs(x - cx);
      let c = 1;
      if (y < sy0 + sh) {
        if (y === midRow && d <= reach) c = d < core ? 15 : 14;
        else if (sh > 3 && f === 2 && Math.abs(y - midRow) === 1 && d < 4) c = 14;
      } else {
        const down = y - (sy0 + sh);
        if (d === 0 && down < stemLen) c = f > 0 && down < 4 + f * 4 ? 15 : 14;
        else if (d === 1 && f === 2 && down < 6) c = 14;
      }
      put(p, c, x, y);
    }

  // ---------- nafas teshikchalari: ikki yonoqda 3 qator ----------
  for (const row of [0, 1, 2]) {
    const y = 31 + row * 3;
    for (const dx of [13, 10, 7]) {
      if (dx === 7 && row === 2) continue;
      for (const s of [-1, 1]) {
        const x = s < 0 ? cx - dx - 1 : cx + dx;
        put(p, 1, x, y);
        put(p, 1, x + 1, y);
        put(p, s < 0 ? 6 : 5, x, y + 1);
        put(p, s < 0 ? 5 : 4, x + 1, y + 1);
        if (f === 2) put(p, 14, x + (s < 0 ? 1 : 0), y);
        else if (f === 1 && row === 0) put(p, 14, x + (s < 0 ? 1 : 0), y);
      }
    }
  }

  // ---------- uch tishli toj (peshonada) ----------
  const crown = (scale: number, baseY: number) => {
    const w = Math.round(6 * scale); // asos yarim kengligi
    const side = Math.round(4 * scale); // yon tish o'rni
    const hS = Math.round(4 * scale),
      hC = Math.round(6 * scale);
    // siyoh kontur (bir piksel kattaroq) va oltin to'ldirish
    const prongs = (grow: number, c: number) => {
      p.polygon(c, [
        [cx - side - 2 - grow + 0.5, baseY + 0.5],
        [cx - side + 0.5, baseY - hS - grow + 0.5],
        [cx - side + 2 + grow + 0.5, baseY + 0.5],
      ]);
      p.polygon(c, [
        [cx + side - 2 - grow + 0.5, baseY + 0.5],
        [cx + side + 0.5, baseY - hS - grow + 0.5],
        [cx + side + 2 + grow + 0.5, baseY + 0.5],
      ]);
      p.polygon(c, [
        [cx - 2 - grow + 0.5, baseY + 0.5],
        [cx + 0.5, baseY - hC - grow + 0.5],
        [cx + 2 + grow + 0.5, baseY + 0.5],
      ]);
      p.rect(c, cx - w - grow, baseY - grow, w * 2 + 1 + grow * 2, 3 + grow * 2);
    };
    prongs(1, 1);
    prongs(0, 5);
    // chap tomoni yorug', o'ng tomoni soyada, asos tasmasi
    for (let x = cx - w; x <= cx + w; x++) {
      put(p, x <= cx ? 6 : 5, x, baseY);
      put(p, 4, x, baseY + 1);
      put(p, 3, x, baseY + 2);
    }
    // tish uchlaridagi sharchalar
    const tips: [number, number][] = [
      [cx - side, baseY - hS - 1],
      [cx, baseY - hC - 1],
      [cx + side, baseY - hS - 1],
    ];
    for (const [tx, ty] of tips) {
      put(p, 1, tx, ty - 1);
      put(p, 1, tx - 1, ty);
      put(p, 1, tx + 1, ty);
      put(p, 6, tx, ty);
    }
    // markaziy qimmatbaho tosh
    put(p, 1, cx - 1, baseY + 1);
    put(p, 1, cx + 1, baseY + 1);
    put(p, f > 0 ? 15 : 14, cx, baseY + 1);
    // yaltirash: 1 — chap tish, 2 — markaziy tish ustida to'rt nurli yulduz
    if (f >= 1) {
      const [gx, gy] = f === 1 ? tips[0]! : tips[1]!;
      const r = f === 1 ? 1 : 3;
      put(p, 15, gx, gy);
      for (let i = 1; i <= r; i++) {
        const c = i === r ? 14 : 15;
        put(p, c, gx - i, gy);
        put(p, c, gx + i, gy);
        put(p, c, gx, gy - i);
        if (i < r || f === 1) put(p, c, gx, gy + i);
      }
    }
  };
  crown(1, 19);

  // ---------- bilaklar: yelkadan qo'lqopgacha ----------
  const limb = (a: [number, number], b: [number, number], light: boolean) => {
    p.line(1, a, b, 9);
    p.line(light ? 4 : 3, a, b, 7);
    p.line(light ? 5 : 4, [a[0] - 1, a[1] - 1], [b[0] - 1, b[1] - 1], 3);
    p.line(light ? 6 : 5, [a[0] - 2, a[1] - 2], [b[0] - 2, b[1] - 2], 1);
  };
  // yelka ostidan tirsakkacha pastga, so'ng bilak qo'lqopga qarab ichkariga
  limb([20, 78], [16, 87], true);
  limb([76, 78], [80, 87], false);
  limb([16, 87], [38, 82], true);
  limb([80, 87], [58, 82], false);

  // ---------- qilich: ikki qo'lqop dastada (boldoq ustki mushtda), garda, tig' pastga ----------
  for (const y of [74, 81]) {
    p.polygon(1, [
      [39, y],
      [57, y],
      [58, y + 2],
      [58, y + 7],
      [57, y + 8],
      [39, y + 8],
      [38, y + 7],
      [38, y + 2],
    ]);
    const fist = (x: number, yy: number) => x > 39.5 && x < 56.5 && yy > y + 0.5 && yy < y + 7.5;
    barrel(p, fist, cx + 0.5, 10, y + 1, y + 7, -0.3, -0.12);
    // bo'g'im yaltirashi va barmoq oraliqlari (simmetrik)
    for (const x of [42, 46, 50, 54]) put(p, 6, x, y + 2);
    for (const x of [44, 48, 52]) for (let k = 3; k <= 5; k++) put(p, 2, x, y + k);
    for (let x = 40; x <= 56; x++) put(p, 2, x, y + 7);
  }
  // garda: keng, uchlari pastga burilgan
  for (let x = 30; x <= 66; x++) {
    put(p, 1, x, 89);
    put(p, x < cx ? 6 : 5, x, 90);
    put(p, 4, x, 91);
    put(p, 1, x, 92);
  }
  for (const s of [-1, 1]) {
    const ex = cx + s * 18;
    p.rect(1, ex - 2, 89, 5, 6);
    p.rect(s < 0 ? 5 : 4, ex - 1, 90, 3, 4);
    put(p, 6, ex - 1, 90);
  }
  sphere(p, cx + 0.5, 90.5, 3, 2.5, { rim: false });
  put(p, 14, cx, 90);
  // tig': kumush, o'rtada yorug' qirra
  for (let y = 93; y < 96; y++)
    for (let x = 43; x <= 53; x++)
      put(p, x === 43 || x === 53 ? 1 : x === cx ? 13 : x < cx ? 12 : x === 52 ? 16 : 11, x, y);

  return p.outlined();
}
