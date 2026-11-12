import { describe, expect, it } from "vitest";
import {
  PALETTES,
  SAMURAI_FRAME,
  SAMURAI_FRAMES,
  SAMURAI_GRID,
  heroView,
  spriteGrid,
  spritePixels,
  spriteSize,
} from "./sprites";
import { HERO_LIST, HERO_THEME, MAX_HEROES, PALADIN_PRICE, SAMURAI_PRICE } from "./hero";
import { IAI_MIN, Player } from "./player";
import { dangerDistance } from "./danger";
import { DEFAULT_THEME, FX_SLOTS } from "./skinFx";
import type { AnimState } from "./animation";

const N = SAMURAI_GRID;
const OFF = (N - 32) / 2;
const count = (frame: Uint8Array, color: number) => frame.filter((c) => c === color).length;

/**
 * Kadrdagi rangli piksellarning eng chap va eng o'ng ustuni (tana koordinatalarida);
 * maxY — faqat shu qatordan yuqoridagilar (soch dumi: beldagi qin kirmasin).
 */
function span(frame: Uint8Array, color?: number, maxY = 99) {
  let lo = 99,
    hi = -99;
  frame.forEach((c, i) => {
    if (color ? c !== color : c < 2) return;
    if (Math.floor(i / N) - OFF >= maxY) return;
    const x = (i % N) - OFF;
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  });
  return { lo, hi };
}

