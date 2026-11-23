import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOSS_DEATH,
  BOSS_DEATH_ACCENT,
  GOLD,
  HEART,
  PFX_MAX,
  PFX_MAX_REDUCED,
  PHASE_BOLT,
  PHASE_SPARK,
  PORTAL,
  PixelFx,
  heroPalette,
  ramp,
  spriteActor,
} from "./pixelFx";
import { Enemy, ENEMY_SPRITE } from "./enemy";
import { Game } from "./game";
import { dangerDistance } from "./danger";
import { SKINS } from "./skins";
import { spriteSize } from "./sprites";

type GameInternals = { damageTarget(t: unknown, dmg: number): void };

function makeGame() {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement);
  return { g, gi: g as unknown as GameInternals };
}

/** drawImage / putImageData sanaydigan soxta canvas konteksti */
function countingCtx() {
  const calls = { draw: 0, put: 0 };
  const ctx = {
    drawImage: () => calls.draw++,
    putImageData: () => calls.put++,
    createImageData: (w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    }),
  };
  return { calls, ctx: ctx as unknown as CanvasRenderingContext2D };
}

let shared = countingCtx();
beforeEach(() => {
  localStorage.clear();
  shared = countingCtx();
  const { ctx } = shared;
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag !== "canvas") throw new Error(tag);
    return { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
  }) as typeof document.createElement);
});
afterEach(() => vi.restoreAllMocks());

const ALL_SKINS = Object.values(SKINS).flat();
const theme = ALL_SKINS[0]!.theme;

describe("pixelfx effektlari", () => {
  it("does nothing on an empty frame (no buffer work, no drawing)", () => {
    const pfx = new PixelFx();
    const { calls, ctx } = countingCtx();
    pfx.update(1 / 60);
    pfx.renderGround(ctx);
    pfx.renderAir(ctx);
    expect(calls).toEqual({ draw: 0, put: 0 });
  });

  it("rebuilds the buffer only on frames the effect was updated", () => {
    const pfx = new PixelFx();
    const { calls, ctx } = shared;
    pfx.hit(100, 100, 0, false, theme, false);
    pfx.update(1 / 60);
    pfx.renderAir(ctx);
    pfx.renderAir(ctx); // pauza: yangilanmadi — faqat drawImage
    expect(calls.put).toBe(1);
    expect(calls.draw).toBe(2);
    pfx.update(1 / 60);
    pfx.renderAir(ctx);
    expect(calls.put).toBe(2);
  });

  it("finishes and frees its effects", () => {
    const pfx = new PixelFx();
    pfx.hit(100, 100, 0, true, theme, false);
    pfx.pickup("coin", 50, 50, false);
    expect(pfx.active).toBe(true);
    for (let i = 0; i < 400; i++) pfx.update(1 / 60);
    expect(pfx.active).toBe(false);
  });

  it("caps how many effects run at once; reduced mode runs fewer and no plain hit sparks", () => {
    const pfx = new PixelFx();
    for (let i = 0; i < 30; i++) pfx.hit(10 * i, 100, 0, false, theme, false);
    expect(pfx.lives.filter((l) => l.kind === "hit").length).toBeLessThanOrEqual(3);
    for (let i = 0; i < 30; i++)
      pfx.death("poof", "slime", false, 10 * i, 100, "#5bc85b", 1, false);
    pfx.bossDeath(160, 100, false);
    expect(pfx.lives.length).toBeLessThanOrEqual(PFX_MAX);
    // boss effekti joy bo'lmasa ham chiqadi
    expect(pfx.lives.some((l) => l.kind === "bossDeath")).toBe(true);

    const low = new PixelFx();
    low.hit(100, 100, 0, false, theme, true);
    expect(low.active).toBe(false);
    for (let i = 0; i < 30; i++) low.death("poof", "slime", false, 10 * i, 100, "#5bc85b", 1, true);
    low.hit(100, 100, 0, true, theme, true);
    low.pickup("coin", 50, 50, true);
    expect(low.lives.length).toBeLessThanOrEqual(PFX_MAX_REDUCED);
  });

  it("never uses Math.random (game randomness stays untouched)", () => {
    const spy = vi.spyOn(Math, "random");
    const pfx = new PixelFx();
    pfx.hit(100, 100, 0.3, true, theme, false);
    pfx.death("shatter", "golem", true, 100, 100, "#f4f9ff", -1, false);
    pfx.death("soul", "bat", false, 140, 100, "#8a4fc0", 1, false);
    pfx.death("poof", "slime", false, 60, 100, "#5bc85b", 1, false);
    for (let i = 0; i < 30; i++) pfx.update(1 / 60);
    pfx.renderAir(countingCtx().ctx);
    expect(spy).not.toHaveBeenCalled();
  });

  it("builds a dying mob's body from its own sprite, at its drawn size", () => {
    const a = spriteActor("golem", false)!;
    expect(a).not.toBeNull();
    expect(a.actor.mask.w).toBe(spriteSize("golem"));
    expect(a.actor.pixels.filter(Boolean).length).toBeGreaterThan(50);
    // oyog'i sprayt markazidan pastda
    expect(a.feet).toBeGreaterThan(0);
    // teskari yo'nalish — ko'zgudagi aksi
    const b = spriteActor("golem", true)!;
    const w = a.actor.mask.w;
    expect(b.actor.mask.data[w - 1 - 3]).toBe(a.actor.mask.data[3]);
  });

  it("the fly-back on death is visual only: the enemy's real position never changes", () => {
    const pfx = new PixelFx();
    const e = new Enemy("golem", 120, 90);
    const before = { x: e.x, y: e.y, vx: e.vx, vy: e.vy };
    pfx.death("shatter", ENEMY_SPRITE[e.kind], e.facingLeft, e.x, e.spriteY, "#f4f9ff", 1, false);
    for (let i = 0; i < 120; i++) pfx.update(1 / 60);
    pfx.renderAir(countingCtx().ctx);
    expect({ x: e.x, y: e.y, vx: e.vx, vy: e.vy }).toEqual(before);
  });

  it("a kill in the game starts the death effect without moving the body", () => {
    const { g, gi } = makeGame();
    const e = new Enemy("rammer", 140, 100);
    e.hp = 1;
    g.enemies = [e];
    const spy = vi.spyOn(g.pfx, "death");
    gi.damageTarget(e, 3);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toBe("shatter");
    // effekt dushmanning o'sha paytdagi joyini oladi — koordinatani o'zi yozmaydi
    expect(spy.mock.calls[0]![3]).toBe(e.x);
    const x = e.x,
      y = e.y;
    g.pfx.update(0.5);
    expect([e.x, e.y]).toEqual([x, y]);
  });

  it("hero effects take the skin's colors; the rest stay clear of the danger colors", () => {
    for (const s of ALL_SKINS) expect(heroPalette(s.theme)).toContain(s.theme.spark);
    const game = [GOLD, HEART, PORTAL, PHASE_BOLT, PHASE_SPARK, BOSS_DEATH, BOSS_DEATH_ACCENT];
    for (const pal of game) for (const c of pal) expect(dangerDistance(c), c).toBeGreaterThan(40);
    expect(ramp("#5bc85b", 8)).toHaveLength(8);
  });
});
