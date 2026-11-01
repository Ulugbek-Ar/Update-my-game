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

export const ACCOUNT_DEVICE_KEYS: readonly string[] = [
  ACCOUNT_KEY,
  CLOUD_KEY,
  LOGIN_KEY,
  DEVICE_ID_KEY,
];
