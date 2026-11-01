/**
 * Akkaunt API (klient <-> server) — so'rov sxemalari va javob turlari. Klient ham, server ham
 * shu faylni ishlatadi. Hamma so'rov: POST /acc/<op>, tanasi JSON (Content-Type: text/plain —
 * CORS preflight kerak emas), kirgan o'yinchida tanada `token`.
 *
 * Batafsil: docs/accounts.md
 */
import { z } from "zod";
import type { Hero } from "@/game/hero";

/** Sessiya muddati (kun): har kuni birinchi so'rovda yana shuncha uzayadi */
export const SESSION_DAYS = 60;
/** Bot orqali kirish kodi: 5 daqiqa amal qiladi, bir martalik */
export const LOGIN_TTL = 5 * 60_000;
/** Telegram initData va Login Widget ma'lumoti shundan eski bo'lsa — rad (soniya) */
export const AUTH_MAX_AGE = 24 * 3600;
/** Bitta saqlanishning eng katta hajmi (JSON belgilari) */
export const MAX_SAVE = 200_000;
/** So'rov tanasining eng katta hajmi */
export const MAX_BODY = 240_000;

/** O'yin qayerda ishlayapti (zaxiralarda va bot xabarida ko'rinadi) */
export const DEVICES = ["web", "telegram", "android", "windows", "portable"] as const;
export type Device = (typeof DEVICES)[number];
export const DEVICE_NAME: Record<Device, string> = {
  web: "Sayt",
  telegram: "Telegram",
  android: "Android ilova",
  windows: "Windows dasturi",
  portable: "Portativ versiya",
};

export const HERO_IDS = [
  "knight",
  "mage",
  "hunter",
  "gunner",
  "paladin",
] as const satisfies readonly Hero[];

/** Kirgan o'yinchining o'z ma'lumoti */
export interface Me {
  id: number;
  nick: string;
  avatar: Hero;
  xp: number;
  level: number;
  /** Do'st kodi (8 belgi, ko'rsatishda "XXXX-XXXX") */
  code: string;
  /** Akkaunt yaratilgan vaqt (ms) */
  created: number;
  /** Telegram ID (faqat o'ziga ko'rinadi) */
  tg: number;
}

/** Bulutdagi saqlanish: progress kalitlari (qurilmaga xoslarisiz) */
export interface CloudSave {
  /** Server bergan tartib raqami: har saqlanishda +1 */
  version: number;
  /** Progress oxirgi marta o'zgargan vaqt (klient soati, ms) — ziddiyatda kim yangi */
  time: number;
  device: Device;
  data: Record<string, string>;
}

export type ErrCode =
  /** (faqat klientda) internet yo'q yoki server javob bermadi */
  | "net"
  /** sessiya yo'q yoki muddati tugagan — qayta kirish kerak */
  | "auth"
  /** so'rov noto'g'ri */
  | "bad"
  /** juda ko'p so'rov */
  | "rate"
  /** serverda bot sozlanmagan yoki band */
  | "server"
  /** Telegram imzosi noto'g'ri yoki eskirgan */
  | "sign"
  /** kod eskirgan yoki ishlatilgan */
  | "expired"
  /** saqlanishda imkonsiz qiymat */
  | "invalid"
  /** bulutda yangiroq saqlanish bor (javobda o'sha saqlanish) */
  | "conflict"
  /** saqlanish juda katta */
  | "big"
  /** taxallus band */
  | "taken"
  /** taxallus qoidaga mos emas */
  | "nick"
  /** topilmadi (o'yinchi, do'st) */
  | "none"
  /** chegaraga yetdi (do'stlar soni va h.k.) */
  | "limit";

export type Fail = { ok: false; error: ErrCode; field?: string; save?: CloudSave };

// ---------------- so'rov sxemalari ----------------

const token = z.string().regex(/^[A-Za-z0-9_-]{32,64}$/);
const device = z.enum(DEVICES);
const hero = z.enum(HERO_IDS);
const keys = z.record(z.string().max(80), z.string().max(MAX_SAVE));

