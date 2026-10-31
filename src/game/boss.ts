import { Animator, Body, ROOM, updatePhysics, isFlashing, overlap } from "./animation";
import type { Target } from "./player";
import { renderSprite } from "./sprites";
import { renderRoots } from "./enemy";
import {
  BERSERK_SPEED,
  BERSERK_TIME,
  BIG_HIT,
  PHASE_GUARD,
  PHASE2_AT,
  PHASE3_AT,
  phaseFloor,
  phaseFor,
  type BossPhase,
} from "./bossPower";

export const BOSS_MAX_HP = 30;
const SLAM_WINDUP = 0.7;
const SLAM_RADIUS = 42;
const SHOT_SPEED = 75;
/** 2-faza: OLOV YO'LAGI — chiziq bilan ogohlantirib, o'yinchiga qarab yuguradi, ortida olov izi */
export const RUSH_EVERY = 6;
export const RUSH_WINDUP = 0.9;
export const RUSH_SPEED = 150;
export const RUSH_TIME = 1.3;
/** Olov izi: shuncha turadi, shu radiusda kuydiradi */
export const FIRE_LIFE = 3;
export const FIRE_R = 8;
const FIRE_GAP = 9;
/** 2-fazadan: olov imp chaqirish (xonada ko'pi bilan 2 ta) */
export const IMP_EVERY = 14;
export const MAX_IMPS = 2;
/** 3-faza: arena chetlari yonadi — xavfsiz maydon torayadi, so'ng qaytadi */
export const EDGE_MAX = 48;
export const EDGE_WARN = 1.5;
const EDGE_IDLE = 4;
const EDGE_GROW = 5;
const EDGE_HOLD = 3;
const EDGE_SHRINK = 3;
/** 3-faza: olov sharlari spiral bo'lib sochiladi */
export const SPIRAL_SHOTS = 28;
const SPIRAL_GAP = 0.045;
const SPIRAL_STEP = 0.38;

/** Xonadagi tirik imp'lar soniga qarab nechta yangi imp chaqiriladi. */
export function impSummonCount(alive: number) {
  return Math.max(0, Math.min(MAX_IMPS, MAX_IMPS - alive));
}

/** Boss qismlari: Malikaning ko'zgu nusxasi yoki Shohning hayot guli. */
export interface BossPart {
  x: number;
  y: number;
  size: number;
}

export interface Fire {
  x: number;
  y: number;
  life: number;
}

