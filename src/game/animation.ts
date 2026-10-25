export type AnimState = "idle" | "walk" | "attack" | "hurt" | "death";

export interface AnimDef {
  frames: number; // 2-4 kadr
  frameTime: number; // soniya
  loop: boolean;
}

export type AnimDefs = Record<AnimState, AnimDef>;

/** Holat mashinasi + kadr hisoblagich. Holat o'zgarsa 0-kadrdan boshlanadi. */
export class Animator {
  state: AnimState = "idle";
  frame = 0;
  t = 0;
  done = false;
  constructor(public defs: AnimDefs) {}

  set(s: AnimState, restart = false) {
    if (s === this.state && !restart) return;
    this.state = s;
    this.frame = 0;
    this.t = 0;
    this.done = false;
  }

  update(dt: number) {
    const d = this.defs[this.state];
    this.t += dt;
    while (this.t >= d.frameTime) {
      this.t -= d.frameTime;
      this.frame++;
      if (this.frame >= d.frames) {
        if (d.loop) this.frame = 0;
        else {
          this.frame = d.frames - 1;
          this.done = true;
        }
      }
    }
  }
}

/** Barcha personajlar uchun umumiy tana. */
export interface Body {
  x: number;
  y: number;
  size: number;
  vx: number; // itarilish tezligi
  vy: number;
  hp: number;
  maxHp: number;
  flash: number;
  anim: Animator;
}

export const ROOM = { w: 320, h: 240, wall: 16 };

export function applyHit(b: Body, dmg: number, fromX: number, fromY: number, force: number) {
  if (b.anim.state === "death") return;
  b.hp -= dmg;
  b.flash = 0.3;
  const dx = b.x - fromX;
  const dy = b.y - fromY;
  const l = Math.hypot(dx, dy) || 1;
  b.vx = (dx / l) * force;
  b.vy = (dy / l) * force;
  b.anim.set(b.hp <= 0 ? "death" : "hurt", true);
}

export function updatePhysics(b: Body, dt: number) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  const k = Math.min(1, 10 * dt);
  b.vx -= b.vx * k;
  b.vy -= b.vy * k;
  if (b.flash > 0) b.flash -= dt;
  clampToRoom(b);
}

export function clampToRoom(b: Body) {
  const h = b.size / 2;
  b.x = Math.max(ROOM.wall + h, Math.min(ROOM.w - ROOM.wall - h, b.x));
  b.y = Math.max(ROOM.wall + h, Math.min(ROOM.h - ROOM.wall - h, b.y));
}

export function overlap(a: Body, b: Body) {
  return Math.abs(a.x - b.x) < (a.size + b.size) / 2 && Math.abs(a.y - b.y) < (a.size + b.size) / 2;
}

/** Ikki tanani bir-biridan itaradi (ustma-ust yig'ilib qolmasligi uchun). ratio=1 — faqat a suriladi. */
export function separate(a: Body, b: Body, ratio = 0.5) {
  let dx = b.x - a.x,
    dy = b.y - a.y;
  const min = (a.size + b.size) / 2;
  let d = Math.hypot(dx, dy);
  if (d >= min) return;
  if (d === 0) {
    dx = Math.random() - 0.5;
    dy = Math.random() - 0.5;
    d = Math.hypot(dx, dy);
  }
  const push = min - d,
    ux = dx / d,
    uy = dy / d;
  a.x -= ux * push * ratio;
  a.y -= uy * push * ratio;
  b.x += ux * push * (1 - ratio);
  b.y += uy * push * (1 - ratio);
}

export function isFlashing(b: Body) {
  return b.flash > 0 && Math.floor(b.flash * 25) % 2 === 0;
}

export function px(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
