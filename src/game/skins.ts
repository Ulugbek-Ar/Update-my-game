/**
 * SKINLAR — qahramonning boshqa palitrasi (yangi piksel rasm chizilmaydi). Har skin 5 rang: sprites.ts
 * dagi PALETTES bilan bir xil tartibda (1 — kontur, doim to'q; 2..5 — o'sha qahramonning qismlari).
 *
 * QOIDA: har qahramonda "default" (hozirgi palitra, bepul, doim ochiq) + 3 ta skin. Kelajakda har
 * yangi qahramon 3 ta skin bilan qo'shiladi (skins.test.ts tekshiradi). Dushmanlar o'zgarmaydi.
 *
 * Sotib olingan va tanlangan skinlar SKINS_KEY da (pixel-rpg- kaliti — ko'chirish kodi va bulutli
 * saqlanishga o'zi kiradi). Onlayn olamda skin id'si yuboriladi; server faqat mavjud id'ni oladi.
 */
import { HEROES as HERO_IDS, type Hero } from "./hero";
import { PALETTES } from "./sprites";
import {
  DEFAULT_THEME,
  PLAIN_FX,
  tierOfPrice,
  type SkinFx,
  type SkinLook,
  type SkinTheme,
  type SkinTier,
} from "./skinFx";

export const SKINS_KEY = "pixel-rpg-skins";
export const DEFAULT_SKIN = "default";
/** Narxlar: 1-, 2-, 3-skin */
export const SKIN_PRICES = [80, 150, 250] as const;

export interface Skin {
  /** "default" yoki "<qahramon>-<nom>" (masalan "knight-gold") */
  id: string;
  hero: Hero;
  name: string;
  price: number;
  colors: readonly string[];
  /** Daraja: narxdan (80 — oddiy, 150 — noyob, 250 — afsonaviy) */
  tier: SkinTier;
  /** Qobiliyat, HUD va tugmalar ranglari (skinFx.ts: SkinTheme) */
  theme: SkinTheme;
  /** Zarracha, iz, zarba, ovoz va animatsiya qo'shimchasi */
  fx: SkinFx;
}

type Def = [id: string, name: string, colors: readonly string[]];

/** Ranglar tartibi: accent, accentDark, glow, uiText, empty, edge, inner, spark, hot, core, rim, glint, ink, shade, mist */
type ThemeRow = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

function theme(r: ThemeRow): SkinTheme {
  const [
    accent,
    accentDark,
    glow,
    uiText,
    empty,
    edge,
    inner,
    spark,
    hot,
    core,
    rim,
    glint,
    ink,
    shade,
    mist,
  ] = r;
  const n = parseInt(accent.slice(1), 16);
  return {
    accent,
    accentDark,
    glow,
    trail: `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.8)`,
    uiText,
    empty,
    edge,
    inner,
    spark,
    hot,
    core,
    rim,
    glint,
    ink,
    shade,
    mist,
  };
}

/**
 * Skin qobiliyat ranglari (har skin nomiga mos). Xavf ranglaridan (danger.ts) uzoq: qizil/olovli
 * skinlar ham to'q qizil-qora va oltin-sariq ohangda — boss ogohlantirish doirasiga o'xshamaydi.
 */
