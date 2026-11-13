/**
 * 4-dunyo (Sakura bog'i) Bossi: ONI — temir gurzili ulkan qizil dev. Ikki fazali.
 *
 * 1-faza: YERGA URISH (qizil doira, so'ng kengayuvchi to'lqin — dash bilan o'tiladi) va KENG
 * SUPURISH (yo'lak ogohlantirishi). 2-faza (jonning yarmidan keyin): niqob yoriladi, tezlashadi,
 * OLOV HALQASI (avval tashqi halqa, so'ng ichki doira yonadi) va UCH ZARBALI KOMBO qo'shiladi.
 *
 * Har zarba aniq bir lahzada tegadi — Samuray uni parry qila oladi yoki mukammal chetlana oladi.
 * Gurzi zarbasi (urish, supurish, kombo) parry qilinsa Oni gandiraklab qoladi. Barcha ogohlantirish
 * ranglari — danger.ts dan.
 */
import { ROOM, isFlashing, updatePhysics } from "./animation";
import { Boss } from "./boss";
import type { BossPhase } from "./bossPower";
import { DANGER } from "./danger";
import { angleDiff } from "./enemy";
import { withAlpha } from "./hero";
import type { Target } from "./player";
import { renderSprite } from "./sprites";

export const ONI_HP = 60;
/** Shu jon ulushidan keyin 2-faza */
export const ONI_PHASE2_AT = 0.5;
const ONI_SPEED = 24;
const ONI_SPEED2 = 34;
/** Hujumlar orasidagi tanaffus: [1-faza, 2-faza] */
export const ONI_CD = [2.2, 1.5] as const;
/** 2-fazada tayyorgarliklar shuncha qisqaradi */
export const ONI_FAST = 0.8;

/** YERGA URISH: tayyorgarlik, doira radiusi, zarba nuqtasi Oni oldida shuncha uzoqda */
export const ONI_SLAM_WINDUP = 0.9;
export const ONI_SLAM_R = 34;
export const ONI_SLAM_LEAD = 16;
/** To'lqin: tezligi, eng katta radiusi, halqa yarim qalinligi */
export const ONI_WAVE_SPEED = 120;
export const ONI_WAVE_MAX = 130;
export const ONI_WAVE_W = 5;

/** KENG SUPURISH: tayyorgarlik, yo'lak uzunligi va yarim kengligi */
export const ONI_SWEEP_WINDUP = 0.8;
export const ONI_SWEEP_LEN = 130;
export const ONI_SWEEP_W = 22;

/** OLOV HALQASI: tashqi halqa ogohlantirishi, so'ng ichki doira; halqa chegaralari */
export const ONI_RING_WARN = 1;
export const ONI_RING_GAP = 0.65;
export const ONI_RING_IN = 44;
export const ONI_RING_OUT = 86;
/** Alanga ko'rinib turadigan vaqt (faqat ko'rinish — zarar bir lahzada) */
const ONI_BLAZE = 0.4;

/**
 * UCH ZARBALI KOMBO (faqat 2-fazada, shuning uchun tezlashtirilmaydi): har zarbaning tayyorgarligi,
 * masofasi va konusning yarim burchagi. Zarbalar orasi (0.4 s) katana sovishidan (0.3 s) uzunroq —
 * Samuray har zarbani alohida qaytara oladi.
 */
export const ONI_COMBO_WINDUP = [0.45, 0.4, 0.4] as const;
export const ONI_COMBO_R = 38;
export const ONI_COMBO_ARC = 1.2;
/** Kombo faqat yaqindagi o'yinchiga boshlanadi; zarbalar orasida shu tezlikda yaqinlashadi */
export const ONI_COMBO_NEAR = 70;
const ONI_COMBO_STEP = 60;

/** Yakuniy kombo zarbasi, yerga urish yoki supurish parry qilinsa Oni shuncha gandiraklaydi */
export const ONI_STAGGER = 1;
/** Kombo o'rtasidagi zarba parry qilinsa: Oni tisariladi, keyingi zarba shuncha kechikadi */
export const ONI_RECOIL = 0.12;
/** Zarbadan keyin shu vaqt ichidagi parry "gurzi zarbasi" hisoblanadi */
const MELEE_MARK = 0.15;

export type OniMove = "slam" | "sweep" | "ring" | "combo";

interface OniAttack {
  kind: OniMove;
  /** Qolgan va to'liq tayyorgarlik vaqti */
  t: number;
  total: number;
  /** Yo'nalish (rad) va zarba nuqtasi */
  a: number;
  x: number;
  y: number;
  /** Kombo: nechanchi zarba (0..2) */
  n: number;
}

