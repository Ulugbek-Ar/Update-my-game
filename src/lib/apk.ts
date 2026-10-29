/**
 * Telegram kanalga Android APK yuborish qoidalari (scripts/telegram-apk.mjs va
 * .github/workflows/telegram-post.yml ishlatadi). Boshqa modullarga bog'liq emas —
 * Node `--experimental-strip-types` bilan to'g'ridan-to'g'ri import qilinadi.
 */

/** APK faqat x.y.0 versiyalarda yuboriladi; x.y.z (z > 0) kichik tuzatishlarda — faqat post. */
export function isApkRelease(version: string) {
  return /^\d+\.\d+\.0$/.test(version);
}

export function apkFileName(version: string) {
  return `PikselQala-v${version}.apk`;
}

/** sendDocument izohi (Telegram chegarasi — 1024 belgi). */
export function apkCaption(version: string) {
  return [
    `📲 Piksel Qal'a v${version} — Android ilova (APK)`,
    "",
    "Qanday o'rnatiladi:",
    "1. Faylni yuklab oling.",
    "2. Yuklangan faylni oching va «O'rnatish»ni bosing.",
    "3. Telefon so'rasa, «Noma'lum manbalardan o'rnatish»ga ruxsat bering (Sozlamalar → Telegram → Ruxsat berish), so'ng orqaga qaytib o'rnating.",
    "",
    "Yangi versiyani eskisi ustidan o'rnating — saqlanishlar o'chmaydi.",
  ].join("\n");
}
