/**
 * Akkaunt serveriga so'rovlar (klient). Tarmoq "transport" orqali — testlarda u to'g'ridan-to'g'ri
 * server mantig'iga (handleApi) ulanadi, skrinshot/demo rejimida — soxta ma'lumotga.
 */
import { SERVER_URL } from "@/realm/net/config";
import { IS_APP, IS_DESKTOP, IS_PORTABLE } from "@/lib/platform";
import { telegramApp } from "@/lib/telegram";
import type { AccConfig, Device, ErrCode, Op, Reply, ReqOf } from "./protocol";

export type Transport = (
  op: string,
  body: unknown,
  opts?: { keepalive?: boolean },
) => Promise<unknown>;

/** So'rov shundan uzoq cho'zilsa — "internet yo'q" */
const TIMEOUT = 12_000;

/** Server bormi (build'da VITE_SERVER_URL) — bo'lmasa akkaunt tugmalari ko'rinmaydi */
export const ACCOUNTS_ENABLED = !!SERVER_URL;

function http(base: string): Transport {
  return async (op, body, opts) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const init: RequestInit = {
        method: "POST",
        // text/plain — "oddiy" so'rov: CORS preflight yo'q (har so'rov bitta)
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(body),
        signal: ctl.signal,
        cache: "no-store",
      };
      if (opts?.keepalive) init.keepalive = true;
      const r = await fetch(`${base}/acc/${op}`, init);
      return await r.json();
    } finally {
      clearTimeout(t);
    }
  };
}

let transport: Transport = http(SERVER_URL);
let configFn: () => Promise<AccConfig> = async () => {
  const r = await fetch(`${SERVER_URL}/acc/config`, { cache: "no-store" });
  return (await r.json()) as AccConfig;
};

/** Testlar va demo: boshqa transport (null — haqiqiy server) */
export function setTransport(t: Transport | null, config?: () => Promise<AccConfig>) {
  transport = t ?? http(SERVER_URL);
  if (config) configFn = config;
}

export type ApiResult<O extends Op> = Reply<O> | { ok: false; error: "net" };

export async function call<O extends Op>(
  op: O,
  body: ReqOf<O>,
  opts?: { keepalive?: boolean },
): Promise<ApiResult<O>> {
  try {
    const r = (await transport(op, body, opts)) as ApiResult<O> | null;
    return r && typeof r === "object" && "ok" in r ? r : { ok: false, error: "net" };
  } catch {
    return { ok: false, error: "net" };
  }
}

let config: Promise<AccConfig> | null = null;

/** Bot username (bir marta so'raladi; xatoda keyingi safar yana) */
export function accConfig(): Promise<AccConfig> {
  if (!config)
    config = configFn().catch(() => {
      config = null;
      return { ok: false, bot: null, botId: null };
    });
  return config;
}

/** O'yin qayerda ishlayapti */
export function currentDevice(): Device {
  if (IS_APP) return "android";
  if (IS_DESKTOP) return "windows";
  if (IS_PORTABLE) return "portable";
  if (telegramApp()) return "telegram";
  return "web";
}

/** Xato matnlari (o'zbekcha) */
export const ERROR_TEXT: Record<ErrCode, string> = {
  net: "Internet yo'q yoki server javob bermadi",
  auth: "Sessiya tugagan — qayta kiring",
  bad: "So'rov xato",
  rate: "Juda ko'p urinish — biroz kuting",
  server: "Server hozircha tayyor emas — keyinroq urinib ko'ring",
  sign: "Telegram tasdig'i noto'g'ri yoki eskirgan",
  expired: "Kod eskirgan — qaytadan urinib ko'ring",
  invalid: "Saqlanishda imkonsiz qiymat bor",
  conflict: "Bulutda yangiroq saqlanish bor",
  big: "Saqlanish juda katta",
  taken: "Bu taxallus band",
  nick: "Taxallus qoidaga mos emas",
  none: "Topilmadi",
  limit: "Chegaraga yetdingiz",
};
