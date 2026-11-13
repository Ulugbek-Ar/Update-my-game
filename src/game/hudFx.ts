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
  private hp = -1;

  reset(hp: number, gold: number) {
    this.shake = 0;
    this.broken = [];
    this.gold = gold;
    this.goldPop = this.heartPop = 0;
    this.hp = hp;
  }

  /** Uchib kelgan tanga yoki yurak HUD'ga yetdi */
  arrive(kind: FlyKind) {
    if (kind === "coin") this.goldPop = POP_TIME;
    else this.heartPop = POP_TIME;
  }

  /** Har kadr: joriy jon va oltin (faqat o'qiladi). */
  update(dt: number, hp: number, gold: number) {
    if (this.hp < 0) this.reset(hp, gold);
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
    // oltin hisobi: farq katta bo'lsa tezroq sanaydi (0.4 s ichida yetadi)
    if (this.gold !== gold) {
      const step = Math.max(GOLD_ROLL_MIN, Math.abs(gold - this.gold) / 0.4) * dt;
      this.gold = this.gold < gold ? Math.min(gold, this.gold + step) : gold;
    }
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

  /** "Sakrash": 0..1 (cho'qqisi o'rtada) */
  static pop(t: number) {
    return t <= 0 ? 0 : Math.sin((1 - t / POP_TIME) * Math.PI);
  }
}
