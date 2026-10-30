/**
 * Telegram kanalga kompyuter (PC) fayllarini yuborish qoidalari (scripts/telegram-pc.mjs va
 * .github/workflows/telegram-post.yml ishlatadi). Boshqa modullarga bog'liq emas —
 * Node `--experimental-strip-types` bilan to'g'ridan-to'g'ri import qilinadi.
 */

/** Telegram Bot API sendDocument chegarasi — 50 MB */
export const TELEGRAM_FILE_LIMIT = 50 * 1024 * 1024;

export const WINDOWS_ZIP = "PikselQala-Windows.zip";
export const PORTABLE_ZIP = "PikselQala-portable.zip";

/** PC fayllari APK bilan bir xil: faqat x.y.0 versiyalarda (x.y.z, z > 0 — faqat post). */
export function isPcRelease(version: string) {
  return /^\d+\.\d+\.0$/.test(version);
}

export function releaseUrl(repo: string, version: string) {
  return `https://github.com/${repo}/releases/tag/v${version}`;
}

/** Fayl Telegram'ga sig'adimi — sig'masa faqat Release havolasi yuboriladi */
export function fitsTelegram(size: number) {
  return size > 0 && size <= TELEGRAM_FILE_LIMIT;
}

/** sendDocument izohi (Telegram chegarasi — 1024 belgi). */
export function pcCaption(file: string, version: string) {
  if (file === WINDOWS_ZIP)
    return [
      `💻 Piksel Qal'a v${version} — Windows dasturi (Windows 10/11)`,
      "",
      "O'rnatish shart emas, admin huquqi kerak emas, internetsiz ishlaydi:",
      "1. Arxivni yuklab oling va papkaga chiqaring («Извлечь все»).",
      "2. «Piksel Qala.exe» ni ikki marta bosing.",
      "3. «Windows компьютер защищен» (SmartScreen) chiqsa: «Подробнее / Batafsil» → «Выполнить в любом случае / Baribir ishga tushirish».",
      "",
      "F11 — to'liq ekran. Saqlanishlar kompyuterda qoladi, yangi versiyada o'chmaydi.",
      "",
      "#windows #pc",
    ].join("\n");
  return [
    `🌐 Piksel Qal'a v${version} — portativ versiya (har qanday kompyuter)`,
    "",
    "Bitta HTML fayl: Chrome, Edge yoki Firefox'da ochiladi, internet va o'rnatish kerak emas.",
    "1. Arxivni chiqaring.",
    "2. «Piksel Qala.html» ni ikki marta bosing.",
    "",
    "Saqlanishlar shu brauzerda. Boshqa joyga — progressni ko'chirish kodi orqali.",
    "",
    "#pc #portativ",
  ].join("\n");
}

/** Fayl 50 MB dan katta bo'lsa — havolali xabar */
export function tooBigMessage(file: string, version: string, url: string) {
  return `💻 Piksel Qal'a v${version}: ${file} Telegram uchun juda katta (50 MB dan ortiq).\nYuklab olish: ${url}`;
}
