/**
 * MING KESIM sahnasi (Samuray qiz superi) — faqat chizish; zarar va vaqt super.ts / Game da.
 *
 *  TAYYORLANISH: Samuray ko'zlarini yumadi, qo'li katana dastasida. Dunyo OQ-QORA bo'ladi (canvas
 *    "saturation" aralashmasi), faqat sakura pushti qoladi: Samurayning o'zi va tushayotgan
 *    gulbarglar rangli qayta chiziladi.
 *  ZARBA: Samuray ko'zdan yo'qoladi (pushti chaqnash va gulbarg tutami), ekran bo'ylab o'nlab yorqin
 *    kesik turli burchaklarda chaqnaydi (har birida qisqa oq chaqnash), xona markazi atrofida
 *    gulbarg bo'roni aylanadi. Dushmanlar qotib qoladi — har biri ustida ingichka kesik izi qoladi.
 *  OQIBAT: Samuray xona markazida paydo bo'ladi va katanani SEKIN qinga qaytaradi — "chik" lahzasida
 *    (release) ekran bo'ylab oq yaltirash o'tadi, hamma dushman kesik chizig'i bo'ylab IKKIGA
 *    bo'linadi, yarimlari siljib sakura gulbarglariga aylanib sochiladi; ranglar qaytadi.
 *
 * "Qizil oy" skini (flair "moon"): kesiklar qizil YARIM OY shaklida; boshqa skinlarda — o'z theme
 * ranglarida. Xavf ranglari (danger.ts) ishlatilmaydi. "Effektlarni kamaytirish": oq chaqnashlar
 * yo'q, kesik va gulbarglar kam. Gulbarglar soni chegaralangan. Math.random ishlatilmaydi.
 */
import { px } from "./animation";
import { withAlpha } from "./hero";
import type { SkinTheme } from "./skinFx";
import { SAMURAI_SUPER_FRAME, renderSprite, spriteSize } from "./sprites";
import type { SuperCast, SuperDef, SuperStage } from "./super";
import { SAMURAI_PORTRAIT_EYE, SAMURAI_PORTRAIT_FAR_EYE } from "./samuraiPortrait";
import type { CardText } from "./superFx";
import type { SceneCtx, SceneTarget, SuperScene } from "./superScene";

/** Ekran bo'ylab kesikning yashash vaqti (s) */
export const SLASH_LIFE = 0.2;
/** Kesik paydo bo'lgandagi oq chaqnash (s) */
export const SLASH_FLASH = 0.045;
/** Ikkiga bo'lingan yarimlar siljiydigan vaqt (s), so'ng gulbargga aylanadi */
export const SPLIT_TIME = 0.36;
export const SPLIT_FADE = 0.24;
/** Gulbarglar chegarasi: oddiy / kamaytirilgan */
export const MAX_PETALS = 170;
export const MAX_PETALS_REDUCED = 40;
/** Zarbadagi gulbarg bo'roni */
export const STORM_PETALS = 56;
export const STORM_PETALS_REDUCED = 14;
/** Har bo'lingan dushmandan sochiladigan gulbarglar */
export const PETALS_PER_CORPSE = 14;
export const PETALS_PER_CORPSE_REDUCED = 3;
/** Neytral kulrang: "saturation" aralashmasida rangni olib tashlaydi (rang emas — oq-qora filtr) */
export const GRAY = "#808080";

interface Slash {
  x: number;
  y: number;
  a: number;
  len: number;
  /** Paydo bo'lish vaqti (sahna soati) */
  at: number;
  life: number;
  /** Dushman ustidagi kesik (qalinroq) */
  big: boolean;
}

interface Pending {
  t: SceneTarget;
  a: number;
}

interface Half {
  t: SceneTarget;
  x: number;
  y: number;
  a: number;
  age: number;
  /** Gulbargga aylandi */
  burst: boolean;
}

interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  tone: number;
  spin: number;
  /** Bo'ronda: markaz atrofida aylanadi (burchak, radius, tezlik) */
  orbit: { ang: number; r: number; w: number } | null;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (k: number) => 1 - (1 - clamp01(k)) ** 3;

/** Theme ranglaridan gulbarg rangi: 0 — pushti, 1 — och, 2 — oq */
const petalColor = (T: SkinTheme, tone: number) =>
  tone === 0 ? T.accent : tone === 1 ? T.glow : T.edge;

function petal(c: CanvasRenderingContext2D, x: number, y: number, col: string, spin: number) {
  // aylanayotgan gulbarg: yoni bilan (1x2), yassi (2x1) yoki to'liq (2x2) ko'rinadi
  const ph = ((Math.floor(spin) % 3) + 3) % 3;
  const bx = Math.round(x),
    by = Math.round(y);
  if (ph === 0) px(c, col, bx, by, 2, 2);
  else if (ph === 1) px(c, col, bx, by, 2, 1);
  else px(c, col, bx, by, 1, 2);
}

