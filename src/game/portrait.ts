/**
 * QAHRAMON PORTRETLARI — super kartasi (cut-in) uchun katta piksel-art rasm. Sprite'lardek faqat
 * kod bilan chiziladi (sprites.ts dagi butun sonli rasterizator: rect/line/polygon/ellipse va siyoh
 * kontur) va qahramonning o'sha 5 rangli palitrasidan foydalanadi — skin palitrasi bilan ham
 * (skins.ts) o'zi mos keladi. Faqat ko'rinish.
 *
 * Yangi superli qahramon: PORTRAITS ga chizuvchi funksiya qo'shiladi.
 */
import type { Hero } from "./hero";
import { PALETTES, Pixels, type SpritePalette } from "./sprites";
import {
  KNIGHT_PORTRAIT_COLORS,
  KNIGHT_PORTRAIT_GRID,
  knightPortraitPixels,
} from "./knightPortrait";
import {
  PALADIN_PORTRAIT_GRID,
  paladinPortraitColors,
  paladinPortraitPixels,
} from "./paladinPortrait";

/** Portret to'ri (kvadrat). Kartada 2 baravar kattalashtirib chiziladi */
export const PORTRAIT_GRID = 64;

/**
 * Samuray qiz — anime cut-in uchun YAQIN PLAN yuz (3/4, o'ngga qaragan): peshonaga tushgan o'tkir
 * kokil, yon tutam, shamolda orqaga uchgan soch va qizil bog'ich, pushti yaltiroq halqa. Ko'zlar:
 * "closed" — yumuq (kipriklar pastga), aks holda keskin ochiq — pushti qorachiq, tik siyoh
 * qorachiq va oq yaltirash, qoshlar markazga egilgan (qat'iyat).
 * Ranglar: 1 — siyoh, 2 — soch, 3 — pushti, 4 — qizil, 5 — teri va oq.
 */
function samuraiPortrait(p: Pixels, variant: string) {
  // orqaga (chapga) uchgan uzun soch va dum
  p.polygon(2, [
    [30, 4],
    [12, 6],
    [1, 12],
    [0, 26],
    [4, 40],
    [1, 56],
    [16, 63],
    [24, 46],
    [24, 24],
  ]);
  p.polygon(2, [
    [12, 8],
    [0, 3],
    [0, 15],
  ]);
  p.rect(4, 10, 7, 4, 4);
  // boshning tepasi
  p.ellipse(2, 35, 19, 24, 17);
  // yuz: jag' chiziqi o'ngga-pastga, iyak o'ngda
  p.polygon(5, [
    [21, 22],
    [52, 20],
    [58, 30],
    [59, 40],
    [56, 49],
    [50, 57],
    [44, 61],
    [36, 60],
    [28, 54],
    [22, 46],
  ]);
  // yon tutam (quloq oldida)
  p.polygon(2, [
    [18, 22],
    [27, 24],
    [26, 40],
    [23, 55],
    [19, 62],
    [16, 44],
  ]);
  // kokil: soch chizig'i va har xil uzunlikdagi o'tkir tutamlar (biri ko'z ustiga tushadi)
  p.rect(2, 16, 13, 45, 5);
  for (const [l, r, tx, ty] of [
    [17, 26, 21, 35],
    [24, 31, 27, 29],
    [29, 36, 34, 33],
    [35, 41, 38, 27],
    [39, 46, 43, 31],
    [44, 50, 47, 27],
    [48, 55, 52, 30],
    [53, 61, 58, 26],
  ] as const)
    p.polygon(2, [
      [l, 17],
      [r, 17],
      [tx, ty],
    ]);
  // sochdagi pushti yaltiroq halqa
  p.line(3, [22, 10], [30, 6], 1);
  p.line(3, [30, 6], [44, 6], 1);
  p.line(3, [44, 6], [50, 9], 1);
  p.line(3, [24, 16], [29, 15], 1);
  p.line(3, [41, 15], [47, 16], 1);
  // burun, lab va yonoqlardagi pushti qizarish chiziqlari
  p.rect(1, 56, 44, 2, 1);
  p.line(1, [46, 52], [51, 51], 1);
  for (const x of [27, 30, 33, 48, 51]) p.rect(3, x, 45, 1, 1);
  if (variant === "closed") {
    // ko'zlar yumuq: pastga egilgan qalin kiprik chizig'i va kipriklar, xotirjam qoshlar
    p.line(1, [25, 31], [36, 31], 1);
    p.line(1, [45, 31], [54, 31], 1);
    p.line(1, [24, 37], [31, 39], 2);
    p.line(1, [31, 39], [38, 38], 2);
    p.line(1, [45, 38], [50, 39], 2);
    p.line(1, [50, 39], [55, 37], 2);
    for (const x of [26, 29, 32, 35, 47, 50, 53]) p.rect(1, x, 41, 1, 1);
    return;
  }
  // qat'iyatli qoshlar: markazga qarab pastga (kokil ustidan ko'rinadi)
  p.line(1, [24, 29], [36, 32], 1);
  p.line(1, [45, 32], [55, 29], 1);
  // yaqin ko'z: katta, qalin yuqori qovoq (tashqi burchagi baland), kiprik uchi
  p.line(1, [24, 33], [38, 35], 2);
  p.line(1, [22, 31], [25, 34], 1);
  p.rect(4, 28, 35, 8, 2);
  p.rect(3, 28, 37, 8, 4);
  p.rect(1, 30, 36, 4, 5);
  p.rect(4, 31, 38, 2, 2);
  p.rect(5, 28, 36, 2, 2);
  p.rect(5, 34, 39, 1, 1);
  p.line(1, [27, 41], [35, 41], 1);
  // uzoq ko'z: torroq, qovog'i tashqariga qarab ko'tariladi
  p.line(1, [45, 35], [55, 33], 2);
  p.line(1, [55, 32], [57, 30], 1);
  p.rect(4, 47, 35, 6, 2);
  p.rect(3, 47, 37, 6, 4);
  p.rect(1, 49, 36, 3, 5);
  p.rect(5, 47, 36, 2, 2);
  p.line(1, [47, 41], [53, 41], 1);
}

