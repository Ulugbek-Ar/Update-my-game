/**
 * BO'RI UVLASHI sahnasi (Bo'ri-qiz Varvar superi) — faqat chizish; zarar, vaqt va g'azab super.ts /
 * Game / Player da.
 *
 *  TAYYORLANISH: dunyo tungi ko'kka botadi, osmonda katta oy chiqadi, Varvar boshini ko'tarib uvlaydi
 *    (sprayt kadrlari) — boshidan tovush halqalari tarqaladi.
 *  ZARBA: Varvar yonida 4–6 ta ruhiy ko'kish bo'ri paydo bo'ladi; har nishon navbat bilan bitta
 *    bo'riga beriladi — bo'ri unga yugurib boradi va tishlaydi (tishlash izi), so'ng keyingisiga.
 *  OQIBAT: bo'rilar yugurishda davom etib, tumanga aylanib yo'qoladi.
 *
 * Ranglar skin theme'idan (accent — bo'ri tanasi, glow — cheti va ko'zlari, accentDark — soya).
 * "Effektlarni kamaytirish": bo'rilar 4 ta, iz va tuman zarralari kam. Math.random yo'q.
 */
import { px } from "./animation";
import { withAlpha } from "./hero";
import { WOLF_SUPER_FRAME } from "./wolfSprites";
import type { SuperCast, SuperStage } from "./super";
import type { SceneCtx, SceneTarget, SuperScene } from "./superScene";

/** Ruhiy bo'rilar soni (oddiy va kamaytirilgan) */
export const PACK_SIZE = 6;
export const PACK_SIZE_REDUCED = 4;
/** Bo'ri yugurish tezligi (px/s) va tumanga aylanish vaqti */
export const SPIRIT_SPEED = 360;
export const MIST_LIFE = 0.7;
/** Oy radiusi va tovush halqasi umri */
export const MOON_R = 20;
export const HOWL_RING_LIFE = 0.7;

export interface SpiritWolf {
  x: number;
  y: number;
  /** yugurish yo'nalishi (1 — o'ngga) */
  dir: number;
  /** navbatdagi nishonlar (jonli joyi) */
  queue: { x: number; y: number }[];
  /** paydo bo'lish (0..1) va tumanga aylanish (1 → 0) */
  show: number;
  fade: number;
  step: number;
}

interface Bite {
  x: number;
  y: number;
  life: number;
  big: boolean;
}

interface Puff {
  x: number;
  y: number;
  life: number;
  max: number;
  r: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export class HowlScene implements SuperScene {
  private t = 0;
  private dim = 0;
  private castOn = false;
  private seed = 23;
  /** Oy chiqishi 0..1 */
  moon = 0;
  private wantMoon = 0;
  wolves: SpiritWolf[] = [];
  bites: Bite[] = [];
  puffs: Puff[] = [];
  /** Tovush halqalari: qolgan umrlari */
  rings: number[] = [];
  private ringT = 0;
  private ox = 0;
  private oy = 0;
  private next = 0;

  get alive() {
    return (
      this.castOn ||
      this.dim > 0.02 ||
      this.moon > 0.02 ||
      this.wolves.length > 0 ||
      this.bites.length > 0 ||
      this.puffs.length > 0 ||
      this.rings.length > 0
    );
  }

  private rnd() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  /** Uvlash → to'dani chaqirish (panjalar yoyilgan) → oqibatda oddiy ko'rinish */
  pose(cast: SuperCast) {
    const F = WOLF_SUPER_FRAME;
    if (cast.stage === "card" || cast.stage === "prep") return F.howl;
    if (cast.stage === "strike") return F.call;
    return cast.t < 0.4 ? F.call : null;
  }

  /** To'da: Varvar yonida yarim doira bo'ylab paydo bo'ladi */
  private summon(ctx: SceneCtx) {
    const n = ctx.reduced ? PACK_SIZE_REDUCED : PACK_SIZE;
    this.wolves = [];
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? -1 : 1;
      const row = Math.floor(i / 2);
      this.wolves.push({
        x: ctx.x + side * (14 + row * 6),
        y: ctx.y + 4 + (row - 1) * 10,
        dir: side,
        queue: [],
        show: 0,
        fade: 1,
        step: this.rnd() * 4,
      });
      if (!ctx.reduced) this.puff(ctx.x + side * (14 + row * 6), ctx.y + 4 + (row - 1) * 10);
    }
  }

  private puff(x: number, y: number) {
    const life = 0.4 + this.rnd() * 0.3;
    this.puffs.push({ x, y, life, max: life, r: 3 + this.rnd() * 3 });
  }

