/**
 * Dala moblari va Xaroba Sardori: har birining o'z xatti-harakati, ko'rish radiusi (aggro) va
 * uydan uzoqlashsa qaytib ketish (leash). DOM'siz — RealmSim ichida qat'iy tick bilan yuradi.
 */
import { Animator, applyHit, type Body } from "@/game/animation";
import type { Player } from "@/game/player";
import type { MobKind } from "./schema";
import type { Rng } from "./rng";

export interface MobStats {
  hp: number;
  speed: number;
  size: number;
  /** shu masofada o'yinchini ko'rsa hujumga o'tadi */
  aggro: number;
  /** uyidan shundan uzoqlashsa — qaytib ketadi va joni tiklanadi */
  leash: number;
  heavy?: boolean;
  ghost?: boolean;
  name: string;
}

export const MOB_STATS: Record<MobKind, MobStats> = {
  boar: { hp: 5, speed: 42, size: 16, aggro: 90, leash: 170, name: "YOVVOYI TO'NG'IZ" },
  rat: { hp: 2, speed: 64, size: 10, aggro: 72, leash: 130, name: "BOTQOQ KALAMUSHI" },
  sentinel: {
    hp: 7,
    speed: 30,
    size: 16,
    aggro: 52,
    leash: 120,
    heavy: true,
    name: "XAROBA QO'RIQCHISI",
  },
  wisp: { hp: 2, speed: 40, size: 10, aggro: 110, leash: 220, ghost: true, name: "SARSON RUH" },
  warden: {
    hp: 40,
    speed: 40,
    size: 28,
    aggro: 120,
    leash: 230,
    heavy: true,
    name: "XAROBA SARDORI",
  },
};

/** To'ng'iz */
export const BOAR_PAW = 0.7;
export const BOAR_CHARGE_SPEED = 185;
export const BOAR_CHARGE_TIME = 0.8;
export const BOAR_STUN = 1.3;
/** Sentinel */
export const SENTINEL_WAKE = 0.6;
export const SENTINEL_WINDUP = 0.7;
export const SENTINEL_SLAM_R = 22;
/** Sarson ruh */
export const WISP_CHARGE = 0.8;
export const WISP_BURST_R = 26;
/** Xaroba Sardori */
export const WARDEN_SLAM = 0.9;
export const WARDEN_SLAM_R = 30;
export const WARDEN_CHARGE_WINDUP = 0.8;
export const WARDEN_CHARGE_SPEED = 210;
export const WARDEN_STUN = 1.6;
export const WARDEN_ROCKS = 1.1;
export const WARDEN_ROCK_R = 16;
/** 2-faza: hammasi shuncha tezroq */
export const WARDEN_RAGE = 0.7;

export type MobState =
  | "idle"
  | "wander"
  | "chase"
  | "windup"
  | "attack"
  | "recover"
  | "flee"
  | "return"
  | "dormant"
  | "wake"
  | "cast"
  | "fade";

/** Ogohlantiruvchi belgi (yerdagi doira yoki chiziq) — faqat chizish uchun. */
export interface Mark {
  kind: "circle" | "line";
  x: number;
  y: number;
  r: number;
  dx: number;
  dy: number;
  len: number;
  t: number;
  total: number;
  /** kim chiqardi (mob o'lsa belgisi o'chadi) */
  owner: number;
  /** > 0 bo'lsa — belgi tugaganda shu zarar beradi (tosh yomg'iri) */
  dmg?: number;
}

export type MobEvent =
  | { type: "mobHurtPlayer"; pid: string; x: number; y: number }
  | { type: "bonk"; x: number; y: number }
  | { type: "slam"; x: number; y: number; r: number }
  | { type: "burst"; x: number; y: number }
  | { type: "wake"; x: number; y: number; kind: MobKind }
  | { type: "evade"; x: number; y: number }
  | { type: "rage"; x: number; y: number }
  | { type: "roar"; x: number; y: number };

