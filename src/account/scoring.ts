/**
 * Reyting: jadvallar, haftalik davr (dushanba 00:00, Toshkent vaqti — UTC+5) va oddiy
 * firibgarlikka qarshi tekshiruv. Klient ham, server ham shu faylni ishlatadi.
 *
 * Tekshiruv o'yin hisobidan (game.ts): o'ldirish × kombo (≤ 5x), to'lqin bonusi 50·n (+100
 * benuqson), boss 300/500/700, qaytarilgan o'q 5, ortiqcha yurak 25. 1-dunyoning nazariy eng
 * yuqori ochkosi ≈ 5 000; tez o'yinchi uni 2–3 daqiqada oladi.
 *  - imkonsiz natija (vaqt/ochko chegarasidan tashqari) — rad etiladi;
 *  - shubhali (chegaraga yaqin) — saqlanadi, lekin reytingda yashirin (o'yinchining o'ziga
 *    "tekshiruvda" deb ko'rinadi).
 */
import { HERO_IDS } from "./protocol";
import type { Hero } from "@/game/hero";

/** Toshkent vaqti: UTC+5 (yozgi vaqt yo'q) */
export const TASHKENT_OFFSET = 5 * 3600_000;

export type BoardId = `w1:${Hero}` | "endless" | "daily" | "ashking";

export const BOARDS: readonly BoardId[] = [
  ...HERO_IDS.map((h) => `w1:${h}` as const),
  "endless",
  "daily",
  "ashking",
];

/** Kamroq — yaxshiroq (Kul qiroli: vaqt) */
export const lowerIsBetter = (b: BoardId) => b === "ashking";

export function isBoard(s: string): s is BoardId {
  return (BOARDS as readonly string[]).includes(s);
}

/** Haftaning dushanbasi (Toshkent sanasi, YYYY-MM-DD) — haftalik reyting kaliti */
export function weekKey(ms: number) {
  const t = new Date(ms + TASHKENT_OFFSET);
  const day = (t.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - day))
    .toISOString()
    .slice(0, 10);
}

/** Toshkent sanasi (kunlik sinov tekshiruvi uchun) */
export function tashkentDay(ms: number) {
  return new Date(ms + TASHKENT_OFFSET).toISOString().slice(0, 10);
}

/** Keyingi haftalik yangilanish (ms): kelasi dushanba 00:00 Toshkent */
export function nextWeekStart(ms: number) {
  const monday = Date.parse(`${weekKey(ms)}T00:00:00Z`) - TASHKENT_OFFSET;
  return monday + 7 * 86_400_000;
}

export type RunMode = "world" | "endless" | "daily";

export interface RunInput {
  mode: RunMode;
  score: number;
  /** yetilgan to'lqin: dunyo/kunlik — 1..5, cheksiz — cheksiz to'lqin raqami (1 dan) */
  wave: number;
  /** o'yin vaqti, soniya (pauzasiz) */
  time: number;
  won: boolean;
}

export type Verdict = "ok" | "hidden" | "reject";

/** 1-dunyo (va kunlik sinov) bitta o'yin ochkosining nazariy chegarasi (×2 zaxira bilan) */
export const WORLD_CAP = 12_000;

export function judgeRun(r: RunInput): Verdict {
  const { score, wave, time } = r;
  if (!Number.isFinite(score) || !Number.isFinite(time) || score < 0 || time < 0) return "reject";
  if (time > 6 * 3600) return "reject";
  if (r.mode === "endless") {
    const w = Math.max(1, Math.floor(wave));
    const cap = 5000 + 3000 * w + 60 * w * w;
    if (score > cap || time < 4 * w) return "reject";
    return score > 0.7 * cap || time < 8 * w ? "hidden" : "ok";
  }
  if (wave < 1 || wave > 5) return "reject";
  if (score > WORLD_CAP || score > 2000 + 100 * time) return "reject";
  if (r.won && (wave < 5 || time < 30)) return "reject";
  return score > 8000 || score > 1000 + 40 * time || (r.won && time < 60) ? "hidden" : "ok";
}

/** Kul qiroli (server xabar qiladi): imkonsiz tez — rad, juda tez — yashirin */
export function judgeRaid(secs: number): Verdict {
  if (!Number.isFinite(secs) || secs < 10) return "reject";
  return secs < 30 ? "hidden" : "ok";
}

/** Reyting jadvali nomi (o'zbekcha) */
export function boardName(b: BoardId) {
  if (b === "endless") return "CHEKSIZ REJIM";
  if (b === "daily") return "KUNLIK SINOV";
  if (b === "ashking") return "KUL QIROLI (ENG TEZ)";
  return "1-DUNYO";
}

/** "3:05" */
export function mmss(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
