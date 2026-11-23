/**
 * SOYA BO'RONI sahnasi (Ninja superi) — faqat chizish; zarar va vaqt super.ts / Game da.
 *
 *  TAYYORLANISH: Ninja qo'l belgisini qiladi, ekran qora-qirmiziga botadi, Ninja quyuq tutun
 *    bulutiga aylanib yo'qoladi.
 *  ZARBA: har dushman yonida bir lahzaga qora SOYA-NUSXA paydo bo'ladi (tutundan chiqadi, qizil
 *    sharfli) va uni kesadi — dushman ustida qizil kesik chiziqlari (bossda — katta xoch), so'ng
 *    nusxa yana tutunga aylanadi.
 *  OQIBAT: Ninja xona markazida tutundan paydo bo'lib ikki qilichini qinga qaytaradi.
 *
 * Ranglar skin theme'idan (accent — kesik cheti, edge — po'lat yadro, shade/mist — tutun).
 * "Effektlarni kamaytirish": tutun bulutlari va uchqunlar kam, chaqnash yo'q. Math.random yo'q.
 */
import { px } from "./animation";
import { withAlpha } from "./hero";
import { renderSprite, type SpritePalette } from "./sprites";
import { SHINOBI_FRAME, SHINOBI_SUPER_FRAME } from "./shinobiSprites";
import type { SuperCast, SuperStage } from "./super";
import type { SceneCtx, SceneTarget, SuperScene } from "./superScene";

/** Soya-nusxa yashash vaqti va kesik chizig'i yashash vaqti (s) */
export const CLONE_LIFE = 0.32;
export const STORM_SLASH_LIFE = 0.55;
/** Tutun bulutlari (bir puflashda) — oddiy va kamaytirilgan */
export const STORM_PUFFS = 9;
export const STORM_PUFFS_REDUCED = 3;
/** Tayyorlanishning shu ulushidan keyin Ninja tutunga aylangan (ko'rinmaydi) */
export const VANISH_AT = 0.6;

/** Soya-nusxa palitrasi: qop-qora, faqat sharf va ko'zlar qizil (skin rangidan) */
function clonePalette(accent: string): SpritePalette {
  return {
    id: `storm-clone-${accent}`,
    colors: ["#000000", "#0d090e", "#241a24", accent, "#9a94a6"],
  };
}

interface Puff {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

interface Clone {
  x: number;
  y: number;
  /** qarash tomoni: 1 — o'ngga (dushman o'ngida) */
  dir: number;
  life: number;
  boss: boolean;
}

interface Slash {
  x: number;
  y: number;
  a: number;
  len: number;
  life: number;
  max: number;
  big: boolean;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export class StormScene implements SuperScene {
  private t = 0;
  private dim = 0;
  private castOn = false;
  private reduced = false;
  private side = 1;
  private seed = 7;
  puffs: Puff[] = [];
  clones: Clone[] = [];
  slashes: Slash[] = [];

  get alive() {
    return (
      this.castOn ||
      this.dim > 0.02 ||
      this.puffs.length > 0 ||
      this.clones.length > 0 ||
      this.slashes.length > 0
    );
  }

  /** O'z kichik generatori (Math.random emas) */
  private rnd() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  /** Tutun bulutlari: x,y atrofida n ta, tarqalish tezligi sp */
  private puff(x: number, y: number, n: number, sp: number) {
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2;
      const v = sp * (0.4 + this.rnd() * 0.6);
      const life = 0.45 + this.rnd() * 0.35;
      this.puffs.push({
        x: x + Math.cos(a) * 3,
        y: y + Math.sin(a) * 2,
        r: 4 + this.rnd() * 5,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v * 0.6 - 8,
        life,
        max: life,
      });
    }
  }

  private puffN(ctx: SceneCtx) {
    return ctx.reduced ? STORM_PUFFS_REDUCED : STORM_PUFFS;
  }

  /** Tayyorlanish oxirida va zarbada Ninja ko'rinmaydi (tutunga aylangan) */
  hidden(cast: SuperCast) {
    if (cast.stage === "strike") return true;
    return cast.stage === "prep" && cast.t >= cast.def.stages.prep * VANISH_AT;
  }

  /** Qo'l belgisi → (tutun) → markazda: ikki qilich yelka ustida → qinda → oddiy holat */
  pose(cast: SuperCast) {
    const F = SHINOBI_SUPER_FRAME;
    if (cast.stage === "card" || cast.stage === "prep" || cast.stage === "strike") return F.seal;
    if (cast.t < 0.35) return F.draw;
    return cast.t < 0.75 ? F.sheathe : null;
  }

  stage(s: SuperStage, _cast: SuperCast, ctx: SceneCtx) {
    this.reduced = ctx.reduced;
    // Ninja tutunga aylanadi: tayyorlanish boshida bir puflash, zarbada — quyuq bulut
    if (s === "prep") this.puff(ctx.x, ctx.y + 4, Math.ceil(this.puffN(ctx) / 2), 14);
    if (s === "strike") {
      this.puff(ctx.x, ctx.y, this.puffN(ctx), 30);
      ctx.shake(0.12);
    }
    // markazda tutundan chiqadi
    if (s === "after") {
      this.puff(ctx.x, ctx.y + 2, this.puffN(ctx), 36);
      if (!ctx.reduced) ctx.fx.burst(ctx.x, ctx.y, ctx.theme.mist, 8, 50, 2);
    }
  }

