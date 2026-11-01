/**
 * Akkaunt API: /acc/<op> so'rovlarini tekshirib, omborga (AccountStore) yo'naltiradi.
 * Cloudflare'ga bog'liq emas — AccountDO ham, testlar ham shu funksiyani chaqiradi.
 */
import { UNLOCKED_HEROES_KEY } from "@/game/save";
import { HERO_LIST } from "@/game/hero";
import { AUTH_MAX_AGE, REQ, isOp, type ErrCode, type Op, type ReqOf } from "../protocol";
import type { AccountStore, PlayerRow } from "./store";
import { verifyInitData, verifyLoginWidget } from "./telegram";

export interface ApiEnv {
  now: number;
  /** so'rov yuborgan IP (tezlik cheklovi uchun) */
  ip: string;
  /** bot tokeni (wrangler secret) — bo'lmasa Telegram orqali kirish o'chiq */
  botToken: string | null;
  /** bot username (t.me havolasi uchun) */
  bot: string | null;
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
  /** har o'yinchi (yoki IP) — daqiqasiga 40 ta so'rov */
  general = new Limiter(60, 40);
  /** yangi kirish urinishlari — IP bo'yicha daqiqasiga 4 ta */
  login = new Limiter(6, 4);
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
  if (!lim.general.allow(token ?? `ip:${env.ip}`, env.now)) return fail("rate");

  const authed = async (): Promise<PlayerRow | null> =>
    token ? store.authenticate(token, env.now) : null;

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
