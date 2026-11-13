/**
 * Sakura bog'i (4-dunyo) spraytlari: Ninja-soya, Tengu-qush, Kitsune-olov va boss Oni.
 * Hammasi kod bilan chiziladi; har biri 5 rang (PALETTES, sprites.ts): 1 — siyoh (kontur va ko'z).
 * Moblar 32x32 to'rda, Oni — 40x40 to'rda (boshqa bosslardek 2 baravar kattalashtirib chiziladi).
 */
import type { AnimState } from "./animation";
import type { Pixels } from "./sprites";

type Point = readonly [number, number];
type Live = Exclude<AnimState, "death">;
export type SakuraKind = "ninja" | "tengu" | "kitsune" | "oni";

/** Oni kadr to'ri (piksel) */
export const ONI_GRID = 40;

// ---------------- Ninja-soya ----------------

interface NinjaFrame {
  b: number;
  /** tananing oldinga engashishi */
  lean: number;
  lf: Point;
  rf: Point;
  /** tig' ushlagan qo'l va tig' uchi (null — tig' ko'rinmaydi) */
  hand: Point;
  tip: Point | null;
  off: Point;
  /** sharfning hilpirashi */
  scarf: number;
  /** tana o'rniga tutun: 1 — quyuq bulut, 2 — tarqalayotgan */
  smoke?: 1 | 2;
  /** tig' uchida chaqnash — zarba ogohlantirishi */
  glint?: boolean;
}

const ninjaFrames: Record<Live, readonly NinjaFrame[]> = {
  idle: [
    {
      b: 0,
      lean: 0,
      lf: [13, 27],
      rf: [19, 27],
      hand: [22, 19],
      tip: [27, 24],
      off: [10, 19],
      scarf: 0,
    },
    {
      b: 1,
      lean: 0,
      lf: [13, 27],
      rf: [19, 27],
      hand: [22, 20],
      tip: [27, 25],
      off: [10, 20],
      scarf: 1,
    },
  ],
  // past turib yuguradi, sharf orqaga cho'ziladi
  walk: [
    {
      b: 0,
      lean: 1,
      lf: [10, 27],
      rf: [21, 26],
      hand: [23, 18],
      tip: [28, 22],
      off: [9, 17],
      scarf: -1,
    },
    {
      b: 1,
      lean: 1,
      lf: [14, 27],
      rf: [18, 27],
      hand: [22, 19],
      tip: [27, 23],
      off: [10, 19],
      scarf: 0,
    },
    {
      b: 0,
      lean: 1,
      lf: [20, 26],
      rf: [11, 27],
      hand: [23, 18],
      tip: [28, 22],
      off: [9, 17],
      scarf: -1,
    },
    {
      b: 1,
      lean: 1,
      lf: [17, 27],
      rf: [14, 27],
      hand: [22, 19],
      tip: [27, 23],
      off: [10, 19],
      scarf: 0,
    },
  ],
  // 0 — tutun (g'oyib bo'lish/paydo bo'lish), 1 — tig' ko'tarilgan (ogohlantirish), 2 — kesish
  attack: [
    {
      b: 0,
      lean: 0,
      lf: [13, 27],
      rf: [19, 27],
      hand: [22, 19],
      tip: null,
      off: [10, 19],
      scarf: 0,
      smoke: 1,
    },
    {
      b: -1,
      lean: -1,
      lf: [12, 27],
      rf: [20, 27],
      hand: [21, 8],
      tip: [26, 2],
      off: [11, 16],
      scarf: 1,
      glint: true,
    },
    {
      b: 1,
      lean: 3,
      lf: [10, 27],
      rf: [23, 27],
      hand: [26, 18],
      tip: [30, 23],
      off: [9, 14],
      scarf: -2,
    },
  ],
  hurt: [
    {
      b: 1,
      lean: -2,
      lf: [12, 27],
      rf: [19, 27],
      hand: [21, 13],
      tip: [25, 8],
      off: [7, 14],
      scarf: 2,
    },
  ],
};

