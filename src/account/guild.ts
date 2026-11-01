/**
 * Gildiyalar (klient): mening gildiyam, qidirish, tuzish (500 oltin), qo'shilish, arizalar va
 * takliflar, rollar, sozlamalar. React'dan tashqarida — oyna useGuild() bilan kuzatadi.
 *
 * Oltin klientda: tuzishda server bulutdagi oltin bilan solishtiradi, oltin esa faqat server
 * "ok" degandan keyin yechiladi. Internet uzilsa — so'rov (rid bilan) saqlanadi va keyingi
 * yangilanishda aynan shu rid bilan qayta yuboriladi: server uni bir marta hisoblaydi.
 *
 * Gildiya qisqachasi (teg, gerb, daraja, rol) qurilmada saqlanadi — menyu belgisi va daraja
 * foydalari (+XP %, kunlik sovg'a) internet bo'lmasa ham ishlaydi. Xazinaga hissa ham tuzish kabi
 * (rid bilan). Topshiriq sovg'alari: olingan oxirgi sovg'a raqami progressda (GUILD_PROGRESS_KEY,
 * bulutga ham ketadi) — bir sovg'a ikki marta olinmaydi. Chat — oyna ochiq turganda 5 s da bir.
 * Batafsil: docs/guilds.md
 */
import { useSyncExternalStore } from "react";
import { addGold, loadGold, saveGold } from "@/game/shop";
import { setGiftBonus } from "@/game/gift";
import { account, type AccountManager } from "./account";
import { ERROR_TEXT, call, type ApiResult } from "./api";
import { friends, type FriendsManager } from "./friends";
import {
  GIVE_MIN,
  GUILD_COST,
  GUILD_NAME_ERROR,
  GUILD_TAG_ERROR,
  MAX_APPLICATIONS,
  MAX_OFFICERS,
  guildGiftBonus,
  guildXpBonus,
  type GuildLang,
  type GuildNameError,
  type JoinMode,
} from "./guildRules";
import { GUILD_CACHE_KEY, GUILD_READ_KEY, GUILD_SPEND_KEY } from "./keys";
import type {
  ErrCode,
  GuildCard,
  GuildChatMsg,
  GuildInfo,
  GuildLogEntry,
  GuildMember,
  GuildPing,
  GuildReward,
  GuildState,
  Op,
} from "./protocol";
import { setXpBonus } from "./xp";

/** Olingan topshiriq sovg'alari (progress — bulutga ham ketadi): { r: oxirgi olingan raqam } */
export const GUILD_PROGRESS_KEY = "pixel-rpg-guild";
/** Chat oyna ochiq turganda shuncha vaqtda bir yangilanadi */
export const CHAT_POLL_MS = 5000;

/** Javobi kelmagan oltinli so'rov shuncha vaqt ichida qayta yuboriladi */
const SPEND_RETRY_MS = 10 * 60_000;

export type GuildBrief = NonNullable<GuildPing["guild"]>;

export interface GuildView {
  /** oxirgi guild/get (oyna ochilganda va amallardan keyin) */
  state: GuildState | null;
  loading: boolean;
  error: string | null;
  /** qisqacha: gildiya (yoki null) va kutilayotgan arizalar/takliflar soni */
  brief: GuildBrief | null;
  pending: number;
  /** olinmagan topshiriq sovg'asi bor (serverdagi oxirgi raqam olinganidan katta) */
  reward: boolean;
  /** chat: xabarlar (eskisi birinchi), versiya, o'qilmagan bormi, jim qilinganmi */
  chat: GuildChatMsg[];
  chatRev: number;
  unread: boolean;
  muted: number;
}

export interface GuildResult {
  ok: boolean;
  text: string;
}

export interface CreateGuildInput {
  name: string;
  tag: string;
  emblem: string;
  mode: JoinMode;
  lang: GuildLang;
}

