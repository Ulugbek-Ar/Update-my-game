import { Animator, Body, ROOM, updatePhysics, isFlashing } from "./animation";
import type { Player } from "./player";
import { renderSprite } from "./sprites";
import { renderRoots } from "./enemy";

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
  /** Muz qalqoni: shuncha soniya sekinroq yuradi */
  slow = 0;
  /** Paydo bo'lish vaqti */
  spawn = 0;
  spawnMax = 1;
  /** O'yin olib ketadigan olov sharlari */
  shots: Shot[] = [];
  /** 2-fazaga o'tgan zahoti bir marta true bo'ladi */
  justEnraged = false;
  /** Zarba yerga tekkan kadrda true (ekran silkinishi uchun) */
  justSlammed = false;
  protected wasEnraged = false;
  protected facingLeft = false;
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
    if (this.slow > 0) this.slow -= dt;
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
    const speed = (this.enraged ? 42 : 30) * (this.slow > 0 ? 0.5 : 1);
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

/** Xonadagi tirik Muz ruhlari soniga qarab nechta yangi ruh chaqiriladi. */
export function summonCount(alive: number) {
  return Math.max(0, Math.min(SUMMON_COUNT, MAX_SPIRITS - alive));
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
  private nextBlizzard = false;
  private summonTimer = 0;
  /** Game shu kadrda ruh chaqirishi kerak */
  wantSummon = false;
  /** Shu kadrda nayza yerdan chiqdi (ovoz uchun) */
  justSpiked = false;

  constructor(hp = QUEEN_HP) {
    super(hp);
  }

  override update(dt: number, p: Player) {
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
    if (this.wind.t > 0) this.wind.t -= dt;
    if (this.dead) {
      // o'lgach yangi nayzalar chiqmaydi va bo'ron to'xtaydi
      this.wind.t = 0;
      this.spikeQueue = 0;
      this.spikes = this.spikes.filter((s) => s.warn <= 0);
      return;
    }

    if (this.enraged && !this.wasEnraged) {
      this.wasEnraged = true;
      this.justEnraged = true;
      this.summonTimer = 0;
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
    this.anim.set(dir ? "walk" : "idle");

    this.castTimer -= dt;
    if (this.castTimer <= 0) {
      if (this.nextBlizzard) {
        this.wind = { dir: p.x < ROOM.w / 2 ? -1 : 1, t: BLIZZARD_TIME };
        this.justSlammed = true;
      } else {
        this.spikeQueue = SPIKE_COUNT;
        this.spikeTimer = 0;
      }
      this.nextBlizzard = !this.nextBlizzard;
      this.castTimer = (this.enraged ? 2.6 : 3.4) + Math.random();
      this.castAnim = CAST_TIME;
      this.anim.set("attack", true);
    }
  }

  private updateSpikes(dt: number, p: Player) {
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

  /** Poldagi ogohlantirish doiralari va nayzalar — boshqa jonzotlardan oldin chiziladi. */
  renderFloor(ctx: CanvasRenderingContext2D) {
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
  /** Game shu kadrda o'rgimchak chaqirishi kerak */
  wantSummon = false;
  /** Shu kadrda ildiz yerdan chiqdi (ovoz uchun) */
  justRooted = false;

  constructor(hp = KING_HP) {
    super(hp);
  }

  /** Jon yarmidan pastda xona qorong'i (faqat o'yinchi atrofi yorug') */
  get dark() {
    return this.enraged && !this.dead;
  }

  override update(dt: number, p: Player) {
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
      // o'lgach yangi ildizlar chiqmaydi
      this.roots = this.roots.filter((r) => r.warn <= 0);
      return;
    }
    if (this.enraged && !this.wasEnraged) {
      this.wasEnraged = true;
      this.justEnraged = true;
    }
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
        this.roots.push({ x, y, warn: KING_ROOT_WARN + i * KING_ROOT_STEP, life: KING_ROOT_SHOW });
      }
      this.castTimer = (this.enraged ? 2.4 : 3.2) + Math.random() * 0.8;
      this.castAnim = 0.6;
      this.justSlammed = true;
      this.anim.set("attack", true);
    }
  }

  private updateRoots(dt: number, p: Player) {
    for (const r of this.roots) {
      if (r.warn > 0) {
        r.warn -= dt;
        if (r.warn <= 0) {
          this.justRooted = true;
          if (
            Math.hypot(p.x - r.x, p.y - r.y) < KING_ROOT_RADIUS + p.size / 2 &&
            p.takeHit(1, r.x, r.y, 120)
          )
            p.snare = Math.max(p.snare, KING_ROOT_SNARE);
        }
      } else r.life -= dt;
    }
    this.roots = this.roots.filter((r) => r.warn > 0 || r.life > 0);
  }

  /** Poldagi ogohlantirishlar va ildizlar — boshqa jonzotlardan oldin chiziladi. */
  renderFloor(ctx: CanvasRenderingContext2D) {
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
