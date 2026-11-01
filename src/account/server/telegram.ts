/**
 * Telegram imzolarini tekshirish (serverda; Cloudflare Worker va Node'da bir xil — WebCrypto).
 *
 * 1) Mini App (Telegram.WebApp.initData):
 *      secret = HMAC_SHA256(key = "WebAppData", bot_token)
 *      hash   = hex(HMAC_SHA256(key = secret, data_check_string))
 * 2) Login Widget (saytda):
 *      secret = SHA256(bot_token)
 *      hash   = hex(HMAC_SHA256(key = secret, data_check_string))
 * data_check_string — `hash` dan boshqa barcha maydonlar, kalit bo'yicha saralangan,
 * "kalit=qiymat" ko'rinishida "\n" bilan ulangan. auth_date juda eski bo'lsa — rad.
 *
 * Hujjat: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *         https://core.telegram.org/widgets/login#checking-authorization
 */

export interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
}

const enc = new TextEncoder();

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: ArrayBuffer | Uint8Array<ArrayBuffer>, data: string) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}

export async function sha256Hex(s: string) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

/** Vaqt bo'yicha teng bo'lmagan taqqoslash (imzoni taxmin qilib bo'lmasin) */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const checkString = (fields: [string, string][]) =>
  fields
    .filter(([k]) => k !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

async function webAppSecret(botToken: string) {
  return hmac(enc.encode("WebAppData"), botToken);
}

function fresh(authDate: number, now: number, maxAge: number) {
  const age = now / 1000 - authDate;
  // soat farqi: kelajakdagi sana ham bir oz (5 daqiqa) kechiriladi
  return Number.isFinite(authDate) && age < maxAge && age > -300;
}

function asUser(raw: unknown): TgUser | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  const id = Number(u["id"]);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const out: TgUser = { id };
  if (typeof u["username"] === "string") out.username = u["username"];
  if (typeof u["first_name"] === "string") out.first_name = u["first_name"];
  return out;
}

/** Mini App initData: to'g'ri va yangi bo'lsa — foydalanuvchi, aks holda null. */
export async function verifyInitData(
  initData: string,
  botToken: string,
  now: number,
  maxAge: number,
): Promise<TgUser | null> {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  const fields = [...params.entries()];
  const sig = hex(await hmac(await webAppSecret(botToken), checkString(fields)));
  if (!safeEqual(sig, hash)) return null;
  if (!fresh(Number(params.get("auth_date")), now, maxAge)) return null;
  try {
    return asUser(JSON.parse(params.get("user") ?? "null"));
  } catch {
    return null;
  }
}

/** Login Widget ma'lumoti ({ id, first_name, username, photo_url, auth_date, hash }). */
export async function verifyLoginWidget(
  data: Record<string, string | number>,
  botToken: string,
  now: number,
  maxAge: number,
): Promise<TgUser | null> {
  const hash = String(data["hash"] ?? "");
  if (!/^[0-9a-f]{64}$/.test(hash)) return null;
  const fields = Object.entries(data).map(([k, v]) => [k, String(v)] as [string, string]);
  const secret = await crypto.subtle.digest("SHA-256", enc.encode(botToken));
  const sig = hex(await hmac(secret, checkString(fields)));
  if (!safeEqual(sig, hash)) return null;
  if (!fresh(Number(data["auth_date"]), now, maxAge)) return null;
  return asUser(data);
}

/**
 * Bot webhook'ining yashirin yo'li va X-Telegram-Bot-Api-Secret-Token: bot tokenidan yasaladi —
 * alohida secret kerak emas. Deploy workflow'i (server.yml) aynan shu formula bilan setWebhook qiladi:
 *   sha256("pikselqala-webhook:" + TOKEN) ning birinchi 40 belgisi.
 */
export async function webhookSecret(botToken: string) {
  return (await sha256Hex(`pikselqala-webhook:${botToken}`)).slice(0, 40);
}

/** Bot tokenidan bot raqami ("123456:ABC" -> 123456) */
export function botIdOf(botToken: string): number | null {
  const id = Number(botToken.split(":")[0]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// ---------------- sinov va lokal ishga tushirish uchun imzolash ----------------

/** Telegram kabi initData yasaydi (testlar va `wrangler dev` dagi lokal sinov uchun). */
export async function signInitData(
  user: TgUser,
  botToken: string,
  authDate: number,
  extra: Record<string, string> = {},
) {
  const fields: [string, string][] = [
    ["auth_date", String(authDate)],
    ["query_id", "AAHtest"],
    ["user", JSON.stringify({ ...user, language_code: "uz" })],
    ...Object.entries(extra),
  ];
  const hash = hex(await hmac(await webAppSecret(botToken), checkString(fields)));
  const p = new URLSearchParams(fields);
  p.set("hash", hash);
  return p.toString();
}

/** Login Widget javobini yasaydi (testlar uchun). */
export async function signLoginWidget(user: TgUser, botToken: string, authDate: number) {
  const data: Record<string, string | number> = { ...user, auth_date: authDate };
  const fields = Object.entries(data).map(([k, v]) => [k, String(v)] as [string, string]);
  const secret = await crypto.subtle.digest("SHA-256", enc.encode(botToken));
  return { ...data, hash: hex(await hmac(secret, checkString(fields))) };
}
