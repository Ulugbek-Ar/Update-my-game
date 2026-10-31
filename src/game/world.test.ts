import { beforeEach, describe, expect, it } from "vitest";
import { bossHpFor } from "./bossPower";
import { Game, WORLD1_WON_KEY } from "./game";
import {
  Enemy,
  ENEMY_HP,
  GOLEM_SPLIT,
  ICEBLOB_CHILL,
  WOLF_CROUCH,
  WOLF_LEAP_SPEED,
  WOLF_LEAP_TIME,
  WOLF_TIRED,
  type EnemyKind,
} from "./enemy";
import { Queen, QUEEN_HP } from "./boss";
import { BOSS_WAVE, WAVES, WAVES2, WORLD_KINDS, waveEnemies } from "./waves";
import { Player } from "./player";
import { KILL_GOLD } from "./shop";

type GI = {
  startWave(i: number): void;
  damageTarget(t: unknown, dmg: number): void;
  startEndless(): void;
  choose(i: number): void;
};

function makeGame(hero: "knight" | "mage" = "knight", world?: 1 | 2) {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement, hero, world ? { world } : {});
  return { g, gi: g as unknown as GI };
}

function tick(g: Game, seconds: number, dt = 0.02) {
  for (let t = 0; t < seconds; t += dt) g.update(dt);
}

function winBoss(g: Game, gi: GI) {
  gi.startWave(BOSS_WAVE);
  g.enemies = [];
  g.boss!.spawn = 0;
  gi.damageTarget(g.boss, 999);
  tick(g, 2.5);
}

beforeEach(() => localStorage.clear());

describe("Har dunyoning o'z moblari", () => {
  const W1 = new Set<EnemyKind>(WORLD_KINDS[1]);
  const W2 = new Set<EnemyKind>(WORLD_KINDS[2]);

  it("world 1 is slime, bat, skeleton warrior and archer only; world 2 never shares a mob", () => {
    expect([...W1].sort()).toEqual(["archer", "blob", "rammer", "wisp"]);
    for (const k of W2) expect(W1.has(k)).toBe(false);
  });

  it("world 1 waves contain no world 2 mobs", () => {
    for (const w of WAVES) for (const k of w) expect(W1.has(k)).toBe(true);
    // 4-to'lqin qalqonli skeletsiz ham o'sha hajmda
    expect(WAVES[3]!.length).toBe(10);
  });

  it("world 2 waves contain no world 1 mobs and follow the new line-up", () => {
    for (const w of WAVES2) for (const k of w) expect(W2.has(k)).toBe(true);
    const count = (w: EnemyKind[]) =>
      w.reduce<Record<string, number>>((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});
    expect(count(WAVES2[0]!)).toEqual({ iceblob: 2, frost: 2 });
    expect(count(WAVES2[1]!)).toEqual({ wolf: 2, golem: 1, iceblob: 2 });
    expect(count(WAVES2[2]!)).toEqual({ shield: 2, wolf: 2, frost: 2 });
    expect(count(WAVES2[3]!)).toEqual({ golem: 2, wolf: 2, shield: 1, frost: 2, iceblob: 2 });
    expect(count(WAVES2[4]!)).toEqual({ iceblob: 2 });
    // bo'rilar doim juft keladi
    for (const w of WAVES2) expect((count(w)["wolf"] ?? 0) % 2).toBe(0);
  });

  it("endless waves stay inside the world they started in", () => {
    for (let n = 1; n <= 12; n++)
      for (const r of [0, 0.21, 0.42, 0.63, 0.84, 0.99]) {
        for (const k of waveEnemies(BOSS_WAVE + n, () => r, 1)) expect(W1.has(k)).toBe(true);
        for (const k of waveEnemies(BOSS_WAVE + n, () => r, 2)) expect(W2.has(k)).toBe(true);
      }
  });

  it("world 2 endless mode in the game: ice mobs, snow and the Snow Queen returns stronger", () => {
    const { g, gi } = makeGame();
    winBoss(g, gi);
    g.startChapter2();
    winBoss(g, gi);
    expect(g.phase).toBe("victory");
    gi.startEndless();
    expect(g.endless).toBe(true);
    expect(g.fx.snowOn).toBe(true);
    for (const e of g.enemies) expect(W2.has(e.kind)).toBe(true);
    g.enemies = [];
    gi.startWave(BOSS_WAVE + 5);
    expect(g.boss).toBeInstanceOf(Queen);
    expect(g.boss!.maxHp).toBe(bossHpFor(g.player, QUEEN_HP + 15, 1));
    for (const e of g.enemies) expect(W2.has(e.kind)).toBe(true);
  });

  it("world 1 endless mode never brings ice mobs", () => {
    const { g, gi } = makeGame();
    winBoss(g, gi);
    gi.startEndless();
    for (let n = 1; n <= 6; n++) {
      g.enemies = [];
      gi.startWave(BOSS_WAVE + n);
      for (const e of g.enemies) expect(W1.has(e.kind)).toBe(true);
    }
    expect(g.fx.snowOn).toBe(false);
  });
});

