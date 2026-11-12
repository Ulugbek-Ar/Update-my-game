/** Vizual "juice": zarrachalar, uchuvchi yozuvlar, ekran silkinishi. Mexanikaga ta'sir qilmaydi. */
import { currentSettings } from "./settings";
import type { ImpactKind, ParticleShape, TrailKind } from "./skinFx";

/**
 * Bir vaqtdagi zarrachalar chegarasi (telefonda ham 60 FPS): oshsa eng eskilari o'chadi.
 * "Effektlarni kamaytirish" yoqilganda — kamroq va portlashlar REDUCED_SHARE ulushga kichrayadi.
 */
export const MAX_PARTICLES = 320;
export const REDUCED_MAX_PARTICLES = 110;
export const REDUCED_SHARE = 0.35;
/** Afsonaviy zarba shakllari bir vaqtda ko'pi bilan */
export const MAX_IMPACTS = 6;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  shape: ParticleShape;
}

/** Afsonaviy skin zarbasi: ekranda kichik shakl (muz kristali yorilishi va h.k.) */
interface Impact {
  x: number;
  y: number;
  kind: ImpactKind;
  a: string;
  b: string;
  life: number;
  rot: number;
}
export const IMPACT_LIFE = 0.32;

/** Zarar raqami: dushman ustidan sakrab chiqib so'nadi (faqat ko'rinish) */
interface DamageNum {
  x: number;
  y: number;
  vx: number;
  vy: number;
  n: number;
  life: number;
  /** Kritik zarba — sariq va kattaroq */
  crit?: boolean;
}

export const DAMAGE_LIFE = 0.75;

interface Flake {
  x: number;
  y: number;
  vy: number;
  phase: number;
  size: number;
}

/** Xona o'lchami (animation.ts dagi ROOM bilan bir xil) */
const W = 320,
  H = 240;
/** Odatda shuncha qor parchasi, bo'ronda ko'proq */
export const SNOW_CALM = 34;
export const SNOW_STORM = 90;

interface FloatText {
  x: number;
  y: number;
  s: string;
  color: string;
  life: number;
}

export class Effects {
  particles: Particle[] = [];
  texts: FloatText[] = [];
  shake = 0;
  damages: DamageNum[] = [];
  /** 2-dunyo: xonada sekin qor yog'adi */
  snowOn = false;
  /** Bo'ron yo'nalishi (-1, 0, 1): qor ko'payadi va yon tomonga uchadi */
  wind = 0;
  snow: Flake[] = [];
  impacts: Impact[] = [];
  /** "Effektlarni kamaytirish" (null — sozlamalardan o'qiladi) */
  reduced: boolean | null = null;
  private trailN = 0;

  /** Effektlar kamaytirilganmi (sozlama yoki sinov uchun majburiy) */
  isReduced() {
    return this.reduced ?? currentSettings().reduceFx;
  }

  private push(p: Particle) {
    const cap = this.isReduced() ? REDUCED_MAX_PARTICLES : MAX_PARTICLES;
    if (this.particles.length >= cap) this.particles.splice(0, this.particles.length - cap + 1);
    this.particles.push(p);
  }

  private flake(top: boolean): Flake {
    return {
      x: Math.random() * W,
      y: top ? -2 : Math.random() * H,
      vy: 10 + Math.random() * 10,
      phase: Math.random() * 6,
      size: Math.random() < 0.25 ? 2 : 1,
    };
  }

  private updateSnow(dt: number) {
    if (!this.snowOn) {
      this.snow.length = 0;
      return;
    }
    const target = this.wind ? SNOW_STORM : SNOW_CALM;
    while (this.snow.length < target) this.snow.push(this.flake(false));
    if (this.snow.length > target) this.snow.length = target;
    for (const f of this.snow) {
      f.phase += dt;
      f.y += f.vy * (this.wind ? 1.6 : 1) * dt;
      f.x += (Math.sin(f.phase * 1.3) * 6 + this.wind * 120) * dt;
      if (f.y > H + 2 || f.x < -4 || f.x > W + 4) {
        Object.assign(f, this.flake(true));
        // bo'ronda shamol tomondagi chetdan ham kiradi
        if (this.wind) {
          f.x = this.wind > 0 ? -2 : W + 2;
          f.y = Math.random() * H;
        }
      }
    }
  }

