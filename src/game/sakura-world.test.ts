import { beforeEach, describe, expect, it } from "vitest";
import { Game, REFLECT_MUL } from "./game";
import {
  Enemy,
  KITSUNE_FAR,
  KITSUNE_NEAR,
  KITSUNE_SHOTS,
  KITSUNE_SPREAD,
  KITSUNE_WINDUP,
  NINJA_BEHIND,
  NINJA_REACH,
  NINJA_VANISH,
  NINJA_WARN,
  TENGU_BOUNCE,
  TENGU_DIVE,
  TENGU_DIVES,
  TENGU_MARK,
  TENGU_MARK2,
  type EnemyKind,
} from "./enemy";
import {
  ONI_COMBO_WINDUP,
  ONI_PHASE2_AT,
  ONI_RECOIL,
  ONI_RING_GAP,
  ONI_RING_IN,
  ONI_RING_OUT,
  ONI_RING_WARN,
  ONI_SLAM_R,
  ONI_SLAM_WINDUP,
  ONI_STAGGER,
  ONI_SWEEP_WINDUP,
  ONI_WAVE_SPEED,
  Oni,
} from "./oni";
import { Boss, ForestKing, Queen } from "./boss";
import {
  BOSS_WAVE,
  WAVES,
  WAVES2,
  WAVES3,
  WAVES4,
  WORLD_KINDS,
  waveEnemies,
  type World,
} from "./waves";
import { DANGER, DANGER_COLORS, colorDistance } from "./danger";
import { MAP_NODES, MapState } from "./map";
import { isWorldOpen, recordWorldWin, worldWins } from "./progress";
import { unlockHero } from "./save";
import { bestKeys, type Hero } from "./hero";
import { loadAchievements } from "./achievements";
import { PETALS, PETALS_REDUCED } from "./sakura";
import { KILL_GOLD, addGold, buyHero } from "./shop";
import { PARRY_STUN, type Target } from "./player";
import { spriteGrid, spritePixels, spriteSize } from "./sprites";
import type { AnimState } from "./animation";

const DT = 1 / 60;
const SAKURA: readonly EnemyKind[] = ["ninja", "tengu", "kitsune"];

type GI = {
  startWave(i: number): void;
  damageTarget(t: unknown, dmg: number): void;
  choose(i: number): void;
};

const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };

function makeGame(hero: Hero = "knight", world?: World) {
  if (hero !== "knight" && hero !== "mage") unlockHero(hero);
  const g = new Game(canvas as unknown as HTMLCanvasElement, hero, world ? { world } : {});
  const gi = g as unknown as GI;
  // 2-4-dunyo xaritadan boshlansa — avval bitta bepul kuch tanlanadi
  if (world && world > 1) gi.choose(0);
  g.hints = [];
  return { g, gi, p: g.player };
}

function tick(g: Game, seconds: number, dt = DT) {
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    g.update(dt);
    g.input.endFrame();
  }
}

/** Zarbalarni yozib oladigan soxta o'yinchi (dushman sun'iy aqlini alohida sinash uchun). */
function target(x: number, y: number, fx = 1, fy = 0) {
  const hits: { t: number; x: number; y: number }[] = [];
  const t = {
    x,
    y,
    size: 12,
    fx,
    fy,
    chill: 0,
    evading: false,
    now: 0,
    /** true — zarba bekor (parry yoki chetlanish kabi) */
    dodge: false,
    takeHit(_dmg: number, fromX: number, fromY: number) {
      hits.push({ t: t.now, x: fromX, y: fromY });
      return !t.dodge;
    },
    ensnare() {},
    encase() {
      return false;
    },
  };
  return { t, p: t as unknown as Target, hits };
}

/** Dushmanni (paydo bo'lib bo'lgan) sekundlar davomida yuritadi. */
function runEnemy(e: Enemy, tg: ReturnType<typeof target>, seconds: number) {
  for (let s = 0; s < seconds - 1e-9; s += DT) {
    tg.t.now += DT;
    e.update(DT, tg.p);
  }
}

