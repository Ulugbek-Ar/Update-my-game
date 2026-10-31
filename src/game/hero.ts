/** Qahramon tanlovi: bosh menyuda tanlanadi va localStorage'da saqlanadi. */
export type Hero = "knight" | "mage" | "hunter" | "gunner" | "paladin";

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
    name: "TANK",
    color: "#f2c14e",
    desc: "Dushman va bossni o'ziga tortadi, zarbani ko'taradi",
  },
  warrior: { name: "JANGCHI", color: "#68cde4", desc: "Yaqin jangda tez va chaqqon uradi" },
  caster: { name: "SEHRGAR", color: "#ff4d4d", desc: "Sehr bilan katta zarar beradi" },
  ranged: { name: "UZOQDAN", color: "#a6f08e", desc: "Masofadan turib otadi" },
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

export const HERO_LIST: readonly HeroInfo[] = [
  {
    id: "knight",
    role: "warrior",
    name: "RITSAR",
    theme: HERO_THEME.knight,
    price: 0,
    desc: "Qilich, aylana zarba va dash. 6 yurak — eng chidamli.",
  },
  {
    id: "mage",
    role: "caster",
    name: "SEHRGAR",
    theme: HERO_THEME.mage,
    price: 0,
    desc: "Sehrli shar, olovli halqa va teleport. Uzoqdan uradi.",
  },
  {
    id: "hunter",
    role: "ranged",
    name: "OVCHI",
    theme: HERO_THEME.hunter,
    price: 0,
    desc: "O'q, teshuvchi o'q, orqaga sakrash va tuzoq. Eng tez yuradi.",
  },
  {
    id: "gunner",
    role: "ranged",
    name: "MERGAN",
    theme: HERO_THEME.gunner,
    price: GUNNER_PRICE,
    desc: "Chaqmoqtoshli to'pponcha: barabanda 6 o'q, bosib tursang hammasini yelpig'ich qilib otadi. Sirpanish va tutun bombasi.",
  },
  {
    id: "paladin",
    role: "tank",
    name: "PALADIN",
    theme: HERO_THEME.paladin,
    price: PALADIN_PRICE,
    desc: "Qalqonsiz tank: ikki metrlik ulkan qilich. SHANG — yo'lak bo'ylab zarba, Osmon hukmi gangitadi, Qasam dushmanlarni o'ziga tortadi. 8 yurak.",
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
