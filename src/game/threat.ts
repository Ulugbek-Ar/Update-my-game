/**
 * Dushman "xavf" (threat) tizimi: mob va bosslar kim ko'proq xavf tug'dirsa o'shani nishonga oladi.
 * Bir xil kod bir kishilik o'yinda (Game — nishon bitta), Abadiyat olamida (RealmSim) va serverda
 * (server/ RealmSim'ni ishlatadi) ishlaydi. DOM'siz va tasodifsiz — determinizm saqlanadi.
 *
 * - Zarar = xavf; Paladin (TANK) hosil qiladigan xavf 2 baravar (TANK_THREAT).
 * - QASAM — majburiy nishon: shu vaqt davomida mob faqat Paladinni quvadi, so'ng Paladin xavf
 *   ro'yxatining tepasida qoladi (TAUNT_LEAD), shuning uchun boss darhol boshqasiga o'tmaydi.
 * - Nishon almashishi uchun yangi nomzodning xavfi joriy nishonnikidan SWITCH_RATIO marta ko'p
 *   bo'lishi kerak — boss har zarbada u yoqdan bu yoqqa yugurmaydi.
 */
import type { Hero } from "./hero";

/** Paladin hosil qiladigan xavf ko'paytuvchisi */
export const TANK_THREAT = 2;
/** Xavf soniyasiga shuncha ulushga kamayadi (eski zarar asta unutiladi) */
export const THREAT_DECAY = 0.05;
/** Nishonni almashtirish uchun yangi nomzod xavfi joriydan shuncha baravar ko'p bo'lsin */
export const SWITCH_RATIO = 1.2;
/** QASAM tugaganda Paladin eng yuqori xavfdan shuncha oldinda qoladi */
export const TAUNT_LEAD = 1.3;
/** Mob birinchi ko'rganda (aggro) beriladigan boshlang'ich xavf */
export const AGGRO_THREAT = 1;

/** Qahramon hosil qiladigan xavf ko'paytuvchisi (rol bo'yicha: TANK — 2x). */
export function threatMul(hero: Hero) {
  return hero === "paladin" ? TANK_THREAT : 1;
}

/** Nishon nomzodi: tirik, ko'rinadigan va mob ko'radigan masofadagi o'yinchi. */
export interface ThreatCandidate {
  id: string;
}

export class ThreatTable {
  /** o'yinchi id -> xavf */
  readonly values = new Map<string, number>();
  /** QASAM: majburiy nishon va qolgan vaqt */
  forced: string | null = null;
  forcedT = 0;

  get(id: string) {
    return this.values.get(id) ?? 0;
  }

  /** Zarar (yoki boshqa harakat) xavf qo'shadi; Paladinda 2 baravar. */
  add(id: string, amount: number, hero: Hero) {
    if (amount <= 0) return;
    this.values.set(id, this.get(id) + amount * threatMul(hero));
  }

  /** QASAM: t soniya majburiy nishon; Paladin xavfi eng yuqorisidan oldinga chiqadi. */
  taunt(id: string, t: number) {
    this.forced = id;
    this.forcedT = Math.max(this.forcedT, t);
    let top = 0;
    for (const [k, v] of this.values) if (k !== id) top = Math.max(top, v);
    this.values.set(id, Math.max(this.get(id), top * TAUNT_LEAD + AGGRO_THREAT));
  }

  update(dt: number) {
    if (this.forcedT > 0) {
      this.forcedT -= dt;
      if (this.forcedT <= 0) {
        this.forcedT = 0;
        this.forced = null;
      }
    }
    const k = Math.max(0, 1 - THREAT_DECAY * dt);
    for (const [id, v] of this.values) this.values.set(id, v * k);
  }

  /** O'yinchi chiqib ketdi yoki o'ldi — ro'yxatdan o'chadi. */
  drop(id: string) {
    this.values.delete(id);
    if (this.forced === id) {
      this.forced = null;
      this.forcedT = 0;
    }
  }

  clear() {
    this.values.clear();
    this.forced = null;
    this.forcedT = 0;
  }

  /**
   * Nishon tanlash: QASAM bo'lsa — majburiy nishon (nomzodlar orasida bo'lsa), aks holda eng katta
   * xavfli nomzod; joriy nishon faqat SWITCH_RATIO dan ko'p farq bilan almashadi.
   * Nomzod bo'lmasa — null; bitta nomzod bo'lsa — o'sha (bir kishilik o'yin).
   */
  pick<T extends ThreatCandidate>(
    candidates: readonly T[],
    current: string | null = null,
  ): T | null {
    if (!candidates.length) return null;
    if (this.forced) {
      const f = candidates.find((c) => c.id === this.forced);
      if (f) return f;
    }
    let best: T | null = null;
    let bestV = -1;
    for (const c of candidates) {
      const v = this.get(c.id);
      if (v > bestV) {
        best = c;
        bestV = v;
      }
    }
    const cur = current ? candidates.find((c) => c.id === current) : undefined;
    if (cur && best && best !== cur && bestV <= this.get(cur.id) * SWITCH_RATIO) return cur;
    return best;
  }
}