function smokePuff(p: Pixels, k: 1 | 2, eyes: boolean) {
  if (k === 1) {
    p.ellipse(3, 16, 18, 8, 7);
    p.ellipse(3, 10, 22, 5, 4);
    p.ellipse(3, 22, 21, 5, 5);
    p.ellipse(3, 15, 11, 5, 4);
    p.ellipse(2, 16, 20, 5, 4);
    p.ellipse(5, 13, 14, 2, 1.5);
    p.rect(5, 20, 16, 2, 1);
    if (eyes) {
      // tutun ichida ikki qizil ko'z
      p.rect(4, 14, 19, 1, 1);
      p.rect(4, 18, 19, 1, 1);
    }
    return;
  }
  p.ellipse(3, 9, 20, 4, 3);
  p.ellipse(3, 22, 22, 4, 3);
  p.ellipse(3, 16, 12, 3.5, 3);
  p.ellipse(2, 24, 13, 2, 2);
  p.ellipse(2, 7, 12, 2, 1.5);
  p.rect(5, 15, 24, 3, 1);
}

/** Ninja-soya: to'q libos, qizil sharf va belbog', niqob tirqishida qizil ko'zlar, qisqa tig'. */
function ninja(p: Pixels, f: NinjaFrame) {
  if (f.smoke) return smokePuff(p, f.smoke, true);
  const b = f.b,
    l = f.lean;
  // sharf
  p.line(4, [12 + l, 11 + b], [7 + l, 12 + b + f.scarf], 2);
  p.line(4, [7 + l, 12 + b + f.scarf], [4 + l, 14 + b + f.scarf * 2], 1);
  // oyoqlar
  p.line(2, [14 + l, 21 + b], f.lf, 3);
  p.line(2, [18 + l, 21 + b], f.rf, 3);
  p.rect(3, f.lf[0] - 1, f.lf[1] - 2, 3, 1);
  p.rect(3, f.rf[0] - 1, f.rf[1] - 2, 3, 1);
  // tana
  p.rect(2, 12 + l, 13 + b, 8, 9);
  p.line(3, [13 + l, 13 + b], [16 + l, 17 + b], 1);
  p.line(3, [19 + l, 13 + b], [16 + l, 17 + b], 1);
  p.rect(4, 12 + l, 19 + b, 8, 1);
  // qo'llar
  p.line(2, [12 + l, 14 + b], f.off, 2);
  p.line(2, [20 + l, 14 + b], f.hand, 2);
  p.rect(3, f.off[0] - 1, f.off[1] - 1, 2, 1);
  // bosh: kapyushon, tirqish va ko'zlar
  p.ellipse(2, 16 + l, 8.5 + b, 4.5, 4.5);
  p.rect(5, 13 + l, 7 + b, 6, 2);
  p.rect(4, 14 + l, 8 + b, 1, 1);
  p.rect(4, 17 + l, 8 + b, 1, 1);
  p.rect(4, 11 + l, 6 + b, 1, 2);
  p.rect(3, 15 + l, 4 + b, 3, 1);
  if (f.tip) {
    p.line(5, f.hand, f.tip, 1);
    p.rect(4, f.hand[0] - 1, f.hand[1], 2, 1);
    if (f.glint) {
      p.rect(5, f.tip[0] - 1, f.tip[1], 3, 1);
      p.rect(5, f.tip[0], f.tip[1] - 1, 1, 3);
    }
  }
}

function ninjaFallen(p: Pixels, frame: number) {
  if (frame === 0)
    return ninja(p, {
      b: 4,
      lean: -1,
      lf: [11, 27],
      rf: [20, 27],
      hand: [22, 22],
      tip: [28, 26],
      off: [8, 22],
      scarf: 2,
    });
  // tutunga aylanib yo'qoladi, tig' yerda qoladi
  smokePuff(p, frame === 1 ? 1 : 2, false);
  p.line(5, [8, 27], [22, 27], 1);
  p.rect(4, 22, 27, 2, 1);
}

// ---------------- Tengu-qush ----------------

interface TenguFrame {
  by: number;
  /** qanot ko'tarilishi: -1 pastda, 0 o'rtada, 2 tepada */
  wing: number;
  /** yerda: qanotlar yig'ilgan */
  fold?: boolean;
  /** sho'ng'ish: qanotlar tanaga yopishgan */
  tuck?: boolean;
  talons?: boolean;
  blink?: boolean;
}

