/**
 * ROHIBA effektlari (faqat chizish): MUQADDAS KAFT — oltin kaft izi, halqa, 3-zarbada ikki kaftli
 * to'lqin va tekkanda lotos chaqnashi (chap-o'ng almashinib), NUR KAFTI — oldinga uzun oltin nur
 * yo'lagi va MUQADDAS QADAM izi (yerda yonib turuvchi oltin nuqtalar). Ranglar skin theme'idan (skinFx.ts). Math.random yo'q.
 */
import { px } from "./animation";
import { withAlpha } from "./hero";
import {
  BEAM_TIME,
  BEAM_W,
  PALM_BURST,
  PALM_FX,
  TRAIL_R,
  type Player,
  type TrailDot,
} from "./player";
import { DEFAULT_THEME, type SkinTheme } from "./skinFx";

const PRIESTESS = DEFAULT_THEME.priestess;

/** Ochiq kaft shakli (mahalliy koordinatada: barmoqlar +x tomonga, kaft markazi 0,0) */
function palmPath(c: CanvasRenderingContext2D, s: number, thumb: number) {
  c.beginPath();
  // kaft
  c.ellipse(0, 0, 2.6 * s, 3 * s, 0, 0, Math.PI * 2);
  // to'rt barmoq: o'rtadagilari uzunroq
  for (let i = 0; i < 4; i++) {
    const oy = (i - 1.5) * 1.5 * s;
    const len = (i === 1 || i === 2 ? 4.2 : 3.4) * s;
    c.moveTo(2 * s + len, oy);
    c.ellipse(2 * s + len / 2, oy, len / 2, 0.65 * s, 0, 0, Math.PI * 2);
  }
  // bosh barmoq — yon tomonga qiya
  c.moveTo(0, thumb * 3 * s);
  c.ellipse(0.6 * s, thumb * 3.6 * s, 1.8 * s, 0.7 * s, thumb * 0.7, 0, Math.PI * 2);
}

/** Bitta oltin kaft izi: ichi shaffof oltin, cheti porloq; k — qolgan ulush (1 → 0) */
function palmPrint(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  ang: number,
  s: number,
  thumb: number,
  k: number,
  T: SkinTheme,
  fill: boolean,
) {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  palmPath(c, s, thumb);
  if (fill) {
    c.fillStyle = withAlpha(T.core, 0.7 * k);
    c.fill();
  }
  c.strokeStyle = withAlpha(T.accent, k);
  c.lineWidth = 1;
  c.stroke();
  c.restore();
}

type PalmBody = Pick<Player, "palmFxT" | "palmBurstT" | "palm" | "fx" | "fy" | "reach" | "x" | "y">;

/**
 * MUQADDAS KAFT (faqat chizish): har zarbada oldinga oltin KAFT IZI (ochiq kaft, 2–3 kadrda kattalashib
 * so'nadi) va undan tarqaluvchi yupqa oltin halqa; uchinchi ketma-ket zarbada — ikki kaftli keng nur
 * to'lqini. O'ng kaft yuqoriroq, chap kaft pastroq. Kamaytirilgan effektlarda: faqat kaft chizig'i.
 */
export function renderPalmStrike(
  c: CanvasRenderingContext2D,
  p: PalmBody,
  T: SkinTheme = PRIESTESS,
  reduced = false,
) {
  const ang = Math.atan2(p.fy, p.fx);
  const nx = -p.fy,
    ny = p.fx;
  const oy = p.y - 2;
  if (p.palmBurstT > 0) {
    const k = Math.max(0, Math.min(1, p.palmBurstT / PALM_BURST));
    const prog = 1 - k;
    const d = 10 + p.reach * 0.9 * prog;
    const cx = p.x + p.fx * d,
      cy = oy + p.fy * d;
    const s = 1.3 + prog * 0.9;
    c.save();
    // keng nur to'lqini: ikki yoy, oldinga siljib kengayadi
    c.lineCap = "round";
    c.strokeStyle = withAlpha(T.core, 0.75 * k);
    c.lineWidth = reduced ? 2 : 4;
    c.beginPath();
    c.arc(cx - p.fx * 10, cy - p.fy * 10, 10 + prog * 8, ang - 1.1, ang + 1.1);
    c.stroke();
    if (!reduced) {
      c.strokeStyle = withAlpha(T.glow, 0.9 * k);
      c.lineWidth = 1;
      c.beginPath();
      c.arc(cx - p.fx * 10, cy - p.fy * 10, 13 + prog * 10, ang - 0.95, ang + 0.95);
      c.stroke();
    }
    c.restore();
    // ikki kaft yonma-yon (bosh barmoqlar ichkariga)
    for (const sd of [-1, 1])
      palmPrint(c, cx + nx * sd * 6 * s, cy + ny * sd * 6 * s, ang, s, -sd, k, T, !reduced);
  }
  if (p.palmFxT <= 0) return;
  const k = Math.max(0, Math.min(1, p.palmFxT / PALM_FX));
  const prog = 1 - k;
  const side = p.palm ? 2 : -2;
  const d = 8 + p.reach * 0.6 * prog;
  const cx = p.x + p.fx * d + nx * side,
    cy = oy + p.fy * d + ny * side;
  // kaft iziidan tarqaluvchi yupqa oltin halqa
  if (!reduced) {
    c.strokeStyle = withAlpha(T.accent, 0.85 * k);
    c.lineWidth = 1;
    c.beginPath();
    c.arc(cx, cy, 4 + prog * 14, 0, Math.PI * 2);
    c.stroke();
  }
  palmPrint(c, cx, cy, ang, 1.05 + prog * 0.6, p.palm ? 1 : -1, k, T, !reduced);
}