  stage(s: SuperStage, _cast: SuperCast, ctx: SceneCtx) {
    if (s === "prep") {
      this.wantMoon = 1;
      this.ox = ctx.x;
      this.oy = ctx.y;
      this.ringT = 0;
    }
    if (s === "strike") {
      this.summon(ctx);
      ctx.shake(0.06);
    }
    if (s === "after") {
      // bo'rilar tumanga aylanadi
      for (const w of this.wolves) w.queue = [];
    }
  }

  mark(t: SceneTarget, _boss: boolean, _cast: SuperCast, _ctx: SceneCtx) {
    if (!this.wolves.length) return;
    // nishon tomonidagi bo'rilardan navbatdagisi (bir tomonga ko'p nishon — to'da bo'linadi)
    const w = this.wolves[this.next % this.wolves.length]!;
    this.next++;
    w.queue.push(t.live ?? t);
  }

  hit(t: SceneTarget, boss: boolean, _killed: boolean, _cast: SuperCast, ctx: SceneCtx) {
    const live = t.live ?? t;
    this.bites.push({ x: live.x, y: live.y - 2, life: 0.35, big: boss });
    // nishonni tishlagan bo'ri keyingisiga o'tadi (bo'ri hali yetmagan bo'lsa — sakrab yetadi)
    for (const w of this.wolves) {
      const i = w.queue.findIndex((q) => q === live);
      if (i < 0) continue;
      w.queue.splice(i, 1);
      w.x = live.x - w.dir * 6;
      w.y = live.y + 2;
      break;
    }
    ctx.fx.burst(live.x, live.y, ctx.theme.glow, ctx.reduced ? 2 : boss ? 12 : 5, 80, 1);
    ctx.shake(boss ? 0.22 : 0.05);
    return false;
  }

  update(dt: number, cast: SuperCast | null, ctx: SceneCtx) {
    this.t += dt;
    this.castOn = !!cast;
    const dark = cast && cast.stage !== "card" ? 1 : 0;
    this.dim += (dark - this.dim) * Math.min(1, dt * (dark ? 5 : 3));
    if (this.dim < 0.005) this.dim = 0;
    const want = cast && cast.stage !== "card" && cast.stage !== "after" ? this.wantMoon : 0;
    this.moon += (want - this.moon) * Math.min(1, dt * (want ? 3 : 3.5));
    if (this.moon < 0.01 && !want) this.moon = 0;
    // uvlash: tayyorlanish davomida boshdan tovush halqalari
    if (cast?.stage === "prep") {
      this.ringT -= dt;
      if (this.ringT <= 0) {
        this.ringT = 0.28;
        this.rings.push(HOWL_RING_LIFE);
      }
    }
    this.rings = this.rings.map((r) => r - dt).filter((r) => r > 0);
    const after = !cast || cast.stage === "after";
    const V = ctx.view;
    for (const w of this.wolves) {
      w.show = Math.min(1, w.show + dt * 6);
      w.step += dt * 14;
      const q = w.queue[0];
      if (q && !after) {
        // nishonga yuguradi
        const dx = q.x - w.dir * 6 - w.x,
          dy = q.y + 2 - w.y;
        const d = Math.hypot(dx, dy);
        if (Math.abs(dx) > 1) w.dir = Math.sign(dx);
        const s = Math.min(d, SPIRIT_SPEED * dt);
        if (d > 0.01) {
          w.x += (dx / d) * s;
          w.y += (dy / d) * s;
        }
      } else {
        // nishoni yo'q — o'z tomoniga yugurib ketadi
        w.x += w.dir * SPIRIT_SPEED * 0.6 * dt;
      }
      if (after) w.fade -= dt / MIST_LIFE;
      if (!ctx.reduced && this.rnd() < dt * (after ? 30 : 10)) this.puff(w.x - w.dir * 5, w.y);
      if (w.x < V.x - 20 || w.x > V.x + V.w + 20) w.fade = Math.min(w.fade, 0);
    }
    this.wolves = this.wolves.filter((w) => w.fade > 0);
    for (const b of this.bites) b.life -= dt;
    this.bites = this.bites.filter((b) => b.life > 0);
    for (const p of this.puffs) {
      p.life -= dt;
      p.y -= 10 * dt;
    }
    this.puffs = this.puffs.filter((p) => p.life > 0);
  }

  renderGround() {}