// prettier-ignore
const THEMES: Record<string, ThemeRow> = {
  // Qora Ritsar: qora po'lat, binafsha-kumush nur
  "knight-black": ["#a99cf0", "#4e4470", "#ddd8ff", "#b9b0f5", "#24203a", "#e4e0ff", "#a99cf0", "#e4e0ff", "#a99cf0", "#4e4470", "#ddd8ff", "#ffffff", "#08070f", "#24203a", "#8c86a8"],
  // Oltin Ritsar: oltin chang va yulduzchalar
  "knight-gold": ["#f2c14e", "#b8860b", "#fff2b0", "#f2c14e", "#3a2c08", "#fff6d0", "#f2c14e", "#fff2b0", "#f2c14e", "#8a6410", "#fff2b0", "#ffffff", "#140c02", "#3a2c08", "#e8d8a0"],
  // Muz Ritsar: muz kristallari, qor izi
  "knight-ice": ["#9fe6ff", "#2f7f8f", "#eafaff", "#9fe6ff", "#16303a", "#ffffff", "#9fe6ff", "#dff6ff", "#c6ecff", "#2f7f8f", "#c6ecff", "#ffffff", "#0a1420", "#16303a", "#f4fbff"],
  // Qor Sehrgar: muzli halqa va qor shari
  "mage-frost": ["#8fd8ff", "#2f7f9a", "#e6f6ff", "#8fd8ff", "#1c2a3a", "#c6ecff", "#e6f6ff", "#bfefff", "#8fd8ff", "#2f7f9a", "#c6ecff", "#ffffff", "#05070d", "#1c2a4a", "#3a5a7a"],
  // Zahar Sehrgar: yashil zahar tomchilari va tutun
  "mage-venom": ["#7fd04a", "#3f7a1f", "#d0f0a0", "#9fe060", "#1f3a14", "#9fe060", "#c9f07a", "#b8f070", "#6fbf3a", "#2a5a14", "#8fd050", "#e8ffc0", "#050805", "#1f2a1a", "#34402a"],
  // Quyosh Sehrgar: oltin-sariq quyosh nuri
  "mage-sun": ["#ffd23c", "#c8820f", "#fff6c8", "#ffd23c", "#3a2a0a", "#fff0a0", "#ffd23c", "#ffe680", "#ffc850", "#b06a10", "#ffe08a", "#ffffff", "#0a0603", "#5a2a10", "#8a5a20"],
  // Qish Ovchisi: oq qayin o'qi, ayozli nur
  "hunter-winter": ["#c9e8ff", "#5a7a96", "#f0f8ff", "#c9e8ff", "#24303c", "#e0f0ff", "#c9e8ff", "#dfe8f0", "#c9d4de", "#b8c4d0", "#c9d4de", "#ffffff", "#0a0d12", "#5a6372", "#f4fbff"],
  // Cho'l Ovchisi: qum va issiq shamol
  "hunter-desert": ["#e8c47a", "#9a6a30", "#fff0c8", "#e8c47a", "#3a2c14", "#f0d090", "#e8c47a", "#d9b070", "#c9a26b", "#7a5a2a", "#b89a6a", "#fff4dc", "#120c06", "#5a3a1a", "#f0e0c0"],
  // Tungi Ovchi: tun binafshasi va oy kumushi
  "hunter-night": ["#b49cff", "#5a3fa0", "#e8e0ff", "#c4b0ff", "#221a3a", "#d0c4ff", "#b49cff", "#c8b8ff", "#8a70e0", "#3a2f5a", "#9a90c0", "#ffffff", "#05040a", "#1d1a2e", "#c9c0e8"],
  // Oq Mergan: oq tutun va kumush o'q
  "gunner-white": ["#e8eef6", "#7a8aa0", "#ffffff", "#e8eef6", "#2a2e36", "#f4f0e8", "#a0a8b4", "#c8ccd4", "#e0e0e8", "#f0f0f4", "#d0d4dc", "#ffffff", "#0b0907", "#6a7080", "#b0b4bc"],
  // Qizil Mergan: to'q qizil-qora tutun va oltin cho'g'
  "gunner-red": ["#f4c24e", "#6a0e14", "#ffe08a", "#f4c24e", "#2e1414", "#ffd890", "#3a0a0e", "#7a1418", "#4a1a1a", "#2a0a0c", "#5a1a1e", "#ffe08a", "#0b0505", "#6a0e14", "#3a2a2a"],
  // Dasht Mergani: o't, bug'doy va shamol
  "gunner-steppe": ["#9ad05a", "#3a7a3a", "#f0e0a0", "#c8e080", "#2a3018", "#e0c070", "#b08a50", "#f0d890", "#c8b078", "#b08a50", "#d8c898", "#fff4c8", "#0b0907", "#5a4a30", "#a89870"],
  // Kumush Paladin: oq-kumush nur
  "paladin-silver": ["#c8d4e6", "#6a7486", "#f4f8ff", "#d8e2f0", "#2a303a", "#ffffff", "#c8d4e6", "#e8eef6", "#f4f8ff", "#6a7486", "#f4f8ff", "#ffffff", "#0a0c10", "#2a303a", "#f4f8ff"],
  // Qora Paladin: binafsha soya, tutun va cho'g'
  "paladin-shadow": ["#b07aff", "#5a2a8a", "#e6d0ff", "#c8a0ff", "#2a1a3a", "#f0e4ff", "#b07aff", "#d0a8ff", "#e6d0ff", "#5a2a8a", "#e6d0ff", "#ffffff", "#050307", "#2a1a30", "#8a6aa8"],
  // Olov Paladin: oltin-sariq alanga, oq yadro (xavf zonasining qizilidan uzoq)
  "paladin-flame": ["#ffc24a", "#b8620a", "#fff0b0", "#ffc24a", "#3a1e08", "#fffbe8", "#ffd870", "#ffe08a", "#fff0b0", "#b8620a", "#fff0b0", "#ffffff", "#170602", "#4a1a06", "#ffd870"],
};

