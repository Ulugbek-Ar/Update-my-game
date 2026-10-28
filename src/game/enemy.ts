import { Animator, Body, updatePhysics, isFlashing, clampToRoom, ROOM } from "./animation";
import type { Player } from "./player";
import { renderSprite } from "./sprites";

export type EnemyKind = "blob" | "wisp" | "rammer" | "archer" | "shield";

const SPAWN_TIME = 1;
export const ARCHER_RELOAD = 1.5;
/** Kamonchi tortish vaqti: o'q chiqishidan oldingi to'xtash */
export const ARCHER_DRAW = 0.55;
/** Tortishning boshida "o'qni qo'yish" kadri (attack 0), qolgani — to'liq tortish (attack 1) */
export const ARCHER_NOCK = 0.2;
/** O'q chiqqach "qo'yib yuborish" kadri (attack 2) shuncha ko'rinadi */
export const ARCHER_RELEASE = 0.2;
/** O'q kamondan chiqadigan nuqta (sprite markaziga nisbatan, o'yinchi tomonga) */
export const BOW_OFFSET_X = 11;
export const BOW_OFFSET_Y = -2;
const ARROW_SPEED = 110;
/** Qalqonli skelet: qalqon burilish tezligi (rad/s, ~90°/s) */
export const SHIELD_TURN = Math.PI / 2;
/** Qalqon oldidan kelgan zarbani to'sadi: shu burchak ichida (±60°) */
export const SHIELD_ARC = Math.PI / 3;
/** Qalqon bilan itarish: tayyorgarlik, masofa, qayta tiklanish */
export const BASH_WINDUP = 0.5;
export const BASH_RANGE = 24;
export const BASH_CD = 1.6;
/** Sekin yuradi (skelet jangchi 160 bilan yuguradi) */
const SHIELD_SPEED = 26;

export interface Arrow {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * blob   – sekin, sakrab-sakrab o'yinchini quvadi
 * wisp   – tez, to'lqinsimon (sinus) uchib aylanadi
 * rammer – to'xtab nishon oladi, so'ng tez yugurib uriladi
 * archer – masofani saqlaydi va har 1.5s da o'q otadi
 * shield – sekin yuradi, qalqon bilan oldidan zarbani to'sadi, yaqinda qalqon bilan itaradi
 */
export class Enemy implements Body {
  vx = 0;
  vy = 0;
  flash = 0;
  hp: number;
  maxHp: number;
  size: number;
  t = Math.random() * 3;
  aiTimer = 1;
  dashX = 0;
  dashY = 0;
  dashing = false;
  removed = false;
  /** Paydo bo'lish vaqti: bu paytda zarar bermaydi va olmaydi */
  spawn = 0;
  spawnMax = SPAWN_TIME;
  /** To'lqin oshgani sari biroz tezlashadi */
  speedMul = 1;
  /** Muz qalqoni: shuncha soniya yarim tezlikda yuradi */
  slow = 0;
  /** O'yin olib ketadigan o'qlar (kamonchi) */
  shots: Arrow[] = [];
  /** Sprite chapga aks ettiriladi (o'yinchiga qarab) */
  facingLeft = false;
  /** Kamonchi: qo'yib yuborish kadri qolgan vaqti */
  private releaseTimer = 0;
  /** Qalqonli skelet: qalqon qaragan burchak (rad) */
  shieldAngle = 0;
  /** Qalqon bilan itarish tayyorgarligi (0 — tayyorlanmayapti) */
  bashTimer = 0;
  bashCd = 0;
  /** Qalqon to'sganda qisqa yaltirash */
  blockFlash = 0;
  anim = new Animator({
    idle: { frames: 2, frameTime: 0.4, loop: true },
    walk: { frames: 4, frameTime: 0.14, loop: true },
    attack: { frames: 3, frameTime: 0.55 / 3, loop: false },
    hurt: { frames: 1, frameTime: 0.2, loop: false },
    death: { frames: 3, frameTime: 0.16, loop: false },
  });

  constructor(
    public kind: EnemyKind,
    public x: number,
    public y: number,
  ) {
    this.hp = this.maxHp =
      kind === "blob" ? 3 : kind === "wisp" ? 2 : kind === "archer" ? 3 : kind === "shield" ? 5 : 4;
    this.size = kind === "rammer" || kind === "archer" || kind === "shield" ? 14 : 11;
    if (kind === "archer") this.aiTimer = ARCHER_RELOAD;
  }

