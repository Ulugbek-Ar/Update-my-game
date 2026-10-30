import { beforeEach, describe, expect, it } from "vitest";
import { GIFT_KEY, GIFT_REWARDS, claimGift, giftStatus, prevDay } from "./gift";
import { loadGold } from "./shop";
import { ACHIEVEMENTS, loadAchievements } from "./achievements";
import { todayKey } from "./daily";
import { GUNNER_PRICE } from "./hero";

/** 2026-10-01 dan n kun keyingi mahalliy sana */
const day = (n: number) => todayKey(new Date(2026, 9, 1 + n));

beforeEach(() => localStorage.clear());

describe("Kunlik sovg'a", () => {
  it("rewards 5, 8, 10, 12, 15, 20, 50 — about 120 gold a week", () => {
    expect(GIFT_REWARDS).toEqual([5, 8, 10, 12, 15, 20, 50]);
    const week = GIFT_REWARDS.reduce((a, b) => a + b, 0);
    expect(week).toBe(120);
    // Mergan bir haftalik sovg'adan qimmat — sovg'a do'kon muvozanatini buzmaydi
    expect(GUNNER_PRICE).toBeGreaterThan(2 * week);
  });

  it("consecutive days climb 1 -> 7, then start again from day 1", () => {
    const got: number[] = [];
    for (let n = 0; n < 9; n++) {
      expect(giftStatus(day(n))).toMatchObject({ claimed: false });
      got.push(claimGift(day(n))!.day);
    }
    expect(got).toEqual([1, 2, 3, 4, 5, 6, 7, 1, 2]);
    expect(loadGold()).toBe(120 + 5 + 8);
  });

  it("a missed day resets the streak to day 1", () => {
    claimGift(day(0));
    claimGift(day(1));
    claimGift(day(2));
    expect(giftStatus(day(3)).day).toBe(4);
    // 4-kun o'tkazib yuborildi
    expect(giftStatus(day(4))).toEqual({ claimed: false, day: 1, reward: 5 });
    expect(claimGift(day(4))!.gold).toBe(5);
  });

  it("only once per day", () => {
    expect(claimGift(day(0))).toEqual({ day: 1, gold: 5, achievement: null });
    expect(claimGift(day(0))).toBeNull();
    expect(giftStatus(day(0))).toEqual({ claimed: true, day: 1, reward: 5 });
    expect(loadGold()).toBe(5);
    // soat orqaga surilsa ham qayta berilmaydi
    expect(claimGift(prevDay(day(0)))).toBeNull();
    expect(loadGold()).toBe(5);
  });

  it("day 7 unlocks SODIQ O'YINCHI (once)", () => {
    expect(ACHIEVEMENTS.find((a) => a.id === "loyal")?.name).toBe("SODIQ O'YINCHI");
    for (let n = 0; n < 6; n++) expect(claimGift(day(n))!.achievement).toBeNull();
    expect(loadAchievements().has("loyal")).toBe(false);
    const c = claimGift(day(6))!;
    expect(c).toMatchObject({ day: 7, gold: 50 });
    expect(c.achievement?.id).toBe("loyal");
    expect(loadAchievements().has("loyal")).toBe(true);
    for (let n = 7; n < 13; n++) claimGift(day(n));
    expect(claimGift(day(13))!.achievement).toBeNull();
  });

  it("uses local dates across month and year boundaries", () => {
    expect(prevDay("2026-11-01")).toBe("2026-10-31");
    expect(prevDay("2027-01-01")).toBe("2026-12-31");
    expect(prevDay("2028-03-01")).toBe("2028-02-29");
    claimGift("2026-12-31");
    expect(giftStatus("2027-01-01").day).toBe(2);
  });

  it("broken saved state starts from day 1", () => {
    localStorage.setItem(GIFT_KEY, "{oops");
    expect(giftStatus(day(0))).toEqual({ claimed: false, day: 1, reward: 5 });
    localStorage.setItem(GIFT_KEY, JSON.stringify({ date: day(0), day: 99 }));
    expect(giftStatus(day(1)).day).toBe(1);
  });
});
