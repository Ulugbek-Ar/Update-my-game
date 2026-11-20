import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Game } from "./game";
import { Enemy } from "./enemy";
import { Boss } from "./boss";
import { DEFAULT_SETTINGS, saveSettings } from "./settings";
import { dangerDistance } from "./danger";
import { DEFAULT_THEME } from "./skinFx";
import { Effects } from "./effects";
import {
  SuperCast,
  launchVolley,
  nearestTarget,
  stepArrow,
  superFor,
  volleyTargets,
} from "./super";
import { ArrowScene } from "./arrowsFx";
import type { SceneCtx } from "./superScene";
import {
  HUNTER_PORTRAIT_COLORS,
  HUNTER_PORTRAIT_GRID,
  HUNTER_PORTRAIT_STYLES,
  hunterPortraitPixels,
} from "./hunterPortrait";
import { HUNTER_PORTRAIT_VARIANTS, portraitPixels } from "./portrait";
import { HUNTER_SUPER_FRAME, UPGRADE_ICONS, spritePixels } from "./sprites";
import { UPGRADES } from "./waves";

const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
const DT = 1 / 60;
const def = () => superFor("hunter")!;
const V = () => def().volley!;

function makeGame() {
  const g = new Game(canvas as unknown as HTMLCanvasElement, "hunter");
  g.hints = [];
  g.enemies = [];
  g.banner.timer = 0;
  g.player.x = 160;
  g.player.y = 150;
  return { g, p: g.player };
}

function foe(g: Game, x: number, y: number, kind: ConstructorParameters<typeof Enemy>[0] = "blob") {
  const e = new Enemy(kind, x, y);
  e.spawn = 0;
  e.update = () => {};
  g.enemies.push(e);
  return e;
}

function cast(g: Game) {
  g.superMeter.value = g.superMeter.def!.charge;
  expect(g.useSuper()).toBe(true);
  return g.cast!;
}

function untilEnds(g: Game, max = 10) {
  let t = 0;
  for (; t < max && g.cast; t += DT) g.update(DT);
  return t;
}

beforeEach(() => {
  localStorage.clear();
  saveSettings({ ...DEFAULT_SETTINGS });
});
afterEach(() => vi.restoreAllMocks());

describe("O'N O'Q OVI: ma'lumot", () => {
  it("is the Hunter's open super: 20 charge, 3 stages, boss 8% capped at 10%, green orb", () => {
    const d = def();
    expect(d.id).toBe("ten-arrows");
    expect(d.name).toBe("O'N O'Q OVI");
    expect(d.charge).toBe(20);
    expect(d.dmg).toEqual({ kill: true, boss: 0.08, bossCap: 0.1 });
    expect(d.time).toBeCloseTo(d.stages.prep + d.stages.strike + d.stages.after);
    expect(V().n).toBe(10);
    expect(V().more).toBe(15);
    // shar yashil va xavf ranglaridan uzoq
    const g = parseInt(d.orb!.accent.slice(3, 5), 16);
    const r = parseInt(d.orb!.accent.slice(1, 3), 16);
    expect(g).toBeGreaterThan(r);
    for (const c of Object.values(d.orb!)) expect(dangerDistance(c)).toBeGreaterThan(60);
    expect(d.card.sub).toBe("OVCHI SUPERI");
  });

  it("has two super cards with icons: O'N BESH O'Q and ZANJIRLI PORTLASH", () => {
    const cards = UPGRADES.filter((u) => u.super === "ten-arrows");
    expect(cards.map((u) => u.name)).toEqual(["O'N BESH O'Q", "ZANJIRLI PORTLASH"]);
    for (const u of cards) {
      expect(u.hero).toBe("hunter");
      expect(UPGRADE_ICONS[u.icon!]?.length).toBe(12);
      for (const row of UPGRADE_ICONS[u.icon!]!) expect(row.length).toBe(12);
    }
  });
});