function runBoss(b: Boss, tg: ReturnType<typeof target>, seconds: number, onFrame?: () => void) {
  for (let s = 0; s < seconds - 1e-9; s += DT) {
    tg.t.now += DT;
    b.update(DT, tg.p);
    onFrame?.();
  }
}

function freshOni(hp = 100) {
  const o = new Oni(hp);
  o.spawn = 0;
  o.x = 160;
  o.y = 80;
  return o;
}

/** Oni 2-fazaga o'tadi (daxlsizlik tugagan holda). */
function phase2(o: Oni, tg: ReturnType<typeof target>) {
  o.hp = o.maxHp * ONI_PHASE2_AT;
  runBoss(o, tg, DT);
  expect(o.phase).toBe(2);
  o.guard = 0;
}

/** Kanvas o'rnida: ishlatilgan bo'yoq ranglarini yozib oladi. */
function recorder() {
  const colors: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_t, k) => (k === "fillStyle" || k === "strokeStyle" ? "" : () => {}),
      set: (_t, k, v) => {
        if (k === "fillStyle" || k === "strokeStyle") colors.push(String(v));
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, colors };
}

const isDanger = (c: string) => DANGER_COLORS.some((d) => colorDistance(c, d) < 1);

beforeEach(() => localStorage.clear());

describe("Sakura bog'i: faqat o'z moblari va Oni", () => {
  it("has its own mobs that no other world uses", () => {
    expect(WORLD_KINDS[4]).toEqual(SAKURA);
    for (const w of [1, 2, 3] as World[]) {
      for (const k of WORLD_KINDS[w]) expect(SAKURA).not.toContain(k);
      for (const k of SAKURA) expect(WORLD_KINDS[w]).not.toContain(k);
    }
  });

  it("main and endless waves of world 4 spawn only Sakura mobs; other worlds never spawn them", () => {
    for (const wave of WAVES4) for (const k of wave) expect(SAKURA).toContain(k);
    for (const wave of [...WAVES, ...WAVES2, ...WAVES3])
      for (const k of wave) expect(SAKURA).not.toContain(k);
    for (let i = BOSS_WAVE + 1; i < BOSS_WAVE + 16; i++)
      for (let r = 0; r < 1; r += 0.05) {
        for (const k of waveEnemies(i, () => r, 4)) expect(SAKURA).toContain(k);
        for (const w of [1, 2, 3] as World[])
          for (const k of waveEnemies(i, () => r, w)) expect(SAKURA).not.toContain(k);
      }
  });

  it("the game in world 4 spawns them, and its boss is Oni — no other world has Oni", () => {
    const { g, gi } = makeGame("knight", 4);
    expect(g.chapter).toBe(4);
    for (let i = 0; i < BOSS_WAVE; i++) {
      gi.startWave(i);
      expect(g.enemies.length).toBeGreaterThan(0);
      for (const e of g.enemies) expect(SAKURA).toContain(e.kind);
    }
    gi.startWave(BOSS_WAVE);
    expect(g.boss).toBeInstanceOf(Oni);
    for (const w of [1, 2, 3] as World[]) {
      const { g: o, gi: oi } = makeGame("knight", w === 1 ? undefined : w);
      oi.startWave(BOSS_WAVE);
      expect(o.boss).toBeInstanceOf(w === 1 ? Boss : w === 2 ? Queen : ForestKing);
      expect(o.boss).not.toBeInstanceOf(Oni);
      for (let i = 0; i < BOSS_WAVE; i++) {
        oi.startWave(i);
        for (const e of o.enemies) expect(SAKURA).not.toContain(e.kind);
      }
    }
  });

  it("new mobs give gold and points like other worlds' mobs", () => {
    for (const k of SAKURA) expect(KILL_GOLD[k]).toBeGreaterThan(0);
  });
});

