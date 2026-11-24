/**
 * Kuch kartalari teglari va SINERGIYALAR (faqat oflayn o'yin — Game; onlayn olamda kartalar yo'q).
 *
 * Har kartada 1 ta teg (waves.ts). Bir xil tegdan:
 *   2 ta — kichik bonus (Player ko'rsatkichi biroz oshadi),
 *   3 ta — SINERGIYA: o'yin qoidasi o'zgaradi (Game shu tegni tekshiradi).
 *
 * Bonus va sinergiyalar Player ko'rsatkichlarini o'zgartirsa (strongMul, chargeTime, ...), boss joni
 * formulasi (bossPower.ts) ularni Player'dan o'qiydi — bosslar osonlashib qolmaydi.
 */
import { t as tr } from "@/i18n";
import type { Player } from "./player";
import type { Hero } from "./hero";
import type { Tag } from "./waves";

export type { Tag };

/** Sinergiya uchun kerak bo'lgan bir xil teglar soni */
export const SYNERGY_AT = 3;
/** SUPER sinergiyasi: super shari shuncha baravar tez to'ladi */
export const SUPER_RATE = 1.25;
/** Kichik bonus */
export const BONUS_AT = 2;

/** TEZLIK 3: dashdan keyin shuncha soniya tezlashish (Player.boost) */
export const DASH_BOOST = 1;
/** HIMOYA 3: har shuncha soniyada 1 zarbani to'sadigan qalqon */
export const WARD_EVERY = 20;
/** ZARAR 3: dushman o'lganda portlash radiusi va zarari */
export const BLAST_RADIUS = 28;
export const BLAST_DMG = 1;
/** SEHR 3: teleport chiqqan joyda olov portlashi (zarar × p.damage) */
export const TELE_BLAST_RADIUS = 32;
export const TELE_BLAST_MUL = 2;
/** HIMOYA 2: zarba yegandan keyingi qo'shimcha daxlsizlik */
export const GUARD_BONUS = 0.3;
/** HAYOT 2: yurak tushish ehtimoliga qo'shimcha */
export const DROP_BONUS = 0.05;

export interface TagDef {
  /** Ekrandagi nom (katta harf) */
  name: string;
  color: string;
  /** 2 ta tegdagi bonus va 3 tadagi sinergiya tavsifi */
  two: string;
  three: string;
}

export const TAGS: Record<Tag, TagDef> = {
  zarar: {
    get name() {
      return tr("syn.zarar");
    },
    color: "#ff6a4d",
    get two() {
      return tr("syn.zarar.two");
    },
    get three() {
      return tr("syn.zarar.three");
    },
  },
  tezlik: {
    get name() {
      return tr("syn.tezlik");
    },
    color: "#7fd8ff",
    get two() {
      return tr("syn.tezlik.two");
    },
    get three() {
      return tr("syn.tezlik.three");
    },
  },
  himoya: {
    get name() {
      return tr("syn.himoya");
    },
    color: "#9fb4c8",
    get two() {
      return tr("syn.himoya.two");
    },
    get three() {
      return tr("syn.himoya.three");
    },
  },
  hayot: {
    get name() {
      return tr("syn.hayot");
    },
    color: "#ff4d6d",
    get two() {
      return tr("syn.hayot.two");
    },
    get three() {
      return tr("syn.hayot.three");
    },
  },
  polat: {
    get name() {
      return tr("syn.polat");
    },
    color: "#68cde4",
    get two() {
      return tr("syn.heroTwo");
    },
    get three() {
      return tr("syn.three.knight");
    },
  },
  sehr: {
    get name() {
      return tr("syn.sehr");
    },
    color: "#ff4d4d",
    get two() {
      return tr("syn.heroTwo");
    },
    get three() {
      return tr("syn.three.mage");
    },
  },
  ov: {
    get name() {
      return tr("syn.ov");
    },
    color: "#7bd14f",
    get two() {
      return tr("syn.heroTwo");
    },
    get three() {
      return tr("syn.three.hunter");
    },
  },
  porox: {
    get name() {
      return tr("syn.porox");
    },
    color: "#dba45a",
    get two() {
      return tr("syn.heroTwo");
    },
    get three() {
      return tr("syn.three.gunner");
    },
  },
  nur: {
    get name() {
      return tr("syn.nur");
    },
    color: "#f2c14e",
    get two() {
      return tr("syn.heroTwo");
    },
    get three() {
      return tr("syn.three.paladin");
    },
  },
  gul: {
    get name() {
      return tr("syn.gul");
    },
    color: "#ff8fb8",
    get two() {
      return tr("syn.heroTwo");
    },
    get three() {
      return tr("syn.three.samurai");
    },
  },
  soya: {
    get name() {
      return tr("syn.soya");
    },
    color: "#ff6f91",
    get two() {
      return tr("syn.heroTwo");
    },
    get three() {
      return tr("syn.three.shinobi");
    },
  },
  // SUPER kartalari kam (har superda 2 ta) — ikkalasi yig'ilsa sinergiya ochiladi (TAG_NEED)
  super: {
    get name() {
      return tr("syn.super");
    },
    color: "#ffe9a8",
    get two() {
      return tr("syn.super.two");
    },
    get three() {
      return tr("syn.super.two");
    },
  },
};
// qahramon tegi 2: kuchli zarba zaryadi tezroq to'ladi (syn.heroTwo — yuqorida)

/** Har qahramonning o'z tegi */
export const HERO_TAG: Record<Hero, Tag> = {
  knight: "polat",
  mage: "sehr",
  hunter: "ov",
  gunner: "porox",
  paladin: "nur",
  samurai: "gul",
  shinobi: "soya",
};

