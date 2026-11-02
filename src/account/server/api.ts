/**
 * Akkaunt API: /acc/<op> so'rovlarini tekshirib, omborga (AccountStore) yo'naltiradi.
 * Cloudflare'ga bog'liq emas — AccountDO ham, testlar ham shu funksiyani chaqiradi.
 */
import { UNLOCKED_HEROES_KEY } from "@/game/save";
import { HERO_LIST } from "@/game/hero";
import { AUTH_MAX_AGE, REQ, isOp, type ErrCode, type Op, type ReqOf } from "../protocol";
import type { AccountStore, PlayerRow } from "./store";
import { verifyInitData, verifyLoginWidget } from "./telegram";
import { handleGuild } from "./guildApi";
import { handleAdmin } from "./adminApi";

export interface ApiEnv {
  now: number;
  /** so'rov yuborgan IP (tezlik cheklovi uchun) */
  ip: string;
  /** bot tokeni (wrangler secret) — bo'lmasa Telegram orqali kirish o'chiq */
  botToken: string | null;
  /** bot username (t.me havolasi uchun) */
  bot: string | null;
  /** muallif(lar) Telegram ID'lari (ADMIN_TELEGRAM_IDS); yo'q yoki bo'sh — hech kim admin emas */
  admins?: ReadonlySet<number>;
}

/** Token bucket: burst — zaxira, perMin — daqiqasiga to'ladi. Xotirada (DO uxlasa — nollanadi). */
export class Limiter {
  private buckets = new Map<string, { t: number; at: number }>();
  constructor(
    private burst: number,
    private perMin: number,
  ) {}

  allow(key: string, now: number, cost = 1) {
    const b = this.buckets.get(key) ?? { t: this.burst, at: now };
    b.t = Math.min(this.burst, b.t + ((now - b.at) / 60_000) * this.perMin);
    b.at = now;
    if (this.buckets.size > 5000) this.buckets.clear();
    this.buckets.set(key, b);
    if (b.t < cost) return false;
    b.t -= cost;
    return true;
  }
}

export class Limiters {
  /** har o'yinchi (sessiya) — daqiqasiga 40 ta so'rov */
  general = new Limiter(60, 40);
  /**
   * kirmagan so'rovlar (reyting ko'rish, kirish) — IP bo'yicha. Mobil operatorlarda ko'p
   * foydalanuvchi bitta IP'da (CGNAT) — shuning uchun keng.
   */
  anon = new Limiter(240, 240);
  /** yangi kirish urinishlari — IP bo'yicha daqiqasiga 20 ta */
  login = new Limiter(30, 20);
}

const fail = (error: ErrCode, extra: Record<string, unknown> = {}) => ({
  ok: false as const,
  error,
  ...extra,
});

/** Bepul qahramonlar va bulutli saqlanishda sotib olinganlar */
export function unlockedIn(data: Record<string, string> | undefined) {
  const set = new Set(HERO_LIST.filter((h) => h.price <= 0).map((h) => h.id as string));
  try {
    const raw = JSON.parse(data?.[UNLOCKED_HEROES_KEY] ?? "[]") as unknown;
    if (Array.isArray(raw)) for (const h of raw) if (typeof h === "string") set.add(h);
  } catch {
    /* buzuq yozuv — faqat bepullar */
  }
  return set;
}

