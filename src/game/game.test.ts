import { beforeEach, describe, expect, it } from "vitest";
import { Game, BEST_KEY, ENDLESS_BEST_KEY, TUTORIAL_KEY } from "./game";
import { Enemy } from "./enemy";
import { BOSS_WAVE, UPGRADES } from "./waves";
import { sfx } from "./audio";
import { DEFAULT_SETTINGS, saveSettings } from "./settings";
import { CHARGE_TIME, PLAYER_MAX_HP } from "./player";
import { GOLD_KEY, SHOP_KEY, addGold, loadGold } from "./shop";

/** Game ning test uchun kerakli ichki a'zolari. */
type GameInternals = {
  startWave(i: number): void;
  startEndless(): void;
  onPlayerHurt(): void;
  damageTarget(t: unknown, dmg: number): void;
  choose(i: number): void;
};

function makeGame() {
  // update() chizmaydi — soxta canvas yetarli
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement);
  return { g, gi: g as unknown as GameInternals };
}

function tick(g: Game, seconds: number, dt = 0.02) {
  for (let t = 0; t < seconds; t += dt) g.update(dt);
}

beforeEach(() => localStorage.clear());

describe("Tikanli zirh", () => {
  it("deals 1 damage to the nearest enemy when the player is hit", () => {
    const { g, gi } = makeGame();
    UPGRADES.find((u) => u.id === "thorns")!.apply(g.player);
    const near = new Enemy("rammer", g.player.x + 14, g.player.y);
    const far = new Enemy("rammer", g.player.x + 100, g.player.y);
    g.enemies = [near, far];
    g.player.takeHit(1, near.x, near.y, 0);
    gi.onPlayerHurt();
    expect(near.hp).toBe(near.maxHp - 1);
    expect(far.hp).toBe(far.maxHp);
  });

  it("does nothing without the upgrade", () => {
    const { g, gi } = makeGame();
    const near = new Enemy("rammer", g.player.x + 14, g.player.y);
    g.enemies = [near];
    gi.onPlayerHurt();
    expect(near.hp).toBe(near.maxHp);
  });
});

describe("Cheksiz rejim", () => {
  function winCampaign() {
    const { g, gi } = makeGame();
    gi.startWave(BOSS_WAVE);
    g.enemies = [];
    g.boss!.spawn = 0;
    g.score = 500;
    gi.damageTarget(g.boss, 999);
    tick(g, 2);
    return { g, gi };
  }

  it("beating the boss shows victory, then Enter-path starts endless with kept upgrades", () => {
    const { g, gi } = winCampaign();
    expect(g.phase).toBe("victory");
    expect(Number(localStorage.getItem(BEST_KEY))).toBe(800);
    g.player.damage = 2;
    gi.startEndless();
    expect(g.phase).toBe("play");
    expect(g.endless).toBe(true);
    expect(g.wave).toBe(BOSS_WAVE + 1);
    expect(g.score).toBe(0);
    expect(g.player.damage).toBe(2);
    expect(g.boss).toBeNull();
    expect(g.enemies.length).toBeGreaterThan(5);
  });

  it("an endless boss wave leads to an upgrade, not another victory", () => {
    const { g, gi } = winCampaign();
    gi.startEndless();
    g.enemies = [];
    gi.startWave(BOSS_WAVE + 5);
    expect(g.boss!.maxHp).toBe(45);
    g.enemies = [];
    g.boss!.spawn = 0;
    gi.damageTarget(g.boss, 999);
    tick(g, 2);
    expect(g.phase).toBe("play");
    expect(g.stage).toBe("upgrade");
  });

  it("dying in endless saves a separate record and does not add an attempt", () => {
    const { g, gi } = winCampaign();
    const attempt = g.attempt;
    gi.startEndless();
    g.score = 300;
    g.player.hp = 1;
    g.player.takeHit(1, g.player.x + 5, g.player.y, 0);
    tick(g, 1.5);
    expect(g.phase).toBe("attempt");
    expect(g.attempt).toBe(attempt);
    expect(Number(localStorage.getItem(ENDLESS_BEST_KEY))).toBe(300);
    expect(Number(localStorage.getItem(BEST_KEY))).toBe(800);
    tick(g, 3);
    expect(g.phase).toBe("play");
    expect(g.endless).toBe(false);
    expect(g.wave).toBe(0);
  });
});

