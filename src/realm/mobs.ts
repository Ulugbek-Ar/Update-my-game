/**
 * Dala moblari va Xaroba Sardori: har birining o'z xatti-harakati, ko'rish radiusi (aggro) va
 * uydan uzoqlashsa qaytib ketish (leash). DOM'siz — RealmSim ichida qat'iy tick bilan yuradi.
 */
import { Animator, applyHit, type Body } from "@/game/animation";
import { phaseFor } from "@/game/bossPower";
import type { Player } from "@/game/player";
import { AGGRO_THREAT, ThreatTable } from "@/game/threat";
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
  // Kul tog'i
  ashhound: { hp: 3, speed: 72, size: 14, aggro: 96, leash: 210, name: "KUL ITI" },
  lavaworm: {
    hp: 4,
    speed: 0,
    size: 14,
    aggro: 110,
    leash: 200,
    heavy: true,
    name: "LAVA QURTI",
  },
  obsguard: {
    hp: 10,
    speed: 26,
    size: 18,
    aggro: 60,
    leash: 140,
    heavy: true,
    name: "OBSIDIAN QO'RIQCHI",
  },
};

/** Kul iti: to'da bo'lib yuguradi, yerga cho'kib (ogohlantirish) qisqa tashlanadi */
export const HOUND_WINDUP = 0.45;
export const HOUND_LUNGE_SPEED = 190;
export const HOUND_LUNGE_TIME = 0.28;
/** Bir it nishonni ko'rsa, shu masofadagi to'dasi ham hujumga o'tadi */
export const HOUND_PACK_R = 150;
/** Lava qurti: chiqishdan oldin yer yoriladi; yer ustida turib olov sharlari otadi */
export const WORM_WARN = 0.9;
export const WORM_ERUPT_R = 14;
export const WORM_UP = 2.6;
export const WORM_SPIT_EVERY = 0.85;
export const WORM_BURROW = 0.5;
export const FIREBALL_SPEED = 115;
export const FIREBALL_LIFE = 1.8;
export const FIREBALL_R = 4;
/** Obsidian qo'riqchi: sekin, oldidan qalqon, zarbasi 2 yurak */
export const GUARD_WAKE = 0.8;
export const GUARD_WINDUP = 0.9;
export const GUARD_SMASH_R = 22;
export const GUARD_DMG = 2;
export const GUARD_TURN = 1.6;

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
/** 2-fazadan: hammasi shuncha tezroq */
export const WARDEN_RAGE = 0.7;
/** Qalqon: oldidan (±60°) kelgan zarbani to'sadi; o'yinchi tomon shu tezlikda (rad/s) buriladi */
export const WARDEN_SHIELD_ARC = Math.PI / 3;
export const WARDEN_TURN = 2.2;
/** 2-fazadan: urib-tushirishdan keyin yer bo'ylab tarqaladigan to'lqin halqasi (ustidan dash bilan) */
export const RING_SPEED = 95;
export const RING_MAX = 140;
export const RING_W = 6;
/** 3-faza: uyg'otadigan tosh qo'riqchilar soni */
export const WARDEN_GUARDS = 2;
/** Onlayn: har qo'shimcha o'yinchi uchun Sardor joni +70% */
export const PARTY_HP = 0.7;
/** Jangga qo'shilgan hisoblanadigan masofa */
export const PARTY_RANGE = 260;

/** n o'yinchiga Sardor joni: asosiy × (1 + 0.7 × (n − 1)). */
export function wardenHp(n: number) {
  return Math.round(MOB_STATS.warden.hp * (1 + PARTY_HP * (Math.max(1, n) - 1)));
}

/** Yer bo'ylab tarqalayotgan to'lqin halqasi. */
export interface Ring {
  x: number;
  y: number;
  r: number;
  /** allaqachon tekkan o'yinchilar */
  hit: Set<string>;
}

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

/** Ogohlantiruvchi belgi (yerdagi doira, chiziq yoki lava qurti chiqadigan yoriq) — faqat chizish uchun. */
export interface Mark {
  kind: "circle" | "line" | "crack";
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
  /** egasiga nisbatan joyi (RealmSim to'ldiradi: belgi mob bilan birga siljiydi) */
  ox?: number;
  oy?: number;
}

