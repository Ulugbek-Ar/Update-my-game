/**
 * ROHIBA (qahramon, id "priestess") sprayti — kod bilan chizilgan pozalar (Ninja naqshida). Anime emas:
 * oq-oltin YOPIQ ruhoniy libos (uzun yengli, oyoqgacha), belida oltin kamar, boshida oltin nur halqasi
 * (halo), qora soch tepada tugilgan (oltin to'g'nog'ich bilan), xotirjam yuz, qo'llarida oltin
 * bilaguzuklar. Ulug'vor va muqaddas — bolalar uchun ham munosib.
 *
 * 5 rang (sprites.ts: PALETTES.priestess): 1 — siyoh (kontur, soch, ko'zlar), 2 — oq libos, 3 — iliq
 * kulrang (libos burmalari, sandal), 4 — oltin (halo, kamar, bilaguzuk, etak hoshiyasi, kaft nuri),
 * 5 — teri (yuz va kaftlar).
 *
 * To'r 48x48: tana 32x32 da o'rtada; halo, kaft nuri va super ko'tarilishi chetga chiqadi (vizual —
 * to'qnashuvdan mustaqil).
 */
import type { AnimState } from "./animation";
import type { Pixels } from "./sprites";

type Point = readonly [number, number];

export const PRIESTESS_GRID = 48;
const OFF = (PRIESTESS_GRID - 32) / 2;

/** "attack" holatidagi maxsus kadrlar (Player.priestessFrame tanlaydi) */
export const PRIESTESS_FRAME = {
  /** 0..2 — o'ng kaft (tortish, zarba, qaytish); 3..5 — chap kaft */
  left: 3,
  /** NUR KAFTI zaryadi: ikki kaft ko'krak oldida, orasida oltin nur */
  aim: 6,
  /** NUR KAFTI otildi: ikki kaft oldinga */
  beam: 7,
  /** muqaddas qadam: oldinga engashib sakraydi, etak orqaga hilpiraydi */
  dash: 8,
} as const;

/**
 * OLTIN LOTOS super kadrlari: kaftlar birlashtirilgan, ko'zlar yumuq (ibodat) → havoga ko'tarilmoqda
 * → lotos ustida suzib turibdi.
 */
export const PRIESTESS_SUPER_FRAME = { pray: 9, rise: 10, float: 11 } as const;

interface Pose {
  bob: number;
  lean: number;
  /** tiz bukilishi (gavda pastga) */
  low?: number;
  /** havoga ko'tarilish (super): gavda va etak yuqoriga */
  lift?: number;
  /** etak tebranishi (px, + oldinga) */
  hem: number;
  /** sandal uchlari (x) — yurishda almashadi */
  lf: number;
  rf: number;
  /** o'ng (old) va chap (orqa) kaft */
  hand: Point;
  off: Point;
  /** kaftda oltin nur (zarba lahzasi) */
  glow?: "r" | "l";
  /** ikki kaft orasida oltin nur shari (NUR KAFTI) */
  orb?: Point;
  /** ko'zlar yumuq (ibodat) */
  closed?: boolean;
  /** yotib qolgan (o'lim) */
  lying?: boolean;
}

// prettier-ignore
const IDLE: readonly Pose[] = [
  { bob: 0, lean: 0, hem: 0, lf: 12, rf: 18, hand: [19, 19], off: [15, 19] },
  { bob: 1, lean: 0, hem: 0, lf: 12, rf: 18, hand: [19, 20], off: [15, 20] },
  { bob: 1, lean: 0, hem: 1, lf: 12, rf: 18, hand: [19, 20], off: [15, 20] },
  { bob: 0, lean: 0, hem: 1, lf: 12, rf: 18, hand: [19, 19], off: [15, 19] },
];

// prettier-ignore
const WALK: readonly Pose[] = [
  { bob: 0, lean: 1, hem: 1, lf: 10, rf: 20, hand: [22, 20], off: [11, 19] },
  { bob: 1, lean: 1, hem: 0, lf: 12, rf: 18, hand: [21, 21], off: [12, 20] },
  { bob: 0, lean: 1, hem: -1, lf: 14, rf: 16, hand: [20, 21], off: [13, 21] },
  { bob: 0, lean: 1, hem: 1, lf: 20, rf: 10, hand: [20, 19], off: [13, 21] },
  { bob: 1, lean: 1, hem: 0, lf: 18, rf: 12, hand: [21, 20], off: [12, 21] },
  { bob: 0, lean: 1, hem: -1, lf: 16, rf: 14, hand: [22, 21], off: [11, 20] },
];

