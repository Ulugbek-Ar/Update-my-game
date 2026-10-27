import { Animator, Body, updatePhysics, isFlashing, clampToRoom } from "./animation";
import type { Input } from "./input";
import { renderSprite } from "./sprites";
import { sfx } from "./audio";
import type { Hero } from "./hero";

export const PLAYER_MAX_HP = 6;
const ATTACK_TIME = 0.24;
const HURT_TIME = 0.25;
const INVULN = 0.8;
const DASH_TIME = 0.16;
const DASH_SPEED = 270;
/** Kuchli (aylana) zarba: shuncha bosib turib qo'yib yuborish kerak */
export const CHARGE_TIME = 0.6;
export const SPIN_CD = 3;
export const SPIN_TIME = 0.3;
/** Sehrgar */
export const MAGE_MAX_HP = 5;
export const TELEPORT_DIST = 50;
const TELEPORT_TIME = 0.12;

/** Sehrgarning sehrli shari */
export interface Bolt {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  /** Yana nechta dushmanga tega oladi */
  left: number;
  /** Allaqachon tekkanlar (teshuvchi shar bir dushmanga ikki marta tegmaydi) */
  hit: object[];
}

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
  /** Ketma-ket qolgan dashlar (Ikki karra dash bilan 2 ta) */
  dashCharges = 1;
  /** Hujum tugmasi bosib turilgan vaqt */
  charge = 0;
  spinTimer = 0;
  spinCooldown = 0;
  // Kuchaytirishlar o'zgartiradigan ko'rsatkichlar
  speed = 90;
  damage = 1;
  reach = 16;
  attackCd = 0.4;
  dashCd = 0.8;
  /** 0 — yo'q, aks holda har N o'ldirishda +1 yurak */
  lifesteal = 0;
  dashMax = 1;
  /** Zarba yeganda yaqin dushmanga 1 zarar */
  thorns = false;
  /** Sehrli shar tezligi (Sehrgar) */
  boltSpeed = 170;
  boltSize = 6;
  /** Bir zarbadagi sharlar soni (Uch shar) */
  multishot = 1;
  /** Shar nechta dushmandan o'tib keta oladi (Teshuvchi shar) */
  pierce = 0;
  /** Muz qalqoni: zarba yeganda atrofdagi dushmanlar sekinlashadi */
  frost = false;
  /** Shu kadrda otilgan sharlar — Game o'ziga oladi */
  bolts: Bolt[] = [];
  /** Teleport boshlangan nuqta — Game effekt chizib, null qiladi */
  teleportFrom: { x: number; y: number } | null = null;
  /** Joriy hujumda allaqachon urilganlar */
  hitSet = new Set<object>();
  anim = new Animator({
    idle: { frames: 2, frameTime: 0.5, loop: true },
    walk: { frames: 4, frameTime: 0.12, loop: true },
    attack: { frames: 3, frameTime: ATTACK_TIME / 3, loop: false },
    hurt: { frames: 1, frameTime: HURT_TIME, loop: false },
    death: { frames: 3, frameTime: 1 / 3, loop: false },
  });

  constructor(public hero: Hero = "knight") {
    if (hero === "mage") {
      this.hp = this.maxHp = MAGE_MAX_HP;
      this.speed = 95;
      this.attackCd = 0.45;
      this.dashCd = 0.9;
    }
  }

  get mage() {
    return this.hero === "mage";
  }

  get dead() {
    return this.anim.state === "death";
  }

  get dashing() {
    return this.dashTimer > 0;
  }

  get spinning() {
    return this.spinTimer > 0;
  }

  /** Kuchli zarba tayyor va tugma yetarlicha bosib turilgan. */
  get charged() {
    return this.charge >= CHARGE_TIME;
  }

  /** Joriy zarba zarari: aylana zarba 2x. */
  get hitDamage() {
    return this.spinning ? this.damage * 2 : this.damage;
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
    this.charge = 0;
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
    // aylana zarba — o'yinchi atrofidagi katta maydon
    if (this.spinning) return { x: this.x, y: this.y, size: this.reach * 2.4 } as Body;
    // Sehrgarning oddiy zarbasi — shar, u alohida uchadi
    if (this.attackTimer <= 0 || this.mage) return null;
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
    this.spinCooldown -= dt;
    if (this.dashCooldown <= 0) this.dashCharges = this.dashMax;
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.spinTimer > 0) this.spinTimer -= dt;

    const wantAttack = input.consumeAttack();
    const wantDash = input.consumeDash();
    const { x, y } = input.axis();

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      if (this.mage) return;
      this.x += this.dashX * DASH_SPEED * dt;
      this.y += this.dashY * DASH_SPEED * dt;
      clampToRoom(this);
      return;
    }

    if (wantDash && this.dashCharges > 0 && this.hurtTimer <= 0) {
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
      this.dashCharges--;
      this.dashCooldown = this.dashCd;
      this.attackTimer = 0;
      this.charge = 0;
      sfx.dash();
      if (this.mage) {
        // teleport: bir zumda sakrab o'tadi, qisqa vaqt ko'rinmaydi va daxlsiz
        this.teleportFrom = { x: this.x, y: this.y };
        this.x += this.dashX * TELEPORT_DIST;
        this.y += this.dashY * TELEPORT_DIST;
        this.dashTimer = TELEPORT_TIME;
        clampToRoom(this);
        this.anim.set("idle");
        return;
      }
      this.anim.set("walk");
      return;
    }

    // bosib turish -> qo'yib yuborilganda aylana zarba
    if (input.attackHeld()) {
      if (this.spinCooldown <= 0 && this.hurtTimer <= 0 && !this.spinning) this.charge += dt;
    } else {
      if (this.charged && this.spinCooldown <= 0) {
        this.spinTimer = SPIN_TIME;
        this.spinCooldown = SPIN_CD;
        this.attackTimer = 0;
        this.hitSet.clear();
        sfx.spin();
        this.anim.set("attack", true);
      }
      this.charge = 0;
    }

    if (wantAttack && this.cooldown <= 0 && this.hurtTimer <= 0 && !this.spinning) {
      this.attackTimer = ATTACK_TIME;
      this.cooldown = this.attackCd;
      this.hitSet.clear();
      sfx.attack();
      this.anim.set("attack", true);
      if (this.mage) {
        // Uch shar: yelpig'ich bo'lib uchadi
        const base = Math.atan2(this.fy, this.fx);
        for (let i = 0; i < this.multishot; i++) {
          const a = base + (i - (this.multishot - 1) / 2) * 0.28;
          this.bolts.push({
            x: this.x + this.fx * 8,
            y: this.y + this.fy * 8 - 2,
            vx: Math.cos(a) * this.boltSpeed,
            vy: Math.sin(a) * this.boltSpeed,
            size: this.boltSize,
            left: 1 + this.pierce,
            hit: [],
          });
        }
      }
    }

    const busy = this.attackTimer > 0 || this.hurtTimer > 0 || this.spinning;
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
    // teleport paytida sehrgar ko'rinmaydi
    if (this.dashing && this.mage) return;
    if (this.dashing) ctx.globalAlpha = 0.7;
    renderSprite(
      ctx,
      this.hero,
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
