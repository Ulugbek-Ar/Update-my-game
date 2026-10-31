/**
 * Onlayn olam ko'zgusi (klient): serverdan kelgan delta holatlar o'z RealmSim nusxasiga qo'yiladi.
 * Ko'zgu tick qilinmaydi — u chizish (va o'z qahramoni bashorati) uchun.
 *
 * Boshqa o'yinchilar va moblar INTERP_DELAY orqada, ikki server holati orasida interpolatsiya bilan
 * silliq ko'rsatiladi (ping 200 ms bo'lsa ham). O'z qahramoni — klient bashorati (predict.ts).
 */
import type { Hero } from "@/game/hero";
import type { Animator, AnimState } from "@/game/animation";
import { RealmPlayer, RealmSim, TICK_DT, type RealmEvent, type RealmPlayerSave } from "../sim";
import { RING_MAX, RING_SPEED, RealmMob, type Mark } from "../mobs";
import type { RealmData } from "../schema";
import {
  ANIMS,
  MOB_STATES,
  PF_DASH,
  PF_GUARD,
  PF_HIDDEN,
  PF_VOW,
  MARK_KINDS,
  type NetMe,
  type NetMob,
  type NetPlayer,
  type SnapshotMsg,
} from "./protocol";

/** Boshqa o'yinchi va moblar shuncha orqada ko'rsatiladi (2 holat oralig'i + tebranish zaxirasi) */
export const INTERP_DELAY = 0.15;
/** Bundan katta sakrash (teleport, qayta tug'ilish) silliqlanmaydi */
const JUMP = 64;

interface Sample<T> {
  t: number;
  d: T;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Delta'da kelmagan narsa — o'zgarmagan: oxirgi holat shu vaqtga takrorlanadi */
function extend<K, T>(map: Map<K, Sample<T>[]>, t: number, got: Set<K>) {
  for (const [k, list] of map) {
    if (got.has(k)) continue;
    const last = list[list.length - 1];
    if (last && last.t < t) list.push({ t, d: last.d });
  }
}

function push<K, T>(map: Map<K, Sample<T>[]>, k: K, t: number, d: T) {
  let list = map.get(k);
  if (!list) map.set(k, (list = []));
  list.push({ t, d });
  if (list.length > 40) list.shift();
}

/** Render vaqtidagi ikki holat va ular orasidagi ulush */
function at<T>(list: Sample<T>[], rt: number): { a: T; b: T; k: number } {
  // eski holatlar kerak emas (bittasi rt dan oldin qoladi)
  while (list.length > 2 && list[1]!.t <= rt) list.shift();
  const a = list[0]!;
  const b = list[1];
  if (!b || rt <= a.t) return { a: a.d, b: a.d, k: 0 };
  if (rt >= b.t) return { a: b.d, b: b.d, k: 0 };
  return { a: a.d, b: b.d, k: (rt - a.t) / (b.t - a.t) };
}

/** Takrorlanuvchi animatsiya (kadr -1) klientda aylanadi, qolganlari serverdan */
function setAnim(anim: Animator, state: AnimState, frame: number, dt: number) {
  if (frame < 0) {
    if (anim.state !== state) anim.set(state);
    anim.update(dt);
    return;
  }
  anim.state = state;
  anim.frame = frame;
}

export class RealmMirror {
  readonly sim: RealmSim;
  readonly me: RealmPlayer;
  /** o'yinchi ismlari (o'zi ham) */
  names = new Map<string, string>();
  /** xonadagi o'yinchilar soni */
  n = 1;
  /** o'zining server holati (oxirgi ma'lumi) */
  self: NetPlayer | null = null;
  /** oxirgi qo'llangan buyruq to'plami va undan beri o'tgan server tick'lari */
  ack = 0;
  at = 0;
  /** yangi holat keldi (klient bashoratni tuzatadi va false qiladi) */
  fresh = false;
  /** klient effekt va ovoz chiqaradigan voqealar (klient bo'shatadi) */
  events: RealmEvent[] = [];
  /** server vaqti - klient soati (s) */
  private offset: number | null = null;
  private players = new Map<string, Sample<NetPlayer>[]>();
  private mobs = new Map<number, Sample<NetMob>[]>();
  private mobById = new Map<number, RealmMob>();

