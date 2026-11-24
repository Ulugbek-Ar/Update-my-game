import { t } from "@/i18n";
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
  | "loyal"
  | "winPaladin"
  | "shang4"
  | "wallNoShield"
  | "collector"
  | "synergy2"
  | "winSamurai"
  | "winShinobi"
  | "winPriestess"
  | "winWolf"
  | "firstIai"
  | "dodge10"
  | "parryBoss"
  | "winSakura";

export interface Achievement {
  id: AchievementId;
  name: string;
  desc: string;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: "first",
    get name() {
      return t("ach.first.name");
    },
    get desc() {
      return t("ach.first.desc");
    },
  },
  {
    id: "clean",
    get name() {
      return t("ach.clean.name");
    },
    get desc() {
      return t("ach.clean.desc");
    },
  },
  {
    id: "combo10",
    get name() {
      return t("ach.combo10.name");
    },
    get desc() {
      return t("ach.combo10.desc");
    },
  },
  {
    id: "combo50",
    get name() {
      return t("ach.combo50.name");
    },
    get desc() {
      return t("ach.combo50.desc");
    },
  },
  {
    id: "rich",
    get name() {
      return t("ach.rich.name");
    },
    get desc() {
      return t("ach.rich.desc");
    },
  },
  {
    id: "boss",
    get name() {
      return t("ach.boss.name");
    },
    get desc() {
      return t("ach.boss.desc");
    },
  },
  {
    id: "winKnight",
    get name() {
      return t("ach.winKnight.name");
    },
    get desc() {
      return t("ach.winKnight.desc");
    },
  },
  {
    id: "winMage",
    get name() {
      return t("ach.winMage.name");
    },
    get desc() {
      return t("ach.winMage.desc");
    },
  },
  {
    id: "winHunter",
    get name() {
      return t("ach.winHunter.name");
    },
    get desc() {
      return t("ach.winHunter.desc");
    },
  },
  {
    id: "winGunner",
    get name() {
      return t("ach.winGunner.name");
    },
    get desc() {
      return t("ach.winGunner.desc");
    },
  },
  {
    id: "endless10",
    get name() {
      return t("ach.endless10.name");
    },
    get desc() {
      return t("ach.endless10.desc");
    },
  },
  {
    id: "daily",
    get name() {
      return t("ach.daily.name");
    },
    get desc() {
      return t("ach.daily.desc");
    },
  },
  {
    id: "chests",
    get name() {
      return t("ach.chests.name");
    },
    get desc() {
      return t("ach.chests.desc");
    },
  },
  {
    id: "queen",
    get name() {
      return t("ach.queen.name");
    },
    get desc() {
      return t("ach.queen.desc");
    },
  },
  {
    id: "noChill",
    get name() {
      return t("ach.noChill.name");
    },
    get desc() {
      return t("ach.noChill.desc");
    },
  },
  {
    id: "twoChapters",
    get name() {
      return t("ach.twoChapters.name");
    },
    get desc() {
      return t("ach.twoChapters.desc");
    },
  },
  {
    id: "drumKills",
    get name() {
      return t("ach.drumKills.name");
    },
    get desc() {
      return t("ach.drumKills.desc");
    },
  },
  {
    id: "firstHero",
    get name() {
      return t("ach.firstHero.name");
    },
    get desc() {
      return t("ach.firstHero.desc");
    },
  },
  {
    id: "loyal",
    get name() {
      return t("ach.loyal.name");
    },
    get desc() {
      return t("ach.loyal.desc");
    },
  },
  {
    id: "winPaladin",
    get name() {
      return t("ach.winPaladin.name");
    },
    get desc() {
      return t("ach.winPaladin.desc");
    },
  },
  {
    id: "shang4",
    get name() {
      return t("ach.shang4.name");
    },
    get desc() {
      return t("ach.shang4.desc");
    },
  },
  {
    id: "wallNoShield",
    get name() {
      return t("ach.wallNoShield.name");
    },
    get desc() {
      return t("ach.wallNoShield.desc");
    },
  },
  {
    id: "collector",
    get name() {
      return t("ach.collector.name");
    },
    get desc() {
      return t("ach.collector.desc");
    },
  },
  {
    id: "synergy2",
    get name() {
      return t("ach.synergy2.name");
    },
    get desc() {
      return t("ach.synergy2.desc");
    },
  },
  {
    id: "winSamurai",
    get name() {
      return t("ach.winSamurai.name");
    },
    get desc() {
      return t("ach.winSamurai.desc");
    },
  },
  {
    id: "winShinobi",
    get name() {
      return t("ach.winShinobi.name");
    },
    get desc() {
      return t("ach.winShinobi.desc");
    },
  },
  {
    id: "winPriestess",
    get name() {
      return t("ach.winPriestess.name");
    },
    get desc() {
      return t("ach.winPriestess.desc");
    },
  },
  {
    id: "winWolf",
    get name() {
      return t("ach.winWolf.name");
    },
    get desc() {
      return t("ach.winWolf.desc");
    },
  },
  {
    id: "firstIai",
    get name() {
      return t("ach.firstIai.name");
    },
    get desc() {
      return t("ach.firstIai.desc");
    },
  },
  {
    id: "dodge10",
    get name() {
      return t("ach.dodge10.name");
    },
    get desc() {
      return t("ach.dodge10.desc");
    },
  },
  {
    id: "parryBoss",
    get name() {
      return t("ach.parryBoss.name");
    },
    get desc() {
      return t("ach.parryBoss.desc");
    },
  },
  {
    id: "winSakura",
    get name() {
      return t("ach.winSakura.name");
    },
    get desc() {
      return t("ach.winSakura.desc");
    },
  },
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
