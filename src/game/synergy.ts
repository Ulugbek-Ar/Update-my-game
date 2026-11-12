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
import type { Player } from "./player";
import type { Hero } from "./hero";
import type { Tag } from "./waves";

export type { Tag };

/** Sinergiya uchun kerak bo'lgan bir xil teglar soni */
export const SYNERGY_AT = 3;
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

const HERO_THREE: Record<Hero, string> = {
  knight: "Aylana zarba 3 baravar zarar",
  mage: "Teleport qilgan joyda olov portlaydi",
  hunter: "Kuchli o'q 3 baravar zarar",
  gunner: "Yelpig'ich o'qlari teshib o'tadi",
  paladin: "OSMON HUKMI 4 baravar zarar",
  samurai: "To'liq Iai 3 baravar zarar",
};

export const TAGS: Record<Tag, TagDef> = {
  zarar: {
    name: "ZARAR",
    color: "#ff6a4d",
    two: "Kuchli zarba 15% tezroq tayyor",
    three: "Dushman o'lganda kichik portlash",
  },
  tezlik: {
    name: "TEZLIK",
    color: "#7fd8ff",
    two: "Tezlik +8%",
    three: "Dashdan keyin 1 s tezlashish",
  },
  himoya: {
    name: "HIMOYA",
    color: "#9fb4c8",
    two: "Zarbadan keyin uzoqroq daxlsizlik",
    three: "Har 20 s da bir zarbani to'sadigan qalqon",
  },
  hayot: {
    name: "HAYOT",
    color: "#ff4d6d",
    two: "Yurak ko'proq tushadi",
    three: "Boss fazasi almashganda +1 yurak",
  },
  polat: { name: "PO'LAT", color: "#68cde4", two: "", three: HERO_THREE.knight },
  sehr: { name: "SEHR", color: "#ff4d4d", two: "", three: HERO_THREE.mage },
  ov: { name: "OV", color: "#7bd14f", two: "", three: HERO_THREE.hunter },
  porox: { name: "POROX", color: "#dba45a", two: "", three: HERO_THREE.gunner },
  nur: { name: "NUR", color: "#f2c14e", two: "", three: HERO_THREE.paladin },
  gul: { name: "SAKURA", color: "#ff8fb8", two: "", three: HERO_THREE.samurai },
};
// qahramon tegi 2: kuchli zarba zaryadi tezroq to'ladi
for (const t of ["polat", "sehr", "ov", "porox", "nur", "gul"] as const)
  TAGS[t].two = "Kuchli zarba zaryadi 20% tez";

/** Har qahramonning o'z tegi */
export const HERO_TAG: Record<Hero, Tag> = {
  knight: "polat",
  mage: "sehr",
  hunter: "ov",
  gunner: "porox",
  paladin: "nur",
  samurai: "gul",
};

export const ALL_TAGS = Object.keys(TAGS) as Tag[];

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
  if (n === BONUS_AT) {
    applyTwo(tag, p);
    return "two";
  }
  if (n === SYNERGY_AT) {
    applyThree(tag, p);
    return "three";
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
  if (tag !== HERO_TAG[p.hero]) return;
  // qahramonning eng zo'r qobiliyati
  if (p.hero === "knight" || p.hero === "hunter" || p.hero === "samurai") p.strongMul = 3;
  else if (p.hero === "paladin") p.strongMul = 4;
  else if (p.hero === "gunner") p.fanPierce = true;
  // Sehrgar: teleport portlashi — Game
}

export function hasTag(counts: TagCounts, tag: Tag, n = SYNERGY_AT) {
  return (counts[tag] ?? 0) >= n;
}

/** Ochilgan sinergiyalar (3+ teg) */
export function synergies(counts: TagCounts): Tag[] {
  return ALL_TAGS.filter((t) => hasTag(counts, t));
}

/** Kartadagi yozuv: "ZARAR 2/3" — shu kartani olsa nechta bo'ladi (3 dan oshmaydi) */
export function tagProgress(counts: TagCounts, tag: Tag) {
  const next = Math.min(SYNERGY_AT, (counts[tag] ?? 0) + 1);
  return `${TAGS[tag].name} ${next}/${SYNERGY_AT}`;
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
};
