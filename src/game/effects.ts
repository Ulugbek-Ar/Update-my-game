/** Vizual "juice": zarrachalar, uchuvchi yozuvlar, ekran silkinishi. Mexanikaga ta'sir qilmaydi. */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

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
  /** 2-dunyo: xonada sekin qor yog'adi */
  snowOn = false;
  /** Bo'ron yo'nalishi (-1, 0, 1): qor ko'payadi va yon tomonga uchadi */
  wind = 0;
  snow: Flake[] = [];

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

  burst(x: number, y: number, color: string, n: number, speed = 60, size = 2) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      const life = 0.25 + Math.random() * 0.35;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life,
        max: life,
        color,
        size,
      });
    }
  }

  trail(x: number, y: number, color: string) {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: 0,
      vy: -8,
      life: 0.25,
      max: 0.25,
      color,
      size: 3,
    });
  }

  text(x: number, y: number, s: string, color: string) {
    this.texts.push({ x, y, s, color, life: 0.9 });
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
    for (const t of this.texts) {
      t.y -= 18 * dt;
      t.life -= dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    this.updateSnow(dt);
  }

  renderParticles(c: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      c.globalAlpha = Math.max(0, p.life / p.max);
      c.fillStyle = p.color;
      c.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    c.globalAlpha = 1;
  }

  renderTexts(draw: (s: string, x: number, y: number, color: string, alpha: number) => void) {
    for (const t of this.texts) draw(t.s, t.x, t.y, t.color, Math.min(1, t.life * 2));
  }
}