export type MobEvent =
  | { type: "mobHurtPlayer"; pid: string; x: number; y: number }
  | { type: "bonk"; x: number; y: number }
  | { type: "slam"; x: number; y: number; r: number }
  | { type: "burst"; x: number; y: number }
  | { type: "wake"; x: number; y: number; kind: MobKind }
  | { type: "evade"; x: number; y: number }
  | { type: "rage"; x: number; y: number; phase?: number }
  | { type: "roar"; x: number; y: number }
  | { type: "block"; x: number; y: number }
  | { type: "ring"; x: number; y: number }
  /** Lava qurti yerdan otilib chiqdi */
  | { type: "erupt"; x: number; y: number }
  /** olov shari tegdi */
  | { type: "fire"; x: number; y: number }
  /** Kul iti to'dasini chaqirdi (uvladi) */
  | { type: "howl"; x: number; y: number };

export interface MobTarget {
  id: string;
  p: Player;
  /** Mergan tutunda yashiringan: mob uni ko'rmaydi (nishonni yo'qotadi), lekin tegsa zarar beradi */
  hidden?: boolean;
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
  /** Sardor: to'lqin halqasi va tosh qo'riqchilarni uyg'otish (RealmSim beradi) */
  ring?(x: number, y: number): void;
  summon?(kind: MobKind, x: number, y: number, from: RealmMob): void;
  /** Lava qurti: olov shari (RealmSim beradi) */
  shoot?(x: number, y: number, vx: number, vy: number, owner: number): void;
  /** Kul iti: to'dasidagilarni shu nishonga chaqiradi */
  alert?(m: RealmMob, target: string): void;
  /** shu joyda mob turishi mumkinmi (devor emas) */
  free?(x: number, y: number, size: number): boolean;
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
  /** Sardor: 1, 2 yoki 3-faza; hujumlar hisoblagichi; tayyorlanayotgan hujum */
  phase = 1;
  /** Sardor: jon hisoblangan o'yinchilar soni (onlayn); 3-fazada qo'riqchilar chaqirilishi kerak */
  party = 1;
  guardsDue = false;
  /** Sardorga zarar bergan o'yinchilar — lut har biriga alohida */
  hitters = new Set<string>();
  atk = 0;
  move: "slam" | "charge" = "slam";
  /** shu hujumda allaqachon tekkan o'yinchilar */
  struck = new Set<string>();
  /** Xavf jadvali: kim ko'proq zarar bersa (Paladin — 2x) yoki QASAM qilsa — nishon o'sha */
  threat = new ThreatTable();
  /** Paladin OSMON HUKMIdan gangigan: yulduzchalar oq-oltin (faqat chizish uchun) */
  holy = false;
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
    if (kind === "sentinel" || kind === "warden" || kind === "obsguard" || kind === "lavaworm")
      this.state = "dormant";
  }

  get dead() {
    return this.anim.state === "death";
  }

  /** Lava qurti yer ostida: ko'rinmaydi, unga zarba va o'q tegmaydi (faqat yer ustida uriladi) */
  get under() {
    return (
      this.kind === "lavaworm" && !this.dead && this.state !== "cast" && this.state !== "recover"
    );
  }

  /** Haykal bo'lib uxlaydigan qo'riqchilar */
  get statue() {
    return this.kind === "sentinel" || this.kind === "warden" || this.kind === "obsguard";
  }

  /** Qaytib ketayotgan mob zarar olmaydi (MMO "evade"). */
  get evading() {
    return this.state === "return";
  }

  get raging() {
    return this.kind === "warden" && this.phase >= 2;
  }

  /**
   * Qalqon ko'tarilgan (Sardor va Obsidian qo'riqchi): uyquda, uyg'onayotganda, zarbadan/hamladan
   * keyin va esankiraganda tushadi
   */
  get shieldUp() {
    if ((this.kind !== "warden" && this.kind !== "obsguard") || this.dead || this.stun > 0)
      return false;
    return !["dormant", "wake", "recover", "return"].includes(this.state);
  }

  /** Qalqon (fromX, fromY) tomondan kelgan zarbani to'sadimi (oldidan ±60°). */
  blocks(fromX: number, fromY: number) {
    if (!this.shieldUp) return false;
    const dx = fromX - this.x,
      dy = fromY - this.y;
    const l = Math.hypot(dx, dy) || 1;
    return (dx * this.dirX + dy * this.dirY) / l >= Math.cos(WARDEN_SHIELD_ARC);
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
    if (t.p.dead || t.hidden) continue;
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
  if (m.blocks(fromX, fromY)) {
    // qalqon to'sdi — orqasiga o'tish kerak
    ctx.event({ type: "block", x: m.x + m.dirX * 14, y: m.y + m.dirY * 14 });
    m.flash = 0.08;
    return false;
  }
  const busy = m.state === "windup" || m.state === "attack" || m.state === "cast";
  applyHit(m, dmg, fromX, fromY, knock);
  // tayyorgarlik paytidagi animatsiya buzilmasin (Sardor va to'ng'iz zarbadan to'xtamaydi)
  if (busy && !m.dead) m.anim.set(m.state === "windup" ? "attack" : "walk", true);
  if (m.dead) return true;
  if (m.kind === "rat") setState(m, "flee", 0.5);
  if (m.statue && m.state === "dormant") {
    setState(
      m,
      "wake",
      m.kind === "warden" ? 1 : m.kind === "obsguard" ? GUARD_WAKE : SENTINEL_WAKE,
    );
    ctx.event(
      m.kind === "warden"
        ? { type: "roar", x: m.x, y: m.y }
        : { type: "wake", x: m.x, y: m.y, kind: m.kind },
    );
  }
  if (m.kind === "warden") {
    const ph = phaseFor(m.hp, m.maxHp);
    if (ph > m.phase) {
      m.phase = ph;
      if (ph === 3) m.guardsDue = true;
      ctx.event({ type: "rage", x: m.x, y: m.y, phase: ph });
    }
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
  m.holy = false;
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
  if (m.state === "return" && m.kind === "lavaworm") {
    // qurt yer ostidan uyiga qaytadi: joni to'ladi, yana poylab yotadi
    m.x = m.px = home.x;
    m.y = m.py = home.y;
    m.hp = m.maxHp;
    setState(m, "dormant", 1);
    m.anim.set("idle");
    return;
  }
  if (m.state === "return") {
    const blocked = walkToward(m, home.x, home.y, m.stats.speed * 1.7, ctx);
    // uyiga yetdi (yoki to'siqqa tirandi, lekin yaqin) — joni to'ladi
    if (dist(m, home) < 6 || (blocked && dist(m, home) < 24)) {
      if (m.kind === "warden") {
        m.maxHp = MOB_STATS.warden.hp;
        m.party = 1;
        m.guardsDue = false;
        m.hitters.clear();
      }
      m.hp = m.maxHp;
      m.phase = 1;
      setState(m, m.statue ? "dormant" : "idle", 1);
      m.anim.set("idle");
    }
    return;
  }

  const near = nearest(m, ctx);
  const busy = m.state === "windup" || m.state === "attack" || m.state === "cast";
  // xavf: QASAM qilgan yoki eng ko'p xavf tug'dirgan o'yinchiga o'tadi (hujum o'rtasida emas)
  m.threat.update(dt);
  if (m.target && !busy) {
    const reach = m.stats.aggro * 2.4;
    const cands = ctx.players.filter((t) => !t.p.dead && !t.hidden && dist(m, t.p) <= reach);
    const best = m.threat.pick(cands, m.target);
    if (best) m.target = best.id;
  }
  const tgt = m.target
    ? ctx.players.find((t) => t.id === m.target && !t.p.dead && !t.hidden)
    : undefined;
  // leash: uydan juda uzoq yoki nishon qochib ketdi — qaytib ketadi
  if (m.target && !busy) {
    if (!tgt || dist(m, home) > m.stats.leash || dist(m, tgt.p) > m.stats.aggro * 2.4) {
      m.target = null;
      m.threat.clear();
      setState(m, "return");
      return;
    }
  }
  if (!m.target && near && near.d < m.stats.aggro) {
    m.target = near.t.id;
    m.threat.add(near.t.id, AGGRO_THREAT, near.t.p.hero);
    if (m.state === "dormant" && m.kind === "lavaworm") {
      // yer ostida o'ljaga suzib boradi
      setState(m, "chase", 0.3);
    } else if (m.state === "dormant") {
      setState(
        m,
        "wake",
        m.kind === "warden" ? 1 : m.kind === "obsguard" ? GUARD_WAKE : SENTINEL_WAKE,
      );
      ctx.event(
        m.kind === "warden"
          ? { type: "roar", x: m.x, y: m.y }
          : { type: "wake", x: m.x, y: m.y, kind: m.kind },
      );
    } else if (m.state === "idle" || m.state === "wander") setState(m, "chase");
    // kul iti uvlaydi — to'dasi ham yuguradi
    if (m.kind === "ashhound" && ctx.alert) {
      ctx.alert(m, near.t.id);
      ctx.event({ type: "howl", x: m.x, y: m.y });
    }
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
    case "ashhound":
      return hound(m, target, ctx);
    case "lavaworm":
      return worm(m, target, ctx);
    case "obsguard":
      return guard(m, target, ctx);
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
      ctx.move(m, m.dirX * 120 * ctx.dt, m.dirY * 120 * ctx.dt);
      if (overlaps(m, t.p, 2)) hurt(m, t, 1, 150, ctx);
      if (m.t <= 0) {
        setState(m, "recover", 0.4);
        m.cd = 0.9;
      }
      return;
    case "recover":
      // tishlab, orqaga sakrab chiqadi (tishla-va-qoch)
      m.t -= ctx.dt;
      walkToward(m, m.x + (m.x - t.p.x), m.y + (m.y - t.p.y), m.stats.speed, ctx);
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
  partyScale(m, ctx);
  if (m.guardsDue && ctx.summon) {
    // 3-faza: ikki yonida tosh qo'riqchilar uyg'onadi
    m.guardsDue = false;
    for (let i = 0; i < WARDEN_GUARDS; i++) {
      const a = Math.atan2(m.dirY, m.dirX) + (i ? 1 : -1) * 1.9;
      ctx.summon("sentinel", m.x + Math.cos(a) * 34, m.y + Math.sin(a) * 34, m);
    }
  }
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
          // 2-fazadan: zarbadan yer bo'ylab to'lqin halqasi tarqaladi
          if (m.phase >= 2) {
            ctx.ring?.(cx, cy);
            ctx.event({ type: "ring", x: cx, y: cy });
          }
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
      turnToward(m, t.p, ctx.dt);
      if (d > 22) walkToward(m, t.p.x, t.p.y, m.stats.speed * (m.raging ? 1.35 : 1), ctx);
      else m.anim.set("idle");
    }
  }
}