/** Qizil oy kesigi: yarim oy — tashqi va siljigan ichki yoy orasi (qizil), oq yadro yoyi */
function crescent(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  a: number,
  len: number,
  k: number,
  grow: number,
  T: SkinTheme,
  flash: boolean,
) {
  const R = len * 0.5;
  const span = 1.25 * grow;
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.beginPath();
  c.arc(0, 0, R, -span, span);
  c.arc(-R * 0.22, 0, R * 0.95, span * 0.92, -span * 0.92, true);
  c.closePath();
  c.fillStyle = withAlpha(T.accentDark, 0.9 * k);
  c.fill();
  c.strokeStyle = withAlpha(T.accent, k);
  c.lineWidth = 1;
  c.stroke();
  c.strokeStyle = withAlpha(flash ? "#ffffff" : T.edge, k);
  c.beginPath();
  c.arc(0, 0, R - 1, -span * 0.7, span * 0.7);
  c.stroke();
  c.restore();
}

/** To'g'ri kesik: uchlari ingichka yorqin tig' izi (pushti chekka, oq yadro) */
function straight(
  c: CanvasRenderingContext2D,
  s: Slash,
  k: number,
  grow: number,
  T: SkinTheme,
  flash: boolean,
) {
  const ux = Math.cos(s.a),
    uy = Math.sin(s.a);
  const nx = -uy,
    ny = ux;
  const half = s.len / 2;
  // birinchi lahzada bir uchidan ikkinchisiga "chiziladi"
  const x0 = s.x - ux * half,
    y0 = s.y - uy * half;
  const x1 = x0 + ux * s.len * grow,
    y1 = y0 + uy * s.len * grow;
  const mx = (x0 + x1) / 2,
    my = (y0 + y1) / 2;
  const w = (s.big ? 3.2 : 2.4) * (flash ? 1.8 : 0.6 + 0.4 * k);
  c.fillStyle = withAlpha(flash ? T.glow : T.accent, (flash ? 0.95 : 0.75) * k);
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(mx + nx * w, my + ny * w);
  c.lineTo(x1, y1);
  c.lineTo(mx - nx * w, my - ny * w);
  c.closePath();
  c.fill();
  c.strokeStyle = withAlpha(flash ? "#ffffff" : T.edge, k);
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
}

/** To'rt nurli yulduzcha (kesik chaqnashi, ko'z yaltirashi) */
function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  const bx = Math.round(x),
    by = Math.round(y),
    n = Math.max(1, Math.round(r));
  px(c, col, bx - n, by, n * 2 + 1, 1);
  px(c, col, bx, by - n, 1, n * 2 + 1);
  px(c, col, bx - 1, by - 1, 3, 3);
}

export class CutsScene implements SuperScene {
  /** Sahna soati (haqiqiy vaqt) */
  t = 0;
  /** Oq-qora 0..1 va yengil qorong'ilik */
  gray = 0;
  /** Ekran chaqnashi ("chik"; kamaytirilganda — yo'q) */
  flash = 0;
  /** "Chik" yaltirashi: o'tgan vaqt (−1 — yo'q) */
  glintT = -1;
  /** Paydo bo'lish tutami: o'tgan vaqt (−1 — yo'q) */
  appearT = -1;
  /** Yo'qolish chaqnashi: o'tgan vaqt (−1 — yo'q) */
  vanishT = -1;
  released = false;
  slashes: Slash[] = [];
  pending = new Map<object, Pending>();
  halves: Half[] = [];
  petals: Petal[] = [];
  moon = false;
  private seed = 246813579;
  private at = { x: 160, y: 120, dir: 1 };
  private vanishAt = { x: 160, y: 120 };
  private view = { x: 0, y: 0, w: 320, h: 240 };
  private castOn = false;
  private stormOn = false;
  private reduced = false;
  private releaseAt = 0.45;

  private rnd() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  get alive() {
    return (
      this.castOn ||
      this.gray > 0.02 ||
      this.flash > 0.02 ||
      this.slashes.length > 0 ||
      this.halves.length > 0 ||
      this.petals.length > 0
    );
  }

  /** Samuray zarba paytida ko'rinmaydi */
  hidden(cast: SuperCast) {
    return cast.stage === "strike";
  }

  /** Diqqat (ko'zlar yumuq, shamolda) → qinga SEKIN qaytarish → "chik" → oddiy holat */
  pose(cast: SuperCast) {
    const F = SAMURAI_SUPER_FRAME;
    if (cast.stage === "prep" || cast.stage === "card")
      return cast.t > 0.3 && Math.floor(this.t * 5) % 2 ? F.focusWind : F.focus;
    if (cast.stage === "strike") return F.focus;
    const r = this.releaseAt;
    if (cast.t < r * 0.42) return F.sheatheLong;
    if (cast.t < r * 0.8) return F.sheatheHalf;
    if (cast.t < r) return F.sheatheEnd;
    return cast.t < r + 0.4 ? F.focus : null;
  }

  private addPetal(p: Petal) {
    const cap = this.reduced ? MAX_PETALS_REDUCED : MAX_PETALS;
    if (this.petals.length >= cap) this.petals.shift();
    this.petals.push(p);
  }

