/**
 * Gildiya gerbi — kod bilan chiziladigan piksel rasm: shakl (qalqon, bayroq, doira), 2 rang
 * (fon va belgi) va belgi (qilich, toj, ajdar...). Menyu oynalari (React canvas), olamdagi ism
 * yonidagi kichik belgi va Gildiya zalidagi bayroqlar shu fayldan chiziladi.
 */
import {
  DEFAULT_EMBLEM,
  EMBLEM_COLORS,
  EMBLEM_ICONS,
  EMBLEM_SHAPES,
  parseEmblem,
  type Emblem,
} from "@/account/guildRules";

type Ctx = CanvasRenderingContext2D;

/** Gerb o'lchami (mantiqiy piksel) */
export const EMBLEM_W = 16;
export const EMBLEM_H = 18;
/** Ism yonidagi kichik gerb */
export const MINI_W = 6;
export const MINI_H = 7;

const OUTLINE = "#120c1a";

/** Rangni och/to'q qilish: k > 0 — ochroq, k < 0 — to'qroq */
export function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) =>
    Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  const r = ch((n >> 16) & 255),
    g = ch((n >> 8) & 255),
    b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Shakl ichidami (16x18 to'rda) */
function inside(shape: number, x: number, y: number) {
  if (x < 0 || y < 0 || x >= EMBLEM_W || y >= EMBLEM_H) return false;
  const kind = EMBLEM_SHAPES[shape] ?? "shield";
  if (kind === "circle") {
    const dx = x - 7.5,
      dy = y - 9.5;
    return dx * dx + dy * dy <= 7.6 * 7.6;
  }
  if (kind === "banner") {
    // tepada xoda, pastda qaldirg'och dum
    if (y === 0) return x >= 0 && x <= 15;
    if (x < 1 || x > 14) return false;
    if (y <= 13) return y >= 1;
    const notch = y - 13;
    return y <= 17 && (x <= 7 - notch || x >= 8 + notch);
  }
  // qalqon: tekis tepa, tik yonlar, pastda uchli
  if (y < 1 || x < 1 || x > 14) return false;
  if (y <= 9) return true;
  const k = y - 9;
  return x >= 1 + Math.floor(k * 0.85) && x <= 14 - Math.floor(k * 0.85) && y <= 17;
}

/**
 * Belgilar 10x10: "#" — belgi rangi, "d" — belgi rangining to'qrog'i, "." — bo'sh.
 * Tartib EMBLEM_ICONS bilan bir xil (guildRules.ts).
 */
export const ICON_ART: Record<string, readonly string[]> = {
  sword: [
    "....##....",
    "....##....",
    "....#d....",
    "....#d....",
    "....#d....",
    "....#d....",
    ".########.",
    "....dd....",
    "....##....",
    "...####...",
  ],
  crown: [
    "..........",
    "#...##...#",
    "##..##..##",
    "###.##.###",
    "##########",
    "#d##dd##d#",
    "##########",
    "##########",
    "..........",
    "..........",
  ],
  dragon: [
    ".##.......",
    "..###.....",
    "..####.##.",
    "...#######",
    "..####d#.#",
    ".#####....",
    "######....",
    "##.####...",
    "#...####..",
    "......###.",
  ],
  star: [
    "....##....",
    "....##....",
    "...####...",
    "##########",
    ".########.",
    "..######..",
    "..######..",
    ".###..###.",
    ".##....##.",
    "##......##",
  ],
  skull: [
    "..######..",
    ".########.",
    "##########",
    "##..##..##",
    "##..##..##",
    "####dd####",
    ".########.",
    "..######..",
    "..#.##.#..",
    "..........",
  ],
  sun: [
    "....##....",
    ".#..##..#.",
    "..######..",
    "..#dddd#..",
    "###dddd###",
    "###dddd###",
    "..#dddd#..",
    "..######..",
    ".#..##..#.",
    "....##....",
  ],
  moon: [
    "...####...",
    ".#####....",
    ".####.....",
    "####......",
    "####......",
    "####......",
    "####......",
    ".####.....",
    ".#####....",
    "...####...",
  ],
  flame: [
    "....#.....",
    "...##.....",
    "...###....",
    "..####.#..",
    "..#####...",
    ".###d###..",
    ".##ddd##..",
    ".##ddd###.",
    "..#ddd##..",
    "...####...",
  ],
  bolt: [
    ".....####.",
    "....####..",
    "...####...",
    "..#######.",
    ".....###..",
    "....###...",
    "...###....",
    "..###.....",
    "..##......",
    "..#.......",
  ],
  castle: [
    "#.#.##.#.#",
    "##########",
    ".########.",
    ".#d#dd#d#.",
    ".########.",
    ".###..###.",
    ".##dddd##.",
    ".##dddd##.",
    ".########.",
    "..........",
  ],
  wings: [
    "#........#",
    "##......##",
    "###....###",
    "####..####",
    "##d####d##",
    ".########.",
    "..######..",
    "...#..#...",
    "..........",
    "..........",
  ],
  wolf: [
    "#........#",
    "##......##",
    "###....###",
    "##########",
    "#d##..##d#",
    "##########",
    ".########.",
    "..##dd##..",
    "...####...",
    "....##....",
  ],
  phoenix: [
    "....##....",
    "...####...",
    "#..#dd#..#",
    "##.####.##",
    "##########",
    ".########.",
    "..######..",
    "...####...",
    "..##..##..",
    ".##....##.",
  ],
};

const iconAt = (i: number) => ICON_ART[EMBLEM_ICONS[i]?.id ?? "sword"] ?? ICON_ART["sword"]!;

function colorsOf(e: Emblem) {
  return {
    bg: EMBLEM_COLORS[e.bg]?.hex ?? "#2f6fd0",
    fg: EMBLEM_COLORS[e.fg]?.hex ?? "#ffcc33",
  };
}

const emblemOf = (s: string) => parseEmblem(s) ?? parseEmblem(DEFAULT_EMBLEM)!;

/**
 * To'liq gerb (16x18 mantiqiy piksel) — (x, y) chap-yuqori burchakdan, har piksel `scale` px.
 */
export function drawEmblem(c: Ctx, emblem: string, x: number, y: number, scale = 1) {
  const e = emblemOf(emblem);
  const { bg, fg } = colorsOf(e);
  const light = shade(bg, 0.35),
    dark = shade(bg, -0.35);
  const dot = (color: string, px: number, py: number) => {
    c.fillStyle = color;
    c.fillRect(x + px * scale, y + py * scale, scale, scale);
  };
  for (let py = 0; py < EMBLEM_H; py++)
    for (let px = 0; px < EMBLEM_W; px++) {
      if (inside(e.shape, px, py)) {
        // ichki chekka: yuqori-chap yorug', past-o'ng soya
        const edgeTL = !inside(e.shape, px - 1, py) || !inside(e.shape, px, py - 1);
        const edgeBR = !inside(e.shape, px + 1, py) || !inside(e.shape, px, py + 1);
        dot(edgeTL ? light : edgeBR ? dark : bg, px, py);
      } else if (
        inside(e.shape, px - 1, py) ||
        inside(e.shape, px + 1, py) ||
        inside(e.shape, px, py - 1) ||
        inside(e.shape, px, py + 1)
      )
        dot(OUTLINE, px, py);
    }
  // bayroqning xodasi (tepadagi qator) — yog'och
  if (EMBLEM_SHAPES[e.shape] === "banner")
    for (let px = 0; px < EMBLEM_W; px++) dot(px % 5 === 0 ? "#5a3a1e" : "#8a5a34", px, 0);
  // belgi: markazda, soyasi bilan
  const art = iconAt(e.icon);
  const ox = 3,
    oy = EMBLEM_SHAPES[e.shape] === "shield" ? 3 : EMBLEM_SHAPES[e.shape] === "banner" ? 3 : 4;
  const fgDark = shade(fg, -0.3);
  art.forEach((row, iy) =>
    [...row].forEach((ch, ix) => {
      if (ch === ".") return;
      const below = art[iy + 1]?.[ix + 1];
      if (!below || below === ".") dot(dark, ox + ix + 1, oy + iy + 1);
    }),
  );
  art.forEach((row, iy) =>
    [...row].forEach((ch, ix) => {
      if (ch === "#") dot(fg, ox + ix, oy + iy);
      else if (ch === "d") dot(fgDark, ox + ix, oy + iy);
    }),
  );
}

const MINI: Record<(typeof EMBLEM_SHAPES)[number], readonly string[]> = {
  shield: ["oooooo", "o####o", "o#ff#o", "o#ff#o", "o####o", ".o##o.", "..oo.."],
  banner: ["oooooo", "o####o", "o#ff#o", "o#ff#o", "o####o", "o#oo#o", "oo..oo"],
  circle: [".oooo.", "o####o", "o#ff#o", "o#ff#o", "o####o", ".oooo.", "......"],
};

/** Kichik gerb (6x7) — olamda ism yonida */
export function drawEmblemMini(c: Ctx, emblem: string, x: number, y: number) {
  const e = emblemOf(emblem);
  const { bg, fg } = colorsOf(e);
  const rows = MINI[EMBLEM_SHAPES[e.shape] ?? "shield"];
  rows.forEach((row, iy) =>
    [...row].forEach((ch, ix) => {
      if (ch === ".") return;
      c.fillStyle = ch === "o" ? OUTLINE : ch === "f" ? fg : bg;
      c.fillRect(Math.round(x + ix), Math.round(y + iy), 1, 1);
    }),
  );
}

/** Gerb ranglari (zal bayroqlari va reyting uchun) */
export function emblemColors(emblem: string) {
  return colorsOf(emblemOf(emblem));
}
