/**
 * Abadiyat olami tarmoq protokoli: klient <-> server xabarlari (JSON matn) va ularning zod sxemalari.
 * Klient ham, server ham shu faylni ishlatadi — format bitta joyda.
 *
 * Klient faqat buyruq yuboradi (move, attack, ability, interact...), server RealmSim'ni tick qilib
 * holatni 10 Hz delta (faqat o'zgargan narsa) bilan qaytaradi. Tezlik, zarar va lut — serverda.
 */
import { z } from "zod";
import type { Hero } from "@/game/hero";
import type { AnimState } from "@/game/animation";
import type { RealmCommand, RealmEvent, RealmUi, QuestProgress, Stack } from "../sim";
import type { MobKind } from "../schema";
import type { MobState } from "../mobs";

/** Protokol versiyasi: klient va server mos kelmasa — ulanish rad etiladi */
export const NET_VERSION = 1;
/** Xona sig'imi: to'lsa — avtomatik keyingi xona */
export const ROOM_CAP = 8;
/** Klient buyruqlarni ko'pi bilan shu chastotada yuboradi (va faqat o'zgarganda) */
export const SEND_HZ = 10;
/** Server holatni har shuncha tickda yuboradi (20 Hz / 2 = 10 Hz) */
export const SNAPSHOT_EVERY = 2;
/** Bitta xabarning eng katta hajmi (salomlashuvdagi saqlanish ham sig'adi) */
export const MAX_MSG = 16_384;
/** Ping (va DO uyg'oqligi) — shuncha soniyada bir */
export const PING_EVERY = 4;
/** Holatlar yuboriladigan masofa (px): uzoqdagi moblar va lut yuborilmaydi */
export const AOI = 400;

/** Xona kodi: 6 belgi, chalkash belgilarsiz (0/O, 1/I yo'q) */
export const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

export function makeRoomCode(rand: () => number = Math.random) {
  let s = "";
  for (let i = 0; i < 6; i++) s += ROOM_ALPHABET[Math.floor(rand() * ROOM_ALPHABET.length)];
  return s;
}

/** Foydalanuvchi yozgan kod: kichik harf, bo'shliq va chiziqcha kechiriladi. Yaroqsiz — null. */
export function normalizeRoomCode(s: string | null | undefined): string | null {
  const c = (s ?? "").toUpperCase().replace(/[\s-]/g, "");
  return ROOM_CODE_RE.test(c) ? c : null;
}

/** Tayyor iboralar (erkin matn yo'q — moderatsiyasiz xavfsiz) */
export const PHRASES = ["Salom!", "Bu yoqqa!", "Yordam bering!", "Rahmat!"] as const;

/** Mehmon ismi (akkaunt keyingi versiyada) */
export const guestName = (tag: string) => `Mehmon-${tag}`;

// ---------------- klient -> server ----------------

const HERO_IDS = ["knight", "mage", "hunter", "gunner"] as const satisfies readonly Hero[];
const num = z.number().finite();
const axis = num.min(-1).max(1);
const id = z
  .string()
  .max(32)
  .regex(/^[a-z0-9_]+$/);
const slot = z.number().int().min(0).max(7);

export const CommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("move"), x: axis, y: axis }),
  z.object({ type: z.literal("attack"), down: z.boolean() }),
  z.object({ type: z.literal("ability"), down: z.boolean() }),
  z.object({ type: z.literal("reload") }),
  z.object({ type: z.literal("aim"), x: num.min(-4096).max(4096), y: num.min(-4096).max(4096) }),
  z.object({ type: z.literal("interact") }),
  z.object({ type: z.literal("choose"), index: z.number().int().min(0).max(15) }),
  z.object({ type: z.literal("close") }),
  z.object({ type: z.literal("use"), slot }),
  z.object({ type: z.literal("buy"), item: id }),
  z.object({ type: z.literal("sell"), slot }),
]) satisfies z.ZodType<RealmCommand>;

const list = z.array(id).max(64);

/** O'yinchining o'z progressi (RealmPlayerSave): server tekshiradi va cheklaydi. */
export const SaveSchema = z.object({
  hero: z.enum(HERO_IDS),
  x: num.min(-1e5).max(1e5),
  y: num.min(-1e5).max(1e5),
  hp: num.min(0).max(99),
  gold: z.number().int().min(0).max(10_000_000),
  inv: z.array(z.object({ item: id, n: z.number().int().min(1).max(999) }).nullable()).max(8),
  quests: z
    .record(
      id,
      z.object({
        status: z.enum(["active", "ready", "done"]),
        step: z.number().int().min(0).max(64),
        progress: z.number().int().min(0).max(9999),
      }),
    )
    .refine((q) => Object.keys(q).length <= 64),
  secrets: list,
  fragments: list,
  opened: list,
  torchStep: z.number().int().min(0).max(32),
  landmarks: list,
  kills: z.number().int().min(0).max(10_000_000),
  explored: z.string().max(12_000),
  starNight: z.number().int().min(-1).max(10_000_000),
});