describe("Sakura bog'i: xarita, qulf va rekordlar", () => {
  it("is locked until the Samurai is owned — winning worlds 1-3 does not open it", () => {
    expect(isWorldOpen(4)).toBe(false);
    recordWorldWin(1, "knight");
    recordWorldWin(2, "knight");
    recordWorldWin(3, "knight");
    expect(isWorldOpen(4)).toBe(false);
    const s = new MapState();
    s.sel = 4;
    expect(s.enter()).toBeNull();
    expect(s.msg).toBe("QULFLANGAN");
    expect(MAP_NODES.find((n) => n.world === 4)?.lock).toBe("Samuray qizni oching");
  });

  it("buying the Samurai opens it even for a new player; then any hero can play there", () => {
    addGold(1000);
    expect(buyHero("samurai")).toBe(true);
    expect(isWorldOpen(4)).toBe(true);
    const s = new MapState();
    expect(s.open[2]).toBe(false);
    expect(s.open[4]).toBe(true);
    s.sel = 4;
    expect(s.enter()).toBe(4);
    const { g } = makeGame("knight", 4);
    expect(g.player.hero).toBe("knight");
    expect(g.chapter).toBe(4);
  });

  it("W/S jumps between Muz sardobasi and Sakura bog'i on the map", () => {
    const s = new MapState();
    s.sel = 2;
    s.jump("down");
    expect(s.sel).toBe(4);
    s.jump("up");
    expect(s.sel).toBe(2);
  });

  it("winning it keeps its own record; with the Samurai it unlocks the achievement", () => {
    for (const hero of ["knight", "samurai"] as Hero[]) {
      const { g, gi } = makeGame(hero, 4);
      gi.startWave(BOSS_WAVE);
      g.enemies = [];
      g.intro = 0;
      g.boss!.spawn = 0;
      gi.damageTarget(g.boss, 9999);
      tick(g, 3.5, 0.02);
      expect(g.phase).toBe("victory");
      expect(Number(localStorage.getItem(bestKeys(hero).ch4))).toBe(g.score);
      expect(worldWins()[4]).toContain(hero);
      expect(loadAchievements().has("winSakura")).toBe(hero === "samurai");
    }
  });
});

describe("Ninja-soya: tutun, orqadan zarba", () => {
  it("turns to smoke (cannot be hit), appears behind the player, warns, then strikes", () => {
    const tg = target(160, 120, 1, 0);
    const n = new Enemy("ninja", 60, 120);
    n.spawn = 0;
    n.aiTimer = 0.001;
    runEnemy(n, tg, DT);
    expect(n.ninjaPhase).toBe("vanish");
    expect(n.cue).toBe("vanish");
    expect(n.hidden).toBe(true);
    expect(n.active).toBe(false);
    runEnemy(n, tg, NINJA_VANISH + DT);
    expect(n.ninjaPhase).toBe("warn");
    // o'yinchi o'ngga qarab turibdi — ninja chap tomonda (orqada) paydo bo'ladi
    expect(n.x).toBeCloseTo(160 - NINJA_BEHIND, 5);
    expect(n.y).toBeCloseTo(120, 5);
    expect(n.active).toBe(true);
    // ogohlantirish vaqti aniq: zarba NINJA_WARN dan keyin (parry uchun qulay)
    runEnemy(n, tg, NINJA_WARN - 0.05);
    expect(tg.hits).toHaveLength(0);
    runEnemy(n, tg, 0.07);
    expect(tg.hits).toHaveLength(1);
    expect(tg.hits[0]).toMatchObject({ x: n.x, y: n.y });
  });

  it("misses if the player moved out of reach during the warning", () => {
    const tg = target(160, 120, 0, 1);
    const n = new Enemy("ninja", 60, 120);
    n.spawn = 0;
    n.ninjaPhase = "vanish";
    n.aiTimer = 0.001;
    runEnemy(n, tg, DT);
    expect(n.ninjaPhase).toBe("warn");
    // pastga qaragan o'yinchining orqasi — tepada
    expect(n.y).toBeCloseTo(120 - NINJA_BEHIND, 5);
    tg.t.y += NINJA_REACH + 20;
    runEnemy(n, tg, NINJA_WARN + 0.1);
    expect(tg.hits).toHaveLength(0);
  });

  it("the hidden ninja is not hit by the knight's sword", () => {
    const { g, p } = makeGame("knight");
    g.enemies = [];
    const n = new Enemy("ninja", p.x + 12, p.y);
    n.spawn = 0;
    n.ninjaPhase = "vanish";
    n.aiTimer = 5;
    g.enemies.push(n);
    p.fx = 1;
    p.fy = 0;
    g.input.pressAttack();
    tick(g, 0.3);
    expect(n.hp).toBe(n.maxHp);
  });

  it("the Samurai parries its strike: no damage, the ninja is stunned", () => {
    const { g, p } = makeGame("samurai");
    const keeper = new Enemy("blob", 290, 30);
    keeper.spawn = 99;
    const n = new Enemy("ninja", 60, 120);
    n.spawn = 0;
    g.enemies = [keeper, n];
    p.x = 160;
    p.y = 120;
    p.fx = 1;
    p.fy = 0;
    // ninja orqada paydo bo'ldi, zarbagacha 0.05 s
    n.ninjaPhase = "warn";
    n.x = 140;
    n.y = 120;
    n.aiTimer = 0.05;
    g.input.pressAttack();
    tick(g, 0.2);
    expect(p.hp).toBe(p.maxHp);
    expect(n.stun).toBeGreaterThan(PARRY_STUN - 0.25);
    expect(g.fx.texts.some((t) => t.s === "SHIK!")).toBe(true);
  });
});

