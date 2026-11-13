/**
 * Eski klientlar bilan moslik. Har yangi o'ynaladigan qahramon "qahramonlar versiyasi"ni bittaga
 * oshiradi (1 — Samuray, v3.8). Yangi klient o'z versiyasini yuboradi: olam salomlashuvida `hv`
 * maydoni, akkaunt so'rovida `?hv=` parametri. Yubormagan klient — eski (v3.7 va undan oldingi).
 *
 * Eski klient o'zi bilmagan qahramon spraytini chiza olmaydi (palitra topilmay, chizish sikli
 * yiqiladi). Shuning uchun server unga yangi qahramonni Ritsar qilib ko'rsatadi: olamda boshqa
 * o'yinchi, reyting, do'stlar, profil kartasi va gildiya ro'yxatida. Bulutli saqlanish (save,
 * data) hech qachon o'zgartirilmaydi — sotib olingan qahramon yo'qolmaydi.
 */
import type { Hero } from "./hero";

/** Joriy klientning qahramonlar versiyasi */
export const HERO_VERSION = 1;
/** Akkaunt so'rovlaridagi URL parametri */
export const HERO_MARK = "hv";

/** Qahramon qaysi versiyadan beri bor (0 — eski klientlar ham biladi) */
export const HERO_SINCE: Readonly<Record<Hero, number>> = {
  knight: 0,
  mage: 0,
  hunter: 0,
  gunner: 0,
  paladin: 0,
  samurai: 1,
};

const isHero = (s: unknown): s is Hero =>
  typeof s === "string" && Object.prototype.hasOwnProperty.call(HERO_SINCE, s);

/** Klient (qahramonlar versiyasi v) chiza oladigan qahramon: bilmasa — Ritsar. */
export function heroFor(h: Hero, v: number): Hero {
  return HERO_SINCE[h] <= v ? h : "knight";
}

/** Noma'lum yoki yaroqsiz qiymat — 0 (eski klient) */
export function heroVersion(raw: unknown): number {
  const n = typeof raw === "string" ? Number(raw) : raw;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n < 1000 ? n : 0;
}

/** Saqlash ma'lumoti bo'lgan kalitlar — ichiga kirilmaydi */
const KEEP = new Set(["save", "data"]);

function walk(x: unknown, v: number): unknown {
  if (Array.isArray(x)) return x.map((y) => walk(y, v));
  if (!x || typeof x !== "object") return x;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(x)) {
    if (KEEP.has(k)) out[k] = val;
    else if ((k === "avatar" || k === "hero") && isHero(val)) out[k] = heroFor(val, v);
    else if (k === "heroes" && Array.isArray(val))
      out[k] = val.filter((h) => !isHero(h) || HERO_SINCE[h] <= v);
    else out[k] = walk(val, v);
  }
  return out;
}

/**
 * Akkaunt javobi eski klient uchun: ko'rinish maydonlaridagi (avatar, hero) yangi qahramon Ritsar
 * bo'ladi, qahramonlar ro'yxatidan (heroes) olib tashlanadi. Yangi klientga — o'zgarishsiz.
 */
export function legacyHeroes<T>(reply: T, v: number): T {
  return v >= HERO_VERSION ? reply : (walk(reply, v) as T);
}
