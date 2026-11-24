/**
 * BO'RI-QIZ VARVAR effektlari (faqat chizish): panja zarbasining uchta parallel tirnoq izi (chap-o'ng
 * almashinib), BO'RI SAKRASHI qo'nishidagi yer zarbasi halqasi va YOVVOYI YUGURISH ortidagi shamol
 * chiziqlari. Ranglar skin theme'idan (skinFx.ts). Math.random yo'q.
 */
import { px } from "./animation";
import { withAlpha } from "./hero";
import { LEAP_LAND, type Player } from "./player";
import { DEFAULT_THEME, type SkinTheme } from "./skinFx";
import { WOLF_FURY_EYES } from "./wolfSprites";

const WOLF = DEFAULT_THEME.wolf;

/**
 * Panja izi: qarab turgan tomonda uchta qiya tirnoq chizig'i — chap panja yuqoridan pastga, o'ng panja
 * pastdan yuqoriga; g'azabda chetlari qizil.
 */
export function renderClaw(
  c: CanvasRenderingContext2D,
  p: Pick<
    Player,
    "attackTimer" | "attackTime" | "fx" | "fy" | "reach" | "x" | "y" | "clawLeft" | "fury"
  >,
  T: SkinTheme = WOLF,
) {
  if (p.attackTimer <= 0) return;
  const k = Math.max(0, Math.min(1, p.attackTimer / p.attackTime));
  const prog = 1 - k;
  const side = p.clawLeft ? -1 : 1;
  // izning markazi: tana oldida, juda yaqin
  const cx = p.x + p.fx * (p.reach * 0.7),
    cy = p.y - 2 + p.fy * (p.reach * 0.7);
  // izning yo'nalishi: qarash tomoniga tik, kombo tomonga qarab qiya
  const tx = -p.fy + p.fx * 0.35 * side,
    ty = p.fx * side + p.fy * 0.35;
  const tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl,
    uy = ty / tl;
  const len = 5 + 5 * Math.min(1, prog * 2.5);
  c.save();
  c.lineCap = "round";
  for (let i = -1; i <= 1; i++) {
    const ox = p.fx * i * 2.5 + (p.fy ? i * 2.5 : 0),
      oy = p.fy * i * 2.5;
    const x0 = cx + ox - ux * len * side,
      y0 = cy + oy - uy * len * side;
    const x1 = cx + ox + ux * len * 0.6 * side,
      y1 = cy + oy + uy * len * 0.6 * side;
    c.strokeStyle = withAlpha(p.fury ? WOLF_FURY_EYES : T.accent, 0.7 * k + 0.2);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
    c.strokeStyle = withAlpha(T.glow, 0.9 * k + 0.1);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }
  c.restore();
}

/**
 * BO'RI SAKRASHI: havoda — yerda kichrayuvchi soya; qo'nishda — atrofga tarqaluvchi yer zarbasi
 * halqasi (radius leapR) va yoriq chiziqlari.
 */
export function renderLeap(
  c: CanvasRenderingContext2D,
  p: Pick<Player, "spinTimer" | "x" | "y" | "leapR">,
  T: SkinTheme = WOLF,
) {
  if (p.spinTimer <= 0) return;
  if (p.spinTimer > LEAP_LAND) {
    c.fillStyle = "rgba(0,0,0,0.25)";
    c.beginPath();
    c.ellipse(p.x, p.y + 12, 6, 2, 0, 0, Math.PI * 2);
    c.fill();
    return;
  }
  const k = Math.max(0, Math.min(1, p.spinTimer / LEAP_LAND));
  const r = p.leapR * (1.1 - k * 0.6);
  c.save();
  c.strokeStyle = withAlpha(T.accent, 0.4 + 0.5 * k);
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(p.x, p.y + 10, r, r * 0.45, 0, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = withAlpha(T.glow, 0.9 * k);
  c.lineWidth = 1;
  c.beginPath();
  c.ellipse(p.x, p.y + 10, r * 0.8, r * 0.36, 0, 0, Math.PI * 2);
  c.stroke();
  c.restore();
  // yer yoriqlari: oltita qisqa chiziq
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    for (let s = 3; s < r * 0.7; s += 2)
      px(
        c,
        withAlpha(T.ink, 0.6 * k),
        p.x + Math.cos(a) * s,
        p.y + 10 + Math.sin(a) * s * 0.45,
        1,
        1,
      );
  }
}

/** YOVVOYI YUGURISH: ortida uchta shamol chizig'i */
export function renderRush(
  c: CanvasRenderingContext2D,
  p: Pick<Player, "dashing" | "dashX" | "dashY" | "x" | "y">,
  time: number,
  T: SkinTheme = WOLF,
) {
  if (!p.dashing) return;
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * 5;
    const back = 8 + ((time * 60 + i * 5) % 6);
    const x = p.x - p.dashX * back - p.dashY * off,
      y = p.y - p.dashY * back + p.dashX * off;
    c.strokeStyle = withAlpha(i === 1 ? T.glow : T.accent, 0.7);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - p.dashX * 10, y - p.dashY * 10);
    c.stroke();
  }
}
