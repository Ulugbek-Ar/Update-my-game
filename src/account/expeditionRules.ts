/**
 * Ekspeditsiya mukofoti — sof hisob (server ham, klient ham, testlar ham ishlatadi).
 *
 * HISOB (o'ynash har doim foydaliroq bo'lsin):
 *  - 1-dunyoning to'liq o'yini (hero.ts GUNNER_PRICE izohi): ≈ 67 oltin; XP — 5 to'lqin × 10 +
 *    Iblis 50 = 100 XP; o'yin ≈ 6 daqiqa. Ya'ni o'ynagan o'yinchi soatiga ≈ 600+ oltin topadi.
 *  - Ekspeditsiya soatiga shu BITTA o'yinning ~15% i: 10 oltin (67 × 0.15) va 15 XP (100 × 0.15).
 *  - Ko'pi bilan 8 soat: 80 oltin + 120 XP (bonussiz). Bu kunlik sovg'aning o'rtacha kuni (≈ 17)
 *    dan ko'p, lekin bir haftalik sovg'adan (120) kam; Mergan (300) ning ~27% i, do'kondagi eng
 *    arzon kuchaytirish (20–30) ning 3–4 tasi — tunda "uxlab yotgan" o'yinchi uchun kichik sovg'a,
 *    bir soat o'ynash esa ≈ 60 baravar foydaliroq.
 *  - Bonus: o'yinchi darajasi (50-darajada +25%, chiziqli) va do'kon kuchaytirishlari (har bosqich
 *    +1.5%; hammasi — 10 bosqich, +15%). Eng ko'pi: 8 soat × 1.4 ≈ 112 oltin + 168 XP.
 *  - Sandiq: har soatga 6% (8 soatda 48%) — Abadiyat olami uchun noyob buyum (olam pochtasiga).
 *  - 10 daqiqadan qisqa ekspeditsiya hech narsa bermaydi.
 */

export const EXP_GOLD_PER_HOUR = 10;
export const EXP_XP_PER_HOUR = 15;
/** Mukofot shuncha soatgacha to'planadi */
export const EXP_MAX_HOURS = 8;
export const EXP_MAX_MS = EXP_MAX_HOURS * 3_600_000;
/** Shundan qisqa — mukofot yo'q */
export const EXP_MIN_MINUTES = 10;
export const EXP_CHEST_PER_HOUR = 0.06;
/** Sandiqdagi noyob buyumlar (src/realm/data/items.json; olam pochtasiga yuboriladi) */
export const EXP_CHEST_ITEMS = ["potion", "star", "glow", "core"] as const;

export interface ExpInput {
  /** o'tgan vaqt (ms) — 8 soatdan ko'pi hisoblanmaydi */
  ms: number;
  /** o'yinchi darajasi (1..50) */
  level: number;
  /** do'kon kuchaytirishlari bosqichlari yig'indisi (0..10) */
  shop: number;
  /** tasodif [0, 1): sandiq bormi va qaysi buyum (testda — aniq) */
  roll: number;
  pick: number;
}

export interface ExpResult {
  minutes: number;
  gold: number;
  xp: number;
  chest: string | null;
}

/** Daraja va do'kon bonusi (1.0 .. 1.4) */
export function expBonus(level: number, shop: number) {
  const l = Math.max(1, Math.min(50, Math.floor(level) || 1));
  const s = Math.max(0, Math.min(10, Math.floor(shop) || 0));
  return 1 + (0.25 * (l - 1)) / 49 + 0.015 * s;
}

export function expeditionReward(i: ExpInput): ExpResult {
  const ms = Math.max(0, Math.min(EXP_MAX_MS, i.ms));
  const minutes = Math.floor(ms / 60_000);
  if (minutes < EXP_MIN_MINUTES) return { minutes, gold: 0, xp: 0, chest: null };
  const hours = minutes / 60;
  const k = expBonus(i.level, i.shop);
  const chest =
    i.roll < Math.min(1, hours * EXP_CHEST_PER_HOUR)
      ? EXP_CHEST_ITEMS[
          Math.min(EXP_CHEST_ITEMS.length - 1, Math.floor(i.pick * EXP_CHEST_ITEMS.length))
        ]!
      : null;
  return {
    minutes,
    gold: Math.floor(hours * EXP_GOLD_PER_HOUR * k),
    xp: Math.floor(hours * EXP_XP_PER_HOUR * k),
    chest,
  };
}

/** Do'kon bosqichlari yig'indisi (SHOP_KEY yozuvidan) */
export function shopTotal(raw: string | null | undefined) {
  try {
    const v = JSON.parse(raw ?? "null") as Record<string, unknown> | null;
    if (!v || typeof v !== "object") return 0;
    return Object.values(v).reduce<number>(
      (s, x) => s + Math.max(0, Math.floor(Number(x) || 0)),
      0,
    );
  } catch {
    return 0;
  }
}

/** "3 soat 12 daqiqa" / "45 daqiqa" */
export function expTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return m ? `${h} soat ${m} daqiqa` : `${h} soat`;
  return `${m} daqiqa`;
}

/**
 * Mehmon (akkauntsiz) ekspeditsiyasi — qurilma soati. Vaqt kichik qadamlar bilan yig'iladi:
 * soat orqaga surilsa — bu qadam hisoblanmaydi (faqat yangi boshlanish nuqtasi), oldinga keskin
 * sakrash esa 8 soat chegarasidan oshmaydi.
 */
export interface LocalExp {
  hero: string;
  /** yig'ilgan vaqt (ms) */
  acc: number;
  /** oxirgi o'lchangan qurilma vaqti */
  mark: number;
}

export function advanceLocal(e: LocalExp, now: number): LocalExp {
  const d = now - e.mark;
  if (!Number.isFinite(d) || d < 0) return { ...e, mark: now };
  return { ...e, acc: Math.min(EXP_MAX_MS, e.acc + d), mark: now };
}
