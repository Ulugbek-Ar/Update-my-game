/**
 * Progress yozuvlarini (bulutli saqlanish kalitlari) o'zgartiruvchi sof funksiyalar: muallif
 * paneli ("HAMMASINI OCHISH", oltin/XP/qahramon) va sovg'alar shular orqali serverda bulutdagi
 * saqlanishga yoziladi. localStorage'ga tegmaydi — klient ham, server ham, testlar ham ishlatadi.
 *
 * Ro'yxatlar (qahramonlar, do'kon, yutuqlar, olam sirlari) kodda qattiq yozilmagan — har safar
 * manbadan olinadi: keyingi versiyada qo'shiladigan qahramon va yutuqlar ham ochiladi.
 */
import { ACHIEVEMENTS, ACHIEVEMENTS_KEY } from "@/game/achievements";
import { GIFT_KEY } from "@/game/gift";
import { HERO_LIST } from "@/game/hero";
import {
  MAP_WORLDS,
  WORLD1_WON_KEY,
  WORLD2_WON_KEY,
  WORLD3_WON_KEY,
  WORLD_WINS_KEY,
} from "@/game/progress";
import { UNLOCKED_HEROES_KEY } from "@/game/save";
import { GOLD_KEY, SHOP_ITEMS, SHOP_KEY } from "@/game/shop";
import valley from "@/realm/data/regions/valley.json";
import ashmount from "@/realm/data/regions/ashmount.json";
import { GOLD_CAP, XP_CAP } from "./limits";
import { MAX_LEVEL, XP_KEY, levelOf, xpForLevel } from "./xp";

export type Keys = Record<string, string>;

/**
 * src/game/realmLink.ts dagi kalitlar (u import.meta.env ishlatadi — server build'iga kirmaydi;
 * tengligini grants.test.ts tekshiradi)
 */
export const REALM_SAVE_KEY = "pixel-rpg-realm";
export const REALM_KEYS_KEY = "pixel-rpg-realm-keys";
export const BOSS_KEYS = ["devil", "queen", "king"] as const;

/** "HAMMASINI OCHISH": oltin shundan kam bo'lsa — shuncha */
export const UNLOCK_GOLD = 99_999;

/** Barcha olam hududlaridagi sirlar (kashfiyotlar) */
export function realmSecretIds(): string[] {
  const out: string[] = [];
  for (const r of [valley, ashmount] as { secrets?: { id?: unknown }[] }[])
    for (const s of r.secrets ?? []) if (typeof s.id === "string") out.push(s.id);
  return out;
}

/** "HAMMASINI OCHISH" ro'yxatlari — testda yangi qahramon qo'shilgandek sinash uchun almashtiriladi */
export interface UnlockLists {
  heroes: readonly { id: string; price: number }[];
  shop: readonly { id: string; costs: readonly number[] }[];
  achievements: readonly { id: string }[];
  secrets: readonly string[];
}

export const defaultLists = (): UnlockLists => ({
  heroes: HERO_LIST,
  shop: SHOP_ITEMS,
  achievements: ACHIEVEMENTS,
  secrets: realmSecretIds(),
});