export const LOGIN_CODE_RE = /^[A-Za-z0-9]{12}$/;

/** Qayerda: menyu, dunyo (sarguzasht/kunlik), olam; off — ilova yopildi */
export const PLACES = ["menu", "world", "realm", "off"] as const;
export type Place = (typeof PLACES)[number];

/** Do'stlar o'rtasidagi tayyor iboralar (erkin matn hali yo'q) */
export const FRIEND_PHRASES = [
  "Salom!",
  "Olamga kel!",
  "Yordam kerak!",
  "Rahmat!",
  "Zo'r o'yin!",
  "Kul qirolini birga yengamizmi?",
  "Hozir bandman, keyinroq",
  "Xayr!",
] as const;

/** Do'stlar soni va kutilayotgan so'rovlar chegarasi */
export const MAX_FRIENDS = 100;
export const MAX_OUTGOING = 30;
/** Shuncha vaqt ichida yangilangan holat — onlayn */
export const ONLINE_MS = 5 * 60_000;

export const REQ = {
  /** Telegram Mini App: Telegram.WebApp.initData */
  "auth/webapp": z.object({ initData: z.string().min(1).max(4096), device }),
  /** Saytdagi Telegram Login Widget javobi */
  "auth/widget": z.object({
    user: z.record(z.string().max(32), z.union([z.string().max(512), z.number()])),
    device,
  }),
  /** Ilova va kompyuter: bot orqali kirishni boshlash */
  "auth/bot": z.object({ device }),
  /** Bot tasdiqlaganini so'rash (secret faqat boshlagan qurilmada) */
  "auth/poll": z.object({
    code: z.string().regex(LOGIN_CODE_RE),
    secret: z.string().regex(/^[A-Za-z0-9_-]{22,64}$/),
  }),
  "auth/logout": z.object({ token }),
  me: z.object({ token }),
  /** have — klientdagi versiya: o'zgarmagan bo'lsa ma'lumot yuborilmaydi */
  "save/get": z.object({ token, have: z.number().int().min(0).optional() }),
  /**
   * base — klient progressi shu versiyadan davom etadi; time — oxirgi o'zgarish vaqti.
   * force — mehmon progressini akkauntga yozish (tanlov oynasidan): ziddiyat tekshirilmaydi.
   */
  "save/put": z.object({
    token,
    base: z.number().int().min(0),
    time: z.number().int().min(0),
    device,
    /** qurilma raqami (zaxira: "boshqa qurilmadan" belgisi) */
    dev: z
      .string()
      .regex(/^[a-z0-9]{8,24}$/)
      .optional(),
    data: keys,
    force: z.boolean().optional(),
  }),
  /** Zaxira nusxalar ro'yxati va tiklash */
  "save/backups": z.object({ token }),
  "save/restore": z.object({ token, slot: z.number().int().min(0).max(9) }),
  /** Taxallus va avatar */
  profile: z.object({
    token,
    nick: z.string().max(64).optional(),
    avatar: hero.optional(),
  }),
  "account/delete": z.object({ token, confirm: z.literal(true) }),
  /** Do'stlar ro'yxati, so'rovlar va bloklanganlar */
  "friends/list": z.object({ token }),
  /** So'rov: taxallus yoki do'st kodi bo'yicha */
  "friends/add": z.object({ token, query: z.string().min(1).max(32) }),
  "friends/answer": z.object({ token, id: z.number().int().positive(), accept: z.boolean() }),
  "friends/remove": z.object({ token, id: z.number().int().positive() }),
  "friends/block": z.object({ token, id: z.number().int().positive() }),
  "friends/unblock": z.object({ token, id: z.number().int().positive() }),
  /** Tayyor ibora (FRIEND_PHRASES raqami) */
  "friends/msg": z.object({
    token,
    to: z.number().int().positive(),
    phrase: z
      .number()
      .int()
      .min(0)
      .max(FRIEND_PHRASES.length - 1),
  }),
  /** Onlayn holat (har daqiqada va o'zgarganda): javobda yangi xabarlar va so'rovlar soni */
  presence: z.object({
    token,
    place: z.enum(PLACES),
    room: z
      .string()
      .regex(/^[A-HJ-NP-Z2-9]{6}$/)
      .optional(),
  }),
} as const;