describe("Tengu-qush: soya va ikki sho'ng'ish", () => {
  it("marks the player's spot while high up (cannot be hit), then dives there twice", () => {
    const tg = target(160, 120);
    const t = new Enemy("tengu", 100, 60);
    t.spawn = 0;
    t.aiTimer = 0.001;
    runEnemy(t, tg, DT);
    expect(t.tenguPhase).toBe("mark");
    expect([t.markX, t.markY]).toEqual([160, 120]);
    expect(t.airborne).toBe(true);
    expect(t.active).toBe(false);
    runEnemy(t, tg, TENGU_MARK + TENGU_DIVE - 0.05);
    expect(tg.hits).toHaveLength(0);
    runEnemy(t, tg, 0.08);
    expect(tg.hits).toHaveLength(1);
    expect(t.cue).toBe("dive");
    // sapchib qayta ko'tariladi, ikkinchi ogohlantirish qisqaroq
    runEnemy(t, tg, TENGU_BOUNCE + 0.02);
    expect(t.tenguPhase).toBe("mark");
    expect(TENGU_MARK2).toBeLessThan(TENGU_MARK);
    runEnemy(t, tg, TENGU_MARK2 + TENGU_DIVE + 0.03);
    expect(tg.hits).toHaveLength(TENGU_DIVES);
    // so'ng yerda dam oladi — urish mumkin
    expect(t.tenguPhase).toBe("rest");
    expect(t.airborne).toBe(false);
    expect(t.active).toBe(true);
  });

  it("stepping away from the shadow makes it miss", () => {
    const tg = target(160, 120);
    const t = new Enemy("tengu", 100, 60);
    t.spawn = 0;
    t.aiTimer = 0.001;
    runEnemy(t, tg, 0.1);
    tg.t.x = 60;
    runEnemy(t, tg, TENGU_MARK + TENGU_DIVE);
    expect(tg.hits).toHaveLength(0);
    expect(t.tenguPhase).toBe("bounce");
  });

  it("a dash right before the dive lands is the Samurai's perfect dodge", () => {
    const { g, p } = makeGame("samurai");
    const keeper = new Enemy("blob", 290, 30);
    keeper.spawn = 99;
    const t = new Enemy("tengu", 160, 80);
    t.spawn = 0;
    g.enemies = [keeper, t];
    p.x = 160;
    p.y = 120;
    p.fx = 0;
    p.fy = 1;
    t.tenguPhase = "dive";
    t.markX = 160;
    t.markY = 120;
    t.aiTimer = 0.05;
    t.alt = 10;
    g.input.pressDash();
    tick(g, 0.2);
    expect(p.hp).toBe(p.maxHp);
    expect(p.critReady).toBe(true);
    expect(g.fx.texts.some((x) => x.s === "CHETLANDI!")).toBe(true);
  });
});