/** Yerga urishdan tarqaluvchi to'lqin halqasi */
export interface OniWave {
  x: number;
  y: number;
  r: number;
  /** O'yinchiga bir marta tegadi (chetlanilsa yoki qaytarilsa — qayta urmaydi) */
  tried: boolean;
}

/** Olov halqasi: stage 0 — tashqi halqa ogohlantirishi, 1 — ichki doira ogohlantirishi */
export interface OniRing {
  x: number;
  y: number;
  stage: 0 | 1;
  t: number;
}

export class Oni extends Boss {
  override size = 30;
  attack: OniAttack | null = null;
  wave: OniWave | null = null;
  fireRing: OniRing | null = null;
  /** Keyingi hujumgacha */
  cd = 2;
  /** Navbatdagi hujum tartib raqami */
  turn = 0;
  /** Parry qilingach gandiraklash; zarbadan keyingi ochiq qolish */
  stagger = 0;
  recover = 0;
  /** Gurzi siltanishining yoyi (ko'rinish): qolgan vaqt va yo'nalish */
  swing = 0;
  swingA = 0;
  /** Alanga ko'rinishi: qolgan vaqt, qaysi qism (0 — tashqi halqa, 1 — ichki doira) va markazi */
  blaze = 0;
  blazePart: 0 | 1 = 0;
  blazeX = 0;
  blazeY = 0;
  /** Shu kadrda olov halqasi yondi (Game ovoz beradi) */
  justIgnited = false;
  private meleeT = 0;

  constructor(hp = ONI_HP) {
    super(hp);
    this.y = 74;
  }

  /** 2-faza: niqob yorilgan */
  get cracked() {
    return this.phase >= 2;
  }

  protected override phaseAt(): BossPhase {
    return this.hp <= this.maxHp * ONI_PHASE2_AT ? 2 : 1;
  }

  protected override phaseEdge() {
    return this.phase === 1 ? this.maxHp * ONI_PHASE2_AT : 0;
  }

  override get phaseMarks(): readonly number[] {
    return [ONI_PHASE2_AT];
  }

  /** Niqob yoriladi: joriy hujum uziladi, to'lqin va olov so'nadi, yangi tartib boshlanadi. */
  protected override onPhase(_ph: BossPhase) {
    this.attack = null;
    this.wave = null;
    this.fireRing = null;
    this.recover = 0;
    this.stagger = 0;
    this.turn = 0;
    this.cd = 1.4;
  }

  /**
   * Gurzi zarbasi parry qilindi. Kombo o'rtasida — Oni tisariladi va keyingi zarba biroz kechikadi
   * (uchala zarbani ketma-ket qaytarish mumkin). Yakuniy kombo zarbasi, yerga urish yoki supurish
   * qaytarilsa — Oni gandiraklab ochiq qoladi (true). Olov halqasi va to'lqin gurzi emas — javob yo'q.
   */
  override parried() {
    if (this.meleeT <= 0 || this.dead) return false;
    this.meleeT = 0;
    const at = this.attack;
    if (at?.kind === "combo") {
      at.t += ONI_RECOIL;
      at.total += ONI_RECOIL;
      this.vx = -Math.cos(at.a) * 70;
      this.vy = -Math.sin(at.a) * 70;
      return false;
    }
    this.attack = null;
    this.recover = 0;
    this.stagger = ONI_STAGGER;
    this.cd = Math.max(this.cd, 0.8);
    return true;
  }

  /** Tayyorgarlik vaqti (2-fazada qisqaroq) */
  private windupOf(base: number) {
    return this.phase >= 2 ? base * ONI_FAST : base;
  }

  private show(frame: number) {
    this.anim.set("attack");
    this.anim.frame = frame;
    this.anim.t = 0;
  }

