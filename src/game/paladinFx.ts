/**
 * Paladin effektlari (faqat chizish, mexanikaga ta'sir qilmaydi): SHANG yerdagi yorig'i va yo'lak
 * chaqnashi, zarb to'lqinlari, OSMON HUKMI yorug'lik ustuni va gangish yulduzchalari, QASAM aurasi.
 * Uslub — oltin + oq "muqaddas nur": oq yadro, oltin chekka va yengil porlash.
 */
import { px } from "./animation";
import { HERO_THEME, withAlpha } from "./hero";
import { SHANG_TIME, SHANG_W, SHANG_WINDUP, VOW_RADIUS, type Bolt, type Player } from "./player";

/** Yerdagi nurli yoriq (SHANG zarbasi yo'lagi bo'ylab) */
export interface Crack {
  x: number;
  y: number;
  fx: number;
  fy: number;
  len: number;
  life: number;
  seed: number;
}

/** Kengayib so'nuvchi zarb to'lqini (SHANG uchida kichik, OSMON HUKMIda katta) */
export interface Quake {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
}

export const CRACK_LIFE = 1.2;
export const QUAKE_LIFE = 0.45;

const T = HERO_THEME.paladin;
/** Muqaddas nur yadrosi */
const HOLY_WHITE = "#ffffff";
/** Yoriqning qorong'i chekkasi (iliq qora — oltin nur ajralib turadi) */
const CRACK_INK = "#1e1606";

/** Siniq chiziq: zarba yo'nalishi bo'ylab zigzag, ikki yonga mayda shoxlar. */
export function renderCrack(c: CanvasRenderingContext2D, k: Crack) {
  const a = Math.min(1, k.life / (CRACK_LIFE * 0.5));
  const nx = -k.fy,
    ny = k.fx;
  let rnd = k.seed;
  const r = () => {
    rnd = (rnd * 9301 + 49297) % 233280;
    return rnd / 233280;
  };
  for (let d = 0; d < k.len; d += 1) {
    const off = Math.round(Math.sin(d * 0.7 + k.seed) * 1.5);
    const x = k.x + k.fx * d + nx * off,
      y = k.y + k.fy * d + ny * off;
    px(c, withAlpha(CRACK_INK, 0.8 * a), x, y, 2, 2);
    // yoriq ichida muqaddas nur: oq yadro, oltin chekka
    if (d % 2 === 0) px(c, withAlpha(d % 4 === 0 ? T.glow : T.accent, a), x, y, 1, 1);
    if (r() < 0.12) {
      const s = r() < 0.5 ? -1 : 1;
      for (let b = 1; b < 4; b++)
        px(c, withAlpha(CRACK_INK, 0.7 * a), x + nx * s * b, y + ny * s * b, 1, 1);
    }
  }
}

