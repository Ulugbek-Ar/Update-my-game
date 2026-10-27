import type { EnemyKind } from "./enemy";
import type { Player } from "./player";

/** Har to'lqindagi dushmanlar. Oxirgi to'lqinda Boss ham chiqadi. */
export const WAVES: EnemyKind[][] = [
  ["blob", "blob", "blob"],
  ["blob", "blob", "wisp", "wisp"],
  ["wisp", "wisp", "rammer", "rammer", "blob", "archer"],
  ["rammer", "rammer", "rammer", "wisp", "wisp", "blob", "blob", "archer", "archer"],
  ["blob", "blob"],
];

export const BOSS_WAVE = WAVES.length - 1;

// ---- Cheksiz rejim: Boss mag'lub bo'lgach to'lqinlar indeksi BOSS_WAVE+1 dan davom etadi ----
/** Har nechanchi cheksiz to'lqinda Boss qaytadi */
export const ENDLESS_BOSS_EVERY = 5;
const ENDLESS_KINDS: EnemyKind[] = ["blob", "wisp", "rammer", "archer"];

/** Cheksiz rejimdagi tartib raqami (1, 2, ...); asosiy to'lqinlarda 0. */
export function endlessNumber(i: number) {
  return Math.max(0, i - BOSS_WAVE);
}

export function isBossWave(i: number) {
  const n = endlessNumber(i);
  return i === BOSS_WAVE || (n > 0 && n % ENDLESS_BOSS_EVERY === 0);
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
  return Array.from(
    { length: count },
    () => ENDLESS_KINDS[Math.floor(rand() * ENDLESS_KINDS.length)]!,
  );
}

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  color: string;
  apply: (p: Player) => void;
  ok: (p: Player) => boolean;
  /** Sehrgar uchun boshqacha matn (kuch o'sha, lekin sehrga moslangan) */
  mage?: { name?: string; desc: string };
}

/** Kartadagi nom va tavsif tanlangan qahramonga mos. */
export function upgradeText(u: Upgrade, p: Player) {
  return p.mage && u.mage ? { name: u.mage.name ?? u.name, desc: u.mage.desc } : u;
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
  },
  {
    id: "blade",
    name: "O'TKIR QILICH",
    desc: "Qilich zarari +1",
    color: "#68cde4",
    apply: (p) => p.damage++,
    ok: (p) => p.damage < 3,
    mage: { name: "KUCHLI SEHR", desc: "Shar va halqa zarari +1" },
  },
  {
    id: "reach",
    name: "UZUN TIG'",
    desc: "Zarba maydoni kattaroq",
    color: "#c5e4ec",
    apply: (p) => {
      p.reach += 5;
      p.boltSpeed += 45;
    },
    ok: (p) => p.reach < 31,
    mage: { desc: "Shar tezroq uchadi, halqa kattaroq" },
  },
  {
    id: "haste",
    name: "CHAQQON QO'L",
    desc: "Zarbalar orasi 25% qisqa",
    color: "#ffcc33",
    apply: (p) => (p.attackCd *= 0.75),
    ok: (p) => p.attackCd > 0.2,
    mage: { desc: "Sharlar orasi 25% qisqa" },
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
    mage: { desc: "Tezlik +15%, teleport tezroq qaytadi" },
  },
  {
    id: "vamp",
    name: "QON TOMIRI",
    desc: "Har bir necha o'ldirishda +1 yurak",
    color: "#b23238",
    apply: (p) => (p.lifesteal = p.lifesteal ? Math.max(3, p.lifesteal - 2) : 6),
    ok: (p) => p.lifesteal !== 3,
  },
  {
    id: "thorns",
    name: "TIKANLI ZIRH",
    desc: "Zarba yesang, yaqin dushmanga 1 zarar",
    color: "#c9a26b",
    apply: (p) => (p.thorns = true),
    ok: (p) => !p.thorns,
  },
  {
    id: "dash2",
    name: "IKKI KARRA DASH",
    desc: "Ketma-ket 2 ta dash",
    color: "#7fd8ff",
    apply: (p) => (p.dashMax = 2),
    ok: (p) => p.dashMax < 2,
    mage: { name: "IKKI KARRA TELEPORT", desc: "Ketma-ket 2 ta teleport" },
  },
  {
    id: "mend",
    name: "SHIFO",
    desc: "Barcha yuraklarni tiklash",
    color: "#f2fbe4",
    apply: (p) => (p.hp = p.maxHp),
    ok: (p) => p.hp < p.maxHp,
  },
];

/** n ta turli, hozir foydali bo'lgan kuchaytirishni tanlaydi. */
export function pickUpgrades(p: Player, n = 3, rand = Math.random): Upgrade[] {
  const pool = UPGRADES.filter((u) => u.ok(p));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, n);
}