describe("O'N O'Q OVI: o'qlar mantiqi (sof)", () => {
  it("assigns arrows round-robin: nearest mobs first, then the boss; none -> null", () => {
    const from = { x: 0, y: 0 };
    const a = { x: 50, y: 0 },
      b = { x: 10, y: 0 },
      boss = { x: 100, y: 0 };
    const t = volleyTargets(from, [a, b], [boss], 10);
    expect(t.length).toBe(10);
    expect(t.slice(0, 3)).toEqual([b, a, boss]);
    expect(t.filter((x) => x === b).length).toBe(4);
    expect(volleyTargets(from, [], [], 10).every((x) => x === null)).toBe(true);
  });

  it("launches a fan into the sky and every arrow reaches its target within the strike stage", () => {
    const d = def();
    const targets = [
      { x: 40, y: 200 },
      { x: 300, y: 30 },
      { x: 160, y: 230 },
    ];
    const pick = volleyTargets({ x: 160, y: 120 }, targets, [], 10);
    const arrows = launchVolley(d, { x: 160, y: 120 }, pick, { x: 1, y: 0 });
    expect(arrows.length).toBe(10);
    for (const a of arrows) expect(a.vy).toBeLessThan(0);
    // yelpig'ich: chapdan o'ngga
    expect(arrows[0]!.vx).toBeLessThan(0);
    expect(arrows[9]!.vx).toBeGreaterThan(0);
    let t = 0;
    let hits = 0;
    let curved = false;
    for (; t < d.stages.strike; t += DT)
      for (const a of arrows) {
        const before = Math.atan2(a.vy, a.vx);
        if (stepArrow(d, a, DT, t)) hits++;
        if (!a.done && Math.abs(Math.atan2(a.vy, a.vx) - before) > 1e-3) curved = true;
      }
    expect(hits).toBe(10);
    expect(curved).toBe(true);
    for (const a of arrows) {
      const tg = a.target as { x: number; y: number };
      expect(Math.hypot(a.x - tg.x, a.y - tg.y)).toBeLessThan(1);
    }
  });

  it("finds the nearest living target for a retargeted arrow", () => {
    expect(
      nearestTarget({ x: 0, y: 0 }, [
        { x: 9, y: 0 },
        { x: 3, y: 4 },
      ]),
    ).toEqual({ x: 3, y: 4 });
    expect(nearestTarget({ x: 0, y: 0 }, [])).toBeNull();
  });
});