  constructor(
    data: RealmData,
    public readonly pid: string,
    hero: Hero,
    save: RealmPlayerSave | null,
    tick: number,
  ) {
    this.sim = new RealmSim(data);
    // moblar va lut serverdan keladi
    this.sim.mobs = [];
    this.sim.tick = tick;
    this.me = this.sim.addPlayer(pid, hero, save);
  }

  /** Server holatini qabul qilish. now — klient soati (s). */
  apply(m: SnapshotMsg, now: number) {
    const sim = this.sim;
    const T = m.tick * TICK_DT;
    const est = T - now;
    if (this.offset === null || Math.abs(est - this.offset) > 0.5) this.offset = est;
    else this.offset += (est - this.offset) * 0.1;
    sim.tick = m.tick;
    this.n = m.n;
    this.ack = m.ack;
    this.at = m.at;
    this.fresh = true;

    const gotP = new Set<string>();
    for (const p of m.p ?? []) {
      this.names.set(p[0], p[2]);
      if (p[0] === this.pid) {
        this.self = p;
        continue;
      }
      gotP.add(p[0]);
      push(this.players, p[0], T, p);
    }
    for (const id of m.pr ?? []) {
      if (id === this.pid) continue;
      this.players.delete(id);
      this.names.delete(id);
      sim.removePlayer(id);
    }
    extend(this.players, T, gotP);

    const gotM = new Set<number>();
    for (const mob of m.m ?? []) {
      gotM.add(mob[0]);
      push(this.mobs, mob[0], T, mob);
    }
    for (const id of m.mr ?? []) {
      this.mobs.delete(id);
      this.mobById.delete(id);
    }
    if (m.mr?.length) sim.mobs = sim.mobs.filter((x) => this.mobById.has(x.id));
    extend(this.mobs, T, gotM);

    if (m.i || m.ir) {
      const items = new Map(sim.items.map((it) => [it.id, it]));
      for (const [id, x, y, item, n, gold, blink] of m.i ?? [])
        items.set(id, { id, x, y, item, n, gold, t: blink ? 111 : 1 });
      for (const id of m.ir ?? []) items.delete(id);
      sim.items = [...items.values()];
    }
    if (m.b)
      sim.projectiles = m.b.map(([x, y, vx, vy, size, kind]) => ({
        x,
        y,
        vx,
        vy,
        size,
        left: 1,
        hit: [],
        arrow: kind === 1,
        bullet: kind === 2,
        wave: kind === 3,
        owner: "",
        life: 1,
        hitSet: new Set<number>(),
      }));
    if (m.fb) sim.fireballs = m.fb.map(([x, y, vx, vy]) => ({ x, y, vx, vy, life: 1, owner: 0 }));
    if (m.k)
      sim.marks = m.k.map(([kind, x, y, r, dx, dy, len, t, total, owner, dmg]) => {
        const k: Mark = {
          kind: MARK_KINDS[kind] ?? "circle",
          x,
          y,
          r,
          dx,
          dy,
          len,
          t,
          total,
          owner,
        };
        if (dmg) k.dmg = dmg;
        return k;
      });
    if (m.tr) sim.traps = m.tr.map(([x, y]) => ({ x, y, life: 20 }));
    if (m.sm) sim.smokes = m.sm.map(([x, y, life]) => ({ x, y, life }));
    if (m.ov?.length) {
      for (const [i, t] of m.ov) sim.overrides.set(i, t);
      sim.mapVersion++;
    }
    if (m.d) sim.doors = new Set(m.d);
    if (m.rd) sim.raid?.applyNet(m.rd);
    if (m.me) this.applyMe(m.me);
    if (m.ev) {
      this.events.push(...m.ev);
      // to'lqin halqalari klientda o'zi kengayadi (zarar serverda)
      for (const e of m.ev)
        if (e.type === "ring") sim.rings.push({ x: e.x, y: e.y, r: 8, hit: new Set() });
    }
  }

