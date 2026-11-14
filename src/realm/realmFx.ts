/**
 * ONLAYN OLAM VIZUAL QATLAMI (v3.8) — faqat klientdagi chizish: server mantig'i, protokol va
 * trafik o'zgarmaydi. Portallar ichida uchqunlar aylanadi va darvoza porlaydi, gildiya bayrog'i
 * to'lqinlanadi, chat pufakchalari yumshoq paydo bo'lib so'nadi. Hammasi vaqtdan hisoblanadi.
 */
import { px } from "@/game/animation";

/** Chat pufakchasi ko'rinadigan vaqt (client.ts shu qiymatdan sanaydi), paydo bo'lish va so'nish */
export const BUBBLE_TIME = 3;
export const BUBBLE_IN = 0.16;
export const BUBBLE_OUT = 0.3;

/**
 * Pufakcha ko'rinishi: t — qolgan vaqt (BUBBLE_TIME dan 0 gacha). Boshida kichrayib-pastdan
 * ko'tarilib paydo bo'ladi, oxirida so'nadi. reduced — darhol, harakatsiz.
 */
export function bubbleLook(t: number, reduced = false) {
  if (reduced) return { alpha: 1, rise: 0, scale: 1 };
  const kin = Math.min(1, Math.max(0, (BUBBLE_TIME - t) / BUBBLE_IN));
  const kout = Math.min(1, Math.max(0, t / BUBBLE_OUT));
  const e = 1 - (1 - kin) ** 2;
  return { alpha: Math.min(e, kout), rise: Math.round((1 - e) * 4), scale: 0.7 + 0.3 * e };
}

/** Portal ichida aylanuvchi uchqunlar soni */
export const PORTAL_SPARKS = 6;

/** i-uchqunning portal markaziga nisbatan joyi: ikki halqa qarama-qarshi tomonga aylanadi. */
export function portalSpark(i: number, time: number): readonly [number, number] {
  const a = time * 2.4 * (i % 2 ? -1 : 1) + i * (Math.PI / 3);
  const r = 1.5 + (i % 3) * 1.2;
  return [Math.cos(a) * r * 1.3, Math.sin(a) * r * 2.4];
}

/** Portal: darvoza atrofida yumshoq porlash va ichida aylanuvchi uchqunlar. */
export function renderPortal(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  light: string,
  glow: string,
) {
  const pulse = Math.sin(time * 2.2);
  const g = c.createRadialGradient(x, y, 3, x, y, 24 + pulse * 2);
  g.addColorStop(0, glow);
  g.addColorStop(1, "rgba(0,0,0,0)");
  const alpha = c.globalAlpha;
  c.globalAlpha = alpha * (0.2 + 0.08 * pulse);
  c.fillStyle = g;
  c.fillRect(x - 26, y - 26, 52, 52);
  c.globalAlpha = alpha;
  for (let i = 0; i < PORTAL_SPARKS; i++) {
    const [dx, dy] = portalSpark(i, time);
    px(c, light, x + dx, y + dy, 1, 1);
  }
}

/**
 * Bayroq to'lqini: xodadan col px uzoqdagi bo'lakning vertikal siljishi (xoda yonida — 0, uchida —
 * eng katta). width — bayroq eni.
 */
export function flagWave(col: number, time: number, width: number) {
  const k = col / Math.max(1, width);
  // (-0 emas, aniq 0)
  return Math.round(Math.sin(time * 3.2 - col * 0.45) * 2.2 * k) || 0;
}

/** Bayroqni tik bo'laklarga bo'lib, har birini to'lqin bo'yicha siljitib chizadi. */
export function drawWaving(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  time: number,
  draw: () => void,
  strip = 2,
) {
  for (let col = 0; col < w; col += strip) {
    c.save();
    c.beginPath();
    c.rect(x + col, y - 4, strip, h + 8);
    c.clip();
    c.translate(0, flagWave(col, time, w));
    draw();
    c.restore();
  }
}
