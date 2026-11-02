/**
 * Muallif paneli so'rovlari (/acc/admin/*). Har so'rovda: sessiya -> o'yinchi -> Telegram ID
 * ADMIN_TELEGRAM_IDS da bormi (faqat serverda). Yo'q bo'lsa — "perm", jurnalga va logga yoziladi.
 */
import type { ReqOf } from "../protocol";
import type { AccountStore, PlayerRow } from "./store";

type Out = Record<string, unknown>;

const fail = (error: string, extra: Out = {}): Out => ({ ok: false, error, ...extra });

export async function handleAdmin(
  store: AccountStore,
  op: string,
  body: Record<string, unknown>,
  now: number,
  authed: () => Promise<PlayerRow | null>,
): Promise<Out> {
  const p = await authed();
  if (!p) return fail("auth");
  const a = store.admin;
  if (!a.is(p)) {
    a.deny(p, op, now);
    return fail("perm");
  }
  switch (op) {
    case "admin/info":
      a.onOpen(p);
      return { ok: true, gifts: store.gifts.sent(), log: a.journal() };
    case "admin/unlock": {
      const b = body as ReqOf<"admin/unlock">;
      return a.unlock(p, b.base, now) as Out;
    }
    case "admin/grant": {
      const b = body as ReqOf<"admin/grant">;
      return a.grant(p, b, now) as Out;
    }
    case "admin/reset": {
      const b = body as ReqOf<"admin/reset">;
      return a.reset(p, b.base, now) as Out;
    }
    case "admin/guild": {
      const b = body as ReqOf<"admin/guild">;
      return a.guild(p, b, now) as unknown as Out;
    }
    case "admin/guildlevel": {
      const b = body as ReqOf<"admin/guildlevel">;
      return a.guildLevel(p, b.level, now) as Out;
    }
    case "admin/find": {
      const b = body as ReqOf<"admin/find">;
      return { ok: true, players: a.find(b.query) };
    }
    case "admin/gift": {
      const b = body as ReqOf<"admin/gift">;
      const r = store.gifts.send(p, b, now);
      return r.ok ? r : fail(r.error);
    }
    default:
      return fail("bad");
  }
}
