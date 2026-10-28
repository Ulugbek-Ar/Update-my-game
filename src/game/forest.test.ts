import { beforeEach, describe, expect, it } from "vitest";
import { CLOUD_LIFE, CLOUD_TICK, Game, WEB_SNARE } from "./game";
import {
  Enemy,
  ENEMY_HP,
  OWL_ALT,
  OWL_DIVE,
  OWL_MARK,
  ROOT_SNARE,
  ROOT_WARN,
  SHROOM_WINDUP,
  SPIDER_INSET,
  SPIDER_WINDUP,
  trackParam,
  trackPoint,
  type EnemyKind,
} from "./enemy";
import { ForestKing, KING_HP, MAX_SPIDERS, spiderSummonCount, KING_SUMMON_EVERY } from "./boss";
import { BOSS_WAVE, WAVES3, WORLD_KINDS, waveEnemies } from "./waves";
import { Player } from "./player";
import { ROOM } from "./animation";
import { WORLD2_WON_KEY, WORLD3_WON_KEY, isWorldOpen } from "./progress";
import { bestKeys } from "./hero";
import { KILL_GOLD } from "./shop";
import type { Input } from "./input";

type GI = {
  startWave(i: number): void;
  damageTarget(t: unknown, dmg: number): void;
  startEndless(): void;
  choose(i: number): void;
};

