/** Qahramon tanlovi: bosh menyuda tanlanadi va localStorage'da saqlanadi. */
export type Hero = "knight" | "mage" | "hunter";

export const HERO_KEY = "pixel-rpg-hero";

/** Qahramon rang mavzusi: qobiliyatlar, HUD va sensor tugmalari shu ranglardan olinadi. */
export interface HeroTheme {
  accent: string;
  accentDark: string;
  glow: string;
  /** Dash/sakrash izi (rgba) */
  trail: string;
  /** Sensor tugmalari va kartadagi yozuv */
  uiText: string;
  /** HUD chizig'idagi bo'sh katak */
  empty: string;
}

export const HERO_THEME: Record<Hero, HeroTheme> = {
  knight: {
    accent: "#68cde4",
    accentDark: "#287faf",
    glow: "#c5e4ec",
    trail: "rgba(104,205,228,0.8)",
    uiText: "#68cde4",
    empty: "#1d3a4a",
  },
  mage: {
    accent: "#ff4d4d",
    accentDark: "#c1121f",
    glow: "#ffb3a0",
    trail: "rgba(193,18,31,0.8)",
    uiText: "#ff4d4d",
    empty: "#3a1418",
  },
  hunter: {
    accent: "#a6f08e",
    accentDark: "#4f8a3a",
    glow: "#e8c37a",
    trail: "rgba(122,170,80,0.8)",
    uiText: "#a6f08e",
    empty: "#1f3a1c",
  },
};

/** Qahramon metadatasi. price > 0 bo'lsa do'kondan sotib olinadi (save.ts: unlockedHeroes). */
export interface HeroInfo {
  id: Hero;
  name: string;
  theme: HeroTheme;
  price: number;
}

/** Menyudagi qahramon tanlash qatori shuncha kartaga mo'ljallangan */
export const MAX_HEROES = 10;

export const HERO_LIST: readonly HeroInfo[] = [
  { id: "knight", name: "RITSAR", theme: HERO_THEME.knight, price: 0 },
  { id: "mage", name: "SEHRGAR", theme: HERO_THEME.mage, price: 0 },
  { id: "hunter", name: "OVCHI", theme: HERO_THEME.hunter, price: 0 },
];

export const HEROES: readonly Hero[] = HERO_LIST.map((h) => h.id);
export const HERO_NAMES = Object.fromEntries(HERO_LIST.map((h) => [h.id, h.name])) as Record<
  Hero,
  string
>;

/** "#rrggbb" -> "rgba(r,g,b,a)" */
export function withAlpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Kuchli zarba zaryad halqasi: to'lguncha accent, to'lganda glow bilan miltillaydi. */
export function chargeRingColor(h: Hero, full: boolean, time: number) {
  const t = HERO_THEME[h];
  return full ? withAlpha(t.glow, 0.6 + 0.4 * Math.sin(time * 30)) : withAlpha(t.accent, 0.65);
}

/** HUD'dagi dash va kuchli zarba chiziqlari: [tayyor, yig'ilmoqda, bo'sh]. */
export function hudBarColors(h: Hero) {
  const t = HERO_THEME[h];
  return { on: t.accent, off: t.accentDark, empty: t.empty };
}

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
