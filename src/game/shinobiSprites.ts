/**
 * NINJA (qahramon, id "shinobi") sprayti — kod bilan chizilgan pozalar (Samuray naqshida). Anime emas:
 * qora kiyim, yuz qalpoq va niqob bilan yopiq (faqat ko'z tirqishi), ikki qo'lida ikkita katana,
 * belda qora kamar, qizil sharf — uchi orqada hilpiraydi. Sakura bog'idagi Ninja-soya mobidan farqi:
 * mob ko'k libosda va bitta tig'li; qahramon qop-qora, ikki qilichli va uzun qizil sharfli.
 *
 * 5 rang (sprites.ts: PALETTES.shinobi): 1 — siyoh (kontur, kamar, ko'z tirqishi), 2 — qora kiyim,
 * 3 — ko'mir-kulrang (burmalar, oyoq bog'ichi, qilich gardasi), 4 — qizil (sharf, dasta o'rami,
 * porlagan ko'zlar), 5 — po'lat (tig'lar, shuriken).
 *
 * To'r 48x48: tana 32x32 da o'rtada, qilichlar va sharf chetga chiqadi (vizual — to'qnashuvdan mustaqil).
 */
import type { AnimState } from "./animation";
import type { Pixels } from "./sprites";

type Point = readonly [number, number];

export const SHINOBI_GRID = 48;
const OFF = (SHINOBI_GRID - 32) / 2;

/** "attack" holatidagi maxsus kadrlar (Player.shinobiFrame tanlaydi) */
export const SHINOBI_FRAME = {
  /** 0..2 — o'ng qilich (ko'tarish, kesish, qaytish); 3..5 — chap qilich */
  left: 3,
  /** shuriken zaryadi: chap qo'lda shuriken, ko'krak oldida */
  aim: 6,
  /** shuriken otildi: qo'l oldinga cho'zilgan */
  throw: 7,
  /** tutun sakrashi: past engashgan */
  dash: 8,
} as const;

/**
 * SOYA BO'RONI super kadrlari: qo'l belgisi (tutunga aylanishdan oldin), ikki qilich yelkadan
 * yuqorida (qinga kirmoqda), qilichlar orqadagi qinda — X shaklida.
 */
export const SHINOBI_SUPER_FRAME = { seal: 9, draw: 10, sheathe: 11 } as const;

interface Pose {
  bob: number;
  lean: number;
  /** tiz bukilishi */
  low?: number;
  lf: Point;
  rf: Point;
  /** o'ng (old) va chap (orqa) qo'l */
  hand: Point;
  off: Point;
  /** tig' uchlari; null — qilich orqadagi qinda */
  bladeR: Point | null;
  bladeL: Point | null;
  /** sharf: o'rtasi va uchi (bo'yindagi tugunga nisbatan) */
  scarf: readonly [Point, Point];
  /** tig'da yaltirash (kesish lahzasi) */
  glint?: "r" | "l";
  /** chap qo'lda shuriken */
  star?: boolean;
  /** yotib qolgan (o'lim) */
  lying?: boolean;
}

const sc = (mx: number, my: number, tx: number, ty: number): readonly [Point, Point] => [
  [mx, my],
  [tx, ty],
];

// prettier-ignore
const IDLE: readonly Pose[] = [
  { bob: 0, lean: 0, lf: [13, 27], rf: [19, 27], hand: [22, 20], off: [11, 20], bladeR: [28, 26], bladeL: [5, 26], scarf: sc(-5, 2, -10, 5) },
  { bob: 1, lean: 0, lf: [13, 27], rf: [19, 27], hand: [22, 21], off: [11, 21], bladeR: [28, 27], bladeL: [5, 27], scarf: sc(-5, 3, -10, 7) },
  { bob: 1, lean: 0, lf: [13, 27], rf: [19, 27], hand: [22, 21], off: [11, 21], bladeR: [28, 27], bladeL: [5, 27], scarf: sc(-5, 1, -11, 3) },
  { bob: 0, lean: 0, lf: [13, 27], rf: [19, 27], hand: [22, 20], off: [11, 20], bladeR: [28, 26], bladeL: [5, 26], scarf: sc(-6, 2, -11, 1) },
];

