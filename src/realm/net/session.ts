/**
 * Onlayn ulanish (klient): /join bilan xona olish, WebSocket, salomlashuv, ping va qayta ulanish.
 * DOM'siz holat mashinasi — tarmoq (join, socket) tashqaridan beriladi, testda soxtasi qo'yiladi.
 *
 *   connecting -> online -> (uzildi) reconnecting x3 -> offline ("Oflayn rejim")
 *
 * "busy" va "version" — qayta urinilmaydi (darhol oflayn); "full" (kod bilan) — avtomatik xonaga.
 */
import type { RealmCommand } from "../sim";
import {
  ERR_TEXT,
  PING_EVERY,
  type ErrReason,
  type HelloMsg,
  type JoinReply,
  type ServerMsg,
} from "./protocol";

export type NetStatus = "connecting" | "online" | "reconnecting" | "offline";

/** Uzilgandan keyin shuncha marta qayta urinadi (1s, 2s, 4s) */
export const MAX_RETRIES = 3;
/** Ulanish (welcome'gacha) shundan uzoq cho'zilsa — muvaffaqiyatsiz */
export const CONNECT_TIMEOUT = 8000;

export interface SocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export interface NetDeps {
  /** /join so'rovi */
  join(code: string | null): Promise<JoinReply>;
  /** shu xonaga WebSocket */
  open(code: string): SocketLike;
  /** millisekund (ping uchun) */
  now(): number;
}

export interface NetOptions {
  /** do'st chaqiruvi: aynan shu xona */
  code: string | null;
  /** salomlashuv: joriy saqlanish bilan (har ulanishda yangidan) */
  hello(near: boolean): HelloMsg;
}

export class NetSession {
  status: NetStatus = "connecting";
  /** joriy (yoki so'ralgan) xona kodi */
  code: string | null;
  /** o'z id'si va ismi (welcome) */
  pid = "";
  name = "";
  /** ping (ms), silliqlangan */
  rtt = 0;
  retries = 0;
  /** xabar: "Xona to'la", "Server band..." (bir marta o'qiladi) */
  notice: string | null = null;
  onStatus: ((s: NetStatus) => void) | null = null;
  onMessage: ((m: ServerMsg) => void) | null = null;
  private ws: SocketLike | null = null;
  private near: boolean;
  private closed = false;
  private fullTries = 0;
  private err: ErrReason | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private deps: NetDeps,
    private opts: NetOptions,
  ) {
    this.code = opts.code;
    this.near = !!opts.code;
  }

  start() {
    void this.connect();
  }

  /** O'yinchi olamdan chiqdi: qayta ulanmaydi */
  close() {
    this.closed = true;
    this.cleanup();
  }

  sendCmds(s: number, c: RealmCommand[]) {
    if (this.status === "online" && c.length) this.raw({ t: "cmd", s, c });
  }

  chat(p: number) {
    if (this.status === "online") this.raw({ t: "chat", p });
  }

  private raw(v: unknown) {
    try {
      this.ws?.send(JSON.stringify(v));
    } catch {
      /* yopilayotgan ulanish */
    }
  }

  private set(s: NetStatus) {
    if (this.status === s) return;
    this.status = s;
    this.onStatus?.(s);
  }

  private later(fn: () => void, ms: number) {
    this.timers.push(setTimeout(fn, ms));
  }

  private cleanup() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try {
        ws.close(1000, "bye");
      } catch {
        /* allaqachon yopilgan */
      }
    }
  }

  private async connect() {
    if (this.closed) return;
    this.set(this.retries ? "reconnecting" : "connecting");
    this.err = null;
    let reply: JoinReply;
    try {
      reply = await this.deps.join(this.code);
    } catch {
      return this.fail();
    }
    if (this.closed) return;
    if (!reply.ok) return this.refused(reply.reason);
    this.code = reply.code;
    let ws: SocketLike;
    try {
      ws = this.deps.open(reply.code);
    } catch {
      return this.fail();
    }
    this.ws = ws;
    let welcomed = false;
    const timeout = setTimeout(() => {
      if (!welcomed && this.ws === ws) this.lost();
    }, CONNECT_TIMEOUT);
    this.timers.push(timeout);
    ws.onopen = () => this.raw(this.opts.hello(this.near));
    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") return;
      let m: ServerMsg;
      try {
        m = JSON.parse(ev.data) as ServerMsg;
      } catch {
        return;
      }
      if (m.t === "welcome") {
        welcomed = true;
        clearTimeout(timeout);
        this.pid = m.pid;
        this.name = m.name;
        this.code = m.code;
        // qayta ulansa — shu xonaga, lekin do'st yoniga emas (o'z joyiga)
        this.near = false;
        this.retries = this.fullTries = 0;
        this.startPing();
        this.onMessage?.(m);
        this.set("online");
        return;
      } else if (m.t === "pong") {
        const r = Math.max(0, this.deps.now() - m.id);
        this.rtt = this.rtt ? this.rtt * 0.7 + r * 0.3 : r;
        return;
      } else if (m.t === "err") {
        this.err = m.reason;
        return;
      } else if (m.t === "rejoin") {
        // server qayta ishga tushdi: joriy progress bilan qayta salomlashamiz
        this.raw(this.opts.hello(false));
        return;
      }
      this.onMessage?.(m);
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      if (this.ws !== ws) return;
      if (this.err) this.refused(this.err);
      else this.lost();
    };
  }

  private startPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    const ping = () => this.raw({ t: "ping", id: Math.floor(this.deps.now()) });
    ping();
    this.pingTimer = setInterval(ping, PING_EVERY * 1000);
  }

  /** Server rad etdi */
  private refused(reason: ErrReason) {
    this.cleanup();
    if (reason === "full" && this.code && this.near) {
      // do'stning xonasi to'la — avtomatik xonaga
      this.notice = `${ERR_TEXT.full} — boshqa xonaga ulandingiz`;
      this.code = null;
      this.near = false;
      void this.connect();
      return;
    }
    if (reason === "full" && this.fullTries < MAX_RETRIES) {
      // avtomatik xona shu orada to'lib qoldi — darhol boshqasini so'raymiz
      this.fullTries++;
      this.code = null;
      void this.connect();
      return;
    }
    if (reason === "full") return this.fail();
    this.notice = ERR_TEXT[reason];
    this.giveUp();
  }

  /** Ulanish uzildi yoki o'rnatilmadi */
  private lost() {
    this.cleanup();
    this.fail();
  }

  private fail() {
    if (this.closed) return;
    if (this.retries >= MAX_RETRIES) return this.giveUp();
    this.retries++;
    this.set("reconnecting");
    this.later(() => void this.connect(), 1000 * 2 ** (this.retries - 1));
  }

  private giveUp() {
    this.cleanup();
    this.set("offline");
  }
}

/** Haqiqiy tarmoq: fetch va brauzer WebSocket'i */
export function browserDeps(base: string, version: number): NetDeps {
  return {
    async join(code) {
      const q = new URLSearchParams({ v: String(version) });
      if (code) q.set("xona", code);
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), CONNECT_TIMEOUT);
      try {
        const r = await fetch(`${base}/join?${q}`, { signal: ctl.signal, cache: "no-store" });
        return (await r.json()) as JoinReply;
      } finally {
        clearTimeout(t);
      }
    },
    open(code) {
      return new WebSocket(
        `${base.replace(/^http/, "ws")}/ws?xona=${encodeURIComponent(code)}`,
      ) as unknown as SocketLike;
    },
    now: () => performance.now(),
  };
}
