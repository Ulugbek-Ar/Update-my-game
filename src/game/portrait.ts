/**
 * QAHRAMON PORTRETLARI — super kartasi (cut-in) uchun katta piksel-art rasm (96x96). Sprite'lardek
 * faqat kod bilan chiziladi (har qahramonning o'z fayli: knightPortrait.ts, paladinPortrait.ts,
 * samuraiPortrait.ts) va ranglari qahramon palitrasidan hosil qilinadi — skin palitrasi bilan ham
 * (skins.ts) o'zi mos keladi. Faqat ko'rinish.
 *
 * Yangi superli qahramon: o'z portret fayli, portraitGrid/portraitColors/portraitPixels ga tarmoq.
 */
import type { Hero } from "./hero";
import { PALETTES, type SpritePalette } from "./sprites";
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
import { MAGE_PORTRAIT_COLORS, MAGE_PORTRAIT_GRID, magePortraitPixels } from "./magePortrait";
import {
  HUNTER_PORTRAIT_COLORS,
  HUNTER_PORTRAIT_GRID,
  hunterPortraitPixels,
} from "./hunterPortrait";
import {
  GUNNER_PORTRAIT_COLORS,
  GUNNER_PORTRAIT_GRID,
  gunnerPortraitPixels,
} from "./gunnerPortrait";
import {
  SAMURAI_PORTRAIT_GRID,
  samuraiPortraitColors,
  samuraiPortraitPixels,
} from "./samuraiPortrait";
import {
  SHINOBI_PORTRAIT_COLORS,
  SHINOBI_PORTRAIT_GRID,
  shinobiPortraitPixels,
} from "./shinobiPortrait";
import {
  PRIESTESS_PORTRAIT_COLORS,
  PRIESTESS_PORTRAIT_GRID,
  priestessPortraitPixels,
} from "./priestessPortrait";
import { WOLF_PORTRAIT_COLORS, WOLF_PORTRAIT_GRID, wolfPortraitPixels } from "./wolfPortrait";

/** Portret to'ri (kvadrat): Ritsar, Paladin va Samurayda 96 (katta, batafsil) */
export function portraitGrid(hero: Hero) {
  return hero === "knight"
    ? KNIGHT_PORTRAIT_GRID
    : hero === "samurai"
      ? SAMURAI_PORTRAIT_GRID
      : hero === "mage"
        ? MAGE_PORTRAIT_GRID
        : hero === "hunter"
          ? HUNTER_PORTRAIT_GRID
          : hero === "gunner"
            ? GUNNER_PORTRAIT_GRID
            : hero === "shinobi"
              ? SHINOBI_PORTRAIT_GRID
              : hero === "priestess"
                ? PRIESTESS_PORTRAIT_GRID
                : hero === "wolf"
                  ? WOLF_PORTRAIT_GRID
                  : PALADIN_PORTRAIT_GRID;
}

/** Paladin portreti kadrlari: tirqishdagi nur kuchayib boradi, toj yaltiraydi */
export const PALADIN_PORTRAIT_VARIANTS = ["", "bright", "blaze"] as const;

/** Samuray portreti kadrlari: ko'zlar yumuq → keskin ochiladi → chaqnash va gulbarglar */
export const SAMURAI_PORTRAIT_VARIANTS = ["closed", "open", "flash"] as const;

/** Ritsar portreti kadrlari (variant nomi → kadr): past, shamolda, tig' yaltirashi */
/** Sehrgar portreti kadrlari: tayoq ko'tariladi, kristall yorishadi, ko'zlar chaqnaydi */
export const MAGE_PORTRAIT_VARIANTS = ["", "raised", "flash"] as const;

export const KNIGHT_PORTRAIT_VARIANTS = ["", "wind", "glint"] as const;

/** Ovchi portreti kadrlari: ip tortiladi, ko'zlar yonadi, o'q uchi yaltiraydi va barglar uchadi */
export const HUNTER_PORTRAIT_VARIANTS = ["", "drawn", "flash"] as const;

/** Mergan portreti kadrlari: tinch, baraban aylanadi, tutun va gilzalar */
export const GUNNER_PORTRAIT_VARIANTS = ["", "spin", "smoke"] as const;

/** Ninja portreti kadrlari: ko'zlar yonadi → tig'larda yaltirash → sharf uchlari shamolda ko'tariladi */
export const SHINOBI_PORTRAIT_VARIANTS = ["", "glare", "flash"] as const;

