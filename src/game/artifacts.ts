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
  | "iaireset";

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
    name: "OLOV IZI",
    desc: "Dash izidan olov qoladi va dushmanlarni kuydiradi",
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
    name: "O'NINCHI ZARB",
    desc: "Har 10-zarba ikki baravar zarar beradi",
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
    name: "SO'NGGI NAFAS",
    desc: "Yurak 1 ga tushganda 3 s daxlsizlik (o'yinda bir marta)",
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
    name: "OLTIN SHAMOL",
    desc: "Tanga tersangiz 1 s tezlashasiz",
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
    name: "FAZA TO'LQINI",
    desc: "Boss fazasi almashganda atrofga zarb to'lqini",
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
    name: "CHAQMOQ ZANJIRI",
    desc: "Dushman o'lganda chaqmoq eng yaqin dushmanga uriladi",
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
    name: "MAGNIT",
    desc: "Yaqindagi tanga va yuraklar o'zi uchib keladi",
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
    name: "SEHRLI KALIT",
    desc: "Sandiq bir zarbada ochiladi va doim yurak beradi",
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
    name: "QASOS",
    desc: "Jon yo'qotsangiz keyingi zarbangiz 3 baravar",
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
    name: "KOMBO YURAGI",
    desc: "Har 15 kombo uchun +1 yurak",
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
    name: "TO'LQIN QALQONI",
    desc: "Har to'lqin boshida bir zarbani to'sadigan qalqon",
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
    name: "MUZ YURAK",
    desc: "Jon yo'qotganingizda hamma dushman 1 s qotadi",
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
    name: "PO'LAT AYLANA",
    desc: "Aylana zarbadan keyin 0.6 s daxlsizlik",
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
    name: "MUZ HALQA",
    desc: "Halqa tekkan dushman 1.5 s sekinlashadi",
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
    name: "PO'LAT JAG'",
    desc: "Tuzoq yopilganda dushmanga 3 zarar",
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
    name: "OXIRGI O'Q",
    desc: "Barabandagi oxirgi o'q ikki baravar zarar",
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
    name: "QASAM NURI",
    desc: "QASAM paytida zarba yesangiz atrofga nur uriladi",
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
    name: "SAKURA SHAMOLI",
    desc: "Mukammal chetlanish Iai zarbasini darhol tayyor qiladi",
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
