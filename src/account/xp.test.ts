import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_LEVEL,
  TITLES,
  XP,
  XP_KEY,
  addXp,
  awardRealm,
  claimLevelRewards,
  levelGold,
  levelOf,
  levelProgress,
  loadXp,
  pendingLevels,
  titleOf,
  xpForLevel,
} from "./xp";
import { checkLevelUp, syncRealmXp } from "./progression";
import { addStats, loadStats, playTime } from "./stats";
import { checkNick, isRude, nickFromTelegram } from "./nick";
import { Game } from "@/game/game";
import { BOSS_WAVE } from "@/game/waves";
import { GOLD_KEY, loadGold } from "@/game/shop";
import { REALM_SAVE_KEY } from "@/game/realmLink";
import { HERO_LIST } from "@/game/hero";

beforeEach(() => localStorage.clear());

describe("player levels", () => {
  it("1..50 levels with a growing step", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(10)).toBe(1620);
    expect(xpForLevel(MAX_LEVEL)).toBe(28_420);
    expect(levelOf(0)).toBe(1);
    expect(levelOf(99)).toBe(1);
    expect(levelOf(100)).toBe(2);
    expect(levelOf(1619)).toBe(9);
    expect(levelOf(1620)).toBe(10);
    expect(levelOf(10_000_000)).toBe(MAX_LEVEL);
    expect(levelProgress(150)).toEqual([50, 120]);
  });

  it("a new title every 10 levels", () => {
    expect(TITLES.map((t) => t.level)).toEqual([1, 10, 20, 30, 40, 50]);
    expect(titleOf(1)).toBe("Yangi kelgan");
    expect(titleOf(9)).toBe("Yangi kelgan");
    expect(titleOf(10)).toBe("Zindon kezuvchisi");
    expect(titleOf(29)).toBe("Qal'a qo'riqchisi");
    expect(titleOf(30)).toBe("Olam sayyohi");
    expect(titleOf(50)).toBe("Afsona");
  });

  it("gold rewards are small and do not break shop prices", () => {
    let total = 0;
    for (let l = 2; l <= MAX_LEVEL; l++) total += levelGold(l);
    // 2..50 darajalar uchun jami ~600 oltin — do'kon (kuchaytirishlar + 2 qahramon ≈ 1 350) ga
    // nisbatan, 300 dan ortiq o'yin davomida yoyilgan
    expect(total).toBeGreaterThan(500);
    expect(total).toBeLessThan(700);
    // birinchi darajalar — Mergan (300) narxining 2% idan kam
    expect(levelGold(2)).toBeLessThanOrEqual(6);
    expect(levelGold(10)).toBe(5 + 2 + 25);
  });

  it("level rewards are given once", () => {
    addXp(250); // 3-daraja
    expect(pendingLevels()).toEqual([2, 3]);
    const up = claimLevelRewards((n) => localStorage.setItem(GOLD_KEY, String(loadGold() + n)));
    expect(up).toEqual({ levels: [2, 3], gold: levelGold(2) + levelGold(3), titles: [] });
    expect(loadGold()).toBe(levelGold(2) + levelGold(3));
    expect(claimLevelRewards(() => {})).toBeNull();
    // 10-daraja: yangi unvon
    addXp(xpForLevel(10) - 250);
    const ten = claimLevelRewards(() => {});
    expect(ten?.titles).toEqual(["Zindon kezuvchisi"]);
  });

  it("an old XP record without the reward mark does not pay twice", () => {
    localStorage.setItem(XP_KEY, JSON.stringify({ xp: 500 }));
    expect(loadXp().lvl).toBe(levelOf(500));
    expect(pendingLevels()).toEqual([]);
  });

  it("realm quests and secrets give XP only once", () => {
    expect(awardRealm(["horn", "wolf"], ["s1"])).toBe(2 * XP.quest + XP.secret);
    expect(awardRealm(["horn", "wolf"], ["s1"])).toBe(0);
    expect(awardRealm(["horn"], ["s1", "s2"])).toBe(XP.secret);
    expect(loadXp().xp).toBe(2 * XP.quest + 2 * XP.secret);
  });

  it("veterans get XP for quests already done in the realm save", () => {
    localStorage.setItem(
      REALM_SAVE_KEY,
      JSON.stringify({
        player: {
          quests: { horn: { status: "done" }, wolf: { status: "active" } },
          secrets: ["a", "b"],
        },
      }),
    );
    expect(syncRealmXp()).toBe(XP.quest + 2 * XP.secret);
    expect(syncRealmXp()).toBe(0);
  });

  it("menu level check adds the gold", () => {
    addXp(100);
    const up = checkLevelUp();
    expect(up?.levels).toEqual([2]);
    expect(loadGold()).toBe(levelGold(2));
  });
});