export type EdgeStage = "idle" | "warn" | "grow" | "hold" | "shrink";

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export class Boss implements Body {
  x = 160;
  y = 70;
  size = 28;
  vx = 0;
  vy = 0;
  hp: number;
  maxHp: number;
  flash = 0;
  slamTimer = 3;
  windup = 0;
  /** Zarba to'lqini vizual effekti */
  shock = 0;
  /** Muz qalqoni: shuncha soniya sekinroq yuradi */
  slow = 0;
  /** Zaharli uch (Ovchi): zahar qolgan vaqti va keyingi zarargacha hisob */
  poison = 0;
  poisonTick = 0;
  /** Paydo bo'lish vaqti */
  spawn = 0;
  spawnMax = 1;
  /** O'yin olib ketadigan olov sharlari */
  shots: Shot[] = [];
  /** Faza: 100–60% — 1, 60–30% — 2, 30–0% — 3 */
  phase: BossPhase = 1;
  /** Yangi fazaga o'tgan kadrda true (Game banner va sahna o'zgarishi) */
  justPhased = false;
  /** Faza almashganda qisqa daxlsizlik */
  guard = 0;
  /** Jang vaqti (paydo bo'lgandan keyin); BERSERK_TIME dan keyin g'azab */
  fightT = 0;
  justBerserk = false;
  /** Game shu kadrda yordamchi mob chaqirishi kerak */
  wantSummon = false;
  /** Shu kadrda yangi hujum ogohlantirishi boshlandi (Game ovoz beradi) */
  justWarned = false;
  /** Zarba yerga tekkan kadrda true (ekran silkinishi uchun) */
  justSlammed = false;
  protected facingLeft = false;
  /** OLOV YO'LAGI: tayyorgarlik, yugurish va yo'nalishi */
  rushWindup = 0;
  rushT = 0;
  rushDir = { x: 0, y: 0 };
  private rushTimer = 3;
  private rushLast = { x: 0, y: 0 };
  /** Olov izi */
  fires: Fire[] = [];
  private impTimer = 0;
  /** Yonayotgan arena chetlari: bosqich, taymer va hozirgi kenglik */
  edge: { stage: EdgeStage; t: number; m: number } = { stage: "idle", t: EDGE_IDLE, m: 0 };
  /** Spiral: qolgan sharlar va burchak */
  private spiralLeft = 0;
  private spiralT = 0;
  private spiralA = 0;
  anim = new Animator({
    idle: { frames: 2, frameTime: 0.45, loop: true },
    walk: { frames: 4, frameTime: 0.18, loop: true },
    attack: { frames: 3, frameTime: SLAM_WINDUP / 3, loop: false },
    hurt: { frames: 1, frameTime: 0.16, loop: false },
    death: { frames: 3, frameTime: 1.4 / 3, loop: false },
  });

  constructor(hp = BOSS_MAX_HP) {
    this.hp = this.maxHp = hp;
  }

  get dead() {
    return this.anim.state === "death";
  }

  get active() {
    return !this.dead && this.spawn <= 0;
  }

  /** 2-fazadan boshlab (eski "g'azab" — jonning yarmi o'rniga fazalar) */
  get enraged() {
    return this.phase >= 2;
  }

  /** 3 daqiqadan keyin: tezroq va zarari +1 */
  get berserk() {
    return this.fightT >= BERSERK_TIME;
  }

  /** Faza almashinuvidagi daxlsizlik */
  get invulnerable() {
    return this.guard > 0;
  }

  /** Boss zarbasi (g'azabda +1). */
  dmg(n: number) {
    return n + (this.berserk ? 1 : 0);
  }

  /**
   * Bossga zarar: daxlsizlikda false. Zarba faza chegarasidan o'tib ketmaydi (o'ldiradigan zarba
   * bundan mustasno) — har faza o'z vaqtida boshlanadi. Boss zarbadan to'xtamaydi (hujumi buzilmaydi).
   */
  takeDamage(dmg: number) {
    if (this.dead || this.invulnerable) return false;
    if (this.hp - dmg > 0) {
      const floor = phaseFloor(this.phase, this.maxHp);
      if (this.hp - dmg < floor) dmg = Math.max(0, this.hp - floor);
    }
    this.hp -= dmg;
    this.flash = 0.3;
    if (this.hp <= 0) this.anim.set("death", true);
    return true;
  }

  /** Umumiy: jang vaqti, g'azab, fazalar; so'ng bossning o'z xatti-harakati (step). */
  update(dt: number, p: Target) {
    this.justSlammed = false;
    if (this.spawn > 0 || this.dead) return this.step(dt, p);
    this.fightT += dt;
    if (!this.justBerserk && this.berserk && this.fightT - dt < BERSERK_TIME)
      this.justBerserk = true;
    if (this.guard > 0) this.guard -= dt;
    const ph = phaseFor(this.hp, this.maxHp);
    if (ph > this.phase) {
      this.phase = ph;
      this.justPhased = true;
      this.guard = PHASE_GUARD;
      this.onPhase(ph);
    }
    this.step(this.berserk ? dt * BERSERK_SPEED : dt, p);
  }

  /** Yangi fazaga o'tganda (har boss o'zinikini qo'shadi). */
  protected onPhase(ph: BossPhase) {
    if (ph === 2) this.impTimer = 0.8;
    if (ph === 3) this.edge = { stage: "warn", t: EDGE_WARN, m: 0 };
  }

  /** Zarbani yutadigan yoki zarar oladigan qism (ko'zgu, gul); Iblisda yo'q. */
  partAt(_b: Body): BossPart | null {
    return null;
  }

  /** Qismga zarba: true — zarar oldi, false — yutdi (zarar yo'q). */
  strikePart(_part: BossPart, _dmg: number) {
    return false;
  }

  /** Arenaning xavfsiz qismi (yonayotgan chetlardan ichkarida). */
  safeRect() {
    const m = this.edge.m;
    return {
      l: ROOM.wall + m,
      t: ROOM.wall + m,
      r: ROOM.w - ROOM.wall - m,
      b: ROOM.h - ROOM.wall - m,
    };
  }

  /** Iblis: urib-tushirish va olov sharlari; 2-fazadan olov yo'lagi va imp'lar; 3-fazada yonuvchi arena. */
  protected step(dt: number, p: Target) {
    if (this.spawn > 0) {
      this.spawn -= dt;
      this.anim.update(dt);
      return;
    }
    this.anim.update(dt);
    this.vx *= 0.9;
    this.vy *= 0.9;
    updatePhysics(this, dt);
    if (this.shock > 0) this.shock -= dt;
    if (this.slow > 0) this.slow -= dt;
    this.updateFires(dt, p);
    if (this.dead) {
      this.fires = [];
      this.edge = { stage: "idle", t: EDGE_IDLE, m: 0 };
      this.spiralLeft = 0;
      this.rushWindup = this.rushT = 0;
      return;
    }
    this.updateEdge(dt, p);
    this.updateSpiral(dt);
    if (this.phase >= 2) {
      this.impTimer -= dt;
      if (this.impTimer <= 0) {
        this.wantSummon = true;
        this.impTimer = IMP_EVERY;
      }
    }
    if (this.rushT > 0) return this.updateRush(dt, p);
    if (this.rushWindup > 0) {
      this.rushWindup -= dt;
      this.anim.set("attack");
      if (this.rushWindup <= 0) {
        this.rushT = RUSH_TIME;
        this.rushLast = { x: this.x, y: this.y };
        this.justSlammed = true;
      }
      return;
    }

    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) {
        this.shock = 0.3;
        this.justSlammed = true;
        if (Math.hypot(p.x - this.x, p.y - this.y) < SLAM_RADIUS + p.size / 2)
          p.takeHit(this.dmg(BIG_HIT), this.x, this.y, 260);
        if (this.phase >= 3) {
          // spiral: ikki qo'l bo'lib aylanib sochiladi — orasidan o'tish yoki dash
          this.spiralLeft = SPIRAL_SHOTS;
          this.spiralT = 0;
          this.spiralA = Math.random() * Math.PI * 2;
        } else this.ring(this.phase === 2 ? 10 : 8);
        this.slamTimer = (this.enraged ? 1.6 : 2.2) + Math.random() * 1.2;
        this.anim.set("walk");
      }
      return;
    }
    if (this.anim.state === "hurt" && !this.anim.done) return;

    this.slamTimer -= dt;
    const dx = p.x - this.x,
      dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    if (dx !== 0) this.facingLeft = dx < 0;
    const speed = (this.enraged ? 42 : 30) * (this.slow > 0 ? 0.5 : 1);
    this.x += (dx / d) * speed * dt;
    this.y += (dy / d) * speed * dt;
    this.anim.set("walk");
    if (this.phase >= 2) this.rushTimer -= dt;
    if (this.phase >= 2 && this.rushTimer <= 0 && d > 50) {
      // OLOV YO'LAGI: yo'nalish shu paytda qotadi — chiziqdan chetga chiqib qochish mumkin
      this.rushDir = { x: dx / d, y: dy / d };
      this.rushWindup = RUSH_WINDUP;
      this.rushTimer = RUSH_EVERY + Math.random() * 2;
      this.justWarned = true;
      this.anim.set("attack", true);
      return;
    }
    if (this.slamTimer <= 0 && d < 90) {
      this.windup = SLAM_WINDUP;
      this.justWarned = true;
      this.anim.set("attack", true);
    }
  }

  /** Olov sharlari halqasi. */
  private ring(n: number) {
    const off = Math.random() * Math.PI;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      this.shots.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(a) * SHOT_SPEED,
        vy: Math.sin(a) * SHOT_SPEED,
      });
    }
  }

  private updateSpiral(dt: number) {
    if (this.spiralLeft <= 0) return;
    this.spiralT -= dt;
    while (this.spiralT <= 0 && this.spiralLeft > 0) {
      this.spiralT += SPIRAL_GAP;
      for (const arm of [0, Math.PI]) {
        const a = this.spiralA + arm;
        this.shots.push({
          x: this.x,
          y: this.y,
          vx: Math.cos(a) * SHOT_SPEED * 0.9,
          vy: Math.sin(a) * SHOT_SPEED * 0.9,
        });
      }
      this.spiralA += SPIRAL_STEP;
      this.spiralLeft -= 2;
    }
  }

  /** Yugurish: tegsa 2 yurak, ortida olov izi; devorga yetsa to'xtaydi. */
  private updateRush(dt: number, p: Target) {
    this.rushT -= dt;
    this.anim.set("walk");
    this.facingLeft = this.rushDir.x < 0;
    this.x += this.rushDir.x * RUSH_SPEED * dt;
    this.y += this.rushDir.y * RUSH_SPEED * dt;
    const h = this.size / 2;
    const stop =
      this.x < ROOM.wall + h ||
      this.x > ROOM.w - ROOM.wall - h ||
      this.y < ROOM.wall + h ||
      this.y > ROOM.h - ROOM.wall - h;
    this.x = Math.max(ROOM.wall + h, Math.min(ROOM.w - ROOM.wall - h, this.x));
    this.y = Math.max(ROOM.wall + h, Math.min(ROOM.h - ROOM.wall - h, this.y));
    if (Math.hypot(this.x - this.rushLast.x, this.y - this.rushLast.y) >= FIRE_GAP) {
      this.fires.push({ x: this.x, y: this.y + 8, life: FIRE_LIFE });
      this.rushLast = { x: this.x, y: this.y };
    }
    if (overlap(this, p as unknown as Body)) p.takeHit(this.dmg(BIG_HIT), this.x, this.y, 260);
    if (stop || this.rushT <= 0) {
      this.rushT = 0;
      this.slamTimer = Math.max(this.slamTimer, 0.8);
    }
  }

  private updateFires(dt: number, p: Target) {
    for (const f of this.fires) {
      f.life -= dt;
      if (Math.hypot(p.x - f.x, p.y + 4 - f.y) < FIRE_R + p.size / 2)
        p.takeHit(this.dmg(1), f.x, f.y, 120);
    }
    this.fires = this.fires.filter((f) => f.life > 0);
  }

  /** Yonuvchi arena: ogohlantirish -> torayish -> turish -> qaytish -> dam. */
  private updateEdge(dt: number, p: Target) {
    const e = this.edge;
    if (this.phase < 3) return;
    e.t -= dt;
    if (e.stage === "grow") e.m = EDGE_MAX * Math.min(1, 1 - e.t / EDGE_GROW);
    if (e.stage === "shrink") e.m = EDGE_MAX * Math.max(0, e.t / EDGE_SHRINK);
    if (e.t <= 0) {
      const next: Record<EdgeStage, [EdgeStage, number]> = {
        idle: ["warn", EDGE_WARN],
        warn: ["grow", EDGE_GROW],
        grow: ["hold", EDGE_HOLD],
        hold: ["shrink", EDGE_SHRINK],
        shrink: ["idle", EDGE_IDLE],
      };
      const [stage, t] = next[e.stage];
      if (stage === "warn") this.justWarned = true;
      e.stage = stage;
      e.t = t;
      if (stage === "hold") e.m = EDGE_MAX;
      if (stage === "idle") e.m = 0;
    }
    if (e.m > 1) {
      const r = this.safeRect();
      const out = p.x < r.l || p.x > r.r || p.y < r.t || p.y > r.b;
      // itarish markaz tomonga (zarba "tashqaridan" keladi)
      if (out) p.takeHit(this.dmg(1), 2 * p.x - ROOM.w / 2, 2 * p.y - ROOM.h / 2, 140);
    }
  }

  /** Bossdan oldin, polga chiziladi: olov izi, yo'lak chizig'i va yonuvchi chetlar. */
  renderFloor(ctx: CanvasRenderingContext2D, time = 0) {
    if (this.rushWindup > 0) {
      const k = 1 - this.rushWindup / RUSH_WINDUP;
      const len = RUSH_SPEED * RUSH_TIME;
      ctx.save();
      ctx.translate(this.x, this.y + 8);
      ctx.rotate(Math.atan2(this.rushDir.y, this.rushDir.x));
      ctx.fillStyle = `rgba(255,90,30,${0.15 + 0.25 * k})`;
      ctx.fillRect(0, -this.size / 2, len, this.size);
      ctx.strokeStyle = `rgba(255,200,60,${0.5 + 0.4 * Math.sin(this.rushWindup * 30)})`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0, -this.size / 2, len, this.size);
      ctx.restore();
    }
    for (const f of this.fires) {
      const a = Math.min(1, f.life * 2);
      const fl = Math.sin(time * 20 + f.x) * 1.5;
      ctx.fillStyle = `rgba(255,90,30,${0.35 * a})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, FIRE_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a;
      ctx.fillStyle = "#ff6a2a";
      ctx.fillRect(Math.round(f.x - 3), Math.round(f.y - 4 - fl), 6, 6);
      ctx.fillStyle = "#ffe14d";
      ctx.fillRect(Math.round(f.x - 1), Math.round(f.y - 3 - fl), 2, 4);
      ctx.globalAlpha = 1;
    }
    const e = this.edge;
    if (this.phase >= 3 && !this.dead) {
      if (e.stage === "warn") {
        // qayerga qadar yonishi oldindan ko'rinadi
        const m = EDGE_MAX;
        ctx.strokeStyle = `rgba(255,140,40,${0.45 + 0.4 * Math.sin(time * 24)})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(
          ROOM.wall + m,
          ROOM.wall + m,
          ROOM.w - 2 * (ROOM.wall + m),
          ROOM.h - 2 * (ROOM.wall + m),
        );
        ctx.setLineDash([]);
      }
      if (e.m > 0.5) {
        const r = this.safeRect();
        ctx.fillStyle = `rgba(255,70,20,${0.32 + 0.08 * Math.sin(time * 9)})`;
        ctx.fillRect(ROOM.wall, ROOM.wall, ROOM.w - 2 * ROOM.wall, r.t - ROOM.wall);
        ctx.fillRect(ROOM.wall, r.b, ROOM.w - 2 * ROOM.wall, ROOM.h - ROOM.wall - r.b);
        ctx.fillRect(ROOM.wall, r.t, r.l - ROOM.wall, r.b - r.t);
        ctx.fillRect(r.r, r.t, ROOM.w - ROOM.wall - r.r, r.b - r.t);
        // ichki chekkada til-til olov
        for (let i = 0; i < 40; i++) {
          const k = i / 40;
          const h = 3 + Math.abs(Math.sin(time * 11 + i * 1.7)) * 4;
          const col = i % 3 ? "#ff6a2a" : "#ffe14d";
          const top = r.l + (r.r - r.l) * k,
            side = r.t + (r.b - r.t) * k;
          ctx.fillStyle = col;
          ctx.fillRect(Math.round(top), Math.round(r.t - h), 2, h);
          ctx.fillRect(Math.round(top), Math.round(r.b), 2, h);
          ctx.fillRect(Math.round(r.l - h), Math.round(side), h, 2);
          ctx.fillRect(Math.round(r.r), Math.round(side), h, 2);
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const { state, frame } = this.anim;

    if (this.spawn > 0) {
      const k = 1 - this.spawn / this.spawnMax;
      ctx.fillStyle = `rgba(178,50,56,${0.25 + 0.2 * Math.sin(this.spawn * 18)})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y + 8, 10 + 26 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = k;
    }
    if (this.windup > 0) {
      ctx.strokeStyle = `rgba(255,60,60,${0.4 + 0.4 * Math.sin(this.windup * 30)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, SLAM_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,60,60,${0.12 * (1 - this.windup / SLAM_WINDUP)})`;
      ctx.fill();
    }
    if (this.shock > 0) {
      ctx.fillStyle = `rgba(255,180,80,${this.shock * 2})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, SLAM_RADIUS * (1.3 - this.shock), 0, Math.PI * 2);
      ctx.fill();
    }

    renderSprite(
      ctx,
      "demon",
      state,
      frame,
      this.x,
      this.y,
      isFlashing(this) || state === "hurt",
      this.facingLeft,
    );
    ctx.globalAlpha = 1;
  }
}

