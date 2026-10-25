import { ROOM, applyHit, overlap, px, separate, type Body } from "./animation";
import { Input } from "./input";
import { Player } from "./player";
import { Enemy, type EnemyKind } from "./enemy";
import { Boss } from "./boss";
import { GAME_VERSION } from "./version";
import { sfx } from "./audio";
import { Effects } from "./effects";
import { WAVES, BOSS_WAVE, pickUpgrades, type Upgrade } from "./waves";

const STORAGE_KEY = "pixel-rpg-attempt";
export const BEST_KEY = "pixel-rpg-best";
type Phase = "play" | "attempt" | "victory";
type Stage = "fight" | "upgrade";

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}
interface Drop {
  x: number;
  y: number;
  life: number;
}

const KILL_POINTS: Record<EnemyKind, number> = { blob: 10, wisp: 15, rammer: 20 };
const KILL_COLOR: Record<EnemyKind, string> = {
  blob: "#5bc85b",
  wisp: "#8a4fc0",
  rammer: "#d6d9cf",
};
const BOSS_POINTS = 300;
const COMBO_TIME = 2.5;
const DROP_CHANCE = 0.15;
const TOTAL_WAVES = WAVES.length;

function load(key: string) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}
function save(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* saqlash imkonsiz */
  }
}