/** Qalqon (dirX/dirY) o'yinchi tomon asta buriladi — tez aylanib orqasiga o'tish mumkin. */
function turnToward(m: RealmMob, p: Player, dt: number, rate = WARDEN_TURN) {
  const want = Math.atan2(p.y - m.y, p.x - m.x);
  const cur = Math.atan2(m.dirY, m.dirX);
  let diff = want - cur;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const a = cur + Math.sign(diff) * Math.min(Math.abs(diff), rate * dt);
  m.dirX = Math.cos(a);
  m.dirY = Math.sin(a);
}

/** Onlayn: jangga yangi o'yinchi qo'shilsa Sardor joni oshadi (jon ulushi saqlanadi, kamaymaydi). */
function partyScale(m: RealmMob, ctx: MobCtx) {
  let n = 0;
  for (const t of ctx.players) if (!t.p.dead && dist(m, t.p) < PARTY_RANGE) n++;
  if (n <= m.party) return;
  const k = m.hp / m.maxHp;
  m.party = n;
  m.maxHp = wardenHp(n);
  m.hp = Math.max(1, Math.round(m.maxHp * k));
}

/**
 * Kul iti: to'da bo'lib yuguradi — har biri nishon atrofida o'z tomonidan (id bo'yicha) yaqinlashadi,
 * yerga cho'kib (chiziq belgisi) qisqa tashlanadi va tishlab, orqaga sakraydi.
 */
