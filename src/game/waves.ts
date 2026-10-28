import type { EnemyKind } from "./enemy";
import type { Player } from "./player";
import type { Hero } from "./hero";

/** Har to'lqindagi dushmanlar. Oxirgi to'lqinda Boss ham chiqadi. */
export const WAVES: EnemyKind[][] = [
  ["blob", "blob", "blob"],
  ["blob", "blob", "wisp", "wisp"],
  ["wisp", "wisp", "rammer", "rammer", "blob", "archer"],
  ["rammer", "rammer", "rammer", "wisp", "wisp", "blob", "blob", "archer", "archer", "shield"],
  ["blob", "blob"],
];

export const BOSS_WAVE = WAVES.length - 1;

/** 2-bob: Muz sardobasi. 1-bob dushmanlari kamroq, yangi muz dushmanlari aralash; 5-to'lqinda Qor Malikasi. */
export const WAVES2: EnemyKind[][] = [
  ["frost", "frost", "blob", "wisp"],
  ["golem", "frost", "blob", "blob", "wisp"],
  ["golem", "frost", "frost", "rammer", "archer", "wisp"],
  ["golem", "golem", "frost", "frost", "shield", "rammer", "archer"],
  ["blob", "wisp"],
];

/** 2-bobda dushmanlar 1-bob oxiridan biroz tezroq boshlanadi va har to'lqinda tezlashadi. */
export function waveSpeed2(i: number) {
  return 1.15 + i * 0.05;
}

// ---- Cheksiz rejim: Boss mag'lub bo'lgach to'lqinlar indeksi BOSS_WAVE+1 dan davom etadi ----
/** Har nechanchi cheksiz to'lqinda Boss qaytadi */
export const ENDLESS_BOSS_EVERY = 5;
const ENDLESS_KINDS: EnemyKind[] = ["blob", "wisp", "rammer", "archer"];
/** Qalqonli skelet cheksiz rejimda shu to'lqindan boshlab qo'shiladi */
export const ENDLESS_SHIELD_FROM = 6;

/** Cheksiz rejimdagi tartib raqami (1, 2, ...); asosiy to'lqinlarda 0. */
export function endlessNumber(i: number) {
  return Math.max(0, i - BOSS_WAVE);
}

export function isBossWave(i: number) {
  const n = endlessNumber(i);
  return i === BOSS_WAVE || (n > 0 && n % ENDLESS_BOSS_EVERY === 0);
}

/** Xazina sandig'i chiqishi mumkin bo'lgan to'lqin: 2- va 4-to'lqin, cheksizda har 3-to'lqin. */
export function isChestWave(i: number) {
  const n = endlessNumber(i);
  return n > 0 ? n % 3 === 0 : i === 1 || i === 3;
}

/** Boss joni: har qaytishda ko'proq. */
export function bossHp(i: number) {
  return 30 + 15 * Math.floor(endlessNumber(i) / ENDLESS_BOSS_EVERY);
}

/** To'lqin oshgani sari dushmanlar tezlashadi (cheksiz rejimda chegaralangan). */
export function waveSpeed(i: number) {
  const n = endlessNumber(i);
  return n === 0 ? 1 + i * 0.07 : Math.min(2, 1 + BOSS_WAVE * 0.07 + n * 0.04);
}

/** To'lqindagi dushmanlar: asosiy to'lqinlar qat'iy, cheksizda soni oshib boradi. */
export function waveEnemies(i: number, rand = Math.random): EnemyKind[] {
  const n = endlessNumber(i);
  if (n === 0) return WAVES[i]!;
  const count = isBossWave(i) ? 2 + n / ENDLESS_BOSS_EVERY : Math.min(16, 5 + n);
  const kinds: EnemyKind[] =
    n >= ENDLESS_SHIELD_FROM ? [...ENDLESS_KINDS, "shield"] : ENDLESS_KINDS;
  return Array.from({ length: count }, () => kinds[Math.floor(rand() * kinds.length)]!);
}

/** Qahramonga xos karta: nom, tavsif, rang, ikonka va kerak bo'lsa alohida ta'sir. */
export interface HeroCard {
  name: string;
  desc: string;
  color: string;
  /** Yozuv rangi — to'q rangli kartada nom o'qilishi uchun; berilmasa color */
  text?: string;
  /** Ikonka (sprites.ts dagi UPGRADE_ICONS kaliti) */
  icon: string;
  apply?: (p: Player) => void;
  ok?: (p: Player) => boolean;
}

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  color: string;
  /** Yozuv rangi — to'q rangli kartada nom o'qilishi uchun; berilmasa color */
  text?: string;
  /** Ikonka kaliti; berilmasa id ishlatiladi */
  icon?: string;
  apply: (p: Player) => void;
  ok: (p: Player) => boolean;
  /** Sehrgar uchun alohida karta */
  mage?: HeroCard;
  /** Faqat shu qahramonga chiqadi */
  hero?: Hero;
}

/** Tanlangan qahramonga mos karta (Sehrgarda uning alohida nomi, ikonka va ta'siri). */
export function cardFor(u: Upgrade, p: Player): Upgrade {
  if (!p.mage || !u.mage) return u;
  const { mage, ...base } = u;
  return { ...base, ...mage };
}

export function upgradeIcon(u: Upgrade) {
  return u.icon ?? u.id;
}

