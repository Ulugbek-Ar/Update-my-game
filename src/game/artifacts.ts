/**
 * ARTEFAKTLAR — bitta o'yin davomidagi noyob buyumlar (roguelike): o'lsa yoki qayta boshlasa yo'qoladi.
 * Faqat dunyolar va cheksiz rejimda (kunlik sinovda yo'q); Abadiyat olamidagi buyumlardan alohida.
 *
 * Artefakt RAQAM emas, QOIDA o'zgartiradi — ta'sirini Game `hasArtifact(id)` bilan tekshiradi.
 * Yangi artefakt qo'shish: shu ro'yxatga yozuv (id, nom, tavsif, rang, 9x9 ikonka) va Game'dagi
 * tegishli joyda `hasArtifact` tekshiruvi.
 *
 * Tushishi: sandiqdan ARTIFACT_CHEST ehtimol bilan, bossdan doim; bir o'yinda takrorlanmaydi.
 */
import { t as tr } from "@/i18n";
import type { Hero } from "./hero";

export type ArtifactId =
  | "flame"
  | "tenth"
  | "lastbreath"
  | "goldwind"
  | "phasewave"
  | "chain"
  | "magnet"
  | "key"
  | "revenge"
  | "combo"
  | "aegis"
  | "frostheart"
  // qahramonlarga xos
  | "spinguard"
  | "slowring"
  | "bigtrap"
  | "lastshot"
  | "vowlight"
  | "iaireset"
  | "smokecharm"
  | "prayerbeads"
  | "wolffang";

export interface Artifact {
  id: ArtifactId;
  name: string;
  desc: string;
  /** Asosiy rang (X) va ikkinchi rang (Y) — ikonka shu ranglarda, kontur doim to'q */
  color: string;
  dark: string;
  /** Faqat shu qahramonga tushadi */
  hero?: Hero;
  /** 9x9: k — kontur, X — color, Y — dark, w — yaltiroq, "." — shaffof */
  icon: readonly string[];
}

/** Sandiq ochilganda artefakt tushish ehtimoli */
export const ARTIFACT_CHEST = 0.15;
/** Bir o'yinda shuncha artefakt — "Kollektsioner" yutug'i */
export const COLLECTOR_AT = 5;

/** Ta'sir qiymatlari (Game shu yerdan o'qiydi) */
export const FLAME_LIFE = 1.5;
export const FLAME_RADIUS = 7;
export const FLAME_TICK = 0.5;
export const TENTH_EVERY = 10;
export const LAST_BREATH_TIME = 3;
export const GOLD_BOOST = 1;
export const PHASE_WAVE_RADIUS = 80;
export const PHASE_WAVE_DMG = 2;
export const CHAIN_RADIUS = 70;
export const MAGNET_RADIUS = 60;
export const MAGNET_SPEED = 130;
export const REVENGE_MUL = 3;
export const COMBO_HEAL_EVERY = 15;
export const FROST_HEART_TIME = 1;
export const SPIN_GUARD = 0.6;
export const SLOW_RING = 1.5;
export const BIG_TRAP_DMG = 3;
export const LAST_SHOT_MUL = 2;
export const VOW_LIGHT_RADIUS = 50;