// ---------------- 2-dunyo Bossi: Qor Malikasi ----------------
export const QUEEN_HP = 40;
/** Muz nayzalari: 3 ta, ketma-ket, har biri oldin ko'k doira bilan ogohlantiriladi */
export const SPIKE_COUNT = 3;
export const SPIKE_GAP = 0.35;
export const SPIKE_WARN = 0.8;
export const SPIKE_RADIUS = 10;
const SPIKE_SHOW = 0.45;
/** Bo'ron: shuncha soniya o'yinchini bir tomonga suradi */
export const BLIZZARD_TIME = 2;
export const WIND_PUSH = 38;
/** Jonining yarmidan pastda har 12s da 2 ta Muz ruhi chaqiradi, xonada ko'pi bilan 3 ta */
export const SUMMON_EVERY = 12;
export const SUMMON_COUNT = 2;
export const MAX_SPIRITS = 3;
const CAST_TIME = 0.6;
/** 2-faza: MUZ POL — polning qismlari muzlaydi (sirpanchiq, to'xtash qiyin) */
export const ICE_EVERY = 13;
export const ICE_WARN = 1;
export const ICE_LIFE = 8;
export const ICE_PATCHES = 3;
const ICE_W = 64;
const ICE_H = 44;
/** 2-faza: MUZ QAMOQ nuri — chiziq ogohlantiradi, tegsa o'yinchi muz ichida qotadi */
export const BEAM_WARN = 1;
export const BEAM_LEN = 320;
export const BEAM_W = 10;
const BEAM_SHOW = 0.25;
/** Muz qamoqdan chiqish uchun shuncha marta tugma bosish kerak */
export const ENCASE_TAPS = 6;
/** 3-faza: 2 ta ko'zgu nusxasi; har MIRROR_SWAP s da Malika nusxalardan biri bilan joy almashadi */
export const MIRROR_COUNT = 2;
export const MIRROR_SWAP = 8;
export const MIRROR_WARN = 0.6;
const MIRROR_SIZE = 24;
/** Ko'zgular aylanadigan markaz va eng katta radius (xonadan chiqmasin) */
const MIRROR_C = { x: ROOM.w / 2, y: ROOM.h / 2 };
const MIRROR_R = 84;
/** Malika markazga yaqin tursa ham nusxalar bir-birining ustiga tushmasin */
const MIRROR_MIN_R = 64;