/** Rohiba portreti kadrlari: ibodat (ko'zlar yumuq) → halo yonadi → ko'zlar ochiladi, kaftdan nur */
export const PRIESTESS_PORTRAIT_VARIANTS = ["", "glow", "light"] as const;

/** Varvar portreti kadrlari: sokin (ko'k ko'zlar) → g'azab (qizil ko'zlar) → oy yonadi, panjalar yaltiraydi */
export const WOLF_PORTRAIT_VARIANTS = ["", "fury", "moon"] as const;

const hex2 = (v: number) =>
  Math.round(Math.max(0, Math.min(255, v)))
    .toString(16)
    .padStart(2, "0");
const rgb = (h: string) => [0, 1, 2].map((i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) || 0);
/** a va b ranglar aralashmasi (k — b ulushi) */
function mix(a: string, b: string, k: number) {
  const x = rgb(a);
  const y = rgb(b);
  return `#${[0, 1, 2].map((i) => hex2(x[i]! + (y[i]! - x[i]!) * k)).join("")}`;
}
/** Nisbiy yorqinlik (0..1) */
function lum(h: string) {
  const [r, g, b] = rgb(h);
  return (0.299 * r! + 0.587 * g! + 0.114 * b!) / 255;
}

/**
 * Skin bo'yog'i: portret ranglari guruhi (indekslar 1 dan, from..to) skin palitrasining src rangiga
 * k ulushda aralashtiriladi. src — bitta indeks: hamma ton shu rangga (Ritsar naqshi); massiv —
 * TON SHKALASI: skin ranglaridan qorong'idan yorug'ga shkala tuziladi va guruhning har toni o'z
 * yorqinligidagi joyiga mos rangni oladi — soyalash (4–5 ton) saqlanadi. Guruhga kirmagan ranglar
 * (teri, ko'z oqi, siyoh kontur, fon, yog'och) o'zgarmaydi.
 */
interface SkinTint {
  from: number;
  to?: number;
  src: number | readonly number[];
  k: number;
  /** Ton shkalasidan olinadigan oraliq (0 — eng qorong'i, 1 — eng yorug'); standart [0.12, 0.92] */
  span?: readonly [number, number];
}

const g = (
  from: number,
  to: number,
  src: number | readonly number[],
  k: number,
  span?: readonly [number, number],
): SkinTint => (span ? { from, to, src, k, span } : { from, to, src, k });

/** Har qahramon portretining skin guruhlari (palitra: 0 siyoh, 1–3 asosiy/aksent, 4 yorug') */
const SKIN_TINTS: Partial<Record<Hero, readonly SkinTint[]>> = {
  // Ritsar: siyoh va nur skin palitrasidan, kumush va mato skin rangiga, charm jigarrang qoladi
  knight: [
    g(1, 1, 0, 1),
    g(2, 6, 3, 0.3),
    g(7, 8, 1, 0.55),
    g(9, 10, 2, 0.55),
    g(14, 14, 3, 1),
    g(15, 16, 4, 0.5),
  ],
  // Sehrgar: plash/shlyapa (to'n), qon-qizil astar, kristall, ko'z olovi va aura — skin rangida;
  // soqol biroz; teri, yog'och, tutun o'zgarmaydi
  mage: [
    g(2, 6, [1, 2], 0.8, [0.08, 0.55]),
    g(7, 10, [2], 0.9, [0.1, 0.62]),
    g(11, 15, [3], 0.3),
    g(24, 27, [2, 3], 0.85),
    g(28, 28, 2, 0.75),
    g(29, 29, 2, 0.3),
    g(30, 30, 2, 0.7),
    g(31, 31, 1, 0.6),
  ],
  // Ovchi: qalpoq va barglar asosiy rangda, charm skin charmida; ko'z nuri va rim light aksentda
  hunter: [
    g(2, 6, [1, 2], 0.8),
    g(7, 10, [3], 0.55),
    g(20, 22, [2], 0.5),
    g(27, 27, [2], 0.6),
    g(28, 30, [1, 2], 0.7),
  ],
  // Mergan: shlyapa-kamzul, plash, ro'mol va ko'z nuri skin rangida; teri, mo'ylov, po'lat qoladi
  gunner: [
    g(2, 6, [1], 0.7),
    g(7, 10, [2], 0.7),
    g(18, 21, [3], 0.85),
    g(28, 28, [3], 0.6),
    g(30, 30, [3], 0.6),
  ],
  // Ninja: qora mato, sharf va ko'z nuri skin rangida; qizil oy (fon), uning rim light'i, po'lat qoladi
  shinobi: [
    g(2, 6, [1, 2], 0.8),
    g(16, 19, [3], 0.85),
    g(20, 20, 3, 0.75),
    g(21, 21, 3, 0.3),
    g(25, 25, 3, 0.6),
  ],
  // Rohiba: libos, halo va oltin hoshiya skin rangida; teri, soch, lab qoladi
  priestess: [g(2, 5, [1, 2], 0.75), g(6, 10, [3], 0.8), g(11, 13, [3], 0.75)],
  // Bo'ri-qiz: po'lat zirh, mo'yna va oltin skin rangida; oy (fon), teri, soch, ko'zlar qoladi
  wolf: [g(6, 10, [1, 2], 0.9, [0.1, 0.95]), g(11, 13, [2], 0.7), g(14, 16, [3], 0.75)],
};

