import { beforeEach, describe, expect, it } from "vitest";
import { Game, SECOND_WAVE_POWER } from "./game";
import { Enemy } from "./enemy";
import { Boss } from "./boss";
import { HEROES } from "./hero";
import { Player, SUN_SHIELD_TIME } from "./player";
import { unlockHero } from "./save";
import { DEFAULT_SETTINGS, saveSettings } from "./settings";
import { DANGER_COLORS, colorDistance } from "./danger";
import { SKINS, SKINS_KEY } from "./skins";
import { FX_SLOTS, type SkinTheme } from "./skinFx";
import { MAX_PARTICLES, REDUCED_MAX_PARTICLES } from "./effects";
import { SuperCast, SuperMeter, superFor } from "./super";
import { sceneFor, type SceneCtx, type SceneTarget } from "./superScene";
import {
  BEAM_W,
  BOSS_BEAM_W,
  CLOUD_COLORS,
  DUST_PER_CORPSE,
  DUST_PER_CORPSE_REDUCED,
  DivineScene,
  MAX_DUST,
  MAX_DUST_REDUCED,
  MOTES,
  MOTES_REDUCED,
  RAISE_TIME,
  renderSunShield,
} from "./divineFx";
import {
  PALADIN_GRID,
  PALADIN_SUPER_FRAME,
  PALADIN_SWORD,
  UPGRADE_ICONS,
  paladinSwordTip,
  spritePixels,
} from "./sprites";
import { SUPER_CARD_CHANCE, UPGRADES, cardFor, pickUpgrades, upgradeIcon } from "./waves";
import { SUPER_RATE, TAGS, TAG_ICONS, addTag, synergies, tagNeed, tagProgress } from "./synergy";
import { Effects } from "./effects";
import { BOSS_WAVE } from "./waves";

type GI = {
  startWave(i: number): void;
  damageTarget(t: unknown, d: number): void;
  choose(i: number): void;
};
const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
const DT = 1 / 60;

