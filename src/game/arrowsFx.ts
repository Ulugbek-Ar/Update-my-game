/**
 * O'N O'Q OVI sahnasi (Ovchi superi) — faqat ko'rinish; o'qlar harakati va zarar — super.ts
 * (launchVolley / stepArrow) va egasi (Game / onlayn klient).
 *
 * Tayyorlanish: ekran biroz qorayadi, Ovchi kamonni osmonga tortadi — kamon uchidan tepaga ingichka
 * yashil nur, atrofda barg-uchqunlar ko'tariladi; har nishon ustida aylanuvchi nishon belgisi paydo
 * bo'ladi. Zarba: o'qlar yashil iz qoldirib egri yoy bilan uchadi; tekkanda — kichik portlash (halqa,
 * chaqnash, uchqunlar), belgi o'chadi. Ranglar — skin theme'idan; "Effektlarni kamaytirish": iz qisqa,
 * miltillash va uchqunlar kam.
 */
import { ROOM, px } from "./animation";
import { withAlpha } from "./hero";
import { HUNTER_SUPER_FRAME } from "./sprites";
import type { SceneCtx, SceneTarget, SuperScene } from "./superScene";
import type { SuperCast, SuperStage } from "./super";

/** Ovchi super kadrlari ("attack" holatida — Player.superFrame) */
const ARROW_POSE = HUNTER_SUPER_FRAME;

interface Mark {
  t: SceneTarget;
  age: number;
  /** O'chmoqda (o'q tegdi): qolgan vaqt */
  fade: number;
  boss: boolean;
}

interface Blast {
  x: number;
  y: number;
  life: number;
  max: number;
  big: boolean;
}

const MARK_IN = 0.18;
const BLAST_TIME = 0.32;
const TRAIL = 7;
const TRAIL_REDUCED = 3;

export class ArrowScene implements SuperScene {
  private marks: Mark[] = [];
  private blasts: Blast[] = [];
  /** Har o'q izi (o'q indeksi bo'yicha) */
  private trails: { x: number; y: number }[][] = [];
  private dim = 0;
  private beam = 0;
  private time = 0;

  get alive() {
    return (
      this.marks.length > 0 ||
      this.blasts.length > 0 ||
      this.dim > 0.01 ||
      this.trails.some((t) => t.length > 0)
    );
  }

  stage(s: SuperStage, _cast: SuperCast, ctx: SceneCtx) {
    if (s === "prep") this.beam = 0.01;
    if (s === "strike") {
      // kamon qo'yib yuborildi: kamon atrofida yashil chaqnash
      ctx.fx.burst(ctx.x, ctx.y - 12, ctx.theme.glow, ctx.reduced ? 4 : 12, 80, 1);
      ctx.shake(0.08);
    }
    if (s === "after") this.beam = 0;
  }

  mark(t: SceneTarget, boss: boolean) {
    if (this.marks.some((m) => m.t.ref && m.t.ref === t.ref)) return;
    this.marks.push({ t, age: 0, fade: -1, boss });
  }

  hit(t: SceneTarget, boss: boolean, _killed: boolean, _cast: SuperCast, ctx: SceneCtx) {
    for (const m of this.marks) if (m.t.ref && m.t.ref === t.ref && m.fade < 0) m.fade = 0.15;
    this.blasts.push({ x: t.x, y: t.y, life: BLAST_TIME, max: BLAST_TIME, big: boss });
    const T = ctx.theme;
    ctx.fx.burst(t.x, t.y, T.spark, ctx.reduced ? 3 : boss ? 14 : 7, boss ? 110 : 80, 1);
    if (!ctx.reduced) ctx.fx.burst(t.x, t.y, T.glow, boss ? 6 : 3, 50, 2);
    ctx.shake(boss ? 0.2 : 0.05);
    return false;
  }

  pose(cast: SuperCast) {
    if (cast.stage === "prep") return cast.t < 0.3 ? ARROW_POSE.aim : ARROW_POSE.full;
    if (cast.stage === "strike") {
      // o'qlar ketma-ket uchayotganda kamon to'liq tortilgan, so'ng qo'yib yuborilgan
      const launched = cast.arrows.length ? cast.arrows[cast.arrows.length - 1]!.delay : 0;
      return cast.t < launched
        ? Math.floor(cast.t / 0.09) % 2
          ? ARROW_POSE.loose
          : ARROW_POSE.full
        : ARROW_POSE.loose;
    }
    return null;
  }

  update(dt: number, cast: SuperCast | null, ctx: SceneCtx) {
    this.time += dt;
    for (const m of this.marks) {
      m.age += dt;
      if (m.fade >= 0) m.fade -= dt;
    }
    // super tugasa — qolgan belgilar ham o'chadi
    if (!cast) for (const m of this.marks) if (m.fade < 0) m.fade = 0.15;
    this.marks = this.marks.filter((m) => m.fade < 0 || m.fade > 0);
    for (const b of this.blasts) b.life -= dt;
    this.blasts = this.blasts.filter((b) => b.life > 0);
    const want = cast && cast.stage !== "card" && cast.stage !== "after" ? 1 : 0;
    this.dim += (want - this.dim) * Math.min(1, dt * 6);
    if (this.beam > 0 && cast?.stage === "prep") {
      this.beam = Math.min(1, this.beam + dt * 2.5);
      // kamon atrofida ko'tarilayotgan barg-uchqunlar
      if (!ctx.reduced && Math.floor(this.time * 30) % 3 === 0)
        ctx.fx.burst(ctx.x + (ctx.dir > 0 ? 6 : -6), ctx.y - 14, ctx.theme.glow, 1, 30, 1);
    }
    // o'q izlari: uchayotgan o'qlarning oxirgi joylari
    const max = ctx.reduced ? TRAIL_REDUCED : TRAIL;
    const arrows = cast?.arrows ?? [];
    arrows.forEach((a, i) => {
      const tr = (this.trails[i] ??= []);
      const t = cast ? (cast.stage === "strike" ? cast.t : cast.stage === "after" ? 99 : -1) : 99;
      if (!a.done && t >= a.delay) tr.push({ x: a.x, y: a.y });
      else if (tr.length) tr.shift();
      while (tr.length > max) tr.shift();
    });
    if (!arrows.length) for (const tr of this.trails) tr.shift();
  }

