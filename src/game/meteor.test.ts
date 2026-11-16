import { beforeEach, describe, expect, it } from "vitest";
import { Game } from "./game";
import { Enemy, ENEMY_HP } from "./enemy";
import { Boss } from "./boss";
import { HEROES } from "./hero";
import { Player } from "./player";
import { DEFAULT_SETTINGS, saveSettings } from "./settings";
import { colorDistance, DANGER_COLORS, dangerDistance } from "./danger";
import { SKINS, SKINS_KEY } from "./skins";
import { DEFAULT_THEME, type SkinTheme } from "./skinFx";
import { ROOM } from "./animation";
import { Effects } from "./effects";
import { sfx } from "./audio";
import { SUPERS, SuperCast, impactPoint, impactZone, rainDrops, superFor } from "./super";
import { sceneFor, type SceneCtx } from "./superScene";
import {
  MAX_ROCKS,
  MAX_ROCKS_REDUCED,
  MeteorScene,
  RUNE_DANGER_GAP,
  meteorCardFrame,
  meteorColors,
} from "./meteorFx";
import {
  MAGE_PORTRAIT_COLORS,
  MAGE_PORTRAIT_GRID,
  MAGE_PORTRAIT_STYLES,
  magePortraitPixels,
} from "./magePortrait";
import { MAGE_SUPER_FRAME, UPGRADE_ICONS, spritePixels } from "./sprites";
import { SUPER_CARD_CHANCE, UPGRADES, WAVES, WAVES2, BOSS_WAVE, pickUpgrades } from "./waves";
import { RealmSim } from "@/realm/sim";
import { loadRealmData } from "@/realm/data";

const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
const DT = 1 / 60;
const def = () => superFor("mage")!;
const I = () => def().impact!;

