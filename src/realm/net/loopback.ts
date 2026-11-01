/**
 * Bitta jarayon ichidagi "server": NetSession'ni tarmoqsiz RealmRoom'ga ulaydi.
 * Testlarda (ikki klient bir xonada, uzilish, to'la xona) va dev rejimida (bot bilan sinov,
 * skrinshotlar) ishlatiladi. Kechikish (latency) bilan haqiqiy tarmoqqa o'xshatsa bo'ladi.
 */
import { Lobby } from "./lobby";
import { RealmRoom, type RoomConn } from "./room";
import type { NetIdent } from "./protocol";
import type { NetDeps, SocketLike } from "./session";

export class Loopback {
  lobby = new Lobby();
  rooms = new Map<string, RealmRoom>();
  /** bir tomonga kechikish (ms) */
  latency = 0;
  /** server "o'chiq": join va ulanish muvaffaqiyatsiz */
  down = false;
  /**
   * Akkaunt tekshiruvi (RoomDO dagi kabi): salomlashuvdagi token -> taxallus, daraja, gildiya.
   * Berilmasa — hamma mehmon.
   */
  identify: ((token: string) => NetIdent | null) | null = null;
  private sockets = new Set<LoopSocket>();
  private reported = new Map<string, number>();

  constructor(private clock: () => number = () => performance.now()) {}

  room(code: string) {
    let r = this.rooms.get(code);
    if (!r) this.rooms.set(code, (r = new RealmRoom(code)));
    return r;
  }

  /** Barcha xonalarda bitta tick (Durable Object'dagi 20 Hz taymer o'rniga) */
  step() {
    for (const r of this.rooms.values()) {
      r.step();
      // DO kabi: o'yinchilar soni o'zgarsa lobbiga hisobot
      if (this.reported.get(r.code) !== r.size) {
        this.reported.set(r.code, r.size);
        this.lobby.report(Date.now(), r.code, r.size, 0);
      }
    }
  }

  /** Server "o'chdi": hamma ulanish uziladi */
  crash() {
    this.down = true;
    for (const s of this.sockets) s.drop();
  }

  deps(): NetDeps {
    return {
      join: async (code) => {
        if (this.down) throw new Error("server o'chiq");
        return this.lobby.assign(Date.now(), code);
      },
      open: (code) => {
        if (this.down) throw new Error("server o'chiq");
        const s = new LoopSocket(this, this.room(code));
        this.sockets.add(s);
        return s;
      },
      now: this.clock,
    };
  }

  /** @internal */
  later(fn: () => void) {
    setTimeout(fn, this.latency);
  }

  /** @internal */
  forget(s: LoopSocket) {
    this.sockets.delete(s);
  }

  /** @internal */
  now() {
    return this.clock() / 1000;
  }

  /** @internal salomlashuvdagi akkaunt tokeni */
  identOf(raw: string): NetIdent | null {
    if (!this.identify || !raw.includes('"acct"')) return null;
    try {
      const token = (JSON.parse(raw) as { acct?: unknown }).acct;
      return typeof token === "string" ? this.identify(token) : null;
    } catch {
      return null;
    }
  }
}

class LoopSocket implements SocketLike {
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  /** klient -> server va server -> klient yo'nalishlari ochiqmi */
  private up = true;
  private down = true;
  private id: string;
  private conn: RoomConn;

  constructor(
    private lb: Loopback,
    private room: RealmRoom,
  ) {
    this.id = room.newId();
    this.conn = {
      send: (s) => this.lb.later(() => this.down && this.onmessage?.({ data: s })),
      close: () => this.drop(),
    };
    lb.later(() => this.down && this.onopen?.({}));
  }

  send(data: string) {
    if (!this.up) return;
    this.lb.later(() => {
      if (!this.up) return;
      const ident = this.room.has(this.id) ? null : this.lb.identOf(data);
      this.room.receive(this.id, this.conn, data, this.lb.now(), ident);
    });
  }

  close() {
    this.down = false;
    if (!this.up) return;
    this.up = false;
    this.room.leave(this.id);
    this.lb.forget(this);
  }

  /** Server tomondan uzilish: yo'ldagi xabarlar yetib boradi, keyin onclose */
  drop() {
    if (!this.up) return;
    this.up = false;
    this.room.leave(this.id);
    this.lb.forget(this);
    this.lb.later(() => {
      if (!this.down) return;
      this.down = false;
      this.onclose?.({});
    });
  }
}
