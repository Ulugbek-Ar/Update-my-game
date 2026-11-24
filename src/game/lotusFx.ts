/**
 * OLTIN LOTOS sahnasi (Rohiba superi) — faqat chizish; zarar, davolash va vaqt super.ts / Game da.
 *
 *  TAYYORLANISH: dunyo iliq oltin-qoramtirga botadi, Rohiba ko'zlarini yumib havoga ko'tariladi
 *    (sprayt kadrlari), ostida ulkan oltin lotos guli asta ochiladi — tashqi 8 va ichki 6 gulbarg.
 *  ZARBA: har nishonga eng yaqin gulbarg uchidan oltin NUR uriladi (Paladinning osmondan tushuvchi
 *    ustunlaridan farqli — nurlar lotosdan yon tomonga tarqaladi), tekkan joyda kichik nur guli.
 *  OQIBAT: lotos yopilib so'nadi, Rohiba atrofidan iliq oltin halqa tarqaladi (davolash).
 *
 * Ranglar skin theme'idan (accent — gulbarg, accentDark — chekka, glow — ichki gulbarg va nur yadrosi).
 * "Effektlarni kamaytirish": zarrachalar kam, nur gullari yo'q. Math.random yo'q.
 */
import { px } from "./animation";
import { withAlpha } from "./hero";
import { PRIESTESS_SUPER_FRAME } from "./priestessSprites";
import type { SuperCast, SuperStage } from "./super";
import type { SceneCtx, SceneTarget, SuperScene } from "./superScene";

/** Lotos o'lchami (ochilganda): yarim eni va perspektivadagi yarim balandligi */
export const LOTUS_R = 40;
export const LOTUS_TILT = 0.38;
/** Tashqi va ichki gulbarglar soni */
export const LOTUS_PETALS = 8;
export const LOTUS_INNER = 6;
/** Nur yashash vaqti va davolash halqasi umri (s) */
export const RAY_LIFE = 0.55;
export const HEAL_RING_LIFE = 0.8;
/** Ko'tariluvchi nur zarralari (oddiy va kamaytirilgan) */
export const LOTUS_MOTES = 14;
export const LOTUS_MOTES_REDUCED = 4;

interface Ray {
  /** gulbarg uchi (boshlanishi) va nishon */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  life: number;
  big: boolean;
}

interface Bloom {
  x: number;
  y: number;
  life: number;
  max: number;
  big: boolean;
}

