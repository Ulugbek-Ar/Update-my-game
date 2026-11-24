/**
 * BO'RI-QIZ VARVAR (qahramon, id "wolf") sprayti — kod bilan chizilgan pozalar (Rohiba naqshida).
 * Anime emas: boshida bo'ri quloqlari, uzun qora soch (ichida qizil tutam), ko'k ko'zlar, yelkasida
 * oq-kulrang mo'ynali plash, YOPIQ metall zirh (ko'krak, qo'l va oyoqlar to'liq yopiq), bo'ynida va
 * bilagida oltin taqinchoqlar, qo'llarida temir qo'lqop-panjalar. Kuchli, yovvoyi, dadil — bolalar uchun
 * ham munosib.
 *
 * 5 rang (sprites.ts: PALETTES.wolf): 1 — siyoh (kontur, qora soch, etik), 2 — ko'kish po'lat (zirh,
 * qo'lqop, ko'zlar), 3 — oq-kulrang mo'yna (plash, panja uchlari, zirh yaltirog'i), 4 — oltin (bo'yin
 * va bilak taqinchog'i), 5 — teri. Qizil tutam — sochdagi kichik urg'u (WOLF_TUFT, renderSprite
 * chizadi), g'azabdagi qizil ko'zlar — effekt (renderWolfEyes).
 *
 * To'r 48x48: tana 32x32 da o'rtada; panjalar, sakrash va uvlash chetga chiqadi (vizual —
 * to'qnashuvdan mustaqil).
 */
import { px, type AnimState } from "./animation";
import type { Pixels } from "./sprites";

type Point = readonly [number, number];

export const WOLF_GRID = 48;
const OFF = (WOLF_GRID - 32) / 2;

/** Sochdagi qizil tutam rangi (barcha skinlarda — Varvarning belgisi) */
export const WOLF_TUFT = "#d8283a";
/** G'azabdagi ko'zlar porlashi */
export const WOLF_FURY_EYES = "#ff3b3b";

/** "attack" holatidagi maxsus kadrlar (Player.wolfFrame tanlaydi) */
export const WOLF_FRAME = {
  /** 0..2 — o'ng panja (tortish, zarba, qaytish); 3..5 — chap panja */
  left: 3,
  /** BO'RI SAKRASHI zaryadi: cho'kkalab, panjalar oldinda */
  aim: 6,
  /** havoda: oldinga cho'zilib uchadi, plash orqaga */
  leap: 7,
  /** qo'nish: panjalar yerga uriladi */
  land: 8,
  /** yovvoyi yugurish: yelka oldinda engashgan */
  rush: 9,
} as const;

/** BO'RI UVLASHI super kadrlari: boshini ko'tarib uvlaydi, so'ng panjalarni yoyib to'dani chaqiradi */
export const WOLF_SUPER_FRAME = { howl: 10, call: 11 } as const;

interface Pose {
  bob: number;
  lean: number;
  /** cho'kkalash (gavda pastga) */
  low?: number;
  /** havoga ko'tarilish (sakrash) */
  lift?: number;
  /** plash etagi tebranishi (px, − orqaga) */
  hem: number;
  /** oyoq uchlari (x) */
  lf: number;
  rf: number;
  /** o'ng (old) va chap (orqa) qo'l panjasi */
  hand: Point;
  off: Point;
  /** panja izi (zarba lahzasi) */
  slash?: "r" | "l";
  /** boshini ko'tarib uvlaydi */
  howl?: boolean;
  /** yotib qolgan (o'lim) */
  lying?: boolean;
}

// prettier-ignore
const IDLE: readonly Pose[] = [
  { bob: 0, lean: 0, hem: 0, lf: 12, rf: 18, hand: [22, 21], off: [11, 21] },
  { bob: 1, lean: 0, hem: 0, lf: 12, rf: 18, hand: [22, 22], off: [11, 22] },
  { bob: 1, lean: 0, hem: -1, lf: 12, rf: 18, hand: [22, 22], off: [11, 22] },
  { bob: 0, lean: 0, hem: -1, lf: 12, rf: 18, hand: [22, 21], off: [11, 21] },
];

// prettier-ignore
const WALK: readonly Pose[] = [
  { bob: 0, lean: 1, hem: -1, lf: 10, rf: 21, hand: [24, 20], off: [10, 21] },
  { bob: 1, lean: 1, hem: -2, lf: 12, rf: 19, hand: [23, 21], off: [11, 21] },
  { bob: 0, lean: 1, hem: -1, lf: 15, rf: 16, hand: [21, 22], off: [13, 21] },
  { bob: 0, lean: 1, hem: -1, lf: 21, rf: 10, hand: [20, 22], off: [14, 20] },
  { bob: 1, lean: 1, hem: -2, lf: 19, rf: 12, hand: [21, 21], off: [13, 21] },
  { bob: 0, lean: 1, hem: -1, lf: 16, rf: 15, hand: [23, 21], off: [11, 22] },
];