describe("O'N O'Q OVI: o'yinda", () => {
  it("marks every target during the draw, then ten arrows kill every mob", () => {
    const { g } = makeGame();
    const mobs = [
      foe(g, 40, 60),
      foe(g, 280, 60),
      foe(g, 60, 200),
      foe(g, 260, 210),
      foe(g, 160, 40),
    ];
    const c = cast(g);
    for (let t = 0; t < 2 && c.stage !== "strike"; t += DT) g.update(DT);
    expect(c.stage).toBe("strike");
    expect(c.arrows.length).toBe(10);
    untilEnds(g);
    expect(mobs.every((e) => e.dead)).toBe(true);
    expect(g.cast).toBeNull();
  });

  it("an arrow whose target died turns to the nearest living enemy", () => {
    const { g } = makeGame();
    const a = foe(g, 40, 60);
    const b = foe(g, 280, 200);
    const c = cast(g);
    for (let t = 0; t < 2 && c.stage !== "strike"; t += DT) g.update(DT);
    g.update(DT);
    const toA = c.arrows.filter((x) => x.target === a);
    expect(toA.length).toBeGreaterThan(0);
    // nishon o'ldi: shu o'qlar endi b ga uchadi
    a.anim.set("death");
    expect(a.dead).toBe(true);
    g.update(DT);
    for (const x of toA) if (!x.done) expect(x.target).toBe(b);
    untilEnds(g);
    expect(b.dead).toBe(true);
  });

  it("a boss takes at most 10% of its max HP from all arrows; the player is invulnerable only during the super", () => {
    const { g, p } = makeGame();
    const boss = new Boss();
    boss.x = 240;
    boss.y = 100;
    boss.spawn = 0;
    boss.update = () => {};
    g.boss = boss;
    const hp0 = boss.hp;
    cast(g);
    expect(p.casting).toBe(true);
    untilEnds(g);
    const dealt = hp0 - boss.hp;
    expect(dealt).toBeGreaterThan(0);
    expect(dealt).toBeLessThanOrEqual(boss.maxHp * 0.1 + 1e-6);
    // daxlsizlik super bilan tugaydi
    expect(p.casting).toBe(false);
    expect(p.invuln).toBe(0);
  });

  it("O'N BESH O'Q fires 15 arrows; ZANJIRLI PORTLASH hurts enemies around the blast", () => {
    const { g, p } = makeGame();
    p.fifteenArrows = true;
    foe(g, 40, 60);
    let c = cast(g);
    for (let t = 0; t < 2 && c.stage !== "strike"; t += DT) g.update(DT);
    expect(c.arrows.length).toBe(15);
    untilEnds(g);

    const h = makeGame();
    h.p.chainBlast = true;
    const near = [foe(h.g, 60, 60, "golem"), foe(h.g, 70, 64, "golem")];
    for (const e of near) e.hp = e.maxHp = 400;
    const hp = near[1]!.hp;
    // bitta o'q: nishon — birinchi golem, portlash ikkinchisiga ham tegadi
    h.g.superMeter.value = 20;
    h.g.useSuper();
    c = h.g.cast!;
    for (let t = 0; t < 2 && c.stage !== "strike"; t += DT) h.g.update(DT);
    c.arrows.splice(1);
    c.arrows[0]!.target = near[0]!;
    untilEnds(h.g);
    expect(near[0]!.dead).toBe(true);
    expect(near[1]!.hp).toBeLessThan(hp);
  });

  it("without enemies the arrows still fly and burst harmlessly", () => {
    const { g } = makeGame();
    const c = cast(g);
    for (let t = 0; t < 2 && c.stage !== "strike"; t += DT) g.update(DT);
    expect(c.arrows.length).toBe(10);
    untilEnds(g);
    expect(c.arrows.every((a) => a.done)).toBe(true);
  });
});