/** Butun o'yin holati shu obyektda — React state'da emas. */
export class Game {
  input = new Input();
  player = new Player();
  enemies: Enemy[] = [];
  boss: Boss | null = null;
  shots: Shot[] = [];
  drops: Drop[] = [];
  fx = new Effects();
  attempt = 1;
  phase: Phase = "play";
  stage: Stage = "fight";
  wave = 0;
  choices: Upgrade[] = [];
  choiceIndex = 0;
  private upgradeLock = 0;
  score = 0;
  best = 0;
  newBest = false;
  combo = 0;
  comboTimer = 0;
  killsForHeal = 0;
  waveHurt = false;
  banner = { title: "", sub: "", timer: 0 };
  paused = false;
  msgTimer = 0;
  time = 0;
  private freeze = 0;
  private raf = 0;
  private last = 0;
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private floor: HTMLCanvasElement | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    const saved = load(STORAGE_KEY);
    this.attempt = saved > 0 ? saved : 1;
    this.best = load(BEST_KEY);
    this.reset();
  }

  /** Boshlang'ich holat: 1-to'lqin, HP to'liq. */
  reset() {
    this.player = new Player();
    this.enemies = [];
    this.boss = null;
    this.shots = [];
    this.drops = [];
    this.fx = new Effects();
    this.score = 0;
    this.newBest = false;
    this.combo = 0;
    this.comboTimer = 0;
    this.killsForHeal = 0;
    this.phase = "play";
    this.input.clearQueued();
    this.startWave(0);
  }

  private startWave(i: number) {
    this.wave = i;
    this.stage = "fight";
    this.waveHurt = false;
    const boss = i === BOSS_WAVE;
    this.banner = boss
      ? { title: "BOSS: IBLIS", sub: "Qizil doiradan qoch!", timer: 2.2 }
      : {
          title: `TO'LQIN ${i + 1}/${TOTAL_WAVES}`,
          sub: i === 0 ? "Shift — dash" : "",
          timer: 1.6,
        };
    WAVES[i]!.forEach((kind, n) => {
      const [x, y] = this.spawnPoint();
      const e = new Enemy(kind, x, y);
      e.spawn = e.spawnMax = 1 + n * 0.18 + (boss ? 1.2 : 0);
      e.speedMul = 1 + i * 0.07;
      this.enemies.push(e);
    });
    if (boss) {
      this.boss = new Boss();
      this.boss.spawn = this.boss.spawnMax = 1.6;
      sfx.roar();
      this.fx.addShake(0.4);
    } else sfx.wave();
  }

  /** O'yinchidan uzoqroq tasodifiy nuqta. */
  private spawnPoint(): [number, number] {
    const m = ROOM.wall + 14;
    let best: [number, number] = [m, m];
    let bestD = -1;
    for (let k = 0; k < 20; k++) {
      const x = m + Math.random() * (ROOM.w - m * 2);
      const y = m + Math.random() * (ROOM.h - m * 2);
      const d = Math.hypot(x - this.player.x, y - this.player.y);
      if (d > 90) return [x, y];
      if (d > bestD) {
        bestD = d;
        best = [x, y];
      }
    }
    return best;
  }

  /** Pauza faqat jang paytida, o'lim animatsiyasi yoki urinish yozuvida emas. */
  private canPause() {
    return this.phase === "play" && !this.player.dead;
  }

  setPaused(on: boolean) {
    if (on && !this.canPause()) return;
    if (this.paused === on) return;
    this.paused = on;
    if (on) sfx.suspend();
    else sfx.resume();
  }

  /** Urinish sonini o'zgartirmasdan boshidan boshlash. */
  restart() {
    this.reset();
    this.setPaused(false);
  }

  // Tugmalar (xona koordinatalarida)
  private resumeBtn = { x: ROOM.w / 2 - 70, y: ROOM.h / 2 + 4, w: 140, h: 18 };
  private restartBtn = { x: ROOM.w / 2 - 70, y: ROOM.h / 2 + 28, w: 140, h: 18 };
  private cardRect(i: number) {
    const w = 92,
      gap = 8,
      h = 100;
    const x0 = (ROOM.w - (w * 3 + gap * 2)) / 2;
    return { x: x0 + i * (w + gap), y: 74, w, h };
  }

  private toRoom(e: MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    // CSS masshtabi -> bufer -> xona koordinatalari
    const bx = ((e.clientX - r.left) / r.width) * this.canvas.width;
    const by = ((e.clientY - r.top) / r.height) * this.canvas.height;
    const scale = Math.min(this.canvas.width / ROOM.w, this.canvas.height / ROOM.h);
    return {
      x: (bx - (this.canvas.width - ROOM.w * scale) / 2) / scale,
      y: (by - (this.canvas.height - ROOM.h * scale) / 2) / scale,
    };
  }

  private onClick = (e: MouseEvent) => {
    const { x, y } = this.toRoom(e);
    const hit = (b: { x: number; y: number; w: number; h: number }) =>
      x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    if (this.paused) {
      if (hit(this.resumeBtn)) this.setPaused(false);
      else if (hit(this.restartBtn)) this.restart();
      return;
    }
    if (this.phase === "victory") return this.newRun();
    if (this.phase === "play" && this.stage === "upgrade") {
      if (this.upgradeLock > 0) return;
      for (let i = 0; i < this.choices.length; i++)
        if (hit(this.cardRect(i))) return this.choose(i);
    }
  };

  private onVisibility = () => {
    if (document.hidden) this.setPaused(true);
  };
  private onBlur = () => this.setPaused(true);

  start() {
    this.input.attach();
    this.canvas.addEventListener("click", this.onClick);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("blur", this.onBlur);
    this.last = performance.now();
    const loop = (now: number) => {
      // last har kadrda yangilanadi: pauza vaqti dt ga qo'shilmaydi
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (this.input.consumePause()) this.setPaused(!this.paused);
      if (this.input.consumeKey("KeyM")) sfx.toggleMute();
      if (this.paused) {
        // pauzada bosilgan hujum/Enter navbatlari tozalanadi
        this.input.clearQueued();
      } else {
        this.update(dt);
      }
      this.input.endFrame();
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.input.detach();
    this.canvas.removeEventListener("click", this.onClick);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("blur", this.onBlur);
    sfx.resume();
  }

  private newRun() {
    this.attempt = 1;
    save(STORAGE_KEY, 1);
    this.reset();
  }

  private commitBest() {
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      save(BEST_KEY, this.best);
    }
  }

  private choose(i: number) {
    const u = this.choices[i];
    if (!u) return;
    u.apply(this.player);
    sfx.upgrade();
    this.fx.text(this.player.x, this.player.y - 16, u.name, u.color);
    this.fx.burst(this.player.x, this.player.y, u.color, 18, 70);
    this.input.clearQueued();
    this.startWave(this.wave + 1);
  }

  private updateUpgrade(dt: number) {
    if (this.upgradeLock > 0) {
      this.upgradeLock -= dt;
      this.input.clearQueued();
      return;
    }
    const n = this.choices.length;
    const inp = this.input;
    for (let i = 0; i < n; i++)
      if (inp.consumeKey(`Digit${i + 1}`, `Numpad${i + 1}`)) return this.choose(i);
    if (inp.consumeKey("ArrowLeft", "KeyA")) this.choiceIndex = (this.choiceIndex + n - 1) % n;
    if (inp.consumeKey("ArrowRight", "KeyD")) this.choiceIndex = (this.choiceIndex + 1) % n;
    if (inp.consumeEnter() || inp.consumeAttack()) this.choose(this.choiceIndex);
    inp.consumeDash();
  }

  private onKill(e: Enemy) {
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    this.comboTimer = COMBO_TIME;
    const mult = Math.min(5, 1 + Math.floor((this.combo - 1) / 2));
    const pts = KILL_POINTS[e.kind] * mult;
    this.score += pts;
    this.fx.text(
      e.x,
      e.y - 10,
      mult > 1 ? `+${pts} x${mult}` : `+${pts}`,
      mult > 1 ? "#ffcc33" : "#ffffff",
    );
    this.fx.burst(e.x, e.y, KILL_COLOR[e.kind], 14, 80);
    sfx.kill();
    if (Math.random() < DROP_CHANCE) this.drops.push({ x: e.x, y: e.y, life: 9 });
    const p = this.player;
    if (p.lifesteal) {
      this.killsForHeal++;
      if (this.killsForHeal >= p.lifesteal) {
        this.killsForHeal = 0;
        if (p.heal(1)) this.fx.text(p.x, p.y - 14, "+1 YURAK", "#ff4d6d");
      }
    }
  }

  private onPlayerHurt() {
    const p = this.player;
    this.waveHurt = true;
    this.combo = 0;
    this.comboTimer = 0;
    this.fx.addShake(0.25);
    this.fx.burst(p.x, p.y, "#ff4d6d", 10, 70);
  }

  update(dt: number) {
    this.time += dt;
    this.fx.update(dt);
    if (this.phase === "attempt") {
      this.msgTimer -= dt;
      if (this.msgTimer <= 0) this.reset();
      return;
    }
    if (this.phase === "victory") {
      this.boss?.update(dt, this.player);
      if (this.input.consumeEnter()) this.newRun();
      return;
    }
    if (this.stage === "upgrade") return this.updateUpgrade(dt);
    if (this.freeze > 0) {
      this.freeze -= dt;
      return;
    }
    if (this.banner.timer > 0) this.banner.timer -= dt;
    if (this.comboTimer > 0) this.comboTimer -= dt;
    else this.combo = 0;

    const p = this.player;
    const hpBefore = p.hp;
    p.update(dt, this.input);
    if (p.dashing) this.fx.trail(p.x, p.y + 2, "rgba(104,205,228,0.8)");
    for (const e of this.enemies) e.update(dt, p);
    const boss = this.boss;
    if (boss) {
      boss.update(dt, p);
      if (boss.justEnraged) {
        boss.justEnraged = false;
        this.banner = { title: "G'AZAB!", sub: "Iblis olov sochadi", timer: 1.6 };
        sfx.roar();
        this.fx.addShake(0.4);
      }
      if (boss.justSlammed) this.fx.addShake(0.2);
      if (boss.shots.length) {
        for (const s of boss.shots) this.shots.push({ ...s, size: 6 });
        boss.shots = [];
        sfx.fireball();
      }
    }
    this.enemies = this.enemies.filter((e) => !e.removed);

    // ustma-ust yig'ilmaslik
    const alive = this.enemies.filter((e) => e.active);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) separate(alive[i]!, alive[j]!);
      if (boss?.active) separate(alive[i]!, boss, 1);
    }

    // olov sharlari
    for (const s of this.shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (Math.random() < 0.5) this.fx.trail(s.x, s.y, "rgba(255,140,40,0.7)");
    }
    const inRoom = (s: Shot) =>
      s.x > ROOM.wall && s.x < ROOM.w - ROOM.wall && s.y > ROOM.wall && s.y < ROOM.h - ROOM.wall;
    this.shots = this.shots.filter(inRoom);

    // o'yinchi hujumi
    const box = p.attackBox();
    if (box) {
      const targets: (Enemy | Boss)[] = this.enemies.filter((e) => e.active);
      if (boss?.active) targets.push(boss);
      for (const t of targets) {
        if (!p.hitSet.has(t) && overlap(box, t)) {
          p.hitSet.add(t);
          sfx.hit();
          applyHit(t, p.damage, p.x, p.y, t === boss ? 120 : 220);
          this.freeze = 0.045;
          this.fx.addShake(0.08);
          this.fx.burst(t.x, t.y, "#ffffff", 5, 60, 1);
          if (t.hp <= 0) {
            if (t instanceof Enemy) this.onKill(t);
            else {
              this.score += BOSS_POINTS;
              this.fx.text(t.x, t.y - 24, `+${BOSS_POINTS}`, "#ffcc33");
              this.fx.burst(t.x, t.y, "#f4cb45", 40, 120, 3);
              this.fx.addShake(0.6);
              this.shots = [];
            }
          }
        }
      }
      // qilich olov sharini ham urib yo'q qiladi
      const before = this.shots.length;
      this.shots = this.shots.filter((s) => {
        if (!overlap(box, s as unknown as Body)) return true;
        this.fx.burst(s.x, s.y, "#ff9a3c", 6, 50);
        return false;
      });
      if (this.shots.length < before) this.score += 5 * (before - this.shots.length);
    }

    // kontakt zarar
    if (!p.dead) {
      for (const e of this.enemies) if (e.active && overlap(p, e)) p.takeHit(1, e.x, e.y, 180);
      if (boss?.active && overlap(p, boss)) p.takeHit(1, boss.x, boss.y, 220);
      this.shots = this.shots.filter((s) => {
        if (!overlap(p, s as unknown as Body)) return true;
        return !p.takeHit(1, s.x, s.y, 160);
      });
    }
    if (p.hp < hpBefore) this.onPlayerHurt();

    // yurak terish
    for (const d of this.drops) d.life -= dt;
    this.drops = this.drops.filter((d) => {
      if (d.life <= 0) return false;
      if (Math.hypot(d.x - p.x, d.y - p.y) > 11 || p.dead) return true;
      if (p.heal(1)) this.fx.text(d.x, d.y - 8, "+1 YURAK", "#ff4d6d");
      else {
        this.score += 25;
        this.fx.text(d.x, d.y - 8, "+25", "#ffffff");
      }
      sfx.pickup();
      this.fx.burst(d.x, d.y, "#ff4d6d", 8, 40);
      return false;
    });

    // o'lim -> urinish
    if (p.dead) {
      if (p.anim.done) {
        this.commitBest();
        this.attempt++;
        save(STORAGE_KEY, this.attempt);
        this.phase = "attempt";
        this.msgTimer = 2.6;
      }
      return;
    }

    // to'lqin tugadi
    if (this.enemies.length === 0) {
      if (this.wave === BOSS_WAVE) {
        if (boss?.dead && boss.anim.done) {
          this.commitBest();
          this.phase = "victory";
          sfx.victory();
        }
      } else this.clearWave();
    }
  }

  private clearWave() {
    let bonus = 50 * (this.wave + 1);
    if (!this.waveHurt) {
      bonus += 100;
      this.fx.text(ROOM.w / 2, 60, "BENUQSON! +100", "#a6f08e");
    }
    this.score += bonus;
    this.shots = [];
    this.choices = pickUpgrades(this.player);
    this.choiceIndex = 0;
    this.upgradeLock = 0.6;
    this.input.clearQueued();
    sfx.clear();
    if (this.choices.length) this.stage = "upgrade";
    else this.startWave(this.wave + 1);
  }

  // ---------------- chizish ----------------

  private buildFloor() {
    const cv = document.createElement("canvas");
    cv.width = ROOM.w;
    cv.height = ROOM.h;
    const c = cv.getContext("2d")!;
    px(c, "#1b1426", 0, 0, ROOM.w, ROOM.h);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let y = ROOM.wall; y < ROOM.h - ROOM.wall; y += 16)
      for (let x = ROOM.wall; x < ROOM.w - ROOM.wall; x += 16) {
        px(c, ((x + y) / 16) % 2 ? "#3a2f4a" : "#342a43", x, y, 16, 16);
        px(c, "#2c2339", x, y + 15, 16, 1);
        px(c, "#2c2339", x + 15, y, 1, 16);
        const r = rnd();
        if (r < 0.12) {
          // yoriq
          px(c, "#251d31", x + 4, y + 6, 5, 1);
          px(c, "#251d31", x + 8, y + 7, 1, 3);
        } else if (r < 0.18) {
          // tosh parchasi
          px(c, "#4a3d5c", x + 9, y + 4, 2, 2);
          px(c, "#4a3d5c", x + 3, y + 11, 1, 1);
        } else if (r < 0.21) {
          // suyak
          px(c, "#8d8a84", x + 4, y + 8, 7, 1);
          px(c, "#8d8a84", x + 3, y + 7, 2, 1);
          px(c, "#8d8a84", x + 10, y + 9, 2, 1);
        }
      }
    // devorlar
    px(c, "#5c4a6e", 0, 0, ROOM.w, ROOM.wall);
    px(c, "#4a3b59", 0, ROOM.h - ROOM.wall, ROOM.w, ROOM.wall);
    px(c, "#4a3b59", 0, 0, ROOM.wall, ROOM.h);
    px(c, "#4a3b59", ROOM.w - ROOM.wall, 0, ROOM.wall, ROOM.h);
    for (let x = 0; x < ROOM.w; x += 16) {
      px(c, "#6e5a82", x, 2, 14, 5);
      px(c, "#6e5a82", x + 8, 9, 14, 5);
    }
    // devor ostidagi soya
    px(c, "rgba(0,0,0,0.35)", ROOM.wall, ROOM.wall, ROOM.w - ROOM.wall * 2, 4);
    px(c, "rgba(0,0,0,0.2)", ROOM.wall, ROOM.wall, 3, ROOM.h - ROOM.wall * 2);
    px(c, "rgba(0,0,0,0.2)", ROOM.w - ROOM.wall - 3, ROOM.wall, 3, ROOM.h - ROOM.wall * 2);
    // mash'ala tutqichlari
    for (const tx of [64, 160, 256]) px(c, "#2a1f38", tx - 2, 8, 4, 6);
    this.floor = cv;
  }

  private renderRoom(c: CanvasRenderingContext2D) {
    if (!this.floor) this.buildFloor();
    c.drawImage(this.floor!, 0, 0);
    // mash'alalar
    for (const [i, tx] of [64, 160, 256].entries()) {
      const fl = Math.sin(this.time * 9 + i * 2) + Math.sin(this.time * 13 + i);
      const g = c.createRadialGradient(tx, 14, 2, tx, 14, 46 + fl * 2);
      g.addColorStop(0, "rgba(255,170,60,0.22)");
      g.addColorStop(1, "rgba(255,170,60,0)");
      c.fillStyle = g;
      c.fillRect(tx - 50, 0, 100, 64);
      px(c, "#ff9a3c", tx - 2, 4 + (fl > 0 ? 0 : 1), 4, 4);
      px(c, "#ffe14d", tx - 1, 5 + (fl > 0 ? 0 : 1), 2, 3);
    }
  }

  private shadow(c: CanvasRenderingContext2D, x: number, y: number, w: number) {
    c.fillStyle = "rgba(0,0,0,0.32)";
    c.beginPath();
    c.ellipse(Math.round(x), Math.round(y), w / 2, w / 5, 0, 0, Math.PI * 2);
    c.fill();
  }

  private renderSlash(c: CanvasRenderingContext2D) {
    const p = this.player;
    if (p.attackTimer <= 0 || p.dead) return;
    const k = p.attackTimer / 0.24;
    const ang = Math.atan2(p.fy, p.fx);
    c.strokeStyle = `rgba(255,255,255,${0.75 * k})`;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(p.x, p.y, p.reach * 0.95, ang - 1.1 + (1 - k) * 0.6, ang + 1.1 - (1 - k) * 0.2);
    c.stroke();
    c.strokeStyle = `rgba(104,205,228,${0.5 * k})`;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(p.x, p.y, p.reach * 0.7, ang - 0.9, ang + 0.9);
    c.stroke();
  }

  render() {
    const c = this.ctx;
    // Fit the unchanged logical room uniformly inside the drawing buffer.
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    const scale = Math.min(c.canvas.width / ROOM.w, c.canvas.height / ROOM.h);
    c.save();
    c.translate((c.canvas.width - ROOM.w * scale) / 2, (c.canvas.height - ROOM.h * scale) / 2);
    c.scale(scale, scale);
    c.save();
    // xona tashqarisi ko'rinmasligi uchun silkinish xona ichida kesiladi
    c.beginPath();
    c.rect(0, 0, ROOM.w, ROOM.h);
    c.clip();
    if (this.fx.shake > 0 && !this.paused) {
      const s = Math.min(1, this.fx.shake * 6) * 3;
      c.translate(Math.round((Math.random() - 0.5) * s), Math.round((Math.random() - 0.5) * s));
    }
    this.renderRoom(c);

    // yurak tushumlari
    for (const d of this.drops) {
      if (d.life < 2 && Math.floor(d.life * 8) % 2) continue;
      const y = d.y + Math.round(Math.sin(this.time * 4 + d.x) * 1.5);
      this.shadow(c, d.x, d.y + 6, 7);
      this.heart(c, d.x - 4, y - 4, "#ff4d6d");
    }

    // chuqurlik bo'yicha tartib
    const p = this.player;
    const all: { y: number; r: () => void }[] = this.enemies.map((e) => ({
      y: e.y,
      r: () => {
        if (!e.dead) this.shadow(c, e.x, e.y + (e.kind === "wisp" ? 11 : e.size / 2 + 1), e.size);
        e.render(c);
      },
    }));
    const boss = this.boss;
    if (boss)
      all.push({
        y: boss.y,
        r: () => {
          if (!boss.dead) this.shadow(c, boss.x, boss.y + 24, 30);
          boss.render(c);
        },
      });
    if (this.phase !== "attempt" || !p.dead)
      all.push({
        y: p.y,
        r: () => {
          if (!p.dead) this.shadow(c, p.x, p.y + 12, 12);
          p.render(c);
        },
      });
    all.sort((a, b) => a.y - b.y).forEach((o) => o.r());

    this.renderSlash(c);
    for (const s of this.shots) {
      c.fillStyle = "rgba(255,120,40,0.35)";
      c.beginPath();
      c.arc(s.x, s.y, 5, 0, Math.PI * 2);
      c.fill();
      px(c, "#ff6a2a", s.x - 2, s.y - 2, 4, 4);
      px(c, "#ffe14d", s.x - 1, s.y - 1, 2, 2);
    }
    this.fx.renderParticles(c);
    this.fx.renderTexts((s, x, y, color, a) => {
      c.globalAlpha = a;
      this.text(s, x, y, 6, color);
      c.globalAlpha = 1;
    });

    // vinyetka
    const v = c.createRadialGradient(ROOM.w / 2, ROOM.h / 2, 90, ROOM.w / 2, ROOM.h / 2, 210);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.45)");
    c.fillStyle = v;
    c.fillRect(0, 0, ROOM.w, ROOM.h);
    // past HP — qizil chekka
    if (p.hp === 1 && !p.dead) {
      c.fillStyle = `rgba(200,0,30,${0.12 + 0.08 * Math.sin(this.time * 6)})`;
      c.fillRect(0, 0, ROOM.w, ROOM.h);
    }
    c.restore();

    this.renderHud();
    this.renderOverlays();
    c.restore();
  }

  private heart(c: CanvasRenderingContext2D, x: number, y: number, color: string) {
    px(c, color, x + 1, y, 2, 1);
    px(c, color, x + 5, y, 2, 1);
    px(c, color, x, y + 1, 8, 3);
    px(c, color, x + 1, y + 4, 6, 1);
    px(c, color, x + 2, y + 5, 4, 1);
    px(c, color, x + 3, y + 6, 2, 1);
  }

  private renderHud() {
    const c = this.ctx;
    const p = this.player;
    for (let i = 0; i < p.maxHp; i++) {
      const on = i < p.hp;
      this.heart(c, 4 + i * 10, 4, on ? "#ff4d6d" : "#3b2a3a");
      if (on) px(c, "#ffb3c1", 5 + i * 10, 5, 1, 1);
    }
    // dash tayyorligi
    const k = Math.max(0, Math.min(1, 1 - p.dashCooldown / p.dashCd));
    px(c, "#000", 4, 13, 32, 3);
    px(c, k >= 1 ? "#68cde4" : "#287faf", 5, 14, 30 * k, 1);

    this.text(
      this.wave === BOSS_WAVE ? "BOSS" : `TO'LQIN ${this.wave + 1}/${TOTAL_WAVES}`,
      ROOM.w / 2,
      11,
      7,
      "#e0d6ee",
    );
    this.text(String(this.score).padStart(6, "0"), ROOM.w - 4, 11, 7, "#ffcc33", "right");
    if (this.combo >= 2) this.text(`KOMBO x${this.combo}`, ROOM.w - 4, 21, 5, "#ff9a3c", "right");
    this.text(`URINISH ${this.attempt}`, 4, ROOM.h - 5, 5, "rgba(224,214,238,0.7)", "left");

    const boss = this.boss;
    if (boss && this.wave === BOSS_WAVE && !(boss.dead && boss.anim.done)) {
      const bw = 140,
        bx = (ROOM.w - bw) / 2,
        by = ROOM.h - 10;
      this.text("IBLIS", ROOM.w / 2, by - 2, 5, boss.enraged ? "#ff6a6a" : "#e0d6ee");
      px(c, "#000", bx - 1, by, bw + 2, 6);
      px(
        c,
        boss.enraged ? "#b23238" : "#8e44ad",
        bx,
        by + 1,
        (bw * Math.max(0, boss.hp)) / boss.maxHp,
        4,
      );
      px(c, "rgba(255,255,255,0.25)", bx, by + 1, (bw * Math.max(0, boss.hp)) / boss.maxHp, 1);
    }

    if (this.banner.timer > 0 && this.phase === "play" && this.stage === "fight") {
      const a = Math.min(1, this.banner.timer * 2);
      c.globalAlpha = a;
      px(c, "rgba(0,0,0,0.55)", 0, 92, ROOM.w, this.banner.sub ? 40 : 28);
      this.text(this.banner.title, ROOM.w / 2, 112, 12, "#ffcc33");
      if (this.banner.sub) this.text(this.banner.sub, ROOM.w / 2, 126, 6, "#e0d6ee");
      c.globalAlpha = 1;
    }
  }

  private wrap(s: string, max: number) {
    const lines: string[] = [];
    let cur = "";
    for (const w of s.split(" ")) {
      if ((cur + " " + w).trim().length > max) {
        if (cur) lines.push(cur);
        cur = w;
      } else cur = (cur + " " + w).trim();
    }
    if (cur) lines.push(cur);
    return lines;
  }

  private renderOverlays() {
    const c = this.ctx;
    if (this.phase === "play" && this.stage === "upgrade" && !this.paused) {
      px(c, "rgba(8,4,16,0.78)", 0, 0, ROOM.w, ROOM.h);
      this.text(`${this.wave + 1}-TO'LQIN TOZALANDI`, ROOM.w / 2, 40, 9, "#a6f08e");
      this.text("Kuch tanlang: 1 / 2 / 3", ROOM.w / 2, 58, 6, "#e0d6ee");
      this.choices.forEach((u, i) => {
        const r = this.cardRect(i);
        const sel = i === this.choiceIndex;
        const lift = sel ? -3 : 0;
        px(c, sel ? u.color : "#5c4a6e", r.x, r.y + lift, r.w, r.h);
        px(c, "#1f1730", r.x + 2, r.y + 2 + lift, r.w - 4, r.h - 4);
        px(c, u.color, r.x + r.w / 2 - 6, r.y + 10 + lift, 12, 12);
        px(c, "#1f1730", r.x + r.w / 2 - 4, r.y + 12 + lift, 8, 8);
        this.text(String(i + 1), r.x + r.w / 2, r.y + 19 + lift, 6, u.color);
        this.wrap(u.name, 12).forEach((l, j) =>
          this.text(l, r.x + r.w / 2, r.y + 38 + j * 9 + lift, 6, u.color),
        );
        this.wrap(u.desc, 15).forEach((l, j) =>
          this.text(l, r.x + r.w / 2, r.y + 62 + j * 8 + lift, 5, "#e0d6ee"),
        );
      });
      this.text("A/D tanlash, Enter — olish", ROOM.w / 2, 196, 5, "#b8a8cc");
    }
    if (this.paused) {
      px(c, "rgba(0,0,0,0.7)", 0, 0, ROOM.w, ROOM.h);
      this.text("PAUZA", ROOM.w / 2, ROOM.h / 2 - 34, 18, "#ffcc33");
      this.text(
        `Ovoz: ${sfx.muted ? "o'chiq" : "yoqiq"} (M)`,
        ROOM.w / 2,
        ROOM.h / 2 - 14,
        6,
        "#b8a8cc",
      );
      for (const [b, label] of [
        [this.resumeBtn, "Davom etish: Esc"],
        [this.restartBtn, "Qaytadan boshlash"],
      ] as const) {
        px(c, "#ffcc33", b.x, b.y, b.w, b.h);
        px(c, "#2a1f38", b.x + 1, b.y + 1, b.w - 2, b.h - 2);
        this.text(label, ROOM.w / 2, b.y + 12, 7, "#e0d6ee");
      }
      this.text("WASD yurish · Space zarba · Shift dash", ROOM.w / 2, ROOM.h - 30, 5, "#b8a8cc");
    }
    if (this.phase === "attempt") {
      px(c, "rgba(0,0,0,0.75)", 0, 0, ROOM.w, ROOM.h);
      this.text("YIQILDINGIZ", ROOM.w / 2, ROOM.h / 2 - 30, 10, "#ff4d6d");
      this.text(`Urinish №${this.attempt}`, ROOM.w / 2, ROOM.h / 2, 14, "#ffcc33");
      this.text(
        `Ochko: ${this.score}   Rekord: ${this.best}`,
        ROOM.w / 2,
        ROOM.h / 2 + 22,
        6,
        "#e0d6ee",
      );
      if (this.newBest) this.text("YANGI REKORD!", ROOM.w / 2, ROOM.h / 2 + 36, 6, "#a6f08e");
    }
    if (this.phase === "victory") {
      px(c, "rgba(10,5,20,0.8)", 0, 0, ROOM.w, ROOM.h);
      this.text("G'ALABA!", ROOM.w / 2, 80, 20, "#ffcc33");
      this.text(`${this.attempt}-urinishda yutdingiz`, ROOM.w / 2, 112, 8, "#ffffff");
      this.text(`Ochko: ${this.score}`, ROOM.w / 2, 134, 8, "#ffcc33");
      this.text(
        this.newBest ? "YANGI REKORD!" : `Rekord: ${this.best}`,
        ROOM.w / 2,
        150,
        6,
        this.newBest ? "#a6f08e" : "#b8a8cc",
      );
      this.text("Enter yoki bosing — qaytadan", ROOM.w / 2, 180, 6, "#b8a8cc");
      this.text(`v${GAME_VERSION}`, ROOM.w - 34, ROOM.h - 8, 6, "rgba(255,255,255,0.45)");
    }
  }

  private text(
    s: string,
    x: number,
    y: number,
    size: number,
    color: string,
    align: CanvasTextAlign = "center",
  ) {
    const c = this.ctx;
    c.font = `${size}px "Press Start 2P", monospace`;
    c.textAlign = align;
    c.fillStyle = "#000";
    c.fillText(s, x + 1, y + 1);
    c.fillStyle = color;
    c.fillText(s, x, y);
  }
}
