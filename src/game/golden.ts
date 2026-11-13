/**
 * O'YIN RAQAMLARI NUSXASI (sinov uchun): har qahramon, mob va bossning barcha son va mantiqiy
 * maydonlari hamda animatsiya jadvallari (kadr soni, kadr vaqti). v3.8 animatsiyalari faqat ko'rinish
 * — bu nusxa golden-numbers.json bilan solishtiriladi (animations.test.ts): hujum vaqti, tezlik, dash,
 * daxlsizlik, cooldown, to'qnashuv o'lchami yoki kadr vaqtlari o'zgarsa — sinov qizaradi.
 */
import { Boss, ForestKing, Queen } from "./boss";
import { ENEMY_HP, Enemy, type EnemyKind } from "./enemy";
import { HEROES } from "./hero";
import { Oni } from "./oni";
import { Player } from "./player";

type Flat = Record<string, number | boolean>;

/** Tasodifiy boshlanadigan maydonlar (har safar boshqacha) — solishtirilmaydi */
const RANDOM = ["t", "orbit", "aiTimer", "x", "y"];

function nums(o: object, skip: readonly string[] = []): Flat {
  const r: Flat = {};
  for (const [k, v] of Object.entries(o))
    if ((typeof v === "number" || typeof v === "boolean") && !skip.includes(k)) r[k] = v;
  return r;
}

function anims(a: { defs: Record<string, { frames: number; frameTime: number; loop: boolean }> }) {
  return Object.fromEntries(
    Object.entries(a.defs).map(([k, d]) => [
      k,
      [d.frames, Math.round(d.frameTime * 1e6) / 1e6, d.loop],
    ]),
  );
}

export function goldenNumbers() {
  const out: Record<string, unknown> = {};
  for (const h of HEROES) {
    const p = new Player(h);
    out[`hero:${h}`] = { ...nums(p), reach: p.reach, hitDamage: p.hitDamage, anim: anims(p.anim) };
  }
  for (const k of Object.keys(ENEMY_HP) as EnemyKind[]) {
    const e = new Enemy(k, 100, 100);
    out[`mob:${k}`] = { ...nums(e, RANDOM), anim: anims(e.anim) };
  }
  const bosses = { devil: new Boss(), queen: new Queen(), king: new ForestKing(), oni: new Oni() };
  for (const [n, b] of Object.entries(bosses))
    out[`boss:${n}`] = { ...nums(b, ["x", "y"]), anim: anims(b.anim) };
  return out;
}
