/**
 * Akkaunt API (klient <-> server) — so'rov sxemalari va javob turlari. Klient ham, server ham
 * shu faylni ishlatadi. Hamma so'rov: POST /acc/<op>, tanasi JSON (Content-Type: text/plain —
 * CORS preflight kerak emas), kirgan o'yinchida tanada `token`.
 *
 * Batafsil: docs/accounts.md
 */
import { z } from "zod";
import type { Hero } from "@/game/hero";
import {
  GUILD_LANGS,
  JOIN_MODES,
  type GuildLang,
  type GuildRole,
  type JoinMode,
} from "./guildRules";

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
  | "limit"
  /** gildiya: oltin yetmaydi */
  | "gold"
  /** gildiya: chiqqanidan beri 24 soat o'tmadi (until — qachon mumkin) */
  | "cooldown"
  /** gildiya to'la */
  | "full"
  /** gildiya: bu amalga huquq yo'q (rol) */
  | "perm"
  /** allaqachon gildiyada (yoki gildiyada emas) */
  | "guild"
  /** gildiya nomi yoki tegi qoidaga mos emas (field: name | tag, why — sabab) */
  | "name"
  /** gildiyaga faqat taklif bilan kiriladi */
  | "invite"
  /** gildiya chatida jim qilingan (until — qachongacha) */
  | "muted";

export type Fail = {
  ok: false;
  error: ErrCode;
  field?: string;
  save?: CloudSave;
  /** gildiya nomi/tegi xatosi sababi (guildRules: GuildNameError) */
  why?: string;
  /** cooldown / muted: shu vaqtgacha (ms) */
  until?: number;
};

// ---------------- so'rov sxemalari ----------------

const token = z.string().regex(/^[A-Za-z0-9_-]{32,64}$/);
const device = z.enum(DEVICES);
const hero = z.enum(HERO_IDS);
const keys = z.record(z.string().max(80), z.string().max(MAX_SAVE));

export const LOGIN_CODE_RE = /^[A-Za-z0-9]{12}$/;

