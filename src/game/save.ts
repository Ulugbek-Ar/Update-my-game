/**
 * Saqlangan ma'lumotlar migratsiyasi. Eski versiyadagi hech bir kalit (rekord, oltin, do'kon,
 * yutuqlar, sozlamalar, kunlik sinov) o'chirilmaydi yoki o'zgartirilmaydi — faqat yangilari qo'shiladi.
 */
import { MAP_WORLDS, isWorldWon, recordWorldWin, worldWins } from "./progress";
import { HERO_KEY, HERO_LIST, type Hero } from "./hero";

export const SAVE_VERSION_KEY = "pixel-rpg-save-version";
export const SAVE_VERSION = 3;
/** Ochilgan (sotib olingan) qahramonlar ro'yxati — JSON massiv */
export const UNLOCKED_HEROES_KEY = "pixel-rpg-unlocked-heroes";

/** Bepul (price: 0) qahramonlar doim ochiq; pullilari faqat ro'yxatda bo'lsa. */
export function loadUnlockedHeroes(): Set<Hero> {
  const set = new Set<Hero>(HERO_LIST.filter((h) => h.price <= 0).map((h) => h.id));
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(UNLOCKED_HEROES_KEY) ?? "[]");
    if (Array.isArray(raw))
      for (const id of raw) {
        const h = HERO_LIST.find((x) => x.id === id);
        if (h) set.add(h.id);
      }
  } catch {
    /* buzilgan yozuv — faqat bepullar */
  }
  return set;
}

export function isHeroUnlocked(h: Hero) {
  return loadUnlockedHeroes().has(h);
}

export function unlockHero(h: Hero) {
  const set = loadUnlockedHeroes();
  set.add(h);
  try {
    localStorage.setItem(UNLOCKED_HEROES_KEY, JSON.stringify([...set]));
  } catch {
    /* saqlash imkonsiz */
  }
}

/** Bir marta ishlaydi; migratsiya bajarilgan bo'lsa true qaytaradi. */
export function migrateSave() {
  try {
    const v = Number(localStorage.getItem(SAVE_VERSION_KEY)) || 1;
    if (v >= SAVE_VERSION) return false;
    if (v < 2) {
      // v1 -> v2: xarita uchun dunyo yutuqlari eski yutuq va rekordlardan yoziladi
      const wins = worldWins();
      for (const w of MAP_WORLDS) {
        for (const h of wins[w]) recordWorldWin(w, h);
        // qahramoni noma'lum g'alaba (masalan, eski "Muzni eritdi" yutug'i) ham qulfni ochadi
        if (!wins[w].length && isWorldWon(w)) localStorage.setItem(`pixel-rpg-world${w}-won`, "1");
      }
    }
    if (v < 3) {
      // v2 -> v3: hozirgacha o'ynalgan har qahramon (bepullar va tanlangani) ochiq qoladi
      const set = loadUnlockedHeroes();
      const cur = HERO_LIST.find((h) => h.id === localStorage.getItem(HERO_KEY));
      if (cur) set.add(cur.id);
      localStorage.setItem(UNLOCKED_HEROES_KEY, JSON.stringify([...set]));
    }
    localStorage.setItem(SAVE_VERSION_KEY, String(SAVE_VERSION));
    return true;
  } catch {
    return false;
  }
}
