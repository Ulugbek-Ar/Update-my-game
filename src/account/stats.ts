/**
 * Profil statistikasi (progress kaliti — bulutga va ko'chirish kodiga kiradi): o'ynalgan vaqt,
 * yengilgan dushmanlar va bosslar, o'yinlar va to'lqinlar. Asosiy o'yin har o'yin oxirida,
 * Abadiyat olami — har saqlanishda (10 s) qo'shadi; har o'ldirishda yozilmaydi.
 */
export const STATS_KEY = "pixel-rpg-stats";

export interface PlayStats {
  /** o'ynalgan vaqt, soniya (pauzasiz) */
  time: number;
  kills: number;
  bosses: number;
  /** tugagan o'yinlar (sarguzasht, cheksiz, kunlik) */
  runs: number;
  waves: number;
}

const ZERO: PlayStats = { time: 0, kills: 0, bosses: 0, runs: 0, waves: 0 };

export function loadStats(): PlayStats {
  try {
    const v = JSON.parse(localStorage.getItem(STATS_KEY) ?? "null") as Partial<PlayStats> | null;
    const out = { ...ZERO };
    if (v && typeof v === "object")
      for (const k of Object.keys(ZERO) as (keyof PlayStats)[]) {
        const n = Number(v[k]);
        out[k] = Number.isFinite(n) && n > 0 ? n : 0;
      }
    return out;
  } catch {
    return { ...ZERO };
  }
}

export function addStats(d: Partial<PlayStats>) {
  const s = loadStats();
  let changed = false;
  for (const k of Object.keys(ZERO) as (keyof PlayStats)[]) {
    const n = Number(d[k] ?? 0);
    if (Number.isFinite(n) && n > 0) {
      s[k] = k === "time" ? Math.round((s[k] + n) * 10) / 10 : s[k] + Math.floor(n);
      changed = true;
    }
  }
  if (!changed) return;
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
  } catch {
    /* saqlash imkonsiz */
  }
}

/** "3 soat 12 daqiqa" */
export function playTime(sec: number) {
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h} soat ${m % 60} daqiqa`;
  return `${m} daqiqa`;
}
