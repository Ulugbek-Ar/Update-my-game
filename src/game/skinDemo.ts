/**
 * Do'kon SKINLAR bo'limidagi jonli preview: tanlangan skin bilan qahramon o'zi hujum, kuchli hujum
 * va dashni ko'rsatib turadi — o'yindagi aynan o'sha skin effektlari (theme, zarrachalar, iz, zarba
 * shakli, afsonaviy animatsiya) bilan. Faqat ko'rinish: o'yin mantig'i va Player ishlatilmaydi.
 *
 * Kichik mantiqiy sahna (DEMO_W x DEMO_H) kanvasga butun son masshtabda chiziladi.
 */
import { px } from "./animation";
import { Effects } from "./effects";
import { chargeRingColor, withAlpha, type Hero } from "./hero";
import { renderQuake } from "./paladinFx";
import { heroBurst, heroImpact, heroTrail, renderFlair, type SkinLook } from "./skinFx";
import { SAMURAI_FRAME, renderSprite, type SpritePalette } from "./sprites";
import type { AnimState } from "./animation";
import { IAI_DELAY, KATANA_REACH, KATANA_TIME } from "./player";
import {
  CUT_LIFE,
  STREAK_LIFE,
  renderCut,
  renderKatanaArc,
  renderMark,
  renderStreak,
  type Cut,
  type Streak,
} from "./samuraiFx";

export const DEMO_W = 128;
export const DEMO_H = 64;
/** Bir aylana (s): turish → hujum → kuchli hujum → dash → turish */
export const DEMO_LOOP = 3.6;

export type DemoPhase = "idle" | "attack" | "charge" | "strong" | "dash";

/** Aylanadagi vaqtga ko'ra bosqich */
export function demoPhase(t: number): DemoPhase {
  const k = t % DEMO_LOOP;
  return k < 0.5
    ? "idle"
    : k < 1.0
      ? "attack"
      : k < 1.6
        ? "charge"
        : k < 2.0
          ? "strong"
          : k < 2.6
            ? "dash"
            : "idle";
}

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  strong: boolean;
  life: number;
}

const FLOOR_Y = 40,
  TARGET_X = 104;
/**
 * Samuray namoyishi (o'yindagi kadrlar bilan): uch zarbali katana kombosi -> orqaga qadam va IAI
 * zaryadi -> nishonni kesib o'tish (siluetlar, iz, belgi, 0.25 s dan keyin kesik; "Qizil oy"da qinga
 * qaytarish kadri) -> dash bilan joyiga qaytish.
 */
export const SAM_DEMO = {
  home: 84,
  back: 54,
  end: 118,
  /** zarbalar: 0.5..1.0 da uchta */
  slash: 0.5 / 3,
  /** orqaga qadam 1.0..1.15, zaryad 1.15..1.6 */
  step: 1.15,
  iai: 1.6,
  slide: 0.12,
  /** dash 2.0..2.2 */
  dash: 0.2,
} as const;

export interface SamuraiPose {
  x: number;
  state: AnimState;
  frame: number;
  flip: boolean;
  /** IAI sirpanishi (orqada siluetlar) */
  iai: boolean;
}

