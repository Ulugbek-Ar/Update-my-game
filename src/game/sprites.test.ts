import { describe, expect, it } from "vitest";
import { spritePixels, BEARD_SWAY, PALETTES, UPGRADE_ICONS, type SpriteKind } from "./sprites";

/** walk pozalarining bob qiymatlari (sprites.ts dagi poses.walk) */
const BOB_WALK = [0, -1, 0, 1];
import { UPGRADES, cardFor, upgradeIcon } from "./waves";
import { Player } from "./player";
import { Enemy } from "./enemy";
import { Boss } from "./boss";
import type { AnimState } from "./animation";

const counts: Record<AnimState, number> = { idle: 2, walk: 4, attack: 3, hurt: 1, death: 3 };

describe("Code-drawn character frames", () => {
  for (const kind of [
    "knight",
    "mage",
    "skeleton",
    "archer",
    "shield",
    "demon",
    "slime",
    "bat",
    "frost",
    "golem",
    "iceblob",
    "wolf",
    "queen",
  ] as SpriteKind[]) {
    for (const [state, count] of Object.entries(counts) as [AnimState, number][]) {
      it(`${kind} has ${count} distinct ${state} frames within five colors`, () => {
        const frames = Array.from({ length: count }, (_, frame) =>
          spritePixels(kind, state, frame),
        );
        expect(new Set(frames.map((pixels) => pixels.join(","))).size).toBe(count);
        for (const frame of frames) {
          expect(frame.length).toBe(32 * 32);
          expect(Math.max(...frame)).toBeLessThanOrEqual(5);
          expect(frame.some((color) => color === 1)).toBe(true);
        }
      });
    }
  }

  it("connects frame counts to the existing state machine and preserves collision sizes", () => {
    const characters = [new Player(), new Enemy("rammer", 80, 110), new Boss()];
    expect(characters.map((c) => c.size)).toEqual([12, 14, 28]);
    for (const character of characters) {
      for (const [state, count] of Object.entries(counts) as [AnimState, number][]) {
        expect(character.anim.defs[state].frames).toBe(count);
        character.anim.set(state, true);
        character.anim.update(character.anim.defs[state].frameTime + 0.001);
        expect(character.anim.frame).toBe(count === 1 ? 0 : 1);
      }
    }
  });

  it("gives slime and bat the same frame-by-frame state machine", () => {
    for (const kind of ["blob", "wisp"] as const) {
      const enemy = new Enemy(kind, 50, 50);
      expect(Object.values(enemy.anim.defs).map((def) => def.frames)).toEqual([2, 4, 3, 1, 3]);
    }
  });
});

describe("Kamonchi skelet sprite", () => {
  const count = (frame: Uint8Array, color: number) => frame.filter((c) => c === color).length;

  it("has 13 distinct frames matching the archer's animation state machine", () => {
    const enemy = new Enemy("archer", 50, 50);
    const all: string[] = [];
    for (const [state, n] of Object.entries(counts) as [AnimState, number][]) {
      expect(enemy.anim.defs[state].frames).toBe(n);
      for (let f = 0; f < n; f++) {
        const frame = spritePixels("archer", state, f);
        expect(frame.length).toBe(32 * 32);
        expect(Math.max(...frame)).toBeLessThanOrEqual(5);
        // chegarada faqat ink yoki bo'sh: rangli chizma kesilmaydi, outline to'liq
        for (let i = 0; i < 32; i++)
          for (const edge of [i, 31 * 32 + i, i * 32, i * 32 + 31])
            expect(frame[edge]).toBeLessThanOrEqual(1);
        // tirik kadrlarda qizil ko'zlar doim yonib turadi
        if (state !== "death") expect(count(frame, 5)).toBeGreaterThanOrEqual(18);
        all.push(frame.join(","));
      }
    }
    expect(all.length).toBe(13);
    expect(new Set(all).size).toBe(13);
  });

  it("draws a bow instead of the skeleton's sword in every living state", () => {
    for (const [state, n] of Object.entries(counts) as [AnimState, number][]) {
      if (state === "death") continue;
      for (let f = 0; f < n; f++) {
        expect(spritePixels("archer", state, f).join(",")).not.toBe(
          spritePixels("skeleton", state, f).join(","),
        );
      }
    }
  });

  it("shows the arrow only while drawing, not after release", () => {
    const [nock, drawn, released] = [0, 1, 2].map((f) => spritePixels("archer", "attack", f));
    // 5 — qizil: ko'zlar (hamma kadrda bir xil) + o'q uchi; qo'yib yuborilganda o'q yo'q
    expect(count(drawn!, 5)).toBeGreaterThan(count(released!, 5));
    expect(count(nock!, 5)).toBeGreaterThan(count(released!, 5));
  });

  it("has red eye sockets while the plain skeleton keeps black ones", () => {
    // idle 0 pozasida bosh suyagi siljimagan: ko'z teshiklari (12..14, 8..10) va (17..19, 8..10)
    const archer = spritePixels("archer", "idle", 0);
    const skeleton = spritePixels("skeleton", "idle", 0);
    for (const ex of [12, 17])
      for (let y = 8; y < 11; y++)
        for (let x = ex; x < ex + 3; x++) {
          expect(archer[y * 32 + x]).toBe(5);
          expect(skeleton[y * 32 + x]).toBe(1);
        }
  });

  it("uses a red arrowhead on the drawn arrow", () => {
    const eyes = 18;
    expect(count(spritePixels("archer", "attack", 1), 5)).toBeGreaterThan(eyes);
    expect(count(spritePixels("archer", "attack", 2), 5)).toBe(eyes);
  });

  it("keeps the wooden bow visible while it falls in every death frame", () => {
    for (let f = 0; f < 3; f++) {
      expect(count(spritePixels("archer", "death", f), 4)).toBeGreaterThan(6);
    }
  });
});

