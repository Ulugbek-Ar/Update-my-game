/**
 * Piksel Qal'a serveri — Cloudflare Worker.
 *
 *   GET  /health          — versiya, xonalar soni, onlayn o'yinchilar, bugungi so'rovlar
 *   GET  /join?xona=&v=   — xona tanlash (kod bo'lmasa — avtomatik, to'la xonadan keyingisiga)
 *   GET  /ws?xona=KOD     — WebSocket: shu xonaning Durable Object'iga
 *   GET  /zal?g=ID&v=     — Gildiya zali: versiya va bandlik tekshiruvi (JSON), WebSocket — zal DO'siga
 *   GET  /acc/config      — bot username (saytdagi Login Widget va bot havolasi)
 *   POST /acc/<op>        — akkaunt API: kirish, bulutli saqlanish, profil (AccountDO)
 *   POST /tg/<secret>     — Telegram bot webhook'i (yashirin yo'l, deploy workflow o'rnatadi)
 *
 * Batafsil: docs/server.md, docs/accounts.md
 */
import { GAME_VERSION } from "../../src/game/version";
import {
  NET_VERSION,
  hallCode,
  normalizeRoomCode,
  type JoinReply,
} from "../../src/realm/net/protocol";
import { MAX_BODY, isOp } from "../../src/account/protocol";
import { webhookSecret } from "../../src/account/server/telegram";
import type { AccountDO } from "./account-do";
import type { HallDO } from "./hall-do";
import type { LobbyDO } from "./lobby-do";
import type { RoomDO } from "./room-do";

export { AccountDO } from "./account-do";
export { HallDO } from "./hall-do";
export { LobbyDO } from "./lobby-do";
export { RoomDO } from "./room-do";

export interface Env {
  ROOM: DurableObjectNamespace<RoomDO>;
  LOBBY: DurableObjectNamespace<LobbyDO>;
  ACCOUNTS: DurableObjectNamespace<AccountDO>;
  /** Gildiya zallari: har gildiyaga bitta DO ("hall:<raqam>") */
  HALL: DurableObjectNamespace<HallDO>;
  /** Kanal boti tokeni: `wrangler secret put TELEGRAM_BOT_TOKEN` (deploy workflow'ida) */
  TELEGRAM_BOT_TOKEN?: string;
  /** Ixtiyoriy: bot username (berilmasa — getMe). Lokal sinov uchun .dev.vars'da */
  TELEGRAM_BOT_NAME?: string;
}

// o'yin GitHub Pages, Telegram va Android ilovadan (boshqa domen) so'raydi.
// Akkaunt so'rovlari POST + text/plain — "oddiy" so'rov, preflight (OPTIONS) kerak emas.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS,
    },
  });

export default {
  async fetch(req, env): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    const lobby = () => env.LOBBY.get(env.LOBBY.idFromName("lobby"));
    const accounts = () => env.ACCOUNTS.get(env.ACCOUNTS.idFromName("accounts"));
    if (url.pathname.startsWith("/acc/")) return account(req, url, accounts);
    if (url.pathname.startsWith("/tg/")) return telegram(req, url, env, accounts);
    switch (url.pathname) {
      case "/":
        return new Response("Piksel Qal'a serveri. Holat: /health", { headers: CORS });
      case "/health": {
        const s = await lobby().health();
        return json({
          ok: true,
          version: GAME_VERSION,
          protocol: NET_VERSION,
          rooms: s.rooms,
          online: s.online,
          today: {
            requests: s.used,
            limit: s.limit,
            durationGBs: s.gbs,
            durationLimit: s.gbsLimit,
          },
        });
      }
      case "/join": {
        if (Number(url.searchParams.get("v")) !== NET_VERSION)
          return json({ ok: false, reason: "version" } satisfies JoinReply);
        const raw = url.searchParams.get("xona");
        const code = raw ? normalizeRoomCode(raw) : null;
        if (raw && !code) return json({ ok: false, reason: "bad" } satisfies JoinReply);
        return json(await lobby().join(code));
      }
      case "/ws": {
        const code = normalizeRoomCode(url.searchParams.get("xona"));
        if (!code || req.headers.get("Upgrade") !== "websocket")
          return new Response("WebSocket va xona kodi kerak", { status: 400, headers: CORS });
        return env.ROOM.get(env.ROOM.idFromName(code)).fetch(req);
      }
      case "/zal": {
        // Gildiya zali: a'zolikni zal DO'si (token orqali) tekshiradi
        const g = Number(url.searchParams.get("g"));
        if (!Number.isInteger(g) || g <= 0 || g > 1e9)
          return json({ ok: false, reason: "bad" } satisfies JoinReply);
        if (req.headers.get("Upgrade") === "websocket")
          return env.HALL.get(env.HALL.idFromName(`hall:${g}`)).fetch(req);
        if (Number(url.searchParams.get("v")) !== NET_VERSION)
          return json({ ok: false, reason: "version" } satisfies JoinReply);
        const { busy } = await lobby().extra(1);
        return json(
          busy
            ? ({ ok: false, reason: "busy" } satisfies JoinReply)
            : { ok: true, code: hallCode(g) },
        );
      }
    }
    return new Response("Topilmadi", { status: 404, headers: CORS });
  },
} satisfies ExportedHandler<Env>;

type Accounts = () => DurableObjectStub<AccountDO>;

/** /acc/<op>: tana JSON (text/plain), javob doim JSON ({ ok, ... }) */
async function account(req: Request, url: URL, accounts: Accounts): Promise<Response> {
  const op = url.pathname.slice("/acc/".length);
  if (op === "config" && req.method === "GET") return json(await accounts().config());
  if (req.method !== "POST" || !isOp(op)) return json({ ok: false, error: "bad" }, 404);
  const text = await req.text();
  if (text.length > MAX_BODY) return json({ ok: false, error: "big" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: "bad" }, 400);
  }
  try {
    return json(await accounts().api(op, body, req.headers.get("CF-Connecting-IP") ?? ""));
  } catch (e) {
    console.error("acc", op, e);
    return json({ ok: false, error: "server" }, 500);
  }
}

/** Telegram webhook: yo'l va sarlavhadagi secret bot tokenidan (server.yml shu bilan o'rnatadi) */
async function telegram(req: Request, url: URL, env: Env, accounts: Accounts): Promise<Response> {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const secret = token ? await webhookSecret(token) : null;
  if (
    !secret ||
    req.method !== "POST" ||
    url.pathname !== `/tg/${secret}` ||
    req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secret
  )
    return new Response("Topilmadi", { status: 404 });
  try {
    await accounts().telegram(await req.json());
  } catch (e) {
    // Telegram qayta-qayta yubormasin: xatoda ham 200
    console.error("webhook", e);
  }
  return new Response("ok");
}
