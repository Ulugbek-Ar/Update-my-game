import { beforeEach, describe, expect, it } from "vitest";
import { Game, SAMURAI_TIPS_KEY, TUTORIAL_KEY } from "./game";
import { Enemy } from "./enemy";
import { BOSS_WAVE } from "./waves";
import { FREE_HEROES, HERO_LIST, HERO_ROLE, PALADIN_PRICE, SAMURAI_PRICE, bestKeys } from "./hero";
import {
  UNLOCKED_HEROES_KEY,
  isHeroUnlocked,
  loadPlayableHero,
  loadUnlockedHeroes,
  migrateSave,
  selectHero,
  unlockHero,
} from "./save";
import { addGold, applyShop, buyHero, goldShort, heroPrice, loadGold } from "./shop";
import { ACHIEVEMENTS, loadAchievements } from "./achievements";
import { worldWins } from "./progress";
import { loadDaily } from "./daily";
import { heroBadge } from "./map";
import { applyTransfer, collectProgress, currentSummary, exportCode, readCode } from "./transfer";
import { IAI_CHARGE, IAI_DELAY, KATANA_MUL, SAMURAI_MAX_HP } from "./player";
import { touchLabels } from "./touchLayout";
import { applyGift, defaultLists, heroesIn, unlockAll } from "@/account/grants";
import { HERO_IDS } from "@/account/protocol";
import { loadRealmData } from "@/realm/data";
import { RealmSim, TICK_DT } from "@/realm/sim";
import { RealmClient } from "@/realm/client";

type GI = {
  startWave(i: number): void;
  damageTarget(t: unknown, d: number): void;
};
const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };

function makeGame(opts: { daily?: string; world?: 1 | 2 | 3 } = {}) {
  unlockHero("samurai");
  const g = new Game(canvas as unknown as HTMLCanvasElement, "samurai", opts);
  g.hints = [];
  return { g, gi: g as unknown as GI };
}

function tick(g: Game, seconds: number) {
  for (let t = 0; t < seconds; t += 0.02) g.update(0.02);
}

beforeEach(() => localStorage.clear());

describe("Samuray do'konda", () => {
  it("costs 600 gold — more than the Paladin — and is the 6th hero", () => {
    expect(SAMURAI_PRICE).toBe(600);
    expect(SAMURAI_PRICE).toBeGreaterThan(PALADIN_PRICE);
    expect(heroPrice("samurai")).toBe(600);
    expect(HERO_LIST.findIndex((h) => h.id === "samurai")).toBeGreaterThanOrEqual(FREE_HEROES);
    expect(HERO_ROLE.samurai).toBe("warrior");
  });

  it("is locked until bought; buying is saved and paid for once", () => {
    expect(isHeroUnlocked("samurai")).toBe(false);
    expect(selectHero("samurai")).toBe(false);
    // qulfli qahramon bilan o'yin — Ritsar
    localStorage.setItem("pixel-rpg-hero", "samurai");
    expect(loadPlayableHero()).toBe("knight");
    expect(new Game(canvas as unknown as HTMLCanvasElement, "samurai").player.hero).toBe("knight");
    expect(new RealmClient(canvas as unknown as HTMLCanvasElement, "samurai").me.hero).toBe(
      "knight",
    );
    addGold(SAMURAI_PRICE - 1);
    expect(goldShort("samurai")).toBe(1);
    expect(buyHero("samurai")).toBe(false);
    addGold(1);
    expect(buyHero("samurai")).toBe(true);
    expect(loadGold()).toBe(0);
    expect(JSON.parse(localStorage.getItem(UNLOCKED_HEROES_KEY)!)).toContain("samurai");
    expect(selectHero("samurai")).toBe(true);
    expect(loadPlayableHero()).toBe("samurai");
    expect(new Game(canvas as unknown as HTMLCanvasElement, "samurai").player.samurai).toBe(true);
    expect(new RealmClient(canvas as unknown as HTMLCanvasElement, "samurai").me.hero).toBe(
      "samurai",
    );
    // bir martalik
    addGold(SAMURAI_PRICE);
    expect(buyHero("samurai")).toBe(false);
    expect(loadGold()).toBe(SAMURAI_PRICE);
    // keyingi yuklash va migratsiyalardan keyin ham ochiq
    migrateSave();
    expect(loadUnlockedHeroes().has("samurai")).toBe(true);
  });

  it("travels in the transfer code and the cloud keys", async () => {
    addGold(SAMURAI_PRICE + 40);
    buyHero("samurai");
    selectHero("samurai");
    expect(JSON.parse(collectProgress()[UNLOCKED_HEROES_KEY]!)).toContain("samurai");
    expect(currentSummary().heroes).toContain("samurai");
    const code = await exportCode();
    localStorage.clear();
    expect(isHeroUnlocked("samurai")).toBe(false);
    const r = await readCode(code);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.summary.heroes).toContain("samurai");
    applyTransfer(r.data);
    expect(isHeroUnlocked("samurai")).toBe(true);
    expect(loadPlayableHero()).toBe("samurai");
    expect(loadGold()).toBe(40);
  });

  it("the author's HAMMASINI OCHISH and gifts include her; the server knows the hero id", () => {
    const all = unlockAll({}, defaultLists());
    expect(heroesIn(all)).toContain("samurai");
    const g = applyGift({}, { gold: 0, xp: 0, hero: "samurai" });
    expect(heroesIn(g)).toContain("samurai");
    // server tekshiradigan ro'yxat (avatar, sovg'a, reyting) — o'yindagi bilan bir xil
    expect([...HERO_IDS]).toEqual(HERO_LIST.map((h) => h.id));
  });
});