// prettier-ignore
const ATTACK: readonly Pose[] = [
  // o'ng panja: tortish → oldinga tirnash → qaytish
  { bob: 0, lean: -1, hem: 0, lf: 12, rf: 19, hand: [19, 14], off: [13, 21] },
  { bob: 1, lean: 2, low: 1, hem: -2, lf: 11, rf: 21, hand: [29, 19], off: [13, 21], slash: "r" },
  { bob: 1, lean: 1, hem: -1, lf: 11, rf: 20, hand: [25, 22], off: [13, 21] },
  // chap panja: orqa qo'l oldinga o'tib tirnaydi
  { bob: 0, lean: -1, hem: 0, lf: 12, rf: 19, hand: [21, 22], off: [15, 14] },
  { bob: 1, lean: 2, low: 1, hem: -2, lf: 11, rf: 21, hand: [20, 22], off: [29, 18], slash: "l" },
  { bob: 1, lean: 1, hem: -1, lf: 11, rf: 20, hand: [20, 22], off: [25, 21] },
  // 6: sakrash zaryadi — cho'kkalab, panjalar oldinda
  { bob: 0, lean: 2, low: 3, hem: 0, lf: 9, rf: 21, hand: [26, 23], off: [22, 24] },
  // 7: havoda — oldinga cho'zilgan, oyoqlar yig'ilgan, plash orqaga
  { bob: 0, lean: 3, lift: 6, hem: -4, lf: 14, rf: 19, hand: [29, 13], off: [27, 16] },
  // 8: qo'nish — panjalar yerga
  { bob: 0, lean: 2, low: 4, hem: 1, lf: 9, rf: 22, hand: [27, 27], off: [21, 27], slash: "r" },
  // 9: yovvoyi yugurish — yelka oldinda
  { bob: 1, lean: 4, low: 1, hem: -4, lf: 9, rf: 22, hand: [22, 22], off: [11, 19] },
  // 10: uvlash — boshi tepaga, panjalar ko'tarilgan
  { bob: 0, lean: -1, hem: -1, lf: 11, rf: 19, hand: [23, 7], off: [10, 8], howl: true },
  // 11: to'dani chaqirish — panjalar yon tomonga yoyilgan
  { bob: 0, lean: 0, low: 1, hem: 1, lf: 10, rf: 20, hand: [28, 17], off: [5, 17], howl: true },
];

// prettier-ignore
const HURT: readonly Pose[] = [
  { bob: 1, lean: -3, hem: 2, lf: 12, rf: 20, hand: [23, 15], off: [9, 16] },
];

// prettier-ignore
const DEATH: readonly Pose[] = [
  { bob: 2, lean: 1, low: 3, hem: 0, lf: 11, rf: 19, hand: [21, 24], off: [14, 24] },
  { bob: 0, lean: 0, hem: 0, lf: 0, rf: 0, hand: [0, 0], off: [0, 0], lying: true },
  { bob: 0, lean: 0, hem: 1, lf: 0, rf: 0, hand: [0, 0], off: [0, 0], lying: true },
];

const FRAMES: Record<AnimState, readonly Pose[]> = {
  idle: IDLE,
  walk: WALK,
  attack: ATTACK,
  hurt: HURT,
  death: DEATH,
};

/** Har holatdagi kadrlar soni (Animator va sinovlar uchun) */
export const WOLF_FRAMES: Record<AnimState, number> = {
  idle: IDLE.length,
  walk: WALK.length,
  attack: ATTACK.length,
  hurt: HURT.length,
  death: DEATH.length,
};

const poseOf = (state: AnimState, frame: number) => {
  const list = FRAMES[state];
  return list[frame] ?? list[0]!;
};

/** Bosh markazi (tana koordinatalarida) */
function head(f: Pose) {
  const lift = f.lift ?? 0;
  const b = f.bob + (f.low ?? 0) - lift;
  // uvlashda bosh orqaga tashlanadi va tepaga ko'tariladi
  return f.howl ? { hx: 15 + f.lean, hy: 7 + b } : { hx: 16 + f.lean, hy: 8 + b };
}

