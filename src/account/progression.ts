/**
 * Menyuda: daraja sovg'alari va olam topshiriq/sirlarining XP'si (olamga kirmagan bo'lsa ham —
 * saqlanishdan). React hook'i — menyudagi daraja belgisi XP o'zgarganda yangilanadi.
 */
import { useEffect, useState } from "react";
import { REALM_SAVE_KEY } from "@/game/realmLink";
import { addGold } from "@/game/shop";
import { awardRealm, claimLevelRewards, levelOf, loadXp, onXp, type LevelUp } from "./xp";

/** Olam saqlanishidagi bajarilgan topshiriqlar va sirlar uchun XP (har biri bir marta) */
export function syncRealmXp() {
  try {
    const s = JSON.parse(localStorage.getItem(REALM_SAVE_KEY) ?? "null") as {
      player?: { quests?: Record<string, { status?: string }>; secrets?: unknown };
    } | null;
    const p = s?.player;
    if (!p) return 0;
    const done = Object.entries(p.quests ?? {})
      .filter(([, q]) => q?.status === "done")
      .map(([id]) => id);
    const secrets = Array.isArray(p.secrets)
      ? p.secrets.filter((x): x is string => typeof x === "string")
      : [];
    return awardRealm(done, secrets);
  } catch {
    return 0;
  }
}

/** Menyuga qaytganda: XP hisobi va yangi darajalar sovg'asi (oltin shu yerda qo'shiladi) */
export function checkLevelUp(): LevelUp | null {
  syncRealmXp();
  return claimLevelRewards(addGold);
}

/** Joriy daraja va XP (qurilmadagi — bulutdagidan oldinroq yangilanadi) */
export function useLevel(rev = 0) {
  const [xp, setXp] = useState(0);
  useEffect(() => {
    setXp(loadXp().xp);
    return onXp(() => setXp(loadXp().xp));
  }, [rev]);
  return { xp, level: levelOf(xp) };
}