const DEFS: Record<Hero, readonly Def[]> = {
  // Ritsar: kontur, zirh soyasi, zirh, yaltiroq, oqish chaqnash
  knight: [
    ["black", "QORA RITSAR", ["#050508", "#17171f", "#2e2e3a", "#5a5a6c", "#c4c4d4"]],
    ["gold", "OLTIN RITSAR", ["#140c02", "#6b4a0e", "#b8860b", "#f2c14e", "#fff2b0"]],
    ["ice", "MUZ RITSAR", ["#0a1420", "#3f6f99", "#7fb8e0", "#c6ecff", "#f4fbff"]],
  ],
  // Sehrgar: kontur, to'n, bezak (astar, kamar, kristall), soqol, teri
  mage: [
    ["frost", "QOR SEHRGAR", ["#05070d", "#1c2a4a", "#3f86c2", "#e6f6ff", "#e8c39e"]],
    ["venom", "ZAHAR SEHRGAR", ["#050805", "#1f2a1a", "#6fbf3a", "#c9d4c0", "#e8c39e"]],
    ["sun", "QUYOSH SEHRGAR", ["#0a0603", "#5a2a10", "#ff9a3c", "#ffe2a0", "#e8c39e"]],
  ],
  // Ovchi: kontur, kapyushon ichi, plash, charm, teri
  hunter: [
    ["winter", "QISH OVCHISI", ["#0a0d12", "#5a6372", "#c9d4de", "#6b4a2a", "#e8c39e"]],
    ["desert", "CHO'L OVCHISI", ["#120c06", "#7a5a2a", "#c9a26b", "#5a3a1a", "#d9a07a"]],
    ["night", "TUNGI OVCHI", ["#05040a", "#1d1a2e", "#3a2f5a", "#4a2c18", "#c9b0a0"]],
  ],
  // Mergan: kontur, shlyapa va kamzul, plash, bo'yinbog', mis va yuz
  gunner: [
    ["white", "OQ MERGAN", ["#0b0907", "#d9d2c6", "#8a847a", "#2b6fb8", "#dba45a"]],
    ["red", "QIZIL MERGAN", ["#0b0505", "#4a1010", "#8a2a1a", "#ffcc33", "#dba45a"]],
    ["steppe", "DASHT MERGANI", ["#0b0907", "#5a4a30", "#b08a50", "#3a7a3a", "#e0b070"]],
  ],
  // Paladin: kontur, bronza soya, plastinka zirh, tig', ustki kiyim va nur
  paladin: [
    ["silver", "KUMUSH PALADIN", ["#0a0c10", "#4a5262", "#aab4c4", "#e8eef6", "#fbf8ec"]],
    ["shadow", "QORA PALADIN", ["#050307", "#2a1a30", "#4a3a5a", "#aab4c4", "#b02a2a"]],
    ["flame", "OLOV PALADIN", ["#170602", "#7a1a0a", "#d8452a", "#ffb02e", "#fff0b0"]],
  ],
};

/**
 * DARAJALAR: 80 — ODDIY (faqat ranglar: barcha qobiliyat effektlari skin rangida), 150 — NOYOB
 * (+ o'z zarrachalari, izi va zarba uchquni shakli), 250 — AFSONAVIY (+ turgandagi va hujumdagi
 * animatsiya qo'shimchasi, maxsus zarba shakli, o'z ovoz ohangi, menyu/do'konda porlash va onlayn
 * ism yonida belgi). Har skin effekti nomi va xarakteriga mos.
 */
