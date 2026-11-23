/**
 * NINJA PORTRETI — SOYA BO'RONI cut-in kartasi uchun 96x96 piksel-art (faqat ko'rinish). Olddan,
 * simmetrik, beldan yuqori: qora qalpoq va niqob, faqat ko'z tirqishi — qalpoq soyasidan qizil
 * porlagan ikki ko'z; bo'yinda qizil sharf; orqada ikki katana X shaklida (dastalari yelkadan
 * yuqorida, uchlari yelka yonidan chiqadi); fonda — katta qizil oy. Anime emas: keskin siluet,
 * kam detal, kuchli kontrast.
 *
 * Soyalash portraitKit.ts bilan (yorug'lik yuqori-chapdan), o'ng chetda oy nuri — qizg'ish rim light.
 * Math.random yo'q — portret har safar aynan bir xil.
 *
 * Kadrlar: 0 — tinch, ko'zlar xira; 1 — ko'zlar yonadi (qizil nur yoyiladi); 2 — tig'larda
 * yaltirash va ko'zlardan gorizontal chaqnash.
 */
import { Pixels } from "./sprites";
import { domeNormal, inPolygon, overlay, put, segDist, shade, sym, type Pt } from "./portraitKit";

export const SHINOBI_PORTRAIT_GRID = 96;
export const SHINOBI_PORTRAIT_FRAMES = 3;

/**
 * Ranglar (indeks − 1): 1 siyoh; 2..5 qora mato; 6..9 qizil oy; 10 oy cheti; 11..13 po'lat;
 * 14 oq yaltirash; 15..17 qizil sharf va dasta o'rami; 18 ko'z nuri; 19 ko'z yadrosi;
 * 20 tirqish soyasi; 21 bronza garda; 22 oy nurining rim light'i.
 */
export const SHINOBI_PORTRAIT_COLORS = [
  "#050407",
  "#0e0c12",
  "#1a1720",
  "#2a2632",
  "#3e3a48",
  "#3a0a12",
  "#6a1220",
  "#9a1c2a",
  "#c83040",
  "#e85a5a",
  "#4a4e5a",
  "#8a90a0",
  "#d0d6e2",
  "#ffffff",
  "#5a0a14",
  "#9a1424",
  "#d8283a",
  "#ff3a4a",
  "#ffd0d0",
  "#070508",
  "#6a5a3a",
  "#7a2a36",
] as const;

const CLOTH = [2, 3, 4, 5] as const;
const MOON = [6, 7, 8, 9] as const;
const SCARF = [15, 16, 17] as const;

/** Simmetrik shakllar (chap yarmi, tepadan pastga) */
const SHOULDERS: Pt[] = sym([
  [36, 66],
  [26, 72],
  [17, 80],
  [12, 95],
]);
const MASK: Pt[] = sym([
  [30, 47],
  [29, 54],
  [33, 61],
  [40, 65],
]);

/** Katana: dasta (o'ram), garda va tig' — a dan b gacha (a — dasta uchi) */
function katana(p: Pixels, a: Pt, b: Pt) {
  const [ax, ay] = a;
  const len = Math.hypot(b[0] - ax, b[1] - ay);
  const ux = (b[0] - ax) / len,
    uy = (b[1] - ay) / len;
  const at = (d: number): Pt => [ax + ux * d, ay + uy * d];
  // tig': ikki tonli (yorug' qirra yuqorida)
  p.line(11, at(16), b, 3);
  p.line(12, at(16), b, 2);
  p.line(13, at(17), [b[0] - ux * 2, b[1] - uy * 2], 1);
  // dasta: qora o'ram ustida qizil olmos naqsh (qizil oy fonida aniq ko'rinsin)
  p.line(3, a, at(13), 4);
  for (let d = 2; d < 13; d += 3) {
    const [x, y] = at(d);
    put(p, 17, Math.round(x), Math.round(y));
    put(p, 16, Math.round(x + 1), Math.round(y));
  }
  // garda (tsuba): kichik po'lat
  const [gx, gy] = at(14.5);
  p.rect(11, Math.round(gx) - 2, Math.round(gy) - 2, 5, 5);
  p.rect(12, Math.round(gx) - 1, Math.round(gy) - 2, 2, 1);
}

