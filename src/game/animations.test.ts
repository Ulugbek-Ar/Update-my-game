import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import golden from "./golden-numbers.json";
import { goldenNumbers } from "./golden";
import { Animator } from "./animation";
import { Effects } from "./effects";
import { Enemy, type EnemyKind } from "./enemy";
import { Game } from "./game";
import { INTRO_TIME, PHASE_GUARD } from "./bossPower";
import {
  FLYING_KINDS,
  MOB_HURT_SQUASH,
  introFrame,
  mobScale,
  phasePulse,
  riseShare,
} from "./mobAnim";
import { loadSettings, saveSettings } from "./settings";
import {
  CHEST_RAYS,
  CHEST_RAY_TIME,
  CRIT_SPARK_LIFE,
  CombatFx,
  FLY_TIME,
  MAX_FLYERS,
  MAX_SPARKS,
  SPARK_LIFE,
  chestPop,
  flyerPos,
  renderChestRays,
} from "./combatFx";
import { setCritSource } from "./crit";
import {
  BANNER_SLIDE,
  CARD_FLIP,
  CARD_STAGGER,
  HEART_BREAK,
  HEART_SHAKE,
  HudFx,
  PICK_TIME,
  cardFlip,
  cardGlow,
  cardsShownAt,
  framePoint,
} from "./hudFx";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BOSS_WAVE, type World } from "./waves";
import {
  AMBIENCE_MAX,
  ambienceSet,
  ambienceTotal,
  renderAirAmbience,
  renderGroundAmbience,
} from "./ambience";
import { HEROES, type Hero } from "./hero";
import {
  HURT_SQUASH,
  HURT_SQUASH_TIME,
  HeroVisual,
  TURN_SQUASH,
  TURN_TIME,
  heroScale,
  subFrame,
} from "./heroAnim";
import { Player } from "./player";
import {
  DISSOLVE_GONE,
  dissolvePixel,
  spriteGrid,
  spritePixels,
  visualFrames,
  type SpriteKind,
} from "./sprites";
import type { Input } from "./input";

const DT = 1 / 60;
/** Oraliq kadrli qahramonlar (Samuray o'z kadrlariga ega) */
const SMOOTH: readonly Hero[] = ["knight", "mage", "hunter", "gunner", "paladin"];

function keys(o: Partial<{ attack: boolean; held: boolean; dash: boolean; x: number; y: number }>) {
  return {
    consumeAttack: () => !!o.attack,
    consumeDash: () => !!o.dash,
    attackHeld: () => !!o.held,
    dashHeld: () => false,
    axis: () => ({ x: o.x ?? 0, y: o.y ?? 0 }),
  } as unknown as Input;
}