  get dead() {
    return this.anim.state === "death";
  }

  get active() {
    return !this.dead && this.spawn <= 0;
  }

  /** Rammer nishon olayotganini ko'rsatish uchun */
  get aiming() {
    return this.kind === "rammer" && !this.dashing && this.aiTimer < 0.35 && this.active;
  }

  /** Qalqon (fromX, fromY) tomondan kelgan zarbani to'sadimi. */
  blocks(fromX: number, fromY: number) {
    if (this.kind !== "shield" || this.dead) return false;
    const a = Math.atan2(fromY - this.y, fromX - this.x);
    return Math.abs(angleDiff(a, this.shieldAngle)) <= SHIELD_ARC;
  }

  update(dt: number, p: Player) {
    if (this.blockFlash > 0) this.blockFlash -= dt;
    if (this.spawn > 0) {
      // paydo bo'layotganda qalqon darhol o'yinchiga qaraydi
      if (this.kind === "shield") this.shieldAngle = Math.atan2(p.y - this.y, p.x - this.x);
      this.spawn -= dt;
      this.anim.update(dt);
      return;
    }
    this.anim.update(dt);
    updatePhysics(this, dt);
    if (this.slow > 0) this.slow -= dt;
    if (this.dead) {
      if (this.anim.done) this.removed = true;
      return;
    }
    if (this.anim.state === "hurt") {
      if (this.anim.done) this.anim.set("walk");
      return;
    }
    this.t += dt;
    const dx = p.x - this.x,
      dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    if (dx !== 0) this.facingLeft = dx < 0;
    const m = this.speedMul * (this.slow > 0 ? 0.5 : 1);

    if (this.kind === "blob") {
      // sakrash: harakat faqat sinus musbat bo'lganda
      const hop = Math.max(0, Math.sin(this.t * 5));
      this.x += (dx / d) * 45 * m * hop * dt;
      this.y += (dy / d) * 45 * m * hop * dt;
      this.anim.set(hop > 0 ? "walk" : "idle");
    } else if (this.kind === "wisp") {
      const px_ = -dy / d,
        py_ = dx / d; // perpendikulyar
      const wave = Math.sin(this.t * 4) * 70;
      this.x += ((dx / d) * 55 * m + px_ * wave) * dt;
      this.y += ((dy / d) * 55 * m + py_ * wave) * dt;
      this.anim.set("walk");
    } else if (this.kind === "shield") {
      // qalqon o'yinchiga qarab asta buriladi
      const turn = angleDiff(Math.atan2(dy, dx), this.shieldAngle);
      this.shieldAngle += Math.sign(turn) * Math.min(Math.abs(turn), SHIELD_TURN * dt);
      this.facingLeft = Math.cos(this.shieldAngle) < 0;
      if (this.bashCd > 0) this.bashCd -= dt;
      if (this.bashTimer > 0) {
        // tayyorgarlik: qalqon oldinga cho'ziladi (attack 0 -> 1), so'ng itarish (attack 2)
        this.bashTimer -= dt;
        if (this.bashTimer <= 0) {
          this.bashCd = BASH_CD;
          this.showAttackFrame(2);
          if (d < BASH_RANGE + p.size / 2 && this.blocks(p.x, p.y))
            p.takeHit(1, this.x, this.y, 200);
        } else this.showAttackFrame(this.bashTimer > BASH_WINDUP / 2 ? 0 : 1);
      } else if (this.bashCd > BASH_CD - 0.25) {
        this.showAttackFrame(2);
      } else if (d < BASH_RANGE && this.bashCd <= 0) {
        this.bashTimer = BASH_WINDUP;
        this.showAttackFrame(0);
      } else if (d > 16) {
        this.x += (dx / d) * SHIELD_SPEED * m * dt;
        this.y += (dy / d) * SHIELD_SPEED * m * dt;
        this.anim.set("walk");
      } else this.anim.set("idle");
    } else if (this.kind === "archer") {
      // 70..110 oralig'ida turadi: yaqinlashsa qochadi, uzoqlashsa yaqinlashadi, aks holda yonga yuradi
      const away = d < 70 ? -1 : d > 110 ? 1 : 0;
      const side = Math.sin(this.t * 0.9) > 0 ? 1 : -1;
      const sx = away ? (dx / d) * away : (-dy / d) * side * 0.5;
      const sy = away ? (dy / d) * away : (dx / d) * side * 0.5;
      this.aiTimer -= dt;
      if (this.releaseTimer > 0) this.releaseTimer -= dt;
      if (this.aiTimer <= 0) {
        // o'q kamondan chiqadi — aynan shu kadrda "qo'yib yuborish" ko'rinadi
        const bx = Math.max(
          ROOM.wall + 1,
          Math.min(ROOM.w - ROOM.wall - 1, this.x + (this.facingLeft ? -1 : 1) * BOW_OFFSET_X),
        );
        const by = this.y + BOW_OFFSET_Y;
        const ad = Math.hypot(p.x - bx, p.y - by) || 1;
        this.shots.push({
          x: bx,
          y: by,
          vx: ((p.x - bx) / ad) * ARROW_SPEED,
          vy: ((p.y - by) / ad) * ARROW_SPEED,
        });
        this.aiTimer += ARCHER_RELOAD;
        this.releaseTimer = ARCHER_RELEASE;
        this.showAttackFrame(2);
      } else if (this.releaseTimer > 0) {
        this.showAttackFrame(2);
      } else if (this.aiTimer <= ARCHER_DRAW) {
        // tortish paytida joyida turadi — o'yinchi uchun ogohlantirish
        this.showAttackFrame(this.aiTimer > ARCHER_DRAW - ARCHER_NOCK ? 0 : 1);
      } else {
        this.x += sx * 40 * m * dt;
        this.y += sy * 40 * m * dt;
        this.anim.set("walk");
      }
    } else {
      this.aiTimer -= dt;
      if (this.dashing) {
        this.x += this.dashX * 160 * m * dt;
        this.y += this.dashY * 160 * m * dt;
        this.anim.set("attack");
        if (this.aiTimer <= 0) {
          this.dashing = false;
          this.aiTimer = 1.2;
        }
      } else {
        this.anim.set("idle");
        if (this.aiTimer <= 0) {
          this.dashing = true;
          this.dashX = dx / d;
          this.dashY = dy / d;
          this.aiTimer = 0.55;
        }
      }
    }
    clampToRoom(this);
  }