export interface MobTarget {
  id: string;
  p: Player;
}

export interface MobCtx {
  rng: Rng;
  dt: number;
  night: boolean;
  /** to'qnashuv bilan siljitish; true — devorga urildi */
  move(b: RealmMob, dx: number, dy: number): boolean;
  players: MobTarget[];
  mark(m: Mark): void;
  event(e: MobEvent): void;
}

export class RealmMob implements Body {
  x: number;
  y: number;
  /** oldingi tick holati (silliq chizish uchun) */
  px: number;
  py: number;
  size: number;
  vx = 0;
  vy = 0;
  hp: number;
  maxHp: number;
  flash = 0;
  heavy?: boolean;
  ghost?: boolean;
  stats: MobStats;
  state: MobState = "idle";
  /** joriy holat taymeri */
  t = 0;
  /** hujum qayta tiklanishi */
  cd = 0.5;
  stun = 0;
  dirX = 1;
  dirY = 0;
  /** chizishda yuz qaratgan tomoni */
  face = 1;
  target: string | null = null;
  wx = 0;
  wy = 0;
  deathT = 0;
  /** paydo bo'lish (0.5s xira) */
  spawnT = 0.5;
  /** Sardor: 1 yoki 2-faza; hujumlar hisoblagichi; tayyorlanayotgan hujum */
  phase = 1;
  atk = 0;
  move: "slam" | "charge" = "slam";
  /** shu hujumda allaqachon tekkan o'yinchilar */
  struck = new Set<string>();
  anim = new Animator({
    idle: { frames: 2, frameTime: 0.5, loop: true },
    walk: { frames: 4, frameTime: 0.14, loop: true },
    attack: { frames: 3, frameTime: 0.15, loop: false },
    hurt: { frames: 1, frameTime: 0.2, loop: false },
    death: { frames: 3, frameTime: 0.3, loop: false },
  });

  constructor(
    public id: number,
    public kind: MobKind,
    x: number,
    y: number,
    public zone: string,
    public homeX = x,
    public homeY = y,
  ) {
    this.x = this.px = x;
    this.y = this.py = y;
    this.stats = MOB_STATS[kind];
    this.size = this.stats.size;
    this.hp = this.maxHp = this.stats.hp;
    if (this.stats.heavy) this.heavy = true;
    if (this.stats.ghost) this.ghost = true;
    if (kind === "sentinel" || kind === "warden") this.state = "dormant";
  }

  get dead() {
    return this.anim.state === "death";
  }

  /** Qaytib ketayotgan mob zarar olmaydi (MMO "evade"). */
  get evading() {
    return this.state === "return";
  }