  protected override step(dt: number, p: Target) {
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
    if (this.meleeT > 0) this.meleeT -= dt;
    if (this.swing > 0) this.swing -= dt;
    if (this.blaze > 0) this.blaze -= dt;
    if (this.dead) {
      this.attack = null;
      this.wave = null;
      this.fireRing = null;
      return;
    }
    this.updateWave(dt, p);
    this.updateRing(dt, p);
    if (this.stagger > 0) {
      this.stagger -= dt;
      this.anim.set("hurt");
      return;
    }
    if (this.recover > 0) {
      this.recover -= dt;
      this.show(2);
      return;
    }
    const dx = p.x - this.x,
      dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    if (this.attack) return this.updateAttack(dt, p, d);
    if (dx !== 0) this.facingLeft = dx < 0;
    this.cd -= dt;
    if (this.cd <= 0 && !this.invulnerable) return this.startAttack(dx, dy, d);
    if (d > 26) {
      const sp = (this.phase >= 2 ? ONI_SPEED2 : ONI_SPEED) * (this.slow > 0 ? 0.5 : 1);
      this.x += (dx / d) * sp * dt;
      this.y += (dy / d) * sp * dt;
      this.anim.set("walk");
    } else this.anim.set("idle");
  }

  /** Navbatdagi hujum: 1-fazada urish va supurish, 2-fazada kombo va olov halqasi qo'shiladi. */
  private startAttack(dx: number, dy: number, d: number) {
    const order: readonly OniMove[] =
      this.phase >= 2 ? ["combo", "slam", "ring", "sweep"] : ["slam", "sweep"];
    let kind = order[this.turn++ % order.length]!;
    // uzoqdagi o'yinchiga kombo yetmaydi — o'rniga supuradi
    if (kind === "combo" && d > ONI_COMBO_NEAR) kind = "sweep";
    const a = Math.atan2(dy, dx);
    this.facingLeft = Math.cos(a) < 0;
    this.justWarned = true;
    const total =
      kind === "slam"
        ? this.windupOf(ONI_SLAM_WINDUP)
        : kind === "sweep"
          ? this.windupOf(ONI_SWEEP_WINDUP)
          : kind === "ring"
            ? ONI_RING_WARN + ONI_RING_GAP
            : ONI_COMBO_WINDUP[0];
    const lead = kind === "slam" ? Math.min(ONI_SLAM_LEAD, d) : 0;
    this.attack = {
      kind,
      t: total,
      total,
      a,
      x: this.x + Math.cos(a) * lead,
      y: this.y + Math.sin(a) * lead,
      n: 0,
    };
    if (kind === "ring") this.fireRing = { x: this.x, y: this.y, stage: 0, t: ONI_RING_WARN };
    this.show(0);
  }

  private endAttack(recover: number) {
    this.attack = null;
    this.recover = recover;
    this.cd = ONI_CD[this.phase >= 2 ? 1 : 0];
  }

  private updateAttack(dt: number, p: Target, d: number) {
    const at = this.attack!;
    at.t -= dt;
    if (at.kind === "slam") {
      if (at.t > 0) return this.show(0);
      // gurzi yerga tushdi: doira ichida zarar, so'ng to'lqin tarqaladi
      this.justSlammed = true;
      this.shock = 0.3;
      this.meleeT = MELEE_MARK;
      if (Math.hypot(p.x - at.x, p.y - at.y) < ONI_SLAM_R + p.size / 2)
        p.takeHit(this.dmg(1), this.x, this.y, 220);
      this.wave = { x: at.x, y: at.y, r: ONI_SLAM_R, tried: false };
      return this.endAttack(0.5);
    }
    if (at.kind === "sweep") {
      if (at.t > 0) return this.show(at.t > at.total * 0.35 ? 0 : 1);
      this.justSlammed = true;
      this.meleeT = MELEE_MARK;
      this.swing = 0.22;
      this.swingA = at.a;
      if (this.inLane(p, at)) p.takeHit(this.dmg(1), this.x, this.y, 240);
      return this.endAttack(0.55);
    }
    if (at.kind === "ring") {
      // bo'kirib turadi: olovni updateRing yoqadi
      this.show(0);
      if (at.t <= 0) this.endAttack(0.2);
      return;
    }
    // kombo: tayyorgarlik paytida o'yinchi tomonga qadam tashlaydi
    if (at.t > 0) {
      if (d > 22) {
        this.x += Math.cos(at.a) * ONI_COMBO_STEP * dt;
        this.y += Math.sin(at.a) * ONI_COMBO_STEP * dt;
      }
      return this.show(at.t > at.total * 0.4 ? 0 : 1);
    }
    this.meleeT = MELEE_MARK;
    this.swing = 0.18;
    this.swingA = at.a;
    const last = at.n >= ONI_COMBO_WINDUP.length - 1;
    if (last) this.justSlammed = true;
    if (this.inCone(p, at.a)) p.takeHit(this.dmg(1), this.x, this.y, last ? 240 : 150);
    // zarba parry qilingan bo'lsa parried() kombonni allaqachon uzgan
    if (this.attack !== at) return;
    if (last) return this.endAttack(0.7);
    at.n++;
    at.a = Math.atan2(p.y - this.y, p.x - this.x);
    at.t = at.total = ONI_COMBO_WINDUP[at.n]!;
    this.facingLeft = Math.cos(at.a) < 0;
    this.justWarned = true;
    this.show(0);
  }

