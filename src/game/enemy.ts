import { Animator, Body, updatePhysics, isFlashing, clampToRoom, ROOM } from "./animation";
import type { Player } from "./player";
import { renderSprite } from "./sprites";

export type EnemyKind = "blob" | "wisp" | "rammer" | "archer";

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
  /** O'yin olib ketadigan o'qlar (kamonchi) */
  shots: Arrow[] = [];
  /** Sprite chapga aks ettiriladi (o'yinchiga qarab) */
  facingLeft = false;
  /** Kamonchi: qo'yib yuborish kadri qolgan vaqti */
  private releaseTimer = 0;
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
    this.hp = this.maxHp = kind === "blob" ? 3 : kind === "wisp" ? 2 : kind === "archer" ? 3 : 4;
    this.size = kind === "rammer" || kind === "archer" ? 14 : 11;
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

  update(dt: number, p: Player) {
    if (this.spawn > 0) {
      this.spawn -= dt;
      this.anim.update(dt);
      return;
    }
    this.anim.update(dt);
    updatePhysics(this, dt);
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
    const m = this.speedMul;

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

  /** Kamonchi kadri Animator taymeri emas, otish vaqti bilan boshqariladi. */
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
    renderSprite(
      ctx,
      this.kind === "rammer"
        ? "skeleton"
        : this.kind === "archer"
          ? "archer"
          : this.kind === "blob"
            ? "slime"
            : "bat",
      state,
      frame,
      this.x,
      this.kind === "rammer" || this.kind === "archer" ? this.y : this.y - 3,
      isFlashing(this) || state === "hurt",
      this.facingLeft,
    );
    ctx.globalAlpha = 1;
  }
}