export function shinobiPortraitPixels(frame = 0): Uint8Array {
  const n = SHINOBI_PORTRAIT_GRID;
  const p = new Pixels(n);
  const f = Math.max(0, Math.min(SHINOBI_PORTRAIT_FRAMES - 1, frame));

  // qizil oy: gumbaz bo'yicha soyalangan doira, bir necha krater
  const mx = 48,
    my = 42,
    mr = 40;
  const inMoon = (x: number, y: number) => Math.hypot(x - mx, y - my) < mr;
  shade(p, inMoon, [0, 0, 95, 95], domeNormal(mx, my, mr, mr), MOON, { rim: 10, lift: 0.1 });
  for (const [cx, cy, r] of [
    [30, 22, 5],
    [68, 28, 4],
    [24, 52, 3],
    [72, 58, 6],
    [56, 14, 3],
  ] as const)
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        if (Math.hypot(x - cx, y - cy) < r && inMoon(x, y))
          put(p, Math.hypot(x - cx + 1, y - cy + 1) < r - 1 ? 7 : 6, x, y);

  // ikki katana X shaklida (orqada): dastalar tepada, tig'lar yelka orqasidan pastga
  katana(p, [12, 6], [86, 90]);
  katana(p, [84, 6], [10, 90]);

  // yelka va gavda: qora kurtka, V yoqa burmasi
  const body = inPolygon(SHOULDERS);
  shade(p, body, [0, 60, 95, 95], (x, y) => [(x - 48) / 40, (y - 70) / 50 - 0.3], CLOTH, {
    rim: 22,
    lift: -0.15,
  });
  for (let y = 70; y < 95; y++) {
    const k = (y - 70) * 0.55;
    put(p, 5, Math.round(40 - k), y);
    put(p, 5, Math.round(56 + k), y);
    put(p, 3, Math.round(41 - k), y);
    put(p, 3, Math.round(55 + k), y);
  }

  // qalpoq: gumbaz
  const hood = (x: number, y: number) => ((x - 48) / 22) ** 2 + ((y - 44) / 25) ** 2 < 1;
  shade(p, hood, [20, 16, 76, 70], domeNormal(48, 42, 22, 26), CLOTH, { rim: 22, lift: -0.05 });
  // qalpoq choki (o'rtada, peshonadan tepaga)
  for (let y = 20; y < 36; y++) put(p, 2, 48, y);

  // ko'z tirqishi: qalpoq ichida chuqur soya, chetlari biroz pastga egilgan
  for (let x = 30; x <= 66; x++) {
    const d = Math.abs(x - 48);
    const top = 40 + Math.round((d / 18) ** 2 * 2);
    const bot = 46 - Math.round((d / 18) ** 2 * 1.5);
    for (let y = top; y <= bot; y++) put(p, 20, x, y);
    // qosh soyasi
    put(p, 2, x, top - 1);
  }

  // niqob: burun va og'izni yopadi, gorizontal burmalar
  const mask = inPolygon(MASK);
  shade(p, mask, [26, 47, 70, 66], domeNormal(48, 50, 18, 16), [3, 4, 5], { lift: -0.1 });
  for (const y of [53, 58]) for (let x = 36; x <= 60; x++) if (mask(x, y)) put(p, 2, x, y);
  // burun cho'qqisi (yorug')
  put(p, 5, 47, 49);
  put(p, 5, 48, 49);

  // qizil sharf: bo'yin atrofida, o'rtada tugun, ikki uchi pastga (simmetrik)
  for (let y = 63; y <= 70; y++)
    for (let x = 30; x <= 66; x++) {
      const w = 18 - (70 - y) * 0.6;
      if (Math.abs(x - 48) > w) continue;
      const t = y < 65 ? 2 : y > 68 ? 0 : 1;
      put(p, SCARF[t]!, x, y);
    }
  p.rect(15, 45, 70, 6, 3);
  p.rect(16, 46, 70, 4, 2);
  for (const s of [-1, 1]) {
    p.line(16, [48 + s * 3, 72], [48 + s * 8, 86], 3);
    p.line(17, [48 + s * 3, 72], [48 + s * 7, 82], 1);
  }

  const out = p.outlined();
  const o = overlay(out, n);

  // ko'zlar: qizil porlash; kadr oshgani sari kuchliroq
  for (const s of [-1, 1]) {
    const ex = 48 + s * 9;
    const ey = 43;
    for (let y = ey - 4; y <= ey + 4; y++)
      for (let x = ex - 8; x <= ex + 8; x++) {
        // bodomsimon: ichki burchak biroz pastroq (qahrli nigoh)
        const d = segDist(x, y, ex - 3, ey + (s < 0 ? -1 : 1) * 0, ex + 3, ey).d;
        const inSlit = out[y * n + x] === 20;
        if (!inSlit) continue;
        if (d < 1) o(x, y, 19, true);
        else if (d < 2) o(x, y, 18, true);
        else if (d < (f >= 1 ? 3.6 : 2.6)) o(x, y, 17, true);
      }
    // yonib turgan ko'z: qalpoq soyasiga qizil nur tushadi
    if (f >= 1)
      for (let x = ex - 6; x <= ex + 6; x++) {
        if (out[38 * n + x] === 2) o(x, 38, 15, true);
        if (out[48 * n + x] && out[48 * n + x] !== 20) o(x, 48, 15, true);
      }
  }

  if (f === 2) {
    // ko'zlardan gorizontal chaqnash
    for (const s of [-1, 1])
      for (let k = 0; k < 14; k++) o(48 + s * (14 + k), 43, k < 6 ? 19 : 18, true);
    // tig'larda yaltirash
    for (const [a, b] of [
      [
        [12, 6],
        [86, 90],
      ],
      [
        [84, 6],
        [10, 90],
      ],
    ] as const) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (const d of [19, 20, 21, 22, 96, 97, 98]) {
        const x = a[0] + ((b[0] - a[0]) / len) * d,
          y = a[1] + ((b[1] - a[1]) / len) * d;
        if (out[Math.round(y) * n + Math.round(x)] !== 1) o(x, y, 14, true);
      }
    }
  }
  return out;
}