/** Aylanadagi vaqt k bo'yicha Samurayning joyi va kadri. sheathe — "Qizil oy" (qinga qaytarish). */
export function samuraiPose(k: number, sheathe: boolean): SamuraiPose {
  const F = SAMURAI_FRAME,
    S = SAM_DEMO;
  const stand = (x: number, flip = false): SamuraiPose => ({
    x,
    state: "idle",
    frame: Math.floor(k * 4) % 4,
    flip,
    iai: false,
  });
  if (k < 0.5) return stand(S.home);
  if (k < 1.0) {
    const s = Math.min(2, Math.floor((k - 0.5) / S.slash));
    const q = (k - 0.5 - s * S.slash) / S.slash;
    const frame = (s === 2 ? F.wide : 0) + Math.min(2, Math.floor(q * 3));
    return { x: S.home, state: "attack", frame, flip: false, iai: false };
  }
  if (k < S.step) {
    const q = (k - 1.0) / (S.step - 1.0);
    return {
      x: S.home + (S.back - S.home) * q,
      state: "walk",
      frame: Math.floor(q * 6) % 6,
      flip: false,
      iai: false,
    };
  }
  if (k < S.iai) return { x: S.back, state: "attack", frame: F.charge, flip: false, iai: false };
  const te = S.iai + S.slide;
  if (k < te) {
    const q = (k - S.iai) / S.slide;
    return {
      x: S.back + (S.end - S.back) * q,
      state: "attack",
      frame: F.iai,
      flip: false,
      iai: true,
    };
  }
  if (k < 2.0) {
    const frame = sheathe && k >= te + 0.12 ? F.sheathe : F.iai;
    return { x: S.end, state: "attack", frame, flip: false, iai: false };
  }
  if (k < 2.0 + S.dash) {
    const q = (k - 2.0) / S.dash;
    return {
      x: S.end + (S.home - S.end) * q,
      state: "attack",
      frame: F.dash,
      flip: true,
      iai: false,
    };
  }
  return stand(S.home);
}

/** Yaqin jangchilar nishon yonida turadi va dashda orqaga sirpanadi; uzoqdan otuvchilar — chapda */
const melee = (h: Hero) => h === "knight" || h === "paladin" || h === "samurai";
const homeOf = (h: Hero) => (h === "samurai" ? SAM_DEMO.home : melee(h) ? 80 : 30);

export class SkinDemo {
  fx = new Effects();
  t = 0;
  x: number;
  private home: number;
  private shots: Shot[] = [];
  private prev: DemoPhase = "idle";
  private ring = 0;
  /** Samuray: oldingi kadrdagi aylana vaqti, iz va kesiklar */
  private lastK = 0;
  private streaks: Streak[] = [];
  private cuts: Cut[] = [];

  constructor(
    public hero: Hero,
    public look: SkinLook,
    public palette: SpritePalette | undefined,
  ) {
    this.home = this.x = homeOf(hero);
  }

  update(dt: number) {
    this.t += dt;
    if (this.hero === "samurai") return this.updateSamurai(dt);
    const ph = demoPhase(this.t);
    if (ph !== this.prev) this.enter(ph);
    this.prev = ph;
    const T = this.look.theme;
    const k = this.t % DEMO_LOOP;
    if (ph === "dash") {
      // oldinga sirpanib, yarmida qaytadi
      const d = (k - 2.0) / 0.6;
      const nx = this.home + Math.sin(d * Math.PI) * 44 * (melee(this.hero) ? -1 : 1);
      if (this.hero === "mage") {
        if (d > 0.45 && this.x === this.home) {
          // teleport: ikki joyda tutun va uchqun
          heroBurst(this.fx, this.look, this.home, FLOOR_Y, T.shade, 14, 30, 3);
          heroBurst(this.fx, this.look, this.home, FLOOR_Y, T.spark, 6, 70, 1);
          this.x = this.home + 40;
          heroBurst(this.fx, this.look, this.x, FLOOR_Y, T.hot, 10, 60, 1);
        }
      } else {
        this.x = nx;
        heroTrail(this.fx, this.look, this.x, FLOOR_Y + 2, T.trail);
      }
    } else if (this.x !== this.home && ph === "idle") {
      if (this.hero === "mage") {
        heroBurst(this.fx, this.look, this.x, FLOOR_Y, T.mist, 8, 25, 3);
        heroBurst(this.fx, this.look, this.home, FLOOR_Y, T.hot, 10, 60, 1);
      }
      this.x = this.home;
    }
    if (this.ring > 0) this.ring = Math.max(0, this.ring - dt);
    this.shots = this.shots.filter((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (Math.random() < 0.6) {
        const col =
          this.hero === "mage"
            ? withAlpha(T.shade, 0.75)
            : this.hero === "hunter"
              ? withAlpha(T.accent, 0.7)
              : withAlpha(T.glow, 0.55);
        if (this.hero !== "hunter" || s.strong) heroTrail(this.fx, this.look, s.x, s.y, col);
      }
      if (s.x >= TARGET_X) {
        this.hit(s.x, s.y);
        return false;
      }
      return s.life > 0;
    });
    this.fx.update(dt);
  }