function makeGame(skin?: string) {
  unlockHero("paladin");
  if (skin)
    localStorage.setItem(SKINS_KEY, JSON.stringify({ owned: [skin], sel: { paladin: skin } }));
  const g = new Game(canvas as unknown as HTMLCanvasElement, "paladin");
  g.hints = [];
  g.enemies = [];
  g.banner.timer = 0;
  g.player.x = 160;
  g.player.y = 150;
  return { g, gi: g as unknown as GI, p: g.player };
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

const scene = (g: Game) => g.scene as DivineScene;
const card = (id: string) => UPGRADES.find((u) => u.id === id)!;

/** Chizilgan barcha ranglarni (fill, stroke, gradient) yozib boradigan soxta canvas */
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

const rgbOf = (c: string) => {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
  if (m)
    return `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`;
  return c.slice(0, 7).toLowerCase();
};

function ctxFor(T: SkinTheme, reduced = false): SceneCtx & { shakes: number[] } {
  const fx = new Effects();
  fx.reduced = reduced;
  const shakes: number[] = [];
  return {
    x: 160,
    y: 150,
    dir: 1,
    theme: T,
    reduced,
    fx,
    shake: (v) => shakes.push(v),
    shakes,
    view: { x: 0, y: 0, w: 320, h: 240 },
  };
}

beforeEach(() => {
  localStorage.clear();
  saveSettings({ ...DEFAULT_SETTINGS });
});

describe("ILOHIY HUKM: Paladin kadrlari", () => {
  const F = PALADIN_SUPER_FRAME;
  const N = PALADIN_GRID;

  it("has separate code-drawn frames: raising the sword, holding it overhead (two shimmer frames), planting it", () => {
    const ids = [F.raise1, F.raise2, F.up, F.upAlt, F.plant];
    const frames = ids.map((f) => spritePixels("paladin", "attack", f));
    expect(new Set(frames.map((d) => d.join(","))).size).toBe(5);
    // mavjud hujum kadrlaridan ham farq qiladi
    for (let f = 0; f < 6; f++)
      for (const d of frames)
        expect(d.join(",")).not.toBe(spritePixels("paladin", "attack", f).join(","));
    for (const d of frames) {
      expect(d.length).toBe(N * N);
      // 5 rang qoidasi va chetda kesilmagan
      expect(Math.max(...d)).toBeLessThanOrEqual(5);
      for (let i = 0; i < N; i++)
        for (const edge of [i, (N - 1) * N + i, i * N, i * N + N - 1])
          expect(d[edge]).toBeLessThanOrEqual(1);
    }
  });

  it("the sword goes from the shoulder to straight up with both hands, then down into the ground", () => {
    const tipY = (f: number) => PALADIN_SWORD.attack[f]!.tip[1];
    // ko'tarilgan sari uchi balandroq
    expect(tipY(F.raise2)).toBeLessThan(tipY(F.raise1));
    expect(tipY(F.up)).toBeLessThanOrEqual(tipY(F.raise2));
    // boshi uzra: tig' tik (dasta va uchi bir ustunda), boshdan baland
    const up = PALADIN_SWORD.attack[F.up]!;
    expect(up.tip[0]).toBe(up.hand[0]);
    expect(up.tip[1]).toBeLessThan(-15);
    expect(up.glow).toBe(true);
    // sanchilgan: uchi oyoq chizig'idan past (yerga kirgan)
    expect(tipY(F.plant)).toBeGreaterThanOrEqual(28);
    // effektlar uchun qilich uchi: tepada — boshdan ancha yuqorida, sanchilganda — oyoq ostida
    expect(paladinSwordTip(F.up)[1]).toBeLessThan(-30);
    expect(paladinSwordTip(F.plant)[1]).toBeGreaterThan(10);
    // devor yonida ham ekrandan chiqmaydi (mavjud qoida: uchi tanadan 22 px dan uzoq emas)
    for (const f of [F.raise1, F.raise2, F.up, F.upAlt, F.plant])
      expect(Math.abs(PALADIN_SWORD.attack[f]!.tip[0] - 16)).toBeLessThanOrEqual(22);
  });

  it("existing attack frames (SHANG, OSMON HUKMI) are untouched: the Animator still has 4", () => {
    const p = new Player("paladin");
    expect(p.anim.defs.attack.frames).toBe(4);
    // super kadri faqat super paytida chiziladi
    expect(p.superFrame).toBe(-1);
  });

  it("the scene picks the pose by stage: raise → overhead → plant", () => {
    const d = superFor("paladin")!;
    const s = new DivineScene();
    const c = new SuperCast(d, 0);
    expect(s.pose(c)).toBe(F.raise1);
    c.t = RAISE_TIME * 0.7;
    expect(s.pose(c)).toBe(F.raise2);
    c.t = RAISE_TIME + 0.1;
    expect([F.up, F.upAlt]).toContain(s.pose(c));
    c.stage = "strike";
    expect([F.up, F.upAlt]).toContain(s.pose(c));
    c.stage = "after";
    expect(s.pose(c)).toBe(F.plant);
    // qilich to'liq ko'tarilishi tayyorlanish ichida
    expect(RAISE_TIME).toBeLessThan(d.stages.prep);
  });
});

describe("ILOHIY HUKM: sahna", () => {
  it("is the Paladin super's scene (other supers fall back to the plain one)", () => {
    expect(sceneFor(superFor("paladin")!.fx)).toBeInstanceOf(DivineScene);
    expect(sceneFor("yo'q")).not.toBeInstanceOf(DivineScene);
  });

  it("every mob gets its own mark and its own beam, nearest first; flattened mobs lie as corpses", () => {
    const { g } = makeGame();
    const foes = [
      foe(g, "blob", 260, 150),
      foe(g, "rammer", 180, 150),
      foe(g, "archer", 60, 60),
      foe(g, "wisp", 220, 150),
    ];
    cast(g);
    until(g, () => g.cast?.stage === "strike");
    const s = scene(g);
    const hits: number[] = [];
    let marks = 0,
      beams = 0;
    const seenMarks = new Set<object>();
    const seenBeams = new Set<object>();
    while (g.cast?.stage === "strike") {
      g.update(DT);
      for (const m of s.marks)
        if (!seenMarks.has(m)) {
          seenMarks.add(m);
          marks++;
        }
      for (const b of s.beams)
        if (!seenBeams.has(b)) {
          seenBeams.add(b);
          beams++;
          hits.push(b.x);
          expect(b.w).toBe(BEAM_W);
        }
    }
    expect(marks).toBe(4);
    expect(beams).toBe(4);
    // yaqindan uzoqqa: 180, 220, 260, so'ng eng uzoqdagi kamonchi
    expect(hits).toEqual([180, 220, 260, 60]);
    expect(foes.every((e) => e.dead && e.removed)).toBe(true);
    // yer tishlagan to'rtta mob: sahna o'zi ko'rsatadi
    expect(s.corpses.length).toBe(4);
    expect(s.corpses.every((k) => k.dust < 0)).toBe(true);
  });

  it("aftermath: the planted sword sends a ring wave and the corpses turn to gold dust, then the scene ends", () => {
    const { g } = makeGame();
    foe(g, "blob", 200, 150);
    foe(g, "blob", 40, 40);
    cast(g);
    until(g, () => g.cast?.stage === "after");
    const s = scene(g);
    expect(s.plantT).toBeGreaterThanOrEqual(0);
    expect(s.rings.some((r) => r.big)).toBe(true);
    expect(s.corpses.length).toBe(2);
    // yaqindagisi to'lqin yetishi bilan changga aylanadi, uzoqdagisi — keyinroq
    until(g, () => s.corpses.some((k) => k.dust >= 0), 2);
    const [near, far] = [...s.corpses].sort(
      (a, b) => Math.hypot(a.x - 160, a.ground - 150) - Math.hypot(b.x - 160, b.ground - 150),
    );
    expect(near!.dust).toBeGreaterThanOrEqual(0);
    expect(far!.dust).toBe(-1);
    expect(s.dust.length).toBeGreaterThan(0);
    // chang yuqoriga ko'tariladi
    expect(s.dust.every((d) => d.vy < 0)).toBe(true);
    until(g, () => !g.cast);
    // super tugagach ham sahna so'nib bo'lguncha chiziladi, keyin yo'qoladi
    until(g, () => !g.scene, 6);
    expect(g.scene).toBeNull();
  });

  it("one random mob looks up with a 'HI?' bubble before its beam — and stops when the beam lands", () => {
    const { g } = makeGame();
    const foes = [foe(g, "blob", 200, 150), foe(g, "rammer", 60, 60), foe(g, "archer", 280, 60)];
    cast(g);
    until(g, () => g.cast?.stage === "strike");
    const gawkers = foes.filter((e) => e.gawk);
    expect(gawkers).toHaveLength(1);
    // eng yaqin mob emas (uning nuri birinchi tushadi)
    expect(gawkers[0]).not.toBe(foes[0]);
    until(g, () => g.cast?.stage === "after");
    expect(foes.every((e) => !e.gawk)).toBe(true);
    // bitta mob bo'lsa — o'sha
    const solo = makeGame();
    const only = foe(solo.g, "blob", 200, 150);
    cast(solo.g);
    until(solo.g, () => solo.g.cast?.stage === "strike");
    expect(only.gawk).toBe(true);
  });

  it("a boss gets one big thick beam after the mobs and is not flattened", () => {
    const { g } = makeGame();
    const b = new Boss(100);
    b.spawn = 0;
    g.boss = b;
    foe(g, "blob", 200, 150);
    cast(g);
    until(g, () => g.cast?.stage === "strike");
    const s = scene(g);
    const widths: number[] = [];
    const seen = new Set<object>();
    while (g.cast?.stage === "strike") {
      g.update(DT);
      for (const beam of s.beams)
        if (!seen.has(beam)) {
          seen.add(beam);
          widths.push(beam.w);
        }
    }
    expect(widths).toEqual([BEAM_W, BOSS_BEAM_W]);
    expect(BOSS_BEAM_W).toBeGreaterThan(BEAM_W * 2);
    expect(s.corpses.length).toBe(1);
    expect(b.dead).toBe(false);
    expect(b.kneel).toBeGreaterThan(0);
  });

  it("particles are capped: 60 mobs never push dust or the shared particles past their limits", () => {
    const { g } = makeGame();
    for (let i = 0; i < 60; i++) foe(g, "blob", 30 + (i % 12) * 22, 40 + Math.floor(i / 12) * 36);
    cast(g);
    const s = scene(g);
    let maxDust = 0,
      maxFx = 0;
    while (g.cast || g.scene) {
      g.update(DT);
      maxDust = Math.max(maxDust, s.dust.length);
      maxFx = Math.max(maxFx, g.fx.particles.length);
    }
    expect(g.stats.kills).toBe(60);
    expect(maxDust).toBeGreaterThan(MAX_DUST / 2);
    expect(maxDust).toBeLessThanOrEqual(MAX_DUST);
    expect(maxFx).toBeLessThanOrEqual(MAX_PARTICLES);
  });
});

describe("ILOHIY HUKM: 'Effektlarni kamaytirish'", () => {
  function run(reduceFx: boolean) {
    saveSettings({ ...DEFAULT_SETTINGS, reduceFx });
    const { g, p } = makeGame();
    g.fx.reduced = reduceFx;
    const b = new Boss(100);
    b.spawn = 0;
    g.boss = b;
    for (let i = 0; i < 8; i++) foe(g, "blob", 40 + i * 30, 60 + (i % 2) * 120);
    p.hp = 4;
    cast(g);
    const s = scene(g);
    let maxDust = 0,
      maxMotes = 0,
      maxFlash = 0,
      maxShake = 0,
      maxFx = 0;
    let time = 0;
    while (g.cast) {
      g.update(DT);
      time += DT;
      maxDust = Math.max(maxDust, s.dust.length);
      maxMotes = Math.max(maxMotes, s.motes.length);
      maxFlash = Math.max(maxFlash, s.flash);
      maxShake = Math.max(maxShake, g.fx.shake);
      maxFx = Math.max(maxFx, g.fx.particles.length);
    }
    return {
      kills: g.stats.kills,
      bossHp: b.hp,
      hp: p.hp,
      time: Math.round(time * 60),
      score: g.score,
      maxDust,
      maxMotes,
      maxFlash,
      maxShake,
      maxFx,
    };
  }

  it("fewer particles, no flashes, lighter shake — exactly the same logic", () => {
    const full = run(false);
    const calm = run(true);
    // mantiq bir xil: o'ldirilganlar, bossga zarar, jon, davomiylik, ochko
    expect(calm.kills).toBe(full.kills);
    expect(calm.bossHp).toBe(full.bossHp);
    expect(calm.hp).toBe(full.hp);
    expect(calm.time).toBe(full.time);
    expect(calm.score).toBe(full.score);
    // ko'rinish yengilroq
    expect(calm.maxDust).toBeLessThan(full.maxDust);
    expect(calm.maxDust).toBeLessThanOrEqual(MAX_DUST_REDUCED);
    expect(calm.maxMotes).toBeLessThan(full.maxMotes);
    expect(calm.maxMotes).toBeLessThanOrEqual(MOTES_REDUCED);
    expect(full.maxMotes).toBe(MOTES);
    expect(calm.maxFlash).toBe(0);
    expect(full.maxFlash).toBeGreaterThan(0);
    expect(calm.maxShake).toBeLessThan(full.maxShake);
    expect(calm.maxFx).toBeLessThanOrEqual(REDUCED_MAX_PARTICLES);
    expect(DUST_PER_CORPSE_REDUCED).toBeLessThan(DUST_PER_CORPSE);
  });

  it("the shimmer frame and the sun-shield blink stop when effects are reduced", () => {
    const T = SKINS.paladin[0]!.theme;
    const { ctx, colors } = recorder();
    // oxirgi 0.5 s: oddiy rejimda navbat bilan ko'rinmaydi, kamaytirilganda — doim chiziladi
    let drawn = 0;
    for (let i = 0; i < 8; i++) {
      colors.clear();
      renderSunShield(ctx, 100, 100, 0, 0.45 - i * 0.03, T, true);
      if (colors.size) drawn++;
    }
    expect(drawn).toBe(8);
    drawn = 0;
    for (let i = 0; i < 8; i++) {
      colors.clear();
      renderSunShield(ctx, 100, 100, 0, 0.45 - i * 0.03, T, false);
      if (colors.size) drawn++;
    }
    expect(drawn).toBeGreaterThan(0);
    expect(drawn).toBeLessThan(8);
  });
});

describe("ILOHIY HUKM: skinlar va xavf ranglari", () => {
  /** Sahnaning hamma bosqichini soxta kanvasga chizib, ishlatilgan ranglarni yig'adi */
  function drawnColors(T: SkinTheme) {
    const d = superFor("paladin")!;
    const s = new DivineScene();
    const ctx = ctxFor(T);
    const c = new SuperCast(d, 0);
    const { ctx: rc, colors } = recorder();
    const mob: SceneTarget = { x: 220, y: 120, size: 12, sprite: "slime" };
    const boss: SceneTarget = { x: 100, y: 80, size: 28 };
    const step = (n: number) => {
      for (let i = 0; i < n; i++) {
        c.update(DT);
        s.update(DT, c.done ? null : c, ctx);
        s.pose(c);
        s.renderGround(rc, c, ctx);
        s.renderAir(rc, c, ctx);
      }
    };
    step(60);
    s.gawk(mob);
    step(20);
    c.stage = "strike";
    c.t = 0;
    s.mark(mob, false);
    s.mark(boss, true);
    step(4);
    s.hit(mob, false, true, c, ctx);
    s.hit(boss, true, false, c, ctx);
    step(12);
    c.stage = "after";
    c.t = 0;
    s.stage("after", c, ctx);
    step(70);
    renderSunShield(rc, 160, 150, 1, 1.5, T);
    return [...colors].map(rgbOf);
  }

  it("every colour comes from the active skin theme (plus white, the dark veil and clouds)", () => {
    const neutral = new Set(["#ffffff", "#06040e", ...CLOUD_COLORS.map((c) => c.toLowerCase())]);
    for (const skin of SKINS.paladin) {
      const T = skin.theme;
      const allowed = new Set(
        [T.accent, T.accentDark, T.glow, T.edge, T.ink, T.spark, T.inner].map((c) =>
          c.toLowerCase(),
        ),
      );
      const used = drawnColors(T);
      expect(used.length).toBeGreaterThan(4);
      for (const c of used) expect(allowed.has(c) || neutral.has(c), `${skin.id}: ${c}`).toBe(true);
      // skin rangi haqiqatan ishlatilgan: nur — glow, cheti — accent
      expect(used).toContain(T.glow.toLowerCase());
      expect(used).toContain(T.accent.toLowerCase());
    }
    // "Olov Paladin" nuri oddiy Paladinnikidan boshqa rangda
    const flame = SKINS.paladin.find((sk) => sk.id === "paladin-flame")!;
    expect(drawnColors(flame.theme)).not.toEqual(drawnColors(SKINS.paladin[0]!.theme));
  });

  it("super effects never look like enemy danger zones", () => {
    for (const skin of SKINS.paladin) {
      const T = skin.theme;
      // effekt ranglari (theme slotlari) va neytral ranglar: har biri xavf ranglaridan uzoq
      for (const c of [...FX_SLOTS.map((k) => T[k]), ...CLOUD_COLORS])
        for (const d of DANGER_COLORS)
          expect(colorDistance(c, d), `${skin.id}: ${c} vs ${d}`).toBeGreaterThan(60);
    }
  });

  it("a skin recolours the super but gives it no power", () => {
    function outcome(skin?: string) {
      const { g, p } = makeGame(skin);
      const b = new Boss(100);
      b.spawn = 0;
      g.boss = b;
      for (let i = 0; i < 6; i++) foe(g, "rammer", 40 + i * 40, 60);
      p.hp = 3;
      cast(g);
      const d = g.cast!.def;
      const t = until(g, () => !g.cast);
      return {
        theme: g.theme.accent,
        charge: d.charge,
        kills: g.stats.kills,
        bossHp: b.hp,
        hp: p.hp,
        frames: Math.round(t * 60),
        kneel: b.kneel > 0,
      };
    }
    const base = outcome();
    for (const skin of SKINS.paladin.slice(1)) {
      localStorage.clear();
      const o = outcome(skin.id);
      // rang boshqa...
      expect(o.theme).toBe(skin.theme.accent);
      expect(o.theme).not.toBe(base.theme);
      // ...kuch aynan bir xil
      expect({ ...o, theme: "" }).toEqual({ ...base, theme: "" });
    }
  });
});

describe("SUPER kartalari", () => {
  it("two rare cards tagged SUPER, only for a hero whose super is open", () => {
    const sun = card("sunshield"),
      second = card("secondjudgment");
    expect(sun.name).toBe("QUYOSH QALQONI");
    expect(second.name).toBe("IKKINCHI HUKM");
    for (const u of [sun, second]) {
      expect(u.tags).toEqual(["super"]);
      expect(u.super).toBe(superFor("paladin")!.id);
      expect(u.rare).toBe(SUPER_CARD_CHANCE);
      expect(UPGRADE_ICONS[upgradeIcon(u)]).toHaveLength(12);
      for (const row of UPGRADE_ICONS[upgradeIcon(u)]!) expect(row).toMatch(/^[.XAQUVZ]{12}$/);
    }
    expect(SUPER_CARD_CHANCE).toBeLessThan(0.5);
    // boshqa qahramonlarga hech qachon chiqmaydi
    for (const h of HEROES.filter((x) => x !== "paladin"))
      for (let i = 0; i < 150; i++)
        for (const u of pickUpgrades(new Player(h)))
          expect(["sunshield", "secondjudgment"]).not.toContain(u.id);
  });

  it("they are rare: seen far less often than an ordinary Paladin card", () => {
    const seen: Record<string, number> = {};
    for (let i = 0; i < 1500; i++)
      for (const u of pickUpgrades(new Player("paladin"))) seen[u.id] = (seen[u.id] ?? 0) + 1;
    expect(seen["sunshield"]).toBeGreaterThan(0);
    expect(seen["secondjudgment"]).toBeGreaterThan(0);
    expect(seen["sunshield"]!).toBeLessThan(seen["blade"]! * 0.6);
    expect(seen["secondjudgment"]!).toBeLessThan(seen["blade"]! * 0.6);
  });

  it("other heroes' card rolls use the same random numbers as before (daily seeds unchanged)", () => {
    const seq = () => {
      let s = 7;
      let calls = 0;
      const r = () => {
        calls++;
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648;
      };
      return { r, calls: () => calls };
    };
    for (const h of HEROES.filter((x) => x !== "paladin")) {
      const a = seq();
      const picked = pickUpgrades(new Player(h), 3, a.r);
      // tanlov faqat aralashtirish uchun tasodif oladi: nomzodlar soni − 1 marta
      const pool = UPGRADES.filter((u) => !u.hero || u.hero === h)
        .map((u) => cardFor(u, new Player(h)))
        .filter((u) => u.ok(new Player(h)));
      expect(a.calls()).toBe(pool.length - 1);
      expect(picked).toHaveLength(3);
    }
  });

  it("SUPER tag: both cards together unlock the synergy — the orb fills 25% faster", () => {
    expect(tagNeed("super")).toBe(2);
    expect(tagNeed("zarar")).toBe(3);
    expect(tagProgress({}, "super")).toBe("SUPER 1/2");
    expect(tagProgress({ super: 1 }, "super")).toBe("SUPER 2/2");
    expect(TAGS.super.three).toMatch(/25%/);
    expect(TAG_ICONS.super).toHaveLength(7);
    const p = new Player("paladin");
    const counts = {};
    expect(addTag(counts, "super", p)).toBeNull();
    expect(p.superRate).toBe(1);
    expect(addTag(counts, "super", p)).toBe("three");
    expect(p.superRate).toBe(SUPER_RATE);
    expect(synergies(counts)).toEqual(["super"]);
    // o'yinda: kartalarni olgach shar tezroq to'ladi
    const { g, gi } = makeGame();
    for (const id of ["sunshield", "secondjudgment"]) {
      g.choices = [cardFor(card(id), g.player)];
      (g as unknown as { stage: string }).stage = "upgrade";
      gi.choose(0);
    }
    expect(g.player.sunShieldCard && g.player.secondJudgment).toBe(true);
    g.enemies = [];
    const e = foe(g, "golem", 220, 150);
    e.hp = e.maxHp = 100;
    g.update(DT);
    const before = g.superMeter.value;
    gi.damageTarget(e, 4);
    expect(g.superMeter.value - before).toBeCloseTo(4 * SUPER_RATE);
    // boshqa meter: tezlik o'zgarmagan
    const m = new SuperMeter("paladin");
    m.add(4);
    expect(m.value).toBe(4);
  });

  it("QUYOSH QALQONI: a golden shield for exactly 2 s after the super, then hits land again", () => {
    const { g, p } = makeGame();
    card("sunshield").apply(p);
    foe(g, "treant", 40, 40).hp = 500;
    const b = new Boss(400);
    b.spawn = 0;
    b.update = () => {};
    b.x = 20;
    b.y = 20;
    g.boss = b;
    // boss to'lqini: super hamma mobni o'ldirgach ham jang davom etadi (kuch tanlash ochilmaydi)
    g.wave = BOSS_WAVE;
    cast(g);
    until(g, () => !g.cast);
    expect(p.sunShield).toBeCloseTo(SUN_SHIELD_TIME, 1);
    const hp = p.hp;
    // qalqon ostida: zarba, muz va to'r o'tmaydi
    expect(p.takeHit(1, p.x + 5, p.y, 100)).toBe(false);
    expect(p.encase(5)).toBe(false);
    expect(p.ensnare(2)).toBe(false);
    expect(p.hp).toBe(hp);
    until(g, () => p.sunShield <= 0, 3);
    // qalqon tugadi — ortiqcha daxlsizlik yo'q
    expect(p.sunShield).toBe(0);
    expect(p.takeHit(1, p.x + 5, p.y, 100)).toBe(true);
    expect(p.hp).toBe(hp - 1);
    // kartasiz — qalqon yo'q
    const plain = makeGame();
    foe(plain.g, "blob", 200, 150);
    cast(plain.g);
    until(plain.g, () => !plain.g.cast);
    expect(plain.p.sunShield).toBe(0);
  });

  it("IKKINCHI HUKM: a second, half-strength wave — the boss total still never passes 10%", () => {
    expect(SECOND_WAVE_POWER).toBe(0.5);
    const run = (second: boolean, maxHp: number) => {
      const { g, p } = makeGame();
      if (second) card("secondjudgment").apply(p);
      const b = new Boss(maxHp);
      b.spawn = 0;
      g.boss = b;
      foe(g, "blob", 200, 150);
      cast(g);
      const s = scene(g);
      let beams = 0;
      const seen = new Set<object>();
      const t = until(g, () => {
        for (const beam of s.beams)
          if (!seen.has(beam)) {
            seen.add(beam);
            beams++;
          }
        return !g.cast;
      });
      return { dealt: maxHp - b.hp, beams, t, waves: 0 };
    };
    for (const maxHp of [40, 100, 250]) {
      const one = run(false, maxHp);
      const two = run(true, maxHp);
      // kartasiz: 8%; karta bilan: 8% + yarim kuch (4%) emas — chegaragacha, jami 10%
      expect(one.dealt).toBeCloseTo(maxHp * 0.08, 5);
      expect(two.dealt).toBeCloseTo(maxHp * 0.1, 5);
      expect(two.dealt).toBeLessThanOrEqual(maxHp * 0.1 + 1e-9);
      // ikkinchi to'lqin: bossga yana bitta nur
      expect(one.beams).toBe(2);
      expect(two.beams).toBe(3);
      // super biroz uzayadi, lekin cho'zilib ketmaydi
      expect(two.t).toBeGreaterThan(one.t);
      expect(two.t - one.t).toBeLessThan(0.8);
    }
  });

  it("the card choices survive a world restart together with the other powers", () => {
    const { g, gi, p } = makeGame();
    card("sunshield").apply(p);
    card("secondjudgment").apply(p);
    p.superRate = SUPER_RATE;
    // 2-dunyoga o'tish: kuchlar saqlanadi; o'lib qayta boshlaganda ham qaytadi
    g.startChapter(2);
    expect(g.player.sunShieldCard).toBe(true);
    g.player.sunShieldCard = false;
    g.player.secondJudgment = false;
    g.player.superRate = 1;
    g.retryChapter();
    expect(g.player.sunShieldCard).toBe(true);
    expect(g.player.secondJudgment).toBe(true);
    expect(g.player.superRate).toBe(SUPER_RATE);
    void gi;
  });
});
