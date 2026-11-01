/**
 * Gildiya zali Durable Object'i (nomi — "hall:<gildiya raqami>"): har gildiyaning o'z xonasi.
 * WebSocket Hibernation API (RoomDO kabi): o'yinchi bor ekan — 20 Hz tick, hamma chiqsa tick
 * to'xtaydi va DO uxlaydi (vaqt sarflanmaydi). Kirish faqat shu gildiya a'zolariga — token
 * akkauntlar DO'sida tekshiriladi. Zal bezagi (nom, gerb, daraja, trofeylar) ham o'sha yerdan.
 * Mantiq — src/realm/net/hall.ts (HallRoom), batafsil: docs/guilds.md
 */
import { DurableObject } from "cloudflare:workers";
import { HallRoom } from "../../src/realm/net/hall";
import type { RoomConn } from "../../src/realm/net/room";
import { MAX_MSG, type NetIdent } from "../../src/realm/net/protocol";
import { TICK_DT } from "../../src/realm/sim";
import type { Env } from "./index";

const TICK_MS = TICK_DT * 1000;
/** Lobbiga hisobot va zal bezagini yangilash oralig'i */
const REPORT_MS = 60_000;
const INFO_MS = 120_000;

interface Attachment {
  id: string;
}

function conn(ws: WebSocket): RoomConn {
  return {
    send(s) {
      try {
        ws.send(s);
      } catch {
        /* ulanish yopilgan */
      }
    },
    close(code, reason) {
      try {
        ws.close(code, reason);
      } catch {
        /* allaqachon yopilgan */
      }
    },
  };
}

export class HallDO extends DurableObject<Env> {
  private room: HallRoom | null = null;
  private guild = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private last = 0;
  private acc = 0;
  private reportAt = 0;
  private infoAt = 0;
  private used = 0;
  private activeMs = 0;
  private activeAt = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.guild = (await ctx.storage.get<number>("guild")) ?? 0;
      if (this.guild) this.room = new HallRoom(this.guild);
    });
  }

  private get accounts() {
    return this.env.ACCOUNTS.get(this.env.ACCOUNTS.idFromName("accounts"));
  }

  async fetch(req: Request): Promise<Response> {
    const g = Number(new URL(req.url).searchParams.get("g"));
    if (req.headers.get("Upgrade") !== "websocket" || !Number.isInteger(g) || g <= 0)
      return new Response("WebSocket kutilgan", { status: 426 });
    if (!this.guild) {
      this.guild = g;
      await this.ctx.storage.put("guild", g);
    }
    if (g !== this.guild) return new Response("Boshqa zal", { status: 400 });
    this.room ??= new HallRoom(this.guild);
    if (!this.room.info) await this.loadInfo();
    const pair = new WebSocketPair();
    const client = pair[0],
      server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: this.room.newId() } satisfies Attachment);
    this.used += 2;
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    const room = (this.room ??= this.guild ? new HallRoom(this.guild) : null);
    if (!room) return;
    const { id } = ws.deserializeAttachment() as Attachment;
    // salomlashuvdagi token — akkauntlar DO'sida: kim va qaysi gildiyadan (faqat a'zolar kiradi)
    const ident = typeof msg === "string" && !room.has(id) ? await this.identify(msg) : null;
    if (!room.info) await this.loadInfo();
    const before = room.size;
    room.receive(id, conn(ws), typeof msg === "string" ? msg : null, Date.now() / 1000, ident);
    if (room.size !== before) this.changed();
    this.ensureTick();
  }

  async webSocketClose(ws: WebSocket, code: number) {
    this.drop(ws);
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, "bye");
    } catch {
      /* allaqachon yopilgan */
    }
  }

  async webSocketError(ws: WebSocket) {
    this.drop(ws);
  }

  private drop(ws: WebSocket) {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att || !this.room) return;
    const before = this.room.size;
    this.room.leave(att.id);
    if (this.room.size !== before) this.changed();
  }

  private async identify(raw: string): Promise<NetIdent | null> {
    if (raw.length > MAX_MSG || !raw.includes('"acct"')) return null;
    let token: unknown;
    try {
      token = (JSON.parse(raw) as { acct?: unknown }).acct;
    } catch {
      return null;
    }
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{32,64}$/.test(token)) return null;
    this.used += 1;
    try {
      return await this.accounts.identify(token);
    } catch (e) {
      console.error("identify", e);
      return null;
    }
  }

  /** Zal bezagi: akkauntlar DO'sidan (gildiya tarqatilgan bo'lsa — null, hech kim kirmaydi) */
  private async loadInfo() {
    if (!this.room) return;
    this.infoAt = Date.now();
    this.used += 1;
    try {
      this.room.setInfo(await this.accounts.hallInfo(this.guild));
    } catch (e) {
      console.error("hallInfo", e);
    }
  }

  private changed() {
    void this.report();
    if (this.room?.size === 0) this.stop();
  }

  private ensureTick() {
    if (this.timer || !this.room || this.room.size === 0) return;
    this.last = this.activeAt = Date.now();
    this.acc = 0;
    this.timer = setInterval(() => this.loop(), TICK_MS);
  }

  private loop() {
    const room = this.room;
    if (!room) return;
    try {
      const now = Date.now();
      this.acc += now - this.last;
      this.last = now;
      for (let n = 0; this.acc >= TICK_MS && n < 4; n++) {
        this.acc -= TICK_MS;
        room.step();
      }
      if (this.acc > TICK_MS * 4) this.acc = 0;
      if (now - this.reportAt > REPORT_MS) void this.report();
      if (now - this.infoAt > INFO_MS) void this.loadInfo();
    } catch (e) {
      console.error("zal tick xatosi", e);
    }
  }

  private active() {
    if (!this.timer) return;
    const now = Date.now();
    this.activeMs += now - this.activeAt;
    this.activeAt = now;
  }

  private stop() {
    this.active();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Lobbiga: o'yinchilar soni, so'rovlar va ishlagan vaqt (kunlik limitlar bitta joyda) */
  private async report() {
    const room = this.room;
    if (!room) return;
    this.reportAt = Date.now();
    this.active();
    const used = this.used + room.inbound / 20;
    const secs = this.activeMs / 1000;
    this.used = this.activeMs = 0;
    room.inbound = 0;
    try {
      const lobby = this.env.LOBBY.get(this.env.LOBBY.idFromName("lobby"));
      const r = await lobby.report(`hall-${this.guild}`, room.size, used, secs);
      room.busy = r.busy;
    } catch (e) {
      console.error("lobbi hisoboti", e);
    }
  }
}
