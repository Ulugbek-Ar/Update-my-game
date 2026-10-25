import { Animator, Body, updatePhysics, isFlashing, clampToRoom } from "./animation";
import type { Input } from "./input";
import { renderSprite } from "./sprites";
import { sfx } from "./audio";

export const PLAYER_MAX_HP = 6;
const ATTACK_TIME = 0.24;
const HURT_TIME = 0.25;
const INVULN = 0.8;
const DASH_TIME = 0.16;
const DASH_SPEED = 270;

export class Player implements Body {
  x = 160;
  y = 190;
  size = 12;
  vx = 0;
  vy = 0;
  hp = PLAYER_MAX_HP;
  maxHp = PLAYER_MAX_HP;
  flash = 0;
  fx = 0;
  fy = -1;
  attackTimer = 0;
  cooldown = 0;
  hurtTimer = 0;
  invuln = 0;
  dashTimer = 0;
  dashCooldown = 0;
  dashX = 0;
  dashY = 0;
  // Kuchaytirishlar o'zgartiradigan ko'rsatkichlar
  speed = 90;
  damage = 1;
  reach = 16;
  attackCd = 0.4;
  dashCd = 0.8;
  /** 0 — yo'q, aks holda har N o'ldirishda +1 yurak */
  lifesteal = 0;
  /** Joriy hujumda allaqachon urilganlar */
  hitSet = new Set<object>();
  anim = new Animator({
    idle: { frames: 2, frameTime: 0.5, loop: true },
    walk: { frames: 4, frameTime: 0.12, loop: true },
    attack: { frames: 3, frameTime: ATTACK_TIME / 3, loop: false },
    hurt: { frames: 1, frameTime: HURT_TIME, loop: false },
    death: { frames: 3, frameTime: 1 / 3, loop: false },
  });

  get dead() {
    return this.anim.state === "death";
  }

  get dashing() {
    return this.dashTimer > 0;
  }

  /** Zarba tegsa true qaytaradi. Dash paytida daxlsiz. */
  takeHit(dmg: number, fromX: number, fromY: number, force: number) {
    if (this.invuln > 0 || this.dead || this.dashing) return false;
    this.hp -= dmg;
    if (this.hp <= 0) sfx.death();
    else sfx.hurt();
    this.flash = 0.4;
    this.invuln = INVULN;
    const dx = this.x - fromX,
      dy = this.y - fromY;
    const l = Math.hypot(dx, dy) || 1;
    this.vx = (dx / l) * force;
    this.vy = (dy / l) * force;
    this.attackTimer = 0;
    if (this.hp <= 0) this.anim.set("death", true);
    else {
      this.hurtTimer = HURT_TIME;
      this.anim.set("hurt", true);
    }
    return true;
  }

  heal(n: number) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    return this.hp > before;
  }

  /** Hujum zonasi (faqat hujum vaqtida). */
  attackBox(): Body | null {
    if (this.attackTimer <= 0) return null;
    const off = this.reach * 0.75;
    return { x: this.x + this.fx * off, y: this.y + this.fy * off, size: this.reach } as Body;
  }

  update(dt: number, input: Input) {
    this.anim.update(dt);
    updatePhysics(this, dt);
    if (this.dead) return;
    this.cooldown -= dt;
    this.invuln -= dt;
    this.hurtTimer -= dt;
    this.dashCooldown -= dt;
    if (this.attackTimer > 0) this.attackTimer -= dt;

    const wantAttack = input.consumeAttack();
    const wantDash = input.consumeDash();
    const { x, y } = input.axis();

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.x += this.dashX * DASH_SPEED * dt;
      this.y += this.dashY * DASH_SPEED * dt;
      clampToRoom(this);
      return;
    }

    if (wantDash && this.dashCooldown <= 0 && this.hurtTimer <= 0) {
      let dx = x,
        dy = y;
      if (!dx && !dy) {
        dx = this.fx;
        dy = this.fy;
      }
      const l = Math.hypot(dx, dy) || 1;
      this.dashX = dx / l;
      this.dashY = dy / l;
      this.dashTimer = DASH_TIME;
      this.dashCooldown = this.dashCd;
      this.attackTimer = 0;
      sfx.dash();
      this.anim.set("walk");
      return;
    }

    if (wantAttack && this.cooldown <= 0 && this.hurtTimer <= 0) {
      this.attackTimer = ATTACK_TIME;
      this.cooldown = this.attackCd;
      this.hitSet.clear();
      sfx.attack();
      this.anim.set("attack", true);
    }

    const busy = this.attackTimer > 0 || this.hurtTimer > 0;
    if (!busy) {
      if (x || y) {
        const l = Math.max(1, Math.hypot(x, y));
        this.x += (x / l) * this.speed * dt;
        this.y += (y / l) * this.speed * dt;
        if (Math.abs(x) >= Math.abs(y)) {
          this.fx = Math.sign(x);
          this.fy = 0;
        } else {
          this.fx = 0;
          this.fy = Math.sign(y);
        }
        this.anim.set("walk");
      } else this.anim.set("idle");
    }
    clampToRoom(this);
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.dashing) ctx.globalAlpha = 0.7;
    renderSprite(
      ctx,
      "knight",
      this.anim.state,
      this.anim.frame,
      this.x,
      this.y,
      isFlashing(this) || this.anim.state === "hurt",
      this.fx < 0,
      this.fy < 0,
    );
    ctx.globalAlpha = 1;
  }
}