describe("Sehrgar: yangi qiyofa", () => {
  const count = (frame: Uint8Array, color: number) => frame.filter((c) => c === color).length;
  const living = (Object.entries(counts) as [AnimState, number][]).filter(([s]) => s !== "death");

  it("uses the black-red-silver palette with exactly five colors", () => {
    const [ink, robe, red, silver, skin] = PALETTES.mage;
    expect(PALETTES.mage.length).toBe(5);
    const lum = (h: string) =>
      [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).reduce((a, b) => a + b, 0);
    // qora to'n: siyohdan ochroq, lekin hali qora
    expect(lum(robe!)).toBeGreaterThan(lum(ink!));
    expect(lum(robe!)).toBeLessThan(160);
    // to'q qizil: qizil kanal ustun
    expect(parseInt(red!.slice(1, 3), 16)).toBeGreaterThan(parseInt(red!.slice(3, 5), 16) * 3);
    // kumushrang: och va deyarli kulrang
    expect(lum(silver!)).toBeGreaterThan(600);
    expect(skin).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("13 distinct frames (+ back view) with all five colors in every living frame", () => {
    const all: string[] = [];
    for (const [state, n] of Object.entries(counts) as [AnimState, number][])
      for (let f = 0; f < n; f++) {
        const frame = spritePixels("mage", state, f);
        expect(Math.max(...frame)).toBeLessThanOrEqual(5);
        if (state !== "death")
          for (let c = 1; c <= 5; c++) expect(count(frame, c)).toBeGreaterThan(0);
        all.push(frame.join(","));
      }
    expect(new Set(all).size).toBe(13);
    for (const [state, n] of living)
      for (let f = 0; f < n; f++) {
        const back = spritePixels("mage", state, f, true).join(",");
        expect(back).not.toBe(spritePixels("mage", state, f).join(","));
        expect(all).not.toContain(back);
      }
  });

  it("has a long silver beard covering the lower face and reaching the chest", () => {
    const frame = spritePixels("mage", "idle", 0);
    expect(count(frame, 4)).toBeGreaterThanOrEqual(35);
    // soqol uchi ko'krakda (y >= 20), yuz tepasida ko'zlar (siyoh) ko'rinadi
    const rows = new Set<number>();
    frame.forEach((c, i) => c === 4 && rows.add(Math.floor(i / 32)));
    expect(Math.max(...rows)).toBeGreaterThanOrEqual(20);
    expect(frame[11 * 32 + 14]).toBe(1);
    expect(frame[11 * 32 + 17]).toBe(1);
  });

  it("the beard tip sways during walk and attack", () => {
    expect(new Set(BEARD_SWAY.walk).size).toBeGreaterThan(1);
    expect(new Set(BEARD_SWAY.attack).size).toBeGreaterThan(1);
    // chayqalish soqolni haqiqatan siljitadi: walk 1 (o'ngga) va walk 3 (chapga)
    const tip = (f: number) => {
      const frame = spritePixels("mage", "walk", f);
      const xs: number[] = [];
      for (let x = 12; x < 22; x++) if (frame[(19 + BOB_WALK[f]!) * 32 + x] === 4) xs.push(x);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(tip(1)).toBeGreaterThan(tip(3));
  });

  it("the staff crystal is red with a silver glint, brighter while casting", () => {
    const red = (f: number) => count(spritePixels("mage", "attack", f), 3);
    expect(red(1)).toBeGreaterThan(red(0));
  });

  it("the hat falls off on death and the silver beard stays visible", () => {
    for (let f = 0; f < 3; f++) {
      const frame = spritePixels("mage", "death", f);
      expect(count(frame, 4)).toBeGreaterThan(8);
      expect(count(frame, 5)).toBeGreaterThan(5);
    }
  });
});

describe("Qalqonli skelet sprite", () => {
  const count = (frame: Uint8Array, color: number) => frame.filter((c) => c === color).length;

  it("carries a big wooden shield with an iron rim, pushed forward during the bash", () => {
    const shieldX = (frame: Uint8Array) => {
      let max = 0;
      frame.forEach((c, i) => c === 4 && (max = Math.max(max, i % 32)));
      return max;
    };
    const idle = spritePixels("shield", "idle", 0);
    expect(count(idle, 4)).toBeGreaterThan(40);
    expect(count(idle, 5)).toBeGreaterThan(15);
    expect(shieldX(spritePixels("shield", "attack", 1))).toBeGreaterThan(shieldX(idle));
    expect(idle.join(",")).not.toBe(spritePixels("skeleton", "idle", 0).join(","));
    const e = new Enemy("shield", 50, 50);
    expect(Object.values(e.anim.defs).map((d) => d.frames)).toEqual([2, 4, 3, 1, 3]);
  });
});

describe("Upgrade card icons", () => {
  it("draws a 12x12 icon for every upgrade", () => {
    for (const hero of ["knight", "mage"] as const)
      for (const u of UPGRADES.map((u) => cardFor(u, new Player(hero)))) {
        const rows = UPGRADE_ICONS[upgradeIcon(u)];
        expect(rows, u.id).toBeDefined();
        expect(rows!.length).toBe(12);
        for (const row of rows!) expect(row).toMatch(/^[.XogkRLFSK]{12}$/);
      }
  });
});
