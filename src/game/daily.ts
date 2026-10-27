/** Kunlik sinov: sanaga bog'liq seed — hamma uchun bir xil to'lqinlar va kuch tanlovlari. */
import type { Hero } from "./hero";

export const DAILY_KEY = "pixel-rpg-daily";

export interface DailyResult {
  date: string;
  hero: Hero;
  score: number;
  /** Yetib borilgan to'lqin (1 dan) */
  wave: number;
  won: boolean;
}

/** Mahalliy sana YYYY-MM-DD ko'rinishida. */
export function todayKey(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Satrdan barqaror 32-bit seed. */
export function seedFrom(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Mulberry32 — kichik, takrorlanuvchi tasodifiy sonlar generatori. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kunlik sinov uchun alohida oqimlar: biri dushman joylari, biri kuch kartalari. */
export function dailyRandoms(date: string) {
  return {
    spawn: seededRandom(seedFrom(`${date}:spawn`)),
    cards: seededRandom(seedFrom(`${date}:cards`)),
  };
}

/** Bugungi urinish natijasi (bo'lmasa null). */
export function loadDaily(date = todayKey()): DailyResult | null {
  try {
    const r = JSON.parse(localStorage.getItem(DAILY_KEY) ?? "null") as DailyResult | null;
    return r && r.date === date && typeof r.score === "number" ? r : null;
  } catch {
    return null;
  }
}

export function saveDaily(r: DailyResult) {
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(r));
  } catch {
    /* saqlash imkonsiz */
  }
}