describe("Kitsune-olov: uchta ko'k olov", () => {
  it("charges its tails, then shoots three blue fireballs in a fan", () => {
    const tg = target(160, 120);
    const k = new Enemy("kitsune", 60, 120);
    k.spawn = 0;
    k.aiTimer = 0.001;
    runEnemy(k, tg, DT);
    expect(k.foxWindup).toBeCloseTo(KITSUNE_WINDUP, 5);
    expect(k.cue).toBe("foxfire");
    runEnemy(k, tg, KITSUNE_WINDUP - 0.05);
    expect(k.shots).toHaveLength(0);
    runEnemy(k, tg, 0.07);
    expect(k.shots).toHaveLength(KITSUNE_SHOTS);
    const angles = k.shots.map((s) => Math.atan2(s.vy, s.vx)).sort((a, b) => a - b);
    expect(angles[0]).toBeCloseTo(-KITSUNE_SPREAD, 5);
    expect(angles[1]).toBeCloseTo(0, 5);
    expect(angles[2]).toBeCloseTo(KITSUNE_SPREAD, 5);
  });

  it("keeps its distance: backs off when the player comes close", () => {
    const tg = target(160, 120);
    const k = new Enemy("kitsune", 130, 120);
    k.spawn = 0;
    k.aiTimer = 9;
    const d0 = Math.hypot(k.x - 160, k.y - 120);
    expect(d0).toBeLessThan(KITSUNE_NEAR);
    runEnemy(k, tg, 0.5);
    expect(Math.hypot(k.x - 160, k.y - 120)).toBeGreaterThan(d0 + 10);
    expect(KITSUNE_FAR).toBeGreaterThan(KITSUNE_NEAR);
  });

  it("in the game its shots are blue, and the Samurai's parry sends them back to it", () => {
    const { g, p } = makeGame("samurai");
    const keeper = new Enemy("blob", 290, 30);
    keeper.spawn = 99;
    const k = new Enemy("kitsune", 220, 120);
    k.spawn = 0;
    k.hp = k.maxHp = 40;
    k.aiTimer = 0.001;
    g.enemies = [keeper, k];
    p.x = 100;
    p.y = 120;
    p.fx = 1;
    p.fy = 0;
    tick(g, KITSUNE_WINDUP + 0.05);
    const mine = g.shots.filter((s) => s.owner === k);
    expect(mine).toHaveLength(KITSUNE_SHOTS);
    for (const s of mine) expect(s.blue).toBe(true);
    // kitsune ortiq qimirlamasin; o'rtadagi shar parry paytida aynan tegadi
    k.update = () => {};
    g.shots = [{ ...mine[1]!, x: p.x + 8, y: p.y, vx: -95, vy: 0 }];
    g.input.pressAttack();
    g.update(DT);
    const back = g.bolts.find((b) => b.reflect);
    expect(back?.reflect).toBe("blue");
    tick(g, 1.5);
    expect(p.hp).toBe(p.maxHp);
    expect(k.hp).toBe(40 - REFLECT_MUL * p.damage);
  });
});

