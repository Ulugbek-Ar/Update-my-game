import type { EnemyKind } from "./enemy";
import type { Player } from "./player";

/** Har to'lqindagi dushmanlar. Oxirgi to'lqinda Boss ham chiqadi. */
export const WAVES: EnemyKind[][] = [
  ["blob", "blob", "blob"],
  ["blob", "blob", "wisp", "wisp"],
  ["wisp", "wisp", "rammer", "rammer", "blob"],
  ["rammer", "rammer", "rammer", "wisp", "wisp", "blob", "blob"],
  ["blob", "blob"],
];

export const BOSS_WAVE = WAVES.length - 1;

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  color: string;
  apply: (p: Player) => void;
  ok: (p: Player) => boolean;
}

export const UPGRADES: Upgrade[] = [
  {
    id: "heart", name: "TEMIR YURAK", desc: "+1 yurak va to'liq davolanish", color: "#ff4d6d",
    apply: (p) => { p.maxHp++; p.hp = p.maxHp; }, ok: (p) => p.maxHp < 10,
  },
  {
    id: "blade", name: "O'TKIR QILICH", desc: "Qilich zarari +1", color: "#68cde4",
    apply: (p) => p.damage++, ok: (p) => p.damage < 3,
  },
  {
    id: "reach", name: "UZUN TIG'", desc: "Zarba maydoni kattaroq", color: "#c5e4ec",
    apply: (p) => (p.reach += 5), ok: (p) => p.reach < 31,
  },
  {
    id: "haste", name: "CHAQQON QO'L", desc: "Zarbalar orasi 25% qisqa", color: "#ffcc33",
    apply: (p) => (p.attackCd *= 0.75), ok: (p) => p.attackCd > 0.2,
  },
  {
    id: "wind", name: "SHAMOL QADAMI", desc: "Tezlik +15%, dash tezroq qaytadi", color: "#a6f08e",
    apply: (p) => { p.speed *= 1.15; p.dashCd *= 0.75; }, ok: (p) => p.speed < 130,
  },
  {
    id: "vamp", name: "QON TOMIRI", desc: "Har bir necha o'ldirishda +1 yurak", color: "#b23238",
    apply: (p) => (p.lifesteal = p.lifesteal ? Math.max(3, p.lifesteal - 2) : 6), ok: (p) => p.lifesteal !== 3,
  },
  {
    id: "mend", name: "SHIFO", desc: "Barcha yuraklarni tiklash", color: "#f2fbe4",
    apply: (p) => (p.hp = p.maxHp), ok: (p) => p.hp < p.maxHp,
  },
];

/** n ta turli, hozir foydali bo'lgan kuchaytirishni tanlaydi. */
export function pickUpgrades(p: Player, n = 3, rand = Math.random): Upgrade[] {
  const pool = UPGRADES.filter((u) => u.ok(p));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, n);
}