// prettier-ignore
const WALK: readonly Pose[] = [
  { bob: 0, lean: 1, lf: [11, 27], rf: [21, 27], hand: [23, 20], off: [10, 19], bladeR: [29, 25], bladeL: [4, 24], scarf: sc(-6, 1, -12, 2) },
  { bob: 1, lean: 1, lf: [13, 27], rf: [19, 26], hand: [22, 21], off: [11, 20], bladeR: [28, 26], bladeL: [5, 25], scarf: sc(-6, 0, -12, -1) },
  { bob: 0, lean: 1, lf: [15, 26], rf: [17, 27], hand: [21, 21], off: [12, 21], bladeR: [27, 27], bladeL: [6, 26], scarf: sc(-6, 1, -13, 1) },
  { bob: 0, lean: 1, lf: [21, 27], rf: [11, 27], hand: [21, 21], off: [12, 19], bladeR: [27, 26], bladeL: [6, 24], scarf: sc(-6, 2, -12, 3) },
  { bob: 1, lean: 1, lf: [19, 26], rf: [13, 27], hand: [22, 20], off: [11, 20], bladeR: [28, 25], bladeL: [5, 25], scarf: sc(-6, 0, -13, 0) },
  { bob: 0, lean: 1, lf: [17, 27], rf: [15, 26], hand: [23, 21], off: [10, 21], bladeR: [29, 26], bladeL: [4, 26], scarf: sc(-6, 1, -12, -2) },
];

// prettier-ignore
const ATTACK: readonly Pose[] = [
  // o'ng qilich: ko'tarish → kesish → qaytish (chap qilich pastda)
  { bob: 0, lean: -1, lf: [12, 27], rf: [20, 27], hand: [20, 13], off: [11, 20], bladeR: [15, 5], bladeL: [5, 26], scarf: sc(-5, 2, -10, 4) },
  { bob: 1, lean: 2, low: 1, lf: [11, 27], rf: [22, 27], hand: [26, 18], off: [10, 20], bladeR: [33, 21], bladeL: [4, 25], scarf: sc(-6, 0, -12, -1), glint: "r" },
  { bob: 1, lean: 1, low: 1, lf: [11, 27], rf: [22, 27], hand: [24, 22], off: [10, 20], bladeR: [28, 30], bladeL: [4, 25], scarf: sc(-6, 1, -12, 3) },
  // chap qilich: orqa qo'l oldinga o'tib kesadi (o'ng qilich pastda)
  { bob: 0, lean: -1, lf: [12, 27], rf: [20, 27], hand: [22, 21], off: [13, 13], bladeR: [28, 27], bladeL: [9, 5], scarf: sc(-5, 2, -10, 4) },
  { bob: 1, lean: 2, low: 1, lf: [11, 27], rf: [22, 27], hand: [21, 21], off: [25, 16], bladeR: [26, 28], bladeL: [33, 13], scarf: sc(-6, 0, -12, -2), glint: "l" },
  { bob: 1, lean: 1, low: 1, lf: [11, 27], rf: [22, 27], hand: [21, 21], off: [23, 21], bladeR: [26, 28], bladeL: [29, 28], scarf: sc(-6, 1, -12, 3) },
  // 6: shuriken zaryadi — chap qo'l ko'krak oldida, ikkala tig' o'ng qo'lda emas: o'ng qilich pastda
  { bob: 1, lean: -1, low: 1, lf: [11, 27], rf: [21, 27], hand: [22, 21], off: [15, 15], bladeR: [28, 27], bladeL: [10, 22], scarf: sc(-5, 3, -10, 6), star: true },
  // 7: otish — chap qo'l oldinga cho'zilgan
  { bob: 0, lean: 2, lf: [11, 27], rf: [22, 27], hand: [21, 21], off: [27, 15], bladeR: [27, 28], bladeL: [6, 24], scarf: sc(-6, 0, -12, -2) },
  // 8: tutun sakrashi — past engashgan, sharf orqaga tik cho'zilgan
  { bob: 2, lean: 3, low: 2, lf: [10, 27], rf: [22, 26], hand: [24, 22], off: [12, 22], bladeR: [30, 26], bladeL: [6, 26], scarf: sc(-7, -1, -15, -2) },
  // 9: qo'l belgisi — ikki qo'l ko'krak oldida, qilichlar qinda
  { bob: 1, lean: 0, low: 1, lf: [12, 27], rf: [20, 27], hand: [18, 15], off: [16, 15], bladeR: null, bladeL: null, scarf: sc(-5, 2, -9, 6) },
  // 10: ikki qilich yelka ustida, qinga kirmoqda (uchlari pastga, orqaga)
  { bob: 0, lean: 0, lf: [12, 27], rf: [20, 27], hand: [20, 9], off: [13, 9], bladeR: [12, 14], bladeL: [20, 15], scarf: sc(-5, 2, -10, 5) },
  // 11: qilichlar orqadagi qinda — X shaklidagi dastalar yelkadan chiqib turadi
  { bob: 0, lean: 0, lf: [13, 27], rf: [19, 27], hand: [21, 20], off: [12, 20], bladeR: null, bladeL: null, scarf: sc(-5, 3, -9, 8) },
];

