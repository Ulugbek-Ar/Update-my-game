/** Yutuqlar: o'yin davomida ochiladi, localStorage'da saqlanadi, menyuda ro'yxat. */
export const ACHIEVEMENTS_KEY = "pixel-rpg-achievements";

export type AchievementId =
  | "first"
  | "clean"
  | "combo10"
  | "combo50"
  | "rich"
  | "boss"
  | "winKnight"
  | "winMage"
  | "winHunter"
  | "winGunner"
  | "endless10"
  | "daily"
  | "chests"
  | "queen"
  | "noChill"
  | "twoChapters"
  | "drumKills"
  | "firstHero"
  | "loyal";

export interface Achievement {
  id: AchievementId;
  name: string;
  desc: string;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "first", name: "BIRINCHI G'ALABA", desc: "Birinchi dushmanni yeng" },
  { id: "clean", name: "BENUQSON TO'LQIN", desc: "To'lqinni zarar olmasdan tozala" },
  { id: "combo10", name: "KOMBO USTASI", desc: "10 kombo yig'" },
  { id: "combo50", name: "50 KOMBO", desc: "Ketma-ket 50 kombo yig'" },
  { id: "rich", name: "BOYVACHCHA", desc: "Bitta o'yinda 50 oltin ter" },
  { id: "boss", name: "IBLISNI YENG", desc: "Bossni mag'lub et" },
  { id: "winKnight", name: "RITSAR BILAN YUT", desc: "Ritsar bilan o'yinni yut" },
  { id: "winMage", name: "SEHRGAR BILAN YUT", desc: "Sehrgar bilan o'yinni yut" },
  { id: "winHunter", name: "OVCHI BILAN YUT", desc: "Ovchi bilan o'yinni yut" },
  { id: "winGunner", name: "MERGAN BILAN YUT", desc: "Mergan bilan o'yinni yut" },
  { id: "endless10", name: "CHEKSIZDA 10-TO'LQIN", desc: "Cheksiz rejimda 10-to'lqinga yet" },
  { id: "daily", name: "KUNLIK SINOVCHI", desc: "Kunlik sinovda 3-to'lqinga yet" },
  { id: "chests", name: "XAZINACHI", desc: "Bitta o'yinda 3 ta sandiq och" },
  { id: "queen", name: "MUZNI ERITDI", desc: "Qor Malikasini yeng" },
  { id: "noChill", name: "SOVUQQA CHIDAM", desc: "2-dunyoda sekinlashmasdan bitta to'lqin o't" },
  { id: "twoChapters", name: "IKKI DUNYO", desc: "Bitta o'yinda o'lmasdan ikkala dunyoni yut" },
  { id: "drumKills", name: "OLTI O'Q", desc: "Bitta barabandagi o'qlar bilan 6 ta dushmanni yeng" },
  { id: "firstHero", name: "YANGI QAHRAMON", desc: "Do'kondan birinchi qahramonni sotib ol" },
  { id: "loyal", name: "SODIQ O'YINCHI", desc: "Kunlik sovg'ani 7 kun ketma-ket ol" },
];

export function loadAchievements(): Set<AchievementId> {
  try {
    const raw = JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return new Set();
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id as string));
    return new Set(raw.filter((x): x is AchievementId => typeof x === "string" && ids.has(x)));
  } catch {
    return new Set();
  }
}

/** Yutuqni ochadi; yangi ochilgan bo'lsa uni qaytaradi (aks holda null). */
export function unlockAchievement(id: AchievementId): Achievement | null {
  const got = loadAchievements();
  if (got.has(id)) return null;
  got.add(id);
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify([...got]));
  } catch {
    /* saqlash imkonsiz */
  }
  return ACHIEVEMENTS.find((a) => a.id === id) ?? null;
}