/** Zarb to'lqini: oltin chekkali, oq yadroli kengayuvchi halqa va ichida yengil porlash. */
export function renderQuake(c: CanvasRenderingContext2D, q: Quake) {
  const k = 1 - q.life / q.max;
  const r = q.r * (0.35 + 0.65 * k);
  c.save();
  c.fillStyle = withAlpha(T.glow, 0.12 * (1 - k));
  c.beginPath();
  c.ellipse(q.x, q.y, r, r * 0.7, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = withAlpha(T.accent, 0.9 * (1 - k));
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(q.x, q.y, r, r * 0.7, 0, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = withAlpha(HOLY_WHITE, 0.95 * (1 - k));
  c.lineWidth = 1;
  c.beginPath();
  c.ellipse(q.x, q.y, r, r * 0.7, 0, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = withAlpha(T.glow, 0.6 * (1 - k));
  c.beginPath();
  c.ellipse(q.x, q.y, r * 0.75, r * 0.52, 0, 0, Math.PI * 2);
  c.stroke();
  c.restore();
}

/** QASAM: Paladin atrofida aylanuvchi oltin aura (oq yadroli halqa) va nishonga olish radiusi. */
export function renderVowAura(c: CanvasRenderingContext2D, p: Player, time: number) {
  const fade = Math.min(1, p.vowT / 0.5);
  c.save();
  c.fillStyle = withAlpha(T.glow, 0.14 * fade);
  c.beginPath();
  c.ellipse(p.x, p.y + 8, 16, 9, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = withAlpha(T.accent, (0.55 + 0.25 * Math.sin(time * 8)) * fade);
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(p.x, p.y + 8, 17, 10, 0, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = withAlpha(HOLY_WHITE, 0.5 * fade);
  c.lineWidth = 1;
  c.beginPath();
  c.ellipse(p.x, p.y + 8, 17, 10, 0, 0, Math.PI * 2);
  c.stroke();
  // nishon radiusi: uzuq-uzuq doira
  c.strokeStyle = withAlpha(T.glow, 0.28 * fade);
  c.lineWidth = 1;
  c.setLineDash([3, 4]);
  c.lineDashOffset = -time * 20;
  c.beginPath();
  c.arc(p.x, p.y, VOW_RADIUS, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([]);
  c.restore();
  // ko'tarilayotgan oq-oltin uchqunlar
  for (let i = 0; i < 6; i++) {
    const a = time * 2 + (i / 6) * Math.PI * 2;
    const h = (time * 18 + i * 7) % 24;
    const col = i % 2 ? T.accent : T.glow;
    px(c, withAlpha(col, (1 - h / 24) * fade), p.x + Math.cos(a) * 15, p.y + 8 - h, 1, 1);
  }
}

/**
 * OSMON HUKMI zaryadi: osmondan Paladinga tushayotgan yorug'lik ustuni (zaryad to'lgani sari yorqin).
 * top — ustun boshlanadigan y (xonada 0, ochiq olamda kamera tepasi).
 */
export function renderSkyColumn(c: CanvasRenderingContext2D, p: Player, time: number, top = 0) {
  if (p.charge <= 0.25) return;
  const k = Math.min(1, p.charge / p.chargeTime);
  const w = 6 + k * 8 + Math.sin(time * 30) * (k >= 1 ? 1.5 : 0);
  const y0 = Math.round(top),
    h = Math.round(p.y + 10 - top);
  if (h <= 0) return;
  c.save();
  const g = c.createLinearGradient(0, y0, 0, y0 + h);
  g.addColorStop(0, withAlpha(T.glow, 0));
  g.addColorStop(1, withAlpha(T.glow, 0.25 + 0.35 * k));
  c.fillStyle = g;
  c.fillRect(Math.round(p.x - w / 2), y0, Math.round(w), h);
  // oltin chekka va oq yadro
  c.fillStyle = withAlpha(T.accent, 0.15 + 0.3 * k);
  c.fillRect(Math.round(p.x - w / 2), y0, 1, h);
  c.fillRect(Math.round(p.x + w / 2) - 1, y0, 1, h);
  c.fillStyle = withAlpha(HOLY_WHITE, 0.2 + 0.3 * k);
  c.fillRect(Math.round(p.x - 1), y0, 2, h);
  c.restore();
}

/**
 * SHANG: tayyorgarlikda qilich atrofida porlash, zarba tushganda yo'lak bo'ylab qisqa oltin chaqnash
 * (zarba maydoni aynan shu — o'yinchi qayergacha yetishini ko'radi).
 */
export function renderWindupSparks(c: CanvasRenderingContext2D, p: Player, time: number) {
  if (p.slamT > 0) {
    const k = 1 - p.slamT / SHANG_WINDUP;
    const r = 3 + k * 4 + Math.sin(time * 40);
    const hx = p.x + (p.fx < 0 ? -2 : 2);
    c.save();
    c.fillStyle = withAlpha(T.accent, 0.3 + 0.35 * k);
    c.beginPath();
    c.arc(hx, p.y - 26, r + 1, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = withAlpha(HOLY_WHITE, 0.45 + 0.4 * k);
    c.beginPath();
    c.arc(hx, p.y - 26, Math.max(1, r * 0.55), 0, Math.PI * 2);
    c.fill();
    c.restore();
    return;
  }
  if (p.attackTimer <= 0 || p.spinning) return;
  const k = p.attackTimer / SHANG_TIME;
  const len = p.reach * 2;
  const horiz = p.fx !== 0;
  const w = horiz ? len : SHANG_W,
    h = horiz ? SHANG_W : len;
  const cx = p.x + p.fx * (len / 2 + 2),
    cy = p.y + p.fy * (len / 2 + 2);
  c.save();
  c.fillStyle = withAlpha(T.glow, 0.28 * k);
  c.fillRect(Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h));
  c.strokeStyle = withAlpha(T.accent, 0.7 * k);
  c.lineWidth = 1;
  c.strokeRect(
    Math.round(cx - w / 2) + 0.5,
    Math.round(cy - h / 2) + 0.5,
    Math.round(w) - 1,
    Math.round(h) - 1,
  );
  c.restore();
}

/** ZARB TO'LQINI: uchish yo'nalishiga qavariq o'roq — oltin chekka, oq yadro. */
export function renderShockwave(c: CanvasRenderingContext2D, b: Bolt) {
  const a = Math.atan2(b.vy, b.vx);
  const r = b.size / 2 + 2;
  c.save();
  c.lineCap = "butt";
  c.strokeStyle = withAlpha(T.accent, 0.5);
  c.lineWidth = 5;
  c.beginPath();
  c.arc(b.x - Math.cos(a) * 4, b.y - Math.sin(a) * 4, r, a - 1.1, a + 1.1);
  c.stroke();
  c.strokeStyle = withAlpha(T.glow, 0.95);
  c.lineWidth = 2;
  c.beginPath();
  c.arc(b.x - Math.cos(a) * 4, b.y - Math.sin(a) * 4, r, a - 1, a + 1);
  c.stroke();
  c.strokeStyle = withAlpha(HOLY_WHITE, 0.9);
  c.lineWidth = 1;
  c.beginPath();
  c.arc(b.x - Math.cos(a) * 4, b.y - Math.sin(a) * 4, r, a - 0.8, a + 0.8);
  c.stroke();
  c.restore();
}

/**
 * OSMON HUKMIdan gangigan dushman ustida aylanuvchi gangish yulduzchalari: oq yadroli, oltin
 * nurli to'rt qirrali yulduzchalar (y — boshning tepasi).
 */
export function renderDazeStars(c: CanvasRenderingContext2D, x: number, y: number, time: number) {
  for (let i = 0; i < 3; i++) {
    const a = time * 6 + (i * Math.PI * 2) / 3;
    const sx = Math.round(x + Math.cos(a) * 8),
      sy = Math.round(y + Math.sin(a) * 2);
    px(c, T.accent, sx - 1, sy, 3, 1);
    px(c, T.accent, sx, sy - 1, 1, 3);
    px(c, HOLY_WHITE, sx, sy, 1, 1);
  }
}