/** Kaft dushmanga tegdi: kichik oltin lotos bargi chaqnashi (o'ynash effektlari ro'yxatiga) */
export interface LotusFlash {
  x: number;
  y: number;
  life: number;
  rot: number;
}
export const LOTUS_LIFE = 0.26;

export function renderLotusFlashes(
  c: CanvasRenderingContext2D,
  list: readonly LotusFlash[],
  T: SkinTheme = PRIESTESS,
  reduced = false,
) {
  for (const f of list) {
    const k = Math.max(0, Math.min(1, f.life / LOTUS_LIFE));
    const r = 3 + (1 - k) * 6;
    const n = reduced ? 3 : 5;
    c.save();
    c.translate(f.x, f.y);
    c.rotate(f.rot);
    c.beginPath();
    for (let i = 0; i < n; i++) {
      // yuqoriga ochilgan yelpig'ich bargi
      const an = -Math.PI / 2 + (i - (n - 1) / 2) * (reduced ? 0.7 : 0.55);
      const ex = Math.cos(an) * r,
        ey = Math.sin(an) * r;
      c.moveTo(0, 0);
      c.quadraticCurveTo(Math.cos(an + 0.4) * r * 0.7, Math.sin(an + 0.4) * r * 0.7, ex, ey);
      c.quadraticCurveTo(Math.cos(an - 0.4) * r * 0.7, Math.sin(an - 0.4) * r * 0.7, 0, 0);
    }
    c.fillStyle = withAlpha(T.core, 0.65 * k);
    c.fill();
    c.strokeStyle = withAlpha(T.accent, k);
    c.lineWidth = 1;
    c.stroke();
    c.restore();
    if (!reduced) px(c, withAlpha(T.glint, k), f.x - 1, f.y - 1, 2, 2);
  }
}

/**
 * NUR KAFTI: tanadan oldinga uzun nur yo'lagi (beamBox bilan bir xil o'lcham): tashqi oltin,
 * ichi oq-oltin yadro; avval tez cho'ziladi, so'ng ingichkalashib so'nadi.
 */
export function renderBeam(
  c: CanvasRenderingContext2D,
  p: Pick<Player, "spinTimer" | "fx" | "fy" | "x" | "y" | "beamLen">,
  time: number,
  T: SkinTheme = PRIESTESS,
) {
  if (p.spinTimer <= 0) return;
  const k = Math.max(0, Math.min(1, p.spinTimer / BEAM_TIME));
  const grow = Math.min(1, (1 - k) * 4 + 0.25);
  const len = p.beamLen * grow;
  const x0 = p.x + p.fx * 6,
    y0 = p.y - 2 + p.fy * 6;
  const x1 = x0 + p.fx * len,
    y1 = y0 + p.fy * len;
  const w = BEAM_W * (0.45 + 0.55 * k);
  c.save();
  c.lineCap = "round";
  c.strokeStyle = withAlpha(T.accent, 0.45 * k + 0.15);
  c.lineWidth = w;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
  c.strokeStyle = withAlpha(T.glow, 0.85 * k + 0.15);
  c.lineWidth = Math.max(1, w * 0.35);
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
  c.restore();
  // nur bo'ylab yaltiroq nuqtalar
  for (let i = 1; i < 6; i++) {
    const s = ((i / 6 + time * 3) % 1) * len;
    px(c, withAlpha(T.glint, k), x0 + p.fx * s - p.fy * 2, y0 + p.fy * s + p.fx * 2, 1, 1);
  }
}

/**
 * Muqaddas iz: yerdagi oltin nuqtalar — yangi nuqtalar yorqinroq, so'nayotganlari xira va
 * kichrayadi; tepasida sekin miltillovchi uchqunlar (onlaynda ham shu funksiya).
 */
export function renderTrail(
  c: CanvasRenderingContext2D,
  trail: readonly TrailDot[],
  life: number,
  time: number,
  T: SkinTheme = PRIESTESS,
  reduced = false,
) {
  for (let i = 0; i < trail.length; i++) {
    const d = trail[i]!;
    const k = Math.max(0, Math.min(1, d.life / Math.max(0.01, life)));
    if (k <= 0) continue;
    const a = Math.min(1, d.life * 2);
    c.fillStyle = withAlpha(T.accent, 0.4 * a);
    c.beginPath();
    c.ellipse(
      d.x,
      d.y,
      TRAIL_R * (0.6 + 0.4 * k),
      TRAIL_R * 0.4 * (0.6 + 0.4 * k),
      0,
      0,
      Math.PI * 2,
    );
    c.fill();
    c.fillStyle = withAlpha(T.glow, 0.85 * a);
    c.beginPath();
    c.ellipse(d.x, d.y, 3 + 2 * k, 1.4 + k, 0, 0, Math.PI * 2);
    c.fill();
    if (!reduced && Math.floor(time * 6 + i) % 3 === 0)
      px(
        c,
        withAlpha(T.glint, 0.8 * a),
        d.x + ((i * 5) % 7) - 3,
        d.y - 3 - ((time * 8 + i) % 6),
        1,
        1,
      );
  }
}
