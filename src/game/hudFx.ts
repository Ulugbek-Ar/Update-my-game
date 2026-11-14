/**
 * HUD ANIMATSIYALARI (v3.8) — faqat ko'rinish: yuraklar zarba yeganda titraydi, yo'qolgan yurak
 * parchalanadi, oltin hisobi "aylanib" sanaladi, terilgan tanga/yurak yetib kelganda hisob bir
 * lahza sakraydi. O'yin raqamlari (jon, oltin) bu yerdan O'QILADI, lekin hech qachon o'zgartirilmaydi.
 * Tasodifsiz; "Effektlarni kamaytirish"da harakatlar o'chadi (qiymatlar darhol ko'rsatiladi).
 */
import type { FlyKind } from "./combatFx";

/** Yuraklar titrashi va parchalanish davomiyligi (s) */
export const HEART_SHAKE = 0.3;
export const HEART_BREAK = 0.45;
/** Oltin hisobi shu tezlikda (birlik/s, kamida) haqiqiy qiymatga yetib boradi */
export const GOLD_ROLL_MIN = 20;
/** Hisob "sakrashi" davomiyligi */
export const POP_TIME = 0.2;

/** Banner sirpanib kirish vaqti (s); kartalar: har biri shuncha kechikib, shuncha vaqtda aylanib chiqadi */
export const BANNER_SLIDE = 0.22;
export const CARD_STAGGER = 0.12;
export const CARD_FLIP = 0.18;
/** Tanlangan karta porlab yuqoriga uchadigan vaqt (s) va masofa (px) */
export const PICK_TIME = 0.42;
export const PICK_RISE = 44;
/** Karta ramkasi bo'ylab yuguradigan yorug'lik: tezligi (px/s) va uzunligi (px) */
export const SHIMMER_SPEED = 110;
export const SHIMMER_LEN = 16;

/** Tanlangan kartaning "sharpasi": joyi, rangi va nomi */
export interface PickedCard {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  name: string;
  t: number;
}

/** Karta darajasi (faqat bezak): rare — qahramonga xos karta, legend — sinergiyani ochadigan */
export type CardGlow = "none" | "rare" | "legend";

/** Kartaning ko'rinish darajasi: sinergiyani yakunlasa — legend, faqat shu qahramonniki — rare. */
export function cardGlow(heroOnly: boolean, completesSynergy: boolean): CardGlow {
  return completesSynergy ? "legend" : heroOnly ? "rare" : "none";
}

/**
 * Karta i ning eni (0..1): kartalar birma-bir aylanib chiqadi. age — tanlov ekrani ochilgandan
 * beri o'tgan vaqt. 1 — to'liq ochilgan.
 */
export function cardFlip(i: number, age: number) {
  const k = (age - i * CARD_STAGGER) / CARD_FLIP;
  return k <= 0 ? 0 : k >= 1 ? 1 : Math.sin((k * Math.PI) / 2);
}

/** Oxirgi karta to'liq ochiladigan vaqt (n ta karta uchun) */
export function cardsShownAt(n: number) {
  return Math.max(0, n - 1) * CARD_STAGGER + CARD_FLIP;
}

/**
 * Ramka bo'ylab yuguruvchi yorug'lik: perimetrdagi (soat mili bo'ylab, yuqori chap burchakdan)
 * s masofadagi nuqta.
 */
export function framePoint(w: number, h: number, s: number): readonly [number, number] {
  const L = 2 * (w + h);
  let d = ((s % L) + L) % L;
  if (d < w) return [d, 0];
  d -= w;
  if (d < h) return [w - 1, d];
  d -= h;
  if (d < w) return [w - 1 - d, h - 1];
  d -= w;
  return [0, h - 1 - d];
}

/** Yo'qolgan yurak: index — HUD'dagi katagi, t — parchalanishdan beri o'tgan vaqt */
export interface BrokenHeart {
  index: number;
  t: number;
}