describe("Oni: ikki fazali boss", () => {
  it("has two phases: the mask cracks at half HP; a big hit stops at the phase line", () => {
    const o = freshOni(100);
    expect(o.phaseMarks).toEqual([ONI_PHASE2_AT]);
    expect(o.cracked).toBe(false);
    o.takeDamage(80);
    expect(o.hp).toBe(50);
    const tg = target(160, 200);
    runBoss(o, tg, DT);
    expect(o.phase).toBe(2);
    expect(o.cracked).toBe(true);
    expect(o.invulnerable).toBe(true);
    o.guard = 0;
    o.takeDamage(45);
    runBoss(o, tg, DT);
    // uchinchi faza yo'q
    expect(o.phase).toBe(2);
  });

  it("ground slam: red circle for the wind-up, a hit inside, then a wave that hits once", () => {
    const near = target(160, 104);
    const o = freshOni();
    o.cd = 0.001;
    runBoss(o, near, DT);
    expect(o.attack?.kind).toBe("slam");
    expect(o.justWarned).toBe(true);
    runBoss(o, near, ONI_SLAM_WINDUP - 0.05);
    expect(near.hits).toHaveLength(0);
    runBoss(o, near, 0.07);
    expect(near.hits).toHaveLength(1);
    expect(o.wave).not.toBeNull();

    // uzoqdagi o'yinchi: zarba tegmaydi, to'lqin yetib kelganda bir marta tegadi
    const far = target(160, 176);
    const o2 = freshOni();
    o2.cd = 0.001;
    runBoss(o2, far, ONI_SLAM_WINDUP + 0.02);
    expect(far.hits).toHaveLength(0);
    const w = o2.wave!;
    const d = Math.hypot(far.t.x - w.x, far.t.y - w.y);
    expect(d).toBeGreaterThan(ONI_SLAM_R + 6);
    runBoss(o2, far, (d - ONI_SLAM_R) / ONI_WAVE_SPEED + 0.1);
    expect(far.hits).toHaveLength(1);
    runBoss(o2, far, 1);
    expect(far.hits).toHaveLength(1);
  });

  it("wide sweep: hits along its lane only — a side step dodges it", () => {
    const tg = target(160, 170);
    const o = freshOni();
    o.turn = 1;
    o.cd = 0.001;
    runBoss(o, tg, DT);
    expect(o.attack?.kind).toBe("sweep");
    runBoss(o, tg, ONI_SWEEP_WINDUP + 0.05);
    expect(tg.hits).toHaveLength(1);

    const side = target(160, 170);
    const o2 = freshOni();
    o2.turn = 1;
    o2.cd = 0.001;
    runBoss(o2, side, DT);
    side.t.x += 50;
    runBoss(o2, side, ONI_SWEEP_WINDUP + 0.05);
    expect(side.hits).toHaveLength(0);
  });

  it("phase 2: a three-hit combo; each hit can be parried — the last one staggers Oni", () => {
    const tg = target(160, 110);
    const o = freshOni();
    phase2(o, tg);
    o.cd = 0.001;
    tg.t.dodge = true;
    const parried: boolean[] = [];
    let seen = 0;
    runBoss(o, tg, DT);
    expect(o.attack?.kind).toBe("combo");
    runBoss(o, tg, 2.5, () => {
      // Game parry'ni shu kadrning oxirida hal qiladi (resolveSamurai)
      if (tg.hits.length > seen) {
        seen = tg.hits.length;
        parried.push(o.parried());
      }
    });
    expect(tg.hits).toHaveLength(3);
    expect(parried).toEqual([false, false, true]);
    // kombo o'rtasida qaytarilsa keyingi zarba biroz kechikadi
    const gap = tg.hits[1]!.t - tg.hits[0]!.t;
    expect(gap).toBeGreaterThan(ONI_COMBO_WINDUP[1] + ONI_RECOIL - 0.03);
    expect(gap).toBeLessThan(ONI_COMBO_WINDUP[1] + ONI_RECOIL + 0.05);
  });

  it("the stagger after a parried final hit leaves Oni open; it does not attack meanwhile", () => {
    const tg = target(160, 110);
    const o = freshOni();
    o.cd = 0.001;
    runBoss(o, tg, ONI_SLAM_WINDUP + 0.05);
    expect(tg.hits).toHaveLength(1);
    expect(o.parried()).toBe(true);
    expect(o.stagger).toBeCloseTo(ONI_STAGGER, 5);
    const before = tg.hits.length;
    runBoss(o, tg, ONI_STAGGER - 0.05);
    expect(o.attack).toBeNull();
    expect(tg.hits).toHaveLength(before);
    // ikkinchi marta qaytarib bo'lmaydi (zarba allaqachon qaytarilgan)
    expect(o.parried()).toBe(false);
  });

  it("phase 2: fire ring — first the outer ring burns, then the inner circle; far away is safe", () => {
    const at = (dist: number) => {
      const tg = target(160 + dist, 80);
      const o = freshOni();
      phase2(o, tg);
      o.turn = 2;
      o.cd = 0.001;
      runBoss(o, tg, DT);
      expect(o.attack?.kind).toBe("ring");
      runBoss(o, tg, ONI_RING_WARN + ONI_RING_GAP + 0.1);
      return { tg, o };
    };
    const mid = at((ONI_RING_IN + ONI_RING_OUT) / 2);
    expect(mid.tg.hits).toHaveLength(1);
    expect(mid.tg.hits[0]!.t).toBeLessThan(ONI_RING_WARN + 0.1);
    const close = at(ONI_RING_IN / 2);
    expect(close.tg.hits).toHaveLength(1);
    expect(close.tg.hits[0]!.t).toBeGreaterThan(ONI_RING_WARN + ONI_RING_GAP - 0.05);
    const far = at(ONI_RING_OUT + 20);
    expect(far.tg.hits).toHaveLength(0);
    // olov — gurzi emas: qaytarish Onini gandiraklatmaydi
    expect(mid.o.parried()).toBe(false);
  });

  it("all warnings (slam, sweep, combo, fire ring) use the danger colours", () => {
    const moves: [number, boolean, number][] = [
      [0, false, 0.4],
      [1, false, 0.4],
      [0, true, 0.2],
      [2, true, 0.5],
      [2, true, ONI_RING_WARN + 0.2],
    ];
    for (const [turn, two, wait] of moves) {
      const tg = target(160, 110);
      const o = freshOni();
      if (two) phase2(o, tg);
      o.turn = turn;
      o.cd = 0.001;
      runBoss(o, tg, wait);
      const { ctx, colors } = recorder();
      o.renderFloor(ctx, 0.3);
      expect(colors.length).toBeGreaterThan(0);
      for (const c of colors) expect(isDanger(c), c).toBe(true);
    }
    for (const id of ["oniSlam", "oniSweep", "oniRing", "ninjaSlash", "tenguMark", "foxFire"])
      expect(DANGER).toHaveProperty(id);
  });

  it("the ninja's strike ring and the tengu's mark are danger colours too", () => {
    const tg = target(160, 120);
    const n = new Enemy("ninja", 60, 120);
    n.spawn = 0;
    n.ninjaPhase = "vanish";
    n.aiTimer = 0.001;
    runEnemy(n, tg, 0.1);
    const t = new Enemy("tengu", 100, 60);
    t.spawn = 0;
    t.aiTimer = 0.001;
    runEnemy(t, tg, 0.1);
    for (const e of [n, t]) {
      const { ctx, colors } = recorder();
      e.renderFloor(ctx);
      const warn = colors.filter((c) => !c.startsWith("rgba(0,0,0"));
      expect(warn.length).toBeGreaterThan(0);
      for (const c of warn) expect(isDanger(c), c).toBe(true);
    }
  });
});