interface Mote {
  x: number;
  y: number;
  vy: number;
  life: number;
  max: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export class LotusScene implements SuperScene {
  private t = 0;
  private dim = 0;
  private castOn = false;
  private reduced = false;
  private seed = 11;
  /** Lotos markazi (Rohiba oyog'i ostida) va ochilish darajasi 0..1 */
  cx = 0;
  cy = 0;
  open = 0;
  private want = 0;
  rays: Ray[] = [];
  blooms: Bloom[] = [];
  motes: Mote[] = [];
  /** Davolash halqasi: qolgan umri (0 — yo'q) */
  ring = 0;

  get alive() {
    return (
      this.castOn ||
      this.dim > 0.02 ||
      this.open > 0.02 ||
      this.rays.length > 0 ||
      this.blooms.length > 0 ||
      this.motes.length > 0 ||
      this.ring > 0
    );
  }

  private rnd() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  /** Gulbarg uchi: i-gulbarg (0..n−1), ochilish k */
  private tip(i: number, n: number, r: number, k: number): [number, number] {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return [this.cx + Math.cos(a) * r * k, this.cy + Math.sin(a) * r * LOTUS_TILT * k];
  }

  /** Ibodat → ko'tarilish → lotos ustida suzish; oqibat oxirida yerga tushadi */
  pose(cast: SuperCast) {
    const F = PRIESTESS_SUPER_FRAME;
    if (cast.stage === "card") return F.pray;
    if (cast.stage === "prep") {
      const k = cast.t / Math.max(0.01, cast.def.stages.prep);
      return k < 0.3 ? F.pray : k < 0.6 ? F.rise : F.float;
    }
    if (cast.stage === "strike") return F.float;
    if (cast.t < 0.35) return F.float;
    if (cast.t < 0.6) return F.rise;
    return cast.t < 0.8 ? F.pray : null;
  }

  stage(s: SuperStage, _cast: SuperCast, ctx: SceneCtx) {
    this.reduced = ctx.reduced;
    if (s === "prep") {
      this.cx = ctx.x;
      this.cy = ctx.y + 12;
      this.want = 1;
    }
    if (s === "strike") ctx.shake(0.08);
    if (s === "after") {
      // lotos yopiladi, iliq halqa tarqaladi (davolash)
      this.want = 0;
      this.ring = HEAL_RING_LIFE;
      if (!ctx.reduced) ctx.fx.burst(ctx.x, ctx.y, ctx.theme.glow, 10, 50, 2);
    }
  }

  mark(t: SceneTarget, boss: boolean, _cast: SuperCast, _ctx: SceneCtx) {
    const live = t.live ?? t;
    // nishon tomonidagi gulbarg (perspektivani hisobga olib)
    const a = Math.atan2((live.y - this.cy) / LOTUS_TILT, live.x - this.cx);
    const i = Math.round(((a + Math.PI / 2) / (Math.PI * 2)) * LOTUS_PETALS);
    const [x0, y0] = this.tip(
      ((i % LOTUS_PETALS) + LOTUS_PETALS) % LOTUS_PETALS,
      LOTUS_PETALS,
      LOTUS_R,
      1,
    );
    this.rays.push({ x0, y0, x1: live.x, y1: live.y - 2, life: RAY_LIFE, big: boss });
  }

  hit(t: SceneTarget, boss: boolean, _killed: boolean, _cast: SuperCast, ctx: SceneCtx) {
    const live = t.live ?? t;
    const life = boss ? 0.6 : 0.4;
    if (!ctx.reduced || boss)
      this.blooms.push({ x: live.x, y: live.y - 2, life, max: life, big: boss });
    ctx.fx.burst(live.x, live.y, ctx.theme.glow, ctx.reduced ? 2 : boss ? 12 : 5, 80, 1);
    ctx.shake(boss ? 0.22 : 0.05);
    return false;
  }

  update(dt: number, cast: SuperCast | null, ctx: SceneCtx) {
    this.t += dt;
    this.castOn = !!cast;
    this.reduced = ctx.reduced;
    const dark = cast && cast.stage !== "card" ? 1 : 0;
    this.dim += (dark - this.dim) * Math.min(1, dt * (dark ? 5 : 4));
    if (this.dim < 0.005) this.dim = 0;
    if (!cast) this.want = 0;
    // ochilish sekin, yopilish tezroq
    this.open += (this.want - this.open) * Math.min(1, dt * (this.want ? 3.2 : 4.5));
    if (this.open < 0.01 && !this.want) this.open = 0;
    // gul atrofidan ko'tariluvchi nur zarralari
    const max = ctx.reduced ? LOTUS_MOTES_REDUCED : LOTUS_MOTES;
    if (this.open > 0.3 && this.motes.length < max && this.rnd() < dt * 12) {
      const a = this.rnd() * Math.PI * 2;
      const r = LOTUS_R * this.open * (0.3 + this.rnd() * 0.7);
      const life = 0.6 + this.rnd() * 0.5;
      this.motes.push({
        x: this.cx + Math.cos(a) * r,
        y: this.cy + Math.sin(a) * r * LOTUS_TILT,
        vy: -(18 + this.rnd() * 20),
        life,
        max: life,
      });
    }
    for (const m of this.motes) {
      m.life -= dt;
      m.y += m.vy * dt;
    }
    this.motes = this.motes.filter((m) => m.life > 0);
    for (const r of this.rays) r.life -= dt;
    this.rays = this.rays.filter((r) => r.life > 0);
    for (const b of this.blooms) b.life -= dt;
    this.blooms = this.blooms.filter((b) => b.life > 0);
    if (this.ring > 0) this.ring = Math.max(0, this.ring - dt);
  }

  /** Bitta gulbarg: asosdan uchgacha bodomsimon, chekkasi to'qroq */
  private petal(
    c: CanvasRenderingContext2D,
    i: number,
    n: number,
    r: number,
    w: number,
    fill: string,
    edge: string,
  ) {
    const k = this.open;
    const [tx, ty] = this.tip(i, n, r, k);
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const nx = -Math.sin(a) * w * k,
      ny = Math.cos(a) * w * k * LOTUS_TILT;
    const mx = (this.cx + tx) / 2,
      my = (this.cy + ty) / 2 - 3 * k;
    c.beginPath();
    c.moveTo(this.cx, this.cy);
    c.quadraticCurveTo(mx + nx, my + ny, tx, ty - 2 * k);
    c.quadraticCurveTo(mx - nx, my - ny, this.cx, this.cy);
    c.fillStyle = fill;
    c.fill();
    c.strokeStyle = edge;
    c.lineWidth = 1;
    c.stroke();
  }

  /** Lotos: orqa gulbarglar, ichki gulbarglar, markaz, old gulbarglar */
  private renderLotus(c: CanvasRenderingContext2D, ctx: SceneCtx) {
    if (this.open < 0.02) return;
    const T = ctx.theme;
    const k = this.open;
    // ostidagi nur dog'i
    c.fillStyle = withAlpha(T.accent, 0.24 * k);
    c.beginPath();
    c.ellipse(
      this.cx,
      this.cy,
      LOTUS_R * 1.25 * k,
      LOTUS_R * LOTUS_TILT * 1.25 * k,
      0,
      0,
      Math.PI * 2,
    );
    c.fill();
    const order = [...Array(LOTUS_PETALS).keys()].sort(
      (a, b) => this.tip(a, LOTUS_PETALS, 1, 1)[1] - this.tip(b, LOTUS_PETALS, 1, 1)[1],
    );
    const fill = withAlpha(T.accent, 0.92),
      edge = withAlpha(T.accentDark, 0.95);
    // orqa yarmi (tepada) — avval
    for (const i of order.slice(0, LOTUS_PETALS / 2))
      this.petal(c, i, LOTUS_PETALS, LOTUS_R, 10, fill, edge);
    for (let i = 0; i < LOTUS_INNER; i++)
      this.petal(
        c,
        i,
        LOTUS_INNER,
        LOTUS_R * 0.6,
        7,
        withAlpha(T.glow, 0.95),
        withAlpha(T.accent, 0.9),
      );
    // markaz: oltin urug'don
    c.fillStyle = withAlpha(T.accentDark, 0.9);
    c.beginPath();
    c.ellipse(this.cx, this.cy - 1, 5 * k, 2.2 * k, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = withAlpha(T.glow, 0.9);
    c.fillRect(Math.round(this.cx) - 1, Math.round(this.cy) - 2, 3, 1);
    for (const i of order.slice(LOTUS_PETALS / 2))
      this.petal(c, i, LOTUS_PETALS, LOTUS_R, 10, fill, edge);
  }

  /** Super tugagach (so'nish) lotos personajlar ostida qoladi */
  renderGround(c: CanvasRenderingContext2D, cast: SuperCast | null, ctx: SceneCtx) {
    if (!cast) this.renderLotus(c, ctx);
  }

  renderAir(c: CanvasRenderingContext2D, cast: SuperCast | null, ctx: SceneCtx) {
    const T = ctx.theme;
    const V = ctx.view;
    // 1) dunyo iliq oltin-qoramtirga botadi; lotos va Rohiba yorug'likda
    if (this.dim > 0.01) px(c, `rgba(22,14,4,${0.68 * this.dim})`, V.x, V.y, V.w, V.h);
    if (cast) {
      this.renderLotus(c, ctx);
      if (!this.hidden() && ctx.drawOwner) ctx.drawOwner(c);
    }
    // 2) gulbarglardan nurlar: tashqi oltin, ichi oq-oltin, so'ngida ingichkalashadi
    for (const r of this.rays) {
      const k = clamp01(r.life / RAY_LIFE);
      const grow = clamp01((1 - k) * 5);
      const x1 = r.x0 + (r.x1 - r.x0) * grow,
        y1 = r.y0 + (r.y1 - r.y0) * grow;
      c.save();
      c.lineCap = "round";
      c.strokeStyle = withAlpha(T.accent, 0.85 * k);
      c.lineWidth = (r.big ? 8 : 5) * (0.5 + k * 0.5);
      c.beginPath();
      c.moveTo(r.x0, r.y0);
      c.lineTo(x1, y1);
      c.stroke();
      c.strokeStyle = withAlpha(T.glow, k);
      c.lineWidth = r.big ? 3 : 2;
      c.beginPath();
      c.moveTo(r.x0, r.y0);
      c.lineTo(x1, y1);
      c.stroke();
      c.restore();
    }
    // 3) tekkan joyda kichik nur guli: to'rt gulbarg ochilib so'nadi
    for (const b of this.blooms) {
      const k = clamp01(b.life / b.max);
      const r = (b.big ? 12 : 7) * (1.2 - k * 0.6);
      c.fillStyle = withAlpha(T.glow, 0.85 * k);
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + this.t;
        c.beginPath();
        c.ellipse(
          b.x + Math.cos(a) * r * 0.5,
          b.y + Math.sin(a) * r * 0.5,
          r * 0.5,
          r * 0.22,
          a,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
      px(c, withAlpha(T.accent, k), b.x - 1, b.y - 1, 3, 3);
    }
    // 4) davolash halqasi: Rohiba atrofidan kengayadi
    if (this.ring > 0) {
      const k = this.ring / HEAL_RING_LIFE;
      c.strokeStyle = withAlpha(T.glow, 0.8 * k);
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(
        ctx.x,
        ctx.y + 10,
        (1 - k) * 70 + 8,
        ((1 - k) * 70 + 8) * LOTUS_TILT,
        0,
        0,
        Math.PI * 2,
      );
      c.stroke();
    }
    // 5) ko'tariluvchi nur zarralari
    for (const m of this.motes) {
      const k = clamp01(m.life / m.max);
      px(c, withAlpha(Math.floor(m.y) % 2 ? T.glow : T.accent, 0.9 * k), m.x, m.y, 1, 2);
    }
  }

  /** Rohiba super davomida ko'rinib turadi (Ninjadek yo'qolmaydi) */
  hidden() {
    return false;
  }
}
