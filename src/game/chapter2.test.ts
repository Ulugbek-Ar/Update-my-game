import { beforeEach, describe, expect, it } from "vitest";
import { Game } from "./game";
import { Enemy, FROST_CHILL, FROST_WINDUP } from "./enemy";
import { Queen, QUEEN_HP, MAX_SPIRITS, summonCount } from "./boss";
import { BOSS_WAVE, WAVES2 } from "./waves";
import { Player, CHILL_SPEED } from "./player";
import { loadAchievements } from "./achievements";
import { bestKeys } from "./hero";
import type { Input } from "./input";

type GI = {
  startWave(i: number): void;
  damageTarget(t: unknown, dmg: number): void;
};

function makeGame(hero: "knight" | "mage" = "knight") {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement, hero);
  return { g, gi: g as unknown as GI };
}

function tick(g: Game, seconds: number, dt = 0.02) {
  for (let t = 0; t < seconds; t += dt) g.update(dt);
}

/** Bossni yengib g'alaba ekraniga chiqish (joriy bobda). */
function winBoss(g: Game, gi: GI) {
  gi.startWave(BOSS_WAVE);
  g.enemies = [];
  g.boss!.spawn = 0;
  gi.damageTarget(g.boss, 999);
  tick(g, 2.5);
}

/** To'lqin tugamasligi uchun uzoqda hali paydo bo'layotgan dushman. */
function holdWave() {
  const idle = new Enemy("blob", 30, 30);
  idle.spawn = 99;
  return idle;
}

/** Faqat yo'nalish beradigan soxta boshqaruv. */
const walkRight = {
  consumeAttack: () => false,
  consumeDash: () => false,
  attackHeld: () => false,
  axis: () => ({ x: 1, y: 0 }),
} as unknown as Input;

beforeEach(() => localStorage.clear());

describe("2-bob: o'tish", () => {
  it("after the Demon, chapter 2 keeps upgrades, hearts and score and heals 1 heart", () => {
    const { g, gi } = makeGame();
    winBoss(g, gi);
    expect(g.phase).toBe("victory");
    expect(g.chapter).toBe(1);
    g.player.damage = 2;
    g.player.maxHp = 8;
    g.player.hp = 3;
    g.player.dashMax = 2;
    const score = g.score;
    g.startChapter2();
    expect(g.chapter).toBe(2);
    expect(g.phase).toBe("play");
    expect(g.wave).toBe(0);
    expect(g.player.damage).toBe(2);
    expect(g.player.maxHp).toBe(8);
    expect(g.player.dashMax).toBe(2);
    expect(g.player.hp).toBe(4);
    expect(g.score).toBe(score);
    expect(g.banner.title).toBe("2-DUNYO: MUZ SARDOBASI");
    expect(g.enemies.map((e) => e.kind)).toEqual(WAVES2[0]);
    expect(g.fx.snowOn).toBe(true);
  });

  it("chapter 2 has 5 waves with the Snow Queen (40 hp) on the 5th", () => {
    const { g, gi } = makeGame();
    winBoss(g, gi);
    g.startChapter2();
    expect(WAVES2.length).toBe(5);
    gi.startWave(BOSS_WAVE);
    expect(g.boss).toBeInstanceOf(Queen);
    expect(g.boss!.maxHp).toBe(QUEEN_HP);
    expect(QUEEN_HP).toBe(40);
  });

  it("beating the Queen: 500 points, 40 gold, '2-BOB TUGADI' victory and a separate record", () => {
    const { g, gi } = makeGame("mage");
    winBoss(g, gi);
    g.startChapter2();
    gi.startWave(BOSS_WAVE);
    g.enemies = [];
    g.boss!.spawn = 0;
    const score = g.score;
    gi.damageTarget(g.boss, 999);
    expect(g.score).toBe(score + 500);
    expect(g.coins.reduce((n, c) => n + c.value, 0)).toBe(40);
    tick(g, 2.5);
    expect(g.phase).toBe("victory");
    expect(g.chapter).toBe(2);
    expect(Number(localStorage.getItem(bestKeys("mage").ch2))).toBe(g.score);
    expect(g.newCh2Best).toBe(true);
  });

  it("dying in chapter 2 waits for a choice and restarts chapter 2 with its starting powers", () => {
    const { g, gi } = makeGame();
    winBoss(g, gi);
    g.player.damage = 2;
    g.startChapter2();
    const score = g.score;
    const attempt = g.attempt;
    gi.startWave(2);
    g.player.damage = 3;
    g.score += 999;
    g.enemies = [holdWave()];
    g.player.hp = 1;
    g.player.takeHit(1, g.player.x + 5, g.player.y, 0);
    tick(g, 1.5);
    expect(g.phase).toBe("attempt");
    expect(g.attempt).toBe(attempt + 1);
    tick(g, 5);
    // avtomatik qayta boshlanmaydi
    expect(g.phase).toBe("attempt");
    g.retryChapter2();
    expect(g.phase).toBe("play");
    expect(g.chapter).toBe(2);
    expect(g.wave).toBe(0);
    expect(g.player.damage).toBe(2);
    expect(g.score).toBe(score);
  });
});

