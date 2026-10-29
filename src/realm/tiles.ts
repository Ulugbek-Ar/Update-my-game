/** Ochiq olam plitkalari: 16px, 32x32 plitkali chunk'lar. */
export const TILE = 16;
export const CHUNK = 32;
export const CHUNK_PX = TILE * CHUNK;

export const TILE_IDS = {
  grass: 0,
  grass2: 1,
  flowers: 2,
  path: 3,
  water: 4,
  bridge: 5,
  tree: 6,
  bush: 7,
  rock: 8,
  cliff: 9,
  floor: 10,
  ruinwall: 11,
  cracked: 12,
  wall: 13,
  roof: 14,
  door: 15,
  fence: 16,
  marsh: 17,
  sand: 18,
  cavefloor: 19,
  cave: 20,
  reeds: 21,
  field: 22,
  well: 23,
  pine: 24,
  rubble: 25,
  stairs: 26,
  window: 27,
  pool: 28,
  pillar: 29,
} as const;

export type TileName = keyof typeof TILE_IDS;
export const TILE_NAMES = Object.keys(TILE_IDS) as [TileName, ...TileName[]];
export const TILE_BY_ID: TileName[] = [];
for (const n of TILE_NAMES) TILE_BY_ID[TILE_IDS[n]] = n;

const SOLID_NAMES: readonly TileName[] = [
  "water",
  "tree",
  "bush",
  "rock",
  "cliff",
  "ruinwall",
  "cracked",
  "wall",
  "roof",
  "door",
  "fence",
  "well",
  "pine",
  "window",
  "pool",
  "pillar",
];
/** id -> devor/suv/daraxt (yurib bo'lmaydi) */
export const SOLID: boolean[] = TILE_BY_ID.map((n) => SOLID_NAMES.includes(n));
/** Suv: o'q ustidan uchib o'tadi, odam o'tolmaydi */
export const WATER: boolean[] = TILE_BY_ID.map((n) => n === "water" || n === "pool");