describe("Kamonchi o'qlari o'yinda", () => {
  it("arrows hurt the player and the sword destroys them", () => {
    const { g, gi } = makeGame();
    gi.startWave(0);
    // to'lqin tugamasligi uchun uzoqda hali paydo bo'layotgan dushman
    const idle = new Enemy("blob", 30, 30);
    idle.spawn = 99;
    g.enemies = [idle];
    const p = g.player;
    g.shots = [{ x: p.x + 30, y: p.y, vx: -110, vy: 0, size: 4, arrow: true }];
    tick(g, 0.4);
    expect(p.hp).toBe(p.maxHp - 1);

    // zarba yegandan keyingi qotish tugagan deb olamiz
    p.invuln = 0;
    p.hurtTimer = 0;
    p.cooldown = 0;
    p.anim.set("idle");
    p.fx = 1;
    p.fy = 0;
    g.shots = [{ x: p.x + 12, y: p.y, vx: 0, vy: 0, size: 4, arrow: true }];
    g.input.pressAttack();
    tick(g, 0.04);
    expect(g.shots.length).toBe(0);
  });
});

describe("Fon musiqasi o'yinda", () => {
  it("plays the normal track on regular waves and the boss track on the boss wave", () => {
    const { g, gi } = makeGame();
    expect(sfx.music).toBe("normal");
    gi.startWave(BOSS_WAVE);
    expect(sfx.music).toBe("boss");
    gi.startWave(BOSS_WAVE + 1);
    expect(sfx.music).toBe("normal");
    // o'lim yozuvida musiqa to'xtaydi, qayta boshlanganda yana chalinadi
    g.enemies = [];
    g.player.hp = 1;
    g.player.takeHit(1, g.player.x + 5, g.player.y, 0);
    tick(g, 1.5);
    expect(g.phase).toBe("attempt");
    expect(sfx.music).toBeNull();
    tick(g, 3);
    expect(sfx.music).toBe("normal");
  });
});

describe("Sozlamalar o'yinda", () => {
  it("reads the screen-shake setting from localStorage", () => {
    expect(makeGame().g.shakeOn).toBe(true);
    saveSettings({ ...DEFAULT_SETTINGS, music: 50, sfx: 50, shake: false });
    expect(makeGame().g.shakeOn).toBe(false);
  });
});

describe("Birinchi o'yin ko'rsatmalari", () => {
  function freshPlayer(g: Game) {
    // to'lqin tugamasligi uchun uzoqda hali paydo bo'layotgan dushman
    const idle = new Enemy("blob", 30, 30);
    idle.spawn = 99;
    g.enemies = [idle];
  }

  it("shows all three hints on the first game and hides each after its action", () => {
    const { g } = makeGame();
    freshPlayer(g);
    expect(g.hints).toEqual(["attack", "spin", "dash"]);

    g.input.pressAttack();
    tick(g, 0.04);
    expect(g.hints).toEqual(["spin", "dash"]);

    g.input.pressDash();
    tick(g, 0.3);
    expect(g.hints).toEqual(["spin"]);
    expect(localStorage.getItem(TUTORIAL_KEY)).toBeNull();

    g.player.spinCooldown = 0;
    g.player.charge = CHARGE_TIME;
    tick(g, 0.02);
    expect(g.hints).toEqual([]);
    expect(localStorage.getItem(TUTORIAL_KEY)).toBe("1");
    expect(makeGame().g.hints).toEqual([]);
  });

  it("clearing the first wave ends the tutorial even if not every action was tried", () => {
    const { g } = makeGame();
    g.enemies = [];
    tick(g, 0.02);
    expect(g.stage).toBe("upgrade");
    expect(g.hints).toEqual([]);
    expect(makeGame().g.hints).toEqual([]);
  });

  it("does not show hints once the tutorial is done", () => {
    localStorage.setItem(TUTORIAL_KEY, "1");
    expect(makeGame().g.hints).toEqual([]);
  });
});