  /** Ruhiy bo'ri: yon tomondan yugurayotgan yarim shaffof siluet (oyoqlari navbatlashadi) */
  private drawWolf(c: CanvasRenderingContext2D, w: SpiritWolf, ctx: SceneCtx) {
    const T = ctx.theme;
    const a = w.show * clamp01(w.fade);
    if (a <= 0.01) return;
    const d = w.dir;
    const x = Math.round(w.x),
      y = Math.round(w.y);
    const X = (dx: number) => x + dx * d - (d < 0 ? 1 : 0);
    const body = withAlpha(T.accent, 0.75 * a),
      edge = withAlpha(T.glow, 0.9 * a),
      dark = withAlpha(T.accentDark, 0.7 * a);
    const leg = Math.floor(w.step) % 2;
    // dum
    px(c, body, X(-9), y - 6, 3, 1);
    px(c, body, X(-11), y - 7, 2, 1);
    // tana
    px(c, body, X(-7), y - 6, 11, 4);
    px(c, edge, X(-7), y - 7, 10, 1);
    // bosh va tumshuq, quloqlar
    px(c, body, X(3), y - 9, 4, 4);
    px(c, body, X(6), y - 7, 3, 2);
    px(c, edge, X(3), y - 11, 1, 2);
    px(c, edge, X(5), y - 11, 1, 2);
    px(c, edge, X(5), y - 8, 1, 1);
    // oyoqlar
    px(c, dark, X(leg ? -6 : -5), y - 2, 1, 3);
    px(c, dark, X(leg ? 2 : 1), y - 2, 1, 3);
    px(c, body, X(leg ? -4 : -7), y - 2, 1, 2);
    px(c, body, X(leg ? 3 : 0), y - 2, 1, 2);
  }

  renderAir(c: CanvasRenderingContext2D, cast: SuperCast | null, ctx: SceneCtx) {
    const T = ctx.theme;
    const V = ctx.view;
    // 1) tungi ko'k qorong'ilik
    if (this.dim > 0.01) px(c, `rgba(4,10,28,${0.66 * this.dim})`, V.x, V.y, V.w, V.h);
    // 2) oy: porlash, disk, dog'lar
    if (this.moon > 0.02) {
      const mx = V.x + V.w * 0.76,
        my = V.y + 30 + (1 - this.moon) * 20;
      c.fillStyle = withAlpha(T.glow, 0.18 * this.moon);
      c.beginPath();
      c.arc(mx, my, MOON_R * 1.6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = `rgba(240,238,220,${0.95 * this.moon})`;
      c.beginPath();
      c.arc(mx, my, MOON_R, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = `rgba(200,204,196,${0.8 * this.moon})`;
      for (const [dx, dy, r] of [
        [-6, -4, 4],
        [5, 6, 3],
        [7, -7, 2],
      ] as const) {
        c.beginPath();
        c.arc(mx + dx, my + dy, r, 0, Math.PI * 2);
        c.fill();
      }
    }
    if (cast && ctx.drawOwner) ctx.drawOwner(c);
    // 3) uvlash halqalari: boshdan yuqoriga tarqaladi
    for (const r of this.rings) {
      const k = r / HOWL_RING_LIFE;
      const rad = 6 + (1 - k) * 30;
      c.strokeStyle = withAlpha(T.glow, 0.7 * k);
      c.lineWidth = 1;
      c.beginPath();
      c.arc(this.ox, this.oy - 12, rad, Math.PI * 1.1, Math.PI * 1.9);
      c.stroke();
    }
    // 4) tuman zarralari
    for (const p of this.puffs) {
      const k = clamp01(p.life / p.max);
      c.fillStyle = withAlpha(T.glow, 0.35 * k);
      c.beginPath();
      c.arc(p.x, p.y, p.r * (1.6 - k * 0.6), 0, Math.PI * 2);
      c.fill();
    }
    // 5) ruhiy bo'rilar va tishlash izlari (ikki yoy — jag')
    for (const w of this.wolves) this.drawWolf(c, w, ctx);
    for (const b of this.bites) {
      const k = clamp01(b.life / 0.35);
      const r = (b.big ? 10 : 6) * (1.3 - k * 0.3);
      c.strokeStyle = withAlpha(T.glow, k);
      c.lineWidth = b.big ? 2 : 1;
      c.beginPath();
      c.arc(b.x, b.y - r * 0.3, r, Math.PI * 0.15, Math.PI * 0.85);
      c.stroke();
      c.beginPath();
      c.arc(b.x, b.y + r * 0.3, r, Math.PI * 1.15, Math.PI * 1.85);
      c.stroke();
    }
  }

  /** Varvar super davomida ko'rinib turadi */
  hidden() {
    return false;
  }
}
