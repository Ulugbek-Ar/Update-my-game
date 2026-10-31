/**
 * Olam xonasi — server mantig'i (haqiqat manbai). Platformadan mustaqil: Cloudflare Durable Object
 * (server/src/room-do.ts) ham, Node'dagi testlar ham shu klassni ishlatadi.
 *
 * Har bir o'yinchi WebSocket'idan kelgan xabar tekshiriladi (zod, hajm, tezlik), buyruqlar navbatga
 * tushadi va RealmSim tick'ida qo'llanadi. Har 2 tickda (10 Hz) har bir o'yinchiga faqat o'zgargan
 * narsa (delta) va uning yaqinidagi narsalar yuboriladi.
 */
import type { Hero } from "@/game/hero";
import { loadRealmData } from "../data";
import {
  RealmSim,
  type RealmCommand,
  type RealmEvent,
  type RealmPlayer,
  type RealmPlayerSave,
  type RealmWorldSave,
  type PlayerCommand,
} from "../sim";
import type { RealmMob } from "../mobs";
import type { RealmData } from "../schema";
import { TILE } from "../tiles";
import {
  ANIMS,
  AOI,
  MOB_STATES,
  NET_VERSION,
  PF_DASH,
  PF_GUARD,
  PF_HIDDEN,
  PF_VOW,
  ROOM_CAP,
  SNAPSHOT_EVERY,
  guestName,
  parseClientMsg,
  type ErrReason,
  type HelloMsg,
  type NetBolt,
  type NetItem,
  type NetMark,
  type NetMe,
  type NetMob,
  type NetPlayer,
  type ServerMsg,
  type SnapshotMsg,
} from "./protocol";

/** Ulanish (WebSocket yoki test uchun soxta) */
export interface RoomConn {
  send(msg: string): void;
  close(code: number, reason: string): void;
}

/** Tezlik cheklovi: chelakda shuncha xabar, sekundiga shuncha to'ladi */
export const RATE_BURST = 20;
export const RATE_PER_SEC = 12;
/** Shuncha jarima ballidan keyin ulanish uziladi (yaroqsiz xabar — 5 ball, ortiqcha — 1 ball) */
export const STRIKE_LIMIT = 40;
/** Bir o'yinchining navbatdagi buyruq to'plamlari (ortig'i tashlanadi) */
const QUEUE_MAX = 8;
/** Buyruq to'plami klient vaqtiga moslash uchun ko'pi bilan shuncha tick kutadi */
const MAX_HOLD = 3;
/** Chat: 1.5 soniyada bitta ibora */
const CHAT_GAP = 1.5;

/** Faqat egasiga yuboriladigan voqealar */
const PERSONAL = new Set<RealmEvent["type"]>([
  "pickup",
  "gold",
  "secret",
  "toast",
  "quest",
  "landmark",
  "respawn",
  "mobHurtPlayer",
]);

interface Baseline {
  players: Map<string, string>;
  mobs: Map<number, string>;
  items: Map<number, string>;
  bolts: string;
  marks: string;
  traps: string;
  smokes: string;
  ov: Map<number, number>;
  doors: string;
  me: string;
}

const newBaseline = (): Baseline => ({
  players: new Map(),
  mobs: new Map(),
  items: new Map(),
  bolts: "[]",
  marks: "[]",
  traps: "[]",
  smokes: "[]",
  ov: new Map(),
  doors: "[]",
  me: "",
});

