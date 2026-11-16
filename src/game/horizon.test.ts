import { beforeEach, describe, expect, it } from "vitest";
import { Game } from "./game";
import { Enemy, ENEMY_HP, ENEMY_SPRITE } from "./enemy";
import { Boss } from "./boss";
import { HEROES } from "./hero";
import { Player } from "./player";
import { DEFAULT_SETTINGS, saveSettings } from "./settings";
import { DANGER_COLORS, colorDistance } from "./danger";
import { SKINS, SKINS_KEY } from "./skins";
import { DEFAULT_THEME, type SkinTheme } from "./skinFx";
import { ROOM } from "./animation";
import { Effects } from "./effects";
import { sfx } from "./audio";
import { SUPERS, SuperCast, pathHit, pathsHit, superFor, superPaths } from "./super";
import { sceneFor, type SceneCtx } from "./superScene";
import {
  HorizonScene,
  MAX_BITS,
  MAX_BITS_REDUCED,
  MAX_CRYSTALS_REDUCED,
  SPLIT_TIME,
  bladeGlint,
  renderHorizonCard,
} from "./horizonFx";
import { KNIGHT_PORTRAIT_VARIANTS, portraitColors, portraitGrid, portraitPixels } from "./portrait";
import { KNIGHT_PORTRAIT_COLORS, KNIGHT_PORTRAIT_GRID } from "./knightPortrait";
import { KNIGHT_SUPER_FRAME, PALETTES, UPGRADE_ICONS, spritePixels } from "./sprites";
import { SUPER_CARD_CHANCE, UPGRADES, WAVES, WAVES2, BOSS_WAVE, pickUpgrades } from "./waves";
import { RealmSim } from "@/realm/sim";
import { loadRealmData } from "@/realm/data";

const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
const DT = 1 / 60;
const def = () => superFor("knight")!;