describe("XP and stats from the game", () => {
  type Internals = {
    startWave(i: number): void;
    damageTarget(t: unknown, dmg: number): void;
  };
  function makeGame() {
    const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
    const g = new Game(canvas as unknown as HTMLCanvasElement);
    return { g, gi: g as unknown as Internals };
  }
  const tick = (g: Game, s: number) => {
    for (let t = 0; t < s; t += 0.02) g.update(0.02);
  };

  it("a cleared wave gives XP", () => {
    const { g, gi } = makeGame();
    gi.startWave(0);
    g.enemies = [];
    tick(g, 0.2);
    expect(loadXp().xp).toBe(XP.wave);
    expect(g.runXp).toBe(XP.wave);
  });

  it("a defeated boss gives XP and counts in the profile on death", () => {
    const { g, gi } = makeGame();
    gi.startWave(BOSS_WAVE);
    g.enemies = [];
    g.boss!.spawn = 0;
    gi.damageTarget(g.boss, 99999);
    expect(loadXp().xp).toBe(XP.devil);
    // o'yinchi halok bo'ldi — o'yin tugadi, statistika profilga
    g.player.hp = 0;
    g.player.anim.set("death", true);
    g.player.anim.done = true;
    tick(g, 0.1);
    const st = loadStats();
    expect(st.bosses).toBe(1);
    expect(st.runs).toBe(1);
  });

  it("stats add up and play time reads nicely", () => {
    addStats({ time: 30.5, kills: 3 });
    addStats({ time: 3600, kills: 2, bosses: 1 });
    expect(loadStats()).toMatchObject({ kills: 5, bosses: 1 });
    expect(playTime(loadStats().time)).toBe("1 soat 0 daqiqa");
    expect(playTime(125)).toBe("2 daqiqa");
  });
});

describe("nickname rules", () => {
  it("3–16 letters, digits and _", () => {
    expect(checkNick("Ali")).toEqual({ ok: true, nick: "Ali" });
    expect(checkNick("  Botir_07 ")).toEqual({ ok: true, nick: "Botir_07" });
    expect(checkNick("Шерзод")).toEqual({ ok: true, nick: "Шерзод" });
    expect(checkNick("ab")).toMatchObject({ error: "length" });
    expect(checkNick("a".repeat(17))).toMatchObject({ error: "length" });
    expect(checkNick("Ali Vali")).toMatchObject({ error: "chars" });
    expect(checkNick("o'g'il")).toMatchObject({ error: "chars" });
    expect(checkNick("___")).toMatchObject({ error: "letter" });
    expect(checkNick("1234")).toMatchObject({ error: "letter" });
    // lotin va kirill aralash (aldov)
    expect(checkNick("Ulugbеk")).toMatchObject({ error: "script" });
  });

  it("rude words and service names are refused", () => {
    for (const bad of ["fuck_you", "Sukaa", "dalbayob1", "Qotaq", "x_axmoq_x", "бля123"])
      expect(checkNick(bad), bad).toMatchObject({ ok: false, error: "bad" });
    expect(isRude("f0ck")).toBe(false);
    expect(isRude("fuuuck")).toBe(true);
    expect(checkNick("Admin")).toMatchObject({ error: "reserved" });
    expect(checkNick("Mehmon_1234")).toMatchObject({ error: "reserved" });
    // ism bo'lgan so'zlar filtrga tushmaydi
    for (const ok of ["Nazira", "Sikandar", "Assalom", "Grape", "Dilshod"])
      expect(checkNick(ok), ok).toMatchObject({ ok: true });
  });

  it("telegram username becomes the default nickname when it fits", () => {
    expect(nickFromTelegram("cool_user")).toBe("cool_user");
    expect(nickFromTelegram("ab")).toBeNull();
    expect(nickFromTelegram(undefined)).toBeNull();
  });

  it("every hero can be an avatar id", () => {
    expect(HERO_LIST.length).toBeGreaterThanOrEqual(5);
  });
});