const FX: Record<string, SkinFx> = {
  // NOYOB: oltin chang va yulduzchalar
  "knight-gold": {
    ...PLAIN_FX,
    particle: "star",
    trail: "sparkle",
    bits: ["#fff2b0", "#fff6d0"],
  },
  // AFSONAVIY: muz bo'laklari, qor izi, muz kristali yorilishi, muz qo'ng'iroqchasi
  "knight-ice": {
    particle: "shard",
    trail: "snow",
    bits: ["#ffffff", "#c6ecff"],
    impact: "crystal",
    flair: "frost",
    tone: "chime",
  },
  // NOYOB: zahar tomchilari va yashil tutun
  "mage-venom": {
    ...PLAIN_FX,
    particle: "drop",
    trail: "smoke",
    bits: ["#c9f07a", "#3f7a1f"],
  },
  // AFSONAVIY: quyosh nurlari, cho'g' izi, quyosh chaqnashi, halo, yorug' akkord
  "mage-sun": {
    particle: "star",
    trail: "ember",
    bits: ["#fff6c8", "#ffe680"],
    impact: "flare",
    flair: "halo",
    tone: "sun",
  },
  // NOYOB: qum zarralari va issiq shamol izi
  "hunter-desert": {
    ...PLAIN_FX,
    particle: "streak",
    trail: "sand",
    bits: ["#f0e0c0", "#c9a26b"],
  },
  // AFSONAVIY: tun yulduzchalari, soya izi, yarim oy o'rog'i, porlovchi ko'zlar
  "hunter-night": {
    particle: "star",
    trail: "shadow",
    bits: ["#e8e0ff", "#9a90c0"],
    impact: "crescent",
    flair: "eyes",
    tone: "night",
  },
  // NOYOB: to'q qizil-qora tutun va oltin cho'g'
  "gunner-red": {
    ...PLAIN_FX,
    particle: "ember",
    trail: "smoke",
    bits: ["#ffd890", "#3a0a0e"],
  },
  // AFSONAVIY: o't va bug'doy barglari, shamol burami, hilpiragan bo'yinbog'
  "gunner-steppe": {
    particle: "leaf",
    trail: "leaf",
    bits: ["#9ad05a", "#f0e0a0"],
    impact: "gust",
    flair: "scarf",
    tone: "steppe",
  },
  // NOYOB: binafsha tutun va cho'g'
  "paladin-shadow": {
    ...PLAIN_FX,
    particle: "ember",
    trail: "shadow",
    bits: ["#e6d0ff", "#2a1a30"],
  },
  // AFSONAVIY: oltin alanga, feniks qanotlari, yelkada cho'g'lar
  "paladin-flame": {
    particle: "ember",
    trail: "ember",
    bits: ["#fff0b0", "#ffd870"],
    impact: "phoenix",
    flair: "embers",
    tone: "flame",
  },
};

const DEFAULT_NAME: Record<Hero, string> = {
  knight: "ODDIY RITSAR",
  mage: "ODDIY SEHRGAR",
  hunter: "ODDIY OVCHI",
  gunner: "ODDIY MERGAN",
  paladin: "ODDIY PALADIN",
};

/** Har qahramon skinlari: birinchisi — default (bepul) */
export const SKINS: Record<Hero, readonly Skin[]> = Object.fromEntries(
  HERO_IDS.map((h) => [
    h,
    [
      {
        id: DEFAULT_SKIN,
        hero: h,
        name: DEFAULT_NAME[h],
        price: 0,
        colors: PALETTES[h],
        tier: "default",
        theme: DEFAULT_THEME[h],
        fx: PLAIN_FX,
      },
      ...DEFS[h].map(([id, name, colors], i) => {
        const price = SKIN_PRICES[i] ?? 250;
        const sid = `${h}-${id}`;
        return {
          id: sid,
          hero: h,
          name,
          price,
          colors,
          tier: tierOfPrice(price),
          theme: theme(THEMES[sid]!),
          // ODDIY — faqat ranglar
          fx: FX[sid] ?? PLAIN_FX,
        };
      }),
    ] satisfies Skin[],
  ]),
) as unknown as Record<Hero, readonly Skin[]>;

export function skinById(hero: Hero, id: string | null | undefined): Skin | null {
  return SKINS[hero]?.find((s) => s.id === id) ?? null;
}

/** Skin nomi id bo'yicha ("knight-gold" -> "OLTIN RITSAR") */
export function skinName(id: string) {
  for (const h of HERO_IDS) for (const s of SKINS[h]) if (s.id === id) return s.name;
  return id;
}

/**
 * Skin ko'rinishi (rang + effektlar). id berilmasa — tanlangan skin; noma'lum id — default.
 * Onlayn olamda boshqa o'yinchining skin id'si bilan ham chaqiriladi (qo'shimcha trafiksiz).
 */