// prettier-ignore
const ATTACK: readonly Pose[] = [
  // o'ng kaft: tortish → oldinga zarba (oltin nur) → qaytish
  { bob: 0, lean: -1, hem: 0, lf: 12, rf: 19, hand: [18, 16], off: [14, 19] },
  // zarba: qo'l oldinga to'liq cho'zilgan, kaft ochiq (barmoqlar tepaga), ortida qisqa oltin iz
  { bob: 1, lean: 2, low: 1, hem: -1, lf: 11, rf: 20, hand: [30, 15], off: [13, 19], glow: "r" },
  { bob: 1, lean: 1, hem: 0, lf: 11, rf: 20, hand: [24, 17], off: [13, 19] },
  // chap kaft: orqa qo'l oldinga o'tib uradi
  { bob: 0, lean: -1, hem: 0, lf: 12, rf: 19, hand: [20, 20], off: [16, 15] },
  { bob: 1, lean: 2, low: 1, hem: -1, lf: 11, rf: 20, hand: [19, 20], off: [30, 16], glow: "l" },
  { bob: 1, lean: 1, hem: 0, lf: 11, rf: 20, hand: [19, 20], off: [24, 18] },
  // 6: NUR KAFTI zaryadi — ikki kaft ko'krak oldida, orasida oltin shar
  { bob: 1, lean: -1, low: 1, hem: 0, lf: 11, rf: 19, hand: [21, 15], off: [20, 18], orb: [22, 16] },
  // 7: NUR KAFTI — ikki kaft oldinga cho'zilgan
  { bob: 0, lean: 2, hem: -1, lf: 11, rf: 21, hand: [27, 14], off: [26, 17], orb: [29, 15], glow: "r" },
  // 8: muqaddas qadam — oldinga engashgan, etak orqaga
  { bob: 1, lean: 3, low: 1, hem: -3, lf: 9, rf: 20, hand: [22, 21], off: [10, 20] },
  // 9: ibodat — kaftlar ko'krak oldida birlashgan, ko'zlar yumuq
  { bob: 0, lean: 0, hem: 0, lf: 12, rf: 18, hand: [18, 15], off: [17, 15], closed: true },
  // 10: ko'tarilmoqda
  { bob: 0, lean: 0, lift: 3, hem: 1, lf: 13, rf: 17, hand: [18, 15], off: [17, 15], closed: true },
  // 11: lotos ustida suzib turibdi
  { bob: 0, lean: 0, lift: 6, hem: -1, lf: 13, rf: 17, hand: [18, 15], off: [17, 15], closed: true },
];

// prettier-ignore
const HURT: readonly Pose[] = [
  { bob: 1, lean: -3, hem: 2, lf: 12, rf: 20, hand: [22, 14], off: [9, 15] },
];