  /** O'yinchi supurish yo'lagi ichidami (yo'lak Onidan a yo'nalishida cho'zilgan). */
  inLane(p: { x: number; y: number; size: number }, at: { x: number; y: number; a: number }) {
    const cx = Math.cos(at.a),
      sy = Math.sin(at.a);
    const lx = (p.x - at.x) * cx + (p.y - at.y) * sy;
    const ly = -(p.x - at.x) * sy + (p.y - at.y) * cx;
    return lx > -8 && lx < ONI_SWEEP_LEN + p.size / 2 && Math.abs(ly) < ONI_SWEEP_W + p.size / 2;
  }

  /** O'yinchi kombo zarbasining konusi ichidami. */
  inCone(p: { x: number; y: number; size: number }, a: number) {
    const dx = p.x - this.x,
      dy = p.y - this.y;
    if (Math.hypot(dx, dy) > ONI_COMBO_R + p.size / 2) return false;
    return Math.abs(angleDiff(Math.atan2(dy, dx), a)) <= ONI_COMBO_ARC;
  }

  /** To'lqin halqasi kengayadi; o'yinchiga yetganda bir marta zarba (dash bilan o'tib ketiladi). */
  private updateWave(dt: number, p: Target) {
    const w = this.wave;
    if (!w) return;
    w.r += ONI_WAVE_SPEED * dt;
    if (!w.tried) {
      const d = Math.hypot(p.x - w.x, p.y - w.y);
      if (Math.abs(d - w.r) < ONI_WAVE_W + p.size / 2) {
        w.tried = true;
        p.takeHit(this.dmg(1), w.x, w.y, 160);
      }
    }
    if (w.r >= ONI_WAVE_MAX) this.wave = null;
  }

  /** Olov halqasi: avval tashqi halqa yonadi, biroz keyin ichki doira (har biri bir lahzada). */
  private updateRing(dt: number, p: Target) {
    const r = this.fireRing;
    if (!r) return;
    r.t -= dt;
    if (r.t > 0) return;
    const d = Math.hypot(p.x - r.x, p.y - r.y);
    const half = p.size / 2;
    const hit =
      r.stage === 0 ? d > ONI_RING_IN - half && d < ONI_RING_OUT + half : d < ONI_RING_IN + half;
    this.justIgnited = true;
    this.blaze = ONI_BLAZE;
    this.blazePart = r.stage;
    this.blazeX = r.x;
    this.blazeY = r.y;
    if (hit) p.takeHit(this.dmg(1), r.x, r.y, 120);
    if (r.stage === 0) {
      r.stage = 1;
      r.t = ONI_RING_GAP;
    } else this.fireRing = null;
  }

