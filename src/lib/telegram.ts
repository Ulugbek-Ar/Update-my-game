/**
 * Telegram Mini App ichidami (telegram-web-app.js skripti Telegram'dan tashqarida ham WebApp beradi,
 * lekin initData bo'sh bo'ladi). Do'st chaqirish: Telegram'ning ulashish oynasi va start_param.
 */
interface TelegramShareApp {
  initData?: string;
  initDataUnsafe?: { start_param?: string };
  openTelegramLink?: (url: string) => void;
}

export function telegramApp(): TelegramShareApp | null {
  if (typeof window === "undefined") return null;
  const tg = (window as unknown as { Telegram?: { WebApp?: TelegramShareApp } }).Telegram?.WebApp;
  return tg?.initData ? tg : null;
}

/** Telegram ulashish oynasi (kontakt yoki guruh tanlanadi). false — Telegram'da emas. */
export function telegramShare(url: string, text: string) {
  const tg = telegramApp();
  if (!tg?.openTelegramLink) return false;
  const q = new URLSearchParams({ url, text });
  try {
    tg.openTelegramLink(`https://t.me/share/url?${q}`);
    return true;
  } catch {
    return false;
  }
}

/** Mini App havolasidagi start_param (t.me/...?startapp=KOD) */
export function telegramStartParam() {
  return telegramApp()?.initDataUnsafe?.start_param ?? null;
}