describe("Qor odam", () => {
  it("splits into exactly 2 Muz slime when it dies", () => {
    const { g, gi } = makeGame();
    const snowman = new Enemy("golem", 200, 80);
    g.enemies = [snowman];
    gi.damageTarget(snowman, 99);
    const blobs = g.enemies.filter((e) => e.kind === "iceblob");
    expect(GOLEM_SPLIT).toBe(2);
    expect(blobs.length).toBe(2);
    expect(g.enemies.filter((e) => e !== snowman && e.kind !== "iceblob")).toEqual([]);
  });
});

describe("Muz slime", () => {
  it("has 2 hp, hops toward the player and slows them for 0.8s on touch", () => {
    const { g, gi } = makeGame();
    gi.startWave(0);
    const p = g.player;
    const blob = new Enemy("iceblob", p.x + 40, p.y);
    expect(blob.maxHp).toBe(2);
    blob.spawn = 0;
    const d0 = Math.hypot(blob.x - p.x, blob.y - p.y);
    const idle = new Enemy("blob", 30, 30);
    idle.spawn = 99;
    g.enemies = [blob, idle];
    tick(g, 1);
    expect(Math.hypot(blob.x - p.x, blob.y - p.y)).toBeLessThan(d0);
    // teginish: 1 zarar va sekinlashuv
    p.invuln = 0;
    blob.x = p.x + 4;
    blob.y = p.y;
    const hp = p.hp;
    tick(g, 0.02);
    expect(p.hp).toBe(hp - 1);
    expect(p.chill).toBeGreaterThan(ICEBLOB_CHILL - 0.05);
    expect(p.chill).toBeLessThanOrEqual(ICEBLOB_CHILL);
  });

  it("a green slime touch does not slow", () => {
    const { g, gi } = makeGame();
    gi.startWave(0);
    const p = g.player;
    const blob = new Enemy("blob", p.x + 4, p.y);
    blob.spawn = 0;
    g.enemies = [blob];
    tick(g, 0.02);
    expect(p.chill).toBe(0);
  });
});

describe("Qor bo'risi", () => {
  function wolfAt(dx: number) {
    const p = new Player();
    p.x = 160;
    p.y = 120;
    const w = new Enemy("wolf", p.x + dx, p.y);
    return { p, w };
  }
  const step = (w: Enemy, p: Player, s: number, dt = 0.01) => {
    for (let t = 0; t < s - 1e-9; t += dt) w.update(dt, p);
  };

  it("has 3 hp, 2 gold and 20 points", () => {
    expect(ENEMY_HP.wolf).toBe(3);
    expect(KILL_GOLD.wolf).toBe(2);
  });

  it("circles, crouches 0.4s, leaps fast, then stays tired for 1s, then circles again", () => {
    const { p, w } = wolfAt(55);
    w.aiTimer = 0.5;
    step(w, p, 0.3);
    expect(w.wolfPhase).toBe("circle");
    // aylanadi: o'yinchidan taxminan bir xil masofada
    expect(Math.abs(Math.hypot(w.x - p.x, w.y - p.y) - 55)).toBeLessThan(12);
    // 0.5s da cho'kish boshlanadi
    step(w, p, 0.2);
    expect(w.wolfPhase).toBe("crouch");
    expect(w.anim.state).toBe("attack");
    expect(w.anim.frame).toBe(0);
    // cho'kishda joyidan qimirlamaydi (0.4s dan 0.3s o'tdi)
    const cx = w.x,
      cy = w.y;
    step(w, p, WOLF_CROUCH - 0.1);
    expect(w.wolfPhase).toBe("crouch");
    expect(Math.hypot(w.x - cx, w.y - cy)).toBeLessThan(0.5);
    step(w, p, 0.11);
    expect(w.wolfPhase).toBe("leap");
    expect(w.anim.frame).toBe(1);
    // sakrash: tez va qisqa
    const lx = w.x,
      ly = w.y;
    step(w, p, WOLF_LEAP_TIME);
    expect(w.wolfPhase).toBe("tired");
    expect(Math.hypot(w.x - lx, w.y - ly)).toBeGreaterThan(WOLF_LEAP_SPEED * WOLF_LEAP_TIME * 0.8);
    expect(w.anim.frame).toBe(2);
    // charchagan: 1s joyida turadi
    const tx = w.x,
      ty = w.y;
    step(w, p, WOLF_TIRED - 0.05);
    expect(w.wolfPhase).toBe("tired");
    expect(Math.hypot(w.x - tx, w.y - ty)).toBeLessThan(0.5);
    step(w, p, 0.1);
    expect(w.wolfPhase).toBe("circle");
  });

  it("locks the leap direction at the crouch, so stepping aside dodges it", () => {
    const { p, w } = wolfAt(55);
    w.aiTimer = 0;
    step(w, p, 0.01);
    expect(w.wolfPhase).toBe("crouch");
    p.y += 40; // o'yinchi chetga chiqdi
    step(w, p, WOLF_CROUCH + WOLF_LEAP_TIME);
    expect(Math.abs(w.y - 120)).toBeLessThan(3);
  });

  it("a leap that reaches the player deals 1 damage", () => {
    const { g, gi } = makeGame();
    gi.startWave(0);
    const p = g.player;
    const w = new Enemy("wolf", p.x + 50, p.y);
    w.spawn = 0;
    w.aiTimer = 0;
    const idle = new Enemy("blob", 30, 30);
    idle.spawn = 99;
    g.enemies = [w, idle];
    const hp = p.hp;
    tick(g, WOLF_CROUCH + WOLF_LEAP_TIME + 0.1);
    expect(p.hp).toBe(hp - 1);
  });

  it("getting hit mid-leap cuts the leap short and leaves it tired", () => {
    const { g, gi } = makeGame();
    const w = new Enemy("wolf", 200, 120);
    w.spawn = 0;
    w.wolfPhase = "leap";
    w.aiTimer = WOLF_LEAP_TIME;
    g.enemies = [w];
    gi.damageTarget(w, 1);
    w.update(0.02, g.player);
    expect(w.wolfPhase).toBe("tired");
  });
});

