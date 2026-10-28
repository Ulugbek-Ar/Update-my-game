import { Animator, Body, updatePhysics, isFlashing, clampToRoom, ROOM } from "./animation";
import type { Player } from "./player";
import { renderSprite, type SpriteKind } from "./sprites";

export type EnemyKind =
  "blob" | "wisp" | "rammer" | "archer" | "shield" | "frost" | "golem" | "iceblob" | "wolf";

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
/** Muz ruhi: shu masofaga yaqinlashib 1s tayyorlanadi, so'ng oldinga konus shaklida sovuq nafas */
export const FROST_NEAR = 34;
export const FROST_WINDUP = 1;
export const FROST_RANGE = 46;
/** Konusning yarim burchagi (±35°) */
export const FROST_ARC = 0.6;
export const FROST_CD = 2.2;
/** Nafas tekkan o'yinchi shuncha soniya sekin yuradi */
export const FROST_CHILL = 1.5;
const FROST_SPEED = 42;
/** Nafas ko'rinib turadigan vaqt */
const BREATH_SHOW = 0.35;
/** Qor odam (kind "golem"): har 3s da yerga uradi (0.8s qizil doira ogohlantiradi) */
export const STOMP_EVERY = 3;
export const STOMP_WINDUP = 0.8;
export const STOMP_RADIUS = 26;
const GOLEM_SPEED = 16;
/** Qor odam o'lganda shuncha Muz slime'ga bo'linadi */
export const GOLEM_SPLIT = 2;
/** Muz slime tegsa o'yinchi shuncha soniya sekin yuradi */
export const ICEBLOB_CHILL = 0.8;
/** Qor bo'risi: aylanib yuradi, cho'kib (ogohlantirish) sakraydi, so'ng charchab qoladi */
export const WOLF_CIRCLE = 1.6;
export const WOLF_CROUCH = 0.4;
export const WOLF_LEAP_TIME = 0.35;
export const WOLF_LEAP_SPEED = 190;
export const WOLF_TIRED = 1;
/** O'yinchidan shu masofada aylanadi */
export const WOLF_RADIUS = 55;
const WOLF_SPEED = 70;
export type WolfPhase = "circle" | "crouch" | "leap" | "tired";

/** Har dushman turining joni */
export const ENEMY_HP: Record<EnemyKind, number> = {
  blob: 3,
  wisp: 2,
  rammer: 4,
  archer: 3,
  shield: 5,
  frost: 3,
  golem: 7,
  iceblob: 2,
  wolf: 3,
};