interface PendingSpend {
  rid: string;
  op: "create" | "give";
  amount: number;
  at: number;
  /** tuzish: nom, teg, gerb... */
  input?: CreateGuildInput;
}

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}

function write(key: string, v: unknown) {
  try {
    if (v === null || v === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* saqlash imkonsiz */
  }
}

/** Qurilmadagi gildiya qisqachasi (internetsiz ham daraja foydalari ishlasin) */
export function cachedGuild(): GuildBrief | null {
  const c = read<GuildBrief>(GUILD_CACHE_KEY);
  return c && typeof c.id === "number" && typeof c.tag === "string" ? c : null;
}

/** Takroriy so'rov raqami */
export function newRid() {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => a[b % a.length]).join("");
}

/** Oltinni yechish (muvaffaqiyatli gildiya so'rovidan keyin) */
function spendGold(n: number) {
  saveGold(Math.max(0, loadGold() - Math.max(0, Math.floor(n))));
}

/** "13 soat 20 daqiqa" */
export function leftText(ms: number) {
  const m = Math.max(1, Math.ceil(ms / 60_000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} soat ${m % 60} daqiqa` : `${m} daqiqa`;
}

type Fail = Extract<ApiResult<Op>, { ok: false }> & {
  field?: string;
  why?: string;
  until?: number;
};

/** Gildiya xatolari matni (amalga qarab) */
export function guildErrorText(r: Fail, ctx: "create" | "join" | "invite" | "manage" = "manage") {
  switch (r.error) {
    case "gold":
      return `Oltin yetmaydi — gildiya tuzish ${GUILD_COST} oltin`;
    case "cooldown":
      return `Gildiyadan chiqqaningizga 24 soat to'lmadi — yana ${leftText((r.until ?? Date.now()) - Date.now())}`;
    case "name":
      return r.field === "tag"
        ? (GUILD_TAG_ERROR[r.why as GuildNameError] ?? ERROR_TEXT.name)
        : (GUILD_NAME_ERROR[r.why as GuildNameError] ?? ERROR_TEXT.name);
    case "taken":
      return r.field === "tag"
        ? "Bu teg band — boshqasini tanlang"
        : "Bu nomli gildiya bor — boshqa nom tanlang";
    case "invalid":
      return "Oltin hisobi bulutdagidan farq qiladi — Profil → BULUT → HOZIR SAQLASH, so'ng qayta urinib ko'ring";
    case "guild":
      return ctx === "invite"
        ? "Bu o'yinchi boshqa gildiyada"
        : ctx === "manage"
          ? "Bu o'yinchi gildiyada emas"
          : "Siz allaqachon gildiyadasiz";
    case "limit":
      return ctx === "join"
        ? `Ko'pi bilan ${MAX_APPLICATIONS} ta ariza yoki gildiyada arizalar juda ko'p`
        : ctx === "invite"
          ? "Takliflar juda ko'p — avvalgilarini kuting"
          : `O'rinbosarlar ${MAX_OFFICERS} tadan oshmaydi`;
    case "none":
      return ctx === "invite" ? "Bunday o'yinchi topilmadi" : "Topilmadi";
    case "perm":
      return "Bu amal uchun huquqingiz yo'q";
    case "bad":
      return r.field === "emblem" ? "Bu gerb hali ochilmagan (gildiya darajasi)" : ERROR_TEXT.bad;
    default:
      return ERROR_TEXT[r.error];
  }
}

const EMPTY: GuildView = {
  state: null,
  loading: false,
  error: null,
  brief: null,
  pending: 0,
  reward: false,
  chat: [],
  chatRev: 0,
  unread: false,
  muted: 0,
};