/** Skin ranglaridan qorong'idan yorug'ga ton shkalasi */
function skinRamp(src: readonly string[]) {
  const s = [...src].sort((a, b) => lum(a) - lum(b));
  const lo = s[0]!;
  const hi = s[s.length - 1]!;
  return [mix(lo, "#000000", 0.6), ...s, mix(hi, "#ffffff", s.length > 1 ? 0.4 : 0.6)];
}
function rampAt(ramp: readonly string[], t: number) {
  const f = Math.max(0, Math.min(1, t)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(f));
  return mix(ramp[i]!, ramp[i + 1]!, f - i);
}

/** Portret ranglarini skin palitrasiga bo'yash (SKIN_TINTS guruhlari bo'yicha) */
function skinTint(base: readonly string[], pc: readonly string[], tints: readonly SkinTint[]) {
  const out = [...base];
  const at = (i: number) => pc[i] ?? "#808080";
  for (const { from, to = from, src, k, span = [0.12, 0.92] } of tints) {
    const idx = Array.from({ length: to - from + 1 }, (_, j) => from - 1 + j).filter(
      (i) => i < base.length,
    );
    if (typeof src === "number") {
      for (const i of idx) out[i] = k >= 1 ? at(src) : mix(base[i]!, at(src), k);
      continue;
    }
    const ramp = skinRamp(src.map(at));
    const ls = idx.map((i) => lum(base[i]!));
    const lo = Math.min(...ls);
    const hi = Math.max(...ls);
    idx.forEach((i, j) => {
      // ko'p tonli guruh — o'z ichida qorong'idan yorug'ga; yakka ton — o'z yorqinligida
      const t =
        hi - lo > 0.02 ? span[0] + ((ls[j]! - lo) / (hi - lo)) * (span[1] - span[0]) : ls[j]!;
      out[i] = mix(base[i]!, rampAt(ramp, t), k);
    });
  }
  return out;
}

const BASE_COLORS: Partial<Record<Hero, readonly string[]>> = {
  knight: KNIGHT_PORTRAIT_COLORS,
  mage: MAGE_PORTRAIT_COLORS,
  hunter: HUNTER_PORTRAIT_COLORS,
  gunner: GUNNER_PORTRAIT_COLORS,
  shinobi: SHINOBI_PORTRAIT_COLORS,
  priestess: PRIESTESS_PORTRAIT_COLORS,
  wolf: WOLF_PORTRAIT_COLORS,
};

/**
 * Portret ranglari (indeks − 1). Paladinda — 5 rangdan hosil qilingan 16 ton (paladinPortrait.ts),
 * Samurayda — 27 ton (samuraiPortrait.ts). Boshqalarda — portretning o'z rang to'plami; skin bilan
 * kiyim/mato va aksent guruhlari skin palitrasiga bo'yaladi (SKIN_TINTS), teri, ko'z oqi, kontur va
 * fon o'zgarmaydi. Skinsiz (yoki standart palitra) — asl ranglar aynan.
 */