export const ALL_TAGS = Object.keys(TAGS) as Tag[];

/** Sinergiya uchun kerakli teglar soni: odatda 3; SUPER — 2 (bunday kartalar atigi ikkita) */
export const TAG_NEED: Partial<Record<Tag, number>> = { super: 2 };
export function tagNeed(tag: Tag) {
  return TAG_NEED[tag] ?? SYNERGY_AT;
}

export type TagCounts = Partial<Record<Tag, number>>;

/** Teg ochilishi: "two" — kichik bonus, "three" — sinergiya, null — hech narsa */
export type TagUnlock = "two" | "three" | null;

/**
 * Teg hisobiga bitta qo'shadi va ochilgan bosqichni qaytaradi. Bonus/sinergiyaning Player'ga
 * ta'siri shu yerda (Game faqat effekt chiqaradi va qoida sinergiyalarini tekshiradi).
 */
export function addTag(counts: TagCounts, tag: Tag, p: Player): TagUnlock {
  const n = (counts[tag] ?? 0) + 1;
  counts[tag] = n;
  // sinergiya chegarasi tegga qarab (SUPER — 2): chegaraga yetsa — to'g'ridan-to'g'ri sinergiya
  if (n === tagNeed(tag)) {
    applyThree(tag, p);
    return "three";
  }
  if (n === BONUS_AT) {
    applyTwo(tag, p);
    return "two";
  }
  return null;
}

function applyTwo(tag: Tag, p: Player) {
  if (tag === "zarar") p.spinCd *= 0.85;
  else if (tag === "tezlik") p.speed *= 1.08;
  else if (tag === HERO_TAG[p.hero]) p.chargeTime *= 0.8;
  // HIMOYA va HAYOT bonuslari Game'da (daxlsizlik va yurak tushishi)
}

function applyThree(tag: Tag, p: Player) {
  // SUPER: shar tezroq to'ladi (Game zaryad hisoblagichiga uzatadi)
  if (tag === "super") p.superRate = SUPER_RATE;
  if (tag !== HERO_TAG[p.hero]) return;
  // qahramonning eng zo'r qobiliyati
  if (p.hero === "knight") p.strongMul = 3.5;
  else if (p.hero === "hunter" || p.hero === "samurai") p.strongMul = 3;
  else if (p.hero === "paladin") p.strongMul = 4;
  else if (p.hero === "gunner") p.fanPierce = true;
  else if (p.hero === "shinobi") p.ambushMul = Math.max(p.ambushMul, 3);
  // Sehrgar: teleport portlashi — Game
}

export function hasTag(counts: TagCounts, tag: Tag, n = tagNeed(tag)) {
  return (counts[tag] ?? 0) >= n;
}

/** Ochilgan sinergiyalar (3+ teg) */
export function synergies(counts: TagCounts): Tag[] {
  return ALL_TAGS.filter((t) => hasTag(counts, t));
}

/** Kartadagi yozuv: "ZARAR 2/3" — shu kartani olsa nechta bo'ladi (3 dan oshmaydi) */
export function tagProgress(counts: TagCounts, tag: Tag) {
  const need = tagNeed(tag);
  const next = Math.min(need, (counts[tag] ?? 0) + 1);
  return `${TAGS[tag].name} ${next}/${need}`;
}

/** Teg ikonkalari (7x7): X — teg rangi, k — to'q kontur, w — oq yaltiroq */
export const TAG_ICONS: Record<Tag, readonly string[]> = {
  // qilich
  zarar: [".....kX", "....kXk", "...kXk.", "k.kXk..", ".kXk...", ".kk....", "k.k...."],
  // chaqmoq
  tezlik: ["...kXk.", "..kXk..", ".kXXXk.", "..kXk..", ".kXk...", "kXk....", "kk....."],
  // qalqon
  himoya: ["kkkkkkk", "kXXwXXk", "kXXwXXk", "kXXXXXk", ".kXXXk.", "..kXk..", "...k..."],
  // yurak
  hayot: [".kk.kk.", "kXXkXwk", "kXXXXXk", "kXXXXXk", ".kXXXk.", "..kXk..", "...k..."],
  // dubulg'a
  polat: [".kkkkk.", "kXXXXXk", "kXwXXXk", "kkkkkkk", "kXk.kXk", "kXXkXXk", ".kkkkk."],
  // yulduz
  sehr: ["...k...", "..kXk..", "kkXwXkk", ".kXXXk.", ".kXkXk.", "kXk.kXk", "k.....k"],
  // o'q uchi
  ov: ["...k...", "..kXk..", ".kXwXk.", "kXXXXXk", "...k...", "...k...", "..kkk.."],
  // porox bochkasi
  porox: [".kkkkk.", "kXXXXXk", "kkkkkkk", "kXwXXXk", "kkkkkkk", "kXXXXXk", ".kkkkk."],
  // quyosh
  nur: ["k..k..k", ".kkXkk.", ".kXwXk.", "kXXXXXk", ".kXXXk.", ".kkXkk.", "k..k..k"],
  // sakura guli
  gul: [".kk.kk.", "kXXkXXk", "kXXwXXk", ".kwkwk.", "kXXwXXk", "kXXkXXk", ".kk.kk."],
  // shuriken
  soya: ["...k...", "..kXk..", "kkkXkkk", "kXXkXXk", "kkkXkkk", "..kXk..", "...k..."],
  // super shari: shisha shar ichida suyuqlik
  super: [".kkkkk.", "kw....k", "k.w...k", "kXXXXXk", "kXXwXXk", "kXXXXXk", ".kkkkk."],
};