  private applyMe(n: NetMe) {
    const me = this.me;
    me.gold = n.gold;
    me.inv = n.inv;
    me.quests = n.quests;
    me.secrets = n.secrets;
    me.fragments = n.fragments;
    me.opened = n.opened;
    me.torchStep = n.torchStep;
    me.landmarks = n.landmarks;
    me.kills = n.kills;
    me.ui = n.ui;
    me.starNight = n.starNight;
    me.titles = n.titles ?? [];
    // jon, zarar, tezlik va yorug'lik inventardan (serverdagi bilan bir xil hisob)
    this.sim.applyBonuses(me);
  }

  /** Har kadrda: boshqa o'yinchi va moblarni render vaqtiga qo'yish, mahalliy taymerlar. */
  update(now: number, dt: number) {
    const sim = this.sim;
    const rt = now + (this.offset ?? 0) - INTERP_DELAY;
    const tiles = sim.map.w * sim.map.h;
    for (const [id, list] of this.players) {
      const { a, b, k } = at(list, rt);
      let rp = sim.players.get(id);
      if (!rp || rp.hero !== a[1]) {
        rp = new RealmPlayer(id, a[1], a[3], a[4], tiles);
        sim.players.set(id, rp);
      }
      const p = rp.p;
      const far = Math.abs(b[3] - a[3]) > JUMP || Math.abs(b[4] - a[4]) > JUMP;
      p.x = rp.px = far ? (k < 0.5 ? a[3] : b[3]) : lerp(a[3], b[3], k);
      p.y = rp.py = far ? (k < 0.5 ? a[4] : b[4]) : lerp(a[4], b[4], k);
      p.hp = a[5];
      p.maxHp = a[6];
      p.fx = a[7];
      p.fy = a[8];
      setAnim(p.anim, ANIMS[a[9]] ?? "idle", a[10], dt);
      p.dashTimer = a[11] & PF_DASH ? 1 : 0;
      p.guardAge = a[11] & PF_GUARD ? 0 : -1;
      p.hideT = a[11] & PF_HIDDEN ? 1 : 0;
      p.vowT = a[11] & PF_VOW ? 1 : 0;
      p.flash = a[12];
      rp.titles = a[13] ? [a[13]] : [];
    }
    for (const [id, list] of this.mobs) {
      const { a, b, k } = at(list, rt);
      let mob = this.mobById.get(id);
      if (!mob) {
        mob = new RealmMob(id, a[1], a[2], a[3], "");
        this.mobById.set(id, mob);
        sim.mobs.push(mob);
      }
      const far = Math.abs(b[2] - a[2]) > JUMP || Math.abs(b[3] - a[3]) > JUMP;
      mob.x = mob.px = far ? (k < 0.5 ? a[2] : b[2]) : lerp(a[2], b[2], k);
      mob.y = mob.py = far ? (k < 0.5 ? a[3] : b[3]) : lerp(a[3], b[3], k);
      mob.hp = a[4];
      mob.maxHp = a[5];
      mob.state = MOB_STATES[a[6]] ?? "idle";
      setAnim(mob.anim, ANIMS[a[7]] ?? "idle", a[8], dt);
      mob.face = a[9];
      mob.dirX = a[10];
      mob.dirY = a[11];
      mob.flash = a[12];
      mob.stun = a[13];
      mob.holy = a[13] === 2;
      mob.spawnT = a[14];
      mob.target = a[15];
      mob.phase = a[16];
    }
    // o'qlar o'z tezligida uchadi, tutun va ogohlantirishlar o'z vaqtida so'nadi
    for (const b of sim.projectiles) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    for (const f of sim.fireballs) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
    }
    for (const s of sim.smokes) s.life -= dt;
    sim.smokes = sim.smokes.filter((s) => s.life > 0);
    for (const k of sim.marks) k.t = Math.max(0, k.t - dt);
    for (const g of sim.rings) g.r += RING_SPEED * dt;
    sim.rings = sim.rings.filter((g) => g.r < RING_MAX);
  }
}
