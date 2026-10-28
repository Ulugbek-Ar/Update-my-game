/**
 * Saqlangan ma'lumotlar migratsiyasi. Eski versiyadagi hech bir kalit (rekord, oltin, do'kon,
 * yutuqlar, sozlamalar, kunlik sinov) o'chirilmaydi yoki o'zgartirilmaydi — faqat yangilari qo'shiladi.
 */
import { MAP_WORLDS, isWorldWon, recordWorldWin, worldWins } from "./progress";

export const SAVE_VERSION_KEY = "pixel-rpg-save-version";
export const SAVE_VERSION = 2;

/** Bir marta ishlaydi; migratsiya bajarilgan bo'lsa true qaytaradi. */
export function migrateSave() {
  try {
    const v = Number(localStorage.getItem(SAVE_VERSION_KEY)) || 1;
    if (v >= SAVE_VERSION) return false;
    // v1 -> v2: xarita uchun dunyo yutuqlari eski yutuq va rekordlardan yoziladi
    const wins = worldWins();
    for (const w of MAP_WORLDS) {
      for (const h of wins[w]) recordWorldWin(w, h);
      // qahramoni noma'lum g'alaba (masalan, eski "Muzni eritdi" yutug'i) ham qulfni ochadi
      if (!wins[w].length && isWorldWon(w)) localStorage.setItem(`pixel-rpg-world${w}-won`, "1");
    }
    localStorage.setItem(SAVE_VERSION_KEY, String(SAVE_VERSION));
    return true;
  } catch {
    return false;
  }
}