export const ARTIFACTS: readonly Artifact[] = [
  {
    id: "flame",
    get name() {
      return tr("art.flame.name");
    },
    get desc() {
      return tr("art.flame.desc");
    },
    color: "#ff8a2a",
    dark: "#c1121f",
    icon: [
      "....k....",
      "...kXk...",
      "..kXXk...",
      "..kXwXk..",
      ".kXXwXXk.",
      ".kXYwYXk.",
      "kXYYwYYXk",
      "kXYYYYYXk",
      ".kkkkkkk.",
    ],
  },
  {
    id: "tenth",
    get name() {
      return tr("art.tenth.name");
    },
    get desc() {
      return tr("art.tenth.desc");
    },
    color: "#ffcc33",
    dark: "#a8741a",
    icon: [
      "....k....",
      "...kXk...",
      "kk.kXk.kk",
      "kXkkwkkXk",
      ".kXwwwXk.",
      "kXkkwkkXk",
      "kk.kXk.kk",
      "...kYk...",
      "....k....",
    ],
  },
  {
    id: "lastbreath",
    get name() {
      return tr("art.lastbreath.name");
    },
    get desc() {
      return tr("art.lastbreath.desc");
    },
    color: "#e8dcc0",
    dark: "#a8741a",
    icon: [
      "kkkkkkkkk",
      "kYYYYYYYk",
      ".kXXXXXk.",
      "..kXwXk..",
      "...kXk...",
      "..kX.Xk..",
      ".kX.w.Xk.",
      "kYYYYYYYk",
      "kkkkkkkkk",
    ],
  },
  {
    id: "goldwind",
    get name() {
      return tr("art.goldwind.name");
    },
    get desc() {
      return tr("art.goldwind.desc");
    },
    color: "#ffcc33",
    dark: "#7fd8ff",
    icon: [
      "...kkkk..",
      "..kXXXXk.",
      "YYkXwXXXk",
      ".kXwXXXXk",
      "YYkXXXXXk",
      ".kXXXXXXk",
      "YYkXXXXk.",
      "..kkkkk..",
      ".........",
    ],
  },
  {
    id: "phasewave",
    get name() {
      return tr("art.phasewave.name");
    },
    get desc() {
      return tr("art.phasewave.desc");
    },
    color: "#c99ae8",
    dark: "#4a2470",
    icon: [
      "..kkkkk..",
      ".kXXXXXk.",
      "kXkkkkkXk",
      "kXkYYYkXk",
      "kXkYwYkXk",
      "kXkYYYkXk",
      "kXkkkkkXk",
      ".kXXXXXk.",
      "..kkkkk..",
    ],
  },
  {
    id: "chain",
    get name() {
      return tr("art.chain.name");
    },
    get desc() {
      return tr("art.chain.desc");
    },
    color: "#ffe14d",
    dark: "#5b9fd6",
    icon: [
      ".....kkk.",
      "....kXXk.",
      "...kXXk..",
      "..kXwXkk.",
      ".kXwwwXXk",
      ".kkXwXXk.",
      "..kXXk...",
      ".kYYk....",
      ".kkk.....",
    ],
  },
  {
    id: "magnet",
    get name() {
      return tr("art.magnet.name");
    },
    get desc() {
      return tr("art.magnet.desc");
    },
    color: "#ff4d6d",
    dark: "#d9d4e0",
    icon: [
      ".kkk.kkk.",
      "kXXXkXXXk",
      "kXXkkkXXk",
      "kXXk.kXXk",
      "kXXk.kXXk",
      "kXwk.kwXk",
      "kYYk.kYYk",
      "kYYk.kYYk",
      "kkkk.kkkk",
    ],
  },
  {
    id: "key",
    get name() {
      return tr("art.key.name");
    },
    get desc() {
      return tr("art.key.desc");
    },
    color: "#f2c14e",
    dark: "#7a5a12",
    icon: [
      ".kkk.....",
      "kXXXk....",
      "kXwXk....",
      "kXXXk....",
      ".kXkkkkk.",
      ".kXXXXXXk",
      ".kkkYkYkk",
      "....kYkYk",
      ".....k.k.",
    ],
  },
  {
    id: "revenge",
    get name() {
      return tr("art.revenge.name");
    },
    get desc() {
      return tr("art.revenge.desc");
    },
    color: "#ff3b3b",
    dark: "#681e2b",
    icon: [
      ".......kk",
      "......kXk",
      ".....kXwk",
      "....kXwk.",
      "...kXwk..",
      "kk.kXk...",
      ".kYkk....",
      "..kYk....",
      ".k..k....",
    ],
  },
  {
    id: "combo",
    get name() {
      return tr("art.combo.name");
    },
    get desc() {
      return tr("art.combo.desc");
    },
    color: "#ff4d6d",
    dark: "#ff9a3c",
    icon: [
      ".kk...kk.",
      "kXXk.kXXk",
      "kXwXkXXXk",
      "kXXXYXXXk",
      "kXXYYYXXk",
      ".kXXYXXk.",
      "..kXXXk..",
      "...kXk...",
      "....k....",
    ],
  },
  {
    id: "aegis",
    get name() {
      return tr("art.aegis.name");
    },
    get desc() {
      return tr("art.aegis.desc");
    },
    color: "#9fb4c8",
    dark: "#3f86c2",
    icon: [
      "kkkkkkkkk",
      "kXXXYXXXk",
      "kXwXYXXXk",
      "kXXXYXXXk",
      "kYYYYYYYk",
      ".kXXYXXk.",
      ".kXXYXXk.",
      "..kXYXk..",
      "...kkk...",
    ],
  },
  {
    id: "frostheart",
    get name() {
      return tr("art.frostheart.name");
    },
    get desc() {
      return tr("art.frostheart.desc");
    },
    color: "#a3dcf7",
    dark: "#3f86c2",
    icon: [
      "....k....",
      ".k.kXk.k.",
      "..kXwXk..",
      ".kXYwYXk.",
      "kXwwwwwXk",
      ".kXYwYXk.",
      "..kXwXk..",
      ".k.kXk.k.",
      "....k....",
    ],
  },
  // ---- qahramonlarga xos ----
  {
    id: "spinguard",
    get name() {
      return tr("art.spinguard.name");
    },
    get desc() {
      return tr("art.spinguard.desc");
    },
    color: "#68cde4",
    dark: "#287faf",
    hero: "knight",
    icon: [
      "..kkkkk..",
      ".kXXXXXk.",
      "kXkkkkwXk",
      "kXk...kkk",
      "kXk......",
      "kXk...kkk",
      "kYkkkkkYk",
      ".kYYYYYk.",
      "..kkkkk..",
    ],
  },
  {
    id: "slowring",
    get name() {
      return tr("art.slowring.name");
    },
    get desc() {
      return tr("art.slowring.desc");
    },
    color: "#7fe9ff",
    dark: "#a3192a",
    hero: "mage",
    icon: [
      "...kkk...",
      ".kkXXXkk.",
      ".kXkkkXk.",
      "kXk.Y.kXk",
      "kXkYwYkXk",
      "kXk.Y.kXk",
      ".kXkkkXk.",
      ".kkXXXkk.",
      "...kkk...",
    ],
  },
  {
    id: "bigtrap",
    get name() {
      return tr("art.bigtrap.name");
    },
    get desc() {
      return tr("art.bigtrap.desc");
    },
    color: "#9a9ea8",
    dark: "#7a4a24",
    hero: "hunter",
    icon: [
      "k.k.k.k.k",
      "kXkXkXkXk",
      "kXXXXXXXk",
      ".kkkwkkk.",
      "....Y....",
      ".kkkwkkk.",
      "kXXXXXXXk",
      "kXkXkXkXk",
      "k.k.k.k.k",
    ],
  },
  {
    id: "lastshot",
    get name() {
      return tr("art.lastshot.name");
    },
    get desc() {
      return tr("art.lastshot.desc");
    },
    color: "#dba45a",
    dark: "#b8322a",
    hero: "gunner",
    icon: [
      "...kkk...",
      "..kYYYk..",
      "..kYwYk..",
      "..kXXXk..",
      "..kXwXk..",
      "..kXXXk..",
      "..kXXXk..",
      ".kkkkkkk.",
      ".kXXXXXk.",
    ],
  },
  {
    id: "vowlight",
    get name() {
      return tr("art.vowlight.name");
    },
    get desc() {
      return tr("art.vowlight.desc");
    },
    color: "#f2c14e",
    dark: "#fff2b0",
    hero: "paladin",
    icon: [
      "k...k...k",
      ".k.kXk.k.",
      "..kXYXk..",
      ".kXYwYXk.",
      "kXYwwwYXk",
      ".kXYwYXk.",
      "..kXYXk..",
      ".k.kXk.k.",
      "k...k...k",
    ],
  },
  {
    id: "iaireset",
    get name() {
      return tr("art.iaireset.name");
    },
    get desc() {
      return tr("art.iaireset.desc");
    },
    color: "#ff8fb8",
    dark: "#b8456e",
    hero: "samurai",
    icon: [
      "...kk....",
      "..kXXk.kk",
      ".kXwXkkXk",
      ".kXXkkXwk",
      "..kkYkXXk",
      ".kXkkYkk.",
      "kXwXkkYk.",
      "kXXXk.kYk",
      ".kkk...kk",
    ],
  },
  {
    id: "smokecharm",
    get name() {
      return tr("art.smokecharm.name");
    },
    get desc() {
      return tr("art.smokecharm.desc");
    },
    color: "#b0a8c0",
    dark: "#ff6f91",
    hero: "shinobi",
    icon: [
      "..kkkkk..",
      ".kXXXXXk.",
      "kXXwXXXXk",
      "kXXXkXXXk",
      "kXXkYkXXk",
      "kXXXkXXXk",
      ".kXXXXXk.",
      "..kkYkk..",
      "....k....",
    ],
  },
  {
    id: "prayerbeads",
    get name() {
      return tr("art.prayerbeads.name");
    },
    get desc() {
      return tr("art.prayerbeads.desc");
    },
    color: "#ffd77a",
    dark: "#b0781e",
    hero: "priestess",
    icon: [
      "...kkk...",
      "..kXwXk..",
      ".kX...Xk.",
      "kXk...kXk",
      "kX.....Xk",
      "kXk...kXk",
      ".kXk.kXk.",
      "..kXYXk..",
      "...kYk...",
    ],
  },
  {
    id: "wolffang",
    get name() {
      return tr("art.wolffang.name");
    },
    get desc() {
      return tr("art.wolffang.desc");
    },
    color: "#d6dae2",
    dark: "#5a74a8",
    hero: "wolf",
    icon: [
      "k.......k",
      "kXk...kXk",
      "kwXk.kXwk",
      ".kwXkXwk.",
      ".kwXXXwk.",
      "..kwXwk..",
      "..kwXwk..",
      "...kwk...",
      "....k....",
    ],
  },
];

const BY_ID = new Map(ARTIFACTS.map((a) => [a.id, a]));

export function artifactById(id: ArtifactId) {
  return BY_ID.get(id)!;
}

/** Ikonka ranglari */
export function artifactColors(a: Artifact): Record<string, string> {
  return { k: "#120a18", X: a.color, Y: a.dark, w: "#ffffff" };
}

/** Shu qahramonga tushishi mumkin bo'lgan, hali olinmagan artefaktlar */
export function artifactPool(hero: Hero, owned: readonly ArtifactId[]) {
  return ARTIFACTS.filter((a) => (!a.hero || a.hero === hero) && !owned.includes(a.id));
}

/** Tasodifiy yangi artefakt (takrorlanmaydi); hammasi olingan bo'lsa null */
export function rollArtifact(hero: Hero, owned: readonly ArtifactId[], rand = Math.random) {
  const pool = artifactPool(hero, owned);
  if (!pool.length) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))]!;
}