  get raging() {
    return this.kind === "warden" && this.phase === 2;
  }
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

function overlaps(m: RealmMob, p: Player, pad = 0) {
  const s = (m.size + p.size) / 2 + pad;
  return Math.abs(m.x - p.x) < s && Math.abs(m.y - p.y) < s;
}

function nearest(m: RealmMob, ctx: MobCtx) {
  let best: MobTarget | null = null,
    bd = Infinity;
  for (const t of ctx.players) {
    if (t.p.dead) continue;
    const d = dist(m, t.p);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best ? { t: best, d: bd } : null;
}

function hurt(m: RealmMob, t: MobTarget, dmg: number, force: number, ctx: MobCtx) {
  if (m.struck.has(t.id)) return false;
  if (!t.p.takeHit(dmg, m.x, m.y, force)) return false;
  m.struck.add(t.id);
  ctx.event({ type: "mobHurtPlayer", pid: t.id, x: t.p.x, y: t.p.y });
  return true;
}

function setState(m: RealmMob, s: MobState, t = 0) {
  m.state = s;
  m.t = t;
  m.struck.clear();
}

function walkToward(m: RealmMob, x: number, y: number, speed: number, ctx: MobCtx) {
  const dx = x - m.x,
    dy = y - m.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return true;
  const step = Math.min(d, speed * ctx.dt);
  if (Math.abs(dx) > 2) m.face = Math.sign(dx);
  const blocked = ctx.move(m, (dx / d) * step, (dy / d) * step);
  m.anim.set("walk");
  return blocked;
}

/** Mobga zarar: qaytib ketayotgan bo'lsa — "evade"; true — o'ldi. */
export function damageMob(
  m: RealmMob,
  dmg: number,
  fromX: number,
  fromY: number,
  knock: number,
  ctx: Pick<MobCtx, "event">,
) {
  if (m.dead) return false;
  if (m.evading) {
    ctx.event({ type: "evade", x: m.x, y: m.y });
    return false;
  }
  const busy = m.state === "windup" || m.state === "attack" || m.state === "cast";
  applyHit(m, dmg, fromX, fromY, knock);
  // tayyorgarlik paytidagi animatsiya buzilmasin (Sardor va to'ng'iz zarbadan to'xtamaydi)
  if (busy && !m.dead) m.anim.set(m.state === "windup" ? "attack" : "walk", true);
  if (m.dead) return true;
  if (m.kind === "rat") setState(m, "flee", 0.5);
  if ((m.kind === "sentinel" || m.kind === "warden") && m.state === "dormant") {
    setState(m, "wake", m.kind === "warden" ? 1 : SENTINEL_WAKE);
    ctx.event(
      m.kind === "warden"
        ? { type: "roar", x: m.x, y: m.y }
        : { type: "wake", x: m.x, y: m.y, kind: m.kind },
    );
  }
  if (m.kind === "warden" && m.phase === 1 && m.hp <= m.maxHp / 2) {
    m.phase = 2;
    ctx.event({ type: "rage", x: m.x, y: m.y });
  }
  return false;
}

/** Bitta tick: harakat, aggro/leash va turga xos xatti-harakat. */
export function updateMob(m: RealmMob, ctx: MobCtx) {
  const dt = ctx.dt;
  m.anim.update(dt);
  if (m.dead) {
    m.deathT += dt;
    return;
  }
  if (m.spawnT > 0) m.spawnT -= dt;
  if (m.flash > 0) m.flash -= dt;
  // zarbadan itarilish (devor bilan)
  if (m.vx || m.vy) {
    ctx.move(m, m.vx * dt, m.vy * dt);
    const k = Math.min(1, 10 * dt);
    m.vx -= m.vx * k;
    m.vy -= m.vy * k;
    if (Math.abs(m.vx) + Math.abs(m.vy) < 1) m.vx = m.vy = 0;
  }
  if (m.cd > 0) m.cd -= dt;
  if (m.stun > 0) {
    m.stun -= dt;
    if (m.anim.state !== "hurt") m.anim.set("idle");
    return;
  }
  // kunduzgi ruh so'nadi
  if (m.state === "fade") {
    m.t -= dt;
    if (m.t <= 0) m.anim.set("death", true);
    return;
  }
  if (m.kind === "wisp" && !ctx.night && m.state !== "windup") {
    setState(m, "fade", 0.6);
    return;
  }

  const home = { x: m.homeX, y: m.homeY };
  if (m.state === "return") {
    const blocked = walkToward(m, home.x, home.y, m.stats.speed * 1.7, ctx);
    // uyiga yetdi (yoki to'siqqa tirandi, lekin yaqin) — joni to'ladi
    if (dist(m, home) < 6 || (blocked && dist(m, home) < 24)) {
      m.hp = m.maxHp;
      m.phase = 1;
      setState(m, m.kind === "sentinel" || m.kind === "warden" ? "dormant" : "idle", 1);
      m.anim.set("idle");
    }
    return;
  }

  const near = nearest(m, ctx);
  const tgt = m.target ? ctx.players.find((t) => t.id === m.target && !t.p.dead) : undefined;
  // leash: uydan juda uzoq yoki nishon qochib ketdi — qaytib ketadi
  const busy = m.state === "windup" || m.state === "attack" || m.state === "cast";
  if (m.target && !busy) {
    if (!tgt || dist(m, home) > m.stats.leash || dist(m, tgt.p) > m.stats.aggro * 2.4) {
      m.target = null;
      setState(m, "return");
      return;
    }
  }
  if (!m.target && near && near.d < m.stats.aggro) {
    m.target = near.t.id;
    if (m.state === "dormant") {
      setState(m, "wake", m.kind === "warden" ? 1 : SENTINEL_WAKE);
      ctx.event(
        m.kind === "warden"
          ? { type: "roar", x: m.x, y: m.y }
          : { type: "wake", x: m.x, y: m.y, kind: m.kind },
      );
    } else if (m.state === "idle" || m.state === "wander") setState(m, "chase");
  }
  const target = m.target ? ctx.players.find((t) => t.id === m.target) : undefined;

  if (!target) return idle(m, ctx);
  switch (m.kind) {
    case "boar":
      return boar(m, target, ctx);
    case "rat":
      return rat(m, target, ctx);
    case "sentinel":
      return sentinel(m, target, ctx);
    case "wisp":
      return wisp(m, target, ctx);
    case "warden":
      return warden(m, target, ctx);
  }
}

function idle(m: RealmMob, ctx: MobCtx) {
  if (m.state === "dormant") {
    m.anim.set("idle");
    return;
  }
  if (m.kind === "wisp") {
    // havoda sekin suzadi
    m.t -= ctx.dt;
    if (m.t <= 0) {
      m.wx = m.homeX + ctx.rng.range(-40, 40);
      m.wy = m.homeY + ctx.rng.range(-40, 40);
      m.t = ctx.rng.range(2, 4);
    }
    walkToward(m, m.wx, m.wy, m.stats.speed * 0.4, ctx);
    return;
  }
  m.t -= ctx.dt;
  if (m.state === "wander") {
    if (walkToward(m, m.wx, m.wy, m.stats.speed * 0.5, ctx) || dist(m, { x: m.wx, y: m.wy }) < 2)
      setState(m, "idle", ctx.rng.range(1.5, 4));
    return;
  }
  m.anim.set("idle");
  m.state = "idle";
  if (m.t <= 0) {
    const a = ctx.rng.next() * Math.PI * 2,
      r = ctx.rng.range(10, 56);
    m.wx = m.homeX + Math.cos(a) * r;
    m.wy = m.homeY + Math.sin(a) * r;
    setState(m, "wander", 3);
  }
}

function aimAt(m: RealmMob, p: Player) {
  const dx = p.x - m.x,
    dy = p.y - m.y;
  const d = Math.hypot(dx, dy) || 1;
  m.dirX = dx / d;
  m.dirY = dy / d;
  if (Math.abs(dx) > 2) m.face = Math.sign(dx);
}

/** To'ng'iz: tuyog'ini yerga uradi (ogohlantirish), so'ng to'g'ri chiziqda tashlanadi; daraxtga urilsa — boshi aylanadi. */
function boar(m: RealmMob, t: MobTarget, ctx: MobCtx) {
  const d = dist(m, t.p);
  switch (m.state) {
    case "windup":
      m.t -= ctx.dt;
      m.anim.set("attack");
      if (m.t <= 0) setState(m, "attack", BOAR_CHARGE_TIME);
      return;
    case "attack": {
      m.t -= ctx.dt;
      m.anim.set("walk");
      const blocked = ctx.move(
        m,
        m.dirX * BOAR_CHARGE_SPEED * ctx.dt,
        m.dirY * BOAR_CHARGE_SPEED * ctx.dt,
      );
      if (overlaps(m, t.p)) hurt(m, t, 1, 230, ctx);
      if (blocked) {
        m.stun = BOAR_STUN;
        ctx.event({ type: "bonk", x: m.x + m.dirX * 8, y: m.y + m.dirY * 8 });
        setState(m, "chase");
        m.cd = 1.2;
      } else if (m.t <= 0) {
        setState(m, "recover", 0.6);
        m.cd = 1.2;
      }
      return;
    }
    case "recover":
      m.t -= ctx.dt;
      m.anim.set("idle");
      if (m.t <= 0) setState(m, "chase");
      return;
    default:
      if (m.cd <= 0 && d < 110) {
        aimAt(m, t.p);
        setState(m, "windup", BOAR_PAW);
        ctx.mark({
          kind: "line",
          x: m.x,
          y: m.y,
          r: m.size / 2,
          dx: m.dirX,
          dy: m.dirY,
          len: BOAR_CHARGE_SPEED * BOAR_CHARGE_TIME * 0.6,
          t: BOAR_PAW,
          total: BOAR_PAW,
          owner: m.id,
        });
        return;
      }
      m.state = "chase";
      if (d > 40) walkToward(m, t.p.x, t.p.y, m.stats.speed, ctx);
      else m.anim.set("idle");
  }
}

/** Botqoq kalamushi: sakrab-sakrab yaqinlashadi, tez tishlaydi, zarba yesa qochadi. */
function rat(m: RealmMob, t: MobTarget, ctx: MobCtx) {
  const d = dist(m, t.p);
  switch (m.state) {
    case "flee": {
      m.t -= ctx.dt;
      walkToward(m, m.x + (m.x - t.p.x), m.y + (m.y - t.p.y), m.stats.speed * 1.2, ctx);
      if (m.t <= 0) setState(m, "chase");
      return;
    }
    case "windup":
      m.t -= ctx.dt;
      m.anim.set("attack");
      if (m.t <= 0) setState(m, "attack", 0.14);
      return;
    case "attack":
      m.t -= ctx.dt;
      ctx.move(m, m.dirX * 150 * ctx.dt, m.dirY * 150 * ctx.dt);
      if (overlaps(m, t.p, 2)) hurt(m, t, 1, 150, ctx);
      if (m.t <= 0) {
        setState(m, "recover", 0.35);
        m.cd = 0.9;
      }
      return;
    case "recover":
      m.t -= ctx.dt;
      m.anim.set("idle");
      if (m.t <= 0) setState(m, "chase");
      return;
    default: {
      m.state = "chase";
      if (d < 22 && m.cd <= 0) {
        aimAt(m, t.p);
        setState(m, "windup", 0.25);
        return;
      }
      // sakrash: 0.3s yuguradi, 0.15s to'xtaydi
      m.t += ctx.dt;
      if (m.t % 0.45 < 0.3) walkToward(m, t.p.x, t.p.y, m.stats.speed, ctx);
      else m.anim.set("idle");
    }
  }
}

/** Xaroba qo'riqchisi: haykal bo'lib turadi, yaqinlashsa uyg'onadi; qo'llarini ko'tarib yerga uradi. */
function sentinel(m: RealmMob, t: MobTarget, ctx: MobCtx) {
  const d = dist(m, t.p);
  switch (m.state) {
    case "dormant":
    case "wake":
      m.t -= ctx.dt;
      m.anim.set("idle");
      if (m.state === "dormant") setState(m, "wake", SENTINEL_WAKE);
      else if (m.t <= 0) setState(m, "chase");
      return;
    case "windup":
      m.t -= ctx.dt;
      m.anim.set("attack");
      if (m.t <= 0) {
        const cx = m.x + m.dirX * 14,
          cy = m.y + m.dirY * 14;
        ctx.event({ type: "slam", x: cx, y: cy, r: SENTINEL_SLAM_R });
        for (const p of ctx.players)
          if (!p.p.dead && dist(p.p, { x: cx, y: cy }) < SENTINEL_SLAM_R + p.p.size / 2)
            hurt(m, p, 1, 220, ctx);
        setState(m, "recover", 0.8);
        m.cd = 1.6;
      }
      return;
    case "recover":
      m.t -= ctx.dt;
      m.anim.set("idle");
      if (m.t <= 0) setState(m, "chase");
      return;
    default:
      m.state = "chase";
      if (d < 30 && m.cd <= 0) {
        aimAt(m, t.p);
        setState(m, "windup", SENTINEL_WINDUP);
        ctx.mark({
          kind: "circle",
          x: m.x + m.dirX * 14,
          y: m.y + m.dirY * 14,
          r: SENTINEL_SLAM_R,
          dx: 0,
          dy: 0,
          len: 0,
          t: SENTINEL_WINDUP,
          total: SENTINEL_WINDUP,
          owner: m.id,
        });
        return;
      }
      if (d > 18) walkToward(m, t.p.x, t.p.y, m.stats.speed, ctx);
      else m.anim.set("idle");
  }
}

/** Sarson ruh (faqat tunda): to'lqinlanib uchadi, yaqinda yorqin chaqnab portlaydi. */
function wisp(m: RealmMob, t: MobTarget, ctx: MobCtx) {
  const d = dist(m, t.p);
  switch (m.state) {
    case "windup":
      m.t -= ctx.dt;
      m.anim.set("attack");
      if (m.t <= 0) {
        ctx.event({ type: "burst", x: m.x, y: m.y });
        for (const p of ctx.players)
          if (!p.p.dead && dist(p.p, m) < WISP_BURST_R + p.p.size / 2) hurt(m, p, 1, 160, ctx);
        setState(m, "recover", 1.2);
        m.cd = 2.5;
      }
      return;
    case "recover":
      m.t -= ctx.dt;
      walkToward(m, m.x + (m.x - t.p.x), m.y + (m.y - t.p.y), m.stats.speed * 0.8, ctx);
      if (m.t <= 0) setState(m, "chase");
      return;
    default: {
      m.state = "chase";
      if (d < 34 && m.cd <= 0) {
        setState(m, "windup", WISP_CHARGE);
        ctx.mark({
          kind: "circle",
          x: m.x,
          y: m.y,
          r: WISP_BURST_R,
          dx: 0,
          dy: 0,
          len: 0,
          t: WISP_CHARGE,
          total: WISP_CHARGE,
          owner: m.id,
        });
        return;
      }
      // to'lqinsimon yo'l
      m.t += ctx.dt;
      const s = Math.sin(m.t * 5) * 0.6;
      const dx = t.p.x - m.x,
        dy = t.p.y - m.y;
      const l = Math.hypot(dx, dy) || 1;
      walkToward(
        m,
        m.x + (dx / l) * 10 - (dy / l) * s * 10,
        m.y + (dy / l) * 10 + (dx / l) * s * 10,
        m.stats.speed,
        ctx,
      );
    }
  }
}

/**
 * Xaroba Sardori: yerga zarba (doira belgisi), hamla (chiziq belgisi, devorga urilsa — esankiraydi).
 * Jonining yarmida 2-faza: tezlashadi va tosh yomg'iri (bir nechta doira) qo'shiladi.
 */
function warden(m: RealmMob, t: MobTarget, ctx: MobCtx) {
  const k = m.raging ? WARDEN_RAGE : 1;
  const d = dist(m, t.p);
  if (m.state !== "attack" && m.state !== "windup" && m.state !== "cast" && m.state !== "dormant") {
    if (m.state !== "wake" && overlaps(m, t.p)) hurt(m, t, 1, 220, ctx);
  }
  switch (m.state) {
    case "dormant":
      setState(m, "wake", 1);
      ctx.event({ type: "roar", x: m.x, y: m.y });
      return;
    case "wake":
      m.t -= ctx.dt;
      m.anim.set("attack");
      if (m.t <= 0) setState(m, "chase");
      return;
    case "windup":
      m.t -= ctx.dt;
      m.anim.set("attack");
      if (m.t <= 0) {
        if (m.move === "charge") setState(m, "attack", 0.8);
        else {
          const cx = m.x + m.dirX * 24,
            cy = m.y + m.dirY * 24;
          ctx.event({ type: "slam", x: cx, y: cy, r: WARDEN_SLAM_R });
          for (const p of ctx.players)
            if (!p.p.dead && dist(p.p, { x: cx, y: cy }) < WARDEN_SLAM_R + p.p.size / 2)
              hurt(m, p, 2, 260, ctx);
          setState(m, "recover", 0.8 * k);
        }
      }
      return;
    case "attack": {
      m.t -= ctx.dt;
      m.anim.set("walk");
      const sp = WARDEN_CHARGE_SPEED * (m.raging ? 1.2 : 1);
      const blocked = ctx.move(m, m.dirX * sp * ctx.dt, m.dirY * sp * ctx.dt);
      for (const p of ctx.players) if (!p.p.dead && overlaps(m, p.p)) hurt(m, p, 1, 240, ctx);
      if (blocked) {
        m.stun = WARDEN_STUN;
        ctx.event({ type: "bonk", x: m.x + m.dirX * 14, y: m.y + m.dirY * 14 });
        setState(m, "recover", 0.3);
      } else if (m.t <= 0) setState(m, "recover", 0.7 * k);
      return;
    }
    case "cast":
      // tosh yomg'iri: zarar belgilar tugaganda RealmSim'da beriladi
      m.t -= ctx.dt;
      m.anim.set("attack");
      if (m.t <= 0) setState(m, "recover", 0.6);
      return;
    case "recover":
      m.t -= ctx.dt;
      m.anim.set("idle");
      if (m.t <= 0) {
        setState(m, "chase");
        m.cd = 0.9 * k;
      }
      return;
    default: {
      m.state = "chase";
      if (m.cd <= 0) {
        m.atk++;
        aimAt(m, t.p);
        if (m.raging && m.atk % 3 === 0) {
          // tosh yomg'iri: o'yinchi ostida va atrofida doiralar
          const spots = [{ x: t.p.x, y: t.p.y }];
          for (let i = 0; i < 3; i++)
            spots.push({ x: t.p.x + ctx.rng.range(-50, 50), y: t.p.y + ctx.rng.range(-50, 50) });
          for (const s of spots)
            ctx.mark({
              kind: "circle",
              x: s.x,
              y: s.y,
              r: WARDEN_ROCK_R,
              dx: 0,
              dy: 0,
              len: 0,
              t: WARDEN_ROCKS,
              total: WARDEN_ROCKS,
              owner: m.id,
              dmg: 1,
            });
          setState(m, "cast", WARDEN_ROCKS);
          return;
        }
        if (d > 64 || m.atk % 3 === 1) {
          setState(m, "windup", WARDEN_CHARGE_WINDUP * k);
          m.move = "charge";
          ctx.mark({
            kind: "line",
            x: m.x,
            y: m.y,
            r: 13,
            dx: m.dirX,
            dy: m.dirY,
            len: 150,
            t: WARDEN_CHARGE_WINDUP * k,
            total: WARDEN_CHARGE_WINDUP * k,
            owner: m.id,
          });
        } else {
          setState(m, "windup", WARDEN_SLAM * k);
          m.move = "slam";
          ctx.mark({
            kind: "circle",
            x: m.x + m.dirX * 24,
            y: m.y + m.dirY * 24,
            r: WARDEN_SLAM_R,
            dx: 0,
            dy: 0,
            len: 0,
            t: WARDEN_SLAM * k,
            total: WARDEN_SLAM * k,
            owner: m.id,
          });
        }
        return;
      }
      if (d > 22) walkToward(m, t.p.x, t.p.y, m.stats.speed * (m.raging ? 1.35 : 1), ctx);
      else m.anim.set("idle");
    }
  }
}
