/**
 * QAHRAMON VIZUAL QATLAMI (v3.8). Faqat ko'rinish: o'yin mantig'i, vaqtlar va raqamlarga ta'sir
 * qilmaydi — Player.update bu holatni yangilaydi, lekin undan hech narsa O'QIMAYDI.
 *  - oraliq kadr (subFrame): idle va walk'da Animator kadrining ikkinchi yarmida oraliq poza
 *    chiziladi (sprites.ts: visualFrames) — kadrlar ikki baravar, davomiylik o'sha;
 *  - burilish: yo'nalish o'zgarganda sprayt bir lahza torayadi ("yon" kadr);
 *  - qadam: yurishda oyoq yerga tekkan kadr (Game chang zarrachasini chiqaradi);
 *  - zarba yeganda qisqa siqilish.
 */
import type { Animator } from "./animation";

/** Burilish kadri davomiyligi (s) va eng tor paytidagi eni (ulush) */
export const TURN_TIME = 0.09;
export const TURN_SQUASH = 0.62;
/** Zarba yeganda siqilish davomiyligi (s) va o'lchami */
export const HURT_SQUASH_TIME = 0.09;
export const HURT_SQUASH = { x: 1.12, y: 0.88 } as const;

export class HeroVisual {
  /** Burilish: qolgan vaqt */
  turnT = 0;
  /** Shu yangilanishda oyoq yerga tegdi (Game o'qib, false qiladi) */
  step = false;
  private facing = 0;
  private frame = -1;

  update(dt: number, fx: number, anim: Animator) {
    if (this.turnT > 0) this.turnT = Math.max(0, this.turnT - dt);
    const f = fx < 0 ? -1 : 1;
    if (this.facing && f !== this.facing) this.turnT = TURN_TIME;
    this.facing = f;
    // oyoq yerga tegadigan kadrlar: yurishning toq kadrlari
    const fr = anim.state === "walk" ? anim.frame : -1;
    if (fr !== this.frame && fr >= 0 && fr % 2 === 1) this.step = true;
    this.frame = fr;
  }

  /** Spraytning eni (1 — odatdagi): burilish o'rtasida eng tor */
  get turnScale() {
    if (this.turnT <= 0) return 1;
    return 1 - (1 - TURN_SQUASH) * Math.sin((this.turnT / TURN_TIME) * Math.PI);
  }
}

/** Oraliq kadr: idle va walk'da kadr vaqtining ikkinchi yarmi — 1, aks holda 0. */
export function subFrame(anim: Animator) {
  if (anim.state !== "idle" && anim.state !== "walk") return 0;
  return anim.t >= anim.defs[anim.state].frameTime / 2 ? 1 : 0;
}

/**
 * Sprayt masshtabi (eni, bo'yi): burilish va zarba siqilishi. [1, 1] — o'zgarishsiz.
 * Oyoq nuqtasiga nisbatan qo'llanadi (sprayt yerdan uzilmaydi).
 */
export function heroScale(vis: HeroVisual, anim: Animator): readonly [number, number] {
  if (anim.state === "hurt" && anim.t < HURT_SQUASH_TIME) return [HURT_SQUASH.x, HURT_SQUASH.y];
  if (anim.state === "idle" || anim.state === "walk") return [vis.turnScale, 1];
  return [1, 1];
}