const PORTRAITS: Partial<Record<Hero, (p: Pixels, variant: string) => void>> = {
  samurai: samuraiPortrait,
};

/** Portret to'ri: Ritsar va Paladinda 96 (katta, batafsil), qolganlarda PORTRAIT_GRID */
export function portraitGrid(hero: Hero) {
  return hero === "knight"
    ? KNIGHT_PORTRAIT_GRID
    : hero === "paladin"
      ? PALADIN_PORTRAIT_GRID
      : PORTRAIT_GRID;
}

/** Paladin portreti kadrlari: tirqishdagi nur kuchayib boradi, toj yaltiraydi */
export const PALADIN_PORTRAIT_VARIANTS = ["", "bright", "blaze"] as const;

/** Ritsar portreti kadrlari (variant nomi → kadr): past, shamolda, tig' yaltirashi */
export const KNIGHT_PORTRAIT_VARIANTS = ["", "wind", "glint"] as const;

const hex2 = (v: number) => Math.round(v).toString(16).padStart(2, "0");
/** a va b ranglar aralashmasi (k — b ulushi) */
function mix(a: string, b: string, k: number) {
  const n = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) || 0;
  return `#${[0, 1, 2].map((i) => hex2(n(a, i) + (n(b, i) - n(a, i)) * k)).join("")}`;
}

/**
 * Portret ranglari (indeks − 1). Oddiy qahramonda — 5 rangli palitra. Paladinda — 5 rangdan
 * hosil qilingan 16 ton (paladinPortrait.ts, skin bilan ham). Ritsarda — o'z 16 rangi
 * (knightPortrait.ts); skin bilan siyoh va nur skin palitrasidan olinadi, kumush va mato skin
 * rangiga bo'yaladi (Oltin Ritsar — oltinroq, Muz Ritsar — muzdek), charm jigarrang qoladi.
 */
export function portraitColors(hero: Hero, palette?: SpritePalette): string[] {
  if (hero === "paladin") return paladinPortraitColors(palette?.colors ?? PALETTES.paladin);
  if (hero !== "knight") return [...(palette?.colors ?? PALETTES[hero])];
  const base: string[] = [...KNIGHT_PORTRAIT_COLORS];
  const pc = palette?.colors;
  if (!pc) return base;
  const at = (i: number) => pc[i] ?? base[i] ?? "#808080";
  return base.map((c, i) => {
    const idx = i + 1;
    if (idx === 1) return at(0);
    if (idx >= 2 && idx <= 6) return mix(c, at(3), 0.3);
    if (idx >= 7 && idx <= 10) return mix(c, at(idx <= 8 ? 1 : 2), 0.55);
    if (idx === 14) return at(3);
    if (idx === 15) return mix(c, at(4), 0.5);
    if (idx === 16) return mix(c, at(4), 0.5);
    return c;
  });
}

/**
 * Portret piksellari (0 — bo'sh, 1..5 — palitra ranglari), siyoh kontur bilan; yo'q — null.
 * variant — qahramonga xos holat (Samuray: "closed" — ko'zlar yumuq).
 */
export function portraitPixels(hero: Hero, variant = ""): Uint8Array | null {
  if (hero === "knight")
    return knightPortraitPixels(
      Math.max(
        0,
        KNIGHT_PORTRAIT_VARIANTS.indexOf(variant as (typeof KNIGHT_PORTRAIT_VARIANTS)[number]),
      ),
    );
  if (hero === "paladin")
    return paladinPortraitPixels(
      Math.max(
        0,
        PALADIN_PORTRAIT_VARIANTS.indexOf(variant as (typeof PALADIN_PORTRAIT_VARIANTS)[number]),
      ),
    );
  const draw = PORTRAITS[hero];
  if (!draw) return null;
  const p = new Pixels(PORTRAIT_GRID);
  draw(p, variant);
  return p.outlined();
}

const cache = new Map<string, HTMLCanvasElement>();

/**
 * Tayyor portret kanvasi (portraitGrid × portraitGrid), skin palitrasi bilan. Kesh kaliti —
 * qahramon va skin id. Portreti yo'q qahramon yoki kanvassiz muhit (sinov) — null.
 */
export function superPortrait(
  hero: Hero,
  palette?: SpritePalette,
  variant = "",
): HTMLCanvasElement | null {
  const key = `${hero}:${palette?.id ?? ""}:${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const data = portraitPixels(hero, variant);
  if (!data || typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const n = portraitGrid(hero);
  canvas.width = canvas.height = n;
  const raster = canvas.getContext("2d");
  if (!raster) return null;
  const colors = portraitColors(hero, palette);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const color = data[y * n + x];
      if (!color) continue;
      raster.fillStyle = colors[color - 1] ?? colors[0] ?? "#000000";
      raster.fillRect(x, y, 1, 1);
    }
  cache.set(key, canvas);
  return canvas;
}