  /** Samuray: zarbalar, IAI izi va kechikkan kesik — aylanadagi lahzalarda */
  private updateSamurai(dt: number) {
    const T = this.look.theme,
      S = SAM_DEMO;
    const k = this.t % DEMO_LOOP;
    const prev = k < this.lastK ? -1 : this.lastK;
    this.lastK = k;
    const at = (t: number) => prev < t && k >= t;
    const pose = samuraiPose(k, this.look.fx.flair === "moon");
    this.x = pose.x;
    const y = FLOOR_Y - 2;
    // katana kombosi: har zarba boshida nishonga tegadi
    for (let s = 0; s < 3; s++) if (at(0.5 + s * S.slash)) this.hit(TARGET_X, y);
    if (at(S.iai)) heroBurst(this.fx, this.look, S.back, FLOOR_Y + 2, T.spark, 8, 60, 1);
    if (pose.iai) heroTrail(this.fx, this.look, this.x, FLOOR_Y + 2, T.trail);
    const te = S.iai + S.slide;
    if (at(te)) {
      this.streaks.push({ x1: S.back, y1: FLOOR_Y, x2: S.end, y2: FLOOR_Y, life: STREAK_LIFE });
      for (let i = 0; i < 5; i++)
        heroBurst(
          this.fx,
          this.look,
          S.back + ((S.end - S.back) * (i + 0.5)) / 5,
          FLOOR_Y,
          i % 2 ? T.accent : T.glow,
          1,
          40,
          2,
        );
    }
    // 0.25 s dan keyin — kesik ("chiq")
    if (at(te + IAI_DELAY)) {
      this.cuts.push({
        x: TARGET_X + 4,
        y: FLOOR_Y - 5,
        a: 0.9,
        len: 13,
        life: CUT_LIFE,
        shards: this.look.fx.particle === "shard",
      });
      heroBurst(this.fx, this.look, TARGET_X + 4, y, T.accent, 6, 80, 1);
      this.hit(TARGET_X + 4, y);
    }
    if (k >= 2.0 && k < 2.0 + S.dash) heroTrail(this.fx, this.look, this.x, FLOOR_Y + 2, T.trail);
    for (const s of this.streaks) s.life -= dt;
    this.streaks = this.streaks.filter((s) => s.life > 0);
    for (const c of this.cuts) c.life -= dt;
    this.cuts = this.cuts.filter((c) => c.life > 0);
    this.fx.update(dt);
  }

  /** Bosqich boshlanishi: snaryad, zarba va portlashlar */
  private enter(ph: DemoPhase) {
    const T = this.look.theme;
    const y = FLOOR_Y - 2;
    const ranged = this.hero === "mage" || this.hero === "hunter" || this.hero === "gunner";
    if (ph === "attack") {
      if (ranged) {
        this.shots.push({ x: this.x + 10, y, vx: 150, vy: 0, strong: false, life: 1 });
        if (this.hero === "gunner") this.muzzle(this.x + 10, y);
      } else this.hit(this.x + (this.hero === "paladin" ? 22 : 18), y);
    } else if (ph === "strong") {
      this.ring = 0.3;
      if (this.hero === "gunner") {
        for (const vy of [-40, 0, 40])
          this.shots.push({ x: this.x + 10, y, vx: 160, vy, strong: true, life: 1 });
        this.muzzle(this.x + 10, y);
      } else if (this.hero === "hunter")
        this.shots.push({ x: this.x + 10, y, vx: 190, vy: 0, strong: true, life: 1 });
      else if (this.hero === "mage") this.hit(this.x + 26, y);
      else {
        heroBurst(this.fx, this.look, this.x, FLOOR_Y, T.glow, 18, 110, 2);
        heroBurst(this.fx, this.look, this.x, FLOOR_Y, T.accent, 10, 80, 2);
        this.hit(TARGET_X, y);
      }
    }
  }

