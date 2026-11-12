/**
 * SUPER QOBILIYATLAR — v4.0 uchun tayyorgarlik. HOZIRCHA YOPIQ: o'yinda, menyuda va kuch kartalarida
 * ko'rinmaydi, hech qanday tugma yoki zaryad ishlamaydi (SUPERS_ENABLED = false).
 *
 * Umumiy tizim (v4.0 da hamma qahramonga): har qahramonning bitta superi bor. Super zaryadi
 * (SuperMeter) o'yinchi bergan zarardan to'ladi; to'lganda alohida tugma bilan ishlatiladi va
 * zaryad nolga tushadi. Bu faylda — faqat ma'lumot (SuperDef) va zaryad hisoblagichi; superning
 * o'zi (animatsiya, zarba) v4.0 da Game ichida `useSuper()` orqali ulanadi.
 *
 * Yangi super qo'shish: SUPERS ga yozuv. Yoqish: SUPERS_ENABLED = true (v4.0).
 */
import type { Hero } from "./hero";

/** v4.0 gacha yopiq: true bo'lmaguncha superFor() null qaytaradi, SuperMeter to'lmaydi */
export const SUPERS_ENABLED: boolean = false;

export interface SuperDef {
  id: string;
  hero: Hero;
  /** Ekrandagi nom (katta harf) va qisqa tavsif */
  name: string;
  desc: string;
  color: string;
  /** Zaryad: o'yinchi shuncha zarar berganda to'ladi */
  charge: number;
  /** Super davomiyligi (soniya) */
  time: number;
  /** Qahramonga xos sonlar (Game v4.0 da o'qiydi) */
  params: Readonly<Record<string, number>>;
}

/**
 * MING KESIM (Samuray qiz): ekrandagi hamma dushman belgilanadi, Samuray ko'rinmay ketadi va
 * `cuts` ta kesik ularga ketma-ket tushadi (har biri `mul` × zarar), oxirida katana qinga qaytadi.
 * Shu vaqt davomida daxlsiz. Bossga har kesik `bossMul` × zarar (boss tez o'lib qolmasin).
 */
const THOUSAND_CUTS: SuperDef = {
  id: "thousand-cuts",
  hero: "samurai",
  name: "MING KESIM",
  desc: "Ekrandagi hamma dushmanga chaqmoqdek kesiklar yog'iladi",
  color: "#ff8fb8",
  charge: 60,
  time: 1.6,
  params: { cuts: 12, gap: 0.1, mul: 1, bossMul: 0.5 },
};

/** Hamma superlar (yopiq bo'lsa ham — sinov va v4.0 ishlanmasi uchun) */
export const SUPERS: Partial<Record<Hero, SuperDef>> = {
  samurai: THOUSAND_CUTS,
};

/** Qahramonning superi; superlar yopiq bo'lsa (v4.0 gacha) — null: hech qayerda ko'rinmaydi. */
export function superFor(hero: Hero): SuperDef | null {
  return SUPERS_ENABLED ? (SUPERS[hero] ?? null) : null;
}

/** Super zaryadi hisoblagichi. Superlar yopiq yoki qahramonda super yo'q — hech qachon to'lmaydi. */
export class SuperMeter {
  /** Yig'ilgan zaryad (0..def.charge) */
  value = 0;
  readonly def: SuperDef | null;

  constructor(hero: Hero) {
    this.def = superFor(hero);
  }

  /** O'yinchi zarar berdi */
  add(dmg: number) {
    if (!this.def || !(dmg > 0)) return;
    this.value = Math.min(this.def.charge, this.value + dmg);
  }

  /** To'lish ulushi 0..1 (HUD uchun) */
  get ratio() {
    return this.def ? this.value / this.def.charge : 0;
  }

  get ready() {
    return !!this.def && this.value >= this.def.charge;
  }

  /** Superni ishlatish: tayyor bo'lsa zaryadni nollaydi va true qaytaradi */
  use() {
    if (!this.ready) return false;
    this.value = 0;
    return true;
  }
}
