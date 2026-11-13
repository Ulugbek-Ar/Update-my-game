/**
 * JANG HISSI (v3.8) — nozik, faqat ko'rinish: zarba nuqtasida kichik oq uchqun, kritikda alohida
 * (kattaroq, oltin) chaqnash, terilgan tanga va yurak HUD'ga uchib boradi. Hit stop va ekran
 * silkinishi bu yerda YO'Q va o'zgartirilmaydi.
 *
 * Tasodifsiz (Math.random ishlatilmaydi — o'yin tasodifiga ta'sir qilmaydi), soni chegaralangan;
 * "Effektlarni kamaytirish"da faqat kritik chaqnashi qoladi (kichikroq), uchuvchi belgilar yo'q.
 * Oltin va yurak darhol hisobga qo'shiladi — uchish faqat ko'rsatadi.
 */
import { px } from "./animation";

export interface HitSpark {
  x: number;
  y: number;
  life: number;
  crit: boolean;
}

export type FlyKind = "coin" | "heart";

/** HUD'ga uchayotgan belgi: (x0, y0) dan (x1, y1) ga, t — o'tgan vaqt */
export interface Flyer {
  kind: FlyKind;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
}

export const SPARK_LIFE = 0.12;
export const CRIT_SPARK_LIFE = 0.22;
export const MAX_SPARKS = 10;
export const FLY_TIME = 0.42;
export const MAX_FLYERS = 12;

export class CombatFx {
  sparks: HitSpark[] = [];
  flyers: Flyer[] = [];
  /** Shu yangilanishda HUD'ga yetib kelganlar (HUD bir lahza "sakraydi") — o'quvchi bo'shatadi */
  arrived: FlyKind[] = [];

  /** Zarba uchquni. reduced — "Effektlarni kamaytirish": oddiy zarbada chiqmaydi. */
  spark(x: number, y: number, crit: boolean, reduced: boolean) {
    if (reduced && !crit) return;
    if (this.sparks.length >= MAX_SPARKS) this.sparks.shift();
    this.sparks.push({ x, y, crit, life: crit ? CRIT_SPARK_LIFE : SPARK_LIFE });
  }

  /** Terilgan tanga yoki yurak HUD'dagi joyiga uchadi. */
  fly(kind: FlyKind, x: number, y: number, tx: number, ty: number, reduced: boolean) {
    if (reduced) return;
    if (this.flyers.length >= MAX_FLYERS) this.flyers.shift();
    this.flyers.push({ kind, x0: x, y0: y, x1: tx, y1: ty, t: 0 });
  }

  update(dt: number) {
    for (const s of this.sparks) s.life -= dt;
    this.sparks = this.sparks.filter((s) => s.life > 0);
    for (const f of this.flyers) f.t += dt;
    this.flyers = this.flyers.filter((f) => {
      if (f.t < FLY_TIME) return true;
      this.arrived.push(f.kind);
      return false;
    });
  }

  clear() {
    this.sparks = [];
    this.flyers = [];
    this.arrived = [];
  }
}

/** Uchayotgan belgining joyi: avval sekin, so'ng tezlashadi; biroz yoy bo'ylab. */
export function flyerPos(f: Flyer) {
  const k = Math.min(1, f.t / FLY_TIME);
  const e = k * k;
  const arc = Math.sin(k * Math.PI) * 10;
  return { x: f.x0 + (f.x1 - f.x0) * e, y: f.y0 + (f.y1 - f.y0) * e - arc, k };
}

/** Zarba uchquni: to'rt nurli yulduzcha; kritikda — kattaroq, oltin, qiya nurlar va halqa bilan. */
export function renderSpark(c: CanvasRenderingContext2D, s: HitSpark, reduced = false) {
  const total = s.crit ? CRIT_SPARK_LIFE : SPARK_LIFE;
  const k = 1 - Math.max(0, s.life) / total;
  const big = s.crit && !reduced;
  const r = Math.round((big ? 3 : 2) + k * (big ? 6 : 3));
  const a = 1 - k * k;
  const x = Math.round(s.x),
    y = Math.round(s.y);
  c.globalAlpha = a;
  const col = s.crit ? "#ffe14d" : "#ffffff";
  px(c, col, x - r, y, r * 2 + 1, 1);
  px(c, col, x, y - r, 1, r * 2 + 1);
  if (k < 0.6) px(c, "#ffffff", x - 1, y - 1, 3, 3);
  if (big) {
    const d = Math.max(1, Math.round(r * 0.6));
    for (const [dx, dy] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      px(c, "#fff2a8", x + dx * d, y + dy * d, 1, 1);
      px(c, "#fff2a8", x + dx * (d - 1), y + dy * (d - 1), 1, 1);
    }
    c.strokeStyle = `rgba(255,225,77,${a * 0.7})`;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(s.x, s.y, r + 2, 0, Math.PI * 2);
    c.stroke();
  }
  c.globalAlpha = 1;
}

/**
 * Sandiq ochilishi: qopqoq ochilgach qisqa "sakrash" (masshtab) va tepaga yoyiluvchi oltin nurlar.
 * t — ochilgandan beri o'tgan vaqt (s). [1, 1] va 0 — effekt yo'q.
 */
export function chestPop(t: number): readonly [number, number] {
  if (t < 0 || t >= 0.25) return [1, 1];
  const s = Math.sin((t / 0.25) * Math.PI);
  return [1 + 0.14 * s, 1 - 0.1 * s + 0.2 * s * (t / 0.25)];
}

export const CHEST_RAYS = 5;
export const CHEST_RAY_TIME = 0.75;

/** Sandiqdan chiqqan nurlar: (x, y) — sandiq og'zi. */
export function renderChestRays(c: CanvasRenderingContext2D, x: number, y: number, t: number) {
  if (t < 0 || t >= CHEST_RAY_TIME) return;
  const k = t / CHEST_RAY_TIME;
  const len = 6 + 16 * Math.min(1, k * 2.5);
  const a = (1 - k) * 0.55;
  c.strokeStyle = `rgba(255,224,120,${a})`;
  c.lineWidth = 2;
  for (let i = 0; i < CHEST_RAYS; i++) {
    // tepaga yelpig'ich: -150° .. -30°, asta aylanadi
    const ang = -Math.PI / 2 + (i - (CHEST_RAYS - 1) / 2) * 0.5 + Math.sin(t * 3 + i) * 0.06;
    c.beginPath();
    c.moveTo(x + Math.cos(ang) * 4, y + Math.sin(ang) * 4);
    c.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    c.stroke();
  }
}