/** Xonadagi tirik Muz ruhlari soniga qarab nechta yangi ruh chaqiriladi. */
export function summonCount(alive: number) {
  return Math.max(0, Math.min(SUMMON_COUNT, MAX_SPIRITS - alive));
}

export interface IcePatch {
  x: number;
  y: number;
  w: number;
  h: number;
  warn: number;
  life: number;
}

/** Muz qamoq nuri: boshlanish nuqtasi, yo'nalishi (qotgan), ogohlantirish va ko'rinish vaqti */
export interface Beam {
  x: number;
  y: number;
  dx: number;
  dy: number;
  warn: number;
  show: number;
}

export interface Mirror extends BossPart {
  flash: number;
}

/** Nuqtadan kesmagacha masofa. */
function segDist(
  px: number,
  py: number,
  x: number,
  y: number,
  dx: number,
  dy: number,
  len: number,
) {
  const t = Math.max(0, Math.min(len, (px - x) * dx + (py - y) * dy));
  return Math.hypot(px - (x + dx * t), py - (y + dy * t));
}

export interface Spike {
  x: number;
  y: number;
  /** Ogohlantirish qolgan vaqti; 0 dan o'tganda nayza chiqadi */
  warn: number;
  /** Nayza ko'rinib turadigan vaqt */
  life: number;
}

/** Qor Malikasi: masofani saqlab sehr qiladi — muz nayzalari, bo'ron, ruh chaqirish. */
export class Queen extends Boss {
  spikes: Spike[] = [];
  /** Navbatdagi nayzalar (ketma-ket chiqadi) */
  private spikeQueue = 0;
  private spikeTimer = 0;
  /** Bo'ron: yo'nalish (-1 chap, 1 o'ng) va qolgan vaqt */
  wind = { dir: 0, t: 0 };
  /** Keyingi hujum; navbat bilan nayza va bo'ron */
  private castTimer = 2.4;
  private castAnim = 0;
  /** Navbatdagi sehr raqami: 1-fazada nayza/bo'ron, 2-fazadan nayza/bo'ron/nur */
  private castN = 0;
  private summonTimer = 0;
  /** Shu kadrda nayza yerdan chiqdi (ovoz uchun) */
  justSpiked = false;
  /** Muz pol bo'laklari */
  ice: IcePatch[] = [];
  private iceTimer = 0;
  /** Muz qamoq nuri */
  beam: Beam | null = null;
  /** Shu kadrda nur o'yinchini muzlatdi */
  justEncased = false;
  /** 3-faza: ko'zgu nusxalari (zarar olmaydi, soyasi yo'q) */
  mirrors: Mirror[] = [];
  swapT = MIRROR_SWAP;

  constructor(hp = QUEEN_HP) {
    super(hp);
  }

  protected override onPhase(ph: BossPhase) {
    if (ph === 2) {
      this.summonTimer = 0;
      this.iceTimer = 0.5;
    }
    if (ph === 3) {
      this.mirrors = Array.from({ length: MIRROR_COUNT }, () => ({
        x: this.x,
        y: this.y,
        size: MIRROR_SIZE,
        flash: 0.5,
      }));
      this.swapT = MIRROR_SWAP;
      this.placeMirrors();
    }
  }

  /** (x, y) muzlagan polda (ogohlantirish tugagan bo'lak ustida). */
  onIce(x: number, y: number) {
    return this.ice.some(
      (b) => b.warn <= 0 && b.life > 0 && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h,
    );
  }

  /** Haqiqiy Malikani markaz atrofida 120° ga burib, nusxalar shu tarzda joylashadi. */
  private placeMirrors() {
    const ox = this.x - MIRROR_C.x,
      oy = this.y - MIRROR_C.y;
    const r = Math.max(MIRROR_MIN_R, Math.min(MIRROR_R, Math.hypot(ox, oy)));
    const a0 = Math.atan2(oy, ox);
    this.mirrors.forEach((m, i) => {
      const a = a0 + ((i + 1) * Math.PI * 2) / (MIRROR_COUNT + 1);
      m.x = MIRROR_C.x + Math.cos(a) * r;
      m.y = MIRROR_C.y + Math.sin(a) * r * 0.9;
    });
  }

  /** Ko'zgu nusxasi zarbani yutadi — zarar yo'q. */
  override partAt(b: Body): BossPart | null {
    return this.mirrors.find((m) => overlap(b, m as unknown as Body)) ?? null;
  }

  override strikePart(part: BossPart) {
    (part as Mirror).flash = 0.25;
    return false;
  }

  protected override step(dt: number, p: Target) {
    this.justSlammed = false;
    if (this.spawn > 0) {
      this.spawn -= dt;
      this.anim.update(dt);
      return;
    }
    this.anim.update(dt);
    this.vx *= 0.9;
    this.vy *= 0.9;
    updatePhysics(this, dt);
    if (this.slow > 0) this.slow -= dt;
    this.updateSpikes(dt, p);
    this.updateIce(dt, p);
    this.updateBeam(dt, p);
    for (const m of this.mirrors) if (m.flash > 0) m.flash -= dt;
    if (this.wind.t > 0) this.wind.t -= dt;
    if (this.dead) {
      // o'lgach yangi nayzalar chiqmaydi, bo'ron to'xtaydi, muz eriydi, ko'zgular sinadi
      this.wind.t = 0;
      this.spikeQueue = 0;
      this.spikes = this.spikes.filter((s) => s.warn <= 0);
      this.ice = [];
      this.beam = null;
      this.mirrors = [];
      return;
    }
    if (this.mirrors.length) {
      this.swapT -= dt;
      if (this.swapT <= MIRROR_WARN && this.swapT + dt > MIRROR_WARN) this.justWarned = true;
      if (this.swapT <= 0) {
        // Malika nusxalardan biri bilan joy almashadi (hammasi bir zum yaltiraydi)
        const a = ((Math.random() < 0.5 ? 1 : 2) * Math.PI * 2) / (MIRROR_COUNT + 1);
        const ox = this.x - MIRROR_C.x,
          oy = (this.y - MIRROR_C.y) / 0.9;
        const r = Math.max(MIRROR_MIN_R, Math.min(MIRROR_R, Math.hypot(ox, oy))),
          b = Math.atan2(oy, ox) + a;
        this.x = MIRROR_C.x + Math.cos(b) * r;
        this.y = MIRROR_C.y + Math.sin(b) * r * 0.9;
        this.swapT = MIRROR_SWAP;
        for (const m of this.mirrors) m.flash = 0.3;
        this.flash = 0.3;
      }
    }
    if (this.phase >= 2) {
      this.iceTimer -= dt;
      if (this.iceTimer <= 0) {
        this.iceTimer = ICE_EVERY;
        this.freezeFloor(p);
      }
    }
    if (this.enraged) {
      this.summonTimer -= dt;
      if (this.summonTimer <= 0) {
        this.wantSummon = true;
        this.summonTimer = SUMMON_EVERY;
      }
    }

    // nayzalar ketma-ket: har biri o'yinchining o'sha paytdagi joyida
    if (this.spikeQueue > 0) {
      this.spikeTimer -= dt;
      if (this.spikeTimer <= 0) {
        this.spikes.push({ x: p.x, y: p.y, warn: SPIKE_WARN, life: SPIKE_SHOW });
        this.spikeQueue--;
        this.spikeTimer = SPIKE_GAP;
      }
    }

    if (this.castAnim > 0) {
      this.castAnim -= dt;
      if (this.castAnim <= 0) this.anim.set("walk");
      return;
    }
    if (this.anim.state === "hurt" && !this.anim.done) return;

    // o'yinchidan ~70 piksel uzoqda turishga harakat qiladi
    const dx = p.x - this.x,
      dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    if (dx !== 0) this.facingLeft = dx < 0;
    const dir = d > 80 ? 1 : d < 60 ? -1 : 0;
    const speed = (this.enraged ? 34 : 26) * (this.slow > 0 ? 0.5 : 1);
    this.x += (dx / d) * speed * dir * dt;
    this.y += (dy / d) * speed * dir * dt;
    this.x = Math.max(ROOM.wall + 16, Math.min(ROOM.w - ROOM.wall - 16, this.x));
    this.y = Math.max(ROOM.wall + 16, Math.min(ROOM.h - ROOM.wall - 16, this.y));
    if (this.mirrors.length) this.placeMirrors();
    this.anim.set(dir ? "walk" : "idle");

    this.castTimer -= dt;
    if (this.castTimer <= 0) {
      const kind =
        this.phase >= 2
          ? (["spikes", "blizzard", "beam"] as const)[this.castN % 3]!
          : this.castN % 2
            ? "blizzard"
            : "spikes";
      this.castN++;
      this.castAnim = CAST_TIME;
      if (kind === "blizzard") {
        this.wind = { dir: p.x < ROOM.w / 2 ? -1 : 1, t: BLIZZARD_TIME };
        this.justSlammed = true;
      } else if (kind === "spikes") {
        this.spikeQueue = SPIKE_COUNT;
        this.spikeTimer = 0;
      } else {
        // MUZ QAMOQ: nur yo'nalishi shu paytda qotadi — chetga chiqish yoki dash bilan qochiladi
        const l = Math.hypot(dx, dy) || 1;
        this.beam = { x: this.x, y: this.y, dx: dx / l, dy: dy / l, warn: BEAM_WARN, show: 0 };
        this.castAnim = BEAM_WARN + 0.2;
        this.justWarned = true;
      }
      this.castTimer = (this.enraged ? 2.6 : 3.4) + Math.random();
      this.anim.set("attack", true);
    }
  }