const tenguFrames: Record<Live, readonly TenguFrame[]> = {
  idle: [
    { by: 1, wing: 0, fold: true },
    { by: 1, wing: 0, fold: true, blink: true },
  ],
  // uchish: qanot qoqish
  walk: [
    { by: 0, wing: 2 },
    { by: -1, wing: 1 },
    { by: 0, wing: -1 },
    { by: 1, wing: 0 },
  ],
  // 0 — qanotlar yig'ildi, 1 — tirnoqlar oldinda, 2 — yerga qo'ndi (qanotlar yoyilgan)
  attack: [
    { by: -1, wing: 0, tuck: true },
    { by: 1, wing: 0, tuck: true, talons: true },
    { by: 2, wing: 1, talons: true },
  ],
  hurt: [{ by: 1, wing: -1, blink: true }],
};

/** Tengu-qush: qizil yuz va uzun burun, oq yol va soqol, to'q hakama, qora qanotlar, oltin tirnoqlar. */
function tengu(p: Pixels, f: TenguFrame) {
  const b = f.by;
  if (f.fold || f.tuck) {
    // qanotlar tanaga yopishgan
    p.polygon(2, [
      [10, 12 + b],
      [6, 25 + b],
      [12, 23 + b],
    ]);
    p.polygon(2, [
      [22, 12 + b],
      [26, 25 + b],
      [20, 23 + b],
    ]);
  } else {
    const w = f.wing;
    for (const side of [-1, 1]) {
      // pog'onali pat uchlari bilan keng qanot
      p.polygon(2, [
        [16 + side * 4, 14 + b],
        [16 + side * 15, 11 + b - w * 4],
        [16 + side * 15, 15 + b - w * 3],
        [16 + side * 13, 16 + b - w * 2],
        [16 + side * 13, 19 + b - w * 2],
        [16 + side * 10, 19 + b - w],
        [16 + side * 10, 22 + b],
        [16 + side * 4, 21 + b],
      ]);
      p.line(3, [16 + side * 7, 16 + b], [16 + side * 13, 13 + b - w * 3], 1);
    }
  }
  // oq to'n, qizil belbog', to'q hakama
  p.ellipse(3, 16, 17 + b, 5.5, 4.5);
  p.polygon(2, [
    [11, 20 + b],
    [22, 20 + b],
    [23, 25 + b],
    [10, 25 + b],
  ]);
  p.rect(4, 11, 19 + b, 11, 1);
  p.rect(4, 13, 15 + b, 2, 2);
  p.rect(4, 18, 15 + b, 2, 2);
  p.rect(3, 16, 21 + b, 1, 4);
  // oyoq va tirnoqlar
  const ty = f.talons ? 26 + b : 25 + b;
  p.rect(5, 13, ty, 2, f.talons ? 3 : 2);
  p.rect(5, 18, ty, 2, f.talons ? 3 : 2);
  if (f.talons) {
    p.rect(1, 12, ty + 3, 3, 1);
    p.rect(1, 18, ty + 3, 3, 1);
  }
  // bosh: oq yol, qizil yuz, qora qalpoqcha (tokin), uzun burun, oq soqol
  p.ellipse(3, 15, 9 + b, 6.5, 5.5);
  p.ellipse(4, 17.5, 9 + b, 4.5, 4);
  p.rect(2, 16, 2 + b, 3, 3);
  p.line(4, [20, 10 + b], [26, 11 + b], 2);
  p.rect(3, 18, 12 + b, 3, 2);
  // qiyiq qosh va oltin ko'z
  p.line(1, [15, 6 + b], [19, 8 + b], 1);
  if (f.blink) p.rect(1, 16, 8 + b, 3, 1);
  else {
    p.rect(5, 16, 8 + b, 3, 2);
    p.rect(1, 18, 9 + b, 1, 1);
  }
}

function tenguFallen(p: Pixels, frame: number) {
  if (frame === 0) return tengu(p, { by: 3, wing: -1, blink: true });
  // patlar sochilib yotibdi
  const y = frame === 1 ? 21 : 25;
  p.polygon(2, [
    [4, y + 3],
    [12, y - 1],
    [20, y - 1],
    [28, y + 3],
    [16, y + 5],
  ]);
  p.ellipse(3, 15, y + 1, 5, frame === 1 ? 4 : 2.5);
  p.ellipse(4, 22, y - 1, 3.5, 3);
  p.line(4, [24, y], [28, y + 1], 2);
  p.rect(1, 21, y - 1, 3, 1);
  p.rect(3, 6, y - 5 + frame, 2, 1);
  p.rect(2, 25, y - 5 + frame, 1, 2);
}

