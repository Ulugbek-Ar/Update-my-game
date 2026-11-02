/**
 * Muallif paneli (klient). Bu yerda hech qanday huquq tekshirilmaydi: har so'rovni server
 * ADMIN_TELEGRAM_IDS bo'yicha tekshiradi, oddiy o'yinchiga "perm" qaytadi. Progressni o'zgartiradigan
 * amallar (ochish, oltin, XP, qahramon, nolga qaytarish) cloud.mutate orqali: server bulutdagi
 * nusxani o'zgartiradi, javob shu qurilmaga qo'llanadi.
 *
 * "Istalgan dunyo/to'lqindan boshlash" — faqat panel ochilganda (server admin deb tasdiqlagach).
 */
import { account } from "./account";
import { ERROR_TEXT, call } from "./api";
import { cloud } from "./cloud";
import type { ErrCode, Fail, ReqOf } from "./protocol";

/** Xato matni (panel uchun) */
export function adminErrorText(r: { error: ErrCode } & Partial<Fail>) {
  if (r.error === "perm") return "Bu amal faqat o'yin muallifi uchun";
  if (r.error === "conflict") return "Bulutdagi yangiroq progress yuklandi — qayta bosing";
  if (r.error === "net") return "Saqlab bo'lmadi: internet yo'q";
  if (r.error === "bad") return "Avval o'yin yoki olamdan menyuga chiqing";
  return ERROR_TEXT[r.error];
}

const tok = () => account.sessionToken ?? "";

type GrantBody = Omit<ReqOf<"admin/grant">, "token" | "base">;

export const adminApi = {
  info: () => call("admin/info", { token: tok() }),
  unlock: () => cloud.mutate((base) => call("admin/unlock", { token: tok(), base })),
  grant: (b: GrantBody) =>
    cloud.mutate((base) => call("admin/grant", { token: tok(), base, ...b })),
  reset: () =>
    cloud.mutate((base) => call("admin/reset", { token: tok(), base, confirm: "NOL" as const })),
  guild: (b: Omit<ReqOf<"admin/guild">, "token">) => call("admin/guild", { token: tok(), ...b }),
  guildLevel: (level: number) => call("admin/guildlevel", { token: tok(), level }),
  find: (query: string) => call("admin/find", { token: tok(), query }),
  gift: (b: Omit<ReqOf<"admin/gift">, "token">) => call("admin/gift", { token: tok(), ...b }),
};

/**
 * Muallif paneli "to'lqindan boshlash": keyingi o'yin shu dunyo va to'lqindan boshlanadi
 * (bir martalik; menyu o'qiydi va tozalaydi).
 */
export interface AdminStart {
  world: 1 | 2 | 3;
  /** 0 — 1-to'lqin, 4 — boss */
  wave: number;
}
