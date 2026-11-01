/**
 * Bulutli saqlanishdagi oddiy chegaralar (serverda tekshiriladi, testlarda ham): o'yinchi
 * yuborgan qiymatlarga ko'r-ko'rona ishonilmaydi. Imkonsiz miqdor — saqlanish rad etiladi.
 *
 * Mo'ljal (hero.ts dagi oltin iqtisodi): to'liq uch dunyoli o'yin ≈ 200 oltin / 25 daqiqa,
 * Kul qiroli ≈ 100 oltin. Soatiga 2 000 oltin — eng tez o'yinchidan ham bir necha baravar ko'p.
 */
import { HERO_LIST, bestKeys } from "@/game/hero";
import { GOLD_KEY } from "@/game/shop";
import { DAILY_KEY } from "@/game/daily";
import { XP_KEY, xpFromRaw } from "./xp";

export type Keys = Record<string, string>;

/** Oltin: jami eng ko'pi va bir saqlanishdan keyingisigacha o'sishi */
export const GOLD_CAP = 1_000_000;
export const GOLD_BURST = 3_000;
export const GOLD_PER_HOUR = 2_000;
/** Bitta o'yin ochkosi (dunyo rekordlari, kunlik sinov) va cheksiz rejim */
export const SCORE_CAP = 300_000;
export const ENDLESS_CAP = 3_000_000;
/** XP: jami (50-daraja ≈ 28 420) va o'sish */
export const XP_CAP = 1_000_000;
export const XP_BURST = 5_000;
export const XP_PER_HOUR = 3_000;
/** O'sish shundan uzoq vaqtga hisoblanmaydi (14 kun) */
const MAX_HOURS = 24 * 14;

export type LimitField = "gold" | "score" | "xp";

export const FIELD_TEXT: Record<LimitField, string> = {
  gold: "oltin",
  score: "rekord",
  xp: "tajriba (XP)",
};

/** O'yin kabi o'qiladi: son bo'lmagan yozuv — 0 (buzuq yozuv saqlashni to'xtatmaydi) */
function int(v: string | undefined) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function dailyScore(raw: string | undefined) {
  try {
    const d = JSON.parse(raw ?? "null") as { score?: unknown } | null;
    const n = Number(d?.score ?? 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * next — yangi saqlanish, prev — bulutdagi joriy (yo'q bo'lsa — faqat mutlaq chegaralar),
 * hours — prev saqlangandan beri o'tgan vaqt (soat). Rad etish sababi yoki null.
 */
export function checkSave(next: Keys, prev: Keys | null, hours: number): LimitField | null {
  const h = Math.max(0, Math.min(MAX_HOURS, hours));
  const gold = int(next[GOLD_KEY]);
  if (gold > GOLD_CAP) return "gold";
  if (prev) {
    const before = Math.max(0, int(prev[GOLD_KEY]));
    if (gold - before > GOLD_BURST + GOLD_PER_HOUR * h) return "gold";
  }
  for (const hero of HERO_LIST) {
    const k = bestKeys(hero.id);
    for (const key of [k.best, k.ch2, k.ch3]) {
      if (int(next[key]) > SCORE_CAP) return "score";
    }
    if (int(next[k.endless]) > ENDLESS_CAP) return "score";
  }
  if (dailyScore(next[DAILY_KEY]) > SCORE_CAP) return "score";
  const xp = xpFromRaw(next[XP_KEY]);
  if (xp > XP_CAP) return "xp";
  if (prev && xp - xpFromRaw(prev[XP_KEY]) > XP_BURST + XP_PER_HOUR * h) return "xp";
  return null;
}