describe("Sakura bog'i: ko'rinish", () => {
  it("falling petals are fewer with 'Effektlarni kamaytirish'", () => {
    const { g } = makeGame("knight", 4);
    g.fx.reduced = false;
    expect(g.petalCount()).toBe(PETALS);
    g.fx.reduced = true;
    expect(g.petalCount()).toBe(PETALS_REDUCED);
    expect(PETALS_REDUCED).toBeLessThan(PETALS / 2);
  });

  it("every new sprite is code-drawn with 5 colours; frames really move", () => {
    const counts: Record<AnimState, number> = { idle: 2, walk: 4, attack: 3, hurt: 1, death: 3 };
    for (const kind of ["ninja", "tengu", "kitsune", "oni"] as const) {
      const n = spriteGrid(kind);
      for (const [state, frames] of Object.entries(counts) as [AnimState, number][]) {
        const seen = new Set<string>();
        for (let f = 0; f < frames; f++) {
          const px = spritePixels(kind, state, f);
          expect(px.length).toBe(n * n);
          const used = new Set(px);
          used.delete(0);
          expect(used.size).toBeGreaterThan(1);
          for (const c of used) expect(c).toBeLessThanOrEqual(5);
          seen.add(px.join(""));
        }
        if (state === "walk" || state === "attack") expect(seen.size).toBe(frames);
      }
    }
    // Oni: 2-fazada niqob yoriladi (alohida kadrlar)
    expect(spritePixels("oni", "idle", 0, true).join("")).not.toBe(
      spritePixels("oni", "idle", 0).join(""),
    );
  });

  it("Oni looks bigger than the other bosses, but its collision size stays moderate", () => {
    expect(spriteSize("oni")).toBeGreaterThan(spriteSize("king"));
    expect(new Oni().size).toBeLessThan(spriteSize("oni") / 2);
  });
});
