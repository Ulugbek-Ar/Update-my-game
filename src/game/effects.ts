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