  renderGround(c: CanvasRenderingContext2D, _cast: SuperCast | null, ctx: SceneCtx) {
    // nishon ostidagi yerdagi halqa
    const T = ctx.theme;
    for (const m of this.marks) {
      const k = Math.min(1, m.age / MARK_IN) * (m.fade >= 0 ? m.fade / 0.15 : 1);
      const p = m.t.live ?? m.t;
      const r = (m.boss ? 14 : 7) * (1.6 - 0.6 * k);
      c.strokeStyle = withAlpha(T.edge, 0.45 * k);
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(p.x, p.y + m.t.size / 2 - 1, r, r * 0.45, 0, 0, Math.PI * 2);
      c.stroke();
    }
  }

  renderAir(c: CanvasRenderingContext2D, cast: SuperCast | null, ctx: SceneCtx) {
    const T = ctx.theme;
    if (this.dim > 0.01)
      px(c, `rgba(4,10,4,${0.32 * this.dim})`, ctx.view.x, ctx.view.y, ctx.view.w, ctx.view.h);
    // kamondan osmonga nur
    if (this.beam > 0 && cast?.stage === "prep") {
      const k = this.beam;
      const bx = Math.round(ctx.x + (ctx.dir > 0 ? 5 : -5));
      const top = ctx.view.y;
      const h = Math.max(0, ctx.y - 16 - top);
      px(c, withAlpha(T.glow, 0.25 * k), bx - 1, top, 3, h);
      px(c, withAlpha(T.glint, 0.7 * k), bx, top + h * (1 - k), 1, h * k);
    }
    // nishon belgilari: aylanuvchi to'rt burchak va markaz nuqtasi
    for (const m of this.marks) {
      const k = Math.min(1, m.age / MARK_IN) * (m.fade >= 0 ? m.fade / 0.15 : 1);
      if (k <= 0) continue;
      const p = m.t.live ?? m.t;
      const cx = Math.round(p.x),
        cy = Math.round(p.y - m.t.size / 2 - 7);
      const r = (m.boss ? 7 : 4) + Math.round((1 - k) * 5);
      const pulse = ctx.reduced ? 1 : 0.75 + 0.25 * Math.sin(m.age * 14);
      const col = withAlpha(T.edge, k * pulse);
      const a0 = m.age * (ctx.reduced ? 1 : 4);
      for (let q = 0; q < 4; q++) {
        const a = a0 + (q * Math.PI) / 2;
        const x = Math.round(cx + Math.cos(a) * r),
          y = Math.round(cy + Math.sin(a) * r);
        px(c, col, x - 1, y, 3, 1);
        px(c, col, x, y - 1, 1, 3);
      }
      px(c, withAlpha(T.glint, k), cx, cy, 1, 1);
      // nishondan pastga ingichka ko'rsatkich
      px(c, withAlpha(T.glow, 0.5 * k), cx, cy + r + 1, 1, 2);
    }
    // o'q izlari va o'qlar
    const arrows = cast?.arrows ?? [];
    this.trails.forEach((tr, i) => {
      for (let j = 0; j < tr.length; j++) {
        const q = tr[j]!;
        const a = (j + 1) / (tr.length + 1);
        px(c, withAlpha(T.edge, 0.7 * a), Math.round(q.x), Math.round(q.y), 1, 1);
      }
      const ar = arrows[i];
      if (!ar || ar.done || !cast || cast.stage !== "strike" || cast.t < ar.delay) return;
      const sp = Math.hypot(ar.vx, ar.vy) || 1;
      const ux = ar.vx / sp,
        uy = ar.vy / sp;
      // dasta (orqaga 6 px), uchi va pat
      for (let d = 0; d <= 6; d++)
        px(c, d < 2 ? T.glint : T.core, Math.round(ar.x - ux * d), Math.round(ar.y - uy * d), 1, 1);
      px(c, T.glow, Math.round(ar.x - ux * 6 - uy), Math.round(ar.y - uy * 6 + ux), 1, 1);
      px(c, T.glow, Math.round(ar.x - ux * 6 + uy), Math.round(ar.y - uy * 6 - ux), 1, 1);
    });
    // kichik portlashlar: chaqnash va kengayuvchi halqa
    for (const b of this.blasts) {
      const k = b.life / b.max;
      const r = (b.big ? 16 : 9) * (1 - k * 0.7);
      if (!ctx.reduced && k > 0.6) {
        const f = Math.round((b.big ? 6 : 3) * k);
        px(c, withAlpha(T.glint, k), b.x - f, b.y - f, f * 2, f * 2);
      }
      c.strokeStyle = withAlpha(T.edge, k);
      c.lineWidth = b.big ? 2 : 1;
      c.beginPath();
      c.arc(b.x, b.y, r, 0, Math.PI * 2);
      c.stroke();
      if (k > 0.3) {
        c.strokeStyle = withAlpha(T.glow, k * 0.7);
        c.lineWidth = 1;
        c.beginPath();
        c.arc(b.x, b.y, r * 0.55, 0, Math.PI * 2);
        c.stroke();
      }
    }
  }
}
