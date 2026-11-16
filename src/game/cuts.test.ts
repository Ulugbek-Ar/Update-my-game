import { beforeEach, describe, expect, it } from "vitest";
import { Game } from "./game";
import { Enemy, ENEMY_HP, ENEMY_SPRITE } from "./enemy";
import { Boss } from "./boss";
import { HEROES } from "./hero";
import { PETAL_VEIL_TIME, Player, SECOND_BREATH } from "./player";
import { unlockHero } from "./save";
import { DEFAULT_SETTINGS, saveSettings } from "./settings";
import { DANGER_COLORS, colorDistance } from "./danger";
import { SKINS, SKINS_KEY } from "./skins";
import { DEFAULT_THEME, type SkinTheme } from "./skinFx";
import { ROOM } from "./animation";
import { Effects } from "./effects";
import { sfx } from "./audio";
import { SUPERS, SuperCast, superFor } from "./super";
import { sceneFor, type SceneCtx } from "./superScene";
import {
  CARD_SNAP,
  CutsScene,
  MAX_PETALS,
  MAX_PETALS_REDUCED,
  SPLIT_TIME,
  STORM_PETALS,
  renderAnimeCard,
  renderPetalVeil,
} from "./cutsFx";
import { PORTRAIT_GRID, portraitPixels } from "./portrait";
import { SAMURAI_FRAME, SAMURAI_SUPER_FRAME, UPGRADE_ICONS, spritePixels } from "./sprites";
import { SUPER_CARD_CHANCE, UPGRADES, WAVES, WAVES2, BOSS_WAVE, pickUpgrades } from "./waves";
import { RealmSim } from "@/realm/sim";
import { loadRealmData } from "@/realm/data";

const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
const DT = 1 / 60;
const def = () => superFor("samurai")!;

function makeGame(skin?: string) {
  unlockHero("samurai");
  if (skin)
    localStorage.setItem(SKINS_KEY, JSON.stringify({ owned: [skin], sel: { samurai: skin } }));
  const g = new Game(canvas as unknown as HTMLCanvasElement, "samurai");
  g.hints = [];
  g.enemies = [];
  g.banner.timer = 0;
  // markazdan uzoqda: oqibatda markazga o'tishi ko'rinsin
  g.player.x = 60;
  g.player.y = 170;
  return { g, p: g.player };
}

function foe(g: Game, kind: ConstructorParameters<typeof Enemy>[0], x: number, y: number) {
  const e = new Enemy(kind, x, y);
  e.spawn = 0;
  e.update = () => {};
  g.enemies.push(e);
  return e;
}

function cast(g: Game) {
  g.superMeter.value = g.superMeter.def!.charge;
  expect(g.useSuper()).toBe(true);
}

function until(g: Game, stop: () => boolean, max = 12) {
  let t = 0;
  for (; t < max && !stop(); t += DT) g.update(DT);
  return t;
}

const scene = (g: Game) => g.scene as CutsScene;