  private muzzle(x: number, y: number) {
    const T = this.look.theme;
    heroBurst(this.fx, this.look, x, y, T.glow, 4, 80, 1);
    heroBurst(this.fx, this.look, x, y, T.accent, 2, 50, 1);
    heroBurst(this.fx, this.look, x, y - 2, T.hot, 3, 16, 2);
  }

  hit(x: number, y: number) {
    const T = this.look.theme;
    const col =
      this.hero === "mage"
        ? T.hot
        : this.hero === "hunter"
          ? T.spark
          : this.hero === "gunner"
            ? T.glow
            : T.spark;
    heroBurst(this.fx, this.look, x, y, col, 6, 60, 1);
    heroImpact(this.fx, this.look, x, y);
  }

  render(c: CanvasRenderingContext2D) {
    const T = this.look.theme;
    const ph = demoPhase(this.t);
    const k = this.t % DEMO_LOOP;
    c.clearRect(0, 0, DEMO_W, DEMO_H);
    // pol va nishon (somon qo'g'irchoq — oddiy to'rtburchaklar)
    px(c, "#2a2038", 0, FLOOR_Y + 12, DEMO_W, DEMO_H - FLOOR_Y - 12);
    px(c, "#3a2e4c", 0, FLOOR_Y + 12, DEMO_W, 1);
    px(c, "#5a3e24", TARGET_X + 3, FLOOR_Y - 8, 2, 20);
    px(c, "#c9a26b", TARGET_X, FLOOR_Y - 10, 8, 10);
    px(c, "#7a5a2a", TARGET_X, FLOOR_Y - 6, 8, 1);
    if (this.hero === "samurai") return this.renderSamurai(c, k);
    // soya
    c.fillStyle = "rgba(0,0,0,0.32)";
    c.beginPath();
    c.ellipse(Math.round(this.x), FLOOR_Y + 12, 6, 2.4, 0, 0, Math.PI * 2);
    c.fill();
    const state = ph === "attack" || ph === "strong" ? "attack" : ph === "dash" ? "walk" : "idle";
    const frame =
      state === "attack"
        ? Math.min(2, Math.floor(((ph === "attack" ? k - 0.5 : k - 1.6) / 0.36) * 3))
        : state === "walk"
          ? Math.floor(this.t * 10) % 4
          : Math.floor(this.t * 2.5) % 2;
    const hidden = this.hero === "mage" && ph === "dash" && Math.abs(k - 2.3) < 0.1;
    if (!hidden) {
      c.globalAlpha = ph === "dash" ? 0.75 : 1;
      // orqaga sirpanishda chapga qaraydi
      const back = ph === "dash" && melee(this.hero) && (k - 2.0) / 0.6 < 0.5;
      renderSprite(c, this.hero, state, frame, this.x, FLOOR_Y, false, back, false, this.palette);
      c.globalAlpha = 1;
    }
    const body = {
      x: this.x,
      y: FLOOR_Y,
      fx: 1,
      dead: false,
      dashing: ph === "dash",
      attackTimer: ph === "attack" && k < 0.75 ? 0.2 : 0,
      spinning: ph === "strong",
      anim: { state },
    };
    renderFlair(c, this.look, body, this.t, this.fx.isReduced());
    // zaryad halqasi
    if (ph === "charge") {
      const q = Math.min(1, (k - 1.0) / 0.5);
      c.strokeStyle = chargeRingColor(T, q >= 1, this.t);
      c.lineWidth = q >= 1 ? 2 : 1;
      c.beginPath();
      c.arc(this.x, FLOOR_Y, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * q);
      c.stroke();
    }
    // oddiy zarba yoyi (Ritsar, Paladin)
    if (ph === "attack" && (this.hero === "knight" || this.hero === "paladin") && k < 0.74) {
      const q = 1 - (k - 0.5) / 0.24;
      const r = this.hero === "paladin" ? 26 : 18;
      c.strokeStyle = withAlpha(T.edge, 0.75 * q);
      c.lineWidth = 2;
      c.beginPath();
      c.arc(this.x, FLOOR_Y, r * 0.95, -1.1 + (1 - q) * 0.6, 1.1 - (1 - q) * 0.2);
      c.stroke();
      c.strokeStyle = withAlpha(T.inner, 0.5 * q);
      c.lineWidth = 1;
      c.beginPath();
      c.arc(this.x, FLOOR_Y, r * 0.7, -0.9, 0.9);
      c.stroke();
    }
    // kuchli zarba halqasi
    if (this.ring > 0) {
      const q = this.ring / 0.3;
      if (this.hero === "paladin") {
        renderQuake(c, { x: this.x, y: FLOOR_Y + 4, r: 36, life: q * 0.45, max: 0.45 }, T);
      } else if (this.hero === "mage") {
        const r = 24 * (1.15 - q * 0.5);
        c.strokeStyle = withAlpha(T.ink, 0.3 + 0.5 * q);
        c.lineWidth = 4;
        c.beginPath();
        c.arc(this.x, FLOOR_Y, r + 1, 0, Math.PI * 2);
        c.stroke();
        c.strokeStyle = withAlpha(T.edge, 0.4 + 0.6 * q);
        c.lineWidth = 2;
        c.beginPath();
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * Math.PI * 2;
          const rr = r + Math.sin(a * 8 + this.t * 20) * 1.5;
          if (i) c.lineTo(this.x + Math.cos(a) * rr, FLOOR_Y + Math.sin(a) * rr);
          else c.moveTo(this.x + Math.cos(a) * rr, FLOOR_Y + Math.sin(a) * rr);
        }
        c.stroke();
        c.strokeStyle = withAlpha(T.inner, 0.2 + 0.4 * q);
        c.lineWidth = 1;
        c.beginPath();
        c.arc(this.x, FLOOR_Y, r * 0.7, 0, Math.PI * 2);
        c.stroke();
      } else if (this.hero === "knight") {
        const a0 = (1 - q) * Math.PI * 4;
        c.strokeStyle = withAlpha(T.edge, 0.85 * q);
        c.lineWidth = 2;
        c.beginPath();
        c.arc(this.x, FLOOR_Y, 22, a0, a0 + Math.PI * 1.6);
        c.stroke();
        c.strokeStyle = withAlpha(T.inner, 0.6 * q);
        c.lineWidth = 1;
        c.beginPath();
        c.arc(this.x, FLOOR_Y, 16, 0, Math.PI * 2);
        c.stroke();
      }
    }
    for (const s of this.shots) this.renderShot(c, s);
    this.fx.renderParticles(c);
  }

  /** Samuray: o'yindagi kadrlar, katana yoyi, IAI zaryad halqasi, siluetlar, belgi va kesik. */
  private renderSamurai(c: CanvasRenderingContext2D, k: number) {
    const T = this.look.theme,
      S = SAM_DEMO;
    const pose = samuraiPose(k, this.look.fx.flair === "moon");
    for (const s of this.streaks) renderStreak(c, s, T);
    c.fillStyle = "rgba(0,0,0,0.32)";
    c.beginPath();
    c.ellipse(Math.round(pose.x), FLOOR_Y + 12, 6, 2.4, 0, 0, Math.PI * 2);
    c.fill();
    if (pose.iai) {
      // IAI: orqada qoladigan oqish siluetlar (effektlar kamaytirilganda — bitta)
      const n = this.fx.isReduced() ? 1 : 3;
      for (let i = n; i >= 1; i--) {
        c.globalAlpha = 0.34 - i * 0.08;
        renderSprite(c, "samurai", pose.state, pose.frame, pose.x - i * 13, FLOOR_Y, true);
      }
      c.globalAlpha = 1;
    }
    renderSprite(
      c,
      "samurai",
      pose.state,
      pose.frame,
      pose.x,
      FLOOR_Y,
      false,
      pose.flip,
      false,
      this.palette,
    );
    const body = {
      x: pose.x,
      y: FLOOR_Y,
      fx: pose.flip ? -1 : 1,
      dead: false,
      dashing: k >= 2.0 && k < 2.0 + S.dash,
      attackTimer: k >= 0.5 && k < 1.0 ? 0.1 : 0,
      spinning: pose.iai,
      anim: { state: pose.state },
    };
    renderFlair(c, this.look, body, this.t, this.fx.isReduced());
    // katana yoyi (kombo)
    if (k >= 0.5 && k < 1.0) {
      const s = Math.min(2, Math.floor((k - 0.5) / S.slash));
      const q = (k - 0.5 - s * S.slash) / S.slash;
      renderKatanaArc(
        c,
        {
          x: pose.x,
          y: FLOOR_Y,
          fx: 1,
          fy: 0,
          comboStep: s,
          reach: KATANA_REACH,
          attackTime: KATANA_TIME,
          attackTimer: KATANA_TIME * Math.max(0, 1 - q * 1.1),
        },
        T,
      );
    }
    // IAI zaryadi: halqa to'lib boradi, to'lganda yaltiraydi
    if (k >= S.step && k < S.iai) {
      const q = Math.min(1, (k - S.step) / (S.iai - S.step - 0.05));
      c.strokeStyle = chargeRingColor(T, q >= 1, this.t);
      c.lineWidth = q >= 1 ? 2 : 1;
      c.beginPath();
      c.arc(pose.x, FLOOR_Y, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * q);
      c.stroke();
    }
    // belgilangan nishon: kesilguncha miltillaydi
    const passed = S.iai + S.slide * ((TARGET_X - S.back) / (S.end - S.back));
    if (k >= passed && k < S.iai + S.slide + IAI_DELAY)
      renderMark(c, TARGET_X + 4, FLOOR_Y - 18, this.t, T);
    for (const cut of this.cuts) renderCut(c, cut, T);
    this.fx.renderParticles(c);
  }

  private renderShot(c: CanvasRenderingContext2D, s: Shot) {
    const T = this.look.theme;
    if (this.hero === "mage") {
      c.fillStyle = withAlpha(T.rim, 0.4);
      c.beginPath();
      c.arc(s.x, s.y, 4, 0, Math.PI * 2);
      c.fill();
      px(c, T.hot, s.x - 2, s.y - 1, 4, 2);
      px(c, T.hot, s.x - 1, s.y - 2, 2, 4);
      px(c, T.core, s.x - 1, s.y - 1, 2, 2);
      px(c, T.glint, s.x - 1, s.y - 1, 1, 1);
    } else if (this.hero === "hunter") {
      const len = s.strong ? 9 : 6;
      if (s.strong) {
        c.fillStyle = withAlpha(T.accent, 0.35);
        c.beginPath();
        c.arc(s.x, s.y, 5, 0, Math.PI * 2);
        c.fill();
      }
      for (let k = -len; k <= 1; k++) px(c, s.strong ? T.spark : T.core, s.x + k, s.y, 1, 1);
      px(c, T.glint, s.x + 1.5, s.y - 0.5, 2, 2);
      px(c, T.accentDark, s.x - len, s.y + 1, 1, 1);
      px(c, T.accentDark, s.x - len, s.y - 1, 1, 1);
      px(c, T.edge, s.x - len - 1, s.y + 1, 1, 1);
      px(c, T.edge, s.x - len - 1, s.y - 1, 1, 1);
    } else {
      const l = Math.hypot(s.vx, s.vy) || 1;
      for (let k = 2; k <= 5; k++)
        px(c, k < 4 ? T.accent : T.accentDark, s.x - (s.vx / l) * k, s.y - (s.vy / l) * k, 1, 1);
      px(c, T.ink, s.x - 1.5, s.y - 1.5, 3, 3);
      px(c, T.glow, s.x - 1, s.y - 1, 2, 2);
    }
  }
}
