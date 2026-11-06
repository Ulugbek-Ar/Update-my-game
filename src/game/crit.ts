/**
 * Kritik zarba (faqat oflayn o'yin — Game): o'yinchining to'g'ridan-to'g'ri zarbasi CRIT_CHANCE
 * ehtimol bilan CRIT_MUL baravar zarar beradi — sariq "KRIT!", kattaroq uchqun va biroz uzunroq
 * hit-stop (CRIT_FREEZE; oddiy zarbaning 0.045 s i o'zgarmaydi).
 *
 * Boss joni formulasiga o'rtacha ulushi (CRIT_AVG = +8%) qo'shiladi — bosslar osonlashmaydi.
 */
export const CRIT_CHANCE = 0.08;
export const CRIT_MUL = 2;
export const CRIT_FREEZE = 0.06;
export const CRIT_COLOR = "#ffe14d";

/** Kritik zarbaning o'rtacha DPS ko'paytuvchisi: 1 + 0.08 × (2 − 1) = 1.08 */
export const CRIT_AVG = 1 + CRIT_CHANCE * (CRIT_MUL - 1);

/**
 * Yangi o'yinlar uchun kritik tasodifi manbai. Sinovlar umumiy sozlamada (src/test/setup.ts)
 * kritni o'chiradi — aniq zararni tekshiradigan eski sinovlar beqaror bo'lmasin; krit sinovlari
 * Game.critRand ni o'zi beradi.
 */
export function setCritSource(rand: (() => number) | null) {
  critSource = rand ?? Math.random;
}
let critSource: () => number = Math.random;

export function critSourceFn() {
  return critSource;
}

export function rollCrit(rand: () => number = critSource, chance = CRIT_CHANCE) {
  return rand() < chance;
}

/** Boss o'lganda: o'yin shuncha (real) soniya sekin, shu tezlikda (faqat oflayn) */
export const SLOWMO_TIME = 1;
export const SLOWMO_SPEED = 0.3;
/** Tanga yomg'iri (faqat ko'rinish — oltin miqdori o'zgarmaydi) */
export const COIN_RAIN = 24;