// ---------------- Kitsune-olov ----------------

interface FoxFrame {
  b: number;
  /** qadam bosqichi: 0 — tik turibdi, 1/3 — oyoqlar ayri, 2 — sakrashda */
  legs: 0 | 1 | 2 | 3;
  tail: number;
  /** dum uchlaridagi ko'k olov: 1 — yig'ilmoqda, 2 — tayyor */
  flare?: 1 | 2;
  mouth?: boolean;
}

const foxFrames: Record<Live, readonly FoxFrame[]> = {
  idle: [
    { b: 0, legs: 0, tail: 0 },
    { b: 0, legs: 0, tail: 1 },
  ],
  walk: [
    { b: 0, legs: 1, tail: 0 },
    { b: -1, legs: 2, tail: 1 },
    { b: 0, legs: 3, tail: 0 },
    { b: -1, legs: 2, tail: -1 },
  ],
  // 0 — dumlar ko'tariladi, 1 — uchta ko'k olov tayyor, 2 — otdi (og'iz ochiq)
  attack: [
    { b: 1, legs: 0, tail: -1, flare: 1 },
    { b: 1, legs: 0, tail: -2, flare: 2 },
    { b: 0, legs: 0, tail: 1, flare: 1, mouth: true },
  ],
  hurt: [{ b: 1, legs: 3, tail: 2 }],
};

/** Qadam bosqichidagi oyoq siljishlari: [uzoq orqa, uzoq old, yaqin orqa, yaqin old] */
const FOX_LEGS: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 0, 0],
  [-1, 1, 1, -1],
  [1, -1, 0, 0],
  [1, -1, -1, 1],
];

/** Kitsune-olov: oq tulki, quloq uchlari va yuzida qizil belgilar, uch dum, ko'k ko'z va olov. */
function kitsune(p: Pixels, f: FoxFrame) {
  const b = f.b;
  const t = f.tail;
  const fl = f.flare ?? 0;
  // uch egik dum: tayyorlanganda yelpig'ichdek yoyiladi, uchida ko'k olov
  const tips: Point[] = [
    [3 - fl, 13 + b + t],
    [5 - fl, 6 + b + t - fl],
    [11, 4 + b - t - fl],
  ];
  for (const [i, tip] of tips.entries()) {
    const mid: Point = [(10 + tip[0]) / 2 - 2 + i, (18 + b + tip[1]) / 2 + 1 - i];
    const col = i === 1 ? 3 : 2;
    p.line(col, [10, 18 + b], mid, 3);
    p.line(col, mid, tip, 3);
    p.line(3, [10, 17 + b], [mid[0], mid[1] - 1], 1);
    if (fl) p.ellipse(5, tip[0], tip[1] - 1, 1.4 + fl * 0.5, 1.8 + fl * 0.7);
    else p.ellipse(4, tip[0], tip[1], 1.6, 1.6);
  }
  const lg = FOX_LEGS[f.legs]!;
  const hop = f.legs === 2 ? -1 : 0;
  // uzoq oyoqlar
  p.rect(2, 12 + lg[0], 21 + b, 2, 6 + hop);
  p.rect(2, 21 + lg[1], 21 + b, 2, 6 + hop);
  // tana
  p.ellipse(3, 15, 19 + b, 7, 4);
  p.rect(2, 11, 22 + b, 8, 1);
  // yaqin oyoqlar
  p.rect(3, 9 + lg[2], 21 + b, 2, 7 + hop);
  p.rect(3, 18 + lg[3], 21 + b, 2, 7 + hop);
  // bo'yin va ko'krak
  p.polygon(3, [
    [18, 16 + b],
    [22, 11 + b],
    [26, 16 + b],
    [21, 22 + b],
  ]);
  // bosh, tumshuq, quloqlar
  p.ellipse(3, 24, 13 + b, 3.5, 3);
  p.polygon(3, [
    [26, 12 + b],
    [30, 14 + b],
    [26, 16 + b],
  ]);
  p.polygon(3, [
    [20, 11 + b],
    [21, 5 + b],
    [24, 10 + b],
  ]);
  p.polygon(3, [
    [24, 11 + b],
    [26, 5 + b],
    [28, 11 + b],
  ]);
  p.rect(4, 21, 6 + b, 1, 2);
  p.rect(4, 26, 6 + b, 1, 2);
  // yuz belgilari, ko'z, burun
  p.rect(4, 24, 10 + b, 1, 1);
  p.rect(4, 23, 14 + b, 1, 2);
  p.rect(5, 25, 12 + b, 2, 2);
  p.rect(1, 26, 13 + b, 1, 1);
  p.rect(1, 29, 14 + b, 1, 1);
  if (f.mouth) {
    p.rect(1, 27, 15 + b, 3, 1);
    p.rect(5, 30, 13 + b, 1, 2);
  }
}

