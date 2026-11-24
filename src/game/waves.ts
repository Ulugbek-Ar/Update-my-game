import { t } from "@/i18n";
import { superFor } from "./super";
import type { EnemyKind } from "./enemy";
import {
  AMBUSH_CARD,
  DODGE_WINDOW_CARD,
  IAI_RANGE_CARD,
  KATANA_TIME,
  BEAM_CARD,
  BEAM_LEN,
  MERCY_CARD,
  PALM_TIME,
  SHURIKEN_CARD,
  TRAIL_CARD,
  TRAIL_LIFE,
  SHURIKEN_N,
  TWIN_TIME,
  VANISH_CARD,
  VANISH_TIME,
  type Player,
} from "./player";
import type { Hero } from "./hero";

/** Dunyo: 1 — Olovli zindon, 2 — Muz sardobasi, 3 — Zulmat o'rmoni, 4 — Sakura bog'i */
export type World = 1 | 2 | 3 | 4;

/** Har dunyoning o'z moblari (Bosslardan tashqari): boshqa dunyo moblari chiqmaydi. */
export const WORLD_KINDS: Record<World, readonly EnemyKind[]> = {
  1: ["blob", "wisp", "rammer", "archer"],
  2: ["iceblob", "frost", "golem", "shield", "wolf"],
  3: ["spider", "shroom", "treant", "owl"],
  4: ["ninja", "tengu", "kitsune"],
};

/** 1-dunyo: Olovli zindon. Oxirgi to'lqinda Iblis ham chiqadi. */
export const WAVES: EnemyKind[][] = [
  ["blob", "blob", "blob"],
  ["blob", "blob", "wisp", "wisp"],
  ["wisp", "wisp", "rammer", "rammer", "blob", "archer"],
  ["rammer", "rammer", "rammer", "rammer", "wisp", "wisp", "blob", "blob", "archer", "archer"],
  ["blob", "blob"],
];

export const BOSS_WAVE = WAVES.length - 1;

/** 2-dunyo: Muz sardobasi — faqat muz moblari; 5-to'lqinda Qor Malikasi. Bo'rilar juft keladi. */
export const WAVES2: EnemyKind[][] = [
  ["iceblob", "iceblob", "frost", "frost"],
  ["wolf", "wolf", "golem", "iceblob", "iceblob"],
  ["shield", "shield", "wolf", "wolf", "frost", "frost"],
  ["golem", "golem", "wolf", "wolf", "shield", "frost", "frost", "iceblob", "iceblob"],
  ["iceblob", "iceblob"],
];

/** 2-dunyoda dushmanlar 1-dunyo oxiridan biroz tezroq boshlanadi va har to'lqinda tezlashadi. */
export function waveSpeed2(i: number) {
  return 1.15 + i * 0.05;
}

/** 3-dunyo: Zulmat o'rmoni — faqat o'rmon moblari; 5-to'lqinda O'rmon Shohi. */
export const WAVES3: EnemyKind[][] = [
  ["spider", "spider", "shroom", "shroom"],
  ["owl", "owl", "spider", "shroom", "treant"],
  ["treant", "spider", "spider", "owl", "shroom", "shroom"],
  ["treant", "treant", "owl", "owl", "spider", "spider", "shroom", "shroom", "spider"],
  ["shroom", "shroom"],
];

/** 3-dunyoda dushmanlar 2-dunyodan biroz tezroq. */
export function waveSpeed3(i: number) {
  return 1.2 + i * 0.05;
}

/**
 * 4-dunyo: Sakura bog'i (Samurayning o'z dunyosi) — faqat bog' moblari; 5-to'lqinda Oni.
 * Moblari ayyorroq (parry va chetlanishni o'rgatadi), shuning uchun soni kamroq.
 */
export const WAVES4: EnemyKind[][] = [
  ["ninja", "ninja", "kitsune"],
  ["tengu", "tengu", "ninja", "kitsune"],
  ["kitsune", "kitsune", "ninja", "ninja", "tengu"],
  ["tengu", "tengu", "ninja", "ninja", "kitsune", "kitsune", "ninja"],
  ["kitsune", "ninja"],
];

/** 4-dunyoda dushmanlar 3-dunyodagidek tezlikda. */
export function waveSpeed4(i: number) {
  return 1.2 + i * 0.05;
}

// ---- Cheksiz rejim: Boss mag'lub bo'lgach to'lqinlar indeksi BOSS_WAVE+1 dan davom etadi ----
/** Har nechanchi cheksiz to'lqinda Boss qaytadi */
export const ENDLESS_BOSS_EVERY = 5;

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

/** Boss joni: har qaytishda ko'proq (2-dunyoda Qor Malikasi asosiy jonidan boshlanadi). */
export function bossHp(i: number, base = 30) {
  return base + 15 * Math.floor(endlessNumber(i) / ENDLESS_BOSS_EVERY);
}

/** To'lqin oshgani sari dushmanlar tezlashadi (cheksiz rejimda chegaralangan). */
export function waveSpeed(i: number) {
  const n = endlessNumber(i);
  return n === 0 ? 1 + i * 0.07 : Math.min(2, 1 + BOSS_WAVE * 0.07 + n * 0.04);
}

/**
 * To'lqindagi dushmanlar: asosiy to'lqinlar qat'iy, cheksizda soni oshib boradi.
 * Cheksiz rejimda faqat o'sha dunyoning moblari chiqadi.
 */