function json<T>(raw: string | undefined, fallback: T): T {
  try {
    const v = JSON.parse(raw ?? "null") as unknown;
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function strList(raw: string | undefined): string[] {
  const v = json<unknown>(raw, []);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

const int = (raw: string | undefined) => {
  const n = Math.floor(Number(raw ?? 0));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** XP yozuvi (xp.ts XpSave): q, s ro'yxatlari va kasr saqlanadi */
function xpSave(data: Keys) {
  const v = json<Record<string, unknown> | null>(data[XP_KEY], null);
  const o = v && typeof v === "object" && !Array.isArray(v) ? { ...v } : {};
  const xp = int(String(o["xp"] ?? 0));
  const lvl = Math.floor(Number(o["lvl"]));
  return {
    ...o,
    xp,
    lvl: Number.isFinite(lvl) && lvl >= 1 ? Math.min(lvl, MAX_LEVEL) : levelOf(xp),
    q: Array.isArray(o["q"]) ? o["q"] : [],
    s: Array.isArray(o["s"]) ? o["s"] : [],
  };
}

export const goldIn = (data: Keys) => int(data[GOLD_KEY]);
export const xpIn = (data: Keys) => xpSave(data).xp;

/** Ochilgan qahramonlar (bepullar doim) */
export function heroesIn(data: Keys, heroes: UnlockLists["heroes"] = HERO_LIST): string[] {
  const owned = new Set(strList(data[UNLOCKED_HEROES_KEY]));
  return heroes.filter((h) => h.price <= 0 || owned.has(h.id)).map((h) => h.id);
}

/** Oltin qo'shish (manfiy — ayirish, 0 dan pastga tushmaydi) */
export function grantGold(data: Keys, n: number): Keys {
  const v = Math.max(0, Math.min(GOLD_CAP, goldIn(data) + Math.floor(n)));
  return { ...data, [GOLD_KEY]: String(v) };
}

/**
 * XP qo'shish. Daraja sovg'alari (oltin) menyuda odatdagidek olinadi — `lvl` o'zgarmaydi.
 */
export function grantXp(data: Keys, n: number): Keys {
  const s = xpSave(data);
  s.xp = Math.max(0, Math.min(XP_CAP, s.xp + Math.floor(n)));
  if (s.lvl > levelOf(s.xp)) s.lvl = levelOf(s.xp);
  return { ...data, [XP_KEY]: JSON.stringify(s) };
}

/** Darajani o'rnatish (1..50): XP shu daraja boshiga; sovg'alari olingan deb hisoblanadi */
export function setLevel(data: Keys, level: number): Keys {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const s = xpSave(data);
  s.xp = xpForLevel(l);
  s.lvl = l;
  return { ...data, [XP_KEY]: JSON.stringify(s) };
}

/** Qahramonni ochish (pullik qahramonlar ro'yxatga yoziladi) */
export function grantHero(data: Keys, hero: string): Keys {
  const list = strList(data[UNLOCKED_HEROES_KEY]);
  if (list.includes(hero)) return data;
  return { ...data, [UNLOCKED_HEROES_KEY]: JSON.stringify([...list, hero]) };
}

/** Qahramonni yopish (sinov uchun; bepullar baribir ochiq qoladi) */
export function revokeHero(data: Keys, hero: string): Keys {
  const list = strList(data[UNLOCKED_HEROES_KEY]);
  if (!list.includes(hero)) return data;
  return { ...data, [UNLOCKED_HEROES_KEY]: JSON.stringify(list.filter((h) => h !== hero)) };
}

/** Kunlik sovg'ani tiklash: bugun yana olish mumkin (ketma-ketlik 1-kundan) */
export function resetDailyGift(data: Keys): Keys {
  const out = { ...data };
  delete out[GIFT_KEY];
  return out;
}

/**
 * "HAMMASINI OCHISH": barcha qahramonlar, do'kon maksimal, dunyolar va bosslar yengilgan, olam
 * kalitlari (darvozalar — hududlar), olamdagi sirlar (olam saqlanishi bo'lsa), yutuqlar,
 * 50-daraja va kamida 99 999 oltin. Qayta bossa — keyin qo'shilganlar ham ochiladi; mavjud
 * progress (rekordlar, olam inventari) o'chmaydi.
 */
export function unlockAll(data: Keys, lists: UnlockLists = defaultLists()): Keys {
  let out: Keys = { ...data };
  // qahramonlar: pulliklari ro'yxatga (bepullar doim ochiq)
  const owned = new Set(strList(out[UNLOCKED_HEROES_KEY]));
  for (const h of lists.heroes) if (h.price > 0) owned.add(h.id);
  out[UNLOCKED_HEROES_KEY] = JSON.stringify([...owned]);
  // do'kon: har kuchaytirish oxirgi bosqichida
  const shop = json<Record<string, unknown>>(out[SHOP_KEY], {});
  const levels: Record<string, number> =
    shop && typeof shop === "object" && !Array.isArray(shop)
      ? Object.fromEntries(Object.entries(shop).map(([k, v]) => [k, Number(v) || 0]))
      : {};
  for (const item of lists.shop) levels[item.id] = item.costs.length;
  out[SHOP_KEY] = JSON.stringify(levels);
  // dunyolar: yutilgan va har birini barcha qahramonlar yutgan
  out[WORLD1_WON_KEY] = "1";
  out[WORLD2_WON_KEY] = "1";
  out[WORLD3_WON_KEY] = "1";
  const ids = lists.heroes.map((h) => h.id);
  out[WORLD_WINS_KEY] = JSON.stringify(Object.fromEntries(MAP_WORLDS.map((w) => [w, ids])));
  // bosslar: olam darvozalari kalitlari
  const keys = new Set([...strList(out[REALM_KEYS_KEY]), ...BOSS_KEYS]);
  out[REALM_KEYS_KEY] = JSON.stringify([...keys]);
  // yutuqlar
  const ach = new Set([...strList(out[ACHIEVEMENTS_KEY]), ...lists.achievements.map((a) => a.id)]);
  out[ACHIEVEMENTS_KEY] = JSON.stringify([...ach]);
  // olam sirlari: olam saqlanishi bo'lsa (olamga bir marta kirilgan)
  const realm = json<{ player?: { secrets?: unknown } } | null>(out[REALM_SAVE_KEY], null);
  if (realm?.player && typeof realm.player === "object") {
    const got = Array.isArray(realm.player.secrets)
      ? realm.player.secrets.filter((x): x is string => typeof x === "string")
      : [];
    realm.player.secrets = [...new Set([...got, ...lists.secrets])];
    out[REALM_SAVE_KEY] = JSON.stringify(realm);
  }
  // daraja va oltin
  if (xpIn(out) < xpForLevel(MAX_LEVEL)) out = setLevel(out, MAX_LEVEL);
  if (goldIn(out) < UNLOCK_GOLD) out[GOLD_KEY] = String(UNLOCK_GOLD);
  return out;
}

/** Sovg'a: oltin, XP va qahramon bitta yozuvda */
export function applyGift(data: Keys, g: { gold: number; xp: number; hero: string | null }): Keys {
  let out = data;
  if (g.gold > 0) out = grantGold(out, g.gold);
  if (g.xp > 0) out = grantXp(out, g.xp);
  if (g.hero) out = grantHero(out, g.hero);
  return out;
}