/** Zirhli qo'l: yelkadan bilakkacha po'lat, bilakda oltin taqinchoq, temir qo'lqop va uchta panja */
function arm(p: Pixels, from: Point, hand: Point, slash: boolean) {
  const [hx, hy] = hand;
  const dx = hx - from[0],
    dy = hy - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len,
    uy = dy / len;
  const wx = Math.round(hx - ux * 2),
    wy = Math.round(hy - uy * 2);
  p.line(2, from, [wx, wy], 3);
  // oltin bilak taqinchog'i
  p.rect(4, wx - 1, wy - 1, 2, 2);
  // temir qo'lqop
  p.rect(2, hx - 1, hy - 1, 3, 3);
  p.rect(3, hx, hy - 1, 1, 1);
  // uchta panja uchi (yaltiroq) — qo'l yo'nalishida
  for (const s of [-1, 0, 1]) {
    const cx = Math.round(hx + ux * 2 - uy * s * 1.2),
      cy = Math.round(hy + uy * 2 + ux * s * 1.2);
    p.rect(3, cx, cy, 1, 1);
    p.rect(3, Math.round(cx + ux), Math.round(cy + uy), 1, 1);
    if (slash) p.rect(3, Math.round(cx + ux * 2), Math.round(cy + uy * 2), 1, 1);
  }
}

/** Yotib qolgan Varvar: yonboshlab yotgan zirh, mo'yna plash ustida, soch yoyilgan */
function lyingBody(p: Pixels, f: Pose) {
  p.rect(3, 4, 22, 20, 3);
  p.rect(2, 8, 24, 14, 4);
  p.rect(2, 22, 25, 5, 2);
  p.rect(1, 26, 26, 2, 2);
  p.rect(4, 7, 25, 1, 1);
  p.ellipse(5, 7, 25, 2.8, 2.4);
  p.ellipse(1, 6, 23.5, 3, 2, 24);
  p.rect(1, 2 + f.hem, 25, 3, 2);
}

/** Varvar kadri (tana koordinatalarida; to'r siljishi — p.ox/p.oy). */
function wolfGirl(p: Pixels, f: Pose, back: boolean) {
  if (f.lying) return lyingBody(p, f);
  const lift = f.lift ?? 0;
  const b = f.bob + (f.low ?? 0) - lift;
  const l = f.lean;
  const { hx, hy } = head(f);
  const top = 13 + b;
  const foot = 28 - lift;
  const hem = f.hem;

  // uzun qora soch: bosh ortidan yelkagacha tushadi (gavdadan oldin — orqa qatlam)
  p.polygon(1, [
    [hx - 4, hy - 2],
    [hx + 1, hy - 3],
    [hx - 1, top + 6],
    [hx - 6, top + 7],
  ]);

  // mo'ynali plash: yelkadan orqaga osilib tushadi
  p.polygon(3, [
    [11 + l, top - 1],
    [20 + l, top - 1],
    [19 + l, top + 4],
    [9 + hem, top + 12],
    [6 + hem, top + 8],
  ]);
  p.line(2, [10 + hem, top + 11], [8 + hem, top + 8], 1);

  // orqa (chap) qo'l — gavdadan oldin (oldinga o'tgan bo'lsa — gavda ustida)
  const offFront = f.off[0] >= 22 || f.slash === "l";
  if (!offFront) arm(p, [13 + l, top + 2], f.off, false);

  // oyoqlar: to'liq yopiq po'lat qalqonlar, qora etik
  const hipY = top + 10;
  p.line(2, [14 + l, hipY], [f.lf + 1, foot - 1], 3);
  p.line(2, [18 + l, hipY], [f.rf + 1, foot - 1], 3);
  p.rect(3, Math.round((14 + l + f.lf) / 2) + 1, Math.round((hipY + foot) / 2), 1, 1);
  p.rect(3, Math.round((18 + l + f.rf) / 2) + 1, Math.round((hipY + foot) / 2), 1, 1);
  // tizza plastinkasi chegarasi
  p.rect(1, Math.round((14 + l + f.lf) / 2), Math.round((hipY + foot) / 2) + 1, 3, 1);
  p.rect(1, Math.round((18 + l + f.rf) / 2), Math.round((hipY + foot) / 2) + 1, 3, 1);
  p.rect(1, f.lf, foot, 4, 2);
  p.rect(1, f.rf, foot, 4, 2);

  // ko'krak zirhi: yelkadan sonlargacha yopiq, yaltiroq chiziq va kamar
  p.polygon(2, [
    [12 + l, top],
    [21 + l, top],
    [20 + l, top + 11],
    [13 + l, top + 11],
  ]);
  if (!back) {
    p.line(3, [15 + l, top + 2], [15 + l, top + 6], 1);
    p.rect(3, 18 + l, top + 2, 1, 1);
  }
  p.rect(1, 13 + l, top + 8, 7, 1);
  // mo'yna yoqasi yelka ustida
  p.ellipse(3, 16 + l, top + 0.5, 5.5, 2.2);

  // bosh: yuz, qora soch qopqog'i, bo'ri quloqlari
  if (back) {
    p.ellipse(1, hx + 0.5, hy, 4.6, 4.8);
  } else {
    p.ellipse(5, hx + 0.5, hy + 0.5, 4.2, 4.5);
    p.ellipse(1, hx + 0.5, hy - 2, 4.8, 3, hy - 2);
    p.rect(1, hx - 4, hy - 2, 3, 6);
    if (f.howl) {
      // ko'zlar yumuq, og'iz ochiq — uvlamoqda
      p.rect(1, hx + 1, hy, 2, 1);
      p.rect(1, hx + 4, hy - 1, 1, 1);
      p.rect(1, hx + 3, hy + 2, 2, 2);
    } else {
      // ko'k ko'zlar
      p.rect(2, hx + 1, hy, 1, 2);
      p.rect(2, hx + 4, hy, 1, 2);
    }
  }
  // bo'ri quloqlari: qora, ichi oq-kulrang mo'yna
  p.polygon(1, [
    [hx - 3.5, hy - 3],
    [hx - 2, hy - 9],
    [hx + 0.5, hy - 3.5],
  ]);
  p.polygon(1, [
    [hx + 1.5, hy - 3.5],
    [hx + 4, hy - 9],
    [hx + 5, hy - 3],
  ]);
  if (!back) {
    p.rect(3, hx - 2, hy - 6, 1, 2);
    p.rect(3, hx + 3, hy - 6, 1, 2);
  }
  // oltin bo'yin taqinchog'i
  p.rect(4, hx - 2, hy + 4, 5, 1);

  // orqa qo'l oldinga o'tgan (chap panja zarbasi) — gavda ustida
  if (offFront) arm(p, [14 + l, top + 2], f.off, f.slash === "l");
  // old (o'ng) qo'l va panja
  arm(p, [19 + l, top + 2], f.hand, f.slash === "r");
}