/** Gerb yozuvi: "shakl-fon-belgi rangi-belgi" (guildRules.ts parseEmblem) */
const emblem = z.string().regex(/^\d{1,2}-\d{1,2}-\d{1,2}-\d{1,2}$/);
/** Takroriy so'rov raqami (klient yasaydi) */
const rid = z.string().regex(/^[A-Za-z0-9_-]{8,32}$/);

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
  /** O'yin natijasi (faqat kirgan o'yinchi): server tekshiradi va reytingga yozadi */
  "scores/submit": z.object({
    token,
    mode: z.enum(["world", "endless", "daily"]),
    hero,
    score: z.number().int().min(0).max(100_000_000),
    wave: z.number().int().min(0).max(100_000),
    time: z.number().min(0).max(1_000_000),
    won: z.boolean(),
    /** kunlik sinov sanasi (YYYY-MM-DD) */
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
  /** Top-50 va o'z o'rni (token bo'lsa) */
  "scores/top": z.object({
    token: token.optional(),
    board: z.string().max(24),
    period: z.enum(["week", "all"]),
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
  // ---------------- gildiyalar (docs/guilds.md) ----------------
  /** Mening gildiyam (yoki takliflar, arizalar va 24 soat cheklovi) */
  "guild/get": z.object({ token }),
  /**
   * Gildiya tuzish (500 oltin). gold — qurilmadagi oltin (server bulutdagisi bilan solishtiradi),
   * rid — takroriy so'rovni bir marta hisoblash uchun (oltin faqat muvaffaqiyatdan keyin yechiladi).
   */
  "guild/create": z.object({
    token,
    name: z.string().max(64),
    tag: z.string().max(16),
    emblem: emblem,
    mode: z.enum(JOIN_MODES),
    lang: z.enum(GUILD_LANGS),
    gold: z.number().int().min(0).max(10_000_000),
    rid,
  }),
  /** Qidirish ro'yxati: nomi yoki tegi bo'yicha (bo'sh — eng faollari) */
  "guild/search": z.object({
    token: token.optional(),
    query: z.string().max(32),
    lang: z.enum(GUILD_LANGS).optional(),
  }),
  /** Gildiya haqida (a'zolar ro'yxati bilan) — qo'shilishdan oldin ko'rish */
  "guild/info": z.object({ token: token.optional(), id: z.number().int().positive() }),
  /** Qo'shilish: ochiq — darhol, ariza bilan — ariza, faqat taklif — taklif bo'lsa */
  "guild/join": z.object({ token, id: z.number().int().positive() }),
  /** O'z arizasini bekor qilish */
  "guild/cancel": z.object({ token, id: z.number().int().positive() }),
  /** Rahbar/o'rinbosar: arizani qabul qilish yoki rad etish (rad — yuborilgan taklifni ham bekor qiladi) */
  "guild/answer": z.object({ token, player: z.number().int().positive(), accept: z.boolean() }),
  /** Rahbar/o'rinbosar: o'yinchini taxallus yoki do'st kodi bo'yicha taklif qilish */
  "guild/invite": z.object({ token, query: z.string().min(1).max(32) }),
  /** Kelgan taklifga javob */
  "guild/reply": z.object({ token, id: z.number().int().positive(), accept: z.boolean() }),
  "guild/leave": z.object({ token }),
  "guild/kick": z.object({ token, player: z.number().int().positive() }),
  /** Rol berish: o'rinbosar yoki a'zo */
  "guild/role": z.object({
    token,
    player: z.number().int().positive(),
    role: z.enum(["officer", "member"]),
  }),
  /** Rahbarlikni topshirish */
  "guild/transfer": z.object({ token, player: z.number().int().positive() }),
  /** Gildiyani tarqatish (faqat rahbar) */
  "guild/disband": z.object({ token, confirm: z.literal(true) }),
  /** Rahbar: qo'shilish usuli, til va gerb */
  "guild/settings": z.object({
    token,
    mode: z.enum(JOIN_MODES).optional(),
    lang: z.enum(GUILD_LANGS).optional(),
    emblem: emblem.optional(),
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
  /** gildiya tegi va gerbi (gildiyada bo'lsa) */
  guild?: GuildTag;
}

export interface FriendLists {
  friends: FriendInfo[];
  /** menga kelgan so'rovlar */
  incoming: FriendInfo[];
  /** men yuborgan, javob kutilayotgan */
  outgoing: FriendInfo[];
  blocked: FriendInfo[];
}

/** Reyting qatori */
export interface ScoreRow {
  rank: number;
  id: number;
  nick: string;
  avatar: Hero;
  level: number;
  /** ochko yoki (Kul qiroli) vaqt — soniyaning o'ndan biri */
  score: number;
  /** qaysi qahramon bilan (cheksiz, kunlik) */
  hero?: Hero;
  wave?: number;
  /** Kul qiroli: jamoadagi kirgan o'yinchilar taxallusi */
  team?: string[];
  /** gildiya tegi va gerbi (ism yonida) */
  guild?: GuildTag;
}

export interface ScoreTop {
  rows: ScoreRow[];
  /** o'z natijasi; hidden — shubhali, tekshiruvda (o'rni yo'q) */
  me: (ScoreRow & { hidden: boolean }) | null;
  /** haftalik davr (dushanba, Toshkent) va keyingi yangilanish (ms) */
  week: string;
  resets: number;
}

export interface FriendMessage {
  id: number;
  from: number;
  nick: string;
  phrase: number;
  at: number;
}

// ---------------- gildiyalar ----------------

/** Gildiya belgisi: teg va gerb (onlayn ism yonida, profilda, reytingda) */
export interface GuildTag {
  tag: string;
  /** "shakl-fon-belgi rangi-belgi" (guildRules.ts) */
  emblem: string;
}

/** Qidirish ro'yxati va takliflardagi gildiya */
export interface GuildCard extends GuildTag {
  id: number;
  name: string;
  level: number;
  members: number;
  /** a'zolar sig'imi (darajaga qarab 20–30) */
  cap: number;
  mode: JoinMode;
  lang: GuildLang;
  /** so'nggi 3 kunda o'ynagan a'zolar (faollik) */
  active: number;
  /** hozir onlayn a'zolar */
  online: number;
}

export interface GuildInfo extends GuildCard {
  /** gildiya XP (daraja shundan) */
  xp: number;
  /** xazina (oltin) */
  treasury: number;
  created: number;
  /** rahbar taxallusi */
  leader: string;
}

export interface GuildMember {
  id: number;
  nick: string;
  avatar: Hero;
  /** o'yinchi darajasi */
  level: number;
  role: GuildRole;
  joined: number;
  online: boolean;
  /** oxirgi marta ko'rilgan (ms) */
  seen: number;
  /** xazinaga jami hissa (oltin) */
  given: number;
  /** chatda jim (shu vaqtgacha, ms; 0 — yo'q) */
  muted: number;
}

/** Ariza (o'yinchi so'radi) yoki yuborilgan taklif — rahbar va o'rinbosarga ko'rinadi */
export interface GuildRequestInfo {
  id: number;
  nick: string;
  avatar: Hero;
  level: number;
  kind: "apply" | "invite";
  at: number;
  /** taklifni kim yubordi */
  by?: string;
}

/** Gildiyadagi o'yinchi: gildiya, roli, a'zolar va arizalar */
export interface GuildMine {
  guild: GuildInfo;
  role: GuildRole;
  members: GuildMember[];
  requests: GuildRequestInfo[];
}

/** Gildiyasiz o'yinchi: kelgan takliflar, yuborgan arizalari va 24 soat cheklovi */
export interface GuildNone {
  guild: null;
  /** qo'shilish mumkin bo'ladigan vaqt (ms; 0 — hozir) */
  cooldown: number;
  invites: { guild: GuildCard; by: string; at: number }[];
  applications: { guild: GuildCard; at: number }[];
}

export type GuildState = GuildMine | GuildNone;

/**
 * Onlayn holat javobidagi gildiya qisqachasi (daqiqada bir): menyu belgisi va daraja foydalari
 * (+XP %, kunlik sovg'a) uchun qurilmada saqlanadi.
 */
export interface GuildPing {
  guild: (GuildTag & { id: number; name: string; level: number; role: GuildRole }) | null;
  /** rahbar/o'rinbosarga — arizalar, gildiyasizga — kelgan takliflar */
  pending: number;
}

type GuildReply<O extends Op> = O extends "guild/get"
  ? ({ ok: true } & GuildState) | Fail
  : O extends "guild/create"
    ? { ok: true; guild: GuildInfo; cost: number; dup?: boolean } | Fail
    : O extends "guild/search"
      ? { ok: true; guilds: GuildCard[] } | Fail
      : O extends "guild/info"
        ? { ok: true; guild: GuildInfo; members: GuildMember[] } | Fail
        : O extends "guild/join"
          ? { ok: true; joined: boolean; applied: boolean } | Fail
          : O extends "guild/invite"
            ? { ok: true; joined: boolean; nick: string } | Fail
            : O extends "guild/reply"
              ? { ok: true; joined: boolean } | Fail
              : { ok: true } | Fail;

export type Reply<O extends Op> = O extends `guild/${string}`
  ? GuildReply<O>
  : O extends "auth/webapp" | "auth/widget"
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
                        ? | {
                              ok: true;
                              messages: FriendMessage[];
                              requests: number;
                              guild?: GuildPing;
                            }
                          | Fail
                        : O extends "scores/top"
                          ? ({ ok: true } & ScoreTop) | Fail
                          : O extends "scores/submit"
                            ? | { ok: true; hidden: boolean; best: number; rank: number | null }
                              | Fail
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