  override renderFloor(ctx: CanvasRenderingContext2D, time = 0) {
    if (this.dead) return;
    const pulse = 0.45 + 0.35 * Math.sin(time * 28);
    const at = this.attack;
    if (at?.kind === "slam") {
      const k = 1 - Math.max(0, at.t) / at.total;
      ctx.fillStyle = withAlpha(DANGER.oniSlam, 0.08 + 0.2 * k);
      ctx.strokeStyle = withAlpha(DANGER.oniSlam, pulse);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(at.x, at.y, ONI_SLAM_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // ichkaridan to'lib boruvchi doira — zarba qachon tushishini ko'rsatadi
      ctx.fillStyle = withAlpha(DANGER.oniSlam, 0.16);
      ctx.beginPath();
      ctx.arc(at.x, at.y, ONI_SLAM_R * k, 0, Math.PI * 2);
      ctx.fill();
    }
    if (at?.kind === "sweep") {
      const k = 1 - Math.max(0, at.t) / at.total;
      ctx.save();
      ctx.translate(at.x, at.y);
      ctx.rotate(at.a);
      ctx.fillStyle = withAlpha(DANGER.oniSweep, 0.08 + 0.18 * k);
      ctx.fillRect(-8, -ONI_SWEEP_W, ONI_SWEEP_LEN + 8, ONI_SWEEP_W * 2);
      ctx.fillStyle = withAlpha(DANGER.oniSweep, 0.16);
      ctx.fillRect(-8, -ONI_SWEEP_W, (ONI_SWEEP_LEN + 8) * k, ONI_SWEEP_W * 2);
      ctx.strokeStyle = withAlpha(DANGER.oniSweep, pulse);
      ctx.lineWidth = 1;
      ctx.strokeRect(-8, -ONI_SWEEP_W, ONI_SWEEP_LEN + 8, ONI_SWEEP_W * 2);
      ctx.restore();
    }
    if (at?.kind === "combo") {
      const k = 1 - Math.max(0, at.t) / at.total;
      ctx.fillStyle = withAlpha(DANGER.oniSlam, 0.1 + 0.2 * k);
      ctx.strokeStyle = withAlpha(DANGER.oniSlam, pulse);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.arc(this.x, this.y, ONI_COMBO_R, at.a - ONI_COMBO_ARC, at.a + ONI_COMBO_ARC);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    const r = this.fireRing;
    if (r) {
      const total = r.stage === 0 ? ONI_RING_WARN : ONI_RING_GAP;
      const k = 1 - Math.max(0, r.t) / total;
      ctx.fillStyle = withAlpha(DANGER.oniRing, 0.08 + 0.2 * k);
      ctx.strokeStyle = withAlpha(DANGER.oniRing, pulse);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (r.stage === 0) {
        ctx.arc(r.x, r.y, ONI_RING_OUT, 0, Math.PI * 2);
        ctx.arc(r.x, r.y, ONI_RING_IN, 0, Math.PI * 2, true);
        ctx.fill("evenodd");
        ctx.beginPath();
        ctx.arc(r.x, r.y, ONI_RING_OUT, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(r.x, r.y, ONI_RING_IN, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.arc(r.x, r.y, ONI_RING_IN, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    if (this.blaze > 0) {
      // alanga: yongan qism qisqa vaqt porlaydi
      const k = this.blaze / ONI_BLAZE;
      ctx.fillStyle = withAlpha(DANGER.oniRing, 0.55 * k);
      ctx.beginPath();
      if (this.blazePart === 0) {
        ctx.arc(this.blazeX, this.blazeY, ONI_RING_OUT, 0, Math.PI * 2);
        ctx.arc(this.blazeX, this.blazeY, ONI_RING_IN, 0, Math.PI * 2, true);
        ctx.fill("evenodd");
      } else {
        ctx.arc(this.blazeX, this.blazeY, ONI_RING_IN, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const w = this.wave;
    if (w) {
      const fade = Math.max(0, 1 - (w.r - ONI_SLAM_R) / (ONI_WAVE_MAX - ONI_SLAM_R));
      ctx.strokeStyle = withAlpha(DANGER.oniSlam, 0.35 + 0.5 * fade);
      ctx.lineWidth = ONI_WAVE_W * 2 - 2;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,220,180,${0.4 + 0.5 * fade})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r + ONI_WAVE_W - 1, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  override render(ctx: CanvasRenderingContext2D) {
    const { state, frame } = this.showFrame();
    if (this.spawn > 0) {
      const k = 1 - this.spawn / this.spawnMax;
      ctx.fillStyle = withAlpha(DANGER.spawn, 0.25 + 0.2 * Math.sin(this.spawn * 18));
      ctx.beginPath();
      ctx.arc(this.x, this.y + 8, 10 + 28 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = k;
    }
    if (this.shock > 0) {
      ctx.fillStyle = `rgba(255,190,120,${this.shock * 1.6})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y + 6, ONI_SLAM_R * (1.2 - this.shock), 0, Math.PI * 2);
      ctx.fill();
    }
    // gandiraklaganda biroz chayqaladi
    const sway = this.stagger > 0 ? Math.round(Math.sin(this.stagger * 30) * 2) : 0;
    renderSprite(
      ctx,
      "oni",
      state,
      frame,
      this.x + sway,
      this.y - 8,
      isFlashing(this) || (state === "hurt" && this.stagger <= 0),
      this.facingLeft,
      this.cracked,
    );
    if (this.swing > 0) {
      // gurzi siltanishi: yo'nalish bo'ylab oq-sariq yoy
      const k = this.swing / 0.22;
      ctx.strokeStyle = `rgba(255,236,200,${0.75 * k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, ONI_COMBO_R - 4, this.swingA - 1.1, this.swingA + 1.1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Xavfsiz maydon: Oni arenani toraytirmaydi. */
  override safeRect() {
    return { l: ROOM.wall, t: ROOM.wall, r: ROOM.w - ROOM.wall, b: ROOM.h - ROOM.wall };
  }
}
