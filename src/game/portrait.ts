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

/** Ninja portreti kadrlari: ko'zlar xira → qizil yonadi → tig'lar yaltiraydi, ko'zdan chaqnash */
export const SHINOBI_PORTRAIT_VARIANTS = ["", "glare", "flash"] as const;

/** Rohiba portreti kadrlari: ibodat (ko'zlar yumuq) → halo yonadi → ko'zlar ochiladi, kaftdan nur */
export const PRIESTESS_PORTRAIT_VARIANTS = ["", "glow", "light"] as const;

/** Varvar portreti kadrlari: sokin (ko'k ko'zlar) → g'azab (qizil ko'zlar) → oy yonadi, panjalar yaltiraydi */
export const WOLF_PORTRAIT_VARIANTS = ["", "fury", "moon"] as const;

const hex2 = (v: number) => Math.round(v).toString(16).padStart(2, "0");
/** a va b ranglar aralashmasi (k — b ulushi) */
function mix(a: string, b: string, k: number) {
  const n = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16) || 0;
  return `#${[0, 1, 2].map((i) => hex2(n(a, i) + (n(b, i) - n(a, i)) * k)).join("")}`;
}

/**
 * Portret ranglari (indeks − 1). Oddiy qahramonda — 5 rangli palitra. Paladinda — 5 rangdan
 * hosil qilingan 16 ton (paladinPortrait.ts), Samurayda — 27 ton (samuraiPortrait.ts), skin bilan ham. Ritsarda — o'z 16 rangi
 * (knightPortrait.ts); skin bilan siyoh va nur skin palitrasidan olinadi, kumush va mato skin
 * rangiga bo'yaladi (Oltin Ritsar — oltinroq, Muz Ritsar — muzdek), charm jigarrang qoladi.
 */
export function portraitColors(hero: Hero, palette?: SpritePalette): string[] {
  if (hero === "paladin") return paladinPortraitColors(palette?.colors ?? PALETTES.paladin);
  if (hero === "samurai") return samuraiPortraitColors(palette?.colors ?? PALETTES.samurai);
  // Sehrgar: yovuz sehrgarning o'z rang to'plami (skin palitrasi hozircha portretga ta'sir qilmaydi)
  if (hero === "mage") return [...MAGE_PORTRAIT_COLORS];
  // Ovchi va Mergan: portretning o'z rang to'plami (skin palitrasi portretga ta'sir qilmaydi)
  if (hero === "hunter") return [...HUNTER_PORTRAIT_COLORS];
  if (hero === "gunner") return [...GUNNER_PORTRAIT_COLORS];
  // Ninja: portretning o'z rang to'plami (qora mato, qizil oy, po'lat)
  if (hero === "shinobi") return [...SHINOBI_PORTRAIT_COLORS];
  // Rohiba: portretning o'z rang to'plami (oq libos, oltin halo, teri)
  if (hero === "priestess") return [...PRIESTESS_PORTRAIT_COLORS];
  // Bo'ri-qiz: portretning o'z rang to'plami (oy, po'lat, mo'yna, qizil tutam)
  if (hero === "wolf") return [...WOLF_PORTRAIT_COLORS];
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
