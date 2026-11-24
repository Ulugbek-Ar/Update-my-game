/**
 * Til tanlash (o'zbek — asosiy, rus, ingliz). t("kalit", {n: 3}) — joriy tildagi matn,
 * {n} kabi o'rinlar params bilan to'ldiriladi. Tanlangan til "pixel-rpg-lang" kalitida saqlanadi
 * (progress kaliti — bulutli saqlanishga ham kiradi). Tanlanmagan bo'lsa — Telegram language_code
 * yoki navigator.language: ru → rus, uz → o'zbek, boshqasi → ingliz.
 *
 * SSR va gidratsiya bir xil chiqishi uchun initLang() chaqirilguncha til — o'zbek.
 */
import { uz, type Key } from "./uz";
import { ru } from "./ru";
import { en } from "./en";

export type { Key };
export type Lang = "uz" | "ru" | "en";
export const LANG_KEY = "pixel-rpg-lang";
export const DICTS: Record<Lang, Record<Key, string>> = { uz, ru, en };
export const LANGS: readonly { id: Lang; label: string }[] = [
  { id: "uz", label: "O'zbekcha" },
  { id: "ru", label: "Русский" },
  { id: "en", label: "English" },
];

const isLang = (v: unknown): v is Lang => v === "uz" || v === "ru" || v === "en";

/** Til kodi ("ru-RU", "uz", "en-US") → o'yin tili */
export function langFromCode(code: string | null | undefined): Lang {
  const c = (code ?? "").toLowerCase();
  if (c.startsWith("ru")) return "ru";
  if (c.startsWith("uz")) return "uz";
  return "en";
}

/** Birinchi ochilish: Telegram foydalanuvchisi tili, bo'lmasa brauzer tili */
export function detectLang(): Lang {
  if (typeof window === "undefined") return "uz";
  const tg = (
    window as unknown as {
      Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } };
    }
  ).Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  if (tg) return langFromCode(tg);
  const nav = typeof navigator !== "undefined" ? navigator.languages?.[0] ?? navigator.language : "";
  return langFromCode(nav);
}

function stored(): Lang | null {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

let current: Lang = "uz";
const listeners = new Set<(l: Lang) => void>();

function apply(l: Lang) {
  if (typeof document !== "undefined") document.documentElement.lang = l;
  if (l === current) return;
  current = l;
  for (const fn of listeners) fn(l);
}

export function getLang(): Lang {
  return current;
}

/** Klientda bir marta (va bulutdan progress tiklangandan keyin): saqlangan yoki aniqlangan til */
export function initLang() {
  apply(stored() ?? detectLang());
}

/** O'yinchi tanlovi: saqlanadi va hamma joy darhol yangilanadi */
export function setLang(l: Lang) {
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    /* saqlash imkonsiz */
  }
  apply(l);
}

export function onLangChange(fn: (l: Lang) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export type Params = Record<string, string | number>;

function fill(s: string, params?: Params) {
  return params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s;
}

/** Joriy tildagi matn; kalit yo'q bo'lsa — o'zbekcha, u ham yo'q bo'lsa — kalitning o'zi */
export function t(key: Key, params?: Params): string {
  return fill(DICTS[current][key] ?? uz[key] ?? key, params);
}

/** Kalit oldindan ma'lum bo'lmaganda (masalan `hero.${id}.name`) */
export function tk(key: string, params?: Params): string {
  return t(key as Key, params);
}

/** Uch tildagi variantdan joriysi (ma'lumot jadvallari uchun: { uz, ru, en }) */
export function pick<T>(v: Record<Lang, T>): T {
  return v[current];
}