describe("Oltin tangalar", () => {
  /** Uzoqdagi, hali paydo bo'layotgan dushman — to'lqin tugamasin. */
  function holdWave() {
    const idle = new Enemy("blob", 30, 30);
    idle.spawn = 99;
    return idle;
  }

  it("each enemy kind drops its gold value as a coin", () => {
    const { g, gi } = makeGame();
    const kills = { blob: 1, wisp: 1, rammer: 2, archer: 2 } as const;
    for (const [kind, value] of Object.entries(kills)) {
      const e = new Enemy(kind as keyof typeof kills, 200, 60);
      g.enemies = [e, holdWave()];
      g.coins = [];
      gi.damageTarget(e, 99);
      expect(g.coins.map((c) => c.value)).toEqual([value]);
    }
  });

  it("the boss drops 25 gold", () => {
    const { g, gi } = makeGame();
    gi.startWave(BOSS_WAVE);
    g.boss!.spawn = 0;
    gi.damageTarget(g.boss, 999);
    expect(g.coins.reduce((n, c) => n + c.value, 0)).toBe(25);
  });

  it("walking over a coin adds it to the run gold shown in the HUD", () => {
    const { g } = makeGame();
    g.enemies = [holdWave()];
    g.coins = [{ x: g.player.x + 3, y: g.player.y, life: 12, value: 2 }];
    tick(g, 0.04);
    expect(g.coins).toEqual([]);
    expect(g.runGold).toBe(2);
  });

  it("coins left on the floor are collected when the wave is cleared", () => {
    const { g } = makeGame();
    g.enemies = [];
    g.coins = [{ x: 40, y: 40, life: 12, value: 1 }];
    tick(g, 0.02);
    expect(g.stage).toBe("upgrade");
    expect(g.runGold).toBe(1);
  });

  it("dying adds the run gold to the saved total", () => {
    addGold(10);
    const { g } = makeGame();
    g.enemies = [holdWave()];
    g.runGold = 7;
    g.player.hp = 1;
    g.player.takeHit(1, g.player.x + 5, g.player.y, 0);
    tick(g, 1.5);
    expect(g.phase).toBe("attempt");
    expect(loadGold()).toBe(17);
    expect(g.lastGold).toBe(7);
    expect(g.totalGold).toBe(17);
    tick(g, 3);
    expect(g.runGold).toBe(0);
  });

  it("victory and leaving to the menu also save the gold", () => {
    const { g, gi } = makeGame();
    gi.startWave(BOSS_WAVE);
    g.enemies = [];
    g.boss!.spawn = 0;
    g.runGold = 20;
    gi.damageTarget(g.boss, 999);
    tick(g, 2);
    expect(g.phase).toBe("victory");
    expect(Number(localStorage.getItem(GOLD_KEY))).toBe(45);

    gi.startEndless();
    g.runGold = 4;
    g.exitToMenu();
    expect(loadGold()).toBe(49);
  });
});

describe("Do'kon o'yinda", () => {
  it("a new game starts with the bought upgrades", () => {
    localStorage.setItem(SHOP_KEY, JSON.stringify({ heart: 2, dash: 1, blade: 1, luck: 0 }));
    const { g } = makeGame();
    expect(g.player.maxHp).toBe(PLAYER_MAX_HP + 2);
    expect(g.player.hp).toBe(PLAYER_MAX_HP + 2);
    expect(g.player.damage).toBe(2);
    expect(g.player.dashCd).toBeCloseTo(0.72);
  });

  it("the luck charm raises the heart drop chance", () => {
    const rnd = Math.random;
    // 0.25: odatiy 15% dan yuqori, 3 bosqichli tumor bilan (30%) tushadi
    Math.random = () => 0.25;
    try {
      const kill = () => {
        const { g, gi } = makeGame();
        const e = new Enemy("blob", 200, 60);
        g.enemies = [e];
        gi.damageTarget(e, 99);
        return g.drops.length;
      };
      expect(kill()).toBe(0);
      localStorage.setItem(SHOP_KEY, JSON.stringify({ heart: 0, dash: 0, blade: 0, luck: 3 }));
      expect(kill()).toBe(1);
    } finally {
      Math.random = rnd;
    }
  });
});

describe("O'yin oxiridagi statistika", () => {
  it("counts kills, combo and picked gold; reset() clears them", () => {
    const { g, gi } = makeGame();
    const idle = new Enemy("blob", 30, 30);
    idle.spawn = 99;
    const a = new Enemy("blob", 200, 60);
    const b = new Enemy("rammer", 220, 60);
    g.enemies = [a, b, idle];
    gi.damageTarget(a, 99);
    gi.damageTarget(b, 99);
    expect(g.stats.kills).toBe(2);
    expect(g.stats.maxCombo).toBe(2);

    g.coins = [{ x: g.player.x + 3, y: g.player.y, life: 12, value: 2 }];
    tick(g, 0.04);
    expect(g.stats.gold).toBe(2);
    expect(g.stats.time).toBeGreaterThan(0);

    g.reset();
    expect(g.stats).toEqual({ waves: 0, kills: 0, maxCombo: 0, gold: 0, chests: 0, time: 0 });
  });
});