describe("Samuray qiz ko'rinishi", () => {
  it("is the 6th hero, sold for 600 gold, with a sakura-pink theme", () => {
    const i = HERO_LIST.findIndex((h) => h.id === "samurai");
    expect(i).toBe(5);
    expect(HERO_LIST.length).toBeLessThanOrEqual(MAX_HEROES);
    expect(HERO_LIST[i]!.name).toBe("SAMURAY");
    expect(HERO_LIST[i]!.price).toBe(600);
    expect(SAMURAI_PRICE).toBeGreaterThan(PALADIN_PRICE);
    expect(HERO_THEME.samurai).toMatchObject({
      accent: "#ff8fb8",
      accentDark: "#b8456e",
      uiText: "#ffe3ee",
    });
    // glow va iz ham shu pushti oilada
    expect(HERO_THEME.samurai.glow).toMatch(/^#ff[c-f][0-9a-f]{3}$/);
    expect(HERO_THEME.samurai.trail).toBe("rgba(255,143,184,0.8)");
  });

  it("her effect colours stay away from the enemy danger colours", () => {
    // accentDark (#b8456e — berilgan rang) faqat HUD chizig'ida; effektlar shu slotlardan chiziladi
    const drawn = FX_SLOTS.filter((k) => k !== "accentDark" && k !== "core");
    expect(drawn.length).toBe(FX_SLOTS.length - 2);
    for (const k of drawn) expect(dangerDistance(DEFAULT_THEME.samurai[k]), k).toBeGreaterThan(100);
  });

  it("uses exactly five colours: ink, black hair, pink kimono, red obi, pale skin and steel", () => {
    const [ink, hair, kimono, obi, skin] = PALETTES.samurai;
    expect(PALETTES.samurai).toHaveLength(5);
    expect(new Set(PALETTES.samurai).size).toBe(5);
    const lum = (h: string) =>
      [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).reduce((a, b) => a + b, 0);
    expect(lum(ink!)).toBeLessThan(90);
    // qora soch: siyohdan ochroq, lekin to'q
    expect(lum(hair!)).toBeGreaterThan(lum(ink!));
    expect(lum(hair!)).toBeLessThan(200);
    expect(kimono).toBe("#ff8fb8");
    // qizil kamar: qizil kanal ustun
    expect(parseInt(obi!.slice(1, 3), 16)).toBeGreaterThan(parseInt(obi!.slice(3, 5), 16) * 3);
    expect(lum(skin!)).toBeGreaterThan(680);
  });

  for (const [state, n] of Object.entries(SAMURAI_FRAMES) as [AnimState, number][]) {
    it(`has ${n} distinct ${state} frames within five colours`, () => {
      const frames = Array.from({ length: n }, (_, f) => spritePixels("samurai", state, f));
      expect(new Set(frames.map((p) => p.join(","))).size).toBe(n);
      for (const frame of frames) {
        expect(frame.length).toBe(N * N);
        expect(Math.max(...frame)).toBeLessThanOrEqual(5);
        // tirik kadrlarda beshala rang ham bor
        if (state !== "death")
          for (let c = 1; c <= 5; c++) expect(count(frame, c), `${state}:${c}`).toBeGreaterThan(0);
        // chegarada faqat kontur yoki bo'sh — katana va soch kesilmaydi
        for (let i = 0; i < N; i++)
          for (const edge of [i, (N - 1) * N + i, i * N, i * N + N - 1])
            expect(frame[edge]).toBeLessThanOrEqual(1);
      }
    });
  }

  it("has more idle and walk frames than the other heroes, over the same total duration", () => {
    expect(SAMURAI_FRAMES).toMatchObject({ idle: 4, walk: 6, hurt: 1, death: 3 });
    const p = new Player("samurai");
    const k = new Player("knight");
    const total = (pl: Player, s: AnimState) => pl.anim.defs[s].frames * pl.anim.defs[s].frameTime;
    expect(p.anim.defs.idle.frames).toBe(4);
    expect(p.anim.defs.walk.frames).toBe(6);
    expect(total(p, "idle")).toBeCloseTo(total(k, "idle"));
    expect(total(p, "walk")).toBeCloseTo(total(k, "walk"));
    // to'qnashuv o'lchami boshqa qahramonlarniki bilan bir xil
    expect(p.size).toBe(k.size);
  });

  it("back views differ from the front in every living frame", () => {
    for (const [state, n] of Object.entries(SAMURAI_FRAMES) as [AnimState, number][]) {
      if (state === "death") continue;
      for (let f = 0; f < n; f++)
        expect(spritePixels("samurai", state, f, true).join(",")).not.toBe(
          spritePixels("samurai", state, f).join(","),
        );
    }
  });

  it("the ponytail sways while idle and streams back while running", () => {
    // soch dumi (2-rang, boshdan chapda): turganda pastga osilib chayqaladi, yugurganda
    // gorizontal uchadi — uchi ancha yuqorida qoladi
    const tailBottom = (s: AnimState, f: number) => {
      const fr = spritePixels("samurai", s, f);
      let y = -1;
      fr.forEach((c, i) => {
        const px = (i % N) - OFF,
          py = Math.floor(i / N) - OFF;
        if (c === 2 && px < 10 && py < 17) y = Math.max(y, py);
      });
      return y;
    };
    const idleX = [0, 1, 2, 3].map((f) => span(spritePixels("samurai", "idle", f), 2, 17).lo);
    expect(new Set(idleX).size).toBeGreaterThan(1);
    const idle = [0, 1, 2, 3].map((f) => tailBottom("idle", f));
    const walk = [0, 1, 2, 3, 4, 5].map((f) => tailBottom("walk", f));
    expect(Math.min(...idle)).toBeGreaterThanOrEqual(12);
    expect(Math.max(...walk)).toBeLessThan(Math.min(...idle));
  });

  it("the katana stays sheathed until she attacks; the cut frame shows a long bright blade", () => {
    const steel = (s: AnimState, f: number) => span(spritePixels("samurai", s, f), 5).hi;
    // turganda tig' yo'q: oq piksellar tanadan uzoqqa chiqmaydi
    expect(steel("idle", 0)).toBeLessThan(26);
    // kesish kadri: tig' oldinga uzoq cho'zilgan, pushti yaltirash bor
    expect(steel("attack", 1)).toBeGreaterThan(32);
    expect(count(spritePixels("samurai", "attack", 1), 3)).toBeGreaterThan(
      count(spritePixels("samurai", "attack", 0), 3),
    );
    // keng 3-zarba va IAI kesishi yanada uzoqroq
    expect(steel("attack", SAMURAI_FRAME.wide + 1)).toBeGreaterThan(steel("attack", 1));
    expect(steel("attack", SAMURAI_FRAME.iai)).toBeGreaterThan(34);
    // IAI zaryadi va dash: katana qinda
    expect(steel("attack", SAMURAI_FRAME.charge)).toBeLessThan(26);
    expect(steel("attack", SAMURAI_FRAME.dash)).toBeLessThan(26);
    // parry: katana tik — tig' boshdan yuqoriga chiqadi
    const parry = spritePixels("samurai", "attack", SAMURAI_FRAME.parry);
    let top = 99;
    parry.forEach((c, i) => {
      if (c === 5) top = Math.min(top, Math.floor(i / N) - OFF);
    });
    expect(top).toBeLessThan(4);
  });

  it("death: she kneels with the katana planted in the ground", () => {
    for (let f = 0; f < 3; f++) {
      const frame = spritePixels("samurai", "death", f);
      // tig' (5-rang) yergacha tushadi
      let bottom = -1;
      frame.forEach((c, i) => {
        if (c === 5) bottom = Math.max(bottom, Math.floor(i / N) - OFF);
      });
      expect(bottom).toBeGreaterThanOrEqual(26);
    }
    // tizzada: gavda pastroq
    const top = (f: number) => {
      const fr = spritePixels("samurai", "death", f);
      return Math.floor(fr.findIndex((c) => c > 1) / N);
    };
    expect(top(2)).toBeGreaterThan(top(0));
  });

  it("draws on a larger grid so the body keeps the usual 32 px (visual size ≠ collision size)", () => {
    expect(spriteGrid("samurai")).toBe(SAMURAI_GRID);
    expect(spriteSize("samurai")).toBe(SAMURAI_GRID);
    expect(SAMURAI_GRID).toBeGreaterThan(32);
    expect(heroView("samurai")).toBeGreaterThan(32);
    expect(heroView("knight")).toBe(32);
    // turgan kadr tanasi 32x32 markazga sig'adi (katana va soch dumi chetga chiqishi mumkin)
    const body = span(spritePixels("samurai", "idle", 0), 3);
    expect(body.lo).toBeGreaterThanOrEqual(8);
    expect(body.hi).toBeLessThanOrEqual(24);
  });

  it("render picks the special frames: charge stance, Iai lunge, dash lean, parry and wide slash", () => {
    const F = SAMURAI_FRAME;
    const p = new Player("samurai");
    expect(p.samuraiFrame()[0]).toBe("idle");
    p.charge = IAI_MIN + 0.1;
    expect(p.samuraiFrame()).toEqual(["attack", F.charge]);
    p.charge = 0;
    p.dashTimer = 0.1;
    expect(p.samuraiFrame()).toEqual(["attack", F.dash]);
    p.iai = { speed: 700, mul: 2, k: 1, crit: false, from: { x: 0, y: 0 } };
    expect(p.samuraiFrame()).toEqual(["attack", F.iai]);
    p.iai = null;
    p.dashTimer = 0;
    p.parryPose = 0.2;
    expect(p.samuraiFrame()).toEqual(["attack", F.parry]);
    p.parryPose = 0;
    p.attackTimer = p.attackTime;
    p.comboStep = 2;
    expect(p.samuraiFrame()).toEqual(["attack", F.wide]);
    p.comboStep = 0;
    p.attackTimer = p.attackTime * 0.5;
    expect(p.samuraiFrame()).toEqual(["attack", 1]);
    // afsonaviy skin (Qizil oy): IAI dan keyin katanani qinga qaytarish kadri
    p.attackTimer = 0;
    p.iaiPose = 0.2;
    expect(p.samuraiFrame()).toEqual(["attack", F.iai]);
    p.flair = "moon";
    expect(p.samuraiFrame()).toEqual(["attack", F.sheathe]);
  });
});