function hound(m: RealmMob, t: MobTarget, ctx: MobCtx) {
  const d = dist(m, t.p);
  switch (m.state) {
    case "windup":
      m.t -= ctx.dt;
      m.anim.set("attack");
      if (m.t <= 0) setState(m, "attack", HOUND_LUNGE_TIME);
      return;
    case "attack": {
      m.t -= ctx.dt;
      m.anim.set("walk");
      const blocked = ctx.move(
        m,
        m.dirX * HOUND_LUNGE_SPEED * ctx.dt,
        m.dirY * HOUND_LUNGE_SPEED * ctx.dt,
      );
      if (overlaps(m, t.p, 1)) hurt(m, t, 1, 170, ctx);
      if (blocked || m.t <= 0) {
        setState(m, "recover", 0.55);
        m.cd = 1.1 + (m.id % 3) * 0.2;
      }
      return;
    }
    case "recover": {
      // tishlab, chetga sakraydi: nishon atrofida aylanadi
      m.t -= ctx.dt;
      const a = Math.atan2(m.y - t.p.y, m.x - t.p.x) + (m.id % 2 ? 0.9 : -0.9);
      walkToward(m, t.p.x + Math.cos(a) * 40, t.p.y + Math.sin(a) * 40, m.stats.speed, ctx);
      if (m.t <= 0) setState(m, "chase");
      return;
    }
    default: {
      m.state = "chase";
      if (d < 46 && m.cd <= 0) {
        aimAt(m, t.p);
        setState(m, "windup", HOUND_WINDUP);
        ctx.mark({
          kind: "line",
          x: m.x,
          y: m.y,
          r: m.size / 2,
          dx: m.dirX,
          dy: m.dirY,
          len: HOUND_LUNGE_SPEED * HOUND_LUNGE_TIME,
          t: HOUND_WINDUP,
          total: HOUND_WINDUP,
          owner: m.id,
        });
        return;
      }
      // to'da: har it nishonning o'z tomoniga (chap, o'ng, orqa) intiladi — o'rab oladi
      const side = ((m.id % 3) - 1) * 1.1;
      const a = Math.atan2(m.y - t.p.y, m.x - t.p.x) + side * 0.5;
      const ring = d > 70 ? 0 : 30;
      walkToward(m, t.p.x + Math.cos(a) * ring, t.p.y + Math.sin(a) * ring, m.stats.speed, ctx);
    }
  }
}