/** Chizilgan ranglar va chaqirilgan metodlarni yozib boradigan soxta canvas */
function recorder() {
  const colors = new Set<string>();
  const calls: string[] = [];
  const grad = { addColorStop: (_: number, c: string) => colors.add(c) };
  const ctx = new Proxy(
    {},
    {
      get: (_, k) =>
        k === "createLinearGradient" || k === "createRadialGradient"
          ? () => grad
          : k === "globalAlpha"
            ? 1
            : () => calls.push(String(k)),
      set: (_, k, v) => {
        if ((k === "fillStyle" || k === "strokeStyle") && typeof v === "string") colors.add(v);
        if (k === "globalCompositeOperation") calls.push(`op:${v}`);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, colors, calls };
}

function ctxFor(T: SkinTheme, reduced = false, flair: string | null = null): SceneCtx {
  const fx = new Effects();
  fx.reduced = reduced;
  return {
    x: 160,
    y: 150,
    dir: 1,
    theme: T,
    reduced,
    fx,
    shake: () => {},
    view: { x: 0, y: 0, w: 320, h: 240 },
    flair,
  };
}

beforeEach(() => {
  localStorage.clear();
  saveSettings({ ...DEFAULT_SETTINGS });
});

describe("MING KESIM: ma'lumot", () => {
  it("is open with three stages ~0.8 / 1.2 / 1 s, an anime card and a strict boss cap", () => {
    const d = def();
    expect(d.name).toBe("MING KESIM");
    expect(d.open).toBe(true);
    expect(d.stages.prep).toBeCloseTo(0.8);
    expect(d.stages.strike).toBeCloseTo(1.2);
    expect(d.stages.after).toBeCloseTo(1);
    expect(d.time).toBeCloseTo(3);
    // zarba bosqichi nishon kam bo'lsa ham to'liq 1.2 s davom etadi
    expect(d.strike.min).toBeCloseTo(d.stages.strike);
    // "chik" — oqibat bosqichi ichida, Samuray qinga qaytarishga ulgurgach
    expect(d.release).toBeGreaterThan(0.25);
    expect(d.release).toBeLessThan(d.stages.after * 0.7);
    expect(d.center).toBe(true);
    // dushmanlar zarba paytida "qotib qoladi"
    expect(d.slow.strike).toBeLessThanOrEqual(0.03);
    // bossga 8–10% dan oshmaydi
    expect(d.dmg.boss).toBeGreaterThanOrEqual(0.08);
    expect(d.dmg.bossCap).toBeLessThanOrEqual(0.1);
    expect(d.dmg.kill).toBe(true);
    // anime uslubidagi kadr — faqat Samurayda
    for (const s of Object.values(SUPERS)) expect(!!s.card.anime).toBe(s.hero === "samurai");
    expect(d.card.short).toBeLessThan(d.card.time);
    expect(sceneFor(d.fx)).toBeInstanceOf(CutsScene);
  });

  it("every sound it names exists, and the orb fills about once every 1–2 waves", () => {
    for (const snd of Object.values(def().sounds))
      expect(typeof (sfx as unknown as Record<string, unknown>)[snd!], snd).toBe("function");
    for (const waves of [WAVES, WAVES2]) {
      const hp = waves.slice(0, BOSS_WAVE).map((w) => w.reduce((s, k) => s + ENEMY_HP[k], 0));
      const avg = hp.reduce((a, b) => a + b, 0) / hp.length;
      expect(def().charge / avg).toBeGreaterThanOrEqual(0.7);
      expect(def().charge / avg).toBeLessThanOrEqual(2);
    }
  });
});

describe("MING KESIM: o'yinda", () => {
  it("prep: eyes closed, hand on the hilt, the world turns black and white", () => {
    const { g, p } = makeGame();
    foe(g, "rammer", 240, 80);
    cast(g);
    expect(g.cast!.stage).toBe("card");
    until(g, () => g.cast?.stage === "prep");
    until(g, () => (g.cast?.t ?? 1) > 0.6);
    expect(g.cast!.stage).toBe("prep");
    const F = SAMURAI_SUPER_FRAME;
    expect([F.focus, F.focusWind]).toContain(p.superFrame);
    expect(p.samuraiFrame()).toEqual(["attack", p.superFrame]);
    expect(p.superHidden).toBe(false);
    expect(scene(g).gray).toBeGreaterThan(0.9);
    // dunyo sekin
    expect(g.cast!.worldSpeed).toBeLessThan(0.3);
  });

  it("strike: she vanishes, dozens of cuts flash, enemies freeze and are only marked", () => {
    const { g, p } = makeGame();
    const mobs = [foe(g, "rammer", 240, 80), foe(g, "golem", 100, 60), foe(g, "spider", 260, 200)];
    cast(g);
    until(g, () => g.cast?.stage === "strike");
    expect(p.superHidden).toBe(true);
    expect(g.cast!.worldSpeed).toBeLessThanOrEqual(0.03);
    // ekran bo'ylab o'nlab kesik (+ har dushmanga bittadan)
    expect(scene(g).slashes.length).toBeGreaterThanOrEqual(def().params["slashes"]!);
    expect(def().params["slashes"]).toBeGreaterThanOrEqual(24);
    until(g, () => g.cast?.stage !== "strike");
    // zarba tugadi — dushmanlar hali tirik, lekin hammasida kesik izi bor
    expect(g.cast!.stage).toBe("after");
    for (const e of mobs) expect(e.dead).toBe(false);
    expect(scene(g).pending.size).toBe(3);
    expect(scene(g).petals.length).toBeGreaterThan(0);
  });

  it("aftermath: she appears in the middle, sheathes slowly — on the 'chik' every enemy splits at once", () => {
    const { g, p } = makeGame();
    const mobs = [foe(g, "rammer", 240, 80), foe(g, "golem", 100, 60), foe(g, "spider", 260, 200)];
    cast(g);
    until(g, () => g.cast?.stage === "after");
    expect(p.superHidden).toBe(false);
    expect(p.x).toBeCloseTo(ROOM.w / 2);
    expect(p.y).toBeCloseTo(ROOM.h / 2);
    // qinga sekin qaytarish: tig' uzun → yarmi → deyarli kirdi
    const F = SAMURAI_SUPER_FRAME;
    expect(p.superFrame).toBe(F.sheatheLong);
    const seen = new Set<number>();
    until(g, () => {
      seen.add(p.superFrame);
      return g.cast!.released;
    });
    expect([...seen]).toEqual(expect.arrayContaining([F.sheatheLong, F.sheatheHalf, F.sheatheEnd]));
    // "chik": hamma birdan — bir kadrda
    for (const e of mobs) expect(e.dead).toBe(true);
    // Qor odam (golem) o'lganda bo'linadi — bolalari ham shu "chik" da kesiladi
    expect(g.enemies.filter((e) => !e.dead)).toEqual([]);
    expect(g.cast!.kills).toBeGreaterThan(3);
    expect(scene(g).halves.length).toBe(g.cast!.kills);
    expect(scene(g).released).toBe(true);
    // ranglar qaytadi, yarimlar gulbargga aylanadi
    for (let t = 0; t < SPLIT_TIME + 0.05; t += DT) g.update(DT);
    expect(scene(g).gray).toBeLessThan(0.5);
    expect(scene(g).petals.length).toBeGreaterThan(10);
  });

  it("nothing is cut before the 'chik', even with many enemies", () => {
    const { g } = makeGame();
    for (let i = 0; i < 12; i++) foe(g, "rammer", 30 + i * 22, 60 + (i % 3) * 50);
    cast(g);
    until(g, () => g.cast?.released === true);
    expect(g.enemies.every((e) => e.dead)).toBe(true);
    const { g: g2 } = makeGame();
    for (let i = 0; i < 12; i++) foe(g2, "rammer", 30 + i * 22, 60 + (i % 3) * 50);
    cast(g2);
    until(g2, () => g2.cast?.stage === "after" && g2.cast.t > 0.3);
    expect(g2.enemies.every((e) => !e.dead)).toBe(true);
  });

  it("invulnerable only during the super: hits land again the frame it ends", () => {
    const { g, p } = makeGame();
    foe(g, "rammer", 240, 80);
    cast(g);
    until(g, () => g.cast?.stage === "strike");
    expect(p.takeHit(1, 0, 0, 0)).toBe(false);
    until(g, () => !g.cast);
    expect(p.casting).toBe(false);
    expect(p.superHidden).toBe(false);
    expect(p.superFrame).toBe(-1);
    expect(p.sunShield).toBe(0);
    expect(p.invuln).toBeLessThanOrEqual(0);
    expect(p.takeHit(1, 0, 0, 0)).toBe(true);
  });

  it("boss: at most 10% of its max HP, and she lands away from a boss standing in the middle", () => {
    const { g, p } = makeGame();
    const b = new Boss(1000);
    b.spawn = 0;
    b.x = ROOM.w / 2;
    b.y = ROOM.h / 2;
    g.boss = b;
    foe(g, "rammer", 240, 80);
    cast(g);
    until(g, () => !g.cast);
    const dealt = b.maxHp - b.hp;
    expect(dealt).toBeGreaterThanOrEqual(b.maxHp * 0.08 - 1e-6);
    expect(dealt).toBeLessThanOrEqual(b.maxHp * 0.1 + 1e-6);
    expect(b.dead).toBe(false);
    expect(Math.hypot(p.x - b.x, p.y - b.y)).toBeGreaterThanOrEqual(b.size / 2 + 20);
  });
});

describe("MING KESIM: kartalar", () => {
  it("IKKINCHI NAFAS gives 25% of the orb back; GULBARG PARDASI gives 2 s of petal veil", () => {
    const { g, p } = makeGame();
    p.secondBreath = true;
    p.petalVeil = true;
    foe(g, "rammer", 240, 80);
    cast(g);
    until(g, () => !g.cast);
    expect(SECOND_BREATH).toBeCloseTo(0.25);
    expect(g.superMeter.ratio).toBeCloseTo(0.25);
    expect(PETAL_VEIL_TIME).toBe(2);
    expect(p.sunShield).toBeCloseTo(PETAL_VEIL_TIME, 1);
    expect(p.takeHit(1, 0, 0, 0)).toBe(false);
    // parda chiziladi (xavf ranglarisiz)
    const r = recorder();
    renderPetalVeil(r.ctx, 100, 100, 1, 1.5, DEFAULT_THEME.samurai);
    expect(r.colors.size).toBeGreaterThan(0);
  });

  it("both are rare SUPER cards that only the Samurai can roll", () => {
    for (const id of ["secondbreath", "petalveil"]) {
      const u = UPGRADES.find((x) => x.id === id)!;
      expect(u.hero).toBe("samurai");
      expect(u.super).toBe("thousand-cuts");
      expect(u.tags).toEqual(["super"]);
      expect(u.rare).toBe(SUPER_CARD_CHANCE);
      expect(UPGRADE_ICONS[id]).toHaveLength(12);
      for (const row of UPGRADE_ICONS[id]!) expect(row).toMatch(/^[.XAQUVZ]{12}$/);
    }
    expect(UPGRADES.find((x) => x.id === "secondbreath")!.name).toBe("IKKINCHI NAFAS");
    expect(UPGRADES.find((x) => x.id === "petalveil")!.name).toBe("GULBARG PARDASI");
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++)
      for (const u of pickUpgrades(new Player("samurai"))) seen.add(u.id);
    expect(seen.has("secondbreath")).toBe(true);
    expect(seen.has("petalveil")).toBe(true);
    for (const h of HEROES.filter((x) => x !== "samurai"))
      for (let i = 0; i < 100; i++)
        for (const u of pickUpgrades(new Player(h)))
          expect(["secondbreath", "petalveil"]).not.toContain(u.id);
  });
});

describe("MING KESIM: ko'rinish", () => {
  it("new sprite frames: closed-eye focus with the katana sheathed, then a blade sliding home", () => {
    const F = SAMURAI_SUPER_FRAME;
    const fr = (f: number) => spritePixels("samurai", "attack", f).join(",");
    const all = [F.focus, F.focusWind, F.sheatheLong, F.sheatheHalf].map(fr);
    expect(new Set(all).size).toBe(4);
    expect(fr(F.focus)).not.toBe(fr(SAMURAI_FRAME.charge));
    const white = (f: number) => spritePixels("samurai", "attack", f).filter((c) => c === 5).length;
    // tig' qinga kirgani sari kamroq ko'rinadi
    expect(white(F.sheatheLong)).toBeGreaterThan(white(F.sheatheHalf));
    expect(white(F.sheatheHalf)).toBeGreaterThan(white(F.focus));
  });

  it("the anime cut-in face: code-drawn, five colours, eyes snap from closed to open", () => {
    const open = portraitPixels("samurai")!;
    const closed = portraitPixels("samurai", "closed")!;
    expect(open.length).toBe(PORTRAIT_GRID * PORTRAIT_GRID);
    for (const c of [1, 2, 3, 4, 5]) expect(open.includes(c)).toBe(true);
    expect(open.join(",")).not.toBe(closed.join(","));
    // ochiq ko'zda pushti qorachiq ko'proq
    const pink = (d: Uint8Array) => d.filter((c) => c === 3).length;
    expect(pink(open)).toBeGreaterThan(pink(closed));
    // to'liq ekranli oq chaqnash: kirishda va ko'z ochilganda (kamaytirilganda — yo'q)
    const flashes = (k: number, reduced: boolean) => {
      let fill = "";
      let n = 0;
      const ctx = new Proxy(
        {},
        {
          get: (_, key) =>
            key === "createLinearGradient" || key === "createRadialGradient"
              ? () => ({ addColorStop: () => {} })
              : key === "fillRect"
                ? (_x: number, _y: number, w: number, h: number) => {
                    if (w >= 320 && h >= 240 && fill.startsWith("rgba(255,255,255")) n++;
                  }
                : () => {},
          set: (_, key, v) => {
            if (key === "fillStyle") fill = String(v);
            return true;
          },
        },
      ) as unknown as CanvasRenderingContext2D;
      renderAnimeCard(
        ctx,
        def(),
        { t: k * def().card.time, cardTime: def().card.time },
        DEFAULT_THEME.samurai,
        null,
        null,
        "#2a1e3c",
        () => {},
        reduced,
      );
      return n;
    };
    for (const k of [0.02, CARD_SNAP + 0.01]) {
      expect(flashes(k, false), `k=${k}`).toBeGreaterThan(0);
      expect(flashes(k, true), `k=${k}`).toBe(0);
    }
    for (const k of [0.2, 0.6, 0.95]) expect(flashes(k, false)).toBe(0);
  });

  it("'Red moon' cuts are crescents, other skins draw straight cuts in their own colours", () => {
    const d = def();
    const run = (flair: string | null, T: SkinTheme) => {
      const s = new CutsScene();
      const c = new SuperCast(d, 0);
      const ctx = ctxFor(T, false, flair);
      s.stage("prep", c, ctx);
      c.update(d.stages.prep);
      s.stage("strike", c, ctx);
      const r = recorder();
      for (let i = 0; i < 30; i++) {
        s.update(0.02, c, ctx);
        s.renderAir(r.ctx, c, ctx);
      }
      return r;
    };
    const moon = SKINS.samurai.find((k) => k.id === "samurai-moon")!;
    expect(run("moon", moon.theme).calls).toContain("arc");
    expect(run(null, DEFAULT_THEME.samurai).calls).not.toContain("arc");
    // oq-qora: "saturation" aralashmasi bilan
    expect(run(null, DEFAULT_THEME.samurai).calls).toContain("op:saturation");
  });

  it("colours come from the skin theme and stay far from the danger colours", () => {
    const d = def();
    const themes = [DEFAULT_THEME.samurai, ...SKINS.samurai.map((k) => k.theme)];
    for (const T of themes) {
      const s = new CutsScene();
      const c = new SuperCast(d, 0);
      const ctx = ctxFor(T);
      const r = recorder();
      s.stage("prep", c, ctx);
      for (const st of ["strike", "after"] as const) {
        c.update(c.stageTime);
        s.stage(st, c, ctx);
        if (st === "strike")
          s.mark({ x: 200, y: 100, size: 12, sprite: ENEMY_SPRITE.rammer }, false, c, ctx);
        for (let i = 0; i < 14; i++) {
          s.update(0.06, c, ctx);
          s.renderAir(r.ctx, c, ctx);
          s.renderGround(r.ctx, c, ctx);
        }
      }
      s.release(c, ctx);
      s.hit({ x: 200, y: 100, size: 12, sprite: ENEMY_SPRITE.rammer }, false, true, c, ctx);
      for (let i = 0; i < 14; i++) {
        s.update(0.06, c, ctx);
        s.renderAir(r.ctx, c, ctx);
      }
      for (const col of r.colors) {
        const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(col);
        const hex = m
          ? `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`
          : col.slice(0, 7);
        for (const dc of DANGER_COLORS)
          expect(colorDistance(hex, dc), `${hex} vs ${dc}`).toBeGreaterThan(60);
      }
    }
  }, 20_000);

  it("'Reduce effects': fewer cuts and petals, no white flashes", () => {
    const d = def();
    for (const reduced of [false, true]) {
      const s = new CutsScene();
      const c = new SuperCast(d, 0);
      const ctx = ctxFor(DEFAULT_THEME.samurai, reduced);
      s.stage("prep", c, ctx);
      c.update(d.stages.prep);
      s.stage("strike", c, ctx);
      expect(s.slashes.length).toBe(reduced ? d.params["slashesReduced"] : d.params["slashes"]);
      for (let i = 0; i < 12; i++)
        s.hit(
          { x: 20 + i * 20, y: 100, size: 12, sprite: ENEMY_SPRITE.rammer },
          false,
          true,
          c,
          ctx,
        );
      let most = 0;
      for (let i = 0; i < 120; i++) {
        s.update(0.02, c, ctx);
        most = Math.max(most, s.petals.length);
      }
      s.release(c, ctx);
      expect(most).toBeLessThanOrEqual(reduced ? MAX_PETALS_REDUCED : MAX_PETALS);
      if (reduced) expect(s.flash).toBe(0);
      else expect(most).toBeGreaterThanOrEqual(STORM_PETALS * 0.8);
    }
  });
});

describe("MING KESIM: onlayn olamda hozircha yo'q", () => {
  it("the Samurai in the realm never enters a super", () => {
    const sim = new RealmSim(loadRealmData());
    const rp = sim.addPlayer("p1", "samurai");
    for (const key of ["superMeter", "orb", "cast", "scene"]) expect(key in sim, key).toBe(false);
    for (let i = 0; i < 60; i++) sim.step([]);
    expect(rp.p.casting).toBe(false);
    expect(rp.p.superFrame).toBe(-1);
    expect(rp.p.superHidden).toBe(false);
  });
});
