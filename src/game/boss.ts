import { Animator, Body, updatePhysics, isFlashing } from "./animation";
import type { Player } from "./player";
import { renderSprite } from "./sprites";

export const BOSS_MAX_HP = 30;
const SLAM_WINDUP = 0.7;
const SLAM_RADIUS = 42;
const SHOT_SPEED = 75;

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
  /** Paydo bo'lish vaqti */
  spawn = 0;
  spawnMax = 1;
  /** O'yin olib ketadigan olov sharlari */
  shots: Shot[] = [];
  /** 2-fazaga o'tgan zahoti bir marta true bo'ladi */
  justEnraged = false;
  /** Zarba yerga tekkan kadrda true (ekran silkinishi uchun) */
  justSlammed = false;
  private wasEnraged = false;
  private facingLeft = false;
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

  get enraged() {
    return this.hp < this.maxHp / 2;
  }

  /** Boss kuchli itarishga chidamliroq */
  update(dt: number, p: Player) {
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
    if (this.shock > 0) this.shock -= dt;
    if (this.dead) return;

    if (this.enraged && !this.wasEnraged) {
      this.wasEnraged = true;
      this.justEnraged = true;
    }

    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) {
        this.shock = 0.3;
        this.justSlammed = true;
        if (Math.hypot(p.x - this.x, p.y - this.y) < SLAM_RADIUS + p.size / 2)
          p.takeHit(2, this.x, this.y, 260);
        if (this.enraged) {
          const n = this.hp < this.maxHp / 4 ? 12 : 8;
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
    const speed = this.enraged ? 42 : 30;
    this.x += (dx / d) * speed * dt;
    this.y += (dy / d) * speed * dt;
    this.anim.set("walk");
    if (this.slamTimer <= 0 && d < 90) {
      this.windup = SLAM_WINDUP;
      this.anim.set("attack", true);
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
