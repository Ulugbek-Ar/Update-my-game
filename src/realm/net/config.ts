/**
 * Onlayn sozlamalar: server manzili build vaqtida beriladi (VITE_SERVER_URL; GitHub Actions'da
 * pages.yml, android.yml, telegram-post.yml). Berilmagan bo'lsa — olam faqat oflayn.
 */
export const SERVER_URL = (import.meta.env.VITE_SERVER_URL ?? "").trim().replace(/\/+$/, "");

/** "1" — onlayn o'chiq (sinov va skrinshotlar uchun) */
export const OFFLINE_KEY = "pixel-rpg-offline";
/** Mehmon raqami (4 xona): "Mehmon-1234" */
export const GUEST_KEY = "pixel-rpg-guest";
/** O'yin sayti (do'st chaqirish havolasi ilovadan yuborilganda) */
export const SITE_URL = "https://ulugbek-ar.github.io/Update-my-game/";

function get(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Olamga kirganda onlayn ulanishga urinish kerakmi */
export function onlineWanted() {
  if (!SERVER_URL || get(OFFLINE_KEY) === "1") return false;
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/** Shu qurilmaning mehmon raqami (birinchi marta tasodifiy) */
export function guestTag(): string {
  const old = get(GUEST_KEY);
  if (old && /^\d{4}$/.test(old)) return old;
  const tag = String(1000 + Math.floor(Math.random() * 9000));
  try {
    localStorage.setItem(GUEST_KEY, tag);
  } catch {
    /* saqlash imkonsiz — har safar yangi */
  }
  return tag;
}

/** HTTP manzildan WebSocket manzili */
export const wsUrl = (base: string) => base.replace(/^http/, "ws");

/** Do'st chaqirish havolasi: sayt manzili ?xona=KOD */
export function inviteLink(code: string) {
  let base = SITE_URL;
  if (typeof location !== "undefined" && /^https?:$/.test(location.protocol)) {
    const local = /^(localhost|127\.|192\.168\.)/.test(location.hostname);
    // Android ilova (https://localhost) va lokal sinovda — doimiy sayt manzili
    if (!local || import.meta.env.DEV) base = location.origin + location.pathname;
  }
  const u = new URL(base);
  u.search = "";
  u.hash = "";
  u.searchParams.set("xona", code);
  return u.toString();
}