function makeGame(hero: "knight" | "mage" = "knight", world?: 1 | 2 | 3) {
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

/** To'lqin tugamasligi uchun uzoqda hali paydo bo'layotgan dushman. */
function holdWave(kind: EnemyKind = "shroom") {
  const idle = new Enemy(kind, 30, 30);
  idle.spawn = 99;
  return idle;
}

/** Faqat 3-dunyo: Iblis va Malikani yengib o'tish. */
function toForest(hero: "knight" | "mage" = "knight") {
  const { g, gi } = makeGame(hero);
  winBoss(g, gi);
  g.startChapter2();
  winBoss(g, gi);
  g.startChapter3();
  return { g, gi };
}

const input = (o: Partial<{ attack: boolean; x: number; y: number }> = {}) =>
  ({
    consumeAttack: () => !!o.attack,
    consumeDash: () => false,
    attackHeld: () => false,
    axis: () => ({ x: o.x ?? 0, y: o.y ?? 0 }),
  }) as unknown as Input;

beforeEach(() => localStorage.clear());

describe("3-dunyo: faqat o'z moblari", () => {
  const W3 = new Set<EnemyKind>(WORLD_KINDS[3]);

  it("the forest has its own four mobs that no other world shares", () => {
    expect([...W3].sort()).toEqual(["owl", "shroom", "spider", "treant"]);
    for (const k of [...WORLD_KINDS[1], ...WORLD_KINDS[2]]) expect(W3.has(k)).toBe(false);
    expect(ENEMY_HP).toMatchObject({ spider: 2, shroom: 3, treant: 8, owl: 2 });
    for (const k of W3) expect(KILL_GOLD[k]).toBeGreaterThan(0);
  });

  it("all 5 forest waves contain only forest mobs, the 5th brings the Forest King", () => {
    expect(WAVES3.length).toBe(5);
    for (const w of WAVES3) for (const k of w) expect(W3.has(k)).toBe(true);
    const { g, gi } = toForest();
    expect(g.chapter).toBe(3);
    expect(g.banner.title).toBe("3-DUNYO: ZULMAT O'RMONI");
    for (let i = 0; i < 5; i++) {
      g.enemies = [];
      gi.startWave(i);
      expect(g.enemies.map((e) => e.kind)).toEqual(WAVES3[i]);
      for (const e of g.enemies) expect(W3.has(e.kind)).toBe(true);
    }
    expect(g.boss).toBeInstanceOf(ForestKing);
    expect(g.boss!.maxHp).toBe(KING_HP);
    expect(KING_HP).toBe(50);
    expect(g.fx.snowOn).toBe(false);
  });

  it("forest endless mode never brings dungeon or ice mobs", () => {
    for (let n = 1; n <= 12; n++)
      for (const r of [0, 0.3, 0.6, 0.99])
        for (const k of waveEnemies(BOSS_WAVE + n, () => r, 3)) expect(W3.has(k)).toBe(true);
    const { g, gi } = toForest();
    winBoss(g, gi);
    expect(g.phase).toBe("victory");
    gi.startEndless();
    for (let n = 1; n <= 5; n++) {
      g.enemies = [];
      gi.startWave(BOSS_WAVE + n);
      for (const e of g.enemies) expect(W3.has(e.kind)).toBe(true);
    }
    expect(g.boss).toBeInstanceOf(ForestKing);
    expect(g.boss!.maxHp).toBe(KING_HP + 15);
  });

  it("the map path: beating the Queen unlocks world 3, beating the King records it", () => {
    const { g, gi } = makeGame();
    winBoss(g, gi);
    g.startChapter2();
    expect(isWorldOpen(3)).toBe(false);
    winBoss(g, gi);
    expect(localStorage.getItem(WORLD2_WON_KEY)).toBe("1");
    expect(isWorldOpen(3)).toBe(true);
    // 2-dunyo g'alabasidan Enter — 3-dunyoga
    g.input["enterQueued" as keyof Input] = true as never;
    g.update(0.02);
    expect(g.chapter).toBe(3);
    expect(g.phase).toBe("play");
    winBoss(g, gi);
    expect(g.phase).toBe("victory");
    expect(localStorage.getItem(WORLD3_WON_KEY)).toBe("1");
    expect(Number(localStorage.getItem(bestKeys("knight").ch3))).toBe(g.score);
  });

  it("starting world 3 from the map gives one free power, then forest wave 1", () => {
    const { g, gi } = makeGame("mage", 3);
    expect(g.chapter).toBe(3);
    expect(g.stage).toBe("upgrade");
    tick(g, 0.7);
    gi.choose(0);
    expect(g.enemies.map((e) => e.kind)).toEqual(WAVES3[0]);
    // o'lsa 3-dunyo boshidan qayta
    g.player.hp = 1;
    g.player.takeHit(1, g.player.x + 5, g.player.y, 0);
    tick(g, 1.5);
    expect(g.phase).toBe("attempt");
    g.retryChapter();
    expect(g.chapter).toBe(3);
    expect(g.wave).toBe(0);
  });
});

describe("O'rmon o'rgimchagi", () => {
  it("climbs to the nearest wall and then runs along it", () => {
    const p = new Player();
    p.x = 160;
    p.y = 120;
    const s = new Enemy("spider", 60, 120);
    s.spawn = 0;
    s.aiTimer = 99;
    for (let i = 0; i < 40; i++) s.update(0.02, p);
    expect(s.onWall).toBe(true);
    expect(s.x).toBeCloseTo(ROOM.wall + SPIDER_INSET, 0);
    // devor bo'ylab o'yinchiga eng yaqin nuqtaga yuradi va devordan uzoqlashmaydi
    p.x = 40;
    p.y = 40;
    for (let i = 0; i < 100; i++) {
      s.update(0.02, p);
      const [wx, wy] = trackPoint(trackParam(s.x, s.y));
      expect(Math.hypot(wx - s.x, wy - s.y)).toBeLessThan(0.01);
    }
    const [tx, ty] = trackPoint(trackParam(p.x, p.y));
    expect(Math.hypot(s.x - tx, s.y - ty)).toBeLessThan(2);
  });

  it("shoots a web onto the player's path; stepping in holds the player for 1s", () => {
    const { g } = toForest();
    const p = g.player;
    p.x = 160;
    p.y = 120;
    p.fx = 1;
    p.fy = 0;
    const s = new Enemy("spider", ROOM.wall + SPIDER_INSET, 120);
    s.spawn = 0;
    s.onWall = true;
    s.trackS = trackParam(s.x, s.y);
    s.aiTimer = 0;
    g.enemies = [s, holdWave()];
    p.update = () => {};
    tick(g, SPIDER_WINDUP + 0.05);
    expect(g.webs.length).toBe(1);
    const w = g.webs[0]!;
    // o'yinchi oldiga — o'ng tomonga tushadi
    expect(w.tx).toBeGreaterThan(p.x);
    tick(g, 1.5);
    expect(g.webs[0]?.flying).toBe(false);
    // o'yinchi to'rga kiradi
    delete (p as Partial<Player>).update;
    p.x = w.tx;
    p.y = w.ty;
    g.update(0.02);
    expect(p.snare).toBeCloseTo(WEB_SNARE, 1);
    expect(g.webs.length).toBe(0);
    const x = p.x;
    for (let i = 0; i < 20; i++) p.update(0.02, input({ x: 1 }));
    expect(p.x).toBe(x);
    // 1 soniyadan keyin yana yuradi
    for (let i = 0; i < 40; i++) p.update(0.02, input({ x: 1 }));
    expect(p.x).toBeGreaterThan(x);
  });

  it("a sword hit cuts the web free at once", () => {
    const p = new Player();
    p.snare = WEB_SNARE;
    p.update(0.02, input({ attack: true }));
    expect(p.snare).toBe(0);
    expect(p.cutFree).toBe(true);
    for (let i = 0; i < 20; i++) p.update(0.02, input({ x: 1 }));
    expect(p.x).toBeGreaterThan(160);
  });

  it("a dash passes over a web on the ground", () => {
    const { g } = toForest();
    const p = g.player;
    g.enemies = [holdWave()];
    g.webs = [{ x: p.x, y: p.y, vx: 0, vy: 0, tx: p.x, ty: p.y, flying: false, life: 5 }];
    p.dashTimer = 0.1;
    g.update(0.01);
    expect(p.snare).toBe(0);
    expect(g.webs.length).toBe(1);
  });
});

describe("Zaharli qo'ziqorin", () => {
  it("does not move and puffs a poison cloud when the player comes close", () => {
    const { g } = toForest();
    const p = g.player;
    const m = new Enemy("shroom", p.x + 20, p.y);
    m.spawn = 0;
    m.aiTimer = 0;
    g.enemies = [m];
    p.takeHit = () => false;
    const x = m.x;
    tick(g, SHROOM_WINDUP + 0.05);
    expect(m.x).toBe(x);
    expect(g.clouds.length).toBe(1);
    expect(g.clouds[0]!.life).toBeLessThanOrEqual(CLOUD_LIFE);
  });

  it("standing in the cloud costs 1 heart every second", () => {
    const { g } = toForest();
    const p = g.player;
    g.enemies = [holdWave()];
    g.clouds = [{ x: p.x, y: p.y, life: 10 }];
    const hp = p.hp;
    tick(g, CLOUD_TICK * 0.9);
    expect(p.hp).toBe(hp);
    tick(g, CLOUD_TICK * 0.2);
    expect(p.hp).toBe(hp - 1);
    tick(g, CLOUD_TICK);
    expect(p.hp).toBe(hp - 2);
  });

  it("running through quickly does no damage, and the cloud fades away", () => {
    const { g } = toForest();
    const p = g.player;
    g.enemies = [holdWave()];
    g.clouds = [{ x: p.x, y: p.y, life: CLOUD_LIFE }];
    const hp = p.hp;
    tick(g, 0.6);
    p.x += 60;
    tick(g, CLOUD_LIFE);
    expect(p.hp).toBe(hp);
    expect(g.clouds.length).toBe(0);
  });
});

describe("Daraxt odam", () => {
  it("is slow, has 8 hp, is not knocked back and shows a crack before the roots", () => {
    const p = new Player();
    p.x = 200;
    p.y = 120;
    const t = new Enemy("treant", 100, 120);
    t.spawn = 0;
    t.aiTimer = 0;
    expect(t.hp).toBe(8);
    expect(t.heavy).toBe(true);
    t.update(0.02, p);
    expect(t.rootWarn).toBeGreaterThan(0);
    expect([t.rootX, t.rootY]).toEqual([200, 120]);
    // ogohlantirish paytida joyida qolgan o'yinchini ildiz ushlaydi
    for (let s = 0; s < ROOT_WARN + 0.05; s += 0.02) t.update(0.02, p);
    expect(p.hp).toBe(5);
    expect(p.snare).toBeGreaterThan(ROOT_SNARE - 0.1);
  });

  it("stepping away from the crack dodges the roots", () => {
    const p = new Player();
    p.x = 200;
    p.y = 120;
    const t = new Enemy("treant", 100, 120);
    t.spawn = 0;
    t.aiTimer = 0;
    t.update(0.02, p);
    p.y = 160;
    for (let s = 0; s < ROOT_WARN + 0.05; s += 0.02) t.update(0.02, p);
    expect(p.hp).toBe(6);
    expect(p.snare).toBe(0);
  });
});

describe("Tungi boyo'g'li", () => {
  it("cannot be hit while flying high; its shadow marks the dive spot before it lands", () => {
    const p = new Player();
    const o = new Enemy("owl", 100, 100);
    o.spawn = 0;
    expect(o.alt).toBe(OWL_ALT);
    expect(o.airborne).toBe(true);
    expect(o.active).toBe(false);
    o.aiTimer = 0;
    o.update(0.02, p);
    expect(o.owlPhase).toBe("mark");
    expect([o.markX, o.markY]).toEqual([p.x, p.y]);
    for (let s = 0; s < OWL_MARK + OWL_DIVE + 0.05; s += 0.02) o.update(0.02, p);
    expect(o.owlPhase).toBe("rest");
    expect(o.alt).toBe(0);
    expect(o.active).toBe(true);
    // sho'ng'igan joyda turgan o'yinchi zarba yedi
    expect(p.hp).toBe(5);
  });

  it("moving out of the shadow dodges the dive", () => {
    const p = new Player();
    const o = new Enemy("owl", 100, 100);
    o.spawn = 0;
    o.aiTimer = 0;
    o.update(0.02, p);
    p.x += 40;
    for (let s = 0; s < OWL_MARK + OWL_DIVE + 0.05; s += 0.02) o.update(0.02, p);
    expect(p.hp).toBe(6);
  });

  it("in the game a flying owl takes no sword hits", () => {
    const { g, gi } = toForest();
    const o = new Enemy("owl", g.player.x + 10, g.player.y);
    o.spawn = 0;
    g.enemies = [o];
    g.player.attackTimer = 0.2;
    g.player.update = () => {};
    g.update(0.01);
    expect(o.hp).toBe(2);
    o.alt = 0;
    o.owlPhase = "rest";
    o.aiTimer = 1;
    g.player.hitSet.clear();
    g.update(0.01);
    expect(o.hp).toBe(1);
    expect(gi).toBeTruthy();
  });
});

describe("O'rmon Shohi", () => {
  it("summons at most 2 spiders at a time and never more than 3 in the room", () => {
    expect(spiderSummonCount(0)).toBe(2);
    expect(spiderSummonCount(1)).toBe(2);
    expect(spiderSummonCount(2)).toBe(1);
    expect(spiderSummonCount(MAX_SPIDERS)).toBe(0);
    expect(spiderSummonCount(5)).toBe(0);
    const { g, gi } = toForest();
    gi.startWave(BOSS_WAVE);
    g.enemies = [];
    const k = g.boss as ForestKing;
    k.spawn = 0;
    g.player.takeHit = () => false;
    let maxSpiders = 0;
    for (let s = 0; s < KING_SUMMON_EVERY * 5; s += 0.05) {
      g.update(0.05);
      maxSpiders = Math.max(maxSpiders, g.enemies.filter((e) => e.kind === "spider").length);
    }
    expect(maxSpiders).toBe(MAX_SPIDERS);
  });

  it("darkens the room below half health, keeping light around the player", () => {
    const { g, gi } = toForest();
    gi.startWave(BOSS_WAVE);
    g.enemies = [holdWave("spider")];
    const k = g.boss as ForestKing;
    k.spawn = 0;
    g.player.takeHit = () => false;
    tick(g, 0.5);
    expect(k.dark).toBe(false);
    expect(g.darkness).toBe(0);
    gi.damageTarget(k, KING_HP / 2 + 1);
    tick(g, 1.2);
    expect(k.dark).toBe(true);
    expect(g.darkness).toBe(1);
    expect(g.banner.title).toBe("G'AZAB!");
  });

  it("raises a row of warned roots toward the player", () => {
    const { g, gi } = toForest();
    gi.startWave(BOSS_WAVE);
    g.enemies = [holdWave("spider")];
    const k = g.boss as ForestKing;
    k.spawn = 0;
    g.player.update = () => {};
    let rows = 0;
    for (let s = 0; s < 4 && !rows; s += 0.02) {
      g.update(0.02);
      rows = k.roots.length;
    }
    expect(rows).toBeGreaterThanOrEqual(3);
    // ildizlar ketma-ket: birinchisi oxirgisidan oldin chiqadi
    expect(k.roots[0]!.warn).toBeLessThan(k.roots[rows - 1]!.warn);
  });
});
