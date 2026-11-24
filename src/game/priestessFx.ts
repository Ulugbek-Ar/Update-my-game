/**
 * ROHIBA effektlari (faqat chizish): kaft zarbasining qisqa oltin nur to'lqini (chap-o'ng
 * almashinib), NUR KAFTI — oldinga uzun oltin nur yo'lagi va MUQADDAS QADAM izi (yerda yonib turuvchi
 * oltin nuqtalar). Ranglar skin theme'idan (skinFx.ts). Math.random yo'q.
 */
import { px } from "./animation";
import { withAlpha } from "./hero";
import { BEAM_TIME, BEAM_W, TRAIL_R, type Player, type TrailDot } from "./player";
import { DEFAULT_THEME, type SkinTheme } from "./skinFx";

const PRIESTESS = DEFAULT_THEME.priestess;

/**
 * Kaft to'lqini: qarab turgan tomonga qisqa oltin yarim oy, kaft tomoniga qarab biroz yuqori/pastda
 * (o'ng kaft — yuqoriroq, chap kaft — pastroq), uzoqlashgani sari kengayib so'nadi.
 */
export function renderPalmWave(
  c: CanvasRenderingContext2D,
  p: Pick<Player, "attackTimer" | "attackTime" | "fx" | "fy" | "palm" | "reach" | "x" | "y">,
  T: SkinTheme = PRIESTESS,
) {
  if (p.attackTimer <= 0) return;
  const k = Math.max(0, Math.min(1, p.attackTimer / p.attackTime));
  const prog = 1 - k;
  const side = p.palm ? 2 : -2;
  const ang = Math.atan2(p.fy, p.fx);
  const d = 6 + p.reach * 0.75 * prog;
  const cx = p.x + p.fx * d - p.fy * side,
    cy = p.y - 2 + p.fy * d + p.fx * side;
  const r = 5 + prog * 5;
  c.save();
  c.strokeStyle = withAlpha(T.accent, 0.5 * k + 0.2);
  c.lineWidth = 3;
  c.beginPath();
  c.arc(cx - p.fx * r, cy - p.fy * r, r, ang - 0.9, ang + 0.9);
  c.stroke();
  c.strokeStyle = withAlpha(T.glow, 0.8 * k + 0.2);
  c.lineWidth = 1;
  c.beginPath();
  c.arc(cx - p.fx * r, cy - p.fy * r, r, ang - 0.8, ang + 0.8);
  c.stroke();
  c.restore();
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
    c.fillStyle = withAlpha(T.accent, 0.22 * a);
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
    c.fillStyle = withAlpha(T.glow, 0.5 * a);
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
