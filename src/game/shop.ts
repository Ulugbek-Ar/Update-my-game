/** Oltin va DO'KON: o'yinlar orasida saqlanadigan doimiy kuchaytirishlar (localStorage). */
import type { EnemyKind } from "./enemy";
import type { Player } from "./player";

export const GOLD_KEY = "pixel-rpg-gold";
export const SHOP_KEY = "pixel-rpg-shop";

/** Har bir dushmandan tushadigan oltin */
export const KILL_GOLD: Record<EnemyKind, number> = {
  blob: 1,
  wisp: 1,
  rammer: 2,
  archer: 2,
  shield: 3,
  frost: 2,
  golem: 3,
  iceblob: 1,
  wolf: 2,
};
export const BOSS_GOLD = 25;

export type ShopId = "heart" | "dash" | "blade" | "luck";

export interface ShopItem {
  id: ShopId;
  name: string;
  /** Bitta bosqich nima beradi */
  desc: string;
  color: string;
  /** Ikonka (sprites.ts dagi UPGRADE_ICONS kaliti) */
  icon: string;
  /** Har bosqich narxi; uzunligi — bosqichlar soni */
  costs: readonly number[];
}

export const SHOP_ITEMS: readonly ShopItem[] = [
  {
    id: "heart",
    name: "QO'SHIMCHA YURAK",
    desc: "Boshlang'ich yurak +1",
    color: "#ff4d6d",
    icon: "heart",
    costs: [30, 60, 100],
  },
  {
    id: "dash",
    name: "YENGIL ETIK",
    desc: "Dash/teleport qaytishi 10% tez",
    color: "#a6f08e",
    icon: "wind",
    costs: [25, 50, 90],
  },
  {
    id: "blade",
    name: "CHARXLANGAN TIG'",
    desc: "Boshlang'ich zarar +1",
    color: "#68cde4",
    icon: "blade",
    costs: [80],
  },
  {
    id: "luck",
    name: "OMAD TUMORI",
    desc: "Yurak tushish ehtimoli +5%",
    color: "#ffcc33",
    icon: "luck",
    costs: [20, 40, 70],
  },
];

export type ShopLevels = Record<ShopId, number>;

export function emptyLevels(): ShopLevels {
  return { heart: 0, dash: 0, blade: 0, luck: 0 };
}

export function loadGold() {
  try {
    return Math.max(0, Math.floor(Number(localStorage.getItem(GOLD_KEY)) || 0));
  } catch {
    return 0;
  }
}

function saveGold(v: number) {
  try {
    localStorage.setItem(GOLD_KEY, String(v));
  } catch {
    /* saqlash imkonsiz */
  }
}

/** O'yinda terilgan oltinni umumiy hisobga qo'shadi; yangi jamini qaytaradi. */
export function addGold(n: number) {
  const total = loadGold() + Math.max(0, Math.floor(n));
  saveGold(total);
  return total;
}

export function loadShop(): ShopLevels {
  const levels = emptyLevels();
  try {
    const raw = JSON.parse(localStorage.getItem(SHOP_KEY) ?? "null") as Partial<ShopLevels>;
    if (!raw || typeof raw !== "object") return levels;
    for (const item of SHOP_ITEMS) {
      const n = Math.floor(Number(raw[item.id]) || 0);
      levels[item.id] = Math.max(0, Math.min(item.costs.length, n));
    }
  } catch {
    /* buzuq ma'lumot — boshlang'ich holat */
  }
  return levels;
}

/** Keyingi bosqich narxi; to'liq bo'lsa null. */
export function nextCost(item: ShopItem, levels: ShopLevels) {
  return item.costs[levels[item.id]] ?? null;
}

/** Sotib olish: oltin yetsa bosqich oshadi va true qaytadi. */
export function buy(id: ShopId) {
  const item = SHOP_ITEMS.find((i) => i.id === id);
  if (!item) return false;
  const levels = loadShop();
  const cost = nextCost(item, levels);
  const gold = loadGold();
  if (cost === null || gold < cost) return false;
  levels[id]++;
  saveGold(gold - cost);
  try {
    localStorage.setItem(SHOP_KEY, JSON.stringify(levels));
  } catch {
    return false;
  }
  return true;
}

/** Yangi o'yin boshida do'kon kuchaytirishlarini o'yinchiga qo'llaydi. */
export function applyShop(p: Player, levels: ShopLevels) {
  p.maxHp += levels.heart;
  p.hp = p.maxHp;
  p.dashCd *= 0.9 ** levels.dash;
  p.damage += levels.blade;
}

/** Omad tumori: har bosqich yurak tushish ehtimoliga +5%. */
export function dropBonus(levels: ShopLevels) {
  return levels.luck * 0.05;
}