  /** Soya-nusxa dushman yonida tutundan chiqadi (yonlari navbat bilan almashadi) */
  mark(t: SceneTarget, boss: boolean, _cast: SuperCast, ctx: SceneCtx) {
    const live = t.live ?? t;
    this.side = -this.side;
    const off = t.size / 2 + (boss ? 14 : 9);
    const x = live.x - this.side * off;
    this.clones.push({ x, y: live.y, dir: this.side, life: CLONE_LIFE, boss });
    this.puff(x, live.y + 4, ctx.reduced ? 1 : 3, 18);
  }

  /** Nusxa kesdi: qizil kesik chiziqlari (bossda — katta xoch), po'lat uchqunlari */
  hit(t: SceneTarget, boss: boolean, _killed: boolean, _cast: SuperCast, ctx: SceneCtx) {
    const live = t.live ?? t;
    const a = -0.7 + this.rnd() * 0.5;
    const len = t.size * (boss ? 2.6 : 2) + 16;
    const life = STORM_SLASH_LIFE * (boss ? 1.5 : 1);
    this.slashes.push({ x: live.x, y: live.y - 2, a, len, life, max: life, big: boss });
    this.slashes.push({
      x: live.x,
      y: live.y - 2,
      a: a + (boss ? Math.PI / 2 : 1.1),
      len: len * (boss ? 1 : 0.8),
      life,
      max: life,
      big: boss,
    });
    ctx.fx.burst(live.x, live.y, ctx.theme.edge, ctx.reduced ? 2 : boss ? 12 : 5, 90, 1);
    ctx.shake(boss ? 0.25 : 0.06);
    return false;
  }

  update(dt: number, cast: SuperCast | null, ctx: SceneCtx) {
    this.t += dt;
    this.castOn = !!cast;
    this.reduced = ctx.reduced;
    const want = cast && cast.stage !== "card" ? 1 : 0;
    this.dim += (want - this.dim) * Math.min(1, dt * (want ? 6 : 4));
    if (this.dim < 0.005) this.dim = 0;
    for (const p of this.puffs) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - Math.min(1, dt * 3);
      p.vy *= 1 - Math.min(1, dt * 3);
      p.r += dt * 6;
    }
    this.puffs = this.puffs.filter((p) => p.life > 0);
    for (const c of this.clones) {
      const before = c.life;
      c.life -= dt;
      // nusxa yana tutunga aylanadi
      if (before > 0.06 && c.life <= 0.06) this.puff(c.x, c.y + 2, this.reduced ? 1 : 2, 16);
    }
    this.clones = this.clones.filter((c) => c.life > 0);
    for (const s of this.slashes) s.life -= dt;
    this.slashes = this.slashes.filter((s) => s.life > 0);
  }

  /** Nusxalar ostidagi soya dog'lari */
  renderGround(c: CanvasRenderingContext2D) {
    for (const k of this.clones) {
      const a = clamp01(k.life / CLONE_LIFE);
      c.fillStyle = `rgba(0,0,0,${0.35 * a})`;
      c.beginPath();
      c.ellipse(k.x, k.y + 12, 7, 2.5, 0, 0, Math.PI * 2);
      c.fill();
    }
  }

  renderAir(c: CanvasRenderingContext2D, cast: SuperCast | null, ctx: SceneCtx) {
    const T = ctx.theme;
    const V = ctx.view;
    // 1) dunyo qora-qirmiziga botadi
    if (this.dim > 0.01) {
      px(c, `rgba(12,2,8,${0.62 * this.dim})`, V.x, V.y, V.w, V.h);
      if (cast && !this.hidden(cast) && ctx.drawOwner) ctx.drawOwner(c);
    }
    // 2) soya-nusxalar: tutundan chiqib, kesish pozasida
    const pal = clonePalette(T.accent);
    for (const k of this.clones) {
      const age = CLONE_LIFE - k.life;
      c.save();
      c.globalAlpha = clamp01(Math.min(age / 0.06, k.life / 0.08)) * 0.92;
      const frame = age < 0.1 ? SHINOBI_FRAME.left : SHINOBI_FRAME.left + 1;
      renderSprite(c, "shinobi", "attack", frame, k.x, k.y, false, k.dir < 0, false, pal);
      c.restore();
    }
    // 3) qizil kesik chiziqlari: tashqarisi accent, ichi po'lat; qisqarib so'nadi
    for (const s of this.slashes) {
      const k = clamp01(s.life / s.max);
      const grow = clamp01((1 - k) * 6);
      const half = (s.len / 2) * grow;
      const ux = Math.cos(s.a) * half,
        uy = Math.sin(s.a) * half;
      c.save();
      c.lineCap = "square";
      c.strokeStyle = withAlpha(T.accentDark, 0.8 * k);
      c.lineWidth = s.big ? 6 : 5;
      c.beginPath();
      c.moveTo(s.x - ux, s.y - uy);
      c.lineTo(s.x + ux, s.y + uy);
      c.stroke();
      c.strokeStyle = withAlpha(T.accent, k);
      c.lineWidth = s.big ? 3 : 2;
      c.beginPath();
      c.moveTo(s.x - ux, s.y - uy);
      c.lineTo(s.x + ux, s.y + uy);
      c.stroke();
      c.strokeStyle = withAlpha(T.edge, k);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(s.x - ux, s.y - uy);
      c.lineTo(s.x + ux, s.y + uy);
      c.stroke();
      c.restore();
    }
    // 4) tutun bulutlari
    for (const p of this.puffs) {
      const k = clamp01(p.life / p.max);
      c.fillStyle = withAlpha(T.shade, 0.75 * k);
      c.beginPath();
      c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = withAlpha(T.mist, 0.35 * k);
      c.beginPath();
      c.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.5, 0, Math.PI * 2);
      c.fill();
    }
  }
}
