/**
 * Kunlik sovg'a: 7 kunlik ketma-ketlik, kun qurilmaning mahalliy sanasi bo'yicha.
 * Bir kun o'tkazib yuborilsa — yana 1-kundan; 7-kundan keyin ham 1-kundan boshlanadi.
 */
import { todayKey } from "./daily";
import { addGold } from "./shop";
import { unlockAchievement, type Achievement } from "./achievements";

export const GIFT_KEY = "pixel-rpg-gift";
/** Har kun mukofoti (oltin); haftasiga 120 — Mergan narxi (300) ga nisbatan muvozanatli */
export const GIFT_REWARDS: readonly number[] = [5, 8, 10, 12, 15, 20, 50];

interface GiftSave {
  /** Oxirgi sovg'a olingan sana (YYYY-MM-DD) */
  date: string;
  /** O'sha kuni olingan kun (1..7) */
  day: number;
}

export interface GiftStatus {
  /** Bugungi sovg'a olinganmi */
  claimed: boolean;
  /** Bugungi kun ketma-ketlikda (1..7) */
  day: number;
  reward: number;
}

function load(): GiftSave | null {
  try {
    const s = JSON.parse(localStorage.getItem(GIFT_KEY) ?? "null") as GiftSave | null;
    if (!s || typeof s.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return null;
    const day = Math.floor(Number(s.day));
    return day >= 1 && day <= GIFT_REWARDS.length ? { date: s.date, day } : null;
  } catch {
    return null;
  }
}

/** Mahalliy sanadan oldingi kun (yil va oy chegarasi, yozgi vaqt hisobga olinadi). */
export function prevDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return todayKey(new Date(y!, m! - 1, d! - 1));
}

export function giftStatus(today = todayKey()): GiftStatus {
  const s = load();
  let claimed = false;
  let day = 1;
  // soat orqaga surilgan bo'lsa ham bugun ikkinchi marta berilmaydi
  if (s && s.date >= today) {
    claimed = true;
    day = s.day;
  } else if (s && s.date === prevDay(today)) day = (s.day % GIFT_REWARDS.length) + 1;
  return { claimed, day, reward: GIFT_REWARDS[day - 1]! };
}

export interface GiftClaim {
  day: number;
  gold: number;
  /** 7-kun: "Sodiq o'yinchi" yutug'i (birinchi marta) */
  achievement: Achievement | null;
}

/** Bugungi sovg'ani oladi (kuniga bir marta); allaqachon olingan bo'lsa null. */
export function claimGift(today = todayKey()): GiftClaim | null {
  const st = giftStatus(today);
  if (st.claimed) return null;
  try {
    localStorage.setItem(GIFT_KEY, JSON.stringify({ date: today, day: st.day }));
  } catch {
    return null;
  }
  addGold(st.reward);
  const achievement = st.day === GIFT_REWARDS.length ? unlockAchievement("loyal") : null;
  return { day: st.day, gold: st.reward, achievement };
}