function kitsuneFallen(p: Pixels, frame: number) {
  if (frame === 0) return kitsune(p, { b: 3, legs: 3, tail: 3 });
  // yonboshlab yotibdi, ustidan ko'k uchqunlar ko'tariladi
  const y = frame === 1 ? 23 : 25;
  p.ellipse(3, 15, y, 9, frame === 1 ? 3.5 : 2.5);
  p.ellipse(3, 24, y, 3.5, 2.5);
  p.line(2, [8, y], [2, y - 2], 2);
  p.rect(4, 1, y - 3, 2, 2);
  p.rect(1, 24, y, 2, 1);
  p.rect(4, 22, y - 3, 1, 2);
  p.rect(5, 10, y - 8 + frame * 2, 1, 2);
  p.rect(5, 17, y - 11 + frame * 2, 2, 2);
  p.rect(5, 22, y - 7 + frame, 1, 1);
}

// ---------------- Oni ----------------

interface OniFrame {
  b: number;
  lean: number;
  lf: Point;
  rf: Point;
  /** gurzi ushlagan qo'l va gurzi uchi */
  hand: Point;
  tip: Point;
  off: Point;
  roar?: boolean;
}

const oniFrames: Record<Live, readonly OniFrame[]> = {
  // gurzi yelkada
  idle: [
    { b: 0, lean: 0, lf: [14, 33], rf: [26, 33], hand: [32, 21], tip: [36, 5], off: [8, 23] },
    { b: 1, lean: 0, lf: [14, 33], rf: [26, 33], hand: [32, 22], tip: [36, 6], off: [8, 24] },
  ],
  walk: [
    { b: 0, lean: 1, lf: [12, 33], rf: [27, 32], hand: [32, 21], tip: [36, 5], off: [8, 22] },
    { b: 1, lean: 1, lf: [15, 33], rf: [25, 33], hand: [32, 22], tip: [37, 7], off: [8, 24] },
    { b: 0, lean: 1, lf: [17, 32], rf: [28, 33], hand: [32, 21], tip: [36, 5], off: [9, 22] },
    { b: 1, lean: 1, lf: [14, 33], rf: [26, 33], hand: [32, 22], tip: [37, 7], off: [8, 24] },
  ],
  // 0 — gurzi bosh uzra (tayyorgarlik, bo'kiradi), 1 — siltash, 2 — yerga urdi
  attack: [
    {
      b: 3,
      lean: -1,
      lf: [12, 33],
      rf: [27, 33],
      hand: [31, 7],
      tip: [14, 2],
      off: [8, 20],
      roar: true,
    },
    { b: 0, lean: 2, lf: [12, 33], rf: [27, 33], hand: [33, 14], tip: [38, 3], off: [9, 20] },
    { b: 2, lean: 3, lf: [11, 33], rf: [27, 33], hand: [31, 24], tip: [38, 35], off: [8, 22] },
  ],
  hurt: [
    {
      b: 1,
      lean: -2,
      lf: [13, 33],
      rf: [25, 33],
      hand: [33, 19],
      tip: [38, 9],
      off: [6, 18],
      roar: true,
    },
  ],
};