/**
 * Lava qurti: yer ostida o'ljaga suzib boradi (ko'rinmaydi), nishon oyog'i ostida yer yoriladi
 * (yoriq belgisi), so'ng otilib chiqadi — ustida turgan kuyadi. Yer ustida olov sharlarini otadi,
 * keyin yana yerga kiradi. Faqat yer ustidaligida uriladi.
 */
function worm(m: RealmMob, t: MobTarget, ctx: MobCtx) {
  switch (m.state) {
    case "chase": {
      m.t -= ctx.dt;
      m.anim.set("idle");
      if (m.t > 0) return;
      // chiqish joyi: nishon oyog'i ostida yoki yonida (devor bo'lmasa)
      let x = t.p.x,
        y = t.p.y;
      const a = ctx.rng.next() * Math.PI * 2,
        r = ctx.rng.range(0, 10);
      const nx = x + Math.cos(a) * r,
        ny = y + Math.sin(a) * r;
      if (!ctx.free || ctx.free(nx, ny, m.size)) {
        x = nx;
        y = ny;
      }
      if (ctx.free && !ctx.free(x, y, m.size)) {
        x = t.p.x;
        y = t.p.y;
      }
      m.x = m.px = x;
      m.y = m.py = y;
      aimAt(m, t.p);
      setState(m, "windup", WORM_WARN);
      ctx.mark({
        kind: "crack",
        x,
        y,
        r: WORM_ERUPT_R,
        dx: 0,
        dy: 0,
        len: 0,
        t: WORM_WARN,
        total: WORM_WARN,
        owner: m.id,
      });
      return;
    }
    case "windup":
      m.t -= ctx.dt;
      if (m.t <= 0) {
        // otilib chiqadi: ustida turganlar kuyadi va itariladi
        ctx.event({ type: "erupt", x: m.x, y: m.y });
        for (const p of ctx.players)
          if (!p.p.dead && dist(p.p, m) < WORM_ERUPT_R + p.p.size / 2) hurt(m, p, 1, 200, ctx);
        setState(m, "cast", WORM_UP);
        m.spawnT = 0;
        m.cd = 0.5;
        m.anim.set("attack", true);
      }
      return;
    case "cast":
      m.t -= ctx.dt;
      aimAt(m, t.p);
      if (m.cd <= 0 && m.t > 0.35) {
        ctx.shoot?.(
          m.x + m.dirX * 6,
          m.y - 6 + m.dirY * 6,
          m.dirX * FIREBALL_SPEED,
          m.dirY * FIREBALL_SPEED,
          m.id,
        );
        m.anim.set("attack", true);
        m.cd = WORM_SPIT_EVERY;
      } else if (m.anim.done || (m.anim.state !== "attack" && m.anim.state !== "hurt"))
        m.anim.set("idle");
      if (m.t <= 0) setState(m, "recover", WORM_BURROW);
      return;
    case "recover":
      // yerga kirib ketmoqda (shu payt hali uriladi)
      m.t -= ctx.dt;
      m.anim.set("walk");
      if (m.t <= 0) setState(m, "chase", ctx.rng.range(0.9, 1.5));
      return;
    default:
      setState(m, "chase", 0.3);
  }
}

