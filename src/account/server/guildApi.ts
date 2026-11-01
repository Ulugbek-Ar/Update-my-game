/**
 * Gildiya so'rovlari (/acc/guild/*): handleApi tekshirgan (zod) tanani Guilds omboriga
 * yo'naltiradi. Cloudflare'ga bog'liq emas — testlar ham shu yerdan o'tadi.
 */
import type { ReqOf } from "../protocol";
import type { AccountStore, PlayerRow } from "./store";
import type { GuildFail } from "./guilds";

type Out = Record<string, unknown>;

const fail = (error: string): Out => ({ ok: false, error });

/** Javob: muvaffaqiyat — o'zi, xato — { ok: false, error, ...qo'shimcha } */
const done = (r: { ok: true } | GuildFail): Out => r as unknown as Out;

export async function handleGuild(
  store: AccountStore,
  op: string,
  body: Record<string, unknown>,
  now: number,
  authed: () => Promise<PlayerRow | null>,
  hasToken: boolean,
): Promise<Out> {
  const g = store.guilds;
  // ko'rish (qidirish, gildiya haqida) — hamma uchun
  if (op === "guild/search") {
    const b = body as ReqOf<"guild/search">;
    if (hasToken && !(await authed())) return fail("auth");
    return { ok: true, guilds: g.search(b.query, b.lang, now) };
  }
  if (op === "guild/top") {
    const b = body as ReqOf<"guild/top">;
    const p = hasToken ? await authed() : null;
    return { ok: true, ...g.ranks.top(b.board, b.period, p, now) };
  }
  if (op === "guild/info") {
    const b = body as ReqOf<"guild/info">;
    const info = g.info(b.id, now);
    if (!info) return fail("none");
    const p = hasToken ? await authed() : null;
    const mine = p ? g.member(p.id)?.guild === b.id : false;
    // begona ko'radi: chatdagi jim belgisi ko'rsatilmaydi
    const members = g.members(b.id, now).map((m) => (mine ? m : { ...m, muted: 0 }));
    return { ok: true, guild: info, members };
  }
  const p = await authed();
  if (!p) return fail("auth");
  switch (op) {
    case "guild/get":
      return { ok: true, ...g.state(p, now) };
    case "guild/create": {
      const b = body as ReqOf<"guild/create">;
      return done(g.create(p, b, now));
    }
    case "guild/join": {
      const b = body as ReqOf<"guild/join">;
      return done(g.join(p, b.id, now));
    }
    case "guild/cancel": {
      const b = body as ReqOf<"guild/cancel">;
      return done(g.cancel(p, b.id));
    }
    case "guild/answer": {
      const b = body as ReqOf<"guild/answer">;
      return done(g.answer(p, b.player, b.accept, now));
    }
    case "guild/invite": {
      const b = body as ReqOf<"guild/invite">;
      return done(g.invite(p, b.query, now));
    }
    case "guild/reply": {
      const b = body as ReqOf<"guild/reply">;
      return done(g.reply(p, b.id, b.accept, now));
    }
    case "guild/leave":
      return done(g.leave(p, now));
    case "guild/kick": {
      const b = body as ReqOf<"guild/kick">;
      return done(g.kick(p, b.player, now));
    }
    case "guild/role": {
      const b = body as ReqOf<"guild/role">;
      return done(g.setRole(p, b.player, b.role, now));
    }
    case "guild/transfer": {
      const b = body as ReqOf<"guild/transfer">;
      return done(g.transfer(p, b.player, now));
    }
    case "guild/disband":
      return done(g.disband(p, now));
    case "guild/settings": {
      const b = body as ReqOf<"guild/settings">;
      return done(g.settings(p, { mode: b.mode, lang: b.lang, emblem: b.emblem }));
    }
    case "guild/give": {
      const b = body as ReqOf<"guild/give">;
      return done(g.life.give(p, b.amount, b.gold, b.rid, now));
    }
    case "guild/log":
      return done(g.life.log(p));
    case "guild/chat": {
      const b = body as ReqOf<"guild/chat">;
      return done(g.life.chat(p, b.since, b.rev, now));
    }
    case "guild/say": {
      const b = body as ReqOf<"guild/say">;
      return done(g.life.say(p, { text: b.text, phrase: b.phrase }, now));
    }
    case "guild/unsay": {
      const b = body as ReqOf<"guild/unsay">;
      return done(g.life.unsay(p, b.id));
    }
    case "guild/mute": {
      const b = body as ReqOf<"guild/mute">;
      return done(g.life.mute(p, b.player, b.minutes, now));
    }
    default:
      return fail("bad");
  }
}