/** Temir gurzi (kanabo): ingichka dasta, yo'g'on boshi, suyak tikanlar. */
function kanabo(p: Pixels, hand: Point, tip: Point) {
  const dx = tip[0] - hand[0],
    dy = tip[1] - hand[1];
  const len = Math.hypot(dx, dy) || 1;
  const mid: Point = [hand[0] + dx * 0.3, hand[1] + dy * 0.3];
  p.line(4, [hand[0] - dx * 0.18, hand[1] - dy * 0.18], mid, 2);
  p.line(4, mid, tip, 5);
  const nx = (-dy / len) * 2,
    ny = (dx / len) * 2;
  for (const [i, k] of [0.45, 0.62, 0.8, 0.96].entries()) {
    const x = hand[0] + dx * k,
      y = hand[1] + dy * k;
    const s = i % 2 ? 1 : -1;
    p.rect(5, Math.round(x + nx * s), Math.round(y + ny * s), 1, 1);
    p.rect(5, Math.round(x), Math.round(y), 1, 1);
  }
}

/**
 * Oni: ulkan qizil dev — shoxlar, tishlar, yo'lbars terisi, temir gurzi.
 * cracked — 2-faza: niqob yorilgan, bir shoxi singan, o'ng ko'zi yonadi.
 */
function oni(p: Pixels, f: OniFrame, cracked: boolean) {
  const b = f.b,
    l = f.lean;
  // oyoqlar va tirnoqli panjalar
  for (const ft of [f.lf, f.rf]) {
    p.line(3, [ft === f.lf ? 16 + l / 2 : 24 + l / 2, 27 + b], ft, 5);
    p.rect(2, ft[0] - 2, ft[1] - 4, 5, 1);
    p.rect(3, ft[0] - 3, ft[1] + 1, 7, 2);
    p.rect(5, ft[0] - 3, ft[1] + 2, 1, 1);
    p.rect(5, ft[0], ft[1] + 2, 1, 1);
    p.rect(5, ft[0] + 3, ft[1] + 2, 1, 1);
  }
  // yo'lbars terisi va temir kamar
  p.polygon(5, [
    [12 + l, 24 + b],
    [29 + l, 24 + b],
    [27 + l, 30 + b],
    [20 + l, 32 + b],
    [14 + l, 30 + b],
  ]);
  p.rect(4, 15 + l, 26 + b, 1, 3);
  p.rect(4, 19 + l, 27 + b, 1, 4);
  p.rect(4, 23 + l, 26 + b, 1, 3);
  p.rect(4, 12 + l, 23 + b, 17, 2);
  p.rect(5, 19 + l, 23 + b, 3, 2);
  // gavda
  p.ellipse(3, 20.5 + l, 17 + b, 10, 8);
  p.line(2, [14 + l, 15 + b], [19 + l, 17 + b], 1);
  p.line(2, [27 + l, 15 + b], [22 + l, 17 + b], 1);
  p.rect(2, 20 + l, 20 + b, 1, 2);
  p.rect(2, 12 + l, 20 + b, 2, 1);
  p.rect(2, 27 + l, 20 + b, 2, 1);
  // suyak munchoqlar
  for (const [x, y] of [
    [15, 12],
    [17, 13],
    [19, 14],
    [22, 14],
    [24, 13],
    [26, 12],
  ] as const)
    p.rect(5, x + l, y + b, 1, 1);
  // yelkalar va qo'llar
  p.ellipse(3, 10.5 + l, 13 + b, 4, 4);
  p.ellipse(3, 30.5 + l, 13 + b, 4, 4);
  p.line(3, [10 + l, 14 + b], f.off, 4);
  p.line(3, [30 + l, 14 + b], f.hand, 4);
  p.rect(4, f.off[0] - 2, f.off[1] - 3, 4, 2);
  p.ellipse(3, f.off[0], f.off[1], 2.5, 2.5);
  // bosh: qo'ng'ir-qora yol, qizil yuz
  const hx = 20.5 + l,
    hy = 9 + b;
  p.ellipse(4, hx, hy - 1.5, 8, 6);
  p.ellipse(3, hx, hy + 0.5, 6, 5.5);
  // shoxlar (2-fazada chapi singan)
  if (cracked)
    p.polygon(5, [
      [15 + l, 5 + b],
      [14 + l, 3 + b],
      [17 + l, 4 + b],
    ]);
  else
    p.polygon(5, [
      [15 + l, 5 + b],
      [13 + l, 1 + b],
      [17 + l, 4 + b],
    ]);
  p.polygon(5, [
    [26 + l, 5 + b],
    [28 + l, 1 + b],
    [24 + l, 4 + b],
  ]);
  // qoshlar, ko'zlar, burun
  p.line(1, [15 + l, 7 + b], [18 + l, 9 + b], 1);
  p.line(1, [26 + l, 7 + b], [23 + l, 9 + b], 1);
  p.rect(5, 16 + l, 10 + b, 2, 1);
  if (cracked) p.rect(5, 22 + l, 9 + b, 3, 2);
  else p.rect(5, 23 + l, 10 + b, 2, 1);
  p.rect(2, 20 + l, 11 + b, 1, 1);
  // og'iz va tishlar
  p.rect(1, 17 + l, 13 + b, 7, f.roar ? 2 : 1);
  p.rect(5, 17 + l, 12 + b, 1, 2);
  p.rect(5, 23 + l, 12 + b, 1, 2);
  if (f.roar) {
    p.rect(5, 19 + l, 13 + b, 1, 1);
    p.rect(5, 21 + l, 13 + b, 1, 1);
  }
  if (cracked) {
    // niqob yorig'i
    p.line(1, [19 + l, 4 + b], [21 + l, 7 + b], 1);
    p.line(1, [21 + l, 7 + b], [20 + l, 10 + b], 1);
  }
  // gurzi va uni ushlagan musht (bilaguzuk bilan)
  kanabo(p, f.hand, f.tip);
  p.rect(4, f.hand[0] - 2, f.hand[1] - 3, 4, 2);
  p.ellipse(3, f.hand[0], f.hand[1], 2.5, 2.5);
}

