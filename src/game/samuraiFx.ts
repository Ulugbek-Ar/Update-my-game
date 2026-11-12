/**
 * Samuray effektlari (faqat chizish, mexanikaga ta'sir qilmaydi): katana yoyi, IAI sirpanish izi,
 * belgilangan dushman ustidagi belgi, kechikkan kesik chiziqlari, mukammal chetlanishdagi pushti
 * vinyetka va "kritik tayyor" uchquni. Uslub — sakura: oq yadro, pushti chekka.
 *
 * Ranglar skin theme'dan (skinFx.ts): accent — pushti chekka, glow — porlash, edge — tig'ning oq
 * yadrosi, inner — ichki yoy. Skin almashsa (Tungi gul, Qor lotos, Qizil oy) o'zi mos keladi.
 */
import { ROOM, px } from "./animation";
import { withAlpha } from "./hero";
import { DEFAULT_THEME, type SkinTheme } from "./skinFx";
import type { Player } from "./player";

const SAMURAI = DEFAULT_THEME.samurai;

/** Kechikkan IAI kesigi: dushman ustidan o'tgan qiya chiziq */
export interface Cut {
  x: number;
  y: number;
  /** Chiziq burchagi (rad) va yarim uzunligi */
  a: number;
  len: number;
  life: number;
  /** Egasining skin ranglari (onlayn: boshqa Samuray) */
  theme?: SkinTheme;
}

/** IAI sirpanish izi: boshlanish nuqtasidan oxirigacha so'nuvchi chiziq */
export interface Streak {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  theme?: SkinTheme;
}

export const CUT_LIFE = 0.28;
export const STREAK_LIFE = 0.38;

/** Kesik: birinchi 30% da uchidan uchiga "chiziladi", so'ng so'nadi. Oq yadro, pushti chekka. */
export function renderCut(c: CanvasRenderingContext2D, k: Cut, T: SkinTheme = k.theme ?? SAMURAI) {
  const age = 1 - k.life / CUT_LIFE;
  const grow = Math.min(1, age / 0.3);
  const a = Math.min(1, (1 - age) * 1.8);
  const ux = Math.cos(k.a),
    uy = Math.sin(k.a);
  const x0 = k.x - ux * k.len,
    y0 = k.y - uy * k.len;
  const x1 = x0 + ux * k.len * 2 * grow,
    y1 = y0 + uy * k.len * 2 * grow;
  c.save();
  c.lineCap = "butt";
  c.strokeStyle = withAlpha(T.accent, 0.75 * a);
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
  c.strokeStyle = withAlpha(T.edge, a);
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
  c.restore();
}

/** Sirpanish izi: ingichka oq chiziq va uning atrofida pushti nur; orqadan oldinga so'nadi. */
export function renderStreak(
  c: CanvasRenderingContext2D,
  s: Streak,
  T: SkinTheme = s.theme ?? SAMURAI,
) {
  const k = Math.max(0, s.life / STREAK_LIFE);
  // dumi qisqarib boradi: boshlanish nuqtasi oxiriga yaqinlashadi
  const t = 1 - k;
  const x1 = s.x1 + (s.x2 - s.x1) * t * 0.85,
    y1 = s.y1 + (s.y2 - s.y1) * t * 0.85;
  c.save();
  c.strokeStyle = withAlpha(T.accent, 0.45 * k);
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(s.x2, s.y2);
  c.stroke();
  c.strokeStyle = withAlpha(T.glow, 0.85 * k);
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(s.x2, s.y2);
  c.stroke();
  c.restore();
}

/** Belgilangan (hali kesilmagan) dushman ustidagi belgi: miltillovchi kichik pushti xoch. */
export function renderMark(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  T: SkinTheme = SAMURAI,
) {
  const on = Math.floor(time * 16) % 2 === 0;
  const col = on ? T.glow : T.accent;
  const bx = Math.round(x),
    by = Math.round(y);
  for (let i = -2; i <= 2; i++) {
    px(c, col, bx + i, by + i, 1, 1);
    px(c, col, bx + i, by - i, 1, 1);
  }
}

/**
 * Katana yoyi: ingichka va tez. Komboning 1-zarbasi yuqoridan pastga, 2-si teskari, 3-si — keng
 * yoy (deyarli yarim aylana). Yoy zarba davomida boshidan oxirigacha "o'tadi" va so'nadi.
 */
export function renderKatanaArc(c: CanvasRenderingContext2D, p: Player, T: SkinTheme = SAMURAI) {
  if (p.attackTimer <= 0) return;
  const k = Math.max(0, Math.min(1, p.attackTimer / p.attackTime));
  const ang = Math.atan2(p.fy, p.fx);
  const wide = p.comboStep === 2;
  const dir = p.comboStep === 1 ? -1 : 1;
  const half = wide ? 1.9 : 1.15;
  const r = p.reach * (wide ? 1.3 : 1.05);
  const prog = Math.min(1, (1 - k) * 1.7);
  const head = ang - dir * half + dir * 2 * half * prog;
  // dumi boshdan 1.3 rad orqada (keng yoyda uzunroq)
  const tail = head - dir * Math.min(2 * half * prog, wide ? 2.2 : 1.3);
  c.save();
  c.strokeStyle = withAlpha(T.inner, 0.55 * k + 0.1);
  c.lineWidth = wide ? 3 : 2;
  c.beginPath();
  c.arc(p.x, p.y - 2, r - 1, tail, head, dir < 0);
  c.stroke();
  c.strokeStyle = withAlpha(T.edge, 0.85 * k + 0.15);
  c.lineWidth = 1;
  c.beginPath();
  c.arc(p.x, p.y - 2, r, tail, head, dir < 0);
  c.stroke();
  c.restore();
}

/** Mukammal chetlanish: vaqt sekinlashganda ekran chetida pushti vinyetka (k: 0..1). */
export function renderFocus(c: CanvasRenderingContext2D, k: number, T: SkinTheme = SAMURAI) {
  if (k <= 0) return;
  const g = c.createRadialGradient(ROOM.w / 2, ROOM.h / 2, 70, ROOM.w / 2, ROOM.h / 2, 200);
  g.addColorStop(0, withAlpha(T.accent, 0));
  g.addColorStop(1, withAlpha(T.accent, 0.3 * Math.min(1, k)));
  c.fillStyle = g;
  c.fillRect(0, 0, ROOM.w, ROOM.h);
}

/** Keyingi zarba kritik: Samuray atrofida aylanuvchi ikki uchqun (to'rt nurli yulduzcha). */
export function renderCritReady(
  c: CanvasRenderingContext2D,
  p: Pick<Player, "x" | "y">,
  time: number,
  T: SkinTheme = SAMURAI,
) {
  for (let i = 0; i < 2; i++) {
    const a = time * 5 + i * Math.PI;
    const x = Math.round(p.x + Math.cos(a) * 11),
      y = Math.round(p.y - 3 + Math.sin(a) * 6);
    px(c, T.glow, x - 1, y, 3, 1);
    px(c, T.glow, x, y - 1, 1, 3);
    px(c, T.edge, x, y, 1, 1);
  }
}