export function skinLook(hero: Hero, id?: string | null): SkinLook {
  const s = (id === undefined ? selectedSkin(hero) : skinById(hero, id)) ?? SKINS[hero][0]!;
  return s;
}

/** Onlayn: server faqat shu qahramonda mavjud skin id'sini qabul qiladi */
export function isSkinId(hero: Hero, id: unknown): id is string {
  return typeof id === "string" && !!skinById(hero, id);
}

/** Barcha pullik skin id'lari (muallif paneli "Hammasini ochish") */
export function paidSkinIds(): string[] {
  return HERO_IDS.flatMap((h) => SKINS[h].filter((s) => s.price > 0).map((s) => s.id));
}

// ---------------- saqlanish ----------------

export interface SkinSave {
  /** sotib olingan (pullik) skinlar */
  owned: string[];
  /** har qahramon uchun tanlangan skin */
  sel: Partial<Record<Hero, string>>;
}

/** Saqlangan yozuvni tekshiradi: noma'lum id'lar tashlanadi (sof funksiya — server ham ishlatadi) */
export function parseSkins(raw: string | null | undefined): SkinSave {
  const out: SkinSave = { owned: [], sel: {} };
  try {
    const v = JSON.parse(raw ?? "null") as Partial<SkinSave> | null;
    if (!v || typeof v !== "object") return out;
    const paid = new Set(paidSkinIds());
    if (Array.isArray(v.owned))
      out.owned = [...new Set(v.owned.filter((x): x is string => paid.has(x as string)))];
    if (v.sel && typeof v.sel === "object")
      for (const h of HERO_IDS) {
        const id = (v.sel as Record<string, unknown>)[h];
        if (isSkinId(h, id)) out.sel[h] = id;
      }
  } catch {
    /* buzuq yozuv — hammasi default */
  }
  return out;
}

export function loadSkins(): SkinSave {
  try {
    return parseSkins(localStorage.getItem(SKINS_KEY));
  } catch {
    return { owned: [], sel: {} };
  }
}

function saveSkins(s: SkinSave) {
  try {
    localStorage.setItem(SKINS_KEY, JSON.stringify(s));
  } catch {
    /* saqlash imkonsiz */
  }
}

/** Default doim ochiq; pullik — sotib olingan bo'lsa */
export function ownsSkin(skin: Skin, save: SkinSave = loadSkins()) {
  return skin.price <= 0 || save.owned.includes(skin.id);
}

/** Tanlangan skin (sotib olinmagan yoki noma'lum bo'lsa — default) */
export function selectedSkin(hero: Hero, save: SkinSave = loadSkins()): Skin {
  const s = skinById(hero, save.sel[hero]);
  return s && ownsSkin(s, save) ? s : SKINS[hero][0]!;
}

/** Chizish uchun palitra: default bo'lsa undefined (asl palitra va kesh) */
export function skinPalette(hero: Hero, id?: string | null) {
  const s = id === undefined ? selectedSkin(hero) : skinById(hero, id);
  return s && s.id !== DEFAULT_SKIN ? { id: s.id, colors: s.colors } : undefined;
}

/** Sotib olish: oltin yetsa — ayiriladi, skin ochiladi va tanlanadi */
export function buySkin(
  hero: Hero,
  id: string,
  gold: { get: () => number; set: (n: number) => void },
) {
  const skin = skinById(hero, id);
  const save = loadSkins();
  if (!skin || ownsSkin(skin, save)) return false;
  const g = gold.get();
  if (g < skin.price) return false;
  gold.set(g - skin.price);
  save.owned.push(skin.id);
  save.sel[hero] = skin.id;
  saveSkins(save);
  return true;
}

/** Tanlash: faqat ochiq skin */
export function selectSkin(hero: Hero, id: string) {
  const skin = skinById(hero, id);
  const save = loadSkins();
  if (!skin || !ownsSkin(skin, save)) return false;
  save.sel[hero] = skin.id;
  saveSkins(save);
  return true;
}

/** Progress yozuvlariga (bulut, muallif paneli, sovg'a) skin qo'shish — sof funksiya */
export function grantSkinsIn(raw: string | undefined, ids: readonly string[]) {
  const s = parseSkins(raw);
  const paid = new Set(paidSkinIds());
  for (const id of ids) if (paid.has(id) && !s.owned.includes(id)) s.owned.push(id);
  return JSON.stringify(s);
}
