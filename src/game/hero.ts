/** Qahramon tanlovi: bosh menyuda tanlanadi va localStorage'da saqlanadi. */
export type Hero = "knight" | "mage" | "hunter";

export const HERO_KEY = "pixel-rpg-hero";
export const HEROES: readonly Hero[] = ["knight", "mage", "hunter"];
export const HERO_NAMES: Record<Hero, string> = {
  knight: "RITSAR",
  mage: "SEHRGAR",
  hunter: "OVCHI",
};

export function loadHero(): Hero {
  try {
    const h = localStorage.getItem(HERO_KEY);
    return HEROES.find((x) => x === h) ?? "knight";
  } catch {
    return "knight";
  }
}

export function saveHero(h: Hero) {
  try {
    localStorage.setItem(HERO_KEY, h);
  } catch {
    /* saqlash imkonsiz */
  }
}

/** Rekord kalitlari har qahramon uchun alohida; Ritsar eski kalitlarni saqlab qoladi. */
export function bestKeys(h: Hero) {
  return h === "knight"
    ? {
        best: "pixel-rpg-best",
        endless: "pixel-rpg-endless-best",
        ch2: "pixel-rpg-best-ch2",
        ch3: "pixel-rpg-best-ch3",
      }
    : {
        best: `pixel-rpg-best-${h}`,
        endless: `pixel-rpg-endless-best-${h}`,
        // 2- va 3-dunyoni yutgan o'yinlar rekordi alohida
        ch2: `pixel-rpg-best-ch2-${h}`,
        ch3: `pixel-rpg-best-ch3-${h}`,
      };
}
