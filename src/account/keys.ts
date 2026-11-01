/**
 * Akkaunt bilan bog'liq localStorage kalitlari — hammasi QURILMAGA XOS: bulutli saqlanishga ham,
 * progressni ko'chirish kodiga ham kirmaydi (src/game/transfer.ts DEVICE_KEYS).
 */

/** Sessiya tokeni va akkaunt ma'lumoti (taxallus, daraja...) */
export const ACCOUNT_KEY = "pixel-rpg-account";
/** Bulutli sinxron holati: qaysi versiyadan davom etyapmiz, nima o'zgargan */
export const CLOUD_KEY = "pixel-rpg-cloud";
/** Bot orqali kirish kutilmoqda (ilova qayta ochilsa ham davom etadi) */
export const LOGIN_KEY = "pixel-rpg-login";
/** Shu qurilmaning tasodifiy raqami (zaxiralarda "qaysi qurilmadan") */
export const DEVICE_ID_KEY = "pixel-rpg-device";
/** Internet yo'qligida yuborilmagan reyting natijalari */
export const SCORE_QUEUE_KEY = "pixel-rpg-scoreq";
/** Gildiya qisqachasi (teg, gerb, daraja, rol) — menyu va daraja foydalari uchun */
export const GUILD_CACHE_KEY = "pixel-rpg-guild-cache";
/** Javobi kelmagan oltinli gildiya so'rovi (tuzish, xazinaga hissa) — qayta yuboriladi */
export const GUILD_SPEND_KEY = "pixel-rpg-guild-spend";
/** Gildiya chatida o'qilgan oxirgi xabar */
export const GUILD_READ_KEY = "pixel-rpg-guild-read";

export const ACCOUNT_DEVICE_KEYS: readonly string[] = [
  ACCOUNT_KEY,
  CLOUD_KEY,
  LOGIN_KEY,
  DEVICE_ID_KEY,
  SCORE_QUEUE_KEY,
  GUILD_CACHE_KEY,
  GUILD_SPEND_KEY,
  GUILD_READ_KEY,
];