export async function handleApi(
  store: AccountStore,
  op: string,
  raw: unknown,
  env: ApiEnv,
  lim: Limiters,
): Promise<Record<string, unknown>> {
  if (!isOp(op)) return fail("bad");
  const parsed = REQ[op].safeParse(raw);
  if (!parsed.success) return fail("bad");
  const body = parsed.data as Record<string, unknown>;
  const token = typeof body["token"] === "string" ? body["token"] : null;
  // bot kodi tasdig'ini so'rash — kod bo'yicha (bitta IP'da ko'p qurilma bo'lishi mumkin)
  const key = token
    ? `t:${token}`
    : op === "auth/poll" && typeof body["code"] === "string"
      ? `poll:${body["code"]}`
      : null;
  if (key ? !lim.general.allow(key, env.now) : !lim.anon.allow(`ip:${env.ip}`, env.now))
    return fail("rate");

  const authed = async (): Promise<PlayerRow | null> =>
    token ? store.authenticate(token, env.now) : null;

  // admin huquqi faqat server sozlamasidan (har so'rovda yangilanadi)
  store.admin.ids = env.admins ?? new Set();

  // gildiyalar — alohida faylda (guildApi.ts)
  if (op.startsWith("guild/")) return handleGuild(store, op, body, env.now, authed, !!token);
  // muallif paneli (adminApi.ts) — huquq o'sha yerda tekshiriladi
  if (op.startsWith("admin/")) return handleAdmin(store, op, body, env.now, authed);

  switch (op as Op) {
    case "auth/webapp": {
      const b = body as ReqOf<"auth/webapp">;
      if (!env.botToken) return fail("server");
      if (!lim.login.allow(`ip:${env.ip}`, env.now)) return fail("rate");
      const user = await verifyInitData(b.initData, env.botToken, env.now, AUTH_MAX_AGE);
      if (!user) return fail("sign");
      return { ok: true, ...(await store.login(user, b.device, env.now)) };
    }
    case "auth/widget": {
      const b = body as ReqOf<"auth/widget">;
      if (!env.botToken) return fail("server");
      if (!lim.login.allow(`ip:${env.ip}`, env.now)) return fail("rate");
      const user = await verifyLoginWidget(b.user, env.botToken, env.now, AUTH_MAX_AGE);
      if (!user) return fail("sign");
      return { ok: true, ...(await store.login(user, b.device, env.now)) };
    }
    case "auth/bot": {
      const b = body as ReqOf<"auth/bot">;
      if (!env.botToken || !env.bot) return fail("server");
      if (!lim.login.allow(`ip:${env.ip}`, env.now)) return fail("rate");
      const r = await store.startBotLogin(b.device, env.now);
      if (!r) return fail("server");
      return { ok: true, ...r, link: `https://t.me/${env.bot}?start=login_${r.code}` };
    }
    case "auth/poll": {
      const b = body as ReqOf<"auth/poll">;
      const r = await store.pollBotLogin(b.code, b.secret, env.now);
      if (r.status === "wait") return { ok: true, status: "wait" };
      if (r.status === "done")
        return { ok: true, status: "done", token: r.token, me: r.me, created: r.created };
      return fail("expired", r.status === "cancelled" ? { field: "cancelled" } : {});
    }
    case "auth/logout": {
      if (token) await store.logout(token);
      return { ok: true };
    }
    case "me": {
      const p = await authed();
      return p ? { ok: true, me: store.me(p) } : fail("auth");
    }
    case "save/get": {
      const b = body as ReqOf<"save/get">;
      const p = await authed();
      if (!p) return fail("auth");
      const v = store.saveVersion(p.id);
      if (b.have !== undefined && v > 0 && b.have === v)
        return { ok: true, save: null, same: true };
      return { ok: true, save: store.getSave(p.id) };
    }
    case "save/put": {
      const b = body as ReqOf<"save/put">;
      const p = await authed();
      if (!p) return fail("auth");
      const r = store.putSave(p.id, b, env.now);
      if (!r.ok)
        return fail(
          r.error,
          "save" in r ? { save: r.save } : "field" in r ? { field: r.field } : {},
        );
      return { ok: true, version: r.version };
    }
    case "save/backups": {
      const p = await authed();
      if (!p) return fail("auth");
      return { ok: true, backups: store.backups(p.id) };
    }
    case "save/restore": {
      const b = body as ReqOf<"save/restore">;
      const p = await authed();
      if (!p) return fail("auth");
      const save = store.restore(p.id, b.slot, env.now);
      return save ? { ok: true, save } : fail("none");
    }
    case "account/delete": {
      const p = await authed();
      if (!p) return fail("auth");
      store.deleteAccount(p.id);
      return { ok: true };
    }
    case "friends/list": {
      const p = await authed();
      if (!p) return fail("auth");
      return { ok: true, ...store.friends.list(p.id, env.now) };
    }
    case "friends/add": {
      const b = body as ReqOf<"friends/add">;
      const p = await authed();
      if (!p) return fail("auth");
      const r = store.friends.add(p, b.query, env.now);
      return r.ok ? r : fail(r.error);
    }
    case "friends/answer": {
      const b = body as ReqOf<"friends/answer">;
      const p = await authed();
      if (!p) return fail("auth");
      const r = store.friends.answer(p, b.id, b.accept, env.now);
      return r.ok ? r : fail(r.error);
    }
    case "friends/remove": {
      const b = body as ReqOf<"friends/remove">;
      const p = await authed();
      if (!p) return fail("auth");
      return store.friends.remove(p, b.id);
    }
    case "friends/block": {
      const b = body as ReqOf<"friends/block">;
      const p = await authed();
      if (!p) return fail("auth");
      const r = store.friends.block(p, b.id, env.now);
      return r.ok ? r : fail(r.error);
    }
    case "friends/unblock": {
      const b = body as ReqOf<"friends/unblock">;
      const p = await authed();
      if (!p) return fail("auth");
      return store.friends.unblock(p, b.id);
    }
    case "friends/msg": {
      const b = body as ReqOf<"friends/msg">;
      const p = await authed();
      if (!p) return fail("auth");
      const r = store.friends.message(p, b.to, b.phrase, env.now);
      return r.ok ? r : fail(r.error);
    }
    case "scores/submit": {
      const b = body as ReqOf<"scores/submit">;
      const p = await authed();
      if (!p) return fail("auth");
      const r = store.scores.submit(p, b, env.now);
      return r.ok ? r : fail(r.error);
    }
    case "scores/top": {
      const b = body as ReqOf<"scores/top">;
      // ko'rish — hamma uchun; o'z o'rni — kirgan o'yinchiga
      const p = token ? await authed() : null;
      const top = store.scores.top(b.board, b.period, p, env.now);
      return top ? { ok: true, ...top } : fail("bad");
    }
    case "presence": {
      const b = body as ReqOf<"presence">;
      const p = await authed();
      if (!p) return fail("auth");
      return store.friends.presence(p, b.place, b.room ?? null, env.now);
    }
    case "gifts/list": {
      const p = await authed();
      if (!p) return fail("auth");
      return { ok: true, gifts: store.gifts.list(p.id) };
    }
    case "gifts/claim": {
      const b = body as ReqOf<"gifts/claim">;
      const p = await authed();
      if (!p) return fail("auth");
      const r = store.gifts.claim(p, b.id, b.base, env.now);
      return r.ok ? r : fail(r.error, r.save ? { save: r.save } : {});
    }
    case "exp/get": {
      const p = await authed();
      if (!p) return fail("auth");
      const e = store.exp.get(p);
      return { ok: true, exp: e ? { ...e, now: env.now } : null, now: env.now };
    }
    case "exp/start": {
      const b = body as ReqOf<"exp/start">;
      const p = await authed();
      if (!p) return fail("auth");
      const r = store.exp.start(p, b.hero, env.now);
      if (!r.ok) return fail(r.error);
      const e = store.exp.get(p);
      return { ok: true, exp: e ? { ...e, now: env.now } : null, now: env.now };
    }
    case "exp/claim": {
      const b = body as ReqOf<"exp/claim">;
      const p = await authed();
      if (!p) return fail("auth");
      return { ok: true, reward: store.exp.claim(p, env.now, !!b.end) };
    }
    case "profile": {
      const b = body as ReqOf<"profile">;
      const p = await authed();
      if (!p) return fail("auth");
      const owned = unlockedIn(store.getSave(p.id)?.data);
      const r = store.setProfile(p, { nick: b.nick, avatar: b.avatar }, (h) => owned.has(h));
      return r.ok ? { ok: true, me: store.me(r.player) } : fail(r.error);
    }
    default:
      return fail("bad");
  }
}