  /** Bir nuqtadan gulbarg tutami */
  private puff(x: number, y: number, n: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2;
      const v = speed * (0.4 + this.rnd() * 0.6);
      const life = 0.5 + this.rnd() * 0.6;
      this.addPetal({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 10,
        life,
        max: life,
        tone: Math.floor(this.rnd() * 3),
        spin: this.rnd() * 3,
        orbit: null,
      });
    }
  }

  stage(s: SuperStage, cast: SuperCast, ctx: SceneCtx) {
    this.reduced = ctx.reduced;
    this.moon = ctx.flair === "moon";
    this.releaseAt = cast.def.release ?? this.releaseAt;
    const T = ctx.theme;
    if (s === "prep") {
      this.at = { x: ctx.x, y: ctx.y, dir: ctx.dir };
      this.puff(ctx.x, ctx.y - 4, ctx.reduced ? 2 : 6, 30);
    }
    if (s === "strike") {
      // Samuray ko'zdan yo'qoladi: pushti chaqnash va gulbarg tutami
      this.vanishAt = { x: ctx.x, y: ctx.y };
      this.vanishT = 0;
      this.stormOn = true;
      this.puff(ctx.x, ctx.y - 4, ctx.reduced ? 4 : 16, 90);
      ctx.fx.burst(ctx.x, ctx.y - 4, T.edge, ctx.reduced ? 3 : 8, 120, 1, "star");
      ctx.shake(0.15);
      // ekran bo'ylab kesiklar: zarba bosqichiga teng taqsimlangan, burchaklar turli
      const p = cast.def.params;
      const n = Math.round((ctx.reduced ? p["slashesReduced"] : p["slashes"]) ?? 20);
      const span = Math.max(0.3, cast.strikeTime - SLASH_LIFE - 0.05);
      const V = ctx.view;
      for (let i = 0; i < n; i++) {
        const long = this.rnd() < 0.3;
        this.slashes.push({
          x: V.x + 16 + this.rnd() * (V.w - 32),
          y: V.y + 20 + this.rnd() * (V.h - 40),
          a: (i * 2.39996 + this.rnd() * 0.6) % Math.PI,
          len: long ? 170 + this.rnd() * 150 : 60 + this.rnd() * 90,
          at: this.t + 0.04 + ((i + this.rnd() * 0.8) / n) * span,
          life: SLASH_LIFE,
          big: false,
        });
      }
    }
    if (s === "after") {
      // Samuray xona markazida paydo bo'ladi: gulbarglar uning atrofida chaqnab tarqaladi
      this.at = { x: ctx.x, y: ctx.y, dir: ctx.dir };
      this.appearT = 0;
      this.stormOn = false;
      this.puff(ctx.x, ctx.y - 2, ctx.reduced ? 4 : 14, 70);
      ctx.fx.burst(ctx.x, ctx.y - 2, T.glow, ctx.reduced ? 3 : 8, 60, 1);
    }
  }

  mark(t: SceneTarget, boss: boolean, _cast: SuperCast, ctx: SceneCtx) {
    const live = t.live ?? t;
    const a = -0.9 + this.rnd() * 1.8 + (this.rnd() < 0.3 ? Math.PI / 2 : 0);
    this.pending.set(t.ref ?? t, { t, a });
    const y = live.y - t.size * 0.1;
    const len = t.size * (boss ? 2.2 : 1.7) + 12;
    this.slashes.push({ x: live.x, y, a, len, at: this.t, life: SLASH_LIFE * 1.3, big: true });
    // bossga — xoch (ikki kesik)
    if (boss)
      this.slashes.push({
        x: live.x,
        y,
        a: a + Math.PI / 2,
        len,
        at: this.t + 0.06,
        life: SLASH_LIFE * 1.3,
        big: true,
      });
    ctx.fx.burst(live.x, y, ctx.theme.edge, ctx.reduced ? 2 : 4, 60, 1);
  }

  /** "Chik": katana qinga kirdi — oq yaltirash, chaqnash, ranglar qaytadi */
  release(_cast: SuperCast, ctx: SceneCtx) {
    this.released = true;
    this.glintT = 0;
    if (!ctx.reduced) this.flash = Math.max(this.flash, 0.32);
    ctx.shake(0.35);
    this.puff(ctx.x, ctx.y - 2, ctx.reduced ? 3 : 10, 50);
  }

  hit(t: SceneTarget, boss: boolean, killed: boolean, _cast: SuperCast, ctx: SceneCtx) {
    const live = t.live ?? t;
    const key = t.ref ?? t;
    const a = this.pending.get(key)?.a ?? -0.5 + this.rnd();
    this.pending.delete(key);
    const T = ctx.theme;
    if (boss) {
      // bossga — katta xoch kesik
      for (const d of [0, Math.PI / 2])
        this.slashes.push({
          x: live.x,
          y: live.y,
          a: a + d,
          len: t.size * 2.4 + 20,
          at: this.t,
          life: SLASH_LIFE * 1.6,
          big: true,
        });
      ctx.fx.burst(live.x, live.y, T.glow, ctx.reduced ? 6 : 18, 130, 2);
      this.puff(live.x, live.y, ctx.reduced ? 4 : 16, 90);
      ctx.shake(0.5);
      return false;
    }
    if (!killed || !t.sprite) {
      this.puff(live.x, live.y, ctx.reduced ? 2 : 6, 60);
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
    this.view = ctx.view;
    if (cast) this.at = { x: ctx.x, y: ctx.y, dir: ctx.dir };
    const st = cast?.stage;
    // oq-qora: tayyorlanishdan "chik" gacha; keyin ranglar tez qaytadi
    const want = cast && st !== "card" && !(st === "after" && this.released) ? 1 : 0;
    this.gray += (want - this.gray) * Math.min(1, dt * (want ? 7 : 5));
    if (this.gray < 0.005) this.gray = 0;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.8);
    if (this.glintT >= 0) this.glintT += dt;
    if (this.appearT >= 0) this.appearT += dt;
    if (this.vanishT >= 0) this.vanishT += dt;
    if (this.glintT > 0.4) this.glintT = -1;
    if (this.appearT > 0.4) this.appearT = -1;
    if (this.vanishT > 0.3) this.vanishT = -1;

    for (const s of this.slashes) if (this.t >= s.at) s.life -= dt;
    this.slashes = this.slashes.filter((s) => s.life > 0);

    const V = ctx.view;
    const cx = V.x + V.w / 2,
      cy = V.y + V.h / 2;
    // tayyorlanishda: tepadan sekin tushayotgan bir nechta gulbarg (oq-qora dunyoda pushti)
    if (st === "prep") {
      const want = ctx.reduced ? 4 : 14;
      let falling = 0;
      for (const p of this.petals) if (!p.orbit) falling++;
      if (falling < want && this.rnd() < dt * 30) {
        const life = 1.6 + this.rnd();
        this.addPetal({
          x: V.x + this.rnd() * V.w,
          y: V.y - 2,
          vx: 14 + this.rnd() * 12,
          vy: 22 + this.rnd() * 18,
          life,
          max: life,
          tone: this.rnd() < 0.7 ? 0 : 1,
          spin: this.rnd() * 3,
          orbit: null,
        });
      }
    }
    // zarbada: markaz atrofida gulbarg bo'roni
    if (this.stormOn) {
      const want = ctx.reduced ? STORM_PETALS_REDUCED : STORM_PETALS;
      let n = 0;
      for (const p of this.petals) if (p.orbit) n++;
      for (; n < want; n++) {
        const life = 0.9 + this.rnd() * 0.6;
        this.addPetal({
          x: cx,
          y: cy,
          vx: 0,
          vy: 0,
          life,
          max: life,
          tone: Math.floor(this.rnd() * 3),
          spin: this.rnd() * 3,
          orbit: { ang: this.rnd() * Math.PI * 2, r: 20 + this.rnd() * 120, w: 3 + this.rnd() * 3 },
        });
      }
    }
    for (const p of this.petals) {
      p.spin += dt * 9;
      if (p.orbit) {
        const o = p.orbit;
        if (!this.stormOn) {
          // bo'ron tugadi: gulbarg aylanish yo'nalishida uchib ketadi
          p.vx = -Math.sin(o.ang) * o.r * o.w * 0.5;
          p.vy = Math.cos(o.ang) * o.r * o.w * 0.3;
          p.orbit = null;
          continue;
        }
        o.ang += o.w * dt;
        o.r += Math.sin(this.t * 3 + o.ang) * 20 * dt;
        p.x = cx + Math.cos(o.ang) * o.r;
        p.y = cy + Math.sin(o.ang) * o.r * 0.6;
      } else {
        p.x += p.vx * dt + Math.sin(this.t * 6 + p.max * 9) * 6 * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - Math.min(1, dt * 1.5);
        p.vy += (18 - p.vy) * Math.min(1, dt * 2);
      }
      p.life -= dt;
    }
    this.petals = this.petals.filter((p) => p.life > 0);

    // ikkiga bo'lingan jasadlar: siljiydi, so'ng gulbarg bo'lib sochiladi
    const per = ctx.reduced ? PETALS_PER_CORPSE_REDUCED : PETALS_PER_CORPSE;
    for (const h of this.halves) {
      h.age += dt;
      if (!h.burst && h.age >= SPLIT_TIME) {
        h.burst = true;
        const r = Math.max(5, h.t.size * 0.6);
        for (let i = 0; i < per; i++) {
          const life = 0.6 + this.rnd() * 0.7;
          this.addPetal({
            x: h.x + (this.rnd() - 0.5) * r * 2,
            y: h.y + (this.rnd() - 0.5) * r * 2,
            vx: (this.rnd() - 0.5) * 70,
            vy: -(20 + this.rnd() * 50),
            life,
            max: life,
            tone: Math.floor(this.rnd() * 3),
            spin: this.rnd() * 3,
            orbit: null,
          });
        }
      }
    }
    this.halves = this.halves.filter((h) => h.age < SPLIT_TIME + SPLIT_FADE);
    if (!cast) {
      this.pending.clear();
      this.stormOn = false;
    }
    if (!cast && !this.alive) this.released = false;
  }

  // ---------------- chizish ----------------

  renderGround(c: CanvasRenderingContext2D, cast: SuperCast | null, ctx: SceneCtx) {
    // Samuray turgan joyda ingichka pushti doira (zarbada — yo'q)
    if (!cast || cast.stage === "strike" || cast.stage === "card") return;
    const T = ctx.theme;
    const { x, y } = this.at;
    const k = cast.stage === "prep" ? easeOut(cast.t / 0.5) : 1 - clamp01(cast.t / 0.9);
    if (k <= 0.02) return;
    c.save();
    c.strokeStyle = withAlpha(T.accent, 0.7 * k);
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(x, y + 12, 18 * k + 4, (18 * k + 4) * 0.4, 0, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  renderAir(c: CanvasRenderingContext2D, cast: SuperCast | null, ctx: SceneCtx) {
    const T = ctx.theme;
    const V = ctx.view;
    // 1) oq-qora dunyo: rang olib tashlanadi, biroz qorong'ilashadi
    if (this.gray > 0.01) {
      c.save();
      c.globalCompositeOperation = "saturation";
      c.globalAlpha = this.gray;
      c.fillStyle = GRAY;
      c.fillRect(V.x, V.y, V.w, V.h);
      c.restore();
      const dim = cast?.stage === "strike" ? 0.45 : 0.3;
      c.fillStyle = `rgba(6,4,12,${dim * this.gray})`;
      c.fillRect(V.x, V.y, V.w, V.h);
      // faqat sakura pushti qoladi: Samuray rangli qayta chiziladi
      if (cast && !this.hidden(cast) && ctx.drawOwner) ctx.drawOwner(c);
    }
    // 2) qotib qolgan dushmanlardagi kesik izi ("chik" ni kutadi)
    const pulse = 0.65 + 0.35 * Math.sin(this.t * 20);
    for (const p of this.pending.values()) {
      const live = p.t.live ?? p.t;
      const half = p.t.size * 0.75 + 3;
      const ux = Math.cos(p.a) * half,
        uy = Math.sin(p.a) * half;
      const y = live.y - p.t.size * 0.1;
      c.strokeStyle = withAlpha(this.moon ? T.accentDark : T.accent, 0.8);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(live.x - ux, y - uy);
      c.lineTo(live.x + ux, y + uy);
      c.stroke();
      c.strokeStyle = withAlpha(T.edge, pulse);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(live.x - ux, y - uy);
      c.lineTo(live.x + ux, y + uy);
      c.stroke();
    }
    // 3) ikkiga bo'lingan dushmanlar
    for (const h of this.halves) this.renderHalves(c, h, T);
    // 4) yo'qolish va paydo bo'lish: pushti halqa
    if (this.vanishT >= 0) this.renderBurst(c, this.vanishAt, this.vanishT / 0.3, T);
    if (this.appearT >= 0) this.renderBurst(c, this.at, this.appearT / 0.4, T);
    // 5) kesiklar
    for (const s of this.slashes) {
      if (this.t < s.at) continue;
      const age = s.life <= 0 ? 1 : 1 - s.life / (s.big ? SLASH_LIFE * 1.3 : SLASH_LIFE);
      const grow = clamp01(age / 0.25);
      const k = clamp01((1 - age) * 1.6);
      const flash = !ctx.reduced && this.t - s.at < SLASH_FLASH;
      if (this.moon) crescent(c, s.x, s.y, s.a, s.len * (s.big ? 0.9 : 0.55), k, grow, T, flash);
      else straight(c, s, k, grow, T, flash);
      if (flash) star(c, s.x, s.y, s.big ? 5 : 3, "#ffffff");
    }
    // 6) gulbarglar (har doim rangli)
    for (const p of this.petals) {
      const a = Math.min(1, (p.life / p.max) * 2);
      petal(c, p.x, p.y, withAlpha(petalColor(T, p.tone), a), p.spin);
    }
    // 7) "chik" yaltirashi: katana balandligida ekran bo'ylab ingichka oq chiziq
    if (this.glintT >= 0) {
      const k = clamp01(this.glintT / 0.4);
      const w = Math.round(V.w * (1 - k));
      const y = Math.round(this.at.y - 1);
      px(c, withAlpha(T.edge, 1 - k), Math.round(this.at.x - w / 2), y, w, 1);
      px(
        c,
        withAlpha(T.accent, 0.6 * (1 - k)),
        Math.round(this.at.x - w / 3),
        y + 1,
        Math.round((w * 2) / 3),
        1,
      );
      star(c, this.at.x + this.at.dir * 3, y, 2 + 6 * (1 - k), withAlpha("#ffffff", 1 - k));
    }
    // 8) ekran chaqnashi
    if (this.flash > 0.01) {
      c.fillStyle = withAlpha(T.glow, Math.min(0.45, this.flash));
      c.fillRect(V.x, V.y, V.w, V.h);
    }
  }

  private renderBurst(
    c: CanvasRenderingContext2D,
    at: { x: number; y: number },
    k: number,
    T: SkinTheme,
  ) {
    if (k >= 1) return;
    const r = 4 + easeOut(k) * 22;
    c.strokeStyle = withAlpha(T.accent, 1 - k);
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(at.x, at.y, r, r * 0.8, 0, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = withAlpha(T.edge, 1 - k);
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(at.x, at.y, r * 0.6, r * 0.5, 0, 0, Math.PI * 2);
    c.stroke();
  }

  /** Kesik chizig'i bo'ylab ikkiga bo'lingan sprite: yarimlari qarama-qarshi siljib, tushib so'nadi */
  private renderHalves(c: CanvasRenderingContext2D, h: Half, T: SkinTheme) {
    const sprite = h.t.sprite;
    if (!sprite) return;
    const size = spriteSize(sprite);
    const ux = Math.cos(h.a),
      uy = Math.sin(h.a);
    const nx = -uy,
      ny = ux;
    const sep = easeOut(h.age / SPLIT_TIME) * 7;
    const fade = h.age > SPLIT_TIME ? clamp01(1 - (h.age - SPLIT_TIME) / SPLIT_FADE) : 1;
    const L = size + 8;
    for (const side of [-1, 1]) {
      c.save();
      c.globalAlpha = fade;
      c.translate(
        Math.round(h.x + nx * side * sep + ux * side * h.age * 14),
        Math.round(h.y + ny * side * sep + h.age * h.age * 40),
      );
      c.beginPath();
      c.moveTo(-ux * L, -uy * L);
      c.lineTo(ux * L, uy * L);
      c.lineTo(ux * L + nx * side * L, uy * L + ny * side * L);
      c.lineTo(-ux * L + nx * side * L, -uy * L + ny * side * L);
      c.closePath();
      c.clip();
      renderSprite(c, sprite, "idle", 0, 0, 0, h.age < 0.06, !!h.t.flip, false, h.t.palette);
      c.restore();
    }
    // bo'linish lahzasida kesik chizig'i yorqin
    if (h.age < 0.14) {
      const k = 1 - h.age / 0.14;
      c.strokeStyle = withAlpha(T.edge, k);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(h.x - ux * L * 0.7, h.y - uy * L * 0.7);
      c.lineTo(h.x + ux * L * 0.7, h.y + uy * L * 0.7);
      c.stroke();
    }
  }
}

/**
 * GULBARG PARDASI (karta): superdan keyingi daxlsizlik — Samuray atrofida aylanuvchi gulbarglar va
 * mayin pushti parda. Oxirgi 0.5 s da miltillab so'nadi (kamaytirilganda — miltillamaydi).
 */
export function renderPetalVeil(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  left: number,
  T: SkinTheme,
  reduced = false,
) {
  const blink = !reduced && left < 0.5 && Math.floor(time * 12) % 2 === 0;
  const a = (blink ? 0.4 : 1) * Math.min(1, left * 3);
  c.save();
  c.fillStyle = withAlpha(T.accent, 0.12 * a);
  c.beginPath();
  c.ellipse(x, y - 1, 15, 17, 0, 0, Math.PI * 2);
  c.fill();
  const n = reduced ? 4 : 8;
  for (let i = 0; i < n; i++) {
    const ang = time * 2.6 + (i * Math.PI * 2) / n;
    const px0 = x + Math.cos(ang) * 14,
      py0 = y - 1 + Math.sin(ang) * 9 + Math.sin(time * 4 + i) * 2;
    petal(c, px0, py0, withAlpha(petalColor(T, i % 3), a), time * 8 + i);
  }
  c.restore();
}

// ---------------- anime cut-in karta ----------------

const W = 320,
  H = 240;
/** Ko'zlar keskin ochiladigan lahza (karta ulushi) */
export const CARD_SNAP = 0.42;
/** Portret kattalashtirish va undagi ko'z markazi (samuraiPortrait.ts, 96x96 to'r) */
export const CARD_SCALE = 2;
export const CARD_EYE = SAMURAI_PORTRAIT_EYE;
/** Ko'z ochilgandan keyin chaqnash kadriga o'tish (s) */
export const CARD_FLASH = 0.12;
/** Ko'z markazi tasma o'rtasidan shuncha yuqorida — iyak tasma ichida, boshi tepadan chiqib turadi */
const CARD_EYE_LIFT = 10;

/**
 * ANIME CUT-IN (faqat Samuray superida — SuperDef.card.anime): ekran qorayadi, diagonal kadr
 * chapdan "kesib" ochiladi, ichida Samurayning yaqin plandagi portreti (2x), ko'zdan tarqaluvchi
 * tezlik chiziqlari, shamolda hilpiragan soch tutamlari va uchayotgan gulbarglar. Portret tasmaning
 * pastki chetida kesiladi, tepada esa kadrdan "chiqib turadi" — boshi to'liq ko'rinadi. frames —
 * portret kadrlari (SAMURAI_PORTRAIT_VARIANTS): CARD_SNAP gacha ko'zlar yumuq, so'ng keskin
 * ochiladi (yaltirash, "zarb" kattalashishi, qisqa chaqnash), CARD_FLASH dan keyin ko'zlarda
 * chaqnash va gulbarglar; so'ng "MING KESIM" yozuvi o'ngdan kirib keladi. "Effektlarni kamaytirish": chaqnash, silkinish va chiziqlar
 * miltillashi yo'q.
 */
export function renderAnimeCard(
  c: CanvasRenderingContext2D,
  def: SuperDef,
  cast: Pick<SuperCast, "t" | "cardTime">,
  T: SkinTheme,
  frames: readonly (HTMLCanvasElement | null)[],
  hair: string,
  text: CardText,
  reduced = false,
) {
  const d = Math.max(0.01, cast.cardTime);
  const k = clamp01(cast.t / d);
  const inK = easeOut(k / 0.2);
  const out = k > 0.88 ? (k - 0.88) / 0.12 : 0;
  const a = Math.min(1, k / 0.08) * (1 - out);
  const snapped = k >= CARD_SNAP;
  const sk = snapped ? (k - CARD_SNAP) * d : -1;
  const punch = snapped ? Math.max(0, 1 - sk / 0.09) : 0;
  const shake = !reduced && punch > 0 ? Math.round(Math.sin(cast.t * 95) * 2 * punch) : 0;
  const slope = -0.22;
  const hh = 40 * Math.min(1, inK * 1.25);
  const yAt = (x: number) => 112 + (x - 150) * slope + shake;
  const wipe = -10 + (W + 20) * inK;
  const ox = out * 50;

  c.save();
  px(c, `rgba(4,2,10,${0.82 * a})`, 0, 0, W, H);
  c.globalAlpha = a;
  // ikkinchi ingichka tasma (anime kadrining qo'sh chizig'i)
  c.fillStyle = withAlpha(T.accent, 0.7);
  c.beginPath();
  c.moveTo(-10 + ox, yAt(-10) + hh + 7);
  c.lineTo(wipe + ox, yAt(wipe) + hh + 7);
  c.lineTo(wipe + ox, yAt(wipe) + hh + 10);
  c.lineTo(-10 + ox, yAt(-10) + hh + 10);
  c.closePath();
  c.fill();

  const band = () => {
    c.beginPath();
    c.moveTo(-10 + ox, yAt(-10) - hh);
    c.lineTo(wipe + ox, yAt(wipe) - hh);
    c.lineTo(wipe + ox, yAt(wipe) + hh);
    c.lineTo(-10 + ox, yAt(-10) + hh);
    c.closePath();
  };
  c.save();
  band();
  c.clip();
  const g = c.createLinearGradient(0, yAt(0) - hh, 0, yAt(0) + hh + 60);
  g.addColorStop(0, withAlpha(T.accentDark, 0.95));
  g.addColorStop(1, withAlpha(T.ink, 0.97));
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  // ko'z markazi (ekranda): sekin "kamera surilishi"
  const S = CARD_SCALE * (1 + 0.07 * punch);
  const fx = 104 + inK * 8 + k * 10 + ox,
    fy = yAt(fx) - CARD_EYE_LIFT;
  // tezlik chiziqlari: ko'zdan tarqaladi; ochilganda yorqinroq
  const lines = reduced ? 10 : 26;
  const frameSeed = reduced ? 0 : Math.floor(cast.t * 24) * 131;
  for (let i = 0; i < lines; i++) {
    const h1 = ((i * 97 + frameSeed) * 2654435761) >>> 0;
    const ang = (i / lines) * Math.PI * 2 + ((h1 % 100) / 100) * 0.2;
    const r0 = 52 + (h1 % 37);
    const r1 = 340;
    const w = 1 + ((h1 >> 8) % 4);
    const cs = Math.cos(ang),
      sn = Math.sin(ang);
    c.fillStyle = withAlpha(punch > 0.3 ? T.edge : i % 3 ? T.accent : T.glow, 0.26 + 0.3 * punch);
    c.beginPath();
    c.moveTo(fx + cs * r0, fy + sn * r0);
    c.lineTo(fx + cs * r1 - sn * w, fy + sn * r1 + cs * w);
    c.lineTo(fx + cs * r1 + sn * w, fy + sn * r1 - cs * w);
    c.closePath();
    c.fill();
  }

  // shamolda hilpiragan soch tutamlari (portret ortida, chapga oqadi)
  const frame = !snapped ? 0 : sk < CARD_FLASH ? 1 : 2;
  const img = frames[frame] ?? frames[0] ?? null;
  const x0 = fx - CARD_EYE[0] * S,
    y0 = fy - CARD_EYE[1] * S;
  const wt = reduced ? 0 : cast.t;
  for (let j = 0; j < 6; j++) {
    for (let i = 0; i < 26; i++) {
      // ortga (chapga) oqadi va yelpig'ichdek yoyiladi; uchiga qarab to'lqin kuchayadi
      const sx = x0 + 24 * S - i * 6 - j * 3;
      const sy =
        y0 +
        (36 + j * 7.5) * S +
        Math.sin(wt * 15 + j * 1.3 + i * 0.45) * (1 + i * 0.5) +
        i * (j - 2.5) * 0.45;
      const h = i > 18 ? 3 : 5;
      px(c, hair, Math.round(sx), Math.round(sy), 7, h);
      // pushti chekka — qorong'i fonda ham ko'rinsin
      px(c, withAlpha(T.accent, 0.85), Math.round(sx), Math.round(sy) - 1, 7, 1);
    }
  }
  // kadr bo'ylab uchayotgan gulbarglar
  const n = reduced ? 4 : 12;
  for (let i = 0; i < n; i++) {
    const x = ((i * 53 + cast.t * (230 + (i % 5) * 40)) % (W + 20)) - 10 + ox;
    const y = yAt(x) + (((i * 29) % 70) - 35) * (hh / 40) + Math.sin(cast.t * 9 + i) * 3;
    px(c, i % 3 ? T.accent : T.glow, Math.round(x), Math.round(y), 3, 2);
    px(c, T.edge, Math.round(x) + 1, Math.round(y), 1, 1);
  }
  c.restore();

  // kadr chetlari: oq chiziq va pushti ichki chiziq; ochilish chetida oq "kesik"
  for (const side of [-1, 1])
    for (let x = -10; x < wipe; x += 2) {
      const y = Math.round(yAt(x) + side * hh);
      px(c, "#ffffff", Math.round(x + ox), y - (side < 0 ? 2 : 0), 2, 2);
      px(c, T.accent, Math.round(x + ox), y + (side < 0 ? 0 : -1), 2, 1);
    }
  if (k < 0.22) {
    const ex = Math.round(wipe + ox);
    px(c, "#ffffff", ex - 1, Math.round(yAt(wipe) - hh - 4), 2, Math.round(hh * 2 + 8));
  }

  // portret: tasma pastki chetida kesiladi, tepada kadr chizig'i ustidan chiqib turadi (boshi to'liq)
  if (img) {
    const size = Math.round(img.width * S);
    c.save();
    c.beginPath();
    c.moveTo(-10 + ox, 0);
    c.lineTo(wipe + ox, 0);
    c.lineTo(wipe + ox, yAt(wipe) + hh);
    c.lineTo(-10 + ox, yAt(-10) + hh);
    c.closePath();
    c.clip();
    c.imageSmoothingEnabled = false;
    c.drawImage(img, Math.round(x0), Math.round(y0), size, size);
    c.restore();
  }
  // ko'z yaltirashi: ochilgan lahzada
  if (snapped) {
    const gl = Math.sin(clamp01(sk / 0.16) * Math.PI);
    const [ex, ey] = CARD_EYE;
    const [fx2] = SAMURAI_PORTRAIT_FAR_EYE;
    if (gl > 0.01) {
      star(c, x0 + (ex - 1.5) * S, y0 + (ey - 1.5) * S, 3 + gl * 12, withAlpha("#ffffff", gl));
      star(c, x0 + (fx2 - 0.5) * S, y0 + (ey - 1.5) * S, 2 + gl * 6, withAlpha(T.edge, gl));
    }
  }

  // super nomi: ko'z ochilgach o'ngdan keladi, orqasida qiya pushti tasma
  if (snapped) {
    const tk = easeOut((k - CARD_SNAP) / 0.16);
    const nx = 232 + (1 - tk) * 130 + out * 40;
    const ny = Math.round(yAt(nx) + hh + 30);
    c.fillStyle = withAlpha(T.accentDark, 0.92);
    c.beginPath();
    c.moveTo(nx - 92, ny - 15);
    c.lineTo(nx + 96, ny - 15 - 8);
    c.lineTo(nx + 92, ny + 5 - 8);
    c.lineTo(nx - 96, ny + 5);
    c.closePath();
    c.fill();
    px(c, T.accent, Math.round(nx - 96), ny + 6, 192, 1);
    text(def.name, nx + 2, ny + 2, 16, T.ink);
    text(def.name, nx, ny, 16, T.glow);
    text(def.card.sub, nx + 30, ny + 16, 6, T.accent);
    // yozuv ustidan o'tgan kesik: tushgan lahzada oq qiya chiziq
    if (tk < 1 && !reduced) {
      c.strokeStyle = withAlpha("#ffffff", 1 - tk);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(nx - 100, ny - 2);
      c.lineTo(nx + 100, ny - 14);
      c.stroke();
    }
  }
  c.globalAlpha = 1;
  // kirish va ko'z ochilish chaqnashlari (kamaytirilganda — yo'q)
  if (!reduced && k < 0.08) px(c, `rgba(255,255,255,${0.5 * (1 - k / 0.08)})`, 0, 0, W, H);
  if (!reduced && punch > 0) px(c, `rgba(255,255,255,${0.35 * punch * punch})`, 0, 0, W, H);
  c.restore();
}
