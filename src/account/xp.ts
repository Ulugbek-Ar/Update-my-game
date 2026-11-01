/**
 * O'yinchi darajasi (XP): 1–50 daraja. L-darajadan L+1 ga o'tish uchun 100 + 20·(L−1) XP kerak
 * (2-daraja — 100 XP, 10-daraja — jami 1 620 XP, 50-daraja — jami 28 420 XP).
 */

export const MAX_LEVEL = 50;

/** L-darajadan keyingisiga kerak bo'ladigan XP */
export function xpStep(level: number) {
  return 100 + 20 * (Math.max(1, level) - 1);
}

/** L-darajaga yetish uchun jami XP (1-daraja — 0) */
export function xpForLevel(level: number) {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  // sum_{k=1}^{l-1} (100 + 20(k-1)) = 100(l-1) + 10(l-1)(l-2)
  return 100 * (l - 1) + 10 * (l - 1) * (l - 2);
}

/** Jami XP bo'yicha daraja (1..50) */
export function levelOf(xp: number) {
  const x = Math.max(0, Math.floor(Number(xp) || 0));
  let l = 1;
  while (l < MAX_LEVEL && xpForLevel(l + 1) <= x) l++;
  return l;
}

/** O'yinchi XP'si (progress kaliti — bulutga va ko'chirish kodiga kiradi) */
export const XP_KEY = "pixel-rpg-xp";

/** Saqlangan XP yozuvidan jami XP (buzuq bo'lsa — 0) */
export function xpFromRaw(raw: string | null | undefined): number {
  try {
    const v = JSON.parse(raw ?? "null") as { xp?: unknown } | null;
    const n = Math.floor(Number(v?.xp));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}