export function waveEnemies(i: number, rand = Math.random, world: World = 1): EnemyKind[] {
  const n = endlessNumber(i);
  if (n === 0)
    return (world === 4 ? WAVES4 : world === 3 ? WAVES3 : world === 2 ? WAVES2 : WAVES)[i]!;
  const count = isBossWave(i) ? 2 + n / ENDLESS_BOSS_EVERY : Math.min(16, 5 + n);
  const kinds = WORLD_KINDS[world];
  return Array.from({ length: count }, () => kinds[Math.floor(rand() * kinds.length)]!);
}

/**
 * Kuch kartasi tegi: umumiy (ZARAR, TEZLIK, HIMOYA, HAYOT) yoki qahramonniki (PO'LAT — Ritsar,
 * SEHR — Sehrgar, OV — Ovchi, POROX — Mergan, NUR — Paladin, SAKURA — Samuray). Bir xil tegdan 2 ta —
 * kichik bonus,
 * 3 ta — SINERGIYA (synergy.ts).
 */
export type Tag =
  | "zarar"
  | "tezlik"
  | "himoya"
  | "hayot"
  | "polat"
  | "sehr"
  | "ov"
  | "porox"
  | "nur"
  | "gul"
  | "soya"
  | "lotos"
  // SUPER kartalari (v3.9): kam uchraydi, faqat superi bor qahramonda
  | "super";

/** Qahramonga xos karta: nom, tavsif, rang, ikonka va kerak bo'lsa alohida ta'sir. */
export interface HeroCard {
  name: string;
  desc: string;
  color: string;
  /** Yozuv rangi — to'q rangli kartada nom o'qilishi uchun; berilmasa color */
  text?: string;
  /** Ikonka (sprites.ts dagi UPGRADE_ICONS kaliti) */
  icon: string;
  /** Teg (har variantda alohida yoziladi — ma'nosi asl kartadan farq qilishi mumkin) */
  tags: Tag[];
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
  /** Teg: bitta (synergy.ts) */
  tags: Tag[];
  apply: (p: Player) => void;
  ok: (p: Player) => boolean;
  /** Sehrgar uchun alohida karta */
  mage?: HeroCard;
  /** Ovchi uchun alohida karta */
  hunter?: HeroCard;
  /** Mergan uchun alohida karta */
  gunner?: HeroCard;
  /** Paladin uchun alohida karta */
  paladin?: HeroCard;
  /** Samuray uchun alohida karta */
  samurai?: HeroCard;
  /** Ninja uchun alohida karta */
  shinobi?: HeroCard;
  /** Rohiba uchun alohida karta */
  priestess?: HeroCard;
  /** Faqat shu qahramonga chiqadi */
  hero?: Hero;
  /** SUPER kartasi: faqat shu superi (super.ts: id) ochiq bo'lgan qahramonga chiqadi */
  super?: string;
  /** Kam uchraydigan karta: har tanlovda shu ehtimol bilan nomzodlar orasiga tushadi (yo'q — doim) */
  rare?: number;
}

/** Tanlangan qahramonga mos karta (Sehrgar, Ovchi va Merganda alohida nom, ikonka va ta'sir). */
export function cardFor(u: Upgrade, p: Player): Upgrade {
  const alt =
    p.hero === "mage"
      ? u.mage
      : p.hero === "hunter"
        ? u.hunter
        : p.hero === "gunner"
          ? u.gunner
          : p.hero === "paladin"
            ? u.paladin
            : p.hero === "samurai"
              ? u.samurai
              : p.hero === "shinobi"
                ? u.shinobi
                : p.hero === "priestess"
                  ? u.priestess
                  : undefined;
  if (!alt) return u;
  const {
    mage: _m,
    hunter: _h,
    gunner: _g,
    paladin: _p,
    samurai: _s,
    shinobi: _n,
    priestess: _r,
    ...base
  } = u;
  return { ...base, ...alt };
}

export function upgradeIcon(u: Upgrade) {
  return u.icon ?? u.id;
}

/** SUPER kartasining har tanlovda nomzodlar orasiga tushish ehtimoli ("kam uchraydigan") */
export const SUPER_CARD_CHANCE = 0.4;

