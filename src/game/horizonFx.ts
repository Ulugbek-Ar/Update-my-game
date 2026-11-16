/**
 * UFQ KESIMI sahnasi (Ritsar superi) — faqat chizish; zarar, vaqt va kesim yo'li super.ts / Game da.
 *
 *  TAYYORLANISH: Ritsar bir tizzasiga cho'kadi, qilichni beliga tortadi; dunyo qorayadi, tig' oqarib
 *    porlaydi, atrofdan havo zarrachalari spiral bo'lib tig'ga so'riladi, kesim yo'nalishida
 *    ingichka "ufq" chizig'i paydo bo'ladi.
 *  ZARBA: bir urishda ulkan yarim oy KESIM to'lqini otiladi (cast.paths) — xona chetigacha uchib
 *    kattalashadi, ortida yorqin iz va yerda kesik qoladi; devorga urilib chaqnaydi. Yo'lidagi har
 *    dushman shu lahzada qotadi — ustida ingichka oq kesik chizig'i porlaydi.
 *  OQIBAT: "SHING!" (release) — kesilganlar birdan ikkiga bo'linadi: yuqori yarmi kesik bo'ylab
 *    sirpanib tushadi, so'ng ikkala yarmi piksel bo'laklarga sochiladi. Ritsar qilichni silkitib
 *    qayta tik turadi.
 *
 * Ranglar faol skin theme'idan; "Muz Ritsar" (flair "frost") — kesim ortida muz kristallari qoladi.
 * Xavf ranglari (danger.ts) ishlatilmaydi. "Effektlarni kamaytirish": chaqnashlar yo'q, zarrachalar
 * kam. Zarrachalar soni chegaralangan. Math.random ishlatilmaydi.
 */
import { px } from "./animation";
import { withAlpha } from "./hero";
import type { SkinTheme } from "./skinFx";
import { KNIGHT_SUPER_FRAME, PALETTES, renderSprite, spriteSize } from "./sprites";
import { pathHalf, type SuperCast, type SuperDef, type SuperPath, type SuperStage } from "./super";
import { renderSuperCard, type CardText } from "./superFx";
import { KNIGHT_PORTRAIT_GRID } from "./knightPortrait";
import type { SceneCtx, SceneTarget, SuperScene } from "./superScene";

/** Ikkiga bo'lingan yarimlar siljiydigan vaqt (s), so'ng piksel bo'laklarga sochiladi */
export const SPLIT_TIME = 0.3;
export const SPLIT_FADE = 0.12;
/** Kesim to'lqini devorga yetgach so'nish vaqti (s) va ortidagi iz yashashi (s) */
export const WAVE_FADE = 0.16;
export const TRAIL_LIFE = 0.9;
/** Piksel bo'laklari va muz kristallari chegarasi: oddiy / kamaytirilgan */
export const MAX_BITS = 260;
export const MAX_BITS_REDUCED = 50;
export const MAX_CRYSTALS = 90;
export const MAX_CRYSTALS_REDUCED = 16;
/** Yarim oyning ko'rinadigan balandligi zarba hududiga nisbatan */
export const VISUAL_SCALE = 1.3;
/** Tig'ga so'riluvchi havo zarrachalari (bir vaqtda) */
export const MAX_MOTES = 60;

interface Wave {
  p: SuperPath;
  /** Zarba boshidan o'tgan vaqt minus kechikish (manfiy — hali otilmagan) */
  age: number;
  /** Devorga yetdi: shu paytdan so'nadi */
  ended: number;
  /** Ortidagi iz qolgan vaqti */
  trail: number;
  /** Oxirgi kristall tashlangan masofa */
  dropped: number;
}

interface Pending {
  t: SceneTarget;
  a: number;
  age: number;
}

interface Half {
  t: SceneTarget;
  x: number;
  y: number;
  a: number;
  age: number;
  burst: boolean;
}

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  col: string;
  size: number;
}

interface Mote {
  ang: number;
  r: number;
  w: number;
  life: number;
}

interface Crystal {
  x: number;
  y: number;
  life: number;
  max: number;
  size: number;
  tone: number;
  vy: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (k: number) => 1 - (1 - clamp01(k)) ** 3;

/** To'rt nurli yulduzcha (tig' yaltirashi, kesik chaqnashi) */
function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  const bx = Math.round(x),
    by = Math.round(y),
    n = Math.max(1, Math.round(r));
  px(c, col, bx - n, by, n * 2 + 1, 1);
  px(c, col, bx, by - n, 1, n * 2 + 1);
  px(c, col, bx - 1, by - 1, 3, 3);
}

