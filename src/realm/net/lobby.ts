/**
 * Lobbi — xonalar ro'yxati va kunlik so'rovlar hisobi (server/src/lobby-do.ts ichida bitta nusxa).
 * Platformadan mustaqil: Node'da sinaladi.
 *
 * - Avtomatik kirish: bo'sh joyi bor ochiq xonaga (eng to'lig'iga), hammasi to'la bo'lsa — yangi xona.
 * - Kod bilan kirish: aynan shu xona (to'la bo'lsa — "full").
 * - Cloudflare bepul tarifi: kuniga 100 000 so'rov (WebSocket xabarlari 20:1). Limitga yaqinlashsa
 *   yangi ulanishlar muloyim rad etiladi ("busy"), o'ynab turganlar davom etadi.
 */
import { ROOM_CAP, makeRoomCode, type JoinReply } from "./protocol";

export const DAILY_LIMIT = 100_000;
/** Shu chegaradan keyin yangi ulanish qabul qilinmaydi (zaxira — o'ynayotganlar uchun) */
export const BUSY_AT = 90_000;
/** Shuncha vaqt hisobot bermagan xona ro'yxatdan o'chadi (xonalar har daqiqada hisobot beradi) */
export const STALE_MS = 5 * 60_000;

export interface RoomInfo {
  /** o'yinchilar (kirishga ruxsat berilgan, hali ulanmaganlar ham) */
  n: number;
  /** ochiq xona: avtomatik kirishda tanlanadi */
  pub: boolean;
  at: number;
}

export interface LobbyState {
  rooms: [string, RoomInfo][];
  day: string;
  used: number;
}

/** UTC sana: Cloudflare limitlari shu bo'yicha nollanadi */
export const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

export class Lobby {
  rooms = new Map<string, RoomInfo>();
  day = "";
  used = 0;

  constructor(private rand: () => number = Math.random) {}

  load(s: LobbyState | null | undefined) {
    if (!s) return;
    this.rooms = new Map(s.rooms);
    this.day = s.day;
    this.used = s.used;
  }

  save(): LobbyState {
    return { rooms: [...this.rooms], day: this.day, used: this.used };
  }

  /** Taxminiy so'rovlar soni (n — so'rov birligida) */
  count(now: number, n: number) {
    const d = utcDay(now);
    if (d !== this.day) {
      this.day = d;
      this.used = 0;
    }
    this.used += n;
  }

  busy(now: number) {
    this.count(now, 0);
    return this.used >= BUSY_AT;
  }

  private prune(now: number) {
    for (const [code, r] of this.rooms) if (now - r.at > STALE_MS) this.rooms.delete(code);
  }

  /** Kirish: kod berilsa — o'sha xona, aks holda bo'sh joyi bor ochiq xona yoki yangisi. */
  assign(now: number, code: string | null): JoinReply {
    // /join so'rovi + lobbi chaqiruvi
    this.count(now, 2);
    if (this.used >= BUSY_AT) return { ok: false, reason: "busy" };
    this.prune(now);
    if (code) {
      const r = this.rooms.get(code);
      if (r && r.n >= ROOM_CAP) return { ok: false, reason: "full" };
      if (r) {
        r.n++;
        r.at = now;
      } else this.rooms.set(code, { n: 1, pub: false, at: now });
      return { ok: true, code };
    }
    let best: [string, RoomInfo] | null = null;
    for (const e of this.rooms)
      if (e[1].pub && e[1].n < ROOM_CAP && (!best || e[1].n > best[1].n)) best = e;
    if (best) {
      best[1].n++;
      best[1].at = now;
      return { ok: true, code: best[0] };
    }
    let fresh = makeRoomCode(this.rand);
    while (this.rooms.has(fresh)) fresh = makeRoomCode(this.rand);
    this.rooms.set(fresh, { n: 1, pub: true, at: now });
    return { ok: true, code: fresh };
  }

  /** Xona hisoboti: haqiqiy o'yinchilar soni va shu orada sarflangan so'rovlar. */
  report(now: number, code: string, n: number, used: number) {
    this.count(now, used + 1);
    const r = this.rooms.get(code);
    if (n <= 0) this.rooms.delete(code);
    else if (r) {
      r.n = n;
      r.at = now;
    } else this.rooms.set(code, { n, pub: false, at: now });
    return { busy: this.used >= BUSY_AT };
  }

  stats(now: number) {
    this.prune(now);
    this.count(now, 0);
    let online = 0;
    for (const r of this.rooms.values()) online += r.n;
    return { rooms: this.rooms.size, online, used: Math.round(this.used), limit: DAILY_LIMIT };
  }
}