  /** Muz pol: biri o'yinchi ostida, qolganlari tasodifiy joyda; avval yoriq bilan ogohlantiriladi. */
  private freezeFloor(p: Target) {
    const lx = ROOM.wall + 4,
      ly = ROOM.wall + 4;
    const rx = ROOM.w - ROOM.wall - 4 - ICE_W,
      ry = ROOM.h - ROOM.wall - 4 - ICE_H;
    const clampX = (x: number) => Math.max(lx, Math.min(rx, x));
    const clampY = (y: number) => Math.max(ly, Math.min(ry, y));
    this.ice = [];
    for (let i = 0; i < ICE_PATCHES; i++) {
      const x = i === 0 ? clampX(p.x - ICE_W / 2) : lx + Math.random() * (rx - lx);
      const y = i === 0 ? clampY(p.y - ICE_H / 2) : ly + Math.random() * (ry - ly);
      this.ice.push({ x, y, w: ICE_W, h: ICE_H, warn: ICE_WARN, life: ICE_LIFE });
    }
    this.justWarned = true;
  }

  private updateIce(dt: number, _p: Target) {
    for (const b of this.ice) {
      if (b.warn > 0) b.warn -= dt;
      else b.life -= dt;
    }
    this.ice = this.ice.filter((b) => b.warn > 0 || b.life > 0);
  }

  private updateBeam(dt: number, p: Target) {
    const b = this.beam;
    if (!b) return;
    if (b.warn > 0) {
      b.warn -= dt;
      if (b.warn <= 0) {
        b.show = BEAM_SHOW;
        this.justSlammed = true;
        const d = segDist(p.x, p.y, b.x, b.y, b.dx, b.dy, BEAM_LEN);
        if (d < BEAM_W / 2 + p.size / 2) {
          p.takeHit(this.dmg(1), b.x, b.y, 0);
          if (p.encase(ENCASE_TAPS)) this.justEncased = true;
        }
      }
      return;
    }
    b.show -= dt;
    if (b.show <= 0) this.beam = null;
  }

  private updateSpikes(dt: number, p: Target) {
    for (const s of this.spikes) {
      if (s.warn > 0) {
        s.warn -= dt;
        if (s.warn <= 0) this.justSpiked = true;
        if (s.warn <= 0 && Math.hypot(p.x - s.x, p.y - s.y) < SPIKE_RADIUS + p.size / 2)
          p.takeHit(1, s.x, s.y, 150);
      } else s.life -= dt;
    }
    this.spikes = this.spikes.filter((s) => s.warn > 0 || s.life > 0);
  }

