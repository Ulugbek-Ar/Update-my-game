/**
 * Do'st chaqirish (klient, docs/referrals.md): havoladagi taklif kodini ushlab qolish va kirishda
 * serverga yuborish, taklif havolalari. Hisob va mukofot — faqat serverda (referrals.ts).
 *
 *   sayt:     <sayt>?ref=KOD
 *   Telegram: t.me/<bot>?start=ref_KOD (bot eslab qoladi) yoki Mini App start_param "ref_KOD"
 */
import { SITE_URL } from "@/realm/net/config";
import { telegramStartParam } from "@/lib/telegram";
import { REF_KEY } from "./keys";
import { normalizeFriendCode } from "./protocol";

/** Ilova ochilganda: URL yoki Telegram start_param'dagi taklif kodi saqlanadi (birinchisi qoladi) */
export function captureRef(search = typeof location !== "undefined" ? location.search : "") {
  let code: string | null = null;
  try {
    code = normalizeFriendCode(new URLSearchParams(search).get("ref"));
  } catch {
    /* noto'g'ri URL */
  }
  if (!code) {
    const sp = telegramStartParam();
    if (sp && /^ref_/i.test(sp)) code = normalizeFriendCode(sp.slice(4));
  }
  if (!code) return null;
  try {
    if (!localStorage.getItem(REF_KEY)) localStorage.setItem(REF_KEY, code);
  } catch {
    /* saqlash imkonsiz */
  }
  return code;
}

/** Kirish so'rovi uchun: { ref } yoki {} (kod yo'q) */
export function refField(): { ref?: string } {
  try {
    const c = normalizeFriendCode(localStorage.getItem(REF_KEY));
    return c ? { ref: c } : {};
  } catch {
    return {};
  }
}

/** Kirgandan keyin (yangi yoki eski akkaunt) — kod endi kerak emas */
export function clearRef() {
  try {
    localStorage.removeItem(REF_KEY);
  } catch {
    /* saqlash imkonsiz */
  }
}

/** Sayt havolasi: doimiy sayt manzili ?ref=KOD */
export function refSiteLink(code: string) {
  const u = new URL(SITE_URL);
  u.searchParams.set("ref", code);
  return u.toString();
}

/** Telegram bot havolasi (bot sozlanmagan bo'lsa null) */
export function refBotLink(code: string, bot: string | null) {
  return bot ? `https://t.me/${bot}?start=ref_${code}` : null;
}

export const REF_SHARE_TEXT =
  "Piksel Qal'a — retro piksel RPG! Shu havola orqali kir, 1-to'lqinni tugat — ikkalamiz 100 oltin olamiz 🏰";

/** Telegram'ning ulashish oynasi */
export function refShareLink(link: string) {
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(REF_SHARE_TEXT)}`;
}