/** Sehrgar xona chap tomonida, o'ngga qarab turadi */
function makeGame(skin?: string) {
  if (skin) localStorage.setItem(SKINS_KEY, JSON.stringify({ owned: [skin], sel: { mage: skin } }));
  const g = new Game(canvas as unknown as HTMLCanvasElement, "mage");
  g.hints = [];
  g.enemies = [];
  g.banner.timer = 0;
  g.player.x = 50;
  g.player.y = 120;
  g.player.fx = 1;
  g.player.fy = 0;
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

const scene = (g: Game) => g.scene as MeteorScene;

/** To'da: markazda 3 ta, chetda 2 ta, uzoqda 1 ta (200, 120 atrofida) */
function pack(g: Game) {
  return {
    core: [foe(g, "rammer", 200, 120), foe(g, "rammer", 210, 112), foe(g, "rammer", 192, 128)],
    ring: [foe(g, "rammer", 255, 120), foe(g, "rammer", 200, 175)],
    far: foe(g, "rammer", 60, 30),
  };
}

function recorder() {
  const colors = new Set<string>();
  const grad = { addColorStop: (_: number, c: string) => colors.add(c) };
  const ctx = new Proxy(
    {},
    {
      get: (_, k) =>
        k === "createLinearGradient" || k === "createRadialGradient"
          ? () => grad
          : k === "globalAlpha"
            ? 1
            : () => {},
      set: (_, k, v) => {
        if ((k === "fillStyle" || k === "strokeStyle") && typeof v === "string") colors.add(v);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, colors };
}

function ctxFor(T: SkinTheme, reduced = false, flair: string | null = null): SceneCtx {
  const fx = new Effects();
  fx.reduced = reduced;
  return {
    x: 60,
    y: 120,
    dir: 1,
    theme: T,
    reduced,
    fx,
    shake: () => {},
    view: { x: 0, y: 0, w: 320, h: 240 },
    flair,
  };
}

/** Sahnani to'liq ijro etadi (kartasiz, Game'siz) */
function playScene(T: SkinTheme, reduced = false, flair: string | null = null) {
  const d = def();
  const s = new MeteorScene();
  const c = new SuperCast(d, 0);
  c.spot = { x: 200, y: 120 };
  c.craterTime = d.impact!.crater.time;
  const ctx = ctxFor(T, reduced, flair);
  const r = recorder();
  let most = 0;
  const run = (n: number) => {
    for (let i = 0; i < n; i++) {
      c.update(0.03);
      s.update(0.03, c, ctx);
      s.renderGround(r.ctx, c, ctx);
      s.renderAir(r.ctx, c, ctx);
      most = Math.max(most, s.rocks.length);
    }
  };
  s.stage("prep", c, ctx);
  run(10);
  c.update(c.stageTime);
  s.stage("strike", c, ctx);
  run(10);
  c.landed = true;
  let held = 2.5;
  s.hit({ x: 250, y: 120, size: 12, hold: () => held }, false, false, c, ctx);
  run(10);
  held = 0;
  c.update(c.stageTime);
  s.stage("after", c, ctx);
  run(40);
  return { s, r, most };
}

beforeEach(() => {
  localStorage.clear();
  saveSettings({ ...DEFAULT_SETTINGS });
});

describe("OSMON TOSHI: ma'lumot", () => {
  it("is open: ~0.8 / 0.7 / 1 s, one impact point and a strict boss cap", () => {
    const d = def();
    expect(d.name).toBe("OSMON TOSHI");
    expect(d.id).toBe("sky-stone");
    expect(d.open).toBe(true);
    expect(d.stages.prep).toBeCloseTo(0.8);
    expect(d.stages.strike).toBeCloseTo(0.7);
    expect(d.stages.after).toBeCloseTo(1);
    expect(d.time).toBeCloseTo(d.stages.prep + d.stages.strike + d.stages.after);
    // meteorit zarba bosqichi ichida uriladi
    expect(I().at).toBeGreaterThan(0.2);
    expect(I().at).toBeLessThan(d.stages.strike);
    expect(I().ring).toBeGreaterThan(I().core);
    // chetdagilar 2–3 s qotadi, boss 1 s
    expect(I().stun).toBeGreaterThanOrEqual(2);
    expect(I().stun).toBeLessThanOrEqual(3);
    expect(d.after.bossKneel).toBeCloseTo(1);
    expect(d.dmg.boss).toBeGreaterThanOrEqual(0.08);
    expect(d.dmg.bossCap).toBeLessThanOrEqual(0.1);
    expect(d.card.anime).toBeFalsy();
    expect(sceneFor(d.fx)).toBeInstanceOf(MeteorScene);
    // faqat Sehrgarda meteorit
    for (const s of Object.values(SUPERS)) expect(!!s.impact).toBe(s.hero === "mage");
  });

  it("every sound it names exists, and the orb fills about once every 1–2 waves", () => {
    for (const snd of [...Object.values(def().sounds), "meteorPetrify", "meteorSmall"])
      expect(typeof (sfx as unknown as Record<string, unknown>)[snd!], snd).toBe("function");
    for (const waves of [WAVES, WAVES2]) {
      const hp = waves.slice(0, BOSS_WAVE).map((w) => w.reduce((s, k) => s + ENEMY_HP[k], 0));
      const avg = hp.reduce((a, b) => a + b, 0) / hp.length;
      expect(def().charge / avg).toBeGreaterThanOrEqual(0.7);
      expect(def().charge / avg).toBeLessThanOrEqual(2);
    }
  });

  it("aims at the densest pack, or the joystick direction, and stays inside the room", () => {
    const d = def();
    const from = { x: 50, y: 120 };
    const face = { x: 1, y: 0 };
    const mobs = [
      { x: 80, y: 40 },
      { x: 220, y: 150 },
      { x: 230, y: 160 },
      { x: 225, y: 140 },
    ];
    const spot = impactPoint(d, from, face, mobs, ROOM);
    expect(Math.hypot(spot.x - 225, spot.y - 150)).toBeLessThan(15);
    // boss uch baravar og'ir
    const withBoss = impactPoint(d, from, face, [...mobs, { x: 90, y: 50, boss: true }], ROOM);
    expect(Math.hypot(withBoss.x - 85, withBoss.y - 45)).toBeLessThan(15);
    // joystik: o'sha tomonga range px
    const up = impactPoint(d, from, face, mobs, ROOM, { x: 0, y: -1 });
    expect(up.x).toBeCloseTo(50);
    expect(up.y).toBeLessThan(from.y);
    // nishon yo'q — qarash tomoniga
    const none = impactPoint(d, from, face, [], ROOM);
    expect(none.x).toBeCloseTo(50 + I().range);
    // xona chetiga yopishmaydi
    const edge = impactPoint(d, { x: 300, y: 230 }, face, [], ROOM);
    expect(edge.x).toBeLessThan(ROOM.w);
    expect(edge.y).toBeLessThan(ROOM.h);
  });

  it("zones: core dies, ring is thrown and frozen, the rest is untouched", () => {
    const d = def();
    const spot = { x: 100, y: 100 };
    expect(impactZone(d, spot, { x: 100 + I().core - 1, y: 100 })).toBe("core");
    expect(impactZone(d, spot, { x: 100 + I().ring - 1, y: 100 })).toBe("ring");
    expect(impactZone(d, spot, { x: 100 + I().ring + 20, y: 100 })).toBeNull();
    const drops = rainDrops(d, spot, [{ x: 160, y: 100 }], ROOM);
    expect(drops).toHaveLength(I().rain.n);
    expect(drops[0]).toMatchObject({ x: 160, y: 100 });
    for (const dr of drops) expect(dr.at).toBeLessThan(d.stages.after);
  });
});

describe("OSMON TOSHI: o'yinda", () => {
  it("the core dies, the ring is thrown back and frozen in stone for ~2.5 s, far foes untouched", () => {
    const { g } = makeGame();
    const { core, ring, far } = pack(g);
    cast(g);
    expect(g.cast!.spot).toBeDefined();
    until(g, () => !!g.cast?.landed);
    for (const e of core) expect(e.dead).toBe(true);
    for (const e of ring) {
      expect(e.dead).toBe(false);
      expect(e.stun).toBeCloseTo(I().stun, 1);
      expect(g.stoned.has(e)).toBe(true);
      // markazdan tashqariga uloqtirildi
      const spot = g.cast!.spot!;
      expect(e.vx * (e.x - spot.x) + e.vy * (e.y - spot.y)).toBeGreaterThan(0);
    }
    expect(far.dead).toBe(false);
    expect(far.stun).toBe(0);
    // tosh qobiq sahnada
    expect(scene(g).stones.length).toBe(2);
    until(g, () => !g.cast);
    // dunyo vaqti bilan ~2.5 s dan keyin qotish tugaydi
    const t = until(g, () => !g.stoned.has(ring[0]!), 6);
    expect(t).toBeGreaterThan(0.8);
    expect(t).toBeLessThan(I().stun + 0.2);
  });

  it("frozen foes cannot hurt by touch", () => {
    const { g, p } = makeGame();
    const { ring } = pack(g);
    cast(g);
    until(g, () => !g.cast);
    const e = ring[0]!;
    expect(g.stoned.has(e)).toBe(true);
    p.invuln = 0;
    p.x = e.x;
    p.y = e.y;
    const hp = p.hp;
    g.update(DT);
    expect(p.hp).toBe(hp);
  });

  it("the Mage raises the staff, points after the impact, then stands again", () => {
    const { g, p } = makeGame();
    pack(g);
    cast(g);
    const seen = new Set<number>();
    until(g, () => {
      if (p.casting) seen.add(p.superFrame);
      return !g.cast;
    });
    for (const f of [MAGE_SUPER_FRAME.raise, MAGE_SUPER_FRAME.point, MAGE_SUPER_FRAME.rest])
      expect(seen.has(f), String(f)).toBe(true);
    // joyidan qo'zg'almaydi
    expect(p.x).toBeCloseTo(50);
  });

  it("invulnerable only during the super: hits land again the frame it ends", () => {
    const { g, p } = makeGame();
    pack(g);
    cast(g);
    until(g, () => g.cast?.stage === "strike");
    expect(p.takeHit(1, 0, 0, 0)).toBe(false);
    until(g, () => !g.cast);
    expect(p.casting).toBe(false);
    expect(p.superFrame).toBe(-1);
    expect(p.invuln).toBeLessThanOrEqual(0);
    expect(p.takeHit(1, 0, 0, 0)).toBe(true);
  });

  it("boss: 8–10% of its max HP at most (even with METEOR YOMG'IRI) and it freezes for ~1 s", () => {
    for (const rain of [false, true]) {
      const { g, p } = makeGame();
      p.meteorRain = rain;
      const b = new Boss(1000);
      b.spawn = 0;
      b.x = 200;
      b.y = 120;
      g.boss = b;
      cast(g);
      until(g, () => !!g.cast?.landed);
      expect(b.kneel).toBeCloseTo(def().after.bossKneel, 1);
      until(g, () => !g.cast);
      const dealt = b.maxHp - b.hp;
      expect(dealt).toBeGreaterThanOrEqual(b.maxHp * 0.08 - 1e-6);
      expect(dealt).toBeLessThanOrEqual(b.maxHp * 0.1 + 1e-6);
      // krater bossga zarar bermaydi
      const hp = b.hp;
      until(g, () => false, 3);
      expect(b.hp).toBe(hp);
    }
  });

  it("the crater glows for seconds and hurts foes that walk in, without charging the orb", () => {
    const { g } = makeGame();
    pack(g);
    cast(g);
    until(g, () => !g.cast);
    expect(g.craters).toHaveLength(1);
    const k = g.craters[0]!;
    const e = foe(g, "golem", k.x, k.y);
    const hp = e.hp;
    g.superMeter.value = 0;
    until(g, () => false, 1.2);
    expect(e.hp).toBeLessThan(hp);
    // oz zarar: sekundiga bir necha birlik
    expect(hp - e.hp).toBeLessThanOrEqual(4);
    expect(g.superMeter.value).toBe(0);
    // krater so'nadi
    until(g, () => g.craters.length === 0, 8);
    expect(g.craters).toHaveLength(0);
  });
});

describe("OSMON TOSHI: kartalar", () => {
  it("METEOR YOMG'IRI drops 3 more small meteors that finish frozen foes", () => {
    const run = (rain: boolean) => {
      const { g, p } = makeGame();
      p.meteorRain = rain;
      const { ring } = pack(g);
      cast(g);
      until(g, () => !g.cast);
      return ring.filter((e) => e.dead).length;
    };
    expect(run(false)).toBe(0);
    expect(run(true)).toBe(2);
  });

  it("ABADIY KRATER keeps the embers glowing more than twice as long", () => {
    const life = (card: boolean) => {
      const { g, p } = makeGame();
      p.eternalCrater = card;
      pack(g);
      cast(g);
      until(g, () => !g.cast);
      return until(g, () => g.craters.length === 0, 20);
    };
    const a = life(false),
      b = life(true);
    expect(b).toBeGreaterThan(a * 2);
  });

  it("both are rare SUPER cards that only the Mage can roll", () => {
    for (const id of ["meteorrain", "eternalcrater"]) {
      const u = UPGRADES.find((x) => x.id === id)!;
      expect(u.hero).toBe("mage");
      expect(u.super).toBe("sky-stone");
      expect(u.tags).toEqual(["super"]);
      expect(u.rare).toBe(SUPER_CARD_CHANCE);
      expect(UPGRADE_ICONS[id]).toHaveLength(12);
    }
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) for (const u of pickUpgrades(new Player("mage"))) seen.add(u.id);
    expect(seen.has("meteorrain")).toBe(true);
    expect(seen.has("eternalcrater")).toBe(true);
    for (const h of HEROES.filter((x) => x !== "mage"))
      for (let i = 0; i < 100; i++)
        for (const u of pickUpgrades(new Player(h)))
          expect(["meteorrain", "eternalcrater"]).not.toContain(u.id);
  });
});

describe("OSMON TOSHI: skin kuch bermaydi", () => {
  it("every Mage skin gets the same super: same charge, zones, kills, freeze and boss damage", () => {
    const outcome = (skin?: string) => {
      const { g } = makeGame(skin);
      const { core, ring, far } = pack(g);
      const b = new Boss(1000);
      b.spawn = 0;
      b.x = 215;
      b.y = 120;
      g.boss = b;
      cast(g);
      const d = g.cast!.def;
      until(g, () => !g.cast);
      return {
        id: d.id,
        charge: d.charge,
        impact: JSON.stringify(d.impact),
        dead: [...core, ...ring, far].map((x) => x.dead),
        stun: ring.map((x) => Math.round(x.stun * 10)),
        boss: b.maxHp - b.hp,
        craters: g.craters.map((k) => [k.r, k.dmg, k.every]),
      };
    };
    const base = outcome();
    expect(base.dead).toEqual([true, true, true, false, false, false]);
    for (const k of SKINS.mage) expect(outcome(k.id), k.id).toEqual(base);
  });
});

describe("OSMON TOSHI: ko'rinish", () => {
  it("new sprite frames: staff raised (two), pointing and standing — all distinct", () => {
    const F = MAGE_SUPER_FRAME;
    const frames = [F.raise, F.raiseGlow, F.point, F.rest].map((f) =>
      spritePixels("mage", "attack", f).join(""),
    );
    expect(new Set(frames).size).toBe(4);
    // oddiy hujum kadrlari o'zgarmagan (super kadrlaridan farqli)
    for (const f of [0, 1, 2])
      expect(frames).not.toContain(spritePixels("mage", "attack", f).join(""));
  });

  it("the cut-in portrait: 96 px, front-facing, many tones, 3 distinct frames", () => {
    for (let s = 0; s < MAGE_PORTRAIT_STYLES; s++) {
      const frames = [0, 1, 2].map((f) => magePortraitPixels(f, s));
      for (const d of frames) {
        expect(d.length).toBe(MAGE_PORTRAIT_GRID * MAGE_PORTRAIT_GRID);
        expect(d.filter((c) => c > 0).length).toBeGreaterThan(d.length * 0.5);
        expect(new Set(d).size).toBeGreaterThan(24);
        for (const c of d) expect(c).toBeLessThanOrEqual(MAGE_PORTRAIT_COLORS.length);
      }
      expect(new Set(frames.map((d) => d.join(""))).size).toBe(3);
    }
    expect(meteorCardFrame(0)).toBe(0);
    expect(meteorCardFrame(0.5)).toBe(1);
    expect(meteorCardFrame(0.9)).toBe(2);
    // "Effektlarni kamaytirish": chaqnash kadri yo'q
    expect(meteorCardFrame(0.9, true)).toBe(1);
  });

  it("the target circle and runes stay far from the danger colours with every skin", () => {
    const themes = [DEFAULT_THEME.mage, ...SKINS.mage.map((k) => k.theme)];
    for (const T of themes) {
      const C = meteorColors(T);
      for (const col of [C.rune, C.runeLight])
        for (const dc of DANGER_COLORS)
          expect(colorDistance(col, dc), `${col} vs ${dc}`).toBeGreaterThan(RUNE_DANGER_GAP - 30);
      expect(dangerDistance(C.rune)).toBeGreaterThanOrEqual(RUNE_DANGER_GAP);
    }
    // oddiy Sehrgar: binafsha sehr (theme'da binafsha yo'q)
    expect(meteorColors(DEFAULT_THEME.mage).rune).toBe("#a040e8");
  });

  it("skins paint the super in their own colours", () => {
    const base = playScene(DEFAULT_THEME.mage).r.colors;
    for (const k of SKINS.mage.filter((x) => x.tier !== "default")) {
      const { r } = playScene(k.theme, false, null);
      expect([...r.colors].join(), k.id).not.toBe([...base].join());
    }
  });

  it("'Reduce effects': no flash and far fewer rocks; the stone shell breaks when the hold ends", () => {
    const full = playScene(DEFAULT_THEME.mage);
    const low = playScene(DEFAULT_THEME.mage, true);
    expect(full.most).toBeLessThanOrEqual(MAX_ROCKS);
    expect(low.most).toBeLessThanOrEqual(MAX_ROCKS_REDUCED);
    expect(low.most).toBeLessThan(full.most);
    expect(low.s.flash).toBe(0);
    expect(full.s.stones).toHaveLength(0);
  });

  it("the orb is purple-red magic with the default skin, and the skin's colours otherwise", () => {
    const { g } = makeGame();
    expect(g.orbTheme.accent).toBe(def().orb!.accent);
    for (const k of SKINS.mage.filter((x) => x.tier !== "default")) {
      const { g: gs } = makeGame(k.id);
      expect(gs.orbTheme.accent, k.id).toBe(k.theme.accent);
    }
  });
});

describe("OSMON TOSHI: onlayn olamda hozircha yo'q", () => {
  it("the Mage in the realm never enters a super", () => {
    const sim = new RealmSim(loadRealmData());
    const rp = sim.addPlayer("p1", "mage");
    for (const key of ["superMeter", "orb", "cast", "scene"]) expect(key in sim, key).toBe(false);
    for (let i = 0; i < 60; i++) sim.step([]);
    expect(rp.p.casting).toBe(false);
    expect(rp.p.superFrame).toBe(-1);
  });
});