describe("Bosh menyudan 2-dunyo", () => {
  it("starts in world 2 with one free power pick and no starting upgrades", () => {
    const { g, gi } = makeGame("knight", 2);
    expect(g.chapter).toBe(2);
    expect(g.stage).toBe("upgrade");
    expect(g.enemies).toEqual([]);
    expect(g.choices.length).toBe(3);
    const fresh = new Player("knight");
    expect(g.player.damage).toBe(fresh.damage);
    tick(g, 0.7);
    const pick = g.choices[0]!;
    gi.choose(0);
    expect(g.stage).toBe("fight");
    expect(g.wave).toBe(0);
    expect(g.banner.title).toBe("2-DUNYO: MUZ SARDOBASI");
    expect(g.enemies.map((e) => e.kind)).toEqual(WAVES2[0]);
    expect(g.fx.snowOn).toBe(true);
    // o'lsa 2-dunyo tanlangan kuch bilan qayta boshlanadi
    g.player.hp = 1;
    g.player.takeHit(1, g.player.x + 5, g.player.y, 0);
    tick(g, 1.5);
    expect(g.phase).toBe("attempt");
    g.retryChapter2();
    expect(g.chapter).toBe(2);
    expect(g.wave).toBe(0);
    expect(g.stage).toBe("fight");
    const after = new Player("knight");
    pick.apply(after);
    expect(g.player.maxHp).toBe(after.maxHp);
    expect(g.player.damage).toBe(after.damage);
    expect(g.player.reach).toBe(after.reach);
  });

  it("works for the Mage too", () => {
    const { g, gi } = makeGame("mage", 2);
    expect(g.player.mage).toBe(true);
    tick(g, 0.7);
    gi.choose(0);
    expect(g.chapter).toBe(2);
    expect(g.enemies.map((e) => e.kind)).toEqual(WAVES2[0]);
  });

  it("winning world 1 unlocks the world choice; the daily challenge always stays in world 1", () => {
    const { g, gi } = makeGame();
    expect(localStorage.getItem(WORLD1_WON_KEY)).toBeNull();
    winBoss(g, gi);
    expect(localStorage.getItem(WORLD1_WON_KEY)).toBe("1");
    const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
    const daily = new Game(canvas as unknown as HTMLCanvasElement, "knight", {
      daily: "2026-10-28",
      world: 2,
    });
    expect(daily.chapter).toBe(1);
  });

  it("world 1 opens with its own banner", () => {
    const { g } = makeGame();
    expect(g.banner.title).toBe("1-DUNYO: OLOVLI ZINDON");
  });
});
