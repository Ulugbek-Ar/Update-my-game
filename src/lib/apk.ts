/**
 * Telegram kanalga Android APK yuborish qoidalari (scripts/telegram-apk.mjs va
 * .github/workflows/telegram-post.yml ishlatadi). Boshqa modullarga bog'liq emas —
 * Node `--experimental-strip-types` bilan to'g'ridan-to'g'ri import qilinadi.
 */

/**
 * APK har 10 ta versiyada bir marta yuboriladi: x.y.0, y — 10 ga karrali (3.20.0, 4.0.0, 4.10.0).
 * Qolgan versiyalarda (3.13.0, 3.12.1) — faqat post. Qo'lda "APK yuborish" har doim ishlaydi.
 */
export function isApkRelease(version: string) {
  const m = /^(\d+)\.(\d+)\.0$/.exec(version);
  return !!m && Number(m[2]) % 10 === 0;
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
    "",
    "#apk #android",
  ].join("\n");
}