/** sprites.ts chaqiradi: kadrni 48x48 to'rga chizadi (kontur — chaqiruvchida). */
export function drawWolf(p: Pixels, state: AnimState, frame: number, back: boolean) {
  p.ox = p.oy = OFF;
  wolfGirl(p, poseOf(state, frame), back && state !== "death");
}

/**
 * Qizil tutam: old sochdagi qiya chiziq (to'r koordinatalarida). Yotganda va orqadan — sochning
 * orqa tomonidagi tutam. renderSprite faqat soch (siyoh) piksellari ustiga chizadi.
 */
export function wolfTuft(state: AnimState, frame: number, back: boolean): Point[] {
  const f = poseOf(state, frame);
  if (f.lying) return [];
  const { hx, hy } = head(f);
  const pts: Point[] = back
    ? [
        [hx, hy - 3],
        [hx, hy - 2],
        [hx - 1, hy - 1],
        [hx - 1, hy],
        [hx - 2, hy + 1],
      ]
    : [
        [hx + 1, hy - 4],
        [hx + 2, hy - 4],
        [hx + 2, hy - 3],
        [hx + 3, hy - 3],
        [hx - 3, hy + 1],
        [hx - 3, hy + 2],
        [hx - 4, hy + 3],
      ];
  return pts.map(([x, y]) => [x + OFF, y + OFF] as const);
}

/** G'azabdagi ko'zlar (to'r koordinatalarida); orqadan, uvlashda va yotganda — yo'q */
export function wolfEyes(state: AnimState, frame: number, back: boolean): Point[] {
  const f = poseOf(state, frame);
  if (back || f.lying || f.howl) return [];
  const { hx, hy } = head(f);
  return [
    [hx + 1 + OFF, hy + OFF],
    [hx + 4 + OFF, hy + OFF],
  ];
}

/**
 * G'azab: ko'zlar qizil porlaydi (sprayt ustidan, renderSprite bilan bir xil joylashuv — 1 to'r
 * piksel = 1 px) va orqaga qisqa qizil iz.
 */
export function renderWolfEyes(
  c: CanvasRenderingContext2D,
  state: AnimState,
  frame: number,
  x: number,
  y: number,
  flip: boolean,
  back: boolean,
) {
  const ox = Math.round(x),
    oy = Math.round(y);
  const dir = flip ? -1 : 1;
  for (const [gx, gy] of wolfEyes(state, frame, back)) {
    const wx = flip ? ox + WOLF_GRID / 2 - 1 - gx : ox - WOLF_GRID / 2 + gx;
    const wy = oy - WOLF_GRID / 2 + gy;
    px(c, WOLF_FURY_EYES, wx, wy, 1, 2);
    c.globalAlpha = 0.45;
    px(c, WOLF_FURY_EYES, wx - dir * 2, wy, 2, 1);
    c.globalAlpha = 1;
  }
}