  renderSnow(c: CanvasRenderingContext2D) {
    if (!this.snow.length) return;
    c.fillStyle = "rgba(240,248,255,0.85)";
    // bo'ronda qor shamol yo'nalishida chiziqcha bo'lib uchadi
    const streak = this.wind ? 3 : 0;
    for (const f of this.snow)
      c.fillRect(
        Math.round(f.x) - (this.wind < 0 ? 0 : streak),
        Math.round(f.y),
        f.size + streak,
        f.size,
      );
  }

  burst(
    x: number,
    y: number,
    color: string,
    n: number,
    speed = 60,
    size = 2,
    shape: ParticleShape = "square",
  ) {
    if (this.isReduced()) n = Math.ceil(n * REDUCED_SHARE);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      const life = 0.25 + Math.random() * 0.35;
      this.push({
        x,
        y,
        vx: Math.cos(a) * v,
        // cho'g' va puf yuqoriga suzadi
        vy: Math.sin(a) * v - (shape === "ember" || shape === "puff" ? 20 : 0),
        life,
        max: life,
        color,
        size,
        shape,
      });
    }
  }

  /**
   * Harakat izi. kind — skin izi turi (skinFx.ts): square — oddiy (default), qolganlari o'z shakli
   * va harakati bilan; extra — qo'shimcha rang (masalan qor izidagi oq parcha).
   */
  trail(x: number, y: number, color: string, kind: TrailKind = "square", extra?: string) {
    // kamaytirilganda har 3-izdan bittasi
    if (this.isReduced() && this.trailN++ % 3) return;
    const base: Particle = {
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: 0,
      vy: -8,
      life: 0.25,
      max: 0.25,
      color,
      size: 3,
      shape: "square",
    };
    if (kind === "square") return this.push(base);
    const e = extra ?? color;
    const r = Math.random();
    switch (kind) {
      case "snow":
        // muz bo'lagi va pastga tushuvchi qor parchasi
        this.push({ ...base, size: 2, shape: "shard" });
        if (r < 0.5)
          this.push({
            ...base,
            vy: 14,
            vx: (r - 0.25) * 30,
            life: 0.5,
            max: 0.5,
            color: e,
            size: 1,
          });
        return;
      case "smoke":
        this.push({ ...base, shape: "puff", vy: -14, life: 0.4, max: 0.4, size: 2 });
        return;
      case "sparkle":
        this.push({
          ...base,
          shape: r < 0.4 ? "star" : "square",
          size: r < 0.4 ? 1 : 2,
          color: r < 0.4 ? e : color,
        });
        return;
      case "ember":
        this.push({
          ...base,
          shape: "ember",
          vy: -26,
          vx: (r - 0.5) * 16,
          life: 0.4,
          max: 0.4,
          size: 2,
        });
        return;
      case "sand":
        this.push({ ...base, size: 1, vy: 6, vx: (r - 0.5) * 40, life: 0.35, max: 0.35 });
        this.push({ ...base, size: 2, color: e });
        return;
      case "shadow":
        this.push({ ...base, shape: "puff", vy: -4, life: 0.35, max: 0.35, size: 3 });
        if (r < 0.35) this.push({ ...base, shape: "ember", size: 1, color: e, vy: -20 });
        return;
      case "leaf":
        this.push({
          ...base,
          shape: "leaf",
          vy: 10,
          vx: (r - 0.5) * 30,
          life: 0.45,
          max: 0.45,
          size: 2,
        });
        return;
    }
  }

  /** Afsonaviy skin zarbasi: kichik shakl (kamaytirilganda — chizilmaydi, miltillash yo'q). */
  impact(x: number, y: number, kind: ImpactKind, a: string, b: string) {
    if (this.isReduced()) return;
    if (this.impacts.length >= MAX_IMPACTS) this.impacts.shift();
    this.impacts.push({ x, y, kind, a, b, life: IMPACT_LIFE, rot: Math.random() * Math.PI });
  }

  text(x: number, y: number, s: string, color: string) {
    this.texts.push({ x, y, s, color, life: 0.9 });
  }

  /** Zarar raqami — dushman ustidan uchib chiqib so'nadi */
  damage(x: number, y: number, n: number, crit = false) {
    if (!(n > 0)) return;
    this.damages.push({
      x,
      y,
      vx: 8 + Math.random() * 22,
      vy: -55,
      // ikki kasr xonagacha: Samuray katanasi 0.75 beradi
      n: Math.round(n * 100) / 100,
      life: DAMAGE_LIFE,
      crit,
    });
  }

  addShake(v: number) {
    this.shake = Math.max(this.shake, v);
  }

  update(dt: number) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.9;
      p.vy *= 0.9;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const m of this.impacts) m.life -= dt;
    if (this.impacts.length) this.impacts = this.impacts.filter((m) => m.life > 0);
    for (const t of this.texts) {
      t.y -= 18 * dt;
      t.life -= dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const d of this.damages) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 140 * dt;
      d.vx *= 0.95;
      d.life -= dt;
    }
    this.damages = this.damages.filter((d) => d.life > 0);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    this.updateSnow(dt);
  }

  renderParticles(c: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const k = Math.max(0, p.life / p.max);
      c.globalAlpha = k;
      c.fillStyle = p.color;
      const x = Math.round(p.x),
        y = Math.round(p.y),
        s = p.size;
      switch (p.shape) {
        case "square":
          c.fillRect(x, y, s, s);
          break;
        case "shard":
          // muz bo'lagi: ingichka qiya parcha
          c.fillRect(x, y, 1, 1);
          c.fillRect(x + 1, y - 1, 1, 1);
          if (s > 1) c.fillRect(x - 1, y + 1, 1, 1);
          break;
        case "star":
        case "cross":
          // 4 nurli yulduzcha / xoch
          c.fillRect(x - s, y, s * 2 + 1, 1);
          c.fillRect(x, y - s, 1, s * 2 + 1);
          break;
        case "puff": {
          // kengayib so'nuvchi tutun
          const r = s + (1 - k) * 3;
          c.globalAlpha = k * 0.6;
          c.fillRect(x - r / 2, y - r / 2, r, r);
          break;
        }
        case "ember":
          // miltillovchi cho'g'
          c.globalAlpha = k * (0.6 + 0.4 * Math.sin(p.life * 60));
          c.fillRect(x, y, Math.max(1, s - 1), Math.max(1, s - 1));
          break;
        case "drop":
          // tomchi: tepasi ingichka
          c.fillRect(x, y - 1, 1, 1);
          c.fillRect(x - (s > 1 ? 1 : 0), y, s > 1 ? 3 : 1, 2);
          break;
        case "streak": {
          // tezlik bo'ylab chiziqcha
          const l = Math.hypot(p.vx, p.vy) || 1;
          for (let i = 0; i < 3; i++)
            c.fillRect(Math.round(p.x - (p.vx / l) * i), Math.round(p.y - (p.vy / l) * i), 1, 1);
          break;
        }
        case "leaf":
          // aylanuvchi barg/o't: 2x1 va 1x2 navbat bilan
          if (Math.floor(p.life * 12) % 2) c.fillRect(x, y, 2, 1);
          else c.fillRect(x, y, 1, 2);
          break;
      }
    }
    c.globalAlpha = 1;
    if (this.impacts.length) this.renderImpacts(c);
  }

  /** Afsonaviy zarba shakllari: chiziqli kichik "imzo" — 0.32s ichida kengayib so'nadi. */
  private renderImpacts(c: CanvasRenderingContext2D) {
    c.save();
    c.lineWidth = 1;
    for (const m of this.impacts) {
      const k = 1 - m.life / IMPACT_LIFE;
      const a = Math.min(1, (1 - k) * 1.6);
      const r = 4 + k * 10;
      c.globalAlpha = a;
      c.strokeStyle = m.a;
      c.fillStyle = m.b;
      c.beginPath();
      if (m.kind === "crystal") {
        // muz kristali yorilishi: 6 nurli qor yulduzi, uchlarida shoxchalar
        for (let i = 0; i < 6; i++) {
          const an = m.rot + (i * Math.PI) / 3;
          const cx = Math.cos(an),
            cy = Math.sin(an);
          c.moveTo(m.x + cx * 2, m.y + cy * 2);
          c.lineTo(m.x + cx * r, m.y + cy * r);
          const bx = m.x + cx * r * 0.6,
            by = m.y + cy * r * 0.6;
          c.moveTo(bx, by);
          c.lineTo(bx + Math.cos(an + 0.8) * 3, by + Math.sin(an + 0.8) * 3);
          c.moveTo(bx, by);
          c.lineTo(bx + Math.cos(an - 0.8) * 3, by + Math.sin(an - 0.8) * 3);
        }
        c.stroke();
      } else if (m.kind === "flare") {
        // quyosh chaqnashi: 8 nur, uzun-qisqa navbat bilan
        for (let i = 0; i < 8; i++) {
          const an = m.rot + (i * Math.PI) / 4;
          const rr = i % 2 ? r * 0.6 : r;
          c.moveTo(m.x + Math.cos(an) * 3, m.y + Math.sin(an) * 3);
          c.lineTo(m.x + Math.cos(an) * rr, m.y + Math.sin(an) * rr);
        }
        c.stroke();
        c.fillRect(Math.round(m.x) - 1, Math.round(m.y) - 1, 3, 3);
      } else if (m.kind === "crescent") {
        // tungi o'roq: ikki qavat yarim oy
        c.arc(m.x, m.y, r * 0.8, m.rot, m.rot + Math.PI * 1.1);
        c.stroke();
        c.beginPath();
        c.strokeStyle = m.b;
        c.arc(m.x + 1, m.y - 1, r * 0.55, m.rot + 0.3, m.rot + Math.PI);
        c.stroke();
      } else if (m.kind === "moon") {
        // qizil oy kesigi: qalin yarim oy — tashqi yoy keng, ichki yoy siljigan (o'roq shakli)
        c.lineWidth = 2;
        c.arc(m.x, m.y, r, m.rot - 0.9, m.rot + 0.9);
        c.stroke();
        c.beginPath();
        c.lineWidth = 1;
        c.strokeStyle = m.b;
        c.arc(m.x - Math.cos(m.rot) * 3, m.y - Math.sin(m.rot) * 3, r, m.rot - 0.6, m.rot + 0.6);
        c.stroke();
        c.fillRect(
          Math.round(m.x + Math.cos(m.rot) * r) - 1,
          Math.round(m.y + Math.sin(m.rot) * r) - 1,
          2,
          2,
        );
      } else if (m.kind === "gust") {
        // dasht shamoli: uchta burama yoy
        for (let i = 0; i < 3; i++) {
          const an = m.rot + (i * Math.PI * 2) / 3 + k * 2;
          c.moveTo(m.x + Math.cos(an) * r, m.y + Math.sin(an) * r * 0.7);
          c.arc(m.x, m.y, r, an, an + 1.4);
        }
        c.stroke();
      } else {
        // feniks: yuqoriga ochilgan ikki qanot va o'rtada uchqun
        for (const s of [-1, 1]) {
          c.moveTo(m.x, m.y);
          c.quadraticCurveTo(m.x + s * r * 0.5, m.y - r, m.x + s * r, m.y - r * 0.4);
          c.moveTo(m.x, m.y + 1);
          c.quadraticCurveTo(m.x + s * r * 0.4, m.y - r * 0.4, m.x + s * r * 0.8, m.y);
        }
        c.stroke();
        c.fillRect(Math.round(m.x), Math.round(m.y) - 2, 1, 3);
      }
    }
    c.restore();
  }

  /** Zarar raqamlari: chiqishda biroz kattalashib "pop" qiladi, oxirida so'nadi. */
  renderDamages(
    draw: (s: string, x: number, y: number, size: number, color: string, alpha: number) => void,
  ) {
    for (const d of this.damages) {
      const age = DAMAGE_LIFE - d.life;
      const size = (age < 0.08 ? 8 : 6) + (d.crit ? 2 : 0);
      draw(`${d.n}`, d.x, d.y, size, d.crit ? "#ffe14d" : "#ffffff", Math.min(1, d.life * 3));
    }
  }

  renderTexts(draw: (s: string, x: number, y: number, color: string, alpha: number) => void) {
    for (const t of this.texts) draw(t.s, t.x, t.y, t.color, Math.min(1, t.life * 2));
  }
}
