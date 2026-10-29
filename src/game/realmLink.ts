/**
 * Asosiy o'yin va Abadiyat olami orasidagi bog'lanish (localStorage):
 * olam qulfi, bosslardan olingan darvoza kalitlari va olamga yuboriladigan buyumlar ("pochta").
 * Qahramonlar, oltin va yutuqlar umumiy; olam buyumlari faqat olamda ishlaydi.
 */
import { loadAchievements } from "./achievements";
import { isWorldWon } from "./progress";

/** Olam saqlanishi (RealmClient yozadi) */
export const REALM_SAVE_KEY = "pixel-rpg-realm";
/** Asosiy bosslardan olingan darvoza kalitlari: ["devil", "queen", "king"] */
export const REALM_KEYS_KEY = "pixel-rpg-realm-keys";
/** Olamga yuborilgan buyumlar: olamga kirganda inventarga o'tadi */
export const REALM_INBOX_KEY = "pixel-rpg-realm-inbox";
/** Dev rejimi: olam qulfini chetlab o'tish (faqat `bun run dev` da) */
export const DEV_KEY = "pixel-rpg-dev";

export type BossKey = "devil" | "queen" | "king";
export const BOSS_KEYS: readonly BossKey[] = ["devil", "queen", "king"];
/** "Iblisning shoxi" topshirig'i va uning buyumi */
export const HORN_QUEST = "horn";
export const HORN_ITEM = "horn";

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
function list(key: string): string[] {
  try {
    const raw = JSON.parse(get(key) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Olingan kalitlar. Eski saqlanishlardan ham tiklanadi:
 * "IBLISNI YENG" yutug'i yoki 1-dunyo yutilgan — Iblis, "MUZNI ERITDI" yoki 2-dunyo — Malika, 3-dunyo — Shoh.
 */
export function loadBossKeys(): Set<BossKey> {
  const keys = new Set(BOSS_KEYS.filter((k) => list(REALM_KEYS_KEY).includes(k)));
  const ach = loadAchievements();
  if (ach.has("boss") || isWorldWon(1)) keys.add("devil");
  if (ach.has("queen") || isWorldWon(2)) keys.add("queen");
  if (isWorldWon(3)) keys.add("king");
  return keys;
}

/** Boss birinchi marta yengildi: kalit saqlanadi; yangi kalit bo'lsa true. */
export function recordBossKey(k: BossKey) {
  const stored = list(REALM_KEYS_KEY);
  if (stored.includes(k)) return false;
  set(REALM_KEYS_KEY, JSON.stringify([...stored, k]));
  return true;
}

export function isDevMode() {
  return import.meta.env.DEV && get(DEV_KEY) === "1";
}

/** OLAM tugmasi: 1-dunyo Iblisi kamida bir marta yengilgan bo'lsa (yoki dev rejimida) ochiq. */
export function isRealmUnlocked() {
  return loadBossKeys().has("devil") || isDevMode();
}

/** Olamga yuborilgan, hali olinmagan buyumlar. */
export function realmInbox() {
  return list(REALM_INBOX_KEY);
}

export function sendToRealm(item: string) {
  set(REALM_INBOX_KEY, JSON.stringify([...realmInbox(), item]));
}

/** Olam klienti kirishda chaqiradi: buyumlarni oladi va pochtani bo'shatadi. */
export function takeRealmInbox() {
  const items = realmInbox();
  if (items.length) set(REALM_INBOX_KEY, "[]");
  return items;
}

/**
 * "Iblisning shoxi" faolmi va shox hali qo'lga kirmaganmi (olam inventarida ham, pochtada ham yo'q).
 * Faqat shunda 1-dunyodagi Iblis o'lganda shox tushadi.
 */
export function hornWanted() {
  if (realmInbox().includes(HORN_ITEM)) return false;
  try {
    const s = JSON.parse(get(REALM_SAVE_KEY) ?? "null") as {
      player?: { quests?: Record<string, { status?: string }>; inv?: ({ item: string } | null)[] };
    } | null;
    const p = s?.player;
    if (p?.quests?.[HORN_QUEST]?.status !== "active") return false;
    return !p.inv?.some((x) => x?.item === HORN_ITEM);
  } catch {
    return false;
  }
}