describe("Qor odam (golem)", () => {
  it("is not knocked back and splits into 2 Muz slime (2 hp) on death", () => {
    const { g, gi } = makeGame();
    const golem = new Enemy("golem", 200, 80);
    expect(golem.maxHp).toBe(7);
    g.enemies = [golem];
    gi.damageTarget(golem, 1);
    expect(golem.vx).toBe(0);
    expect(golem.vy).toBe(0);
    gi.damageTarget(golem, 99);
    const blobs = g.enemies.filter((e) => e.kind === "iceblob");
    expect(blobs.length).toBe(2);
    for (const s of blobs) expect(s.maxHp).toBe(2);
  });

  it("stomps every 3s: 1 damage only inside the small circle", () => {
    const p = new Player();
    const golem = new Enemy("golem", p.x + 20, p.y);
    golem.update(3.01, p);
    expect(golem.stompWindup).toBeGreaterThan(0);
    for (let t = 0; t < 1; t += 0.02) golem.update(0.02, p);
    expect(p.hp).toBe(p.maxHp - 1);

    const far = new Player();
    const g2 = new Enemy("golem", far.x + 80, far.y);
    for (let t = 0; t < 4.2; t += 0.02) g2.update(0.02, far);
    expect(far.hp).toBe(far.maxHp);
  });
});

describe("Muz ruhi", () => {
  it("breathes a frost cone after a 1s windup: 1 damage and 1.5s slow", () => {
    const p = new Player();
    const ghost = new Enemy("frost", p.x + 24, p.y);
    ghost.aiTimer = 0;
    ghost.update(0.02, p);
    expect(ghost.breathWindup).toBeCloseTo(FROST_WINDUP);
    for (let t = 0; t < FROST_WINDUP; t += 0.02) ghost.update(0.02, p);
    expect(p.hp).toBe(p.maxHp - 1);
    expect(p.chill).toBeCloseTo(FROST_CHILL, 1);
  });

  it("stepping out of the cone during the windup avoids the breath", () => {
    const p = new Player();
    const ghost = new Enemy("frost", p.x + 24, p.y);
    ghost.aiTimer = 0;
    ghost.update(0.02, p);
    p.y -= 60;
    for (let t = 0; t < FROST_WINDUP; t += 0.02) ghost.update(0.02, p);
    expect(p.hp).toBe(p.maxHp);
    expect(p.chill).toBe(0);
  });

  it("a chilled player walks at half speed", () => {
    const a = new Player(),
      b = new Player();
    b.chill = FROST_CHILL;
    a.update(0.1, walkRight);
    b.update(0.1, walkRight);
    expect(b.x - 160).toBeCloseTo((a.x - 160) * CHILL_SPEED);
  });

  it("can float over the walls (clamped only by the room edge)", () => {
    const p = new Player();
    p.x = 20;
    const ghost = new Enemy("frost", 8, p.y);
    ghost.update(0.02, p);
    expect(ghost.x).toBeLessThan(16);
  });
});

describe("Qor Malikasi: ruh chaqirish", () => {
  it("summons 2 spirits below half hp but never more than 3 in the room", () => {
    expect([summonCount(0), summonCount(1), summonCount(2), summonCount(3)]).toEqual([2, 2, 1, 0]);
    const { g, gi } = makeGame();
    winBoss(g, gi);
    g.startChapter2();
    gi.startWave(BOSS_WAVE);
    const q = g.boss as Queen;
    q.spawn = 0;
    g.enemies = [];
    tick(g, 0.1);
    expect(g.enemies.filter((e) => e.kind === "frost").length).toBe(0);
    q.hp = 15;
    tick(g, 0.04);
    expect(g.enemies.filter((e) => e.kind === "frost").length).toBe(2);
    q.wantSummon = true;
    tick(g, 0.02);
    expect(g.enemies.filter((e) => e.kind === "frost").length).toBe(MAX_SPIRITS);
    q.wantSummon = true;
    tick(g, 0.02);
    expect(g.enemies.filter((e) => e.kind === "frost").length).toBe(MAX_SPIRITS);
  });
});

describe("2-bob yutuqlari", () => {
  it("MUZNI ERITDI and IKKI BOB for beating both chapters without dying", () => {
    const { g, gi } = makeGame();
    winBoss(g, gi);
    g.startChapter2();
    winBoss(g, gi);
    const got = loadAchievements();
    expect(got.has("queen")).toBe(true);
    expect(got.has("twoChapters")).toBe(true);
  });

  it("no IKKI BOB after a death in chapter 2", () => {
    const { g, gi } = makeGame();
    winBoss(g, gi);
    g.startChapter2();
    g.enemies = [holdWave()];
    g.player.hp = 1;
    g.player.takeHit(1, g.player.x + 5, g.player.y, 0);
    tick(g, 1.5);
    g.retryChapter2();
    winBoss(g, gi);
    expect(loadAchievements().has("queen")).toBe(true);
    expect(loadAchievements().has("twoChapters")).toBe(false);
  });

  it("SOVUQQA CHIDAM: a chapter 2 wave with spirits cleared without being slowed", () => {
    const { g, gi } = makeGame();
    winBoss(g, gi);
    g.startChapter2();
    g.player.chill = 1;
    tick(g, 0.02);
    g.enemies = [];
    tick(g, 0.02);
    expect(loadAchievements().has("noChill")).toBe(false);
    // sekinlashuv tugagach 3-to'lqin (unda ham Muz ruhi bor)
    g.player.chill = 0;
    gi.startWave(2);
    g.enemies = [];
    tick(g, 0.02);
    expect(loadAchievements().has("noChill")).toBe(true);
  });
});

describe("2-bob musiqasi", () => {
  it("plays the ice track on chapter 2 waves and the Snow Queen track on her wave", async () => {
    const { sfx } = await import("./audio");
    const { g, gi } = makeGame();
    winBoss(g, gi);
    g.startChapter2();
    expect(sfx.music).toBe("ice");
    gi.startWave(BOSS_WAVE);
    expect(sfx.music).toBe("queen");
    sfx.stopMusic();
  });
});