export function portraitColors(hero: Hero, palette?: SpritePalette): string[] {
  if (hero === "paladin") return paladinPortraitColors(palette?.colors ?? PALETTES.paladin);
  if (hero === "samurai") return samuraiPortraitColors(palette?.colors ?? PALETTES.samurai);
  const base = BASE_COLORS[hero];
  if (!base) return [...(palette?.colors ?? PALETTES[hero])];
  const pc = palette?.colors;
  const tints = SKIN_TINTS[hero];
  if (!pc || !tints || pc.every((c, i) => c === PALETTES[hero][i])) return [...base];
  return skinTint(base, pc, tints);
}

/**
 * Portret piksellari (0 — bo'sh, 1.. — portraitColors indeksi), siyoh kontur bilan; yo'q — null.
 * variant — qahramonga xos kadr nomi (*_PORTRAIT_VARIANTS); noma'lum — birinchi kadr.
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
  if (hero === "mage") {
    return magePortraitPixels(
      Math.max(
        0,
        MAGE_PORTRAIT_VARIANTS.indexOf(variant as (typeof MAGE_PORTRAIT_VARIANTS)[number]),
      ),
    );
  }
  if (hero === "hunter")
    return hunterPortraitPixels(
      Math.max(
        0,
        HUNTER_PORTRAIT_VARIANTS.indexOf(variant as (typeof HUNTER_PORTRAIT_VARIANTS)[number]),
      ),
    );
  if (hero === "gunner")
    return gunnerPortraitPixels(
      Math.max(
        0,
        GUNNER_PORTRAIT_VARIANTS.indexOf(variant as (typeof GUNNER_PORTRAIT_VARIANTS)[number]),
      ),
    );
  if (hero === "priestess")
    return priestessPortraitPixels(
      Math.max(
        0,
        PRIESTESS_PORTRAIT_VARIANTS.indexOf(
          variant as (typeof PRIESTESS_PORTRAIT_VARIANTS)[number],
        ),
      ),
    );
  if (hero === "wolf")
    return wolfPortraitPixels(
      Math.max(
        0,
        WOLF_PORTRAIT_VARIANTS.indexOf(variant as (typeof WOLF_PORTRAIT_VARIANTS)[number]),
      ),
    );
  if (hero === "shinobi")
    return shinobiPortraitPixels(
      Math.max(
        0,
        SHINOBI_PORTRAIT_VARIANTS.indexOf(variant as (typeof SHINOBI_PORTRAIT_VARIANTS)[number]),
      ),
    );
  if (hero === "samurai")
    return samuraiPortraitPixels(
      Math.max(
        0,
        SAMURAI_PORTRAIT_VARIANTS.indexOf(variant as (typeof SAMURAI_PORTRAIT_VARIANTS)[number]),
      ),
    );
  return null;
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

/** Har qahramon portretining kadr nomlari (super kartasi shu tartibda chizadi) */
export const PORTRAIT_FRAMES: Record<Hero, readonly string[]> = {
  knight: KNIGHT_PORTRAIT_VARIANTS,
  mage: MAGE_PORTRAIT_VARIANTS,
  hunter: HUNTER_PORTRAIT_VARIANTS,
  gunner: GUNNER_PORTRAIT_VARIANTS,
  paladin: PALADIN_PORTRAIT_VARIANTS,
  samurai: SAMURAI_PORTRAIT_VARIANTS,
  shinobi: SHINOBI_PORTRAIT_VARIANTS,
  priestess: PRIESTESS_PORTRAIT_VARIANTS,
  wolf: WOLF_PORTRAIT_VARIANTS,
};

/**
 * Super portretlarini oldindan tayyorlash (o'yin boshida): har kadr alohida bo'sh vaqtda yasaladi va
 * keshga tushadi — super boshlanganda (masalan Samurayning MING KESIMi) kadr tutilib qolmaydi.
 * Kanvassiz muhitda (sinov) hech narsa qilmaydi.
 */
export function prewarmPortraits(hero: Hero, palette?: SpritePalette) {
  if (typeof document === "undefined") return;
  const list = PORTRAIT_FRAMES[hero] ?? [];
  const later = (fn: () => void) =>
    typeof requestIdleCallback === "function"
      ? requestIdleCallback(fn, { timeout: 1200 })
      : setTimeout(fn, 50);
  let i = 0;
  const step = () => {
    if (i >= list.length) return;
    superPortrait(hero, palette, list[i++]);
    later(step);
  };
  later(step);
}