/** Romb (muz kristali) */
function diamond(c: CanvasRenderingContext2D, x: number, y: number, s: number, col: string) {
  const bx = Math.round(x),
    by = Math.round(y);
  px(c, col, bx, by - s, 1, s * 2 + 1);
  px(c, col, bx - 1, by - Math.max(0, s - 1), 3, Math.max(1, s * 2 - 1));
  if (s >= 2) px(c, col, bx - 2, by, 5, 1);
}

export class HorizonScene implements SuperScene {
  /** Sahna soati (haqiqiy vaqt) */
  t = 0;
  /** Dunyo qorong'iligi 0..1 */
  dim = 0;
  /** Tig' porlashi 0..1 */
  glow = 0;
  /** Ekran chaqnashi (kamaytirilganda — yo'q) */
  flash = 0;
  released = false;
  waves: Wave[] = [];
  pending = new Map<object, Pending>();
  halves: Half[] = [];
  bits: Bit[] = [];
  motes: Mote[] = [];
  crystals: Crystal[] = [];
  /** "Muz Ritsar": kesim ortida muz kristallari */
  frost = false;
  /** Devordagi urilish chaqnashlari */
  impacts: { x: number; y: number; a: number; age: number }[] = [];
  private seed = 97531;
  private at = { x: 160, y: 120, dir: 1 };
  private aim = { x: 1, y: 0 };
  private castOn = false;
  private reduced = false;
  private releaseAt = 0.28;
  private stageNow: SuperStage | "card" | null = null;
  /** "SHING!" yaltirashi: o'tgan vaqt (−1 — yo'q) */
  private shingT = -1;
  /** Silkitish izi: o'tgan vaqt (−1 — yo'q) */
  private flickT = -1;
  private params: Readonly<Record<string, number>> = {};

  private rnd() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  get alive() {
    return (
      this.castOn ||
      this.dim > 0.02 ||
      this.flash > 0.02 ||
      this.waves.length > 0 ||
      this.halves.length > 0 ||
      this.bits.length > 0 ||
      this.crystals.length > 0 ||
      this.impacts.length > 0
    );
  }

  /** Tizzada (tig' titraydi) → keng kesish → tig' baland → "SHING!" da silkitish → tik turish */
  pose(cast: SuperCast) {
    const F = KNIGHT_SUPER_FRAME;
    if (cast.stage === "card") return F.kneel;
    if (cast.stage === "prep")
      return cast.t > 0.22 && Math.floor(this.t * 22) % 2 ? F.kneelGlow : F.kneel;
    if (cast.stage === "strike") return cast.t < 0.14 ? F.slash : F.follow;
    const r = this.releaseAt;
    if (cast.t < r) return F.follow;
    if (cast.t < r + 0.16) return F.flick;
    return cast.t < r + 0.42 ? F.rise : null;
  }

  /** Tig' (ekranda): dasta va uchi — tizzadagi pozada, qarash tomoniga qarab */
  private blade() {
    const { x, y, dir } = this.at;
    return {
      hx: x + dir * -5,
      hy: y + 6,
      tx: x + dir * -15,
      ty: y + 9,
    };
  }

  private addBit(b: Bit) {
    const cap = this.reduced ? MAX_BITS_REDUCED : MAX_BITS;
    if (this.bits.length >= cap) this.bits.shift();
    this.bits.push(b);
  }

  private addCrystal(cr: Crystal) {
    const cap = this.reduced ? MAX_CRYSTALS_REDUCED : MAX_CRYSTALS;
    if (this.crystals.length >= cap) this.crystals.shift();
    this.crystals.push(cr);
  }