const flat = (o: object) => {
  const r: Record<string, number | boolean> = {};
  for (const [k, v] of Object.entries(o))
    if (typeof v === "number" || typeof v === "boolean") r[k] = v;
  return r;
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("v3.8 animatsiyalar: o'yin raqamlari o'zgarmagan", () => {
  it("every hero, mob and boss keeps its numbers and frame timings (snapshot from before the animations)", () => {
    // hujum vaqti, tezlik, dash, daxlsizlik, cooldown, to'qnashuv o'lchami, kadr soni va vaqti
    expect(JSON.parse(JSON.stringify(goldenNumbers()))).toEqual(golden);
  });

  it("the visual layer never feeds back into the simulation", () => {
    for (const hero of HEROES) {
      const run = (visual: boolean) => {
        const p = new Player(hero);
        if (!visual) p.vis.update = () => {};
        // yurish, burilishlar, hujum, dash, kuchli zarba — bir xil ssenariy
        for (let i = 0; i < 400; i++) {
          const x = i % 80 < 40 ? 1 : -1;
          p.update(
            DT,
            keys({ x, y: i % 120 < 60 ? 0.5 : -0.5, attack: i % 45 === 0, dash: i % 130 === 7 }),
          );
        }
        return flat(p);
      };
      expect(run(true), hero).toEqual(run(false));
    }
  });
});

describe("Qahramonlar: oraliq kadrlar va ikkilamchi harakat", () => {
  it("idle and walk show twice as many frames; attack, hurt and death keep theirs", () => {
    for (const h of SMOOTH) {
      expect(visualFrames(h, "idle", 2)).toBe(4);
      expect(visualFrames(h, "walk", 4)).toBe(8);
      expect(visualFrames(h, "attack", 3)).toBe(3);
      expect(visualFrames(h, "death", 3)).toBe(3);
    }
    // Samuray va dushmanlar o'z kadrlarida qoladi
    expect(visualFrames("samurai", "walk", 6)).toBe(6);
    expect(visualFrames("skeleton", "walk", 4)).toBe(4);
  });

  it("the in-between walk frames are really new drawings", () => {
    for (const h of SMOOTH) {
      const seen = new Set<string>();
      for (let f = 0; f < 4; f++)
        for (const sub of [0, 1]) seen.add(spritePixels(h, "walk", f, false, sub).join(""));
      expect(seen.size, h).toBe(8);
      const idle = new Set<string>();
      for (let f = 0; f < 2; f++)
        for (const sub of [0, 1]) idle.add(spritePixels(h, "idle", f, false, sub).join(""));
      expect(idle.size, h).toBeGreaterThanOrEqual(3);
    }
  });

  it("attack, hurt and death frames ignore the in-between flag (hit frames stay as they were)", () => {
    for (const h of SMOOTH)
      for (const [state, n] of [
        ["attack", 3],
        ["hurt", 1],
        ["death", 3],
      ] as const)
        for (let f = 0; f < n; f++)
          expect(spritePixels(h, state, f, false, 1).join(""), `${h} ${state} ${f}`).toBe(
            spritePixels(h, state, f).join(""),
          );
    // boshqa personajlarda ham ta'sir yo'q
    for (const k of ["samurai", "skeleton", "slime", "demon"] as SpriteKind[])
      expect(spritePixels(k, "walk", 1, false, 1).join("")).toBe(
        spritePixels(k, "walk", 1).join(""),
      );
  });

  it("more frames, same total duration: the sub-frame flips at half of each Animator frame", () => {
    for (const hero of SMOOTH) {
      const p = new Player(hero);
      const def = p.anim.defs.walk;
      p.anim.set("walk");
      const seen: string[] = [];
      let loop = 0;
      const step = def.frameTime / 20;
      for (let t = 0; t < def.frames * def.frameTime - 1e-9; t += step) {
        const key = `${p.anim.frame}:${subFrame(p.anim)}`;
        if (seen.at(-1) !== key) seen.push(key);
        p.anim.update(step);
        loop += step;
      }
      expect(seen, hero).toEqual(["0:0", "0:1", "1:0", "1:1", "2:0", "2:1", "3:0", "3:1"]);
      // aylana davomiyligi — Animator jadvalidagidek (etalon bilan bir xil)
      expect(loop).toBeCloseTo(def.frames * def.frameTime, 5);
      // hujumda oraliq kadr yo'q
      p.anim.set("attack");
      p.anim.update(p.anim.defs.attack.frameTime * 0.8);
      expect(subFrame(p.anim)).toBe(0);
    }
  });

  it("turning squeezes the sprite for a moment; a hit squashes it; nothing else scales", () => {
    const v = new HeroVisual();
    const a = new Animator(new Player("knight").anim.defs);
    v.update(DT, 1, a);
    expect(v.turnScale).toBe(1);
    v.update(DT, -1, a);
    expect(v.turnT).toBeCloseTo(TURN_TIME, 5);
    v.update(TURN_TIME / 2, -1, a);
    expect(heroScale(v, a)[0]).toBeCloseTo(TURN_SQUASH, 1);
    expect(heroScale(v, a)[1]).toBe(1);
    v.update(TURN_TIME, -1, a);
    expect(heroScale(v, a)).toEqual([1, 1]);
    // hujum paytida burilish ko'rinmaydi (zarba kadri buzilmaydi)
    v.update(DT, 1, a);
    a.set("attack");
    expect(heroScale(v, a)).toEqual([1, 1]);
    a.set("hurt");
    expect(heroScale(v, a)).toEqual([HURT_SQUASH.x, HURT_SQUASH.y]);
    a.update(HURT_SQUASH_TIME + 0.01);
    expect(heroScale(v, a)).toEqual([1, 1]);
  });

  it("a walking hero plants a foot twice per cycle — that is when the dust appears", () => {
    const p = new Player("knight");
    let steps = 0;
    const cycle = p.anim.defs.walk.frames * p.anim.defs.walk.frameTime;
    for (let t = 0; t < cycle * 3 - 1e-9; t += DT) {
      p.update(DT, keys({ x: 1 }));
      if (p.vis.step) {
        steps++;
        p.vis.step = false;
      }
    }
    expect(steps).toBeGreaterThanOrEqual(5);
    expect(steps).toBeLessThanOrEqual(7);
    // turganda chang yo'q
    for (let t = 0; t < 1; t += DT) p.update(DT, keys({}));
    expect(p.vis.step).toBe(false);
  });

  it("step dust is tiny, uses no game randomness and is skipped with 'Effektlarni kamaytirish'", () => {
    const fx = new Effects();
    fx.reduced = false;
    const rnd = vi.spyOn(Math, "random");
    fx.dust(100, 100, "#8d819f");
    expect(rnd).not.toHaveBeenCalled();
    expect(fx.particles).toHaveLength(2);
    for (const d of fx.particles) expect(d.size).toBe(1);
    const low = new Effects();
    low.reduced = true;
    low.dust(100, 100, "#8d819f");
    expect(low.particles).toHaveLength(0);
  });
});

describe("Dushmanlar va bosslar: squash & stretch, paydo bo'lish, kirish sahnasi", () => {
  const mob = (kind: EnemyKind) => {
    const e = new Enemy(kind, 100, 100);
    e.spawn = 0;
    return e;
  };

  it("a hit squashes the mob and it springs back; the dead and the spawning are left alone", () => {
    const e = mob("rammer");
    e.anim.set("hurt", true);
    const [sx, sy] = mobScale(e);
    expect(sx).toBeGreaterThan(1.1);
    expect(sy).toBeLessThan(0.9);
    e.anim.t = MOB_HURT_SQUASH;
    expect(mobScale(e)).toEqual([1, 1]);
    e.anim.set("death", true);
    expect(mobScale(e)).toEqual([1, 1]);
    const s = new Enemy("blob", 0, 0);
    s.spawn = 0.5;
    expect(mobScale(s)).toEqual([1, 1]);
  });

  it("slimes stretch while hopping up and squash on landing; others breathe by about a pixel", () => {
    const b = mob("blob");
    b.t = Math.PI / 10; // sin(t * 5) = 1 — sakrash cho'qqisi
    expect(mobScale(b)[1]).toBeGreaterThan(1.1);
    b.t = (3 * Math.PI) / 10; // sin = -1 — qo'nish
    expect(mobScale(b)[1]).toBeLessThan(0.95);
    expect(mobScale(b)[0]).toBeGreaterThan(1.05);
    for (const kind of ["archer", "wolf", "ninja", "kitsune", "treant"] as EnemyKind[]) {
      const e = mob(kind);
      for (let t = 0; t < 4; t += 0.1) {
        e.t = t;
        const [x, y] = mobScale(e);
        expect(Math.abs(x - 1)).toBeLessThanOrEqual(0.021);
        expect(Math.abs(y - 1)).toBeLessThanOrEqual(0.036);
      }
    }
  });

  it("attack frames: squeeze on the wind-up, stretch on the strike", () => {
    const e = mob("rammer");
    e.anim.set("attack", true);
    e.anim.frame = 0;
    expect(mobScale(e)[1]).toBeLessThan(1);
    e.anim.frame = 1;
    expect(mobScale(e)[1]).toBeGreaterThan(1);
  });

  it("spawning: ground mobs rise out of the floor, flying ones come out of smoke — timing untouched", () => {
    expect(riseShare(0)).toBe(0);
    expect(riseShare(1)).toBe(1);
    let last = -1;
    for (let k = 0; k <= 1.0001; k += 0.05) {
      const v = riseShare(k);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    expect(FLYING_KINDS.has("wisp")).toBe(true);
    expect(FLYING_KINDS.has("tengu")).toBe(true);
    expect(FLYING_KINDS.has("rammer")).toBe(false);
    // paydo bo'lish vaqti va daxlsizligi avvalgidek
    const e = new Enemy("rammer", 100, 100);
    e.spawn = e.spawnMax = 1;
    const p = new Player("knight");
    for (let t = 0; t < 0.5; t += DT) e.update(DT, p);
    expect(e.active).toBe(false);
    for (let t = 0; t < 0.55; t += DT) e.update(DT, p);
    expect(e.active).toBe(true);
  });

  it("draws the squash/rise only when effects are not reduced", () => {
    const calls = (reduce: boolean, prep: (e: Enemy) => void) => {
      saveSettings({ ...loadSettings(), reduceFx: reduce });
      const seen: string[] = [];
      const ctx = new Proxy(
        {},
        {
          get:
            (_t, k) =>
            (...args: unknown[]) => {
              if (k === "scale" || k === "clip") seen.push(`${String(k)}:${args.join(",")}`);
            },
          set: () => true,
        },
      ) as unknown as CanvasRenderingContext2D;
      const e = new Enemy("rammer", 100, 100);
      prep(e);
      e.render(ctx);
      return seen;
    };
    const hurt = (e: Enemy) => {
      e.spawn = 0;
      e.anim.set("hurt", true);
    };
    const rising = (e: Enemy) => {
      e.spawn = 0.5;
      e.spawnMax = 1;
    };
    expect(calls(false, hurt).some((c) => c.startsWith("scale:"))).toBe(true);
    expect(calls(false, rising)).toContain("clip:");
    expect(calls(true, hurt)).toEqual([]);
    expect(calls(true, rising)).toEqual([]);
  });

  it("boss intro: the boss shows its strike in the second half of the entrance", () => {
    // oddiy (qisqa) paydo bo'lishda — yo'q
    expect(introFrame(0.5, 1)).toBeNull();
    const total = INTRO_TIME + 0.4;
    expect(introFrame(total, total)).toBeNull();
    expect(introFrame(total * 0.6, total)).toBeNull();
    const frames = new Set<number>();
    for (let s = total * 0.5; s > 0; s -= 0.02) {
      const f = introFrame(s, total);
      if (f !== null) frames.add(f);
    }
    expect([...frames].sort()).toEqual([0, 1, 2]);
    expect(introFrame(0, total)).toBeNull();
  });

  it("the intro still lasts INTRO_TIME, can be skipped, and the boss stays untouchable during it", () => {
    const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
    const g = new Game(canvas as unknown as HTMLCanvasElement, "knight");
    (g as unknown as { startWave(i: number): void }).startWave(BOSS_WAVE);
    expect(g.intro).toBe(INTRO_TIME);
    const boss = g.boss!;
    const hp = boss.hp;
    let t = 0;
    while (g.intro > 0 && t < 10) {
      g.update(DT);
      t += DT;
    }
    expect(t).toBeGreaterThan(INTRO_TIME - 0.1);
    expect(t).toBeLessThan(INTRO_TIME + 0.1);
    expect(boss.hp).toBe(hp);
    expect(boss.active).toBe(false);
    // o'tkazib yuborish
    const g2 = new Game(canvas as unknown as HTMLCanvasElement, "knight");
    (g2 as unknown as { startWave(i: number): void }).startWave(BOSS_WAVE);
    g2.skipIntro();
    expect(g2.intro).toBe(0);
    expect(g2.boss!.spawn).toBeLessThanOrEqual(0.3);
  });

  it("phase change: a short fading pulse while the boss is invulnerable, nothing afterwards", () => {
    expect(phasePulse(0, PHASE_GUARD)).toEqual([1, 1]);
    let max = 1;
    for (let gd = PHASE_GUARD; gd > 0; gd -= 0.02) {
      const [x, y] = phasePulse(gd, PHASE_GUARD);
      expect(x).toBe(y);
      expect(x).toBeGreaterThanOrEqual(1);
      max = Math.max(max, x);
    }
    expect(max).toBeGreaterThan(1.04);
    expect(max).toBeLessThanOrEqual(1.12);
  });
});

describe("Muhit: animatsiya qatlami", () => {
  /** Chizilgan to'rtburchaklarni sanaydigan kanvas */
  const counter = () => {
    const rects: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get: (_t, k) =>
          k === "createRadialGradient" || k === "createLinearGradient"
            ? () => ({ addColorStop() {} })
            : (...args: number[]) => {
                if (k === "fillRect") rects.push(args.join(","));
              },
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D;
    return { ctx, rects };
  };

  it("every world has its own atmosphere, within a fixed particle budget", () => {
    for (const w of [1, 2, 3, 4] as World[])
      for (const boss of [false, true]) {
        const s = ambienceSet(w, boss, false);
        expect(ambienceTotal(s)).toBeGreaterThan(0);
        expect(ambienceTotal(s)).toBeLessThanOrEqual(AMBIENCE_MAX);
      }
    expect(ambienceSet(1, false, false).embers).toBeGreaterThan(0);
    expect(ambienceSet(2, false, false).glints).toBeGreaterThan(0);
    expect(ambienceSet(3, false, false).leaves).toBeGreaterThan(0);
    expect(ambienceSet(3, false, false).grass).toBeGreaterThan(0);
    expect(ambienceSet(4, false, false).grass).toBeGreaterThan(0);
  });

  it("'Effektlarni kamaytirish' cuts it to a third and drops the dust motes", () => {
    for (const w of [1, 2, 3, 4] as World[]) {
      const full = ambienceSet(w, false, false),
        low = ambienceSet(w, false, true);
      expect(low.motes).toBe(0);
      expect(ambienceTotal(low)).toBeLessThanOrEqual(Math.ceil(ambienceTotal(full) / 2));
    }
  });

  it("is stateless and uses no game randomness: the same time draws the same picture", () => {
    const rnd = vi.spyOn(Math, "random");
    for (const w of [1, 2, 3, 4] as World[]) {
      const a = counter(),
        b = counter(),
        later = counter();
      for (const k of [a, b]) {
        renderGroundAmbience(k.ctx, w, 12.5, false, false);
        renderAirAmbience(k.ctx, w, 12.5, false, false);
      }
      renderGroundAmbience(later.ctx, w, 13.1, false, false);
      renderAirAmbience(later.ctx, w, 13.1, false, false);
      expect(a.rects.length).toBeGreaterThan(0);
      expect(a.rects).toEqual(b.rects);
      // vaqt o'tishi bilan harakatlanadi
      expect(later.rects).not.toEqual(a.rects);
    }
    expect(rnd).not.toHaveBeenCalled();
  });
});

describe("Jang hissi: uchqun, kritik chaqnashi, HUD'ga uchish, sandiq", () => {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const makeGame = (hero: Hero = "knight") => {
    const g = new Game(canvas as unknown as HTMLCanvasElement, hero);
    g.hints = [];
    const keeper = new Enemy("blob", 290, 30);
    keeper.spawn = keeper.spawnMax = 99;
    g.enemies = [keeper];
    g.fx.reduced = false;
    return g;
  };

  it("hit sparks: a small white one, a bigger longer golden one for crits — capped, no randomness", () => {
    const rnd = vi.spyOn(Math, "random");
    const fx = new CombatFx();
    fx.spark(10, 10, false, false);
    fx.spark(20, 10, true, false);
    expect(fx.sparks.map((s) => s.life)).toEqual([SPARK_LIFE, CRIT_SPARK_LIFE]);
    expect(CRIT_SPARK_LIFE).toBeGreaterThan(SPARK_LIFE);
    for (let i = 0; i < 40; i++) fx.spark(i, 0, false, false);
    expect(fx.sparks).toHaveLength(MAX_SPARKS);
    fx.update(CRIT_SPARK_LIFE + 0.01);
    expect(fx.sparks).toHaveLength(0);
    // effektlar kamaytirilganda: faqat kritik
    fx.spark(1, 1, false, true);
    expect(fx.sparks).toHaveLength(0);
    fx.spark(1, 1, true, true);
    expect(fx.sparks).toHaveLength(1);
    expect(rnd).not.toHaveBeenCalled();
  });

  it("a real hit makes a spark but does not touch hit stop or screen shake", () => {
    const g = makeGame();
    const p = g.player;
    const foe = new Enemy("rammer", p.x + 14, p.y);
    foe.spawn = 0;
    foe.hp = foe.maxHp = 50;
    foe.update = () => {};
    g.enemies.push(foe);
    p.fx = 1;
    p.fy = 0;
    setCritSource(() => 1);
    g.input.pressAttack();
    let sparks = 0;
    let freeze = 0;
    for (let i = 0; i < 12; i++) {
      g.update(DT);
      g.input.endFrame();
      sparks = Math.max(sparks, g.cfx.sparks.length);
      freeze = Math.max(freeze, (g as unknown as { freeze: number }).freeze);
    }
    setCritSource(null);
    expect(foe.hp).toBeLessThan(50);
    expect(sparks).toBe(1);
    // v3.5 dan keyingi qiymat: oddiy zarbada 0.045 s dan oshmaydi
    expect(freeze).toBeLessThanOrEqual(0.045 + 1e-9);
    // modul hit stop va silkinishga umuman tegmaydi
    const src = readFileSync(path.resolve(__dirname, "combatFx.ts"), "utf8");
    expect(src).not.toMatch(/addShake|\.freeze|slowmo/);
  });

  it("a picked coin is counted at once; the flying coin only shows it and then nudges the HUD", () => {
    const g = makeGame();
    const p = g.player;
    type Coins = { coins: { x: number; y: number; life: number; value: number }[] };
    (g as unknown as Coins).coins.push({ x: p.x, y: p.y, life: 5, value: 3 });
    g.update(DT);
    expect(g.runGold).toBe(3);
    expect(g.cfx.flyers).toHaveLength(1);
    const f = g.cfx.flyers[0]!;
    expect(flyerPos({ ...f, t: 0 })).toMatchObject({ x: f.x0, y: f.y0 });
    const end = flyerPos({ ...f, t: FLY_TIME });
    expect(end.x).toBeCloseTo(f.x1, 5);
    expect(end.y).toBeCloseTo(f.y1, 5);
    for (let t = 0; t < FLY_TIME + 0.05; t += DT) g.update(DT);
    expect(g.cfx.flyers).toHaveLength(0);
    expect(g.hud.goldPop).toBeGreaterThan(0);
    expect(g.runGold).toBe(3);
    // effektlar kamaytirilganda uchuvchi belgi yo'q, oltin baribir qo'shiladi
    const low = makeGame();
    low.fx.reduced = true;
    (low as unknown as Coins).coins.push({ x: low.player.x, y: low.player.y, life: 5, value: 2 });
    low.update(DT);
    expect(low.runGold).toBe(2);
    expect(low.cfx.flyers).toHaveLength(0);
  });

  it("flyers are capped and report their arrival once", () => {
    const fx = new CombatFx();
    for (let i = 0; i < 30; i++) fx.fly("coin", i, 0, 100, 100, false);
    expect(fx.flyers).toHaveLength(MAX_FLYERS);
    fx.fly("heart", 0, 0, 5, 5, true);
    expect(fx.flyers).toHaveLength(MAX_FLYERS);
    fx.update(FLY_TIME + 0.01);
    expect(fx.arrived).toHaveLength(MAX_FLYERS);
    expect(fx.flyers).toHaveLength(0);
  });

  it("chest: a short pop and golden rays right after it opens, nothing while closed", () => {
    expect(chestPop(-1)).toEqual([1, 1]);
    expect(chestPop(0.3)).toEqual([1, 1]);
    const [sx] = chestPop(0.12);
    expect(sx).toBeGreaterThan(1.05);
    const draws = (t: number) => {
      let n = 0;
      const ctx = new Proxy(
        {},
        {
          get: (_t, k) => () => {
            if (k === "stroke") n++;
          },
          set: () => true,
        },
      ) as unknown as CanvasRenderingContext2D;
      renderChestRays(ctx, 100, 100, t);
      return n;
    };
    expect(draws(-1)).toBe(0);
    expect(draws(0.2)).toBe(CHEST_RAYS);
    expect(draws(CHEST_RAY_TIME + 0.01)).toBe(0);
  });
});

describe("HUD: yuraklar, oltin hisobi, banner, kuch kartalari", () => {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };

  it("losing a heart shakes the row and shatters that heart; the HUD only reads the numbers", () => {
    const h = new HudFx();
    h.update(DT, 5, 0);
    expect(h.shake).toBe(0);
    h.update(DT, 3, 0);
    expect(h.shake).toBeGreaterThan(0);
    expect(h.broken.map((b) => b.index)).toEqual([3, 4]);
    const [ox] = h.heartOffset(0, 0.123);
    expect(Math.abs(ox)).toBeLessThanOrEqual(2);
    for (let t = 0; t < Math.max(HEART_SHAKE, HEART_BREAK) + 0.05; t += DT) h.update(DT, 3, 0);
    expect(h.shake).toBe(0);
    expect(h.broken).toHaveLength(0);
    expect(h.heartOffset(0, 1)).toEqual([0, 0]);
    // tiklangan yurak parchalanmaydi
    h.update(DT, 4, 0);
    expect(h.broken).toHaveLength(0);
  });

  it("the gold counter rolls up to the real value within half a second", () => {
    const h = new HudFx();
    h.update(DT, 5, 0);
    h.update(DT, 5, 30);
    expect(h.gold).toBeGreaterThan(0);
    expect(h.gold).toBeLessThan(30);
    for (let t = 0; t < 0.5; t += DT) h.update(DT, 5, 30);
    expect(h.gold).toBe(30);
    // kichik farq ham tez yetadi
    h.update(DT, 5, 31);
    for (let t = 0; t < 0.1; t += DT) h.update(DT, 5, 31);
    expect(h.gold).toBe(31);
  });

  it("a new banner slides in; the same banner does not restart", () => {
    const h = new HudFx();
    h.update(DT, 5, 0, 0);
    h.update(DT, 5, 0, 2.2);
    expect(h.bannerAge).toBe(0);
    expect(h.bannerIn).toBe(0);
    let timer = 2.2;
    for (let t = 0; t < BANNER_SLIDE + 0.02; t += DT) h.update(DT, 5, 0, (timer -= DT));
    expect(h.bannerIn).toBe(1);
    h.update(DT, 5, 0, 1.6 + timer);
    expect(h.bannerAge).toBe(0);
    // sarlavha almashsa ham (taymer kichikroq bo'lsa-da) yangi banner hisoblanadi
    for (let t = 0; t < 0.3; t += DT) h.update(DT, 5, 0, 1.5, "BOSS: IBLIS");
    expect(h.bannerAge).toBeGreaterThan(0.2);
    h.update(DT, 5, 0, 1.2, "G'AZAB!");
    expect(h.bannerAge).toBe(0);
  });

  it("upgrade cards flip in one by one and are all open before the 0.6 s entry lock ends", () => {
    expect(cardFlip(0, 0)).toBe(0);
    expect(cardFlip(0, CARD_FLIP)).toBe(1);
    expect(cardFlip(2, CARD_STAGGER * 2)).toBe(0);
    expect(cardFlip(1, CARD_STAGGER + CARD_FLIP / 2)).toBeGreaterThan(0.5);
    expect(cardsShownAt(3)).toBeLessThan(0.6);
    expect(cardFlip(2, 0.6)).toBe(1);
    // qulf vaqti avvalgidek
    const g = new Game(canvas as unknown as HTMLCanvasElement, "knight", { world: 2 });
    expect((g as unknown as { upgradeLock: number }).upgradeLock).toBe(0.6);
  });

  it("card frames: hero-only cards shimmer, synergy-completing ones glow gold; the light runs the frame", () => {
    expect(cardGlow(false, false)).toBe("none");
    expect(cardGlow(true, false)).toBe("rare");
    expect(cardGlow(false, true)).toBe("legend");
    expect(cardGlow(true, true)).toBe("legend");
    const w = 92,
      h = 100;
    expect(framePoint(w, h, 0)).toEqual([0, 0]);
    expect(framePoint(w, h, w)).toEqual([w - 1, 0]);
    expect(framePoint(w, h, w + h)).toEqual([w - 1, h - 1]);
    expect(framePoint(w, h, 2 * (w + h))).toEqual([0, 0]);
    for (let d = 0; d < 2 * (w + h); d += 7) {
      const [x, y] = framePoint(w, h, d);
      expect(x === 0 || y === 0 || x === w - 1 || y === h - 1).toBe(true);
    }
  });

  it("the picked card glows and flies up, but the upgrade itself is applied at once", () => {
    for (const reduce of [false, true]) {
      const g = new Game(canvas as unknown as HTMLCanvasElement, "knight", { world: 2 });
      g.fx.reduced = reduce;
      const gi = g as unknown as { choose(i: number): void; choices: { name: string }[] };
      const name = gi.choices[1]!.name;
      gi.choose(1);
      expect(g.stage).toBe("fight");
      if (reduce) expect(g.hud.picked).toBeNull();
      else {
        expect(g.hud.picked).toMatchObject({ name, t: 0 });
        for (let t = 0; t < PICK_TIME + 0.05; t += DT) g.update(DT);
        expect(g.hud.picked).toBeNull();
      }
    }
  });
});

describe("O'lim: piksel bo'lib tarqalish", () => {
  it("each death frame loses more pixels; the pattern is fixed (no flicker), some fly upward", () => {
    for (const kind of ["knight", "slime", "oni"] as SpriteKind[]) {
      const n = spriteGrid(kind);
      const share = (frame: number) => {
        const px = spritePixels(kind, "death", frame);
        let all = 0,
          kept = 0,
          flying = 0;
        for (let y = 0; y < n; y++)
          for (let x = 0; x < n; x++) {
            if (!px[y * n + x]) continue;
            all++;
            const d = dissolvePixel(x, y, n, frame);
            expect(dissolvePixel(x, y, n, frame)).toEqual(d);
            if (d === null) kept++;
            else if (d) {
              flying++;
              // faqat yuqoriga va to'r ichida
              expect(d[1]).toBeLessThan(0);
              expect(y + d[1]).toBeGreaterThanOrEqual(1);
            }
          }
        return { gone: 1 - kept / all, flying };
      };
      expect(share(0).gone).toBe(0);
      const one = share(1),
        two = share(2);
      expect(one.gone).toBeGreaterThan(0.08);
      expect(two.gone).toBeGreaterThan(one.gone + 0.1);
      expect(two.gone).toBeLessThan(0.9);
      expect(one.flying + two.flying).toBeGreaterThan(0);
    }
    expect(DISSOLVE_GONE[0]).toBe(0);
  });
});
