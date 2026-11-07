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
import { renderSprite, type SpritePalette } from "./sprites";

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
/** Yaqin jangchilar nishon yonida turadi va dashda orqaga sirpanadi; uzoqdan otuvchilar — chapda */
const melee = (h: Hero) => h === "knight" || h === "paladin";
const homeOf = (h: Hero) => (melee(h) ? 80 : 30);

export class SkinDemo {
  fx = new Effects();
  t = 0;
  x: number;
  private home: number;
  private shots: Shot[] = [];
  private prev: DemoPhase = "idle";
  private ring = 0;

  constructor(
    public hero: Hero,
    public look: SkinLook,
    public palette: SpritePalette | undefined,
  ) {
    this.home = this.x = homeOf(hero);
  }

  update(dt: number) {
    this.t += dt;
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