/** Ritsar xona chap tomonida, o'ngga qarab turadi */
function makeGame(skin?: string) {
  if (skin)
    localStorage.setItem(SKINS_KEY, JSON.stringify({ owned: [skin], sel: { knight: skin } }));
  const g = new Game(canvas as unknown as HTMLCanvasElement, "knight");
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

const scene = (g: Game) => g.scene as HorizonScene;
/** Sinovdagi dushman (rammer) ranglari: bo'laklar shu rangda sochiladi */
const RAMMER = new Set(PALETTES[ENEMY_SPRITE.rammer].map((c) => c.toLowerCase()));

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

/** Sahnani to'liq ijro etadi (kartasiz): har bosqich, bitta dushman belgisi va bo'linishi */
function playScene(T: SkinTheme, reduced = false, flair: string | null = null, foes = 1) {
  const d = def();
  const s = new HorizonScene();
  const c = new SuperCast(d, 0);
  const ctx = ctxFor(T, reduced, flair);
  c.paths = superPaths(d, ctx, c.aim, ROOM, { double: true, wide: true });
  const r = recorder();
  const targets = Array.from({ length: foes }, (_, i) => ({
    x: 120 + (i % 10) * 18,
    y: 100 + Math.floor(i / 10) * 14,
    size: 12,
    ref: { i },
    sprite: ENEMY_SPRITE.rammer,
  }));
  s.stage("prep", c, ctx);
  let most = 0;
  const run = (n: number) => {
    for (let i = 0; i < n; i++) {
      c.update(0.03);
      s.update(0.03, c, ctx);
      s.renderGround(r.ctx, c, ctx);
      s.renderAir(r.ctx, c, ctx);
      most = Math.max(most, s.bits.length);
    }
  };
  run(10);
  c.update(c.stageTime);
  s.stage("strike", c, ctx);
  for (const t of targets) s.mark(t, false, c, ctx);
  run(20);
  c.update(c.stageTime);
  s.stage("after", c, ctx);
  s.release(c, ctx);
  for (const t of targets) s.hit(t, false, true, c, ctx);
  run(30);
  return { s, r, most };
}

beforeEach(() => {
  localStorage.clear();
  saveSettings({ ...DEFAULT_SETTINGS });
});

describe("UFQ KESIMI: ma'lumot", () => {
  it("is open: ~0.5 / 0.8 / 0.8 s, a directional cut wave and a strict boss cap", () => {
    const d = def();
    expect(d.name).toBe("UFQ KESIMI");
    expect(d.id).toBe("horizon-cut");
    expect(d.open).toBe(true);
    expect(d.stages.prep).toBeCloseTo(0.5);
    expect(d.stages.strike).toBeCloseTo(0.8);
    expect(d.stages.after).toBeCloseTo(0.8);
    expect(d.time).toBeCloseTo(d.stages.prep + d.stages.strike + d.stages.after);
    // "SHING!" — oqibat ichida, Ritsar qilichni silkitishga ulgurgach
    expect(d.release).toBeGreaterThan(0.1);
    expect(d.release).toBeLessThan(d.stages.after * 0.6);
    // yo'nalishli kesim: xona bo'ylab zarba bosqichiga sig'adi
    expect(d.path).toBeDefined();
    expect(Math.hypot(ROOM.w, ROOM.h) / d.path!.speed).toBeLessThan(d.stages.strike + 0.05);
    expect(d.path!.half1).toBeGreaterThan(d.path!.half0);
    // bossga 8–10% dan oshmaydi
    expect(d.dmg.boss).toBeGreaterThanOrEqual(0.08);
    expect(d.dmg.bossCap).toBeLessThanOrEqual(0.1);
    expect(d.dmg.kill).toBe(true);
    // oddiy cut-in (anime emas)
    expect(d.card.anime).toBeFalsy();
    expect(sceneFor(d.fx)).toBeInstanceOf(HorizonScene);
    // faqat Ritsarda yo'nalishli kesim
    for (const s of Object.values(SUPERS)) expect(!!s.path).toBe(s.hero === "knight");
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

  it("the cut wave reaches the wall, grows as it flies and only covers its own band", () => {
    const d = def();
    const [p] = superPaths(d, { x: 50, y: 120 }, { x: 1, y: 0 }, ROOM);
    expect(p!.len).toBeCloseTo(ROOM.w - 50);
    expect(pathHit(p!, { x: 100, y: 120 })).toBeCloseTo(50 / d.path!.speed);
    // uchgan sari kattalashadi: yaqinda tor, uzoqda keng
    expect(pathHit(p!, { x: 70, y: 120 + d.path!.half1 - 2 })).toBeNull();
    expect(pathHit(p!, { x: 300, y: 120 + d.path!.half1 - 6 })).not.toBeNull();
    // orqada va chetda — yo'q
    expect(pathHit(p!, { x: 20, y: 120 })).toBeNull();
    expect(pathHit(p!, { x: 200, y: 20 })).toBeNull();
    // QO'SH UFQ: orqaga ham, biroz keyin; KENG TIG': balandroq
    const both = superPaths(d, { x: 160, y: 120 }, { x: 1, y: 0 }, ROOM, { double: true });
    expect(both).toHaveLength(2);
    expect(pathsHit(both, { x: 60, y: 120 })).toBeGreaterThan(d.path!.backDelay);
    const [wide] = superPaths(d, { x: 50, y: 120 }, { x: 1, y: 0 }, ROOM, { wide: true });
    expect(wide!.half1).toBeCloseTo(d.path!.half1 * d.path!.wide);
    // diagonal: xona burchagigacha
    const [diag] = superPaths(d, { x: 160, y: 120 }, { x: 1, y: -1 }, ROOM);
    expect(diag!.len).toBeCloseTo(120 * Math.SQRT2);
  });
});

describe("UFQ KESIMI: o'yinda", () => {
  it("prep: the Knight kneels, the blade glows and air is drawn into it", () => {
    const { g, p } = makeGame();
    foe(g, "rammer", 220, 120);
    cast(g);
    expect(g.cast!.stage).toBe("card");
    expect(p.superFrame).toBe(-1);
    until(g, () => g.cast?.stage === "prep");
    until(g, () => (g.cast?.t ?? 1) > 0.35);
    expect(g.cast!.stage).toBe("prep");
    expect([KNIGHT_SUPER_FRAME.kneel, KNIGHT_SUPER_FRAME.kneelGlow]).toContain(p.superFrame);
    expect(scene(g).glow).toBeGreaterThan(0.6);
    expect(scene(g).motes.length).toBeGreaterThan(10);
    expect(g.cast!.worldSpeed).toBeLessThan(0.3);
  });

  it("strike: only enemies in the wave's path freeze with a cut; the rest are untouched", () => {
    const { g, p } = makeGame();
    const inPath = [foe(g, "rammer", 120, 120), foe(g, "golem", 250, 130)];
    const off = [foe(g, "rammer", 120, 30), foe(g, "spider", 20, 200)];
    cast(g);
    until(g, () => g.cast?.stage === "strike");
    expect(p.superFrame).toBe(KNIGHT_SUPER_FRAME.slash);
    expect(scene(g).waves).toHaveLength(1);
    expect(g.cast!.worldSpeed).toBeLessThanOrEqual(0.05);
    until(g, () => g.cast?.stage !== "strike");
    // kesim o'tdi: hamma hali tirik, faqat yo'ldagilarda kesik chizig'i
    for (const e of [...inPath, ...off]) expect(e.dead).toBe(false);
    expect(scene(g).pending.size).toBe(2);
    for (const e of inPath) expect(scene(g).pending.has(e)).toBe(true);
    // "SHING!": yo'ldagilar birdan bo'linadi, chetdagilar omon
    until(g, () => g.cast!.released);
    for (const e of inPath) expect(e.dead).toBe(true);
    for (const e of off) expect(e.dead).toBe(false);
    expect(scene(g).halves.length).toBe(g.cast!.kills);
    // Qor odam (golem) bolalari ham yo'lda — shu "SHING!" da kesiladi
    expect(g.cast!.kills).toBeGreaterThan(2);
    for (let t = 0; t < SPLIT_TIME + 0.05; t += DT) g.update(DT);
    expect(scene(g).bits.length).toBeGreaterThan(10);
    until(g, () => !g.cast);
    expect(g.enemies.filter((e) => !e.dead)).toEqual(off);
  });

  it("the wave flies where the joystick points, and the Knight turns that way", () => {
    const { g, p } = makeGame();
    p.x = 160;
    const up = foe(g, "rammer", 160, 40);
    const right = foe(g, "rammer", 280, 120);
    g.input.setTouchAxis(0, -1);
    cast(g);
    expect(g.cast!.aim.y).toBeCloseTo(-1);
    expect(p.fy).toBe(-1);
    g.input.setTouchAxis(0, 0);
    until(g, () => !g.cast);
    expect(up.dead).toBe(true);
    expect(right.dead).toBe(false);
    // joystik qo'yib yuborilgan — qarab turgan tomonga
    const b = makeGame();
    b.p.fx = -1;
    const left = foe(b.g, "rammer", 10, 120);
    const ahead = foe(b.g, "rammer", 200, 120);
    cast(b.g);
    expect(b.g.cast!.aim.x).toBeCloseTo(-1);
    until(b.g, () => !b.g.cast);
    expect(left.dead).toBe(true);
    expect(ahead.dead).toBe(false);
  });

  it("aftermath: he flicks the sword at the 'SHING!' and stands up again", () => {
    const { g, p } = makeGame();
    foe(g, "rammer", 200, 120);
    cast(g);
    until(g, () => g.cast?.stage === "after");
    expect(p.superFrame).toBe(KNIGHT_SUPER_FRAME.follow);
    const seen = new Set<number>();
    until(g, () => {
      seen.add(p.superFrame);
      return !g.cast;
    });
    expect([...seen]).toEqual(
      expect.arrayContaining([KNIGHT_SUPER_FRAME.flick, KNIGHT_SUPER_FRAME.rise]),
    );
    // joyidan qo'zg'almaydi (markazga o'tmaydi)
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(120);
  });

  it("invulnerable only during the super: hits land again the frame it ends", () => {
    const { g, p } = makeGame();
    foe(g, "rammer", 200, 120);
    cast(g);
    until(g, () => g.cast?.stage === "strike");
    expect(p.takeHit(1, 0, 0, 0)).toBe(false);
    until(g, () => !g.cast);
    expect(p.casting).toBe(false);
    expect(p.superFrame).toBe(-1);
    expect(p.sunShield).toBe(0);
    expect(p.invuln).toBeLessThanOrEqual(0);
    expect(p.takeHit(1, 0, 0, 0)).toBe(true);
  });

  it("boss in the path: 8–10% of its max HP at most; a boss out of the path takes nothing", () => {
    for (const cards of [false, true]) {
      const { g, p } = makeGame();
      p.doubleHorizon = p.wideBlade = cards;
      const b = new Boss(1000);
      b.spawn = 0;
      b.x = 230;
      b.y = 120;
      g.boss = b;
      cast(g);
      until(g, () => !g.cast);
      const dealt = b.maxHp - b.hp;
      expect(dealt).toBeGreaterThanOrEqual(b.maxHp * 0.08 - 1e-6);
      expect(dealt).toBeLessThanOrEqual(b.maxHp * 0.1 + 1e-6);
      expect(b.dead).toBe(false);
    }
    const { g, p } = makeGame();
    p.fx = 0;
    p.fy = 1;
    const b = new Boss(1000);
    b.spawn = 0;
    b.x = 230;
    b.y = 40;
    g.boss = b;
    cast(g);
    until(g, () => !g.cast);
    expect(b.hp).toBe(b.maxHp);
  });
});

describe("UFQ KESIMI: kartalar", () => {
  it("QO'SH UFQ also cuts behind; KENG TIG' cuts a taller band", () => {
    const run = (double: boolean, wide: boolean) => {
      const { g, p } = makeGame();
      p.x = 160;
      p.doubleHorizon = double;
      p.wideBlade = wide;
      const behind = foe(g, "rammer", 40, 120);
      const high = foe(g, "rammer", 300, 120 + def().path!.half1 + 14);
      cast(g);
      until(g, () => g.cast?.stage === "strike");
      expect(scene(g).waves).toHaveLength(double ? 2 : 1);
      until(g, () => !g.cast);
      return { behind: behind.dead, high: high.dead };
    };
    expect(run(false, false)).toEqual({ behind: false, high: false });
    expect(run(true, false)).toEqual({ behind: true, high: false });
    expect(run(false, true)).toEqual({ behind: false, high: true });
  });

  it("both are rare SUPER cards that only the Knight can roll", () => {
    for (const id of ["doublehorizon", "wideblade"]) {
      const u = UPGRADES.find((x) => x.id === id)!;
      expect(u.hero).toBe("knight");
      expect(u.super).toBe("horizon-cut");
      expect(u.tags).toEqual(["super"]);
      expect(u.rare).toBe(SUPER_CARD_CHANCE);
      expect(UPGRADE_ICONS[id]).toHaveLength(12);
      for (const row of UPGRADE_ICONS[id]!) expect(row).toMatch(/^[.XAQUVZ]{12}$/);
    }
    expect(UPGRADES.find((x) => x.id === "doublehorizon")!.name).toBe("QO'SH UFQ");
    expect(UPGRADES.find((x) => x.id === "wideblade")!.name).toBe("KENG TIG'");
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++)
      for (const u of pickUpgrades(new Player("knight"))) seen.add(u.id);
    expect(seen.has("doublehorizon")).toBe(true);
    expect(seen.has("wideblade")).toBe(true);
    for (const h of HEROES.filter((x) => x !== "knight"))
      for (let i = 0; i < 100; i++)
        for (const u of pickUpgrades(new Player(h)))
          expect(["doublehorizon", "wideblade"]).not.toContain(u.id);
  });
});

describe("UFQ KESIMI: skin kuch bermaydi", () => {
  it("every Knight skin gets the same super: same charge, path, kills and boss damage", () => {
    const outcome = (skin?: string) => {
      const { g } = makeGame(skin);
      const e = [foe(g, "rammer", 120, 120), foe(g, "rammer", 260, 150), foe(g, "rammer", 120, 30)];
      const b = new Boss(1000);
      b.spawn = 0;
      b.x = 200;
      b.y = 100;
      g.boss = b;
      cast(g);
      const d = g.cast!.def;
      until(g, () => !g.cast);
      return {
        id: d.id,
        charge: d.charge,
        path: JSON.stringify(d.path),
        dead: e.map((x) => x.dead),
        boss: b.maxHp - b.hp,
      };
    };
    const base = outcome();
    expect(base.dead).toEqual([true, true, false]);
    for (const k of SKINS.knight) expect(outcome(k.id), k.id).toEqual(base);
  });
});

describe("UFQ KESIMI: ko'rinish", () => {
  it("new sprite frames: kneeling, a wide slash, follow-through, flick and rise — all distinct", () => {
    const F = KNIGHT_SUPER_FRAME;
    const fr = (f: number) => spritePixels("knight", "attack", f).join(",");
    const all = [0, 1, 2, F.kneel, F.kneelGlow, F.slash, F.follow, F.flick, F.rise].map(fr);
    expect(new Set(all).size).toBe(all.length);
    // tizzada — gavda pastroq: tepadagi birinchi bo'yalgan qator pastroq
    const top = (f: number) => spritePixels("knight", "attack", f).findIndex((c) => c > 0);
    expect(top(F.kneel)).toBeGreaterThan(top(F.rise));
  });

  it("the cut-in portrait: 96 px, front-facing and symmetric, shaded in many tones", () => {
    const n = KNIGHT_PORTRAIT_GRID;
    expect(portraitGrid("knight")).toBe(n);
    expect(n).toBeGreaterThanOrEqual(96);
    const base = portraitPixels("knight")!;
    expect(base.length).toBe(n * n);
    // hamma 16 rang ishlatilgan: kumush 5 ton, mato 4 ton, charm 3 ton, nur, rim light
    for (let c = 1; c <= KNIGHT_PORTRAIT_COLORS.length; c++)
      expect(base.includes(c), `${c}`).toBe(true);
    expect(base.filter((c) => c > 0).length).toBeGreaterThan(n * n * 0.5);
    // olddan: dubulg'a (tepa 50 qator, pat va plashsiz o'rta qism) deyarli simmetrik
    let same = 0,
      all = 0;
    for (let y = 8; y < 50; y++)
      for (let x = 34; x < 48; x++) {
        const l = base[y * n + x]!,
          r = base[y * n + (95 - x)]!;
        if (!l && !r) continue;
        all++;
        if (!!l === !!r) same++;
      }
    expect(same / all).toBeGreaterThan(0.9);
    // uch kadr har xil: pat/plash past, shamolda, tig' yaltirashi
    const frames = KNIGHT_PORTRAIT_VARIANTS.map((v) => portraitPixels("knight", v)!.join(","));
    expect(new Set(frames).size).toBe(3);
    const bright = (v: string) => portraitPixels("knight", v)!.filter((c) => c === 15).length;
    expect(bright("glint")).toBeGreaterThan(bright(""));
    // skin bilan: siyoh va nur skin palitrasidan, kumush skinga bo'yaladi, charm jigarrang qoladi
    const ice = SKINS.knight.find((k) => k.id === "knight-ice")!;
    const def0 = portraitColors("knight");
    const iceC = portraitColors("knight", ice);
    expect(def0).toEqual([...KNIGHT_PORTRAIT_COLORS]);
    expect(iceC[0]).toBe(ice.colors[0]);
    expect(iceC[3]).not.toBe(def0[3]);
    expect(iceC[11]).toBe(def0[11]);
    expect(SUPERS.knight?.card.scale).toBe(1.5);
  });

  it("the card glints along the blade and flutters the cape (but not with 'Reduce effects')", () => {
    const d = def();
    const used: (HTMLCanvasElement | null)[] = [];
    const frames = ["a", "b", "c"].map((id) => ({ id }) as unknown as HTMLCanvasElement);
    const draw = (t: number, reduced: boolean) => {
      const ctx = new Proxy(
        {},
        {
          get: (_, k) =>
            k === "createLinearGradient" || k === "createRadialGradient"
              ? () => ({ addColorStop: () => {} })
              : k === "drawImage"
                ? (img: HTMLCanvasElement) => used.push(img)
                : () => {},
          set: () => true,
        },
      ) as unknown as CanvasRenderingContext2D;
      renderHorizonCard(
        ctx,
        d,
        { t, cardTime: d.card.time },
        DEFAULT_THEME.knight,
        frames,
        () => {},
        reduced,
      );
    };
    for (let i = 0; i < 12; i++) draw((i / 12) * d.card.time, false);
    expect(new Set(used).size).toBe(3);
    used.length = 0;
    for (let i = 0; i < 12; i++) draw((i / 12) * d.card.time, true);
    expect(new Set(used).size).toBe(1);
    // tig' yaltirashi kartaning o'rtasida chiziladi
    const r = recorder();
    bladeGlint(r.ctx, 0, 0, 144, 0.5, DEFAULT_THEME.knight);
    expect(r.calls).toContain("fillRect");
    const none = recorder();
    bladeGlint(none.ctx, 0, 0, 144, 0.05, DEFAULT_THEME.knight);
    expect(none.calls).not.toContain("fillRect");
  });

  it("'Ice Knight' leaves ice crystals behind the cut; other skins do not", () => {
    const ice = SKINS.knight.find((k) => k.id === "knight-ice")!;
    expect(playScene(ice.theme, false, "frost").s.crystals.length).toBeGreaterThan(5);
    expect(playScene(DEFAULT_THEME.knight).s.crystals.length).toBe(0);
    expect(playScene(ice.theme, true, "frost").s.crystals.length).toBeLessThanOrEqual(
      MAX_CRYSTALS_REDUCED,
    );
  });

  it("colours come from the skin theme and stay far from the danger colours", () => {
    const themes = [DEFAULT_THEME.knight, ...SKINS.knight.map((k) => k.theme)];
    for (const T of themes) {
      const { r } = playScene(T, false, "frost");
      expect(r.colors.size).toBeGreaterThan(3);
      for (const col of r.colors) {
        const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(col);
        const hex = m
          ? `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`
          : col.slice(0, 7);
        // piksel bo'laklari dushmanning o'z rangida — ular xavf belgisi emas
        if (hex.length < 7) continue;
        if (RAMMER.has(hex.toLowerCase())) continue;
        for (const dc of DANGER_COLORS)
          expect(colorDistance(hex, dc), `${hex} vs ${dc}`).toBeGreaterThan(60);
      }
    }
  }, 20_000);

  it("'Reduce effects': no flashes and far fewer bits", () => {
    const full = playScene(DEFAULT_THEME.knight, false, null, 20);
    const low = playScene(DEFAULT_THEME.knight, true, null, 20);
    expect(full.most).toBeLessThanOrEqual(MAX_BITS);
    expect(low.most).toBeLessThanOrEqual(MAX_BITS_REDUCED);
    expect(low.most).toBeLessThan(full.most);
    expect(low.s.flash).toBe(0);
  });
});

describe("UFQ KESIMI: onlayn olamda hozircha yo'q", () => {
  it("the Knight in the realm never enters a super", () => {
    const sim = new RealmSim(loadRealmData());
    const rp = sim.addPlayer("p1", "knight");
    for (const key of ["superMeter", "orb", "cast", "scene"]) expect(key in sim, key).toBe(false);
    for (let i = 0; i < 60; i++) sim.step([]);
    expect(rp.p.casting).toBe(false);
    expect(rp.p.superFrame).toBe(-1);
  });
});