/** Dushman turi -> sprite turi */
const SPRITE: Record<EnemyKind, SpriteKind> = {
  blob: "slime",
  wisp: "bat",
  rammer: "skeleton",
  archer: "archer",
  shield: "shield",
  frost: "frost",
  golem: "golem",
  iceblob: "iceblob",
  wolf: "wolf",
};

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
 * iceblob – muz slime: sakrab quvadi, tegsa sekinlashtiradi
 * wolf   – qor bo'risi: aylanib yuradi, cho'kib sakraydi, sakrashdan keyin charchaydi
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
  /** Muz ruhi: nafas tayyorgarligi, yo'nalishi va ko'rinish vaqti */
  breathWindup = 0;
  breathAngle = 0;
  breathShow = 0;
  /** Muz golemi: yerga urish tayyorgarligi va zarba to'lqini */
  stompWindup = 0;
  stompShock = 0;
  /** Shu kadrda golem yerga urdi (Game ovoz va silkinish beradi) */
  justStomped = false;
  heavy = false;
  ghost = false;
  /** Qor bo'risi: joriy bosqich va aylanish yo'nalishi (1 — soat mili bo'ylab, -1 — teskari) */
  wolfPhase: WolfPhase = "circle";
  orbit = Math.random() < 0.5 ? 1 : -1;
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
    this.hp = this.maxHp = ENEMY_HP[kind];
    this.size =
      kind === "golem"
        ? 20
        : kind === "wolf"
          ? 13
          : kind === "rammer" || kind === "archer" || kind === "shield"
            ? 14
            : 11;
    if (kind === "archer") this.aiTimer = ARCHER_RELOAD;
    if (kind === "golem") {
      this.heavy = true;
      this.aiTimer = STOMP_EVERY;
    }
    if (kind === "frost") {
      this.ghost = true;
      this.aiTimer = 0.6;
    }
    // juftlikdagi bo'rilar bir vaqtda sakramasligi uchun biroz farq
    if (kind === "wolf") this.aiTimer = WOLF_CIRCLE + Math.random() * 0.6;
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
    if (this.stompShock > 0) this.stompShock -= dt;
    if (this.breathShow > 0) this.breathShow -= dt;
    // sakrayotgan bo'ri zarba yesa — sakrash uziladi va charchab qoladi
    if (this.kind === "wolf" && this.anim.state === "hurt" && this.wolfPhase === "leap") {
      this.wolfPhase = "tired";
      this.aiTimer = WOLF_TIRED;
    }
    // golem zarbadan to'xtamaydi: yerga urish tayyorgarligi davom etadi
    if (this.anim.state === "hurt" && this.kind !== "golem") {
      if (this.anim.done) this.anim.set("walk");
      return;
    }
    this.t += dt;
    const dx = p.x - this.x,
      dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    if (dx !== 0) this.facingLeft = dx < 0;
    const m = this.speedMul * (this.slow > 0 ? 0.5 : 1);

    if (this.kind === "frost") this.updateFrost(dt, p, dx, dy, d, m);
    else if (this.kind === "golem") this.updateGolem(dt, p, dx, dy, d, m);
    else if (this.kind === "wolf") this.updateWolf(dt, dx, dy, d, m);
    else if (this.kind === "blob" || this.kind === "iceblob") {
      // sakrash: harakat faqat sinus musbat bo'lganda
      // muz slime — muz ustida biroz tezroq, tez-tez sakraydi
      const hop = Math.max(0, Math.sin(this.t * (this.kind === "iceblob" ? 6 : 5)));
      const speed = this.kind === "iceblob" ? 50 : 45;
      this.x += (dx / d) * speed * m * hop * dt;
      this.y += (dy / d) * speed * m * hop * dt;
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

  /** Muz ruhi: suzib yaqinlashadi, 1s tayyorlanadi, oldinga konus shaklida sovuq nafas chiqaradi. */
  private updateFrost(dt: number, p: Player, dx: number, dy: number, d: number, m: number) {
    this.aiTimer -= dt;
    if (this.breathWindup > 0) {
      this.breathWindup -= dt;
      if (this.breathWindup <= 0) {
        this.breathShow = BREATH_SHOW;
        this.aiTimer = FROST_CD;
        this.showAttackFrame(2);
        if (this.breathHits(p) && p.takeHit(1, this.x, this.y, 120)) p.chill = FROST_CHILL;
      } else this.showAttackFrame(this.breathWindup > FROST_WINDUP / 2 ? 0 : 1);
      return;
    }
    if (this.breathShow > 0) return this.showAttackFrame(2);
    if (d < FROST_NEAR && this.aiTimer <= 0) {
      // yo'nalish tayyorgarlik boshida qotadi — chetga chiqib qochish mumkin
      this.breathWindup = FROST_WINDUP;
      this.breathAngle = Math.atan2(dy, dx);
      this.showAttackFrame(0);
      return;
    }
    if (d > FROST_NEAR - 8) {
      const bob = Math.sin(this.t * 3) * 12;
      this.x += ((dx / d) * FROST_SPEED * m - (dy / d) * bob) * dt;
      this.y += ((dy / d) * FROST_SPEED * m + (dx / d) * bob) * dt;
    }
    this.anim.set("walk");
  }

  /**
   * Qor bo'risi: o'yinchini WOLF_RADIUS masofada aylanadi; vaqti kelganda 0.4s cho'kadi
   * (yo'nalish shu paytda qotadi), so'ng tez sakraydi va 1s charchab turadi.
   */
  private updateWolf(dt: number, dx: number, dy: number, d: number, m: number) {
    this.aiTimer -= dt;
    if (this.wolfPhase === "circle") {
      const radial = Math.max(-1, Math.min(1, (d - WOLF_RADIUS) / WOLF_RADIUS));
      let vx = (dx / d) * radial - (dy / d) * this.orbit,
        vy = (dy / d) * radial + (dx / d) * this.orbit;
      const l = Math.hypot(vx, vy) || 1;
      vx /= l;
      vy /= l;
      this.x += vx * WOLF_SPEED * m * dt;
      this.y += vy * WOLF_SPEED * m * dt;
      this.anim.set("walk");
      if (this.aiTimer <= 0) {
        this.wolfPhase = "crouch";
        this.aiTimer = WOLF_CROUCH;
        this.dashX = dx / d;
        this.dashY = dy / d;
        this.showAttackFrame(0);
      }
      return;
    }
    // cho'kish va sakrashda nishon tomonga qaraydi
    if (this.wolfPhase !== "tired" && this.dashX !== 0) this.facingLeft = this.dashX < 0;
    if (this.wolfPhase === "crouch") {
      this.showAttackFrame(0);
      if (this.aiTimer <= 0) {
        this.wolfPhase = "leap";
        this.aiTimer = WOLF_LEAP_TIME;
        this.showAttackFrame(1);
      }
    } else if (this.wolfPhase === "leap") {
      this.x += this.dashX * WOLF_LEAP_SPEED * m * dt;
      this.y += this.dashY * WOLF_LEAP_SPEED * m * dt;
      this.showAttackFrame(1);
      if (this.aiTimer <= 0) {
        this.wolfPhase = "tired";
        this.aiTimer = WOLF_TIRED;
        this.showAttackFrame(2);
      }
    } else {
      // charchagan: joyida hansirab turadi — urish uchun qulay payt
      this.showAttackFrame(2);
      if (this.aiTimer <= 0) {
        this.wolfPhase = "circle";
        this.aiTimer = WOLF_CIRCLE;
        this.anim.set("walk");
      }
    }
  }

  /** O'yinchi sovuq nafas konusi ichidami. */
  breathHits(p: { x: number; y: number; size: number }) {
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (d > FROST_RANGE + p.size / 2) return false;
    return (
      Math.abs(angleDiff(Math.atan2(p.y - this.y, p.x - this.x), this.breathAngle)) <= FROST_ARC
    );
  }

  /** Muz golemi: sekin yuradi, har 3s da yerga uradi — atrofdagi kichik doirada 1 zarar. */
  private updateGolem(dt: number, p: Player, dx: number, dy: number, d: number, m: number) {
    if (this.stompWindup > 0) {
      this.stompWindup -= dt;
      if (this.stompWindup <= 0) {
        this.stompShock = 0.3;
        this.justStomped = true;
        this.aiTimer = STOMP_EVERY;
        this.showAttackFrame(2);
        if (d < STOMP_RADIUS + p.size / 2) p.takeHit(1, this.x, this.y, 200);
      } else this.showAttackFrame(this.stompWindup > STOMP_WINDUP / 2 ? 0 : 1);
      return;
    }
    if (this.stompShock > 0) return this.showAttackFrame(2);
    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.stompWindup = STOMP_WINDUP;
      this.showAttackFrame(0);
      return;
    }
    if (d > 14) {
      this.x += (dx / d) * GOLEM_SPEED * m * dt;
      this.y += (dy / d) * GOLEM_SPEED * m * dt;
      this.anim.set("walk");
    } else this.anim.set("idle");
  }

  /** Muz ruhi nafasi: tayyorgarlikda konus chegarasi, nafasda oq-ko'k bulut. */
  private renderBreath(ctx: CanvasRenderingContext2D) {
    const a = this.breathAngle;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.arc(this.x, this.y, FROST_RANGE, a - FROST_ARC, a + FROST_ARC);
    ctx.closePath();
    if (this.breathWindup > 0) {
      // och muz polda ko'rinishi uchun to'q ko'k chegara
      const k = 1 - this.breathWindup / FROST_WINDUP;
      ctx.fillStyle = `rgba(60,140,230,${0.1 + 0.2 * k})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(30,90,200,${0.5 + 0.4 * Math.sin(this.breathWindup * 28)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      const k = this.breathShow / BREATH_SHOW;
      ctx.fillStyle = `rgba(235,248,255,${0.75 * k})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(60,140,230,${0.7 * k})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /** Kamonchi va qalqonli skelet kadri Animator taymeri emas, hujum vaqti bilan boshqariladi. */
  private showAttackFrame(frame: number) {
    this.anim.set("attack");
    this.anim.frame = frame;
    this.anim.t = 0;
  }

  render(ctx: CanvasRenderingContext2D) {
    const { state, frame } = this.anim;
    if (this.kind === "golem" && this.stompWindup > 0) {
      // yerga urish ogohlantirishi: qizil doira
      ctx.strokeStyle = `rgba(220,30,40,${0.6 + 0.35 * Math.sin(this.stompWindup * 30)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y + 4, STOMP_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(230,40,50,${0.1 + 0.2 * (1 - this.stompWindup / STOMP_WINDUP)})`;
      ctx.fill();
    }
    if (this.stompShock > 0) {
      ctx.fillStyle = `rgba(200,235,255,${this.stompShock * 1.6})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y + 4, STOMP_RADIUS * (1.3 - this.stompShock), 0, Math.PI * 2);
      ctx.fill();
    }
    if (this.kind === "frost" && (this.breathWindup > 0 || this.breathShow > 0))
      this.renderBreath(ctx);
    if (this.spawn > 0) {
      const k = 1 - this.spawn / this.spawnMax;
      ctx.strokeStyle = ICE_KINDS.has(this.kind)
        ? `rgba(140,215,255,${0.35 + 0.35 * Math.sin(this.spawn * 20)})`
        : `rgba(200,120,255,${0.35 + 0.35 * Math.sin(this.spawn * 20)})`;
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
    const tall =
      this.kind === "rammer" ||
      this.kind === "archer" ||
      this.kind === "shield" ||
      this.kind === "golem";
    // muz ruhi yarim shaffof, muz slime biroz shaffof
    if (this.kind === "frost") ctx.globalAlpha *= 0.78;
    else if (this.kind === "iceblob") ctx.globalAlpha *= 0.88;
    renderSprite(
      ctx,
      SPRITE[this.kind],
      state,
      frame,
      this.x,
      tall ? this.y - (this.kind === "golem" ? 6 : 0) : this.y - 3,
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

/** 2-dunyo moblari: paydo bo'lishda ko'k doira */
const ICE_KINDS: ReadonlySet<EnemyKind> = new Set(["frost", "golem", "iceblob", "shield", "wolf"]);

/** a - b burchak farqi, [-PI, PI] oralig'ida. */
export function angleDiff(a: number, b: number) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