// prettier-ignore
const DEATH: readonly Pose[] = [
  { bob: 2, lean: 1, low: 3, hem: 0, lf: 11, rf: 19, hand: [19, 21], off: [15, 21], closed: true },
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
export const PRIESTESS_FRAMES: Record<AnimState, number> = {
  idle: IDLE.length,
  walk: WALK.length,
  attack: ATTACK.length,
  hurt: HURT.length,
  death: DEATH.length,
};

/** Uzun yeng: yelkadan kaftgacha oq mato, kaft oldida oltin bilaguzuk, teri rangli kaft */
function sleeve(p: Pixels, from: Point, hand: Point, glow: boolean) {
  const [hx, hy] = hand;
  const dx = hx - from[0],
    dy = hy - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len,
    uy = dy / len;
  p.line(2, from, [Math.round(hx - ux * 2), Math.round(hy - uy * 2)], 3);
  p.rect(4, Math.round(hx - ux * 2) - 1, Math.round(hy - uy * 2) - 1, 2, 2);
  if (!glow) {
    p.rect(5, hx - 1, hy - 1, 2, 2);
    return;
  }
  // ochiq kaft: tik turgan kaft va barmoqlar (oldinga qaragan), yon tomonda bosh barmoq
  p.rect(5, hx - 1, hy - 3, 2, 5);
  p.rect(5, hx - 2, hy, 1, 1);
  // kaft ortida qisqa oltin iz (qo'l ustida va ostida ikki chiziq)
  const bx = Math.round(hx - ux * 4),
    by = Math.round(hy - uy * 4);
  p.line(4, [bx, by - 2], [Math.round(bx - ux * 6), by - 2], 1);
  p.line(4, [bx - 1, by + 2], [Math.round(bx - 1 - ux * 4), by + 2], 1);
  // kaft oldida oltin nur chaqnashi (tik chiziq — kaft izi)
  const cx = Math.round(hx + ux * 2);
  p.rect(4, cx, hy - 3, 1, 5);
}

/** Yotib qolgan Rohiba: yonboshlab yotgan oq libos, oltin kamar, halo yerda xiralashgan */
function lyingBody(p: Pixels, f: Pose) {
  p.rect(2, 5, 24, 18, 4);
  p.rect(3, 8, 25, 12, 1);
  p.rect(4, 13, 24, 1, 4);
  p.rect(4, 5 + f.hem, 27, 2, 1);
  p.ellipse(5, 26, 25, 3, 2.5);
  p.rect(1, 27, 23, 3, 4);
  p.ellipse(1, 29, 22.5, 1.6, 1.4);
  p.rect(4, 22, 21, 1, 7);
}

/** Rohiba kadri (tana koordinatalarida; to'r siljishi — p.ox/p.oy). */
function priestess(p: Pixels, f: Pose, back: boolean) {
  if (f.lying) return lyingBody(p, f);
  const lift = f.lift ?? 0;
  const b = f.bob + (f.low ?? 0) - lift;
  const l = f.lean;
  const hx = 16 + l,
    hy = 8 + b;
  const top = 13 + b;
  const foot = 28 - lift;
  const hem = f.hem;

  // nur halqasi (halo): bosh ortida oltin halqa — boshdan oldin chiziladi, ichi bo'sh
  p.ellipse(4, hx + 0.5, hy - 1, 7.5, 7.5);
  p.ellipse(0, hx + 0.5, hy - 1, 6, 6);

  // orqa (chap) yeng — gavdadan oldin (oldinga o'tgan bo'lsa — gavda ustida, pastda)
  const offFront = f.off[0] >= 20 || f.glow === "l";
  if (!offFront) sleeve(p, [13 + l, top + 1], f.off, false);

  // sandal uchlari (ko'tarilganda ko'rinmaydi)
  if (!lift) {
    p.rect(3, f.lf, foot, 3, 1);
    p.rect(3, f.rf, foot, 3, 1);
  }

  // libos: yelkadan oyoqgacha kengayib boradi, burmalar, oltin kamar va etak hoshiyasi
  p.polygon(2, [
    [12 + l, top],
    [21 + l, top],
    [23 + hem, foot],
    [9 + hem, foot],
  ]);
  p.line(3, [15 + l, top + 8], [13 + hem, foot - 2], 1);
  p.line(3, [19 + l, top + 8], [20 + hem, foot - 2], 1);
  if (back) p.rect(3, 16 + l, top + 1, 1, 5);
  p.line(4, [10 + hem, foot - 1], [22 + hem, foot - 1], 1);
  p.rect(4, 12 + Math.round(l / 2), top + 6, 10, 2);
  if (!back) p.rect(4, 16 + Math.round(l / 2), top + 8, 1, 3);
  if (!back) {
    // yoqa: oltin hoshiyali V
    p.line(4, [15 + l, top], [17 + l, top + 3], 1);
    p.line(4, [19 + l, top], [17 + l, top + 3], 1);
  }

  // bosh: xotirjam yuz, qora soch tepada tugilgan, oltin to'g'nog'ich
  if (back) {
    p.ellipse(1, hx + 0.5, hy, 4.6, 4.8);
  } else {
    p.ellipse(5, hx + 0.5, hy + 0.5, 4.3, 4.6);
    p.ellipse(1, hx + 0.5, hy - 2, 4.8, 3, hy - 2);
    p.rect(1, hx - 4, hy - 2, 3, 5);
    if (f.closed) {
      p.rect(1, hx + 1, hy + 1, 2, 1);
      p.rect(1, hx + 4, hy + 1, 1, 1);
    } else {
      p.rect(1, hx + 1, hy, 1, 2);
      p.rect(1, hx + 4, hy, 1, 2);
    }
  }
  p.ellipse(1, hx - 0.5, hy - 5.5, 2.6, 2.1);
  p.rect(4, hx - 3, hy - 6, 5, 1);

  // orqa kaft oldinga o'tgan (chap kaft zarbasi) — gavda ustida
  if (offFront) sleeve(p, [14 + l, top + 1], f.off, f.glow === "l");
  // old (o'ng) yeng va kaft
  sleeve(p, [20 + l, top + 1], f.hand, f.glow === "r");
  // NUR KAFTI shari: kaftlar orasida oltin nur
  if (f.orb) {
    p.rect(4, f.orb[0] - 1, f.orb[1] - 1, 3, 3);
    p.rect(2, f.orb[0], f.orb[1], 1, 1);
  }
}

/** sprites.ts chaqiradi: kadrni 48x48 to'rga chizadi (kontur — chaqiruvchida). */
export function drawPriestess(p: Pixels, state: AnimState, frame: number, back: boolean) {
  p.ox = p.oy = OFF;
  const list = FRAMES[state];
  priestess(p, list[frame] ?? list[0]!, back && state !== "death");
}
