/**
 * NINJA effektlari (faqat chizish): ikki katananing chap-o'ng yoylari, aylanib uchuvchi shuriken va
 * ko'rinmaslik paytida qalpoq soyasidan porlab turgan ko'zlar. Ranglar skin theme'idan (skinFx.ts).
 */
import { px } from "./animation";
import { withAlpha } from "./hero";
import type { Bolt, Player } from "./player";
import { DEFAULT_THEME, type SkinTheme } from "./skinFx";

const SHINOBI = DEFAULT_THEME.shinobi;

/**
 * Ikki katana yoyi: o'ng qilich yuqoridan pastga, chap qilich pastdan yuqoriga kesadi (yo'nalishi
 * almashadi). Orqadan zarba — yoy qalinroq, qizil marjon chekkali.
 */
export function renderTwinArc(
  c: CanvasRenderingContext2D,
  p: Pick<
    Player,
    "attackTimer" | "attackTime" | "fx" | "fy" | "blade" | "reach" | "x" | "y" | "ambushHit"
  >,
  T: SkinTheme = SHINOBI,
) {
  if (p.attackTimer <= 0) return;
  const k = Math.max(0, Math.min(1, p.attackTimer / p.attackTime));
  const ang = Math.atan2(p.fy, p.fx);
  const dir = p.blade ? -1 : 1;
  const half = 1.0;
  const r = p.reach * 1.05;
  const prog = Math.min(1, (1 - k) * 1.8);
  const head = ang - dir * half + dir * 2 * half * prog;
  const tail = head - dir * Math.min(2 * half * prog, 1.1);
  const strong = p.ambushHit > 1;
  c.save();
  c.strokeStyle = withAlpha(strong ? T.accent : T.inner, (strong ? 0.75 : 0.45) * k + 0.1);
  c.lineWidth = strong ? 3 : 2;
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

/** Shuriken: to'rt uchli po'lat yulduz, uchishda aylanadi; o'rtasida teshik. */
export function renderShuriken(
  c: CanvasRenderingContext2D,
  b: Pick<Bolt, "x" | "y" | "power">,
  time: number,
  T: SkinTheme = SHINOBI,
) {
  const strong = (b.power ?? 1) > 1;
  const a = time * 24 + b.x * 0.05;
  const x = Math.round(b.x),
    y = Math.round(b.y);
  if (strong) {
    c.fillStyle = withAlpha(T.accent, 0.35);
    c.beginPath();
    c.arc(x, y, 5, 0, Math.PI * 2);
    c.fill();
  }
  // ikki holat: "+" va "x" — aylanish
  const diag = Math.floor(a / (Math.PI / 4)) % 2 === 1;
  const arms: readonly (readonly [number, number])[] = diag
    ? [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ]
    : [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
  for (const [dx, dy] of arms) {
    px(c, T.rim, x + dx, y + dy, 1, 1);
    px(c, T.glint, x + dx * 2, y + dy * 2, 1, 1);
    if (!diag) px(c, T.rim, x + dx * 3, y + dy * 3, 1, 1);
  }
  px(c, T.ink, x, y, 1, 1);
}

/**
 * Ko'rinmaslik: Ninja zo'rg'a ko'rinadi, lekin o'yinchi uni yo'qotmasin — qalpoq soyasidan ikki
 * qizil ko'z milt-milt qiladi; orqadan zarba tayyor ekanini bildiradi.
 */
export function renderVanishEyes(
  c: CanvasRenderingContext2D,
  p: Pick<Player, "x" | "y" | "fx">,
  time: number,
  T: SkinTheme = SHINOBI,
) {
  const on = Math.floor(time * 6) % 3 !== 0;
  const dir = p.fx < 0 ? -1 : 1;
  const x = Math.round(p.x) + dir,
    y = Math.round(p.y) - 7;
  px(c, withAlpha(T.accent, on ? 0.95 : 0.5), x, y, 1, 1);
  px(c, withAlpha(T.accent, on ? 0.95 : 0.5), x + dir * 3, y, 1, 1);
}
