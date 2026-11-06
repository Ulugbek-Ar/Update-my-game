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
}

type Def = [id: string, name: string, colors: readonly string[]];

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
      { id: DEFAULT_SKIN, hero: h, name: DEFAULT_NAME[h], price: 0, colors: PALETTES[h] },
      ...DEFS[h].map(([id, name, colors], i) => ({
        id: `${h}-${id}`,
        hero: h,
        name,
        price: SKIN_PRICES[i] ?? 250,
        colors,
      })),
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