  /** Kamonchi va qalqonli skelet kadri Animator taymeri emas, hujum vaqti bilan boshqariladi. */
  private showAttackFrame(frame: number) {
    this.anim.set("attack");
    this.anim.frame = frame;
    this.anim.t = 0;
  }

  render(ctx: CanvasRenderingContext2D) {
    const { state, frame } = this.anim;
    if (this.spawn > 0) {
      const k = 1 - this.spawn / this.spawnMax;
      ctx.strokeStyle = `rgba(200,120,255,${0.35 + 0.35 * Math.sin(this.spawn * 20)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y + 4, 4 + 8 * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = k * 0.8;
    }
    if (this.aiming) {
      ctx.fillStyle = "#ff4d4d";
      ctx.fillRect(Math.round(this.x) - 1, Math.round(this.y) - 16, 2, 4);
      ctx.fillRect(Math.round(this.x) - 1, Math.round(this.y) - 11, 2, 2);
    }
    const tall = this.kind === "rammer" || this.kind === "archer" || this.kind === "shield";
    renderSprite(
      ctx,
      this.kind === "rammer"
        ? "skeleton"
        : this.kind === "archer" || this.kind === "shield"
          ? this.kind
          : this.kind === "blob"
            ? "slime"
            : "bat",
      state,
      frame,
      this.x,
      tall ? this.y : this.y - 3,
      isFlashing(this) || state === "hurt",
      this.facingLeft,
    );
    if (this.kind === "shield" && !this.dead && this.spawn <= 0) {
      // qalqon qaragan tomon: temir yoy (to'sganda yaltiraydi)
      ctx.strokeStyle = this.blockFlash > 0 ? "rgba(255,240,170,0.95)" : "rgba(170,175,188,0.45)";
      ctx.lineWidth = this.blockFlash > 0 ? 2 : 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y + 2, 12, this.shieldAngle - SHIELD_ARC, this.shieldAngle + SHIELD_ARC);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/** a - b burchak farqi, [-PI, PI] oralig'ida. */
export function angleDiff(a: number, b: number) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
