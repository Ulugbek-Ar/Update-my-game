/** Qahramon tanlovi: bosh menyuda tanlanadi va localStorage'da saqlanadi. */
export type Hero = "knight" | "mage";

export const HERO_KEY = "pixel-rpg-hero";
export const HEROES: readonly Hero[] = ["knight", "mage"];
export const HERO_NAMES: Record<Hero, string> = { knight: "RITSAR", mage: "SEHRGAR" };

export function loadHero(): Hero {
  try {
    return localStorage.getItem(HERO_KEY) === "mage" ? "mage" : "knight";
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
    ? { best: "pixel-rpg-best", endless: "pixel-rpg-endless-best", ch2: "pixel-rpg-best-ch2" }
    : {
        best: "pixel-rpg-best-mage",
        endless: "pixel-rpg-endless-best-mage",
        // 2-dunyoni yutgan o'yinlar rekordi alohida
        ch2: "pixel-rpg-best-ch2-mage",
      };
}