export type Op = keyof typeof REQ;
export type ReqOf<O extends Op> = z.infer<(typeof REQ)[O]>;

/** Klient bilan server o'rtasidagi API'ga kiradigan ops (yo'l nomi tekshiruvi) */
export function isOp(s: string): s is Op {
  return Object.prototype.hasOwnProperty.call(REQ, s);
}

// ---------------- javoblar ----------------

export interface BackupInfo {
  slot: number;
  version: number;
  time: number;
  at: number;
  device: Device;
  /** nega zaxiralangan: boshqa qurilma, ziddiyat, vaqt, tiklash, tanlov */
  reason: string;
  data: Record<string, string>;
}

/** Do'stlar ro'yxatidagi o'yinchi */
export interface FriendInfo {
  id: number;
  nick: string;
  avatar: Hero;
  level: number;
  /** onlayn: oxirgi 5 daqiqada holat yuborgan */
  online: boolean;
  /** qayerda (onlayn bo'lsa) */
  place: Place | null;
  /** olam xonasi kodi ("Yoniga kirish") — faqat do'stlarga */
  room: string | null;
  /** oxirgi marta ko'rilgan (ms, 0 — noma'lum) */
  seen: number;
}

export interface FriendLists {
  friends: FriendInfo[];
  /** menga kelgan so'rovlar */
  incoming: FriendInfo[];
  /** men yuborgan, javob kutilayotgan */
  outgoing: FriendInfo[];
  blocked: FriendInfo[];
}

export interface FriendMessage {
  id: number;
  from: number;
  nick: string;
  phrase: number;
  at: number;
}

export type Reply<O extends Op> = O extends "auth/webapp" | "auth/widget"
  ? { ok: true; token: string; me: Me } | Fail
  : O extends "auth/bot"
    ? { ok: true; code: string; secret: string; link: string; expires: number } | Fail
    : O extends "auth/poll"
      ? { ok: true; status: "wait" } | { ok: true; status: "done"; token: string; me: Me } | Fail
      : O extends "me" | "profile"
        ? { ok: true; me: Me } | Fail
        : O extends "save/get"
          ? { ok: true; save: CloudSave | null; same?: boolean } | Fail
          : O extends "save/put"
            ? { ok: true; version: number } | Fail
            : O extends "save/backups"
              ? { ok: true; backups: BackupInfo[] } | Fail
              : O extends "save/restore"
                ? { ok: true; save: CloudSave } | Fail
                : O extends "friends/list"
                  ? ({ ok: true } & FriendLists) | Fail
                  : O extends "friends/add"
                    ? { ok: true; friend: FriendInfo; accepted: boolean } | Fail
                    : O extends "presence"
                      ? { ok: true; messages: FriendMessage[]; requests: number } | Fail
                      : { ok: true } | Fail;

/** /acc/config (GET) — saytdagi Login Widget va bot havolasi uchun */
export interface AccConfig {
  ok: boolean;
  /** bot username (@siz); bot sozlanmagan bo'lsa null */
  bot: string | null;
  /** bot raqami (Login Widget popup uchun) */
  botId: number | null;
}

// ---------------- umumiy yordamchilar ----------------

/** Do'st kodi alifbosi: chalkash belgilarsiz (0/O, 1/I yo'q) */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** "K7QW2MXA" -> "K7QW-2MXA" */
export const formatFriendCode = (c: string) =>
  c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;

/** Foydalanuvchi yozgan do'st kodi: kichik harf, bo'shliq va chiziqcha kechiriladi; yaroqsiz — null */
export function normalizeFriendCode(s: string | null | undefined): string | null {
  const c = (s ?? "").toUpperCase().replace(/[\s-]/g, "");
  return /^[A-HJ-NP-Z2-9]{8}$/.test(c) ? c : null;
}
