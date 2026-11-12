import type { EnemyKind } from "./enemy";
import { DODGE_WINDOW_CARD, IAI_RANGE_CARD, KATANA_TIME, type Player } from "./player";
import type { Hero } from "./hero";

/** Dunyo: 1 — Olovli zindon, 2 — Muz sardobasi, 3 — Zulmat o'rmoni */
export type World = 1 | 2 | 3;

/** Har dunyoning o'z moblari (Bosslardan tashqari): boshqa dunyo moblari chiqmaydi. */
export const WORLD_KINDS: Record<World, readonly EnemyKind[]> = {
  1: ["blob", "wisp", "rammer", "archer"],
  2: ["iceblob", "frost", "golem", "shield", "wolf"],
  3: ["spider", "shroom", "treant", "owl"],
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
  if (n === 0) return (world === 3 ? WAVES3 : world === 2 ? WAVES2 : WAVES)[i]!;
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
  "zarar" | "tezlik" | "himoya" | "hayot" | "polat" | "sehr" | "ov" | "porox" | "nur" | "gul";

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
  /** Faqat shu qahramonga chiqadi */
  hero?: Hero;
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
              : undefined;
  if (!alt) return u;
  const { mage: _m, hunter: _h, gunner: _g, paladin: _p, samurai: _s, ...base } = u;
  return { ...base, ...alt };
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
    tags: ["himoya"],
    apply: (p) => {
      p.maxHp++;
      p.hp = p.maxHp;
    },
    ok: (p) => p.maxHp < 10,
    mage: {
      tags: ["himoya"],
      name: "SEHRLI YURAK",
      desc: "+1 yurak va to'liq davolanish",
      color: "#c1121f",
      text: "#ff4d4d",
      icon: "mheart",
    },
    hunter: {
      tags: ["himoya"],
      name: "OVCHI YURAGI",
      desc: "+1 yurak va to'liq davolanish",
      color: "#7bd14f",
      icon: "hheart",
    },
    gunner: {
      tags: ["himoya"],
      name: "QAYSAR YURAK",
      desc: "+1 yurak va to'liq davolanish",
      color: "#c8743a",
      icon: "gheart",
    },
    paladin: {
      tags: ["himoya"],
      name: "MUQADDAS YURAK",
      desc: "+1 yurak va to'liq davolanish",
      color: "#f2c14e",
      icon: "pheart",
    },
    samurai: {
      tags: ["himoya"],
      name: "SAKURA YURAGI",
      desc: "+1 yurak va to'liq davolanish",
      color: "#ff8fb8",
      icon: "sheart",
    },
  },
  {
    id: "blade",
    name: "O'TKIR QILICH",
    desc: "Qilich zarari +1",
    color: "#68cde4",
    tags: ["zarar"],
    apply: (p) => p.damage++,
    ok: (p) => p.damage < 3,
    mage: {
      tags: ["zarar"],
      name: "KUCHLI SEHR",
      desc: "Shar va halqa zarari +1",
      color: "#ff9a3c",
      icon: "fireball",
    },
    hunter: {
      name: "O'TKIR UCH",
      desc: "O'q zarari +1",
      color: "#c9a26b",
      icon: "arrowhead",
      tags: ["zarar"],
    },
    gunner: {
      name: "OG'IR O'Q",
      desc: "O'q zarari +1",
      color: "#d9a441",
      icon: "slug",
      tags: ["zarar"],
    },
    paladin: {
      tags: ["zarar"],
      name: "OG'IR TIG'",
      desc: "SHANG va osmon hukmi zarari oshadi",
      color: "#fff2b0",
      icon: "greatblade",
    },
    samurai: {
      tags: ["zarar"],
      name: "O'TKIR KATANA",
      desc: "Katana va Iai zarari oshadi",
      color: "#ffd6e6",
      icon: "katana",
    },
  },
  {
    id: "reach",
    name: "UZUN TIG'",
    desc: "Zarba maydoni kattaroq",
    color: "#c5e4ec",
    tags: ["polat"],
    apply: (p) => (p.reach += 5),
    ok: (p) => p.reach < 31,
    mage: {
      tags: ["sehr"],
      name: "KENG HALQA",
      desc: "Halqa kattaroq, shar biroz kattaroq",
      color: "#ff4d4d",
      icon: "ring",
      apply: (p) => {
        p.reach += 5;
        p.boltSize += 2;
      },
    },
    hunter: {
      tags: ["ov"],
      name: "UZOQ NISHON",
      desc: "O'qlar tezroq va kattaroq uchadi",
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
      name: "UZOQ NISHON",
      desc: "O'q tezroq va uzoqroq uchadi",
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
      name: "OSMON QILICHI",
      desc: "SHANG yo'lagi uzunroq",
      color: "#fff2b0",
      icon: "skyblade",
      // 20 -> 25 -> 30: yo'lak 40 -> 50 -> 60 px
      ok: (p) => p.reach < 30,
    },
    samurai: {
      tags: ["gul"],
      name: "UZUN IAI",
      desc: "Iai uzoqroqqa sirpanadi",
      color: "#ff8fb8",
      icon: "longiai",
      apply: (p) => (p.iaiRange += IAI_RANGE_CARD),
      // 2 marta: +26, +52 px
      ok: (p) => p.iaiRange < IAI_RANGE_CARD * 2,
    },
  },
  {
    id: "haste",
    name: "CHAQQON QO'L",
    desc: "Zarbalar orasi 25% qisqa",
    color: "#ffcc33",
    tags: ["zarar"],
    apply: (p) => (p.attackCd *= 0.75),
    ok: (p) => p.attackCd > 0.2,
    mage: {
      name: "TEZ AFSUN",
      desc: "Sharlar orasi 25% qisqa",
      color: "#ffd166",
      icon: "book",
      tags: ["zarar"],
    },
    hunter: {
      name: "TEZ KAMON",
      desc: "O'qlar orasi 25% qisqa",
      color: "#e8c37a",
      icon: "bow",
      tags: ["zarar"],
    },
    gunner: {
      tags: ["zarar"],
      name: "TEZ QO'L",
      desc: "Qayta o'qlash 30% tez",
      color: "#e0b04a",
      icon: "cylinder",
      apply: (p) => (p.reloadTime *= 0.7),
      ok: (p) => p.reloadTime > 0.6,
    },
    paladin: {
      tags: ["zarar"],
      name: "QAT'IYAT",
      desc: "SHANG 25% tezroq qaytadi",
      color: "#f2c14e",
      icon: "resolve",
      // tayyorgarlik (0.4s) va zarba vaqtidan qisqarmaydi
      ok: (p) => p.attackCd > 0.66,
    },
    samurai: {
      tags: ["zarar"],
      name: "TEZ QIN",
      desc: "Katana zarbalari orasi 25% qisqa",
      color: "#ffd6e6",
      icon: "quickdraw",
      // zarba vaqtidan (0.18 s) qisqarmaydi
      apply: (p) => (p.attackCd = Math.max(KATANA_TIME + 0.01, p.attackCd * 0.75)),
      ok: (p) => p.attackCd > 0.2,
    },
  },
  {
    id: "wind",
    name: "SHAMOL QADAMI",
    desc: "Tezlik +15%, dash tezroq qaytadi",
    color: "#a6f08e",
    tags: ["tezlik"],
    apply: (p) => {
      p.speed *= 1.15;
      p.dashCd *= 0.75;
    },
    ok: (p) => p.speed < 130,
    mage: {
      tags: ["tezlik"],
      name: "EFIR QADAMI",
      desc: "Tezlik +15%, teleport tezroq qaytadi",
      color: "#d9d4e0",
      icon: "wstar",
    },
    hunter: {
      tags: ["tezlik"],
      name: "O'RMON QADAMI",
      desc: "Tezlik +15%, sakrash tezroq qaytadi",
      color: "#7bd14f",
      icon: "leaf",
    },
    gunner: {
      tags: ["tezlik"],
      name: "CHAQQON OYOQ",
      desc: "Tezlik +15%, sirpanish tezroq qaytadi",
      color: "#b07a48",
      icon: "spur",
    },
    paladin: {
      tags: ["tezlik"],
      name: "HAQ YO'LI",
      desc: "Tezlik +15%, hamla tezroq qaytadi",
      color: "#fff2b0",
      icon: "path",
    },
    samurai: {
      tags: ["tezlik"],
      name: "SHAMOL QADAMI",
      desc: "Tezlik +15%, mukammal chetlanish oynasi kengroq",
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
    name: "QON TOMIRI",
    desc: "Har bir necha o'ldirishda +1 yurak",
    color: "#b23238",
    tags: ["hayot"],
    apply: (p) => (p.lifesteal = p.lifesteal ? Math.max(3, p.lifesteal - 2) : 6),
    ok: (p) => p.lifesteal !== 3,
    mage: {
      tags: ["hayot"],
      name: "RUH SO'RISH",
      desc: "Har bir necha o'ldirishda +1 yurak",
      color: "#c1121f",
      text: "#ff4d4d",
      icon: "spirit",
    },
    hunter: {
      tags: ["hayot"],
      name: "OV O'LJASI",
      desc: "Har bir necha o'ldirishda +1 yurak",
      color: "#c9a26b",
      icon: "fang",
    },
    gunner: {
      tags: ["hayot"],
      name: "OV PULI",
      desc: "Har bir necha o'ldirishda +1 yurak",
      color: "#d9a441",
      icon: "bounty",
    },
    paladin: {
      tags: ["hayot"],
      name: "IMON NURI",
      desc: "Har bir necha o'ldirishda +1 yurak",
      color: "#f2c14e",
      icon: "faith",
    },
    samurai: {
      tags: ["hayot"],
      name: "TIG' TASHNALIGI",
      desc: "Har bir necha o'ldirishda +1 yurak",
      color: "#d8324a",
      text: "#ff8fb8",
      icon: "thirst",
    },
  },
  {
    id: "thorns",
    name: "TIKANLI ZIRH",
    desc: "Zarba yesang, yaqin dushmanga 1 zarar",
    color: "#c9a26b",
    tags: ["himoya"],
    apply: (p) => (p.thorns = true),
    ok: (p) => !p.thorns,
    mage: {
      tags: ["himoya"],
      name: "MUZ QALQONI",
      desc: "Jon yo'qotsang, atrofdagilar 1.5s sekinlashadi",
      color: "#d9d4e0",
      icon: "ice",
      apply: (p) => (p.frost = true),
      ok: (p) => !p.frost,
    },
    hunter: {
      tags: ["himoya"],
      name: "TIKANLI PLASH",
      desc: "Zarba yesang, yaqin dushmanga 1 zarar",
      color: "#a6f08e",
      icon: "thorn",
    },
    gunner: {
      tags: ["himoya"],
      name: "TEMIR KAMZUL",
      desc: "Zarba yesang, yaqin dushmanga 1 zarar",
      color: "#9a948a",
      icon: "vest",
    },
    paladin: {
      tags: ["himoya"],
      name: "QASOS ZIRHI",
      desc: "Zarba yesang, yaqin dushmanga 1 zarar",
      color: "#f2c14e",
      icon: "avenger",
    },
    samurai: {
      tags: ["himoya"],
      name: "QAYTGAN PO'LAT",
      desc: "Parry dan keyin 2 s tezlashasan",
      color: "#ffd6e6",
      icon: "steelback",
      apply: (p) => (p.parryBoost = true),
      ok: (p) => !p.parryBoost,
    },
  },
  {
    id: "dash2",
    name: "IKKI KARRA DASH",
    desc: "Ketma-ket 2 ta dash",
    color: "#7fd8ff",
    tags: ["tezlik"],
    apply: (p) => (p.dashMax = 2),
    ok: (p) => p.dashMax < 2,
    mage: {
      tags: ["tezlik"],
      name: "IKKI KARRA TELEPORT",
      desc: "Ketma-ket 2 ta teleport",
      color: "#ff4d4d",
      icon: "portal",
    },
    hunter: {
      tags: ["tezlik"],
      name: "IKKI KARRA SAKRASH",
      desc: "Ketma-ket 2 ta orqaga sakrash",
      color: "#e8c37a",
      icon: "boots",
    },
    gunner: {
      tags: ["tezlik"],
      name: "IKKI KARRA SIRPANISH",
      desc: "Ketma-ket 2 ta sirpanish",
      color: "#d9a441",
      icon: "slide2",
    },
    paladin: {
      tags: ["tezlik"],
      name: "IKKI KARRA HAMLA",
      desc: "Ketma-ket 2 ta muqaddas hamla",
      color: "#f2c14e",
      icon: "hamla2",
    },
    samurai: {
      tags: ["tezlik"],
      name: "IKKI KARRA QADAM",
      desc: "Ketma-ket 2 ta dash",
      color: "#ff8fb8",
      icon: "step2",
    },
  },
  {
    id: "mend",
    name: "SHIFO",
    desc: "Barcha yuraklarni tiklash",
    color: "#f2fbe4",
    tags: ["hayot"],
    apply: (p) => (p.hp = p.maxHp),
    ok: (p) => p.hp < p.maxHp,
    mage: {
      tags: ["hayot"],
      name: "SHIFOBAXSH IKSIR",
      desc: "Barcha yuraklarni tiklash",
      color: "#c1121f",
      text: "#ff4d4d",
      icon: "elixir",
    },
    hunter: {
      tags: ["hayot"],
      name: "SHIFOBAXSH O'T",
      desc: "Barcha yuraklarni tiklash",
      color: "#7bd14f",
      icon: "herb",
    },
    gunner: {
      tags: ["hayot"],
      name: "DORI SHISHASI",
      desc: "Barcha yuraklarni tiklash",
      color: "#c8743a",
      icon: "flask",
    },
    paladin: {
      tags: ["hayot"],
      name: "DUO",
      desc: "Barcha yuraklarni tiklash",
      color: "#fff2b0",
      icon: "prayer",
    },
    samurai: {
      tags: ["hayot"],
      name: "YASHIL CHOY",
      desc: "Barcha yuraklarni tiklash",
      color: "#a6f08e",
      icon: "tea",
    },
  },
  // ---- Faqat Sehrgar ----
  {
    id: "triple",
    name: "UCH SHAR",
    desc: "Bir otishda yelpig'ich bo'lib 3 ta shar",
    color: "#ff4d4d",
    tags: ["sehr"],
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
    tags: ["sehr"],
    icon: "crystal",
    hero: "mage",
    apply: (p) => (p.pierce = 1),
    ok: (p) => p.pierce < 1,
  },
  // ---- Faqat Ovchi ----
  {
    id: "htriple",
    name: "UCH O'Q",
    desc: "Bir otishda yelpig'ich bo'lib 3 ta o'q",
    color: "#e8c37a",
    tags: ["ov"],
    icon: "arrows3",
    hero: "hunter",
    apply: (p) => (p.multishot = 3),
    ok: (p) => p.multishot < 3,
  },
  {
    id: "venom",
    name: "ZAHARLI UCH",
    desc: "O'q tekkan dushman 3s zaharlanadi: har soniya 1 zarar",
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
    name: "KATTA BARABAN",
    desc: "Barabanda 8 ta o'q",
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
    name: "RIKOSHET",
    desc: "O'q devordan 1 marta qaytadi",
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
    name: "ZARB TO'LQINI",
    desc: "SHANG zarbasidan keyin oldinga to'lqin uchadi",
    color: "#f2c14e",
    tags: ["nur"],
    icon: "shockwave",
    hero: "paladin",
    apply: (p) => (p.shockwave = true),
    ok: (p) => !p.shockwave,
  },
  {
    id: "aura",
    name: "MUQADDAS AURA",
    desc: "Har 15s da 1 yurak tiklanadi (onlayn — yaqin do'stlarga ham)",
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
    name: "IKKI KESIM",
    desc: "Iai har belgilangan dushmanni ikki marta kesadi",
    color: "#ff8fb8",
    tags: ["gul"],
    icon: "twincut",
    hero: "samurai",
    apply: (p) => (p.iaiDouble = true),
    ok: (p) => !p.iaiDouble,
  },
  {
    id: "petalstorm",
    name: "GULBARG BO'RONI",
    desc: "Mukammal chetlanishda atrofga gulbarg zarbasi",
    color: "#ffd6e6",
    tags: ["gul"],
    icon: "petalstorm",
    hero: "samurai",
    apply: (p) => (p.petalStorm = true),
    ok: (p) => !p.petalStorm,
  },
  {
    id: "coldblood",
    name: "SOVUQ QON",
    desc: "Joning 2 yoki kam bo'lsa — kritik imkoniyati ancha oshadi",
    color: "#9fd0ef",
    tags: ["gul"],
    icon: "coldblood",
    hero: "samurai",
    apply: (p) => (p.coldBlood = true),
    ok: (p) => !p.coldBlood,
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