describe("O'N O'Q OVI: sahna", () => {
  const ctxFor = (reduced: boolean, fx = new Effects()): SceneCtx => ({
    x: 160,
    y: 150,
    dir: 1,
    theme: DEFAULT_THEME.hunter,
    reduced,
    fx,
    shake: () => {},
    view: { x: 0, y: 0, w: 320, h: 240 },
  });

  it("draws with skin theme colours only, and 'Reduce effects' makes fewer particles", () => {
    const used = new Set<string>();
    const rec = new Proxy(
      {},
      {
        get: () => () => {},
        set: (_, k, v) => {
          if (k === "fillStyle" || k === "strokeStyle") used.add(String(v));
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D;
    const count = (reduced: boolean) => {
      const fx = new Effects();
      const s = new ArrowScene();
      const c = new SuperCast(def(), 0);
      const ctx = ctxFor(reduced, fx);
      s.stage("prep", c, ctx);
      s.mark({ x: 60, y: 60, size: 12, ref: {} }, false);
      c.stage = "strike";
      c.arrows = launchVolley(def(), { x: 160, y: 150 }, [{ x: 60, y: 60 }], { x: 1, y: 0 });
      for (let i = 0; i < 10; i++) {
        stepArrow(def(), c.arrows[0]!, DT, i * DT);
        s.update(DT, c, ctx);
      }
      s.renderGround(rec, c, ctx);
      s.renderAir(rec, c, ctx);
      s.hit({ x: 60, y: 60, size: 12 }, false, true, c, ctx);
      s.renderAir(rec, c, ctx);
      return (fx as unknown as { particles: unknown[] }).particles.length;
    };
    expect(count(true)).toBeLessThan(count(false));
    const T = DEFAULT_THEME.hunter;
    const theme = [T.glow, T.glint, T.edge, T.core].map((c) => c.toLowerCase().slice(1, 7));
    for (const c of used) {
      if (c.startsWith("rgba(4,10,4")) continue;
      const hex = c.startsWith("#")
        ? c.slice(1, 7).toLowerCase()
        : c
            .match(/\d+/g)!
            .slice(0, 3)
            .map((n) => (+n).toString(16).padStart(2, "0"))
            .join("");
      expect(theme, c).toContain(hex);
    }
  });

  it("the Hunter sprite draws the bow to the sky in three super frames", () => {
    const frames = Object.values(HUNTER_SUPER_FRAME).map((f) =>
      spritePixels("hunter", "attack", f).join(","),
    );
    expect(new Set(frames).size).toBe(3);
    expect(frames).not.toContain(spritePixels("hunter", "attack", 1).join(","));
  });
});

describe("Ovchi portreti (cut-in)", () => {
  it("is 96x96, front-facing and symmetric, 3 distinct frames, 4–5 shading tones, two styles", () => {
    expect(HUNTER_PORTRAIT_STYLES).toBe(2);
    for (let s = 0; s < HUNTER_PORTRAIT_STYLES; s++) {
      const frames = [0, 1, 2].map((f) => hunterPortraitPixels(f, s));
      for (const d of frames) expect(d.length).toBe(HUNTER_PORTRAIT_GRID ** 2);
      expect(new Set(frames.map((d) => d.join(","))).size).toBe(3);
      // simmetriya (1-kadr: barglar va chaqnashsiz)
      const d = frames[1]!;
      let same = 0,
        all = 0;
      for (let y = 0; y < 96; y++)
        for (let x = 0; x < 48; x++) {
          all++;
          if (!d[y * 96 + x] === !d[y * 96 + 95 - x]) same++;
        }
      expect(same / all).toBeGreaterThan(0.95);
      // qalpoq yashili 4–5 tonda (2..6) va rim light
      const used = new Set(d);
      expect([2, 3, 4, 5, 6].filter((c) => used.has(c)).length).toBeGreaterThanOrEqual(4);
      expect(used.has(22)).toBe(true);
      // ko'zlar yonadi
      expect(used.has(20)).toBe(true);
    }
    expect(HUNTER_PORTRAIT_COLORS.length).toBeGreaterThanOrEqual(30);
    expect(HUNTER_PORTRAIT_VARIANTS.map((v) => portraitPixels("hunter", v)!.join(",")).length).toBe(
      3,
    );
  });

  it("is shown in the cut-in card of the super", () => {
    // jsdom'da kanvas yo'q: rasterni soxta kontekst bilan chizamiz
    const fake = () =>
      new Proxy(
        {},
        {
          get: (_, k) =>
            k === "createLinearGradient" || k === "createRadialGradient"
              ? () => ({ addColorStop: () => {} })
              : k === "getImageData"
                ? () => ({ data: new Uint8ClampedArray(4) })
                : () => {},
          set: () => true,
        },
      );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      fake as unknown as HTMLCanvasElement["getContext"],
    );
    const { g } = makeGame();
    const drawn: unknown[] = [];
    (g as unknown as { ctx: CanvasRenderingContext2D }).ctx = new Proxy(
      {},
      {
        get: (_, k) =>
          k === "drawImage"
            ? (img: unknown) => drawn.push(img)
            : k === "createLinearGradient" || k === "createRadialGradient"
              ? () => ({ addColorStop: () => {} })
              : k === "measureText"
                ? () => ({ width: 10 })
                : () => {},
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D;
    const c = cast(g);
    expect(c.stage).toBe("card");
    (g as unknown as { renderCard(): void }).renderCard();
    const portrait = drawn.find(
      (d) => d instanceof HTMLCanvasElement && d.width === HUNTER_PORTRAIT_GRID,
    );
    expect(portrait).toBeTruthy();
  });
});
