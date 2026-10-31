/** Dunyolar bo'yicha yutuqlar: xarita qulflari, eng yaxshi ochko va yutgan qahramonlar (localStorage). */
import { loadAchievements } from "./achievements";
import { HEROES, bestKeys, type Hero } from "./hero";

export type MapWorld = 1 | 2 | 3;
export const MAP_WORLDS: readonly MapWorld[] = [1, 2, 3];

/** Dunyo yutilgan belgisi (1-dunyoniki v1.9.0 dan beri bor) */
export const WORLD1_WON_KEY = "pixel-rpg-world1-won";
export const WORLD2_WON_KEY = "pixel-rpg-world2-won";
export const WORLD3_WON_KEY = "pixel-rpg-world3-won";
const WON_KEYS: Record<MapWorld, string> = {
  1: WORLD1_WON_KEY,
  2: WORLD2_WON_KEY,
  3: WORLD3_WON_KEY,
};
/** Har dunyoni qaysi qahramonlar yutgan: { "1": ["knight"], ... } */
export const WORLD_WINS_KEY = "pixel-rpg-world-wins";

function get(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* saqlash imkonsiz */
  }
}

/** Dunyo bo'yicha rekord kaliti (1-dunyo — umumiy o'yin rekordi). */
function bestKey(w: MapWorld, h: Hero) {
  const k = bestKeys(h);
  return w === 1 ? k.best : w === 2 ? k.ch2 : k.ch3;
}

function storedWins(): Record<MapWorld, Hero[]> {
  const out: Record<MapWorld, Hero[]> = { 1: [], 2: [], 3: [] };
  try {
    const raw = JSON.parse(get(WORLD_WINS_KEY) ?? "null") as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") return out;
    for (const w of MAP_WORLDS) {
      const list = raw[w];
      if (Array.isArray(list)) out[w] = HEROES.filter((h) => list.includes(h));
    }
  } catch {
    /* buzuq ma'lumot */
  }
  return out;
}

/**
 * Har dunyoni yutgan qahramonlar. Eski saqlashlardan ham tiklanadi:
 * "Ritsar/Sehrgar bilan yut" yutug'i — 1-dunyo, 2-dunyo rekordi bor qahramon — 2-dunyo.
 */
export function worldWins(): Record<MapWorld, Hero[]> {
  const wins = storedWins();
  const ach = loadAchievements();
  const add = (w: MapWorld, h: Hero) => {
    if (!wins[w].includes(h)) wins[w] = HEROES.filter((x) => x === h || wins[w].includes(x));
  };
  if (ach.has("winKnight")) add(1, "knight");
  if (ach.has("winMage")) add(1, "mage");
  if (ach.has("winHunter")) add(1, "hunter");
  if (ach.has("winGunner")) add(1, "gunner");
  if (ach.has("winPaladin")) add(1, "paladin");
  for (const h of HEROES) {
    if (Number(get(bestKey(2, h))) > 0) add(2, h);
    if (Number(get(bestKey(3, h))) > 0) add(3, h);
  }
  return wins;
}

/** Dunyo yutildi: belgi va yutgan qahramon saqlanadi. */
export function recordWorldWin(w: MapWorld, h: Hero) {
  set(WON_KEYS[w], "1");
  const wins = storedWins();
  if (!wins[w].includes(h)) wins[w].push(h);
  set(WORLD_WINS_KEY, JSON.stringify(wins));
}

export function isWorldWon(w: MapWorld) {
  if (get(WON_KEYS[w])) return true;
  if (worldWins()[w].length) return true;
  // Qor Malikasini yengan eski o'yinchi 2-dunyoni yutgan
  return w === 2 && loadAchievements().has("queen");
}

/** Xaritada dunyo ochiqmi: oldingi dunyo yutilgan bo'lishi kerak. */
export function isWorldOpen(w: MapWorld) {
  return w === 1 || isWorldWon((w - 1) as MapWorld);
}

/** Dunyodagi eng yaxshi ochko (barcha qahramonlar orasida). */
export function worldBest(w: MapWorld) {
  return Math.max(0, ...HEROES.map((h) => Number(get(bestKey(w, h))) || 0));
}
