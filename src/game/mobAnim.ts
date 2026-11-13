/**
 * DUSHMAN VA BOSSLAR VIZUAL QATLAMI (v3.8). Faqat ko'rinish: to'qnashuv o'lchami, tezlik, hujum
 * vaqtlari va paydo bo'lish vaqti o'zgarmaydi — bu yerdagi hamma narsa chizish paytida hisoblanadi.
 *  - squash & stretch: zarba yeganda yapaloqlanadi, hujumda siqilib-cho'ziladi, slime sakraganda
 *    cho'ziladi, turganda sekin nafas oladi;
 *  - paydo bo'lish: yerdagi moblar yerdan ko'tarilib chiqadi, uchadiganlari tutundan paydo bo'ladi;
 *  - boss: kirish sahnasida o'z zarbasini ko'rsatadi, faza almashganda qisqa "o'zgarish" pulsi.
 * "Effektlarni kamaytirish" yoqilganda bularning hech biri chizilmaydi (avvalgi ko'rinish).
 */
import type { AnimState } from "./animation";
import type { EnemyKind } from "./enemy";

/** Uchadigan va arvoh moblar: tutundan paydo bo'ladi; masshtab markazga nisbatan */
export const FLYING_KINDS: ReadonlySet<EnemyKind> = new Set([
  "wisp",
  "frost",
  "imp",
  "owl",
  "tengu",
]);

/** Zarba yeganda yapaloqlanish davomiyligi (s) */
export const MOB_HURT_SQUASH = 0.12;

interface Squashy {
  kind: EnemyKind;
  t: number;
  dead: boolean;
  spawn: number;
  stun: number;
  anim: { state: AnimState; frame: number; t: number };
}

/** Spraytning eni va bo'yi ko'paytuvchisi ([1, 1] — o'zgarishsiz). */
export function mobScale(e: Squashy): readonly [number, number] {
  if (e.dead || e.spawn > 0) return [1, 1];
  const a = e.anim;
  if (a.state === "hurt") {
    // zarba: yapaloqlanib, tezda tiklanadi
    const k = Math.min(1, a.t / MOB_HURT_SQUASH);
    return [1.18 - 0.18 * k, 0.82 + 0.18 * k];
  }
  if (e.kind === "blob" || e.kind === "iceblob") {
    // sakrash: ko'tarilganda cho'ziladi, qo'nganda yapaloqlanadi
    const hop = Math.sin(e.t * (e.kind === "iceblob" ? 6 : 5));
    return hop > 0 ? [1 - 0.1 * hop, 1 + 0.14 * hop] : [1 - 0.08 * hop, 1 + 0.09 * hop];
  }
  if (a.state === "attack")
    // tayyorgarlik — siqiladi, zarba — cho'ziladi, so'ng yapaloqlanadi
    return a.frame === 0 ? [1.06, 0.94] : a.frame === 1 ? [0.95, 1.07] : [1.07, 0.93];
  if (e.stun > 0) return [1, 1];
  // nafas: sekin, bir piksel atrofida
  const b = Math.sin(e.t * 3.2);
  return [1 - 0.02 * b, 1 + 0.035 * b];
}

/** Yerdan chiqish: ko'ringan ulush (0..1) — boshida tez, oxirida sekin. k — paydo bo'lish ulushi. */
export function riseShare(k: number) {
  const c = Math.min(1, Math.max(0, k));
  return 1 - (1 - c) ** 2;
}

/** Tutun (uchadigan moblar paydo bo'lganda): uchta kengayib so'nuvchi bulutcha. */
export function renderSpawnSmoke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  k: number,
  color: string,
) {
  const a = Math.max(0, 0.5 * (1 - k));
  if (a <= 0.02) return;
  ctx.fillStyle = color;
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = a;
  for (const [dx, dy, r] of [
    [-6, 2, 5],
    [5, 3, 6],
    [0, -5, 5],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + dx * (0.6 + k), y + dy * (0.6 + k), r * (0.6 + 0.7 * k), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = alpha;
}

/**
 * Boss kirish sahnasi: paydo bo'lishning ikkinchi yarmida boss o'z zarbasini ko'rsatadi (hujum
 * kadrlari 0 -> 1 -> 2). Oddiy (qisqa) paydo bo'lishda yoki sahna tugagach — null.
 */
export function introFrame(spawn: number, spawnMax: number): number | null {
  if (spawn <= 0 || spawnMax <= 2) return null;
  const k = 1 - spawn / spawnMax;
  return k < 0.5 ? null : Math.min(2, Math.floor(((k - 0.5) / 0.42) * 3));
}

/**
 * Faza almashgandagi "o'zgarish": daxlsizlik (guard) davomida uch marta so'nuvchi kattalashish.
 * guard — qolgan vaqt, total — to'liq daxlsizlik vaqti. [1, 1] — puls yo'q.
 */
export function phasePulse(guard: number, total: number): readonly [number, number] {
  if (guard <= 0 || total <= 0) return [1, 1];
  const k = Math.min(1, guard / total);
  const s = 0.12 * Math.abs(Math.sin(k * Math.PI * 3)) * k;
  return [1 + s, 1 + s];
}
