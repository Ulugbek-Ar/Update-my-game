/**
 * Olam xonasi Durable Object'i (nomi — xona kodi). WebSocket Hibernation API: ulanishlar
 * ctx.acceptWebSocket bilan qabul qilinadi (ws.accept() emas). Xonada o'yinchi bor ekan — 20 Hz tick,
 * hamma chiqsa tick to'xtaydi, dunyo saqlanadi va DO uxlaydi (vaqt sarflanmaydi).
 * Mantiq — src/realm/net/room.ts (RealmRoom, ichida klientdagi bilan aynan bir xil RealmSim).
 */
import { DurableObject } from "cloudflare:workers";
import { RealmRoom, type RoomConn } from "../../src/realm/net/room";
import { normalizeRoomCode } from "../../src/realm/net/protocol";
import { TICK_DT, type RealmWorldSave } from "../../src/realm/sim";
import type { Env } from "./index";

const TICK_MS = TICK_DT * 1000;
/** Lobbiga hisobot va dunyoni saqlash oralig'i */
const REPORT_MS = 60_000;
const SAVE_MS = 120_000;

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

export class RoomDO extends DurableObject<Env> {
  private room!: RealmRoom;
  private code = "";
  private timer: ReturnType<typeof setInterval> | null = null;
  private last = 0;
  private acc = 0;
  private reportAt = 0;
  private saveAt = 0;
  /** lobbiga hali aytilmagan so'rovlar (yangi ulanishlar) */
  private used = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.code = (await ctx.storage.get<string>("code")) ?? "";
      const world = (await ctx.storage.get<RealmWorldSave>("world")) ?? null;
      this.room = new RealmRoom(this.code, { world });
    });
  }

  async fetch(req: Request): Promise<Response> {
    const code = normalizeRoomCode(new URL(req.url).searchParams.get("xona"));
    if (req.headers.get("Upgrade") !== "websocket" || !code)
      return new Response("WebSocket kutilgan", { status: 426 });
    if (!this.code) {
      this.code = this.room.code = code;
      await this.ctx.storage.put("code", code);
    }
    const pair = new WebSocketPair();
    const client = pair[0],
      server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: this.room.newId() } satisfies Attachment);
    // Worker so'rovi + DO so'rovi
    this.used += 2;
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    const { id } = ws.deserializeAttachment() as Attachment;
    const before = this.room.size;
    this.room.receive(id, conn(ws), typeof msg === "string" ? msg : null, Date.now() / 1000);
    if (this.room.size !== before) this.changed();
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
    if (!att) return;
    const before = this.room.size;
    this.room.leave(att.id);
    if (this.room.size !== before) this.changed();
  }

  /** O'yinchilar soni o'zgardi: lobbiga aytiladi; hamma chiqsa — tick to'xtaydi */
  private changed() {
    void this.report();
    if (this.room.size === 0) this.stop();
  }

  private ensureTick() {
    if (this.timer || this.room.size === 0) return;
    this.last = Date.now();
    this.acc = 0;
    this.timer = setInterval(() => this.loop(), TICK_MS);
  }

  private loop() {
    try {
      const now = Date.now();
      this.acc += now - this.last;
      this.last = now;
      // kechikkan tick'lar quvib yetiladi, lekin ko'pi bilan 4 ta (uzoq to'xtashda sakraladi)
      for (let n = 0; this.acc >= TICK_MS && n < 4; n++) {
        this.acc -= TICK_MS;
        this.room.step();
      }
      if (this.acc > TICK_MS * 4) this.acc = 0;
      if (now - this.reportAt > REPORT_MS) void this.report();
      if (now - this.saveAt > SAVE_MS) void this.persist();
    } catch (e) {
      console.error("tick xatosi", e);
    }
  }

  private stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.persist();
  }

  private async persist() {
    this.saveAt = Date.now();
    await this.ctx.storage.put("world", this.room.sim.saveWorld());
  }

  private async report() {
    if (!this.code) return;
    this.reportAt = Date.now();
    const used = this.used + this.room.inbound / 20;
    this.used = 0;
    this.room.inbound = 0;
    try {
      const lobby = this.env.LOBBY.get(this.env.LOBBY.idFromName("lobby"));
      const r = await lobby.report(this.code, this.room.size, used);
      this.room.busy = r.busy;
    } catch (e) {
      console.error("lobbi hisoboti", e);
    }
  }
}
