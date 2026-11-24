import { t } from "@/i18n";
/** Qahramon tanlovi: bosh menyuda tanlanadi va localStorage'da saqlanadi. */
export type Hero = "knight" | "mage" | "hunter" | "gunner" | "paladin" | "samurai" | "shinobi";

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
  // Mergan: mis va porox kulrangi
  gunner: {
    accent: "#d9a441",
    accentDark: "#8a5a2a",
    glow: "#ffe2a0",
    trail: "rgba(150,140,124,0.8)",
    uiText: "#d9a441",
    empty: "#2e2820",
  },
  // Paladin: oltin va oq "muqaddas nur" (oq yadro, oltin chekka). Tanga/ochko sarig'idan (#ffcc33)
  // ajralib turadi: to'qroq, iliq oltin va deyarli oq porlash
  paladin: {
    accent: "#f2c14e",
    accentDark: "#a87a12",
    glow: "#fff2b0",
    trail: "rgba(255,242,176,0.8)",
    uiText: "#f2c14e",
    empty: "#3a300e",
  },
  // Samuray qiz: sakura pushti (gulbarg), to'q pushti chekka va oqish-pushti porlash. Xavf zonalarining
  // qizilidan (danger.ts) uzoq: pushti-oq oilada, to'yingan qizil emas
  samurai: {
    accent: "#ff8fb8",
    accentDark: "#b8456e",
    glow: "#ffd6e6",
    trail: "rgba(255,143,184,0.8)",
    uiText: "#ffe3ee",
    empty: "#3a1a28",
  },
  // Ninja (id "shinobi" — "ninja" Sakura bog'idagi Ninja-soya mobining sprayti): qora kiyim va qizil
  // sharf. Effektlarda qizil marjon tusida (xavf zonalarining qizilidan uzoq), porlashi — po'lat-oq,
  // izi — kul tutun
  shinobi: {
    accent: "#ff6f91",
    accentDark: "#7a1420",
    glow: "#e6e2ea",
    trail: "rgba(90,84,104,0.8)",
    uiText: "#ff8a94",
    empty: "#2a1418",
  },
};

/**
 * Rollar (asosan onlayn): TANK dushmanni o'ziga tortadi va zarbani ko'taradi, JANGCHI yaqindan uradi,
 * SEHRGAR sehr bilan katta zarar beradi, UZOQDAN — masofadan otadi.
 */
export type Role = "tank" | "warrior" | "caster" | "ranged";

export interface RoleInfo {
  name: string;
  color: string;
  /** Rol tavsifi (Yangiliklar va do'kon) */
  desc: string;
}

export const ROLE_INFO: Record<Role, RoleInfo> = {
  tank: {
    get name() {
      return t("role.tank.name");
    },
    color: "#f2c14e",
    get desc() {
      return t("role.tank.desc");
    },
  },
  warrior: {
    get name() {
      return t("role.warrior.name");
    },
    color: "#68cde4",
    get desc() {
      return t("role.warrior.desc");
    },
  },
  caster: {
    get name() {
      return t("role.caster.name");
    },
    color: "#ff4d4d",
    get desc() {
      return t("role.caster.desc");
    },
  },
  ranged: {
    get name() {
      return t("role.ranged.name");
    },
    color: "#a6f08e",
    get desc() {
      return t("role.ranged.desc");
    },
  },
};

/** Qahramon metadatasi. price > 0 bo'lsa do'kondan sotib olinadi (save.ts: unlockedHeroes). */
export interface HeroInfo {
  id: Hero;
  name: string;
  theme: HeroTheme;
  price: number;
  /** Do'kon kartasidagi qisqa tavsif: hujumi va o'ziga xosligi */
  desc: string;
  role: Role;
}

/** Menyudagi qahramon tanlash qatori shuncha kartaga mo'ljallangan */
export const MAX_HEROES = 10;
/**
 * QOIDA: o'yinda jami MAX_HEROES tagacha qahramon. Dastlabki FREE_HEROES tasi bepul,
 * keyingilari (4-qahramondan boshlab) do'konning QAHRAMONLAR bo'limida oltinga sotiladi.
 */
export const FREE_HEROES = 3;

/**
 * Mergan narxi oltin iqtisodidan. 1-dunyoning to'liq o'yini (5 to'lqin, Iblis bilan):
 * dushmanlardan 3 + 4 + 9 + 16 + 2 = 34, Iblisdan 25, sandiqlardan 2 to'lqin × 35% × ~11.5 ≈ 8,
 * jami ≈ 67 oltin. O'rtacha o'yinchi 12s da yo'qoladigan tangalarning bir qismini terolmaydi (≈ 55–60).
 * 300 oltin ≈ 4.5–5.5 ta to'liq o'yin.
 */