// prettier-ignore
const HURT: readonly Pose[] = [
  { bob: 1, lean: -3, lf: [12, 28], rf: [21, 27], hand: [23, 15], off: [8, 16], bladeR: [28, 11], bladeL: [4, 11], scarf: sc(3, 1, 7, 4) },
];

// prettier-ignore
const DEATH: readonly Pose[] = [
  { bob: 2, lean: 1, low: 3, lf: [10, 27], rf: [21, 27], hand: [24, 20], off: [10, 21], bladeR: [27, 27], bladeL: [6, 27], scarf: sc(-3, 4, -5, 9) },
  { bob: 0, lean: 0, lf: [6, 27], rf: [8, 27], hand: [20, 27], off: [12, 27], bladeR: [27, 27], bladeL: [4, 25], scarf: sc(3, 1, 7, 0), lying: true },
  { bob: 0, lean: 0, lf: [6, 27], rf: [8, 27], hand: [20, 27], off: [12, 27], bladeR: [27, 27], bladeL: [4, 25], scarf: sc(3, 1, 8, 1), lying: true },
];

const FRAMES: Record<AnimState, readonly Pose[]> = {
  idle: IDLE,
  walk: WALK,
  attack: ATTACK,
  hurt: HURT,
  death: DEATH,
};

/** Har holatdagi kadrlar soni (Animator va sinovlar uchun) */
export const SHINOBI_FRAMES: Record<AnimState, number> = {
  idle: IDLE.length,
  walk: WALK.length,
  attack: ATTACK.length,
  hurt: HURT.length,
  death: DEATH.length,
};

/** Katana: qo'ldan orqaga dasta (qizil o'ram), garda (ko'mir), po'lat tig' */
function blade(p: Pixels, hand: Point, tip: Point, glint: boolean) {
  const [hx, hy] = hand;
  const dx = tip[0] - hx,
    dy = tip[1] - hy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len,
    uy = dy / len;
  p.line(4, hand, [Math.round(hx - ux * 3), Math.round(hy - uy * 3)], 1);
  p.line(5, [Math.round(hx + ux * 2), Math.round(hy + uy * 2)], tip, 1);
  p.rect(3, Math.round(hx + ux), Math.round(hy + uy), 1, 1);
  if (glint) {
    // kesish izi: tig' bo'ylab po'lat uchqunlari
    const nx = -uy,
      ny = ux;
    for (const k of [0.5, 0.8, 1])
      p.rect(5, Math.round(hx + dx * k + nx * 2), Math.round(hy + dy * k + ny * 2), 1, 1);
  }
}

/** Yotib qolgan Ninja: yonboshlab yotgan qora gavda, sharf yerda, qilichlar yonida */
function lyingBody(p: Pixels, f: Pose) {
  p.rect(2, 7, 24, 16, 4);
  p.rect(1, 13, 24, 1, 4);
  p.ellipse(2, 25, 25, 3.5, 3);
  p.rect(1, 24, 25, 3, 1);
  p.rect(4, 25, 25, 1, 1);
  p.rect(3, 7, 25, 2, 2);
  p.line(4, [21, 23], [21 + f.scarf[1][0], 23 + f.scarf[1][1]], 1);
  if (f.bladeR) p.line(5, [16, 28], f.bladeR, 1);
  if (f.bladeL) p.line(5, [9, 28], f.bladeL, 1);
}