/** Olingan oxirgi topshiriq sovg'asi raqami (progress) */
function claimedReward() {
  const v = read<{ r?: unknown }>(GUILD_PROGRESS_KEY);
  const n = Math.floor(Number(v?.r));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function readChat() {
  const n = Math.floor(Number(read<number>(GUILD_READ_KEY)));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export class GuildManager {
  view: GuildView = { ...EMPTY, brief: cachedGuild() };
  private subs = new Set<() => void>();

  constructor(
    private acc: AccountManager = account,
    fr: FriendsManager = friends,
  ) {
    acc.onLogin(() => {
      void this.refresh();
    });
    acc.onSessionEnd(() => {
      write(GUILD_CACHE_KEY, null);
      write(GUILD_SPEND_KEY, null);
      this.closeChat();
      this.set({ ...EMPTY });
    });
    fr.onPresence((r) => {
      if (r.guild) this.gotPing(r.guild);
    });
    // daraja foydalari: o'yinchi XP'siga va kunlik sovg'aga qo'shimcha
    setXpBonus(() => guildXpBonus(this.level));
    setGiftBonus(() => guildGiftBonus(this.level));
  }

  /** Topshiriq sovg'asi olindi (menyu: oltin yangilanadi, xabar) */
  onReward: (gold: number, rewards: GuildReward[]) => void = () => {};
  private chatTimer: ReturnType<typeof setInterval> | null = null;
  private chatBusy = false;

  subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  };

  getView = () => this.view;

  private set(patch: Partial<GuildView>) {
    this.view = { ...this.view, ...patch };
    for (const f of this.subs) f();
  }

  /** Mening gildiyam (qurilmadagi qisqacha) */
  get brief() {
    return this.acc.loggedIn ? this.view.brief : null;
  }

  /** Gildiya darajasi (gildiyasiz — 0) — daraja foydalari uchun */
  get level() {
    return this.brief?.level ?? 0;
  }

  private setBrief(brief: GuildBrief | null, pending = this.view.pending) {
    write(GUILD_CACHE_KEY, brief);
    this.set({ brief, pending });
  }

  /** Onlayn holat javobi (daqiqada bir) */
  gotPing(p: GuildPing) {
    const old = this.view.brief;
    if (JSON.stringify(old) !== JSON.stringify(p.guild) || p.pending !== this.view.pending)
      this.setBrief(p.guild, p.pending);
    const reward = (p.reward ?? 0) > claimedReward();
    const unread = !!p.guild && (p.chat ?? 0) > readChat();
    if (reward !== this.view.reward || unread !== this.view.unread) this.set({ reward, unread });
    // gildiyaga qabul qilindi yoki chiqarildi — oyna ochiq bo'lsa ma'lumot yangilansin
    if ((old?.id ?? 0) !== (p.guild?.id ?? 0) && this.view.state) void this.refresh();
  }

  /** guild/get: gildiya, a'zolar, arizalar (yoki takliflar). Javobi kelmagan so'rov ham shu yerda. */
  async refresh() {
    const token = this.acc.sessionToken;
    if (!token) return;
    await this.retrySpend();
    this.set({ loading: true, error: null });
    const r = await call("guild/get", { token });
    if (!r.ok) {
      if (r.error === "auth") await this.acc.dropSession();
      return this.set({ loading: false, error: ERROR_TEXT[r.error] });
    }
    const { ok: _ok, ...state } = r;
    this.set({ loading: false, state });
    this.syncBrief(state);
    if (state.guild) {
      this.claim(state.rewards);
      this.set({ unread: state.chat > readChat(), muted: state.muted });
    } else this.set({ reward: false, unread: false });
  }

  /**
   * Topshiriq sovg'alari: olinmaganlari (raqami olingan oxirgisidan katta) oltinga qo'shiladi,
   * oxirgi raqam progressda saqlanadi — boshqa qurilmada ham qayta berilmaydi.
   */
  private claim(rewards: GuildReward[]) {
    const last = claimedReward();
    const fresh = rewards.filter((r) => r.id > last);
    if (!fresh.length) return this.set({ reward: false });
    const gold = fresh.reduce((n, r) => n + Math.max(0, r.gold), 0);
    write(GUILD_PROGRESS_KEY, { r: Math.max(...fresh.map((r) => r.id)) });
    addGold(gold);
    this.set({ reward: false });
    this.onReward(gold, fresh);
  }

  private syncBrief(state: GuildState) {
    if (!state.guild) {
      this.setBrief(null, state.invites.length);
      return;
    }
    const g = state.guild;
    this.setBrief(
      { id: g.id, name: g.name, tag: g.tag, emblem: g.emblem, level: g.level, role: state.role },
      state.role === "member" ? 0 : state.requests.filter((r) => r.kind === "apply").length,
    );
  }

  async search(query: string, lang?: GuildLang): Promise<GuildCard[] | null> {
    const token = this.acc.sessionToken;
    const r = await call("guild/search", {
      query: query.trim().slice(0, 32),
      ...(token ? { token } : {}),
      ...(lang ? { lang } : {}),
    });
    return r.ok ? r.guilds : null;
  }

  async info(id: number): Promise<{ guild: GuildInfo; members: GuildMember[] } | null> {
    const token = this.acc.sessionToken;
    const r = await call("guild/info", { id, ...(token ? { token } : {}) });
    return r.ok ? { guild: r.guild, members: r.members } : null;
  }

  /** Gildiya tuzish: 500 oltin faqat muvaffaqiyatdan keyin yechiladi */
  async create(input: CreateGuildInput): Promise<GuildResult> {
    const token = this.acc.sessionToken;
    if (!token) return { ok: false, text: ERROR_TEXT.auth };
    const gold = loadGold();
    if (gold < GUILD_COST) return { ok: false, text: `Oltin yetmaydi: ${GUILD_COST} kerak` };
    const pend: PendingSpend = {
      rid: newRid(),
      op: "create",
      amount: GUILD_COST,
      at: Date.now(),
      input,
    };
    write(GUILD_SPEND_KEY, pend);
    return this.sendCreate(token, pend, gold);
  }

  private async sendCreate(token: string, pend: PendingSpend, gold: number): Promise<GuildResult> {
    const input = pend.input;
    if (!input) return { ok: false, text: ERROR_TEXT.bad };
    const r = await call("guild/create", { token, ...input, gold, rid: pend.rid });
    if (!r.ok && (r.error === "net" || r.error === "rate" || r.error === "server"))
      return {
        ok: false,
        text: "Internet yo'q yoki server band — ulanganda so'rov o'zi qayta yuboriladi",
      };
    write(GUILD_SPEND_KEY, null);
    if (!r.ok) return { ok: false, text: guildErrorText(r, "create") };
    spendGold(r.cost);
    await this.refresh();
    return { ok: true, text: `Gildiya tuzildi: ${r.guild.name} [${r.guild.tag}]` };
  }

  /** Javobi kelmagan oltinli so'rov (o'sha rid bilan — server bir marta hisoblaydi) */
  private async retrySpend() {
    const pend = read<PendingSpend>(GUILD_SPEND_KEY);
    const token = this.acc.sessionToken;
    if (!pend || !token) return;
    if (Date.now() - pend.at > SPEND_RETRY_MS || (pend.op === "create" && !pend.input)) {
      write(GUILD_SPEND_KEY, null);
      return;
    }
    if (pend.op === "create") await this.sendCreate(token, pend, loadGold());
    else await this.sendGive(token, pend, loadGold());
  }

  /** Xazinaga hissa (kuniga chegarali): oltin faqat server "ok" degandan keyin yechiladi */
  async give(amount: number): Promise<GuildResult> {
    const token = this.acc.sessionToken;
    if (!token) return { ok: false, text: ERROR_TEXT.auth };
    const n = Math.floor(amount);
    if (!(n >= GIVE_MIN)) return { ok: false, text: `Kamida ${GIVE_MIN} oltin` };
    const gold = loadGold();
    if (gold < n) return { ok: false, text: `Oltin yetmaydi: sizda ${gold}` };
    if (read<PendingSpend>(GUILD_SPEND_KEY))
      return { ok: false, text: "Oldingi so'rov hali yetib bormadi — biroz kuting" };
    const pend: PendingSpend = { rid: newRid(), op: "give", amount: n, at: Date.now() };
    write(GUILD_SPEND_KEY, pend);
    return this.sendGive(token, pend, gold);
  }

  private async sendGive(token: string, pend: PendingSpend, gold: number): Promise<GuildResult> {
    const r = await call("guild/give", { token, amount: pend.amount, gold, rid: pend.rid });
    if (!r.ok && (r.error === "net" || r.error === "rate" || r.error === "server"))
      return {
        ok: false,
        text: "Internet yo'q yoki server band — ulanganda so'rov o'zi qayta yuboriladi",
      };
    write(GUILD_SPEND_KEY, null);
    if (!r.ok)
      return {
        ok: false,
        text:
          r.error === "limit"
            ? "Bugungi chegaraga yetdingiz — ertaga yana qo'sha olasiz"
            : r.error === "bad"
              ? `Kamida ${GIVE_MIN} oltin`
              : guildErrorText(r, "manage"),
      };
    spendGold(pend.amount);
    await this.refresh();
    return {
      ok: true,
      text: `Xazinaga ${pend.amount} oltin qo'shildi (+${pend.amount} gildiya XP). Bugun: ${r.given}/${r.cap}`,
    };
  }

  /** Gildiya jurnali */
  async log(): Promise<GuildLogEntry[] | null> {
    const token = this.acc.sessionToken;
    if (!token) return null;
    const r = await call("guild/log", { token });
    return r.ok ? r.entries : null;
  }

  // ---------------- chat ----------------

  /** Chat oynasi ochildi: darhol va 5 s da bir yangilanadi */
  openChat() {
    void this.pollChat();
    if (this.chatTimer) clearInterval(this.chatTimer);
    this.chatTimer = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible")
        void this.pollChat();
    }, CHAT_POLL_MS);
  }

  closeChat() {
    if (this.chatTimer) clearInterval(this.chatTimer);
    this.chatTimer = null;
  }

  async pollChat() {
    const token = this.acc.sessionToken;
    if (!token || this.chatBusy) return;
    this.chatBusy = true;
    const v = this.view;
    const since = v.chat.length ? v.chat[v.chat.length - 1]!.id : 0;
    const r = await call("guild/chat", { token, since, rev: v.chatRev });
    this.chatBusy = false;
    if (!r.ok) {
      if (r.error === "guild") this.closeChat();
      return;
    }
    const list = r.full ? r.messages : [...this.view.chat, ...r.messages].slice(-100);
    const top = list.length ? list[list.length - 1]!.id : 0;
    if (top > readChat()) write(GUILD_READ_KEY, top);
    this.set({ chat: list, chatRev: r.rev, unread: false, muted: r.muted });
  }

  /** Chatga yozish: erkin matn yoki tayyor ibora raqami */
  async say(msg: string | number): Promise<GuildResult> {
    const token = this.acc.sessionToken;
    if (!token) return { ok: false, text: ERROR_TEXT.auth };
    const body = typeof msg === "number" ? { token, phrase: msg } : { token, text: msg.trim() };
    if ("text" in body && !body.text) return { ok: false, text: "Xabar bo'sh" };
    const r = await call("guild/say", body);
    if (!r.ok)
      return {
        ok: false,
        text:
          r.error === "muted"
            ? `Siz chatda jim qilingansiz — yana ${leftText((r.until ?? Date.now()) - Date.now())}`
            : r.error === "limit"
              ? "Juda tez — biroz kuting"
              : r.error === "bad"
                ? "Xabar bo'sh yoki ruxsat etilmagan"
                : guildErrorText(r, "manage"),
      };
    await this.pollChat();
    return { ok: true, text: "" };
  }

  unsay(id: number) {
    return this.act(
      (token) => call("guild/unsay", { token, id }),
      () => "Xabar o'chirildi",
    ).then(async (r) => {
      await this.pollChat();
      return r;
    });
  }

  mute(player: number, minutes: number) {
    return this.act(
      (token) => call("guild/mute", { token, player, minutes }),
      () =>
        minutes > 0
          ? `Chatda ${minutes >= 60 ? `${minutes / 60} soat` : `${minutes} daqiqa`} jim qilindi`
          : "Jimlik olib tashlandi",
    );
  }

  /** Bitta amal: natija matni va (muvaffaqiyatda) ma'lumot yangilanadi */
  private async act<O extends Op>(
    run: (token: string) => Promise<ApiResult<O>>,
    ok: (r: Extract<ApiResult<O>, { ok: true }>) => string,
    ctx: Parameters<typeof guildErrorText>[1] = "manage",
  ): Promise<GuildResult> {
    const token = this.acc.sessionToken;
    if (!token) return { ok: false, text: ERROR_TEXT.auth };
    const r = await run(token);
    if (!r.ok) {
      if (r.error === "auth") await this.acc.dropSession();
      return { ok: false, text: guildErrorText(r as Fail, ctx) };
    }
    await this.refresh();
    return { ok: true, text: ok(r as Extract<ApiResult<O>, { ok: true }>) };
  }

  join(id: number) {
    return this.act(
      (token) => call("guild/join", { token, id }),
      (r) =>
        r.joined ? "Gildiyaga qo'shildingiz!" : "Ariza yuborildi — rahbar tasdiqlashini kuting",
      "join",
    );
  }

  cancel(id: number) {
    return this.act(
      (token) => call("guild/cancel", { token, id }),
      () => "Ariza bekor qilindi",
    );
  }

  answer(player: number, accept: boolean) {
    return this.act(
      (token) => call("guild/answer", { token, player, accept }),
      () => (accept ? "Qabul qilindi" : "Rad etildi"),
    );
  }

  invite(query: string) {
    const q = query.trim();
    if (!q) return Promise.resolve({ ok: false, text: "Taxallus yoki do'st kodini yozing" });
    return this.act(
      (token) => call("guild/invite", { token, query: q }),
      (r) => (r.joined ? `${r.nick} gildiyaga qabul qilindi` : `${r.nick} ga taklif yuborildi`),
      "invite",
    );
  }

  reply(id: number, accept: boolean) {
    return this.act(
      (token) => call("guild/reply", { token, id, accept }),
      (r) => (r.joined ? "Gildiyaga qo'shildingiz!" : "Taklif rad etildi"),
      "join",
    );
  }

  leave() {
    return this.act(
      (token) => call("guild/leave", { token }),
      () => "Gildiyadan chiqdingiz. Boshqasiga 24 soatdan keyin qo'shila olasiz",
    );
  }

  kick(player: number) {
    return this.act(
      (token) => call("guild/kick", { token, player }),
      () => "Gildiyadan chiqarildi",
    );
  }

  setRole(player: number, role: "officer" | "member") {
    return this.act(
      (token) => call("guild/role", { token, player, role }),
      () => (role === "officer" ? "Endi u o'rinbosar" : "Endi u oddiy a'zo"),
    );
  }

  transfer(player: number) {
    return this.act(
      (token) => call("guild/transfer", { token, player }),
      () => "Rahbarlik topshirildi",
    );
  }

  disband() {
    return this.act(
      (token) => call("guild/disband", { token, confirm: true }),
      () => "Gildiya tarqatildi",
    );
  }

  settings(patch: { mode?: JoinMode; lang?: GuildLang; emblem?: string }) {
    return this.act(
      (token) => call("guild/settings", { token, ...patch }),
      () => "Saqlandi",
    );
  }
}

export const guild = new GuildManager();

export function useGuild() {
  return useSyncExternalStore(guild.subscribe, guild.getView, guild.getView);
}

/** Xato kodi matni (oyna uchun) */
export const guildErr = (e: ErrCode) => ERROR_TEXT[e];