export const GUNNER_PRICE = 300;

/**
 * Paladin narxi: Merganning 1.5 baravari. 1-dunyoning to'liq o'yini ≈ 55–67 oltin, 2- va 3-dunyo
 * bilan (Malika 40, Shoh 50 va ko'proq dushman) uch dunyoli o'yin ≈ 180–220 oltin. Mergandan keyin
 * do'kon kuchaytirishlari (jami ≈ 600) ham olinadi — 450 oltin ≈ 7–8 ta 1-dunyo yoki 2–3 ta to'liq
 * uch dunyoli o'yin: Merganni sotib olgan o'yinchi uchun keyingi katta maqsad.
 */
export const PALADIN_PRICE = 450;

/**
 * Samuray qiz narxi: Paladindan keyingi katta maqsad. Uch dunyoli to'liq o'yin ≈ 180–220 oltin —
 * 600 oltin ≈ 3 ta uch dunyoli o'yin yoki 9–10 ta 1-dunyo. Mahorat talab qiladigan qahramon:
 * o'yinni yaxshi bilgan (Mergan va Paladinni olgan) o'yinchi uchun.
 */
export const SAMURAI_PRICE = 600;

/**
 * Ninja narxi: Samuray bilan bir qatorda (600 oltin ≈ 3 ta uch dunyoli o'yin). Yashirin qotil —
 * ko'rinmaslik va orqadan zarbani to'g'ri ishlatgan o'yinchi uchun.
 */
export const SHINOBI_PRICE = 600;

export const HERO_LIST: readonly HeroInfo[] = [
  {
    id: "knight",
    role: "warrior",
    get name() {
      return t("hero.knight.name");
    },
    theme: HERO_THEME.knight,
    price: 0,
    get desc() {
      return t("hero.knight.desc");
    },
  },
  {
    id: "mage",
    role: "caster",
    get name() {
      return t("hero.mage.name");
    },
    theme: HERO_THEME.mage,
    price: 0,
    get desc() {
      return t("hero.mage.desc");
    },
  },
  {
    id: "hunter",
    role: "ranged",
    get name() {
      return t("hero.hunter.name");
    },
    theme: HERO_THEME.hunter,
    price: 0,
    get desc() {
      return t("hero.hunter.desc");
    },
  },
  {
    id: "gunner",
    role: "ranged",
    get name() {
      return t("hero.gunner.name");
    },
    theme: HERO_THEME.gunner,
    price: GUNNER_PRICE,
    get desc() {
      return t("hero.gunner.desc");
    },
  },
  {
    id: "paladin",
    role: "tank",
    get name() {
      return t("hero.paladin.name");
    },
    theme: HERO_THEME.paladin,
    price: PALADIN_PRICE,
    get desc() {
      return t("hero.paladin.desc");
    },
  },
  {
    id: "samurai",
    role: "warrior",
    get name() {
      return t("hero.samurai.name");
    },
    theme: HERO_THEME.samurai,
    price: SAMURAI_PRICE,
    get desc() {
      return t("hero.samurai.desc");
    },
  },
  {
    id: "shinobi",
    role: "warrior",
    get name() {
      return t("hero.shinobi.name");
    },
    theme: HERO_THEME.shinobi,
    price: SHINOBI_PRICE,
    get desc() {
      return t("hero.shinobi.desc");
    },
  },
];

export const HEROES: readonly Hero[] = HERO_LIST.map((h) => h.id);
export const HERO_ROLE = Object.fromEntries(HERO_LIST.map((h) => [h.id, h.role])) as Record<
  Hero,
  Role
>;
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
export function chargeRingColor(h: Hero | HeroTheme, full: boolean, time: number) {
  const t = typeof h === "string" ? HERO_THEME[h] : h;
  return full ? withAlpha(t.glow, 0.6 + 0.4 * Math.sin(time * 30)) : withAlpha(t.accent, 0.65);
}

/** HUD'dagi dash va kuchli zarba chiziqlari: [tayyor, yig'ilmoqda, bo'sh]. Skin theme ham bo'ladi. */
export function hudBarColors(h: Hero | HeroTheme) {
  const t = typeof h === "string" ? HERO_THEME[h] : h;
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
        ch4: "pixel-rpg-best-ch4",
      }
    : {
        best: `pixel-rpg-best-${h}`,
        endless: `pixel-rpg-endless-best-${h}`,
        // 2- va 3-dunyoni yutgan o'yinlar rekordi alohida
        ch2: `pixel-rpg-best-ch2-${h}`,
        ch3: `pixel-rpg-best-ch3-${h}`,
        // 4-dunyo — Sakura bog'i
        ch4: `pixel-rpg-best-ch4-${h}`,
      };
}
