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

/** Portret to'ri (kvadrat). Kartada 2 baravar kattalashtirib chiziladi */
export const PORTRAIT_GRID = 64;

/**
 * Paladin: yopiq oltin dubulg'a (gumbaz, o'rta qirra, ko'z tirqishi, nafas teshiklari), bo'yin
 * zirhi, keng yelkaliklar, oq tabardda quyosh belgisi va yuz oldida tik ushlangan ulkan qilich
 * dastasi. Ranglar: 1 — siyoh, 2 — to'q oltin-bronza, 3 — oltin, 4 — kumush tig', 5 — oq nur.
 */
function paladinPortrait(p: Pixels) {
  // ko'krak: oq tabard va quyosh belgisi
  p.polygon(5, [
    [16, 46],
    [44, 46],
    [50, 63],
    [10, 63],
  ]);
  p.ellipse(3, 30, 58, 4.5, 4.5);
  p.rect(3, 29, 51, 2, 2);
  p.rect(3, 22, 57, 2, 2);
  p.rect(3, 36, 57, 2, 2);
  p.rect(5, 29, 57, 2, 2);
  // chap (orqa) yelkalik
  p.ellipse(3, 10, 52, 11, 8);
  p.ellipse(2, 10, 57, 11, 6);
  p.rect(5, 3, 46, 10, 2);
  p.rect(3, 2, 49, 14, 3);
  // o'ng (old) yelkalik: kattaroq, ikki qavat plastinka
  p.ellipse(3, 50, 51, 13, 9);
  p.ellipse(2, 50, 58, 13, 6);
  p.rect(5, 42, 44, 12, 2);
  p.rect(3, 40, 47, 20, 4);
  p.rect(2, 40, 52, 22, 1);
  // bo'yin zirhi (gorjet)
  p.polygon(2, [
    [18, 40],
    [42, 40],
    [45, 48],
    [15, 48],
  ]);
  p.rect(3, 17, 44, 27, 2);
  p.rect(5, 20, 44, 6, 1);
  // dubulg'a: gumbaz, pastga toraygan yuz plastinkasi (iyagi o'tkir)
  p.polygon(3, [
    [20, 8],
    [26, 3],
    [36, 3],
    [42, 8],
    [45, 16],
    [45, 31],
    [41, 42],
    [34, 46],
    [28, 46],
    [21, 42],
    [17, 31],
    [17, 16],
  ]);
  // soya tomoni (chap) va iyak ostidagi soya
  p.polygon(2, [
    [20, 8],
    [23, 6],
    [21, 17],
    [21, 31],
    [24, 43],
    [21, 42],
    [17, 31],
    [17, 16],
  ]);
  p.polygon(2, [
    [24, 43],
    [38, 43],
    [34, 46],
    [28, 46],
  ]);
  // o'ng chetdagi yaltiroq qirra
  p.rect(5, 43, 11, 1, 16);
  // qosh tasmasi: markazga qarab pasayadi (qahrli nigoh)
  p.polygon(2, [
    [17, 15],
    [29, 19],
    [29, 22],
    [17, 18],
  ]);
  p.polygon(2, [
    [33, 19],
    [45, 15],
    [45, 18],
    [33, 22],
  ]);
  // ko'z tirqishi: ikki qiya tirqish
  p.polygon(1, [
    [18, 19],
    [29, 22],
    [29, 26],
    [18, 23],
  ]);
  p.polygon(1, [
    [33, 22],
    [44, 19],
    [44, 23],
    [33, 26],
  ]);
  // tirqish ichida porlovchi ko'zlar
  p.rect(5, 36, 22, 4, 2);
  p.rect(3, 40, 22, 1, 1);
  p.rect(5, 23, 22, 3, 2);
  p.rect(3, 22, 22, 1, 1);
  // o'rta qirra (burun himoyasi): oq yaltiroq, iyakkacha
  p.rect(3, 29, 3, 4, 43);
  p.rect(5, 30, 3, 2, 40);
  p.rect(2, 33, 27, 1, 17);
  // gumbazdagi yaltirash
  p.rect(5, 36, 6, 3, 1);
  p.rect(5, 38, 7, 3, 2);
  p.rect(5, 40, 10, 2, 3);
  // nafas tirqishlari: o'ng yonoqda uch ustun, chapda (soyada) ikkita
  for (const [x, y, h] of [
    [36, 29, 5],
    [39, 29, 5],
    [42, 29, 4],
    [36, 36, 4],
    [39, 36, 3],
  ] as const)
    p.rect(1, x, y, 1, h);
  for (const [x, y, h] of [
    [23, 29, 5],
    [26, 30, 4],
    [25, 37, 3],
  ] as const)
    p.rect(1, x, y, 1, h);
  // parchin mixlar
  p.rect(5, 19, 13, 1, 1);
  p.rect(5, 42, 13, 1, 1);
  // ulkan qilich: tig' yuqoriga ketadi, ko'ndalang va dasta qo'lqopda
  p.rect(1, 49, 1, 11, 36);
  p.rect(4, 50, 1, 9, 35);
  p.rect(5, 51, 1, 2, 35);
  p.rect(2, 54, 1, 1, 33);
  p.rect(5, 57, 3, 1, 30);
  // keng oltin ko'ndalang
  p.rect(3, 43, 35, 21, 4);
  p.rect(5, 44, 35, 19, 1);
  p.rect(2, 43, 38, 21, 1);
  p.rect(3, 41, 34, 3, 6);
  p.rect(3, 62, 34, 2, 6);
  // qo'lqop dastani qisgan
  p.rect(2, 52, 40, 5, 12);
  p.polygon(3, [
    [48, 41],
    [61, 41],
    [62, 50],
    [47, 50],
  ]);
  p.rect(5, 49, 42, 11, 1);
  p.rect(2, 48, 45, 13, 1);
  p.rect(2, 48, 48, 13, 1);
  // boldoq
  p.ellipse(3, 54.5, 55, 3, 3);
  p.rect(5, 53, 53, 2, 1);
}

const PORTRAITS: Partial<Record<Hero, (p: Pixels) => void>> = {
  paladin: paladinPortrait,
};

/** Portret piksellari (0 — bo'sh, 1..5 — palitra ranglari), siyoh kontur bilan; yo'q — null */
export function portraitPixels(hero: Hero): Uint8Array | null {
  const draw = PORTRAITS[hero];
  if (!draw) return null;
  const p = new Pixels(PORTRAIT_GRID);
  draw(p);
  return p.outlined();
}

const cache = new Map<string, HTMLCanvasElement>();

/**
 * Tayyor portret kanvasi (PORTRAIT_GRID × PORTRAIT_GRID), skin palitrasi bilan. Kesh kaliti —
 * qahramon va skin id. Portreti yo'q qahramon yoki kanvassiz muhit (sinov) — null.
 */
export function superPortrait(hero: Hero, palette?: SpritePalette): HTMLCanvasElement | null {
  const key = `${hero}:${palette?.id ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const data = portraitPixels(hero);
  if (!data || typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const n = PORTRAIT_GRID;
  canvas.width = canvas.height = n;
  const raster = canvas.getContext("2d");
  if (!raster) return null;
  const colors = palette?.colors ?? PALETTES[hero];
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