interface Member {
  pid: string;
  name: string;
  hero: Hero;
  conn: RoomConn;
  tokens: number;
  tokensAt: number;
  strikes: number;
  chatAt: number;
  queue: { s: number; c: RealmCommand[] }[];
  /** oxirgi qo'llangan to'plam (klient tick) va u qo'llangan server tick */
  seq: number;
  seqTick: number;
  base: Baseline;
  events: RealmEvent[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface RoomOptions {
  data?: RealmData;
  world?: RealmWorldSave | null;
  /** o'yinchi id'si uchun (testda — barqaror) */
  rand?: () => number;
}

export class RealmRoom {
  readonly sim: RealmSim;
  readonly members = new Map<string, Member>();
  /** yangi o'yinchi qabul qilinmaydi (kunlik limitga yaqin) */
  busy = false;
  /** kiruvchi xabarlar soni (Cloudflare limiti: 20 xabar = 1 so'rov) */
  inbound = 0;
  private rand: () => number;

  constructor(
    public code: string,
    opts: RoomOptions = {},
  ) {
    this.sim = new RealmSim(opts.data ?? loadRealmData());
    if (opts.world) this.sim.loadWorld(opts.world);
    this.rand = opts.rand ?? Math.random;
  }

  get size() {
    return this.members.size;
  }

  has(connId: string) {
    return this.members.has(connId);
  }

  /** Ulanishdan kelgan xom xabar. connId — ulanish id'si (o'yinchi id'si ham shu). now — soniya. */
  receive(connId: string, conn: RoomConn, raw: unknown, now: number) {
    this.inbound++;
    const msg = parseClientMsg(raw);
    const m = this.members.get(connId);
    if (!m) {
      // birinchi xabar — salomlashuv; server qayta ishga tushgan bo'lsa klient qayta salomlashadi
      if (!msg) return this.reject(conn, "bad");
      if (msg.t !== "hello") return send(conn, { t: "rejoin" });
      const err = this.join(connId, conn, msg, now);
      if (err) this.reject(conn, err);
      return;
    }
    if (!this.allow(m, now)) return;
    if (!msg) return this.strike(m, 5, "bad");
    switch (msg.t) {
      case "hello":
        return; // takroriy salom
      case "ping":
        return send(conn, { t: "pong", id: msg.id });
      case "cmd":
        m.queue.push({ s: msg.s, c: msg.c });
        if (m.queue.length > QUEUE_MAX) m.queue.shift();
        return;
      case "chat":
        if (now - m.chatAt < CHAT_GAP) return;
        m.chatAt = now;
        return this.broadcast({ t: "chat", pid: m.pid, name: m.name, p: msg.p });
    }
  }

  /** Ulanish yopildi */
  leave(connId: string) {
    if (!this.members.delete(connId)) return;
    this.sim.removePlayer(connId);
  }

  /** Xonadagi o'yinchining hozirgi progressi (test va saqlash uchun) */
  savePlayer(connId: string): RealmPlayerSave | null {
    return this.sim.savePlayer(connId);
  }

  private reject(conn: RoomConn, reason: ErrReason) {
    send(conn, { t: "err", reason });
    conn.close(4000, reason);
  }

  private join(pid: string, conn: RoomConn, hello: HelloMsg, now: number): ErrReason | null {
    if (hello.v !== NET_VERSION) return "version";
    if (this.busy) return "busy";
    if (this.members.size >= ROOM_CAP) return "full";
    const save = hello.save ? this.sanitize(hello.save, hello.hero) : null;
    const host = hello.near ? this.members.values().next().value : undefined;
    const rp = this.sim.addPlayer(pid, hello.hero, save);
    rp.keys = [...new Set(hello.keys)];
    if (host) this.placeNear(rp, this.sim.players.get(host.pid));
    const m: Member = {
      pid,
      name: guestName(hello.tag),
      hero: hello.hero,
      conn,
      tokens: RATE_BURST,
      tokensAt: now,
      strikes: 0,
      chatAt: -1e9,
      queue: [],
      seq: 0,
      seqTick: this.sim.tick,
      base: newBaseline(),
      events: [],
    };
    this.members.set(pid, m);
    send(conn, {
      t: "welcome",
      pid,
      name: m.name,
      code: this.code,
      tick: this.sim.tick,
      n: this.members.size,
    });
    // birinchi holat darhol (to'liq: baseline bo'sh)
    this.snapshot(m);
    return null;
  }

  /** Klient progressi: noma'lum buyum va topshiriqlar tashlanadi, son va joy chegaralanadi. */
  private sanitize(s: NonNullable<HelloMsg["save"]>, hero: Hero): RealmPlayerSave {
    const d = this.sim.data;
    const W = this.sim.map.w * TILE,
      H = this.sim.map.h * TILE;
    const inv = s.inv.map((st) => {
      const def = st ? d.items[st.item] : undefined;
      return st && def ? { item: st.item, n: Math.min(st.n, def.stack) } : null;
    });
    const quests: RealmPlayerSave["quests"] = {};
    for (const [qid, q] of Object.entries(s.quests)) {
      const def = d.quests[qid];
      if (def) quests[qid] = { ...q, step: Math.min(q.step, def.steps.length) };
    }
    return {
      ...s,
      hero,
      x: Math.max(8, Math.min(W - 8, s.x)),
      y: Math.max(8, Math.min(H - 8, s.y)),
      inv,
      quests,
    };
  }

  /** Do'st yoniga: avval yon tomonlar (ismlar ustma-ust tushmasin), keyin atrofdagi bo'sh joy */
  private placeNear(rp: RealmPlayer, host: RealmPlayer | undefined) {
    if (!host) return;
    // sakkizdan bir aylana: o'ng, chap, pastki yonlar, past, yuqori yonlar, yuqori
    const dirs = [0, 4, 1, 3, 2, 7, 5, 6];
    for (const r of [48, 72, 96])
      for (const d of dirs) {
        const a = (d / 8) * Math.PI * 2;
        const x = host.p.x + Math.cos(a) * r,
          y = host.p.y + Math.sin(a) * r;
        if (this.sim.boxBlocked(x, y, rp.p.size)) continue;
        let taken = false;
        for (const o of this.sim.players.values())
          if (o !== rp && Math.abs(o.p.x - x) < 44 && Math.abs(o.p.y - y) < 24) taken = true;
        if (taken) continue;
        rp.p.x = rp.px = x;
        rp.p.y = rp.py = y;
        this.sim.explore(rp);
        return;
      }
  }

  /** Tezlik cheklovi (token bucket). false — xabar tashlandi. */
  private allow(m: Member, now: number) {
    m.tokens = Math.min(RATE_BURST, m.tokens + (now - m.tokensAt) * RATE_PER_SEC);
    m.tokensAt = now;
    if (m.tokens >= 1) {
      m.tokens -= 1;
      return true;
    }
    this.strike(m, 1, "rate");
    return false;
  }

  private strike(m: Member, n: number, reason: ErrReason) {
    m.strikes += n;
    if (m.strikes < STRIKE_LIMIT) return;
    this.reject(m.conn, reason);
    this.leave(m.pid);
  }

  private broadcast(msg: ServerMsg) {
    const s = JSON.stringify(msg);
    for (const m of this.members.values()) m.conn.send(s);
  }

  /**
   * Bitta qat'iy tick (1/20 s). Har o'yinchidan navbatdagi bitta buyruq to'plami qo'llanadi:
   * to'plamlar orasidagi klient tick'lari saqlanadi (tarmoq ikkitasini birga keltirsa ham
   * klient bashorati bilan bir xil bo'ladi), lekin ko'pi bilan MAX_HOLD tick kutiladi.
   */
  step() {
    const cmds: PlayerCommand[] = [];
    const tick = this.sim.tick + 1;
    for (const m of this.members.values()) {
      const b = m.queue[0];
      if (!b) continue;
      const wait = b.s - m.seq - (tick - m.seqTick);
      if (m.seq > 0 && wait > 0 && wait <= MAX_HOLD) continue;
      m.queue.shift();
      m.seq = b.s;
      m.seqTick = tick;
      for (const cmd of b.c) cmds.push({ pid: m.pid, cmd });
    }
    this.sim.step(cmds);
    for (const e of this.sim.events)
      for (const m of this.members.values()) if (this.wants(m, e)) m.events.push(e);
    // jarima ballari asta kamayadi
    if (this.sim.tick % 20 === 0)
      for (const m of this.members.values()) m.strikes = Math.max(0, m.strikes - 2);
    if (this.sim.tick % SNAPSHOT_EVERY === 0)
      for (const m of this.members.values()) this.snapshot(m);
  }

  private wants(m: Member, e: RealmEvent) {
    if (PERSONAL.has(e.type)) return "pid" in e && e.pid === m.pid;
    const me = this.sim.players.get(m.pid);
    if (!me || !("x" in e)) return true;
    return Math.abs(e.x - me.p.x) < AOI && Math.abs(e.y - me.p.y) < AOI;
  }

  /** Bir o'yinchiga delta holat yuborish */
  private snapshot(m: Member) {
    const sim = this.sim;
    const rp = sim.players.get(m.pid);
    if (!rp) return;
    const b = m.base;
    const near = (x: number, y: number) => Math.abs(x - rp.p.x) < AOI && Math.abs(y - rp.p.y) < AOI;
    const msg: SnapshotMsg = {
      t: "s",
      tick: sim.tick,
      ack: m.seq,
      at: sim.tick - m.seqTick,
      n: this.members.size,
    };

    // o'yinchilar (hammasi — xonada ko'pi bilan 8 ta)
    const players: NetPlayer[] = [];
    const seenP = new Set<string>();
    for (const o of sim.players.values()) {
      const mem = this.members.get(o.id);
      if (!mem) continue;
      seenP.add(o.id);
      const t = netPlayer(o, mem.name);
      const k = JSON.stringify(t);
      if (b.players.get(o.id) !== k) {
        b.players.set(o.id, k);
        players.push(t);
      }
    }
    const pr = [...b.players.keys()].filter((id) => !seenP.has(id));
    for (const id of pr) b.players.delete(id);
    if (players.length) msg.p = players;
    if (pr.length) msg.pr = pr;

    // moblar (yaqindagilari)
    const mobs: NetMob[] = [];
    const seenM = new Set<number>();
    for (const mob of sim.mobs) {
      if (!near(mob.x, mob.y)) continue;
      seenM.add(mob.id);
      const t = netMob(mob);
      const k = JSON.stringify(t);
      if (b.mobs.get(mob.id) !== k) {
        b.mobs.set(mob.id, k);
        mobs.push(t);
      }
    }
    const mr = [...b.mobs.keys()].filter((id) => !seenM.has(id));
    for (const id of mr) b.mobs.delete(id);
    if (mobs.length) msg.m = mobs;
    if (mr.length) msg.mr = mr;

    // yerdagi buyumlar
    const items: NetItem[] = [];
    const seenI = new Set<number>();
    for (const it of sim.items) {
      if (!near(it.x, it.y)) continue;
      seenI.add(it.id);
      const t: NetItem = [it.id, r1(it.x), r1(it.y), it.item, it.n, it.gold, it.t > 110 ? 1 : 0];
      const k = JSON.stringify(t);
      if (b.items.get(it.id) !== k) {
        b.items.set(it.id, k);
        items.push(t);
      }
    }
    const ir = [...b.items.keys()].filter((id) => !seenI.has(id));
    for (const id of ir) b.items.delete(id);
    if (items.length) msg.i = items;
    if (ir.length) msg.ir = ir;

    // o'qlar, belgilar, tuzoqlar, tutun — ro'yxat o'zgarsa to'liq
    const bolts: NetBolt[] = sim.projectiles
      .filter((p) => near(p.x, p.y))
      .map((p) => [
        r1(p.x),
        r1(p.y),
        r1(p.vx),
        r1(p.vy),
        p.size,
        p.wave ? 3 : p.bullet ? 2 : p.arrow ? 1 : 0,
      ]);
    const bk = JSON.stringify(bolts);
    if (bk !== b.bolts) {
      b.bolts = bk;
      msg.b = bolts;
    }
    const marks: NetMark[] = sim.marks
      .filter((k) => near(k.x, k.y))
      .map((k) => [
        k.kind === "line" ? 1 : 0,
        r1(k.x),
        r1(k.y),
        k.r,
        r2(k.dx),
        r2(k.dy),
        r1(k.len),
        r2(k.t),
        r2(k.total),
        k.owner,
        k.dmg ?? 0,
      ]);
    const kk = JSON.stringify(marks);
    if (kk !== b.marks) {
      b.marks = kk;
      msg.k = marks;
    }
    const traps = sim.traps.map((t) => [r1(t.x), r1(t.y)] as [number, number]);
    const tk = JSON.stringify(traps);
    if (tk !== b.traps) {
      b.traps = tk;
      msg.tr = traps;
    }
    // tutun: faqat soni/joyi o'zgarsa (qolgan vaqtini klient o'zi kamaytiradi)
    const smokes = sim.smokes.map(
      (s) => [r1(s.x), r1(s.y), r2(s.life)] as [number, number, number],
    );
    const sk = JSON.stringify(smokes.map((s) => [s[0], s[1]]));
    if (sk !== b.smokes) {
      b.smokes = sk;
      msg.sm = smokes;
    }

    // dunyo: buzilgan devorlar, ochilgan eshiklar
    const ov: [number, number][] = [];
    for (const [i, t] of sim.overrides)
      if (b.ov.get(i) !== t) {
        b.ov.set(i, t);
        ov.push([i, t]);
      }
    if (ov.length) msg.ov = ov;
    const doors = [...sim.doors];
    const dk = JSON.stringify(doors);
    if (dk !== b.doors) {
      b.doors = dk;
      msg.d = doors;
    }

    // shaxsiy: inventar, topshiriqlar, sirlar
    const me: NetMe = {
      gold: rp.gold,
      inv: rp.inv,
      quests: rp.quests,
      secrets: rp.secrets,
      fragments: rp.fragments,
      opened: rp.opened,
      torchStep: rp.torchStep,
      landmarks: rp.landmarks,
      kills: rp.kills,
      ui: rp.ui,
      starNight: rp.starNight,
    };
    const mk = JSON.stringify(me);
    if (mk !== b.me) {
      b.me = mk;
      msg.me = JSON.parse(mk) as NetMe;
    }

    if (m.events.length) {
      msg.ev = m.events;
      m.events = [];
    }
    m.conn.send(JSON.stringify(msg));
  }

  /** Yangi ulanish id'si */
  newId() {
    let s = "";
    for (let i = 0; i < 8; i++)
      s += "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(this.rand() * 31)];
    return s;
  }
}

function send(conn: RoomConn, msg: ServerMsg) {
  conn.send(JSON.stringify(msg));
}

/** Takrorlanuvchi animatsiya (turish, yurish) kadrini klient o'zi aylantiradi — har kadrda yuborilmaydi */
const loopFrame = (state: string, frame: number) =>
  state === "idle" || state === "walk" ? -1 : frame;

export function netPlayer(o: RealmPlayer, name: string): NetPlayer {
  const p = o.p;
  const flags =
    (p.dashing ? PF_DASH : 0) |
    (p.guarded ? PF_GUARD : 0) |
    (p.hidden ? PF_HIDDEN : 0) |
    (p.vowing ? PF_VOW : 0);
  return [
    o.id,
    o.hero,
    name,
    r1(p.x),
    r1(p.y),
    p.hp,
    p.maxHp,
    Math.sign(p.fx),
    Math.sign(p.fy),
    ANIMS.indexOf(p.anim.state),
    loopFrame(p.anim.state, p.anim.frame),
    flags,
    p.flash > 0 ? r2(p.flash) : 0,
  ];
}

export function netMob(m: RealmMob): NetMob {
  return [
    m.id,
    m.kind,
    r1(m.x),
    r1(m.y),
    m.hp,
    m.maxHp,
    MOB_STATES.indexOf(m.state),
    ANIMS.indexOf(m.anim.state),
    loopFrame(m.anim.state, m.anim.frame),
    m.face < 0 ? -1 : 1,
    r2(m.dirX),
    r2(m.dirY),
    m.flash > 0 ? r2(m.flash) : 0,
    // gangigan: 1, Paladin OSMON HUKMIdan — 2 (oltin yulduzchalar)
    m.stun > 0 ? (m.holy ? 2 : 1) : 0,
    m.spawnT > 0 ? r2(m.spawnT) : 0,
    m.target,
    m.phase,
  ];
}