function oniFallen(p: Pixels, frame: number, cracked: boolean) {
  if (frame === 0)
    return oni(
      p,
      {
        b: 4,
        lean: 0,
        lf: [12, 33],
        rf: [28, 33],
        hand: [33, 27],
        tip: [38, 35],
        off: [7, 28],
        roar: true,
      },
      cracked,
    );
  // yiqildi: gavda yerda, gurzi yonida
  const y = frame === 1 ? 28 : 31;
  p.ellipse(3, 21, y, 13, frame === 1 ? 6 : 4);
  p.ellipse(2, 21, y + 2, 9, 2);
  p.polygon(5, [
    [15, y - 3],
    [27, y - 3],
    [25, y + 1],
    [17, y + 1],
  ]);
  p.rect(4, 19, y - 3, 1, 4);
  p.rect(4, 23, y - 3, 1, 4);
  p.ellipse(4, 8, y - 2, 5.5, 4);
  p.ellipse(3, 8, y - 1, 4.5, 3.5);
  p.polygon(5, [
    [5, y - 4],
    [3, y - 8],
    [8, y - 5],
  ]);
  p.rect(1, 6, y, 4, 1);
  p.rect(5, 6, y - 1, 1, 1);
  p.line(4, [26, y + 4], [37, y + 5], 3);
  p.rect(5, 29, y + 4, 1, 1);
  p.rect(5, 34, y + 5, 1, 1);
}

/**
 * Sakura bog'i personajining bitta kadri (konturgacha). back — faqat Oni uchun: yorilgan niqob
 * (2-faza); moblarda e'tiborga olinmaydi.
 */
export function drawSakura(
  p: Pixels,
  kind: SakuraKind,
  state: AnimState,
  frame: number,
  back: boolean,
) {
  const f = Math.min(2, Math.max(0, frame));
  if (kind === "ninja") {
    if (state === "death") ninjaFallen(p, f);
    else ninja(p, ninjaFrames[state][frame] ?? ninjaFrames[state][0]!);
  } else if (kind === "tengu") {
    if (state === "death") tenguFallen(p, f);
    else tengu(p, tenguFrames[state][frame] ?? tenguFrames[state][0]!);
  } else if (kind === "kitsune") {
    if (state === "death") kitsuneFallen(p, f);
    else kitsune(p, foxFrames[state][frame] ?? foxFrames[state][0]!);
  } else if (state === "death") oniFallen(p, f, back);
  else oni(p, oniFrames[state][frame] ?? oniFrames[state][0]!, back);
}