  /** Uchqun/bo'lak tutami */
  private spray(x: number, y: number, n: number, speed: number, cols: readonly string[], up = 30) {
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2;
      const v = speed * (0.35 + this.rnd() * 0.65);
      const life = 0.35 + this.rnd() * 0.5;
      this.addBit({
        x: x + (this.rnd() - 0.5) * 4,
        y: y + (this.rnd() - 0.5) * 4,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - up,
        life,
        max: life,
        col: cols[Math.floor(this.rnd() * cols.length)] ?? "#ffffff",
        size: this.rnd() < 0.35 ? 2 : 1,
      });
    }
  }

  stage(s: SuperStage, cast: SuperCast, ctx: SceneCtx) {
    this.reduced = ctx.reduced;
    this.frost = ctx.flair === "frost";
    this.releaseAt = cast.def.release ?? this.releaseAt;
    this.params = cast.def.params;
    this.aim = { ...cast.aim };
    this.stageNow = s;
    const T = ctx.theme;
    if (s === "prep") {
      this.at = { x: ctx.x, y: ctx.y, dir: ctx.dir };
      // tizzaga cho'kish: yerdan chang
      ctx.fx.burst(ctx.x, ctx.y + 11, T.mist, ctx.reduced ? 2 : 6, 40, 1);
      ctx.shake(0.08);
    }
    if (s === "strike") {
      // bir urish: kesim to'lqinlari otiladi, ekran chaqnaydi
      this.waves = cast.paths.map((p) => ({ p, age: -p.delay, ended: -1, trail: -1, dropped: 0 }));
      this.glow = 0;
      this.motes = [];
      if (!ctx.reduced) this.flash = Math.max(this.flash, 0.26);
      ctx.shake(0.45);
      const b = this.blade();
      ctx.fx.burst(b.tx, b.ty, T.edge, ctx.reduced ? 3 : 10, 140, 1, "star");
      this.spray(ctx.x + this.aim.x * 10, ctx.y + this.aim.y * 10, ctx.reduced ? 3 : 12, 120, [
        T.edge,
        T.glow,
      ]);
    }
    if (s === "after") {
      this.at = { x: ctx.x, y: ctx.y, dir: ctx.dir };
      // qotgan dushmanlar ustidagi kesik chiziqlari yorqinlashadi
      for (const p of this.pending.values()) p.age = 0;
    }
  }

  mark(t: SceneTarget, boss: boolean, _cast: SuperCast, ctx: SceneCtx) {
    const live = t.live ?? t;
    // kesik chizig'i to'lqin yo'nalishida, ozgina qiya
    const tilt = (this.rnd() - 0.5) * 0.3;
    const a = Math.atan2(this.aim.y, this.aim.x) + tilt;
    this.pending.set(t.ref ?? t, { t, a, age: 0 });
    const T = ctx.theme;
    this.spray(live.x, live.y - t.size * 0.1, ctx.reduced ? 2 : boss ? 14 : 6, 90, [
      T.edge,
      T.glow,
    ]);
    ctx.shake(boss ? 0.3 : 0.06);
  }

  /** "SHING!": hamma kesilgan birdan bo'linadi — oq yaltirash va chaqnash */
  release(_cast: SuperCast, ctx: SceneCtx) {
    this.released = true;
    this.shingT = 0;
    this.flickT = 0;
    if (!ctx.reduced) this.flash = Math.max(this.flash, 0.2);
    ctx.shake(0.4);
  }

  hit(t: SceneTarget, boss: boolean, killed: boolean, _cast: SuperCast, ctx: SceneCtx) {
    const live = t.live ?? t;
    const key = t.ref ?? t;
    const a = this.pending.get(key)?.a ?? Math.atan2(this.aim.y, this.aim.x);
    this.pending.delete(key);
    const T = ctx.theme;
    if (boss) {
      // bossga — katta kesik chaqnashi va uchqunlar (boss bo'linmaydi)
      this.impacts.push({ x: live.x, y: live.y, a, age: 0 });
      this.spray(live.x, live.y, ctx.reduced ? 6 : 26, 150, [T.edge, T.glow, T.accent]);
      ctx.shake(0.5);
      return false;
    }
    if (!killed || !t.sprite) {
      this.spray(live.x, live.y, ctx.reduced ? 2 : 8, 70, [T.edge, T.glow]);
      return false;
    }
    // mob ikkiga bo'linadi: jasadni sahna o'zi ko'rsatadi
    this.halves.push({ t, x: live.x, y: live.y, a, age: 0, burst: false });
    return true;
  }

  update(dt: number, cast: SuperCast | null, ctx: SceneCtx) {
    this.t += dt;
    this.castOn = !!cast;
    this.reduced = ctx.reduced;
    this.frost = ctx.flair === "frost";
    if (cast) this.at = { x: ctx.x, y: ctx.y, dir: ctx.dir };
    const st = cast?.stage ?? null;
    this.stageNow = st;
    const T = ctx.theme;
    // qorong'ilik: tayyorlanishdan "SHING!" dan biroz keyingacha
    const want =
      cast && st !== "card" && !(st === "after" && cast.t > this.releaseAt + 0.15) ? 1 : 0;
    this.dim += (want - this.dim) * Math.min(1, dt * (want ? 8 : 4));
    if (this.dim < 0.005) this.dim = 0;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    if (this.shingT >= 0 && (this.shingT += dt) > 0.45) this.shingT = -1;
    if (this.flickT >= 0 && (this.flickT += dt) > 0.4) this.flickT = -1;

    // tayyorlanish: tig' oqaradi, havo zarrachalari spiral bo'lib so'riladi
    if (st === "prep" && cast) {
      this.glow = easeOut(cast.k * 1.15);
      const want = Math.round(
        (ctx.reduced ? (this.params["motesReduced"] ?? 8) : (this.params["motes"] ?? 30)) *
          Math.min(1, cast.t / 0.2 + 0.3),
      );
      for (let n = this.motes.length; n < Math.min(MAX_MOTES, want); n++)
        this.motes.push({
          ang: this.rnd() * Math.PI * 2,
          r: 22 + this.rnd() * 42,
          w: (3 + this.rnd() * 3) * (this.rnd() < 0.5 ? -1 : 1),
          life: 1,
        });
    } else if (st !== "card") this.glow = Math.max(0, this.glow - dt * 4);
    for (const m of this.motes) {
      m.ang += m.w * dt;
      // markazga yaqinlashgan sari tezlashadi
      m.r -= (45 + (70 - m.r) * 2.4) * dt;
      if (m.r < 3) {
        m.life = 0;
        // tig'ga yetgan zarracha: kichik yaltirash
        if (!ctx.reduced && this.rnd() < 0.3) {
          const b = this.blade();
          this.spray((b.hx + b.tx) / 2, (b.hy + b.ty) / 2, 1, 20, [T.edge], 0);
        }
      }
    }
    this.motes = this.motes.filter((m) => m.life > 0);
    if (st !== "prep") this.motes = [];

    // kesim to'lqinlari: uchadi, kattalashadi, devorga urilib so'nadi; iz qoladi
    for (const w of this.waves) {
      w.age += dt;
      if (w.age < 0) continue;
      if (w.trail < 0) w.trail = 0;
      w.trail += dt;
      const front = w.age * w.p.speed;
      // muz kristallari (Muz Ritsar) yoki uchqunlar: to'lqin chetlaridan
      const step = this.frost ? (ctx.reduced ? 22 : 7) : ctx.reduced ? 40 : 16;
      while (w.dropped + step <= Math.min(front, w.p.len)) {
        w.dropped += step;
        const h = pathHalf(w.p, w.dropped);
        const off = (this.rnd() * 2 - 1) * h * 0.9;
        const x = w.p.x + w.p.dx * w.dropped - w.p.dy * off;
        const y = w.p.y + w.p.dy * w.dropped + w.p.dx * off;
        if (this.frost) {
          const life = 0.7 + this.rnd() * 0.6;
          this.addCrystal({
            x,
            y,
            life,
            max: life,
            size: 1 + Math.floor(this.rnd() * 3),
            tone: Math.floor(this.rnd() * 3),
            vy: 4 + this.rnd() * 8,
          });
        } else this.spray(x, y, 1, 30, [T.glow, T.edge], 6);
      }
      if (w.ended < 0 && front >= w.p.len) {
        w.ended = 0;
        // devorga urildi: chaqnash va silkinish
        const x = w.p.x + w.p.dx * w.p.len,
          y = w.p.y + w.p.dy * w.p.len;
        this.impacts.push({ x, y, a: Math.atan2(w.p.dx, -w.p.dy), age: 0 });
        this.spray(x, y, ctx.reduced ? 3 : 14, 110, [T.edge, T.glow, T.accent]);
        ctx.shake(0.22);
      } else if (w.ended >= 0) w.ended += dt;
    }
    this.waves = this.waves.filter((w) => w.age < 0 || w.trail < TRAIL_LIFE);
    for (const im of this.impacts) im.age += dt;
    this.impacts = this.impacts.filter((im) => im.age < 0.4);
    for (const p of this.pending.values()) p.age += dt;

    for (const cr of this.crystals) {
      cr.life -= dt;
      cr.y += cr.vy * dt;
    }
    this.crystals = this.crystals.filter((cr) => cr.life > 0);

    // ikkiga bo'lingan jasadlar: yuqori yarmi sirpanib tushadi, so'ng piksel bo'laklarga sochiladi
    const per = ctx.reduced ? (this.params["bitsReduced"] ?? 4) : (this.params["bits"] ?? 16);
    for (const h of this.halves) {
      h.age += dt;
      if (!h.burst && h.age >= SPLIT_TIME) {
        h.burst = true;
        const sprite = h.t.sprite;
        const cols = sprite ? (h.t.palette?.colors ?? PALETTES[sprite]).slice(1) : [T.edge, T.glow];
        this.spray(h.x, h.y, per, 85, [...cols, ...cols, T.edge], 45);
        if (this.frost)
          for (let i = 0; i < (ctx.reduced ? 1 : 4); i++) {
            const life = 0.5 + this.rnd() * 0.5;
            this.addCrystal({
              x: h.x + (this.rnd() - 0.5) * h.t.size,
              y: h.y + (this.rnd() - 0.5) * h.t.size,
              life,
              max: life,
              size: 1 + Math.floor(this.rnd() * 2),
              tone: Math.floor(this.rnd() * 3),
              vy: 10,
            });
          }
      }
    }
    this.halves = this.halves.filter((h) => h.age < SPLIT_TIME + SPLIT_FADE);
    for (const b of this.bits) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= 1 - Math.min(1, dt * 2.5);
      b.vy += 220 * dt;
      b.life -= dt;
    }
    this.bits = this.bits.filter((b) => b.life > 0);
    if (!cast) this.pending.clear();
    if (!cast && !this.alive) this.released = false;
  }

  // ---------------- chizish ----------------

  renderGround(c: CanvasRenderingContext2D, cast: SuperCast | null, ctx: SceneCtx) {
    const T = ctx.theme;
    // kesim izi yerda: to'lqin o'tgan joyda ingichka yorug' kesik, sekin so'nadi
    for (const w of this.waves) {
      if (w.age < 0) continue;
      const front = Math.min(w.p.len, w.age * w.p.speed);
      const k = 1 - clamp01(w.trail / TRAIL_LIFE);
      c.strokeStyle = withAlpha(T.accent, 0.35 * k);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(w.p.x + w.p.dx * 10, w.p.y + 10 + w.p.dy * 10);
      c.lineTo(w.p.x + w.p.dx * front, w.p.y + 10 + w.p.dy * front);
      c.stroke();
    }
    if (!cast || cast.stage !== "prep") return;
    // tizzadagi Ritsar atrofida torayib boruvchi halqa (kuch yig'ilmoqda)
    const k = clamp01(cast.k);
    const { x, y } = this.at;
    const r = 30 - 20 * easeOut(k);
    c.strokeStyle = withAlpha(T.accent, 0.3 + 0.5 * k);
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(x, y + 12, r, r * 0.4, 0, 0, Math.PI * 2);
    c.stroke();
  }

  renderAir(c: CanvasRenderingContext2D, cast: SuperCast | null, ctx: SceneCtx) {
    const T = ctx.theme;
    const V = ctx.view;
    // 1) dunyo qorayadi (kino kadri), Ritsar ustidan qayta chiziladi
    if (this.dim > 0.01) {
      c.fillStyle = `rgba(4,6,14,${0.42 * this.dim})`;
      c.fillRect(V.x, V.y, V.w, V.h);
      if (cast && ctx.drawOwner) ctx.drawOwner(c);
    }
    // 2) "ufq" chizig'i: tayyorlanish oxirida kesim yo'nalishida ingichka chiziq
    if (cast?.stage === "prep" && cast.k > 0.35) {
      const k = clamp01((cast.k - 0.35) / 0.65);
      const { x, y } = this.at;
      const len = 340 * easeOut(k);
      for (let s = 12; s < len; s += 4) {
        const a = 0.35 * k * (1 - s / 360);
        if (a <= 0.01) break;
        px(
          c,
          withAlpha(T.glow, a),
          Math.round(x + this.aim.x * s),
          Math.round(y + this.aim.y * s),
          2,
          1,
        );
      }
    }
    // 3) porlayotgan tig' va so'rilayotgan havo zarrachalari
    if (this.glow > 0.01) this.renderBlade(c, T, ctx.reduced);
    if (this.motes.length) {
      const b = this.blade();
      const cx = (b.hx + b.tx) / 2,
        cy = (b.hy + b.ty) / 2;
      for (const m of this.motes) {
        const x = cx + Math.cos(m.ang) * m.r,
          y = cy + Math.sin(m.ang) * m.r * 0.7;
        // markazga qarab cho'zilgan iz
        const tx = cx + Math.cos(m.ang - m.w * 0.04) * (m.r + 5),
          ty = cy + Math.sin(m.ang - m.w * 0.04) * (m.r + 5) * 0.7;
        const a = clamp01((70 - m.r) / 30);
        c.strokeStyle = withAlpha(m.w > 0 ? T.glow : T.edge, a);
        c.lineWidth = m.r < 20 ? 2 : 1;
        c.beginPath();
        c.moveTo(tx, ty);
        c.lineTo(x, y);
        c.stroke();
      }
    }
    // 4) kesim to'lqinlari: yorqin iz va yarim oy
    for (const w of this.waves) if (w.age >= 0) this.renderWave(c, w, T, ctx.reduced);
    // 5) muz kristallari
    for (const cr of this.crystals) {
      const a = Math.min(1, (cr.life / cr.max) * 2);
      const col = cr.tone === 0 ? T.edge : cr.tone === 1 ? T.glow : T.mist;
      diamond(c, cr.x, cr.y, cr.size, withAlpha(col, a));
    }
    // 6) qotgan dushmanlardagi oq kesik chizig'i ("SHING!" ni kutadi)
    for (const p of this.pending.values()) {
      const live = p.t.live ?? p.t;
      const L = p.t.size * 0.8 + 4;
      const ux = Math.cos(p.a) * L,
        uy = Math.sin(p.a) * L;
      const y = live.y - p.t.size * 0.08;
      const fresh = clamp01(1 - p.age / 0.12);
      if (fresh > 0) {
        c.strokeStyle = withAlpha(T.glow, 0.9 * fresh);
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(live.x - ux, y - uy);
        c.lineTo(live.x + ux, y + uy);
        c.stroke();
      }
      c.strokeStyle = withAlpha(T.edge, 0.75 + 0.25 * Math.sin(this.t * 24));
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(live.x - ux, y - uy);
      c.lineTo(live.x + ux, y + uy);
      c.stroke();
    }
    // 7) ikkiga bo'lingan dushmanlar
    for (const h of this.halves) this.renderHalves(c, h, T);
    // 8) devor/bossdagi urilish chaqnashi
    for (const im of this.impacts) {
      const k = im.age / 0.4;
      const L = 10 + 26 * easeOut(k);
      const ux = Math.cos(im.a) * L,
        uy = Math.sin(im.a) * L;
      c.strokeStyle = withAlpha(T.edge, 1 - k);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(im.x - ux, im.y - uy);
      c.lineTo(im.x + ux, im.y + uy);
      c.stroke();
      if (!ctx.reduced) star(c, im.x, im.y, 2 + 8 * (1 - k), withAlpha("#ffffff", 1 - k));
    }
    // 9) piksel bo'laklari va uchqunlar
    for (const b of this.bits) {
      const a = Math.min(1, (b.life / b.max) * 2.5);
      px(c, withAlpha(b.col, a), Math.round(b.x), Math.round(b.y), b.size, b.size);
    }
    // 10) "SHING!": Ritsar qilichni silkitadi — tig' bo'ylab yaltirash va yoy
    if (this.flickT >= 0) {
      const k = clamp01(this.flickT / 0.4);
      const { x, y, dir } = this.at;
      c.strokeStyle = withAlpha(T.glow, 0.8 * (1 - k));
      c.lineWidth = 2;
      c.beginPath();
      if (dir > 0) c.arc(x + 6, y + 2, 13, -1.2, 0.5 + 0.6 * k);
      else c.arc(x - 6, y + 2, 13, Math.PI - 0.5 - 0.6 * k, Math.PI + 1.2);
      c.stroke();
      star(c, x + dir * 15, y + 9, 1 + 5 * (1 - k), withAlpha("#ffffff", 1 - k));
    }
    if (this.shingT >= 0 && !ctx.reduced) {
      // ekran bo'ylab ingichka oq "ufq" chizig'i — kesim yo'nalishida
      const k = clamp01(this.shingT / 0.45);
      const L = 360 * (1 - k * 0.6);
      const { x, y } = this.at;
      c.strokeStyle = withAlpha(T.edge, 0.8 * (1 - k));
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x - this.aim.x * L, y - this.aim.y * L);
      c.lineTo(x + this.aim.x * L, y + this.aim.y * L);
      c.stroke();
    }
    // 11) ekran chaqnashi
    if (this.flash > 0.01) {
      c.fillStyle = withAlpha(T.edge, Math.min(0.3, this.flash));
      c.fillRect(V.x, V.y, V.w, V.h);
    }
  }

  /** Tizzadagi Ritsar tig'i: oqarib porlaydi, uchida yulduzcha */
  private renderBlade(c: CanvasRenderingContext2D, T: SkinTheme, reduced: boolean) {
    const b = this.blade();
    const g = this.glow;
    const pulse = reduced ? 1 : 0.75 + 0.25 * Math.sin(this.t * 40);
    // tig' atrofida yig'ilayotgan yorug'lik
    const mx = (b.hx + b.tx) / 2,
      my = (b.hy + b.ty) / 2;
    for (const [r, a] of [
      [14, 0.12],
      [9, 0.2],
      [5, 0.3],
    ] as const) {
      c.fillStyle = withAlpha(T.glow, a * g);
      c.beginPath();
      c.ellipse(mx, my, r * (0.6 + 0.6 * g), r * 0.7 * (0.6 + 0.6 * g), 0, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = withAlpha(T.glow, 0.45 * g * pulse);
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(b.hx, b.hy);
    c.lineTo(b.tx, b.ty);
    c.stroke();
    c.strokeStyle = withAlpha(T.edge, g);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(b.hx, b.hy);
    c.lineTo(b.tx, b.ty);
    c.stroke();
    star(c, b.tx, b.ty, 1 + 4 * g * pulse, withAlpha("#ffffff", g));
  }

  /** Yarim oy shaklidagi kesim: oldi bo'rtgan, uchlari o'tkir; ortida yorqin iz */
  private renderWave(c: CanvasRenderingContext2D, w: Wave, T: SkinTheme, reduced: boolean) {
    const p = w.p;
    const front = Math.min(p.len + 6, w.age * p.speed);
    const h = pathHalf(p, front);
    const fade = w.ended >= 0 ? clamp01(1 - w.ended / WAVE_FADE) : 1;
    const trail = 1 - clamp01(w.trail / TRAIL_LIFE);
    const ux = p.dx,
      uy = p.dy;
    const nx = -uy,
      ny = ux;
    const at = (u: number, v: number): [number, number] => [
      p.x + ux * u + nx * v,
      p.y + uy * u + ny * v,
    ];
    // yorqin iz: to'lqin ortida torayib so'nuvchi tasma
    const back = Math.max(0, front - 150);
    if (trail > 0.01) {
      const seg = 8;
      c.fillStyle = withAlpha(T.accent, 0.28 * trail);
      c.beginPath();
      for (let i = 0; i <= seg; i++) {
        const u = back + ((front - back) * i) / seg;
        const v = pathHalf(p, u) * 0.55 * (i / seg);
        const [x, y] = at(u, -v);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      for (let i = seg; i >= 0; i--) {
        const u = back + ((front - back) * i) / seg;
        const v = pathHalf(p, u) * 0.55 * (i / seg);
        const [x, y] = at(u, v);
        c.lineTo(x, y);
      }
      c.closePath();
      c.fill();
      // markaziy oq chiziq
      const [x0, y0] = at(back, 0),
        [x1, y1] = at(front, 0);
      c.strokeStyle = withAlpha(T.edge, 0.55 * trail);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.stroke();
    }
    if (fade <= 0.01) return;
    // tezlik chiziqlari: to'lqin chetlari bo'ylab
    if (!reduced)
      for (let i = 0; i < 6; i++) {
        const v = ((i + 0.5) / 6 - 0.5) * 2 * h * 0.85;
        const L = 18 + ((i * 37) % 5) * 8;
        const [x0, y0] = at(front - L - 10, v),
          [x1, y1] = at(front - 8, v);
        c.strokeStyle = withAlpha(i % 2 ? T.glow : T.edge, 0.5 * fade);
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x1, y1);
        c.stroke();
      }
    // sharpa (ortda qolgan ikki xira nusxa) va asosiy yarim oy
    const ghosts = reduced ? [0] : [26, 13, 0];
    for (const g of ghosts) {
      const u = front - g;
      if (u < 0) continue;
      const hh = pathHalf(p, u);
      const a = g ? 0.25 * fade * (1 - g / 40) : fade;
      this.crescent(c, at, u, hh, T, a, g === 0);
    }
  }

  private crescent(
    c: CanvasRenderingContext2D,
    at: (u: number, v: number) => [number, number],
    u: number,
    h: number,
    T: SkinTheme,
    a: number,
    main: boolean,
  ) {
    // ko'rinishi zarba hududidan biroz kattaroq — "ulkan" kesim
    h *= VISUAL_SCALE;
    const bulge = h * 0.46;
    const thick = Math.max(5, h * 0.36);
    const n = 14;
    const shape = (outer: number, inner: number) => {
      c.beginPath();
      for (let i = 0; i <= n; i++) {
        const v = -h + (2 * h * i) / n;
        const q = 1 - (v / h) ** 2;
        const [x, y] = at(u + outer * q, v);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      for (let i = n; i >= 0; i--) {
        const v = -h + (2 * h * i) / n;
        const q = 1 - (v / h) ** 2;
        const [x, y] = at(u + inner * q, v);
        c.lineTo(x, y);
      }
      c.closePath();
    };
    // tashqi porlash → tana → oq tig' yadrosi
    shape(bulge + 3, bulge - thick - 3);
    c.fillStyle = withAlpha(T.accent, 0.35 * a);
    c.fill();
    shape(bulge, bulge - thick);
    c.fillStyle = withAlpha(T.glow, 0.85 * a);
    c.fill();
    if (!main) return;
    shape(bulge, bulge - thick * 0.35);
    c.fillStyle = withAlpha(T.edge, a);
    c.fill();
  }

  /** Kesik chizig'i bo'ylab ikkiga bo'lingan sprite: yuqori yarmi sirpanib tushadi */
  private renderHalves(c: CanvasRenderingContext2D, h: Half, T: SkinTheme) {
    const sprite = h.t.sprite;
    if (!sprite) return;
    const size = spriteSize(sprite);
    let ux = Math.cos(h.a),
      uy = Math.sin(h.a);
    // kesik chizig'i chapdan o'ngga (yuqori yarmi o'ngga sirpanadi)
    if (ux < 0) {
      ux = -ux;
      uy = -uy;
    }
    // yuqori tomonga qaragan normal
    let nx = -uy,
      ny = ux;
    if (ny > 0 || (ny === 0 && nx > 0)) {
      nx = -nx;
      ny = -ny;
    }
    const k = clamp01(h.age / SPLIT_TIME);
    const fade = h.age > SPLIT_TIME ? clamp01(1 - (h.age - SPLIT_TIME) / SPLIT_FADE) : 1;
    const L = size + 8;
    for (const top of [false, true]) {
      // yuqori yarmi: kesik bo'ylab sirpanadi va pastga tushadi; pastki yarmi joyida qoladi
      const slide = top ? easeOut(k) * 9 : 0;
      const drop = top ? k * k * 7 : k * 1;
      const side = top ? 1 : -1;
      c.save();
      c.globalAlpha = fade;
      c.translate(Math.round(h.x + ux * slide), Math.round(h.y + uy * slide + drop));
      c.beginPath();
      c.moveTo(-ux * L, -uy * L);
      c.lineTo(ux * L, uy * L);
      c.lineTo(ux * L + nx * side * L, uy * L + ny * side * L);
      c.lineTo(-ux * L + nx * side * L, -uy * L + ny * side * L);
      c.closePath();
      c.clip();
      renderSprite(c, sprite, "idle", 0, 0, 0, h.age < 0.05, !!h.t.flip, false, h.t.palette);
      c.restore();
    }
    // bo'linish lahzasida kesik chizig'i oq porlaydi
    if (h.age < 0.12) {
      const a = 1 - h.age / 0.12;
      c.strokeStyle = withAlpha(T.edge, a);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(h.x - ux * L * 0.8, h.y - uy * L * 0.8);
      c.lineTo(h.x + ux * L * 0.8, h.y + uy * L * 0.8);
      c.stroke();
    }
  }
}

// ---------------- cut-in karta ----------------

/** Portret kadrlari almashinuvi (plash va pat hilpiraydi), kadr/s */
export const CARD_WIND_FPS = 9;
/** Karta ulushida tig' bo'ylab yaltirash oralig'i (shu paytda portretning 3-kadri) */
export const GLINT_FROM = 0.34;
export const GLINT_TO = 0.7;
/** Portretdagi tig' (knightPortrait.ts): x markazi va y oralig'i, garda toshi, ko'z tirqishi (to'r pikseli) */
export const CARD_BLADE = {
  x: 48.5,
  y0: 81,
  y1: 95,
  gemY: 78,
  eyeY: 26.5,
  eyeX: [42.5, 54.5],
} as const;

/**
 * UFQ KESIMI kartasi: umumiy cut-in (superFx.ts: renderSuperCard) Ritsarning piksel-art portreti
 * bilan; plash va pat ikki kadr orasida hilpiraydi, portret kirib bo'lgach qilich tig'i bo'ylab oq yaltirash
 * yuguradi, ko'z tirqishida yorug'lik chaqnaydi. "Effektlarni kamaytirish": kadrlar almashmaydi.
 */
export function renderHorizonCard(
  c: CanvasRenderingContext2D,
  def: SuperDef,
  cast: Pick<SuperCast, "t" | "cardTime">,
  T: SkinTheme,
  frames: readonly (HTMLCanvasElement | null)[],
  text: CardText,
  reduced = false,
) {
  // 1↔2-kadr: pat va plash hilpiraydi; tig' yaltirashi paytida — 3-kadr (tirqishlarda kuchli nur)
  const k = cast.t / Math.max(0.01, cast.cardTime);
  const i = reduced
    ? 0
    : k > GLINT_FROM && k < GLINT_TO
      ? 2
      : Math.floor(cast.t * CARD_WIND_FPS) % 2;
  const portrait = frames[i] ?? frames[0] ?? null;
  renderSuperCard(c, def, cast, T, portrait, text, reduced, (g, x, y, size, k) =>
    bladeGlint(g, x, y, size, k, T),
  );
}

/** Tig' bo'ylab yuguruvchi oq yaltirash va ko'z tirqishidagi chaqnash (karta ulushi k) */
export function bladeGlint(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  k: number,
  T: SkinTheme,
) {
  const s = size / KNIGHT_PORTRAIT_GRID;
  const gk = (k - GLINT_FROM) / (GLINT_TO - GLINT_FROM);
  if (gk > 0 && gk < 1) {
    const B = CARD_BLADE;
    const by = y + (B.y0 + (B.y1 - B.y0) * gk) * s;
    const bx = x + B.x * s;
    const a = Math.sin(gk * Math.PI);
    px(
      c,
      withAlpha("#ffffff", a),
      Math.round(bx - 2 * s),
      Math.round(by - 3 * s),
      Math.round(4 * s),
      Math.round(6 * s),
    );
    px(
      c,
      withAlpha(T.edge, 0.6 * a),
      Math.round(bx - 3 * s),
      Math.round(by - 6 * s),
      Math.round(6 * s),
      Math.round(2 * s),
    );
    // gardadagi tosh chaqnaydi
    star(c, bx, y + B.gemY * s, 2 + 6 * a, withAlpha("#ffffff", a));
  }
  // ko'z tirqishidagi yorug'lik
  const ek = (k - 0.5) / 0.3;
  if (ek > 0 && ek < 1) {
    const a = Math.sin(ek * Math.PI);
    for (const ex of CARD_BLADE.eyeX)
      star(c, x + ex * s, y + CARD_BLADE.eyeY * s, 2 + 5 * a, withAlpha(T.edge, a));
  }
}