export const HelloSchema = z.object({
  t: z.literal("hello"),
  v: z.number().int(),
  /** Mehmon raqami (4 xona): ism serverda yasaladi */
  tag: z.string().regex(/^\d{4}$/),
  hero: z.enum(HERO_IDS),
  save: SaveSchema.nullable(),
  /** asosiy o'yinda olingan darvoza kalitlari */
  keys: z.array(z.enum(["devil", "queen", "king"])).max(3),
  /** do'st chaqiruvi (kod/havola): xonadagi o'yinchi yoniga tushadi */
  near: z.boolean().optional(),
});

export const ClientMsgSchema = z.discriminatedUnion("t", [
  HelloSchema,
  /** s — klient tick raqami (shu tickda buyruqlar klientda ham qo'llangan) */
  z.object({
    t: z.literal("cmd"),
    s: z.number().int().min(0),
    c: z.array(CommandSchema).min(1).max(16),
  }),
  z.object({ t: z.literal("ping"), id: z.number().int().min(0) }),
  z.object({
    t: z.literal("chat"),
    p: z
      .number()
      .int()
      .min(0)
      .max(PHRASES.length - 1),
  }),
]);

export type HelloMsg = z.infer<typeof HelloSchema>;
export type ClientMsg = z.infer<typeof ClientMsgSchema>;

/** Xom matnni tekshiradi: yaroqsiz bo'lsa null (server uni rad etadi). */
export function parseClientMsg(raw: unknown): ClientMsg | null {
  if (typeof raw !== "string" || raw.length > MAX_MSG) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  const r = ClientMsgSchema.safeParse(v);
  return r.success ? r.data : null;
}

// ---------------- server -> klient ----------------

export const ANIMS: readonly AnimState[] = ["idle", "walk", "attack", "hurt", "death"];
export const MOB_STATES: readonly MobState[] = [
  "idle",
  "wander",
  "chase",
  "windup",
  "attack",
  "recover",
  "flee",
  "return",
  "dormant",
  "wake",
  "cast",
  "fade",
];

/** O'yinchi bayroqlari */
export const PF_DASH = 1,
  PF_GUARD = 2,
  PF_HIDDEN = 4;

/** [id, qahramon, ism, x, y, jon, max jon, fx, fy, anim, kadr (-1 — klient o'zi aylantiradi), bayroqlar, flash] */
export type NetPlayer = [
  string,
  Hero,
  string,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
/** [id, tur, x, y, jon, max, holat, anim, kadr, yuz, dirX, dirY, flash, stun, paydo, nishon, faza] */
export type NetMob = [
  number,
  MobKind,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  string | null,
  number,
];
/** [id, x, y, buyum (null — oltin), soni, oltin, miltillaydi] */
export type NetItem = [number, number, number, string | null, number, number, number];
/** [x, y, vx, vy, o'lcham, tur: 0 shar, 1 o'q-yoy, 2 o'q] */
export type NetBolt = [number, number, number, number, number, number];
/** [tur: 0 doira, 1 chiziq, x, y, r, dx, dy, len, t, total, egasi, zarar] */
export type NetMark = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/** Faqat shu o'yinchiniki: inventar, topshiriqlar, sirlar (boshqalarga yuborilmaydi) */
export interface NetMe {
  gold: number;
  inv: (Stack | null)[];
  quests: Record<string, QuestProgress>;
  secrets: string[];
  fragments: string[];
  opened: string[];
  torchStep: number;
  landmarks: string[];
  kills: number;
  ui: RealmUi | null;
  starNight: number;
}

/** Delta holat: maydon bo'lmasa — o'zgarmagan */
export interface SnapshotMsg {
  t: "s";
  tick: number;
  /** oxirgi qo'llangan buyruq to'plami (klient tick raqami) va undan beri o'tgan server tick'lari */
  ack: number;
  at: number;
  /** xonadagi o'yinchilar soni */
  n: number;
  p?: NetPlayer[];
  pr?: string[];
  m?: NetMob[];
  mr?: number[];
  i?: NetItem[];
  ir?: number[];
  b?: NetBolt[];
  k?: NetMark[];
  tr?: [number, number][];
  sm?: [number, number, number][];
  ov?: [number, number][];
  d?: string[];
  me?: NetMe;
  ev?: RealmEvent[];
}

export type ErrReason = "full" | "busy" | "version" | "bad" | "rate";

export type ServerMsg =
  | { t: "welcome"; pid: string; name: string; code: string; tick: number; n: number }
  | SnapshotMsg
  | { t: "pong"; id: number }
  | { t: "chat"; pid: string; name: string; p: number }
  | { t: "err"; reason: ErrReason }
  | { t: "rejoin" };

/** /join javobi */
export type JoinReply = { ok: true; code: string } | { ok: false; reason: ErrReason };

/** Klientga ko'rsatiladigan xabar */
export const ERR_TEXT: Record<ErrReason, string> = {
  full: "Xona to'la",
  busy: "Server band, keyinroq urinib ko'ring",
  version: "Yangi versiyani yuklang — server yangilangan",
  bad: "Ulanish xatosi",
  rate: "Juda ko'p buyruq — ulanish uzildi",
};