  /** Poldagi muz, nur, ogohlantirish doiralari va nayzalar — boshqa jonzotlardan oldin chiziladi. */
  override renderFloor(ctx: CanvasRenderingContext2D, time = 0) {
    for (const b of this.ice) {
      const x = Math.round(b.x),
        y = Math.round(b.y);
      if (b.warn > 0) {
        // yoriqlar: qayer muzlashi oldindan ko'rinadi
        ctx.strokeStyle = `rgba(20,60,170,${0.5 + 0.4 * Math.sin(b.warn * 28)})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(x + 0.5, y + 0.5, b.w, b.h);
        ctx.setLineDash([]);
        continue;
      }
      const a = Math.min(1, b.life * 2);
      ctx.fillStyle = `rgba(214,240,255,${0.55 * a})`;
      ctx.fillRect(x, y, b.w, b.h);
      ctx.fillStyle = `rgba(255,255,255,${0.6 * a})`;
      for (let k = 0; k < 4; k++) ctx.fillRect(x + 6 + k * 15, y + 5 + ((k * 13) % 30), 7, 1);
      ctx.strokeStyle = `rgba(80,140,220,${0.8 * a})`;
      ctx.strokeRect(x + 0.5, y + 0.5, b.w, b.h);
    }
    const bm = this.beam;
    if (bm) {
      ctx.save();
      ctx.translate(bm.x, bm.y);
      ctx.rotate(Math.atan2(bm.dy, bm.dx));
      if (bm.warn > 0) {
        const k = 1 - bm.warn / BEAM_WARN;
        ctx.fillStyle = `rgba(127,233,255,${0.12 + 0.2 * k})`;
        ctx.fillRect(0, -BEAM_W / 2, BEAM_LEN, BEAM_W);
        ctx.fillStyle = `rgba(20,60,170,${0.5 + 0.4 * Math.sin(time * 30)})`;
        ctx.fillRect(0, -0.5, BEAM_LEN, 1);
      } else {
        ctx.fillStyle = "rgba(127,233,255,0.6)";
        ctx.fillRect(0, -BEAM_W / 2 - 2, BEAM_LEN, BEAM_W + 4);
        ctx.fillStyle = "#eef7ff";
        ctx.fillRect(0, -BEAM_W / 4, BEAM_LEN, BEAM_W / 2);
      }
      ctx.restore();
    }
    for (const s of this.spikes) {
      if (s.warn > 0) {
        // och muz polda ham ko'rinishi uchun to'q ko'k chiziq
        const k = 1 - s.warn / SPIKE_WARN;
        ctx.fillStyle = `rgba(30,90,210,${0.15 + 0.3 * k})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y + 4, SPIKE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(20,60,170,${0.6 + 0.35 * Math.sin(s.warn * 30)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        continue;
      }
      // yerdan chiqqan muz nayzalari
      const h = Math.min(1, (SPIKE_SHOW - s.life) * 10) * 12;
      const x = Math.round(s.x),
        y = Math.round(s.y + 6);
      for (const [ox, k] of [
        [-5, 0.6],
        [0, 1],
        [5, 0.7],
      ] as const) {
        const hh = Math.round(h * k);
        ctx.fillStyle = "#4a6fa5";
        ctx.fillRect(x + ox - 2, y - hh, 4, hh);
        ctx.fillStyle = "#dceeff";
        ctx.fillRect(x + ox - 1, y - hh, 2, hh);
        ctx.fillStyle = "#7fe9ff";
        ctx.fillRect(x + ox - 1, y - hh - 1, 1, 2);
      }
    }
  }

  override render(ctx: CanvasRenderingContext2D) {
    const { state, frame } = this.anim;
    if (this.spawn > 0) {
      const k = 1 - this.spawn / this.spawnMax;
      ctx.fillStyle = `rgba(127,233,255,${0.2 + 0.2 * Math.sin(this.spawn * 18)})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y + 8, 10 + 26 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = k;
    }
    if (this.castAnim > 0) {
      // sehr paytida tayoq atrofida sovuq nur
      ctx.fillStyle = `rgba(127,233,255,${0.18 + 0.12 * Math.sin(this.castAnim * 40)})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    renderSprite(
      ctx,
      "queen",
      state,
      frame,
      this.x,
      this.y,
      isFlashing(this) || state === "hurt",
      this.facingLeft,
    );
    ctx.globalAlpha = 1;
  }

  /** Ko'zgu nusxalari: Malikaning aynan o'zi, faqat soyasi yo'q (Game soyani faqat haqiqiysiga chizadi). */
  renderMirror(ctx: CanvasRenderingContext2D, m: Mirror) {
    const { state, frame } = this.anim;
    if (this.castAnim > 0) {
      ctx.fillStyle = `rgba(127,233,255,${0.18 + 0.12 * Math.sin(this.castAnim * 40)})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    renderSprite(
      ctx,
      "queen",
      state,
      frame,
      m.x,
      m.y,
      m.flash > 0 || isFlashing(this),
      this.facingLeft,
    );
  }
}

// ---------------- 3-dunyo Bossi: O'rmon Shohi ----------------
export const KING_HP = 50;
/** Ildizlar qatori: Shohdan o'yinchi tomonga 6 ta, ketma-ket chiqadi */
export const KING_ROOTS = 6;
export const KING_ROOT_GAP = 18;
export const KING_ROOT_WARN = 0.75;
export const KING_ROOT_STEP = 0.09;
export const KING_ROOT_RADIUS = 10;
const KING_ROOT_SHOW = 0.5;
/** Ildiz ushlasa o'yinchi shuncha yurolmaydi */
export const KING_ROOT_SNARE = 0.5;
/** Har 9s da 2 ta o'rgimchak chaqiradi, xonada ko'pi bilan 3 ta */
export const KING_SUMMON_EVERY = 9;
export const KING_SUMMON_COUNT = 2;
export const MAX_SPIDERS = 3;
/** G'azabda (jon yarmidan past) xona qorong'i: o'yinchi atrofidagi yorug'lik radiusi */
export const KING_LIGHT = 62;
/** 2-faza: hayot gullari — bor ekan Shoh sekin davolanadi */
export const FLOWER_COUNT = 3;
export const FLOWER_GROW = 1.2;
/** Har gul har soniyada maxHp ning shuncha ulushini tiklaydi (oldingi fazaga qaytarmaydi) */
export const FLOWER_HEAL = 0.004;
export const FLOWER_SPOTS: readonly (readonly [number, number])[] = [
  [56, 64],
  [264, 64],
  [160, 206],
];
/** Gul joni: Shoh jonining ~3.5% i (o'yinchi kuchiga moslashadi), kamida 4 */
export function flowerHp(maxHp: number) {
  return Math.max(4, Math.ceil(maxHp * 0.035));
}
/** Tikanli devor: arenani bo'laklarga bo'ladi, bitta tor o'tish joyi bor */
export const THORN_EVERY = 11;
export const THORN_WARN = 1.2;
export const THORN_LIFE = 6;
export const THORN_W = 8;
export const THORN_GAP = 40;
/** 3-faza: qorong'ida ildizlar shuncha uzunroq ogohlantiriladi (svetlyachoklar yig'iladi) */
export const DARK_EXTRA = 0.3;

export interface Flower extends BossPart {
  hp: number;
  maxHp: number;
  grow: number;
  flash: number;
}

export interface Thorn {
  /** true — tik devor (x = at), aks holda yotiq (y = at) */
  vertical: boolean;
  at: number;
  /** o'tish joyi boshlanishi */
  gap: number;
  warn: number;
  life: number;
}

/** Xonadagi tirik o'rgimchaklar soniga qarab nechta yangi o'rgimchak chaqiriladi. */
export function spiderSummonCount(alive: number) {
  return Math.max(0, Math.min(KING_SUMMON_COUNT, MAX_SPIDERS - alive));
}

export interface RootSpike {
  x: number;
  y: number;
  warn: number;
  life: number;
}

/** O'rmon Shohi: sekin yuradi, yerdan ildizlar qatori, o'rgimchak chaqiradi, g'azabda xonani qorong'i qiladi. */
export class ForestKing extends Boss {
  roots: RootSpike[] = [];
  private castTimer = 2.2;
  private castAnim = 0;
  private summonTimer = 4;
  /** Shu kadrda ildiz yerdan chiqdi (ovoz uchun) */
  justRooted = false;
  /** Hayot gullari va tikanli devorlar */
  flowers: Flower[] = [];
  thorns: Thorn[] = [];
  private thornTimer = 0;
  /** Shu kadrda gul so'ldi (Game effekt chiqaradi) */
  wilted: { x: number; y: number }[] = [];

  constructor(hp = KING_HP) {
    super(hp);
  }

  /** 3-fazada xona to'liq qorong'i (faqat o'yinchi atrofi va svetlyachoklar yorug') */
  get dark() {
    return this.phase >= 3 && !this.dead;
  }

  /** Davolayotgan (o'sib bo'lgan) gullar */
  get blooming() {
    return this.flowers.filter((f) => f.grow <= 0 && f.hp > 0).length;
  }

  protected override onPhase(ph: BossPhase) {
    // 2-fazada 3 ta gul o'sadi, 3-fazada so'lganlari o'rniga 2 tagacha qayta o'sadi
    this.flowers = this.flowers.filter((f) => f.hp > 0);
    const want = ph === 2 ? FLOWER_COUNT : 2;
    const hp = flowerHp(this.maxHp);
    for (const [x, y] of FLOWER_SPOTS) {
      if (this.flowers.length >= want) break;
      if (this.flowers.some((f) => f.x === x && f.y === y)) continue;
      this.flowers.push({ x, y, size: 14, hp, maxHp: hp, grow: FLOWER_GROW, flash: 0 });
    }
    this.thornTimer = ph === 2 ? 3 : 1.5;
  }

  override partAt(b: Body): BossPart | null {
    return this.flowers.find((f) => f.hp > 0 && overlap(b, f as unknown as Body)) ?? null;
  }

  /** Gulga zarar (o'sayotgani ham urilsa bo'ladi); so'lsa — Shoh davolanmaydi. */
  override strikePart(part: BossPart, dmg: number) {
    const f = part as Flower;
    if (f.hp <= 0) return false;
    f.hp -= dmg;
    f.flash = 0.2;
    if (f.hp <= 0) this.wilted.push({ x: f.x, y: f.y });
    return true;
  }

  private updateFlowers(dt: number) {
    for (const f of this.flowers) {
      if (f.grow > 0) f.grow -= dt;
      if (f.flash > 0) f.flash -= dt;
    }
    this.flowers = this.flowers.filter((f) => f.hp > 0);
    const n = this.blooming;
    if (!n || this.phase < 2) return;
    // oldingi fazaga qaytib ketmaydi
    const cap = this.maxHp * (this.phase === 2 ? PHASE2_AT : PHASE3_AT);
    if (this.hp < cap) this.hp = Math.min(cap, this.hp + this.maxHp * FLOWER_HEAL * n * dt);
  }

  /** Tikanli devor: tegsa 1 zarar va itariladi; dash bilan ichidan o'tib bo'ladi. */
  private updateThorns(dt: number, p: Target) {
    for (const t of this.thorns) {
      if (t.warn > 0) {
        t.warn -= dt;
        continue;
      }
      t.life -= dt;
      const along = t.vertical ? p.y : p.x;
      const across = t.vertical ? p.x : p.y;
      const reach = THORN_W / 2 + p.size / 2;
      if (along > t.gap && along < t.gap + THORN_GAP) continue;
      if (Math.abs(across - t.at) >= reach) continue;
      const fx = t.vertical ? t.at : p.x,
        fy = t.vertical ? p.y : t.at;
      // dash bilan ichidan o'tib bo'ladi; boshqa paytda (daxlsiz bo'lsa ham) devor itaradi
      p.takeHit(this.dmg(1), fx, fy, 160);
      if (p.evading) continue;
      const side = across < t.at ? -1 : 1;
      if (t.vertical) p.x = t.at + side * (reach + 1);
      else p.y = t.at + side * (reach + 1);
    }
    this.thorns = this.thorns.filter((t) => t.warn > 0 || t.life > 0);
    if (this.phase < 2) return;
    this.thornTimer -= dt;
    if (this.thornTimer > 0) return;
    this.thornTimer = THORN_EVERY;
    const gap = (min: number, max: number) => min + Math.random() * (max - min - THORN_GAP);
    const lo = ROOM.wall + 6;
    this.thorns.push({
      vertical: true,
      at: Math.max(70, Math.min(ROOM.w - 70, p.x)),
      gap: gap(lo, ROOM.h - lo),
      warn: THORN_WARN,
      life: THORN_LIFE,
    });
    // 3-fazada xoch: arena to'rt bo'lakka bo'linadi
    if (this.phase >= 3)
      this.thorns.push({
        vertical: false,
        at: Math.max(60, Math.min(ROOM.h - 60, p.y)),
        gap: gap(lo, ROOM.w - lo),
        warn: THORN_WARN,
        life: THORN_LIFE,
      });
    this.justWarned = true;
  }

  protected override step(dt: number, p: Target) {
    this.justSlammed = false;
    if (this.spawn > 0) {
      this.spawn -= dt;
      this.anim.update(dt);
      return;
    }
    this.anim.update(dt);
    this.vx *= 0.9;
    this.vy *= 0.9;
    updatePhysics(this, dt);
    if (this.slow > 0) this.slow -= dt;
    this.updateRoots(dt, p);
    if (this.dead) {
      // o'lgach yangi ildizlar chiqmaydi, gullar so'ladi, tikanlar quriydi
      this.roots = this.roots.filter((r) => r.warn <= 0);
      this.flowers = [];
      this.thorns = [];
      return;
    }
    this.updateFlowers(dt);
    this.updateThorns(dt, p);
    this.summonTimer -= dt;
    if (this.summonTimer <= 0) {
      this.wantSummon = true;
      this.summonTimer = KING_SUMMON_EVERY;
    }
    if (this.castAnim > 0) {
      this.castAnim -= dt;
      if (this.castAnim <= 0) this.anim.set("walk");
      return;
    }
    if (this.anim.state === "hurt" && !this.anim.done) return;

    const dx = p.x - this.x,
      dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    if (dx !== 0) this.facingLeft = dx < 0;
    const speed = (this.enraged ? 30 : 22) * (this.slow > 0 ? 0.5 : 1);
    if (d > 44) {
      this.x += (dx / d) * speed * dt;
      this.y += (dy / d) * speed * dt;
      this.anim.set("walk");
    } else this.anim.set("idle");

    this.castTimer -= dt;
    if (this.castTimer <= 0 && d < 180) {
      // ildizlar qatori: yo'nalish shu paytda qotadi — chetga chiqib qochish mumkin
      const ux = dx / d,
        uy = dy / d;
      for (let i = 0; i < KING_ROOTS; i++) {
        const x = this.x + ux * (22 + i * KING_ROOT_GAP),
          y = this.y + uy * (22 + i * KING_ROOT_GAP);
        if (x < ROOM.wall || x > ROOM.w - ROOM.wall || y < ROOM.wall || y > ROOM.h - ROOM.wall)
          break;
        this.roots.push({
          x,
          y,
          warn: KING_ROOT_WARN + (this.dark ? DARK_EXTRA : 0) + i * KING_ROOT_STEP,
          life: KING_ROOT_SHOW,
        });
      }
      this.castTimer = (this.enraged ? 2.4 : 3.2) + Math.random() * 0.8;
      this.castAnim = 0.6;
      this.justSlammed = true;
      this.justWarned = true;
      this.anim.set("attack", true);
    }
  }

  private updateRoots(dt: number, p: Target) {
    for (const r of this.roots) {
      if (r.warn > 0) {
        r.warn -= dt;
        if (r.warn <= 0) {
          this.justRooted = true;
          if (
            Math.hypot(p.x - r.x, p.y - r.y) < KING_ROOT_RADIUS + p.size / 2 &&
            p.takeHit(1, r.x, r.y, 120)
          )
            p.ensnare(KING_ROOT_SNARE);
        }
      } else r.life -= dt;
    }
    this.roots = this.roots.filter((r) => r.warn > 0 || r.life > 0);
  }

  /** Poldagi gullar, tikanlar, ogohlantirishlar va ildizlar — boshqa jonzotlardan oldin chiziladi. */
  override renderFloor(ctx: CanvasRenderingContext2D, time = 0) {
    for (const t of this.thorns) this.renderThorn(ctx, t, time);
    for (const f of this.flowers) {
      if (f.grow <= 0 && !this.dead) {
        // davolash nuri: guldan Shohga
        ctx.strokeStyle = `rgba(150,255,120,${0.25 + 0.2 * Math.sin(time * 8 + f.x)})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(f.x, f.y - 4);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      this.renderFlower(ctx, f, time);
    }
    for (const r of this.roots) {
      if (r.warn > 0) {
        const k = Math.max(0, 1 - r.warn / KING_ROOT_WARN);
        ctx.fillStyle = `rgba(160,70,20,${0.12 + 0.3 * k})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y + 4, KING_ROOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(230,120,30,${0.5 + 0.4 * Math.sin(r.warn * 30)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        continue;
      }
      renderRoots(ctx, r.x, r.y, KING_ROOT_SHOW - r.life);
    }
  }

  override render(ctx: CanvasRenderingContext2D) {
    const { state, frame } = this.anim;
    if (this.spawn > 0) {
      const k = 1 - this.spawn / this.spawnMax;
      ctx.fillStyle = `rgba(120,210,80,${0.2 + 0.2 * Math.sin(this.spawn * 18)})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y + 8, 10 + 26 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = k;
    }
    if (this.castAnim > 0) {
      ctx.fillStyle = `rgba(150,230,80,${0.14 + 0.1 * Math.sin(this.castAnim * 40)})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y + 6, 28, 0, Math.PI * 2);
      ctx.fill();
    }
    renderSprite(
      ctx,
      "king",
      state,
      frame,
      this.x,
      this.y,
      isFlashing(this) || state === "hurt",
      this.facingLeft,
    );
    ctx.globalAlpha = 1;
  }

  /** Kod bilan chizilgan hayot guli: poya, barglar, pushti gultojlar, yashil nur o'zagi. */
  private renderFlower(ctx: CanvasRenderingContext2D, f: Flower, time: number) {
    const k = f.grow > 0 ? 1 - f.grow / FLOWER_GROW : 1;
    const x = Math.round(f.x),
      y = Math.round(f.y);
    const h = Math.round(4 + 6 * k);
    const white = f.flash > 0;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(x - 5, y + 3, 10, 2);
    ctx.fillStyle = white ? "#ffffff" : "#2e5a24";
    ctx.fillRect(x - 1, y - h, 2, h + 3);
    ctx.fillStyle = white ? "#ffffff" : "#4f8a3a";
    ctx.fillRect(x - 4, y - 3, 3, 2);
    ctx.fillRect(x + 1, y - 5, 3, 2);
    if (k < 0.5) return;
    const pulse = Math.round(Math.sin(time * 5 + f.x) * 0.6);
    const cy = y - h - 2;
    ctx.fillStyle = `rgba(216,255,122,${0.25 + 0.1 * pulse})`;
    ctx.fillRect(x - 6, cy - 6, 12, 12);
    ctx.fillStyle = white ? "#ffffff" : "#e0679a";
    ctx.fillRect(x - 4, cy - 2, 8, 4);
    ctx.fillRect(x - 2, cy - 4, 4, 8);
    ctx.fillStyle = white ? "#ffffff" : "#ffb3d0";
    ctx.fillRect(x - 3, cy - 1, 2, 2);
    ctx.fillStyle = "#d8ff7a";
    ctx.fillRect(x - 1, cy - 1, 2, 2);
    // jon chizig'i
    const w = 12;
    ctx.fillStyle = "#1a1018";
    ctx.fillRect(x - w / 2, cy - 9, w, 2);
    ctx.fillStyle = "#a6f08e";
    ctx.fillRect(x - w / 2, cy - 9, Math.max(1, Math.round((w * f.hp) / f.maxHp)), 2);
  }

  /** Tikanli devor: avval yer yoriladi (nuqtali chiziq), so'ng tikanli novdalar o'sadi. */
  private renderThorn(ctx: CanvasRenderingContext2D, t: Thorn, time: number) {
    const lo = ROOM.wall,
      hi = (t.vertical ? ROOM.h : ROOM.w) - ROOM.wall;
    const seg = (from: number, to: number) => {
      if (to <= from) return;
      if (t.warn > 0) {
        ctx.strokeStyle = `rgba(230,120,30,${0.45 + 0.4 * Math.sin(time * 26)})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        if (t.vertical) {
          ctx.moveTo(t.at, from);
          ctx.lineTo(t.at, to);
        } else {
          ctx.moveTo(from, t.at);
          ctx.lineTo(to, t.at);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }
      const a = Math.min(1, t.life * 2);
      ctx.globalAlpha = a;
      const w = THORN_W;
      ctx.fillStyle = "#2e1d10";
      if (t.vertical) ctx.fillRect(t.at - w / 2, from, w, to - from);
      else ctx.fillRect(from, t.at - w / 2, to - from, w);
      ctx.fillStyle = "#5e3e22";
      for (let s = from; s < to; s += 6) {
        if (t.vertical) {
          ctx.fillRect(t.at - 1, s, 2, 4);
          ctx.fillRect(t.at - w / 2 - 2, s + 2, 3, 1);
          ctx.fillRect(t.at + w / 2 - 1, s + 4, 3, 1);
        } else {
          ctx.fillRect(s, t.at - 1, 4, 2);
          ctx.fillRect(s + 2, t.at - w / 2 - 2, 1, 3);
          ctx.fillRect(s + 4, t.at + w / 2 - 1, 1, 3);
        }
      }
      ctx.fillStyle = "#4f8a3a";
      for (let s = from + 3; s < to; s += 11) {
        if (t.vertical) ctx.fillRect(t.at - 3, s, 2, 2);
        else ctx.fillRect(s, t.at - 3, 2, 2);
      }
      ctx.globalAlpha = 1;
    };
    seg(lo, t.gap);
    seg(t.gap + THORN_GAP, hi);
  }

  /**
   * Qorong'ilik ustidan: hujumdan oldin svetlyachoklar o'sha joyga yig'iladi (ildiz, tikan),
   * gullar ham yorug' — 3-fazada ogohlantirishlar shular orqali ko'rinadi.
   */
  renderSwarm(ctx: CanvasRenderingContext2D, time: number) {
    if (!this.dark) return;
    const fly = (x: number, y: number, i: number, r: number) => {
      const a = time * 3 + i * 2.1;
      const fx = x + Math.cos(a) * r,
        fy = y + Math.sin(a * 1.3) * r * 0.7;
      ctx.fillStyle = "rgba(216,255,122,0.35)";
      ctx.fillRect(Math.round(fx) - 2, Math.round(fy) - 2, 5, 5);
      ctx.fillStyle = i % 2 ? "#e8ff8a" : "#a6f08e";
      ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1);
    };
    for (const r of this.roots) {
      if (r.warn <= 0) continue;
      const k = Math.max(0, 1 - r.warn / (KING_ROOT_WARN + DARK_EXTRA));
      const n = 2 + Math.round(k * 5);
      for (let i = 0; i < n; i++) fly(r.x, r.y + 4, i, 4 + (1 - k) * 18);
    }
    for (const t of this.thorns) {
      if (t.warn <= 0) continue;
      const lo = ROOM.wall,
        hi = (t.vertical ? ROOM.h : ROOM.w) - ROOM.wall;
      for (let s = lo + 8, i = 0; s < hi; s += 18, i++) {
        if (s > t.gap && s < t.gap + THORN_GAP) continue;
        fly(t.vertical ? t.at : s, t.vertical ? s : t.at, i, 3);
      }
    }
    for (const f of this.flowers) {
      if (f.hp <= 0) continue;
      // gul o'zi nur sochadi: qorong'ida ham ko'rinadi
      ctx.fillStyle = `rgba(224,103,154,${0.22 + 0.08 * Math.sin(time * 5 + f.x)})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y - 12, 9, 0, Math.PI * 2);
      ctx.fill();
      this.renderFlower(ctx, f, time);
    }
  }

  /** Qorong'ida ham ko'rinadigan yonib turgan ko'zlar (qorong'ilik ustidan chiziladi). */
  renderEyes(ctx: CanvasRenderingContext2D) {
    if (this.dead || this.spawn > 0) return;
    // ko'zlar sprite'da markazdan ±6 px, 7 px yuqorida (ikki tomonga ham simmetrik)
    const x = Math.round(this.x),
      y = Math.round(this.y - 8);
    ctx.fillStyle = "rgba(216,255,122,0.3)";
    ctx.fillRect(x - 10, y - 2, 8, 6);
    ctx.fillRect(x + 2, y - 2, 8, 6);
    ctx.fillStyle = "#d8ff7a";
    ctx.fillRect(x - 8, y, 4, 2);
    ctx.fillRect(x + 4, y, 4, 2);
  }
}