export const UPGRADES: Upgrade[] = [
  {
    id: "heart",
    name: "TEMIR YURAK",
    desc: "+1 yurak va to'liq davolanish",
    color: "#ff4d6d",
    apply: (p) => {
      p.maxHp++;
      p.hp = p.maxHp;
    },
    ok: (p) => p.maxHp < 10,
    mage: {
      name: "SEHRLI YURAK",
      desc: "+1 yurak va to'liq davolanish",
      color: "#c1121f",
      text: "#ff4d4d",
      icon: "mheart",
    },
  },
  {
    id: "blade",
    name: "O'TKIR QILICH",
    desc: "Qilich zarari +1",
    color: "#68cde4",
    apply: (p) => p.damage++,
    ok: (p) => p.damage < 3,
    mage: {
      name: "KUCHLI SEHR",
      desc: "Shar va halqa zarari +1",
      color: "#ff9a3c",
      icon: "fireball",
    },
  },
  {
    id: "reach",
    name: "UZUN TIG'",
    desc: "Zarba maydoni kattaroq",
    color: "#c5e4ec",
    apply: (p) => (p.reach += 5),
    ok: (p) => p.reach < 31,
    mage: {
      name: "KENG HALQA",
      desc: "Halqa kattaroq, shar biroz kattaroq",
      color: "#ff4d4d",
      icon: "ring",
      apply: (p) => {
        p.reach += 5;
        p.boltSize += 2;
      },
    },
  },
  {
    id: "haste",
    name: "CHAQQON QO'L",
    desc: "Zarbalar orasi 25% qisqa",
    color: "#ffcc33",
    apply: (p) => (p.attackCd *= 0.75),
    ok: (p) => p.attackCd > 0.2,
    mage: { name: "TEZ AFSUN", desc: "Sharlar orasi 25% qisqa", color: "#ffd166", icon: "book" },
  },
  {
    id: "wind",
    name: "SHAMOL QADAMI",
    desc: "Tezlik +15%, dash tezroq qaytadi",
    color: "#a6f08e",
    apply: (p) => {
      p.speed *= 1.15;
      p.dashCd *= 0.75;
    },
    ok: (p) => p.speed < 130,
    mage: {
      name: "EFIR QADAMI",
      desc: "Tezlik +15%, teleport tezroq qaytadi",
      color: "#d9d4e0",
      icon: "wstar",
    },
  },
  {
    id: "vamp",
    name: "QON TOMIRI",
    desc: "Har bir necha o'ldirishda +1 yurak",
    color: "#b23238",
    apply: (p) => (p.lifesteal = p.lifesteal ? Math.max(3, p.lifesteal - 2) : 6),
    ok: (p) => p.lifesteal !== 3,
    mage: {
      name: "RUH SO'RISH",
      desc: "Har bir necha o'ldirishda +1 yurak",
      color: "#c1121f",
      text: "#ff4d4d",
      icon: "spirit",
    },
  },
  {
    id: "thorns",
    name: "TIKANLI ZIRH",
    desc: "Zarba yesang, yaqin dushmanga 1 zarar",
    color: "#c9a26b",
    apply: (p) => (p.thorns = true),
    ok: (p) => !p.thorns,
    mage: {
      name: "MUZ QALQONI",
      desc: "Jon yo'qotsang, atrofdagilar 1.5s sekinlashadi",
      color: "#d9d4e0",
      icon: "ice",
      apply: (p) => (p.frost = true),
      ok: (p) => !p.frost,
    },
  },
  {
    id: "dash2",
    name: "IKKI KARRA DASH",
    desc: "Ketma-ket 2 ta dash",
    color: "#7fd8ff",
    apply: (p) => (p.dashMax = 2),
    ok: (p) => p.dashMax < 2,
    mage: {
      name: "IKKI KARRA TELEPORT",
      desc: "Ketma-ket 2 ta teleport",
      color: "#ff4d4d",
      icon: "portal",
    },
  },
  {
    id: "mend",
    name: "SHIFO",
    desc: "Barcha yuraklarni tiklash",
    color: "#f2fbe4",
    apply: (p) => (p.hp = p.maxHp),
    ok: (p) => p.hp < p.maxHp,
    mage: {
      name: "SHIFOBAXSH IKSIR",
      desc: "Barcha yuraklarni tiklash",
      color: "#c1121f",
      text: "#ff4d4d",
      icon: "elixir",
    },
  },
  // ---- Faqat Sehrgar ----
  {
    id: "triple",
    name: "UCH SHAR",
    desc: "Bir otishda yelpig'ich bo'lib 3 ta shar",
    color: "#ff4d4d",
    icon: "orbs",
    hero: "mage",
    apply: (p) => (p.multishot = 3),
    ok: (p) => p.multishot < 3,
  },
  {
    id: "pierce",
    name: "TESHUVCHI SHAR",
    desc: "Shar 1 dushmandan o'tib, keyingisiga ham tegadi",
    color: "#ff4d4d",
    icon: "crystal",
    hero: "mage",
    apply: (p) => (p.pierce = 1),
    ok: (p) => p.pierce < 1,
  },
];

/** n ta turli, hozir foydali bo'lgan kuchaytirishni tanlaydi. */
export function pickUpgrades(p: Player, n = 3, rand = Math.random): Upgrade[] {
  const pool = UPGRADES.filter((u) => !u.hero || u.hero === p.hero)
    .map((u) => cardFor(u, p))
    .filter((u) => u.ok(p));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, n);
}