/**
 * Obsidian qo'riqchi: haykal bo'lib turadi, yaqinlashsa uyg'onadi. Sekin yuradi, oldidan qalqon bilan
 * to'sadi (asta buriladi — orqasiga o'tish kerak). Bolg'asini ko'tarib (doira belgisi) yerga uradi:
 * 2 yurak; zarbadan keyin qalqoni tushadi.
 */
function guard(m: RealmMob, t: MobTarget, ctx: MobCtx) {
  const d = dist(m, t.p);
  switch (m.state) {
    case "dormant":
    case "wake":
      m.t -= ctx.dt;
      m.anim.set("idle");
      if (m.state === "dormant") setState(m, "wake", GUARD_WAKE);
      else if (m.t <= 0) setState(m, "chase");
      return;
    case "windup":
      m.t -= ctx.dt;
      m.anim.set("attack");
      if (m.t <= 0) {
        const cx = m.x + m.dirX * 16,
          cy = m.y + m.dirY * 16;
        ctx.event({ type: "slam", x: cx, y: cy, r: GUARD_SMASH_R });
        for (const p of ctx.players)
          if (!p.p.dead && dist(p.p, { x: cx, y: cy }) < GUARD_SMASH_R + p.p.size / 2)
            hurt(m, p, GUARD_DMG, 250, ctx);
        setState(m, "recover", 1);
        m.cd = 1.8;
      }
      return;
    case "recover":
      m.t -= ctx.dt;
      m.anim.set("idle");
      if (m.t <= 0) setState(m, "chase");
      return;
    default:
      m.state = "chase";
      if (m.state === "chase" && overlaps(m, t.p)) hurt(m, t, 1, 160, ctx);
      if (d < 34 && m.cd <= 0) {
        // qalqon tomon emas, aynan o'yinchiga uradi
        aimAt(m, t.p);
        setState(m, "windup", GUARD_WINDUP);
        ctx.mark({
          kind: "circle",
          x: m.x + m.dirX * 16,
          y: m.y + m.dirY * 16,
          r: GUARD_SMASH_R,
          dx: 0,
          dy: 0,
          len: 0,
          t: GUARD_WINDUP,
          total: GUARD_WINDUP,
          owner: m.id,
        });
        return;
      }
      turnToward(m, t.p, ctx.dt, GUARD_TURN);
      if (d > 20) walkToward(m, t.p.x, t.p.y, m.stats.speed, ctx);
      else m.anim.set("idle");
  }
}