describe("Samuray hamma rejimlarda", () => {
  it("winning with the Samurai: own achievement, world win and separate records", () => {
    const { g, gi } = makeGame();
    gi.startWave(BOSS_WAVE);
    g.enemies = [];
    g.boss!.spawn = 0;
    g.score = 444;
    gi.damageTarget(g.boss, 999);
    tick(g, 3);
    expect(g.phase).toBe("victory");
    const got = loadAchievements();
    expect(got.has("winSamurai")).toBe(true);
    expect(got.has("winKnight")).toBe(false);
    expect(worldWins()[1]).toContain("samurai");
    expect(Number(localStorage.getItem(bestKeys("samurai").best))).toBeGreaterThanOrEqual(444);
    expect(localStorage.getItem(bestKeys("knight").best)).toBeNull();
    expect(bestKeys("samurai").endless).toBe("pixel-rpg-endless-best-samurai");
  });

  it("has her five achievements", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    for (const id of ["winSamurai", "firstIai", "dodge10", "parryBoss", "winSakura"])
      expect(ids).toContain(id);
    // yutuq xabari oynasiga sig'adi (6 px shrift, 25 belgi)
    for (const a of ACHIEVEMENTS) expect(a.name.length, a.name).toBeLessThanOrEqual(25);
  });

  it("shop upgrades fit the Samurai", () => {
    const { g } = makeGame();
    const p = g.player;
    applyShop(p, { heart: 3, dash: 3, blade: 1, luck: 0 });
    expect(p.maxHp).toBe(SAMURAI_MAX_HP + 3);
    expect(p.dashCd).toBeCloseTo(0.7 * 0.9 ** 3);
    expect(p.hitDamage).toBe(2 * KATANA_MUL);
  });

  it("daily challenge, other worlds and endless start with the Samurai", () => {
    const { g } = makeGame({ daily: "2026-11-12" });
    expect(g.player.samurai).toBe(true);
    expect(loadDaily("2026-11-12")?.hero).toBe("samurai");
    const w3 = makeGame({ world: 3 }).g;
    expect(w3.player.samurai).toBe(true);
    expect(w3.chapter).toBe(3);
  });

  it("first game shows three one-time tips: Iai, perfect dodge and parry", () => {
    unlockHero("samurai");
    localStorage.setItem(TUTORIAL_KEY, "1");
    const g = new Game(canvas as unknown as HTMLCanvasElement, "samurai");
    expect(g.hints).toEqual(["iai", "dodge", "parry"]);
    // Iai bajarildi — shu maslahat yo'qoladi
    g.enemies = [Object.assign(new Enemy("blob", 290, 30), { spawn: 99 })];
    g.input.setTouchAttack(true);
    tick(g, IAI_CHARGE + 0.1);
    g.input.setTouchAttack(false);
    tick(g, IAI_DELAY);
    expect(g.hints).toEqual(["dodge", "parry"]);
    // birinchi to'lqin o'tilgach — boshqa chiqmaydi
    g.enemies = [];
    tick(g, 0.1);
    expect(localStorage.getItem(SAMURAI_TIPS_KEY)).toBe("1");
    const again = new Game(canvas as unknown as HTMLCanvasElement, "samurai");
    expect(again.hints).toEqual([]);
    // boshqa qahramonlarga bu maslahatlar chiqmaydi
    localStorage.removeItem(SAMURAI_TIPS_KEY);
    expect(new Game(canvas as unknown as HTMLCanvasElement, "knight").hints).toEqual([]);
  });

  it("phone buttons: KATANA (hold for Iai) and DASH", () => {
    const l = touchLabels("samurai");
    expect(l.attack.text).toBe("KATANA");
    expect(l.attack.sub).toMatch(/iai/i);
    expect(l.dash.text).toBe("DASH");
    // boshqa qahramonlar tugmalari o'zgarmagan
    expect(touchLabels("knight").attack.text).toBe("ZARBA");
    expect(touchLabels("paladin").attack.text).toBe("SHANG");
  });

  it("the adventure map shows a pink ponytail badge", () => {
    const fills: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get: () => () => {},
        set: (_, k, v) => {
          if (k === "fillStyle") fills.push(v);
          return true;
        },
      },
    ) as CanvasRenderingContext2D;
    heroBadge(ctx, "samurai", 10, 10, true);
    expect(fills).toContain("#ff8fb8");
    fills.length = 0;
    heroBadge(ctx, "samurai", 10, 10, false);
    expect(fills).not.toContain("#ff8fb8");
  });

  it("works in the Realm (offline sim): katana hits a mob, Iai cuts it after the delay", () => {
    const s = new RealmSim(loadRealmData());
    const rp = s.addPlayer("p1", "samurai");
    rp.p.takeHit = () => false;
    const m = s.mobs.find((m) => m.kind === "boar")!;
    // mob paydo bo'lib bo'lsin (paydo bo'layotganda urilmaydi)
    for (let t = 0; t < 1.2; t += TICK_DT) s.step();
    // sinov davomida joyidan qimirlamasin
    m.stun = 30;
    rp.p.x = m.x - 18;
    rp.p.y = m.y;
    rp.p.fx = 1;
    rp.p.fy = 0;
    const hp = m.hp;
    s.command(rp, { type: "attack", down: true });
    s.command(rp, { type: "attack", down: false });
    for (let t = 0; t < 0.2; t += TICK_DT) s.step();
    expect(m.hp).toBe(hp - KATANA_MUL);
    // Iai: bosib turib qo'yib yuborish — mob ustidan sirpanib o'tadi
    rp.p.x = m.x - 30;
    rp.p.y = m.y;
    rp.p.fx = 1;
    rp.p.fy = 0;
    rp.p.cooldown = 0;
    const before = m.hp;
    s.command(rp, { type: "attack", down: true });
    for (let t = 0; t < IAI_CHARGE + 0.1; t += TICK_DT) s.step();
    s.command(rp, { type: "attack", down: false });
    for (let t = 0; t < 0.2; t += TICK_DT) s.step();
    expect(rp.p.x).toBeGreaterThan(m.x);
    expect(rp.iaiMarks).toContain(m);
    for (let t = 0; t < IAI_DELAY + 0.3; t += TICK_DT) s.step();
    expect(m.hp).toBeLessThan(before);
    expect(rp.iaiMarks).toHaveLength(0);
  });
});
