/**
 * Piksel Qal'a serveri — Cloudflare Worker.
 *
 *   GET /health          — versiya, xonalar soni, onlayn o'yinchilar, bugungi so'rovlar
 *   GET /join?xona=&v=   — xona tanlash (kod bo'lmasa — avtomatik, to'la xonadan keyingisiga)
 *   GET /ws?xona=KOD     — WebSocket: shu xonaning Durable Object'iga
 *
 * Batafsil: docs/server.md
 */
import { GAME_VERSION } from "../../src/game/version";
import { NET_VERSION, normalizeRoomCode, type JoinReply } from "../../src/realm/net/protocol";
import type { LobbyDO } from "./lobby-do";
import type { RoomDO } from "./room-do";

export { LobbyDO } from "./lobby-do";
export { RoomDO } from "./room-do";

export interface Env {
  ROOM: DurableObjectNamespace<RoomDO>;
  LOBBY: DurableObjectNamespace<LobbyDO>;
}

// o'yin GitHub Pages, Telegram va Android ilovadan (boshqa domen) so'raydi
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
    }
    return new Response("Topilmadi", { status: 404, headers: CORS });
  },
} satisfies ExportedHandler<Env>;