export const UPGRADES: Upgrade[] = [
  {
    id: "heart",
    get name() {
      return t("up.heart.name");
    },
    get desc() {
      return t("up.heart.desc");
    },
    color: "#ff4d6d",
    tags: ["himoya"],
    apply: (p) => {
      p.maxHp++;
      p.hp = p.maxHp;
    },
    ok: (p) => p.maxHp < 10,
    mage: {
      tags: ["himoya"],
      get name() {
        return t("up.heart.mage.name");
      },
      get desc() {
        return t("up.heart.desc");
      },
      color: "#c1121f",
      text: "#ff4d4d",
      icon: "mheart",
    },
    hunter: {
      tags: ["himoya"],
      get name() {
        return t("up.heart.hunter.name");
      },
      get desc() {
        return t("up.heart.desc");
      },
      color: "#7bd14f",
      icon: "hheart",
    },
    gunner: {
      tags: ["himoya"],
      get name() {
        return t("up.heart.gunner.name");
      },
      get desc() {
        return t("up.heart.desc");
      },
      color: "#c8743a",
      icon: "gheart",
    },
    paladin: {
      tags: ["himoya"],
      get name() {
        return t("up.heart.paladin.name");
      },
      get desc() {
        return t("up.heart.desc");
      },
      color: "#f2c14e",
      icon: "pheart",
    },
    samurai: {
      tags: ["himoya"],
      get name() {
        return t("up.heart.samurai.name");
      },
      get desc() {
        return t("up.heart.desc");
      },
      color: "#ff8fb8",
      icon: "sheart",
    },
  },
  {
    id: "blade",
    get name() {
      return t("up.blade.name");
    },
    get desc() {
      return t("up.blade.desc");
    },
    color: "#68cde4",
    tags: ["zarar"],
    apply: (p) => p.damage++,
    ok: (p) => p.damage < 3,
    mage: {
      tags: ["zarar"],
      get name() {
        return t("up.blade.mage.name");
      },
      get desc() {
        return t("up.blade.mage.desc");
      },
      color: "#ff9a3c",
      icon: "fireball",
    },
    hunter: {
      get name() {
        return t("up.blade.hunter.name");
      },
      get desc() {
        return t("up.blade.hunter.desc");
      },
      color: "#c9a26b",
      icon: "arrowhead",
      tags: ["zarar"],
    },
    gunner: {
      get name() {
        return t("up.blade.gunner.name");
      },
      get desc() {
        return t("up.blade.hunter.desc");
      },
      color: "#d9a441",
      icon: "slug",
      tags: ["zarar"],
    },
    paladin: {
      tags: ["zarar"],
      get name() {
        return t("up.blade.paladin.name");
      },
      get desc() {
        return t("up.blade.paladin.desc");
      },
      color: "#fff2b0",
      icon: "greatblade",
    },
    priestess: {
      tags: ["zarar"],
      get name() {
        return t("up.blade.priestess.name");
      },
      get desc() {
        return t("up.blade.priestess.desc");
      },
      color: "#ffd77a",
      icon: "palm",
    },
    shinobi: {
      tags: ["zarar"],
      get name() {
        return t("up.blade.shinobi.name");
      },
      get desc() {
        return t("up.blade.shinobi.desc");
      },
      color: "#e6e2ea",
      icon: "twinblades",
    },
    samurai: {
      tags: ["zarar"],
      get name() {
        return t("up.blade.samurai.name");
      },
      get desc() {
        return t("up.blade.samurai.desc");
      },
      color: "#ffd6e6",
      icon: "katana",
    },
  },
  {
    id: "reach",
    get name() {
      return t("up.reach.name");
    },
    get desc() {
      return t("up.reach.desc");
    },
    color: "#c5e4ec",
    tags: ["polat"],
    apply: (p) => (p.reach += 5),
    ok: (p) => p.reach < 31,
    mage: {
      tags: ["sehr"],
      get name() {
        return t("up.reach.mage.name");
      },
      get desc() {
        return t("up.reach.mage.desc");
      },
      color: "#ff4d4d",
      icon: "ring",
      apply: (p) => {
        p.reach += 5;
        p.boltSize += 2;
      },
    },
    hunter: {
      tags: ["ov"],
      get name() {
        return t("up.reach.hunter.name");
      },
      get desc() {
        return t("up.reach.hunter.desc");
      },
      color: "#a6f08e",
      icon: "scope",
      apply: (p) => {
        p.boltSpeed += 40;
        p.boltSize += 1;
      },
      ok: (p) => p.boltSpeed < 330,
    },
    gunner: {
      tags: ["porox"],
      get name() {
        return t("up.reach.hunter.name");
      },
      get desc() {
        return t("up.reach.gunner.desc");
      },
      color: "#ffe2a0",
      icon: "sight",
      apply: (p) => {
        p.boltSpeed += 60;
        p.range += 60;
      },
      ok: (p) => p.boltSpeed < 420,
    },
    paladin: {
      tags: ["nur"],
      get name() {
        return t("up.reach.paladin.name");
      },
      get desc() {
        return t("up.reach.paladin.desc");
      },
      color: "#fff2b0",
      icon: "skyblade",
      // 20 -> 25 -> 30: yo'lak 40 -> 50 -> 60 px
      ok: (p) => p.reach < 30,
    },
    priestess: {
      tags: ["lotos"],
      get name() {
        return t("up.reach.priestess.name");
      },
      get desc() {
        return t("up.reach.priestess.desc");
      },
      color: "#fff2b0",
      icon: "palm",
      apply: (p) => (p.reach += 4),
      ok: (p) => p.reach < 25,
    },
    shinobi: {
      tags: ["soya"],
      get name() {
        return t("up.reach.shinobi.name");
      },
      get desc() {
        return t("up.reach.shinobi.desc");
      },
      color: "#e6e2ea",
      icon: "twinblades",
      apply: (p) => {
        p.reach += 4;
        p.boltSpeed += 30;
      },
      ok: (p) => p.reach < 21,
    },
    samurai: {
      tags: ["gul"],
      get name() {
        return t("up.reach.samurai.name");
      },
      get desc() {
        return t("up.reach.samurai.desc");
      },
      color: "#ff8fb8",
      icon: "longiai",
      apply: (p) => (p.iaiRange += IAI_RANGE_CARD),
      // 2 marta: +26, +52 px
      ok: (p) => p.iaiRange < IAI_RANGE_CARD * 2,
    },
  },
  {
    id: "haste",
    get name() {
      return t("up.haste.name");
    },
    get desc() {
      return t("up.haste.desc");
    },
    color: "#ffcc33",
    tags: ["zarar"],
    apply: (p) => (p.attackCd *= 0.75),
    ok: (p) => p.attackCd > 0.2,
    mage: {
      get name() {
        return t("up.haste.mage.name");
      },
      get desc() {
        return t("up.haste.mage.desc");
      },
      color: "#ffd166",
      icon: "book",
      tags: ["zarar"],
    },
    hunter: {
      get name() {
        return t("up.haste.hunter.name");
      },
      get desc() {
        return t("up.haste.hunter.desc");
      },
      color: "#e8c37a",
      icon: "bow",
      tags: ["zarar"],
    },
    gunner: {
      tags: ["zarar"],
      get name() {
        return t("up.haste.gunner.name");
      },
      get desc() {
        return t("up.haste.gunner.desc");
      },
      color: "#e0b04a",
      icon: "cylinder",
      apply: (p) => (p.reloadTime *= 0.7),
      ok: (p) => p.reloadTime > 0.6,
    },
    paladin: {
      tags: ["zarar"],
      get name() {
        return t("up.haste.paladin.name");
      },
      get desc() {
        return t("up.haste.paladin.desc");
      },
      color: "#f2c14e",
      icon: "resolve",
      // tayyorgarlik (0.4s) va zarba vaqtidan qisqarmaydi
      ok: (p) => p.attackCd > 0.66,
    },
    priestess: {
      tags: ["zarar"],
      get name() {
        return t("up.haste.priestess.name");
      },
      get desc() {
        return t("up.haste.priestess.desc");
      },
      color: "#ffd77a",
      icon: "palm",
      // zarba vaqtidan (0.14 s) qisqarmaydi
      apply: (p) => (p.attackCd = Math.max(PALM_TIME + 0.01, p.attackCd * 0.75)),
      ok: (p) => p.attackCd > 0.17,
    },
    shinobi: {
      tags: ["zarar"],
      get name() {
        return t("up.haste.shinobi.name");
      },
      get desc() {
        return t("up.haste.shinobi.desc");
      },
      color: "#ff8a94",
      icon: "twinblades",
      // zarba vaqtidan (0.12 s) qisqarmaydi
      apply: (p) => (p.attackCd = Math.max(TWIN_TIME + 0.01, p.attackCd * 0.75)),
      ok: (p) => p.attackCd > 0.14,
    },
    samurai: {
      tags: ["zarar"],
      get name() {
        return t("up.haste.samurai.name");
      },
      get desc() {
        return t("up.haste.samurai.desc");
      },
      color: "#ffd6e6",
      icon: "quickdraw",
      // zarba vaqtidan (0.18 s) qisqarmaydi
      apply: (p) => (p.attackCd = Math.max(KATANA_TIME + 0.01, p.attackCd * 0.75)),
      ok: (p) => p.attackCd > 0.2,
    },
  },
  {
    id: "wind",
    get name() {
      return t("up.wind.name");
    },
    get desc() {
      return t("up.wind.desc");
    },
    color: "#a6f08e",
    tags: ["tezlik"],
    apply: (p) => {
      p.speed *= 1.15;
      p.dashCd *= 0.75;
    },
    ok: (p) => p.speed < 130,
    mage: {
      tags: ["tezlik"],
      get name() {
        return t("up.wind.mage.name");
      },
      get desc() {
        return t("up.wind.mage.desc");
      },
      color: "#d9d4e0",
      icon: "wstar",
    },
    hunter: {
      tags: ["tezlik"],
      get name() {
        return t("up.wind.hunter.name");
      },
      get desc() {
        return t("up.wind.hunter.desc");
      },
      color: "#7bd14f",
      icon: "leaf",
    },
    gunner: {
      tags: ["tezlik"],
      get name() {
        return t("up.wind.gunner.name");
      },
      get desc() {
        return t("up.wind.gunner.desc");
      },
      color: "#b07a48",
      icon: "spur",
    },
    paladin: {
      tags: ["tezlik"],
      get name() {
        return t("up.wind.paladin.name");
      },
      get desc() {
        return t("up.wind.paladin.desc");
      },
      color: "#fff2b0",
      icon: "path",
    },
    priestess: {
      tags: ["tezlik"],
      get name() {
        return t("up.wind.priestess.name");
      },
      get desc() {
        return t("up.wind.priestess.desc");
      },
      color: "#fff2b0",
      icon: "holytrail",
    },
    shinobi: {
      tags: ["tezlik"],
      get name() {
        return t("up.wind.shinobi.name");
      },
      get desc() {
        return t("up.wind.shinobi.desc");
      },
      color: "#b0a8c0",
      icon: "vanish",
    },
    samurai: {
      tags: ["tezlik"],
      get name() {
        return t("up.wind.name");
      },
      get desc() {
        return t("up.wind.samurai.desc");
      },
      color: "#ffd6e6",
      icon: "windstep",
      apply: (p) => {
        p.speed *= 1.15;
        p.dashCd *= 0.75;
        p.dodgeWindow += DODGE_WINDOW_CARD;
      },
    },
  },
  {
    id: "vamp",
    get name() {
      return t("up.vamp.name");
    },
    get desc() {
      return t("up.vamp.desc");
    },
    color: "#b23238",
    tags: ["hayot"],
    apply: (p) => (p.lifesteal = p.lifesteal ? Math.max(3, p.lifesteal - 2) : 6),
    ok: (p) => p.lifesteal !== 3,
    mage: {
      tags: ["hayot"],
      get name() {
        return t("up.vamp.mage.name");
      },
      get desc() {
        return t("up.vamp.desc");
      },
      color: "#c1121f",
      text: "#ff4d4d",
      icon: "spirit",
    },
    hunter: {
      tags: ["hayot"],
      get name() {
        return t("up.vamp.hunter.name");
      },
      get desc() {
        return t("up.vamp.desc");
      },
      color: "#c9a26b",
      icon: "fang",
    },
    gunner: {
      tags: ["hayot"],
      get name() {
        return t("up.vamp.gunner.name");
      },
      get desc() {
        return t("up.vamp.desc");
      },
      color: "#d9a441",
      icon: "bounty",
    },
    paladin: {
      tags: ["hayot"],
      get name() {
        return t("up.vamp.paladin.name");
      },
      get desc() {
        return t("up.vamp.desc");
      },
      color: "#f2c14e",
      icon: "faith",
    },
    samurai: {
      tags: ["hayot"],
      get name() {
        return t("up.vamp.samurai.name");
      },
      get desc() {
        return t("up.vamp.desc");
      },
      color: "#d8324a",
      text: "#ff8fb8",
      icon: "thirst",
    },
  },
  {
    id: "thorns",
    get name() {
      return t("up.thorns.name");
    },
    get desc() {
      return t("up.thorns.desc");
    },
    color: "#c9a26b",
    tags: ["himoya"],
    apply: (p) => (p.thorns = true),
    ok: (p) => !p.thorns,
    mage: {
      tags: ["himoya"],
      get name() {
        return t("up.thorns.mage.name");
      },
      get desc() {
        return t("up.thorns.mage.desc");
      },
      color: "#d9d4e0",
      icon: "ice",
      apply: (p) => (p.frost = true),
      ok: (p) => !p.frost,
    },
    hunter: {
      tags: ["himoya"],
      get name() {
        return t("up.thorns.hunter.name");
      },
      get desc() {
        return t("up.thorns.desc");
      },
      color: "#a6f08e",
      icon: "thorn",
    },
    gunner: {
      tags: ["himoya"],
      get name() {
        return t("up.thorns.gunner.name");
      },
      get desc() {
        return t("up.thorns.desc");
      },
      color: "#9a948a",
      icon: "vest",
    },
    paladin: {
      tags: ["himoya"],
      get name() {
        return t("up.thorns.paladin.name");
      },
      get desc() {
        return t("up.thorns.desc");
      },
      color: "#f2c14e",
      icon: "avenger",
    },
    samurai: {
      tags: ["himoya"],
      get name() {
        return t("up.thorns.samurai.name");
      },
      get desc() {
        return t("up.thorns.samurai.desc");
      },
      color: "#ffd6e6",
      icon: "steelback",
      apply: (p) => (p.parryBoost = true),
      ok: (p) => !p.parryBoost,
    },
  },
  {
    id: "dash2",
    get name() {
      return t("up.dash2.name");
    },
    get desc() {
      return t("up.dash2.desc");
    },
    color: "#7fd8ff",
    tags: ["tezlik"],
    apply: (p) => (p.dashMax = 2),
    ok: (p) => p.dashMax < 2,
    mage: {
      tags: ["tezlik"],
      get name() {
        return t("up.dash2.mage.name");
      },
      get desc() {
        return t("up.dash2.mage.desc");
      },
      color: "#ff4d4d",
      icon: "portal",
    },
    hunter: {
      tags: ["tezlik"],
      get name() {
        return t("up.dash2.hunter.name");
      },
      get desc() {
        return t("up.dash2.hunter.desc");
      },
      color: "#e8c37a",
      icon: "boots",
    },
    gunner: {
      tags: ["tezlik"],
      get name() {
        return t("up.dash2.gunner.name");
      },
      get desc() {
        return t("up.dash2.gunner.desc");
      },
      color: "#d9a441",
      icon: "slide2",
    },
    paladin: {
      tags: ["tezlik"],
      get name() {
        return t("up.dash2.paladin.name");
      },
      get desc() {
        return t("up.dash2.paladin.desc");
      },
      color: "#f2c14e",
      icon: "hamla2",
    },
    priestess: {
      tags: ["tezlik"],
      get name() {
        return t("up.dash2.priestess.name");
      },
      get desc() {
        return t("up.dash2.priestess.desc");
      },
      color: "#fff2b0",
      icon: "holytrail",
    },
    shinobi: {
      tags: ["tezlik"],
      get name() {
        return t("up.dash2.shinobi.name");
      },
      get desc() {
        return t("up.dash2.shinobi.desc");
      },
      color: "#b0a8c0",
      icon: "vanish",
    },
    samurai: {
      tags: ["tezlik"],
      get name() {
        return t("up.dash2.samurai.name");
      },
      get desc() {
        return t("up.dash2.desc");
      },
      color: "#ff8fb8",
      icon: "step2",
    },
  },
  {
    id: "mend",
    get name() {
      return t("up.mend.name");
    },
    get desc() {
      return t("up.mend.desc");
    },
    color: "#f2fbe4",
    tags: ["hayot"],
    apply: (p) => (p.hp = p.maxHp),
    ok: (p) => p.hp < p.maxHp,
    mage: {
      tags: ["hayot"],
      get name() {
        return t("up.mend.mage.name");
      },
      get desc() {
        return t("up.mend.desc");
      },
      color: "#c1121f",
      text: "#ff4d4d",
      icon: "elixir",
    },
    hunter: {
      tags: ["hayot"],
      get name() {
        return t("up.mend.hunter.name");
      },
      get desc() {
        return t("up.mend.desc");
      },
      color: "#7bd14f",
      icon: "herb",
    },
    gunner: {
      tags: ["hayot"],
      get name() {
        return t("up.mend.gunner.name");
      },
      get desc() {
        return t("up.mend.desc");
      },
      color: "#c8743a",
      icon: "flask",
    },
    paladin: {
      tags: ["hayot"],
      get name() {
        return t("up.mend.paladin.name");
      },
      get desc() {
        return t("up.mend.desc");
      },
      color: "#fff2b0",
      icon: "prayer",
    },
    samurai: {
      tags: ["hayot"],
      get name() {
        return t("up.mend.samurai.name");
      },
      get desc() {
        return t("up.mend.desc");
      },
      color: "#a6f08e",
      icon: "tea",
    },
  },
  // ---- Faqat Sehrgar ----
  {
    id: "triple",
    get name() {
      return t("up.triple.name");
    },
    get desc() {
      return t("up.triple.desc");
    },
    color: "#ff4d4d",
    tags: ["sehr"],
    icon: "orbs",
    hero: "mage",
    apply: (p) => (p.multishot = 3),
    ok: (p) => p.multishot < 3,
  },
  {
    id: "pierce",
    get name() {
      return t("up.pierce.name");
    },
    get desc() {
      return t("up.pierce.desc");
    },
    color: "#ff4d4d",
    tags: ["sehr"],
    icon: "crystal",
    hero: "mage",
    apply: (p) => (p.pierce = 1),
    ok: (p) => p.pierce < 1,
  },
  // ---- Faqat Ovchi ----
  {
    id: "htriple",
    get name() {
      return t("up.htriple.name");
    },
    get desc() {
      return t("up.htriple.desc");
    },
    color: "#e8c37a",
    tags: ["ov"],
    icon: "arrows3",
    hero: "hunter",
    apply: (p) => (p.multishot = 3),
    ok: (p) => p.multishot < 3,
  },
  {
    id: "venom",
    get name() {
      return t("up.venom.name");
    },
    get desc() {
      return t("up.venom.desc");
    },
    color: "#a6f08e",
    tags: ["ov"],
    icon: "venom",
    hero: "hunter",
    apply: (p) => (p.poisonTip = true),
    ok: (p) => !p.poisonTip,
  },
  // ---- Faqat Mergan ----
  {
    id: "drum",
    get name() {
      return t("up.drum.name");
    },
    get desc() {
      return t("up.drum.desc");
    },
    color: "#d9a441",
    tags: ["porox"],
    icon: "drum",
    hero: "gunner",
    apply: (p) => {
      p.ammoMax = 8;
      p.ammo = 8;
      p.reloadT = 0;
    },
    ok: (p) => p.ammoMax < 8,
  },
  {
    id: "ricochet",
    get name() {
      return t("up.ricochet.name");
    },
    get desc() {
      return t("up.ricochet.desc");
    },
    color: "#ffe2a0",
    tags: ["porox"],
    icon: "ricochet",
    hero: "gunner",
    apply: (p) => (p.bounce = 1),
    ok: (p) => p.bounce < 1,
  },
  // ---- Faqat Paladin ----
  {
    id: "shockwave",
    get name() {
      return t("up.shockwave.name");
    },
    get desc() {
      return t("up.shockwave.desc");
    },
    color: "#f2c14e",
    tags: ["nur"],
    icon: "shockwave",
    hero: "paladin",
    apply: (p) => (p.shockwave = true),
    ok: (p) => !p.shockwave,
  },
  {
    id: "aura",
    get name() {
      return t("up.aura.name");
    },
    get desc() {
      return t("up.aura.desc");
    },
    color: "#fff2b0",
    tags: ["nur"],
    icon: "aura",
    hero: "paladin",
    apply: (p) => (p.aura = true),
    ok: (p) => !p.aura,
  },
  // ---- Faqat Samuray ----
  {
    id: "twincut",
    get name() {
      return t("up.twincut.name");
    },
    get desc() {
      return t("up.twincut.desc");
    },
    color: "#ff8fb8",
    tags: ["gul"],
    icon: "twincut",
    hero: "samurai",
    apply: (p) => (p.iaiDouble = true),
    ok: (p) => !p.iaiDouble,
  },
  {
    id: "petalstorm",
    get name() {
      return t("up.petalstorm.name");
    },
    get desc() {
      return t("up.petalstorm.desc");
    },
    color: "#ffd6e6",
    tags: ["gul"],
    icon: "petalstorm",
    hero: "samurai",
    apply: (p) => (p.petalStorm = true),
    ok: (p) => !p.petalStorm,
  },
  {
    id: "coldblood",
    get name() {
      return t("up.coldblood.name");
    },
    get desc() {
      return t("up.coldblood.desc");
    },
    color: "#9fd0ef",
    tags: ["gul"],
    icon: "coldblood",
    hero: "samurai",
    apply: (p) => (p.coldBlood = true),
    ok: (p) => !p.coldBlood,
  },
  // ---- Faqat Ninja ----
  {
    id: "manystars",
    get name() {
      return t("up.manystars.name");
    },
    get desc() {
      return t("up.manystars.desc");
    },
    color: "#e6e2ea",
    tags: ["soya"],
    icon: "shuriken",
    hero: "shinobi",
    apply: (p) => (p.shurikens += SHURIKEN_CARD),
    ok: (p) => p.shurikens < SHURIKEN_N + SHURIKEN_CARD,
  },
  {
    id: "longshadow",
    get name() {
      return t("up.longshadow.name");
    },
    get desc() {
      return t("up.longshadow.desc");
    },
    color: "#b0a8c0",
    tags: ["soya"],
    icon: "vanish",
    hero: "shinobi",
    apply: (p) => (p.vanishTime += VANISH_CARD),
    ok: (p) => p.vanishTime < VANISH_TIME + VANISH_CARD,
  },
  {
    id: "backstab",
    get name() {
      return t("up.backstab.name");
    },
    get desc() {
      return t("up.backstab.desc");
    },
    color: "#ff6f91",
    tags: ["soya"],
    icon: "backstab",
    hero: "shinobi",
    apply: (p) => (p.ambushMul = Math.max(p.ambushMul, AMBUSH_CARD)),
    ok: (p) => p.ambushMul < AMBUSH_CARD,
  },
  {
    id: "poisonstar",
    get name() {
      return t("up.poisonstar.name");
    },
    get desc() {
      return t("up.poisonstar.desc");
    },
    color: "#a6f08e",
    tags: ["soya"],
    icon: "poisonstar",
    hero: "shinobi",
    apply: (p) => (p.poisonStar = true),
    ok: (p) => !p.poisonStar,
  },
  // ---- SUPER kartalari (ILOHIY HUKM — Paladin): kam uchraydi, "SUPER" tegli ----
  {
    id: "sunshield",
    get name() {
      return t("up.sunshield.name");
    },
    get desc() {
      return t("up.sunshield.desc");
    },
    color: "#fff2b0",
    tags: ["super"],
    icon: "sunshield",
    hero: "paladin",
    super: "divine-judgment",
    rare: SUPER_CARD_CHANCE,
    apply: (p) => (p.sunShieldCard = true),
    ok: (p) => !p.sunShieldCard,
  },
  {
    id: "secondjudgment",
    get name() {
      return t("up.secondjudgment.name");
    },
    get desc() {
      return t("up.secondjudgment.desc");
    },
    color: "#fff2b0",
    tags: ["super"],
    icon: "secondjudgment",
    hero: "paladin",
    super: "divine-judgment",
    rare: SUPER_CARD_CHANCE,
    apply: (p) => (p.secondJudgment = true),
    ok: (p) => !p.secondJudgment,
  },
  // ---- SUPER kartalari (MING KESIM — Samuray) ----
  {
    id: "secondbreath",
    get name() {
      return t("up.secondbreath.name");
    },
    get desc() {
      return t("up.secondbreath.desc");
    },
    color: "#ffd6e6",
    tags: ["super"],
    icon: "secondbreath",
    hero: "samurai",
    super: "thousand-cuts",
    rare: SUPER_CARD_CHANCE,
    apply: (p) => (p.secondBreath = true),
    ok: (p) => !p.secondBreath,
  },
  {
    id: "petalveil",
    get name() {
      return t("up.petalveil.name");
    },
    get desc() {
      return t("up.petalveil.desc");
    },
    color: "#ffd6e6",
    tags: ["super"],
    icon: "petalveil",
    hero: "samurai",
    super: "thousand-cuts",
    rare: SUPER_CARD_CHANCE,
    apply: (p) => (p.petalVeil = true),
    ok: (p) => !p.petalVeil,
  },
  // ---- SUPER kartalari (SOYA BO'RONI — Ninja) ----
  {
    id: "smokeveil",
    get name() {
      return t("up.smokeveil.name");
    },
    get desc() {
      return t("up.smokeveil.desc");
    },
    color: "#b0a8c0",
    tags: ["super"],
    icon: "smokeveil",
    hero: "shinobi",
    super: "shadow-storm",
    rare: SUPER_CARD_CHANCE,
    apply: (p) => (p.smokeVeil = true),
    ok: (p) => !p.smokeVeil,
  },
  {
    id: "shadowtrail",
    get name() {
      return t("up.shadowtrail.name");
    },
    get desc() {
      return t("up.shadowtrail.desc");
    },
    color: "#ff6f91",
    tags: ["super"],
    icon: "shadowtrail",
    hero: "shinobi",
    super: "shadow-storm",
    rare: SUPER_CARD_CHANCE,
    apply: (p) => (p.shadowTrail = true),
    ok: (p) => !p.shadowTrail,
  },
  // ---- Faqat Rohiba ----
  {
    id: "mercy",
    get name() {
      return t("up.mercy.name");
    },
    get desc() {
      return t("up.mercy.desc");
    },
    color: "#ffb3c0",
    tags: ["lotos"],
    icon: "mercy",
    hero: "priestess",
    apply: (p) => (p.mercyHits = MERCY_CARD),
    ok: (p) => p.mercyHits > MERCY_CARD,
  },
  {
    id: "longbeam",
    get name() {
      return t("up.longbeam.name");
    },
    get desc() {
      return t("up.longbeam.desc");
    },
    color: "#fff2b0",
    tags: ["lotos"],
    icon: "beam",
    hero: "priestess",
    apply: (p) => (p.beamLen += BEAM_CARD),
    ok: (p) => p.beamLen < BEAM_LEN + BEAM_CARD,
  },
  {
    id: "longtrail",
    get name() {
      return t("up.longtrail.name");
    },
    get desc() {
      return t("up.longtrail.desc");
    },
    color: "#ffd77a",
    tags: ["lotos"],
    icon: "holytrail",
    hero: "priestess",
    apply: (p) => (p.trailLife += TRAIL_CARD),
    ok: (p) => p.trailLife < TRAIL_LIFE + TRAIL_CARD,
  },
  {
    id: "dazzle",
    get name() {
      return t("up.dazzle.name");
    },
    get desc() {
      return t("up.dazzle.desc");
    },
    color: "#fffbe8",
    tags: ["lotos"],
    icon: "dazzle",
    hero: "priestess",
    apply: (p) => (p.beamStun = true),
    ok: (p) => !p.beamStun,
  },
  // ---- SUPER kartalari (OLTIN LOTOS — Rohiba) ----
  {
    id: "lotusgrace",
    get name() {
      return t("up.lotusgrace.name");
    },
    get desc() {
      return t("up.lotusgrace.desc");
    },
    color: "#ffd77a",
    tags: ["super"],
    icon: "lotus",
    hero: "priestess",
    super: "golden-lotus",
    rare: SUPER_CARD_CHANCE,
    apply: (p) => (p.lotusGrace = true),
    ok: (p) => !p.lotusGrace,
  },
  {
    id: "lightflow",
    get name() {
      return t("up.lightflow.name");
    },
    get desc() {
      return t("up.lightflow.desc");
    },
    color: "#fff2b0",
    tags: ["super"],
    icon: "lightflow",
    hero: "priestess",
    super: "golden-lotus",
    rare: SUPER_CARD_CHANCE,
    apply: (p) => (p.lightFlow = true),
    ok: (p) => !p.lightFlow,
  },
  // ---- SUPER kartalari (UFQ KESIMI — Ritsar) ----
  {
    id: "doublehorizon",
    get name() {
      return t("up.doublehorizon.name");
    },
    get desc() {
      return t("up.doublehorizon.desc");
    },
    color: "#c5e4ec",
    tags: ["super"],
    icon: "doublehorizon",
    hero: "knight",
    super: "horizon-cut",
    rare: SUPER_CARD_CHANCE,
    apply: (p) => (p.doubleHorizon = true),
    ok: (p) => !p.doubleHorizon,
  },
  {
    id: "wideblade",
    get name() {
      return t("up.wideblade.name");
    },
    get desc() {
      return t("up.wideblade.desc");
    },
    color: "#c5e4ec",
    tags: ["super"],
    icon: "wideblade",
    hero: "knight",
    super: "horizon-cut",
    rare: SUPER_CARD_CHANCE,
    apply: (p) => (p.wideBlade = true),
    ok: (p) => !p.wideBlade,
  },
  // ---- SUPER kartalari (OSMON TOSHI — Sehrgar) ----
  {
    id: "meteorrain",
    get name() {
      return t("up.meteorrain.name");
    },
    get desc() {
      return t("up.meteorrain.desc");
    },
    color: "#ff9a3c",
    tags: ["super"],
    icon: "meteorrain",
    hero: "mage",
    super: "sky-stone",
    rare: SUPER_CARD_CHANCE,
    apply: (p) => (p.meteorRain = true),
    ok: (p) => !p.meteorRain,
  },
  {
    id: "eternalcrater",
    get name() {
      return t("up.eternalcrater.name");
    },
    get desc() {
      return t("up.eternalcrater.desc");
    },
    color: "#ff9a3c",
    tags: ["super"],
    icon: "eternalcrater",
    hero: "mage",
    super: "sky-stone",
    rare: SUPER_CARD_CHANCE,
    apply: (p) => (p.eternalCrater = true),
    ok: (p) => !p.eternalCrater,
  },
  // ---- SUPER kartalari (O'N O'Q OVI — Ovchi) ----
  {
    id: "fifteenarrows",
    get name() {
      return t("up.fifteenarrows.name");
    },
    get desc() {
      return t("up.fifteenarrows.desc");
    },
    color: "#8fd14f",
    tags: ["super"],
    icon: "fifteenarrows",
    hero: "hunter",
    super: "ten-arrows",
    rare: SUPER_CARD_CHANCE,
    apply: (p) => (p.fifteenArrows = true),
    ok: (p) => !p.fifteenArrows,
  },
  {
    id: "chainblast",
    get name() {
      return t("up.chainblast.name");
    },
    get desc() {
      return t("up.chainblast.desc");
    },
    color: "#8fd14f",
    tags: ["super"],
    icon: "chainblast",
    hero: "hunter",
    super: "ten-arrows",
    rare: SUPER_CARD_CHANCE,
    apply: (p) => (p.chainBlast = true),
    ok: (p) => !p.chainBlast,
  },
  // ---- SUPER kartalari (CHEKSIZ O'Q — Mergan) ----
  {
    id: "hotsteel",
    get name() {
      return t("up.hotsteel.name");
    },
    get desc() {
      return t("up.hotsteel.desc");
    },
    color: "#ff9a3c",
    tags: ["super"],
    icon: "hotsteel",
    hero: "gunner",
    super: "endless-lead",
    rare: SUPER_CARD_CHANCE,
    apply: (p) => (p.hotSteel = true),
    ok: (p) => !p.hotSteel,
  },
  {
    id: "longprairie",
    get name() {
      return t("up.longprairie.name");
    },
    get desc() {
      return t("up.longprairie.desc");
    },
    color: "#ff9a3c",
    tags: ["super"],
    icon: "longprairie",
    hero: "gunner",
    super: "endless-lead",
    rare: SUPER_CARD_CHANCE,
    apply: (p) => (p.longPrairie = true),
    ok: (p) => !p.longPrairie,
  },
];

/**
 * n ta turli, hozir foydali bo'lgan kuchaytirishni tanlaydi. SUPER kartalari faqat shu superi bor
 * qahramonga va kam (rare ehtimol bilan) chiqadi — boshqa qahramonlarda tasodif ketma-ketligi
 * o'zgarmaydi (kunlik sinov seed'i).
 */
export function pickUpgrades(p: Player, n = 3, rand = Math.random): Upgrade[] {
  const sup = superFor(p.hero)?.id;
  const pool = UPGRADES.filter((u) => !u.hero || u.hero === p.hero)
    .filter((u) => !u.super || u.super === sup)
    .map((u) => cardFor(u, p))
    .filter((u) => u.ok(p))
    .filter((u) => u.rare === undefined || rand() < u.rare);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, n);
}
