/**
 * Boss jonini o'yinchi kuchiga moslash, fazalar va g'azab taymeri.
 *
 * HISOB (ideal urib turish — bitta nishonga, to'xtovsiz, har zarba tegadi):
 *
 *   Ritsar, Sehrgar, Ovchi:
 *     oddiy = zarar × sharlar_soni / zarba_orasi
 *     kuchli zarba (aylana / halqa / kuchli o'q) har (spinCd + CHARGE_TIME) da bir marta:
 *       Ritsar va Sehrgar: 2 × zarar,  Ovchi: 2 × zarar × o'qlar_soni
 *     sikl = (oddiy × spinCd + kuchli) / (spinCd + CHARGE_TIME)
 *     DPS = max(oddiy, sikl)  (+1 Ovchining zaharli uchi: har soniya 1 zarar)
 *
 *   Mergan:
 *     baraban = zarar × o'qlar / (o'qlar × zarba_orasi + qayta_o'qlash)
 *
 * Kartalar (O'TKIR QILICH, CHAQQON QO'L, UCH SHAR ...) va do'kon (CHARXLANGAN TIG') Player
 * ko'rsatkichlarini o'zgartiradi — formula ularni Player'dan o'qiydi, shuning uchun hammasi hisobda.
 *
 *   BOSS JONI = max(asosiy_jon, ceil(DPS × BOSS_FIGHT_TIME × (1 + 0.1 × cheksiz_sikl)))
 *
 * BOSS_FIGHT_TIME = 60 s: toza urib turganda ham ~60 s kerak (qochish, faza daxlsizligi va gullar
 * bilan amalda 70–110 s). Asosiy jon (30/40/50) — pastki chegara.
 */
import { CHARGE_TIME, type Player } from "./player";

/** Ideal urib turishda boss shuncha soniyada o'ladi */
export const BOSS_FIGHT_TIME = 60;
/** Fazalar chegarasi (maxHp ulushi): 100–60% — 1, 60–30% — 2, 30–0% — 3 */
export const PHASE2_AT = 0.6;
export const PHASE3_AT = 0.3;
/** Faza almashganda boss shuncha soniya zarar olmaydi */
export const PHASE_GUARD = 1.6;
/** G'azab: jang shuncha davom etsa boss tezlashadi va zarari +1 */
export const BERSERK_TIME = 180;
export const BERSERK_SPEED = 1.35;
/** Katta zarbalar (urib-tushirish, hamla, nur) — 2 yurak */
export const BIG_HIT = 2;
/** Boss kirish sahnasi (namoyish) davomiyligi */
export const INTRO_TIME = 2.6;

export type BossPhase = 1 | 2 | 3;

/** Jon ulushiga mos faza. */
export function phaseFor(hp: number, maxHp: number): BossPhase {
  return hp <= maxHp * PHASE3_AT ? 3 : hp <= maxHp * PHASE2_AT ? 2 : 1;
}

/** Keyingi faza chegarasi (jon), 3-fazada 0. */
export function phaseFloor(phase: BossPhase, maxHp: number) {
  return phase === 1 ? maxHp * PHASE2_AT : phase === 2 ? maxHp * PHASE3_AT : 0;
}

/** O'yinchining ideal (bitta nishonga) zarar/soniya ko'rsatkichi — hisob fayl boshida. */
export function heroDps(p: Player) {
  if (p.gunner) {
    const shots = Math.max(1, p.ammoMax);
    return (p.damage * shots) / (shots * p.attackCd + p.reloadTime);
  }
  const multi = Math.max(1, p.multishot);
  const basic = (p.damage * multi) / p.attackCd;
  const strong = p.hunter ? 2 * p.damage * multi : 2 * p.damage;
  const cycle = (basic * p.spinCd + strong) / (p.spinCd + CHARGE_TIME);
  return Math.max(basic, cycle) + (p.hunter && p.poisonTip ? 1 : 0);
}

/** Boss joni: asosiy jondan kam emas, o'yinchi kuchiga moslashgan (fayl boshidagi formula). */
export function bossHpFor(p: Player, base: number, cycle = 0) {
  const adaptive = Math.ceil(heroDps(p) * BOSS_FIGHT_TIME * (1 + 0.1 * cycle));
  return Math.max(base, adaptive);
}
