/**
 * O'yinchi darajasi (XP): 1–50 daraja. L-darajadan L+1 ga o'tish uchun 100 + 20·(L−1) XP kerak
 * (2-daraja — 100 XP, 10-daraja — jami 1 620 XP, 50-daraja — jami 28 420 XP).
 *
 * XP manbalari: to'lqin, boss, olam topshirig'i va sirlari, kunlik sovg'a. XP mehmonda ham
 * yig'iladi (progress kaliti — bulutga va ko'chirish kodiga kiradi).
 *
 * Har yangi darajada kichik oltin sovg'asi (menyuda olinadi — o'yin ichidagi oltin hisobiga
 * aralashmaydi), har 10 darajada yangi unvon. Balans: 2→50 darajagacha jami ≈ 600 oltin, ya'ni
 * o'sha vaqtda o'yinlardan topiladigan oltinning ~3% i — do'kon narxlari o'zgarmaydi.
 */

export const MAX_LEVEL = 50;

/** XP qiymatlari */
export const XP = {
  /** tozalangan to'lqin (sarguzasht, cheksiz, kunlik sinov) */
  wave: 10,
  /** bosslar: Iblis (va cheksiz rejim bosslari), Qor Malikasi, O'rmon Shohi */
  devil: 50,
  queen: 75,
  king: 100,
  /** Abadiyat olami: Xaroba Sardori va reyd boss Kul qiroli */
  warden: 80,
  ashking: 150,
  /** olam topshirig'i bajarildi va yangi sir topildi */
  quest: 40,
  secret: 25,
  /** kunlik sovg'a */
  gift: 20,
} as const;

/** L-darajadan keyingisiga kerak bo'ladigan XP */
export function xpStep(level: number) {
  return 100 + 20 * (Math.max(1, level) - 1);
}

/** L-darajaga yetish uchun jami XP (1-daraja — 0) */
export function xpForLevel(level: number) {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  // sum_{k=1}^{l-1} (100 + 20(k-1)) = 100(l-1) + 10(l-1)(l-2)
  return 100 * (l - 1) + 10 * (l - 1) * (l - 2);
}

/** Jami XP bo'yicha daraja (1..50) */
export function levelOf(xp: number) {
  const x = Math.max(0, Math.floor(Number(xp) || 0));
  let l = 1;
  while (l < MAX_LEVEL && xpForLevel(l + 1) <= x) l++;
  return l;
}

/** Joriy darajadagi yutuq: [yig'ilgan, kerak] (50-darajada — to'liq) */
export function levelProgress(xp: number): [number, number] {
  const l = levelOf(xp);
  if (l >= MAX_LEVEL) return [1, 1];
  return [Math.max(0, xp - xpForLevel(l)), xpStep(l)];
}

/** Har 10 darajada yangi unvon */
export const TITLES: readonly { level: number; name: string }[] = [
  { level: 1, name: "Yangi kelgan" },
  { level: 10, name: "Zindon kezuvchisi" },
  { level: 20, name: "Qal'a qo'riqchisi" },
  { level: 30, name: "Olam sayyohi" },
  { level: 40, name: "Bosslar ovchisi" },
  { level: 50, name: "Afsona" },
];

export function titleOf(level: number) {
  let t = TITLES[0]!.name;
  for (const x of TITLES) if (level >= x.level) t = x.name;
  return t;
}

/** L-darajaga yetganda oltin sovg'asi: 5 + L/5, har 10-darajada yana +25 */
export function levelGold(level: number) {
  if (level <= 1) return 0;
  return 5 + Math.floor(level / 5) + (level % 10 === 0 ? 25 : 0);
}

/** O'yinchi XP'si (progress kaliti — bulutga va ko'chirish kodiga kiradi) */
export const XP_KEY = "pixel-rpg-xp";

export interface XpSave {
  xp: number;
  /** sovg'asi olingan oxirgi daraja */
  lvl: number;
  /** XP berilgan olam topshiriqlari va sirlari (qayta berilmasin) */
  q: string[];
  s: string[];
}

/** Saqlangan XP yozuvidan jami XP (buzuq bo'lsa — 0) */
export function xpFromRaw(raw: string | null | undefined): number {
  try {
    const v = JSON.parse(raw ?? "null") as { xp?: unknown } | null;
    const n = Math.floor(Number(v?.xp));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 500) : [];

export function loadXp(): XpSave {
  try {
    const raw = localStorage.getItem(XP_KEY);
    const v = JSON.parse(raw ?? "null") as Partial<XpSave> | null;
    const xp = xpFromRaw(raw);
    const lvl = Math.floor(Number(v?.lvl));
    return {
      xp,
      // eski (sovg'a hisobisiz) yozuv: hozirgi daraja olingan deb hisoblanadi
      lvl: Number.isFinite(lvl) && lvl >= 1 ? Math.min(lvl, MAX_LEVEL) : levelOf(xp),
      q: strings(v?.q),
      s: strings(v?.s),
    };
  } catch {
    return { xp: 0, lvl: 1, q: [], s: [] };
  }
}

function saveXp(s: XpSave) {
  try {
    localStorage.setItem(XP_KEY, JSON.stringify(s));
  } catch {
    /* saqlash imkonsiz */
  }
}

const listeners = new Set<() => void>();

/** XP o'zgarganda (menyudagi daraja belgisi) */
export function onXp(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** XP qo'shadi; yangi jami XP */
export function addXp(n: number) {
  const s = loadXp();
  const add = Math.max(0, Math.floor(n));
  if (!add) return s.xp;
  s.xp += add;
  saveXp(s);
  for (const f of listeners) f();
  return s.xp;
}

/** Olam: bajarilgan topshiriqlar va topilgan sirlar uchun XP (har biri bir marta). Qo'shilgan XP. */
export function awardRealm(doneQuests: readonly string[], secrets: readonly string[]) {
  const s = loadXp();
  const q = doneQuests.filter((id) => !s.q.includes(id));
  const sec = secrets.filter((id) => !s.s.includes(id));
  if (!q.length && !sec.length) return 0;
  const add = q.length * XP.quest + sec.length * XP.secret;
  s.q = [...s.q, ...q];
  s.s = [...s.s, ...sec];
  s.xp += add;
  saveXp(s);
  for (const f of listeners) f();
  return add;
}

export interface LevelUp {
  /** yangi darajalar (ketma-ket) */
  levels: number[];
  gold: number;
  /** yangi unvonlar */
  titles: string[];
}

/** Hali olinmagan daraja sovg'alari (menyuda ko'rsatish uchun) */
export function pendingLevels() {
  const s = loadXp();
  const now = levelOf(s.xp);
  const out: number[] = [];
  for (let l = s.lvl + 1; l <= now; l++) out.push(l);
  return out;
}

/**
 * Daraja sovg'alarini olish: oltin qo'shiladi (addGold — shop.ts), olingan daraja saqlanadi.
 * Bir xil daraja ikki marta berilmaydi (bulut orqali boshqa qurilmada ham).
 */
export function claimLevelRewards(addGold: (n: number) => void): LevelUp | null {
  const levels = pendingLevels();
  if (!levels.length) return null;
  const s = loadXp();
  const gold = levels.reduce((sum, l) => sum + levelGold(l), 0);
  const titles = TITLES.filter((t) => levels.includes(t.level)).map((t) => t.name);
  s.lvl = levels[levels.length - 1]!;
  saveXp(s);
  addGold(gold);
  for (const f of listeners) f();
  return { levels, gold, titles };
}