export class HudFx {
  /** Yuraklar titrashi: qolgan vaqt */
  shake = 0;
  broken: BrokenHeart[] = [];
  /** Ko'rsatilayotgan oltin (haqiqiy qiymatga tomon sanaladi) */
  gold = 0;
  goldPop = 0;
  heartPop = 0;
  /** Banner paydo bo'lgandan beri o'tgan vaqt (sirpanib kirish uchun) */
  bannerAge = 9;
  /** Tanlangan karta sharpasi (porlab yuqoriga uchadi) */
  picked: PickedCard | null = null;
  private hp = -1;
  private bannerTimer = 0;
  private bannerTitle = "";
  private goldTarget = 0;
  private goldRate = GOLD_ROLL_MIN;

  reset(hp: number, gold: number) {
    this.shake = 0;
    this.broken = [];
    this.gold = this.goldTarget = gold;
    this.goldPop = this.heartPop = 0;
    this.hp = hp;
    this.bannerAge = 9;
    this.bannerTimer = 0;
    this.bannerTitle = "";
    this.picked = null;
  }

  /** Karta tanlandi: uning sharpasi porlab yuqoriga uchadi. */
  pick(card: Omit<PickedCard, "t">) {
    this.picked = { ...card, t: 0 };
  }

  /** Uchib kelgan tanga yoki yurak HUD'ga yetdi */
  arrive(kind: FlyKind) {
    if (kind === "coin") this.goldPop = POP_TIME;
    else this.heartPop = POP_TIME;
  }

  /** Har kadr: joriy jon, oltin, banner taymeri va sarlavhasi (faqat o'qiladi). */
  update(dt: number, hp: number, gold: number, banner = 0, title = "") {
    if (this.hp < 0) this.reset(hp, gold);
    // yangi banner: taymeri oshdi yoki sarlavhasi almashdi — yoshi noldan
    const fresh = banner > 0 && (banner > this.bannerTimer + 1e-6 || title !== this.bannerTitle);
    this.bannerAge = fresh ? 0 : this.bannerAge + dt;
    this.bannerTimer = banner;
    this.bannerTitle = title;
    if (this.picked && (this.picked.t += dt) >= PICK_TIME) this.picked = null;
    if (hp < this.hp) {
      // zarba: yuraklar titraydi, yo'qolganlari parchalanadi
      this.shake = HEART_SHAKE;
      for (let i = Math.max(0, hp); i < this.hp; i++) this.broken.push({ index: i, t: 0 });
    }
    this.hp = hp;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    for (const b of this.broken) b.t += dt;
    this.broken = this.broken.filter((b) => b.t < HEART_BREAK);
    if (this.goldPop > 0) this.goldPop = Math.max(0, this.goldPop - dt);
    if (this.heartPop > 0) this.heartPop = Math.max(0, this.heartPop - dt);
    // oltin hisobi: maqsad o'zgarganda tezlik belgilanadi — 0.35 s ichida yetib boradi
    if (gold !== this.goldTarget) {
      this.goldTarget = gold;
      this.goldRate = Math.max(GOLD_ROLL_MIN, Math.abs(gold - this.gold) / 0.35);
    }
    if (this.gold !== gold)
      this.gold = this.gold < gold ? Math.min(gold, this.gold + this.goldRate * dt) : gold;
  }

  /** Yuraklar qatorining siljishi (px): titrash so'nib boradi */
  heartOffset(i: number, time: number): readonly [number, number] {
    if (this.shake <= 0) return [0, 0];
    const k = this.shake / HEART_SHAKE;
    return [
      Math.round(Math.sin(time * 70 + i * 2.1) * 1.5 * k),
      Math.round(Math.cos(time * 55 + i) * k),
    ];
  }

  /** Banner sirpanishi: 0 (chetda) .. 1 (joyida), boshida tez, oxirida sekin */
  get bannerIn() {
    const k = Math.min(1, this.bannerAge / BANNER_SLIDE);
    return 1 - (1 - k) ** 2;
  }

  /** "Sakrash": 0..1 (cho'qqisi o'rtada) */
  static pop(t: number) {
    return t <= 0 ? 0 : Math.sin((1 - t / POP_TIME) * Math.PI);
  }
}
