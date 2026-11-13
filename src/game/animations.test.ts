import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import golden from "./golden-numbers.json";
import { goldenNumbers } from "./golden";
import { Animator } from "./animation";
import { Effects } from "./effects";
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