/** Ninja kadri (tana koordinatalarida; to'r siljishi — p.ox/p.oy). */
function shinobi(p: Pixels, f: Pose, back: boolean) {
  if (f.lying) return lyingBody(p, f);
  const low = f.low ?? 0;
  const b = f.bob + low;
  const l = f.lean;
  const hip = 20 + b;
  const hx = 16 + l,
    hy = 9 + b;

  // qizil sharf: bo'yindagi tugundan orqaga hilpiraydi (orqadan qaraganda — gavda ustida)
  const knot: Point = back ? [hx, hy + 4] : [hx - 3, hy + 4];
  const mid: Point = [knot[0] + f.scarf[0][0], knot[1] + f.scarf[0][1]];
  const tip: Point = [knot[0] + f.scarf[1][0], knot[1] + f.scarf[1][1]];
  const scarf = () => {
    p.line(4, knot, mid, 2);
    p.line(4, mid, tip, 1);
    p.rect(4, tip[0], tip[1] + 1, 1, 1);
  };
  if (!back) scarf();

  // qindagi qilichlar (super oxiri): orqada X shaklidagi ikki dasta yelkadan chiqib turadi
  const sheathed = !f.bladeR && !f.bladeL;
  if (sheathed && !back) {
    p.line(4, [hx - 4, hy + 5], [hx - 7, hy - 1], 1);
    p.line(4, [hx + 1, hy + 5], [hx + 4, hy - 2], 1);
  }

  // orqa (chap) qo'l va uning qilichi — gavdadan oldin
  p.line(2, [13 + l, 14 + b], f.off, 3);
  if (f.bladeL && f.glint !== "l" && f.off[0] < 20) blade(p, f.off, f.bladeL, false);

  // oyoqlar: tor qora shim, boldirda kulrang bog'ich, ko'mir tabi
  p.line(2, [14, hip], f.lf, 3);
  p.line(2, [18, hip], f.rf, 3);
  p.rect(2, 13, hip, 7, 2);
  for (const [fx, fy] of [f.lf, f.rf]) {
    p.rect(3, fx - 1, fy - 3, 3, 1);
    p.rect(3, fx - 1, fy, 3, 1);
  }

  // gavda: qora kurtka, ko'krakda diagonal burma, qora kamar (kontur rangida) va tugun
  p.polygon(2, [
    [12 + l, 13 + b],
    [21 + l, 13 + b],
    [20, hip],
    [13, hip],
  ]);
  if (!back) p.line(3, [14 + l, 13 + b], [18, hip - 3], 1);
  else p.rect(3, 16 + l, 14 + b, 1, hip - 15 - b);
  p.rect(1, 13, hip - 2, 8, 2);
  p.rect(3, back ? 16 : 14, hip - 2, 1, 1);

  // bosh: qalpoq va niqob (hammasi qora), ko'z tirqishi va qizil porlagan ko'zlar
  p.ellipse(2, hx + 0.5, hy, 5, 4.8);
  p.rect(2, hx - 3, hy + 2, 8, 3);
  if (back) {
    // orqadan: qalpoq tuguni va choki
    p.rect(3, hx, hy - 3, 1, 5);
    p.rect(3, hx - 1, hy + 2, 3, 1);
  } else {
    p.rect(3, hx - 2, hy - 3, 3, 1);
    p.rect(1, hx - 1, hy, 7, 2);
    p.rect(4, hx + 1, hy, 1, 1);
    p.rect(4, hx + 4, hy, 1, 1);
    // niqob burmasi
    p.rect(3, hx + 1, hy + 3, 3, 1);
  }
  if (back) {
    scarf();
    if (sheathed) {
      p.line(4, [hx - 4, hy + 10], [hx - 7, hy + 3], 1);
      p.line(4, [hx + 4, hy + 10], [hx + 7, hy + 3], 1);
    }
  }

  // orqa qo'l oldinga o'tgan bo'lsa (chap qilich zarbasi) — gavda ustida
  if (f.bladeL && (f.glint === "l" || f.off[0] >= 20)) blade(p, f.off, f.bladeL, f.glint === "l");
  // old (o'ng) qo'l va qilichi
  p.line(2, [20 + l, 14 + b], f.hand, 3);
  if (f.bladeR) blade(p, f.hand, f.bladeR, f.glint === "r");
  // qo'lqoplar (ko'mir) va chap qo'ldagi shuriken
  p.rect(3, f.hand[0] - 1, f.hand[1] - 1, 2, 2);
  p.rect(3, f.off[0] - 1, f.off[1] - 1, 2, 2);
  if (f.star) {
    const [sx, sy] = f.off;
    p.rect(5, sx, sy - 3, 1, 2);
    p.rect(5, sx, sy + 2, 1, 2);
    p.rect(5, sx - 3, sy, 2, 1);
    p.rect(5, sx + 2, sy, 2, 1);
  }
}

/** sprites.ts chaqiradi: kadrni 48x48 to'rga chizadi (kontur — chaqiruvchida). */
export function drawShinobi(p: Pixels, state: AnimState, frame: number, back: boolean) {
  p.ox = p.oy = OFF;
  const list = FRAMES[state];
  shinobi(p, list[frame] ?? list[0]!, back && state !== "death");
}
