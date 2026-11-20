import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Game } from "./game";
import { Enemy } from "./enemy";
import { Boss } from "./boss";
import { GUN_AMMO } from "./player";
import { DEFAULT_SETTINGS, saveSettings } from "./settings";
import { dangerDistance } from "./danger";
import { DEFAULT_THEME } from "./skinFx";
import { Effects } from "./effects";
import { SuperCast, frenzyBossDamage, frenzyTime, superFor } from "./super";
import { FrenzyScene, heatColor } from "./frenzyFx";
import type { SceneCtx } from "./superScene";
import {
  GUNNER_PORTRAIT_GRID,
  GUNNER_PORTRAIT_STYLES,
  gunnerPortraitPixels,
} from "./gunnerPortrait";
import { GUNNER_PORTRAIT_VARIANTS, portraitPixels } from "./portrait";
import { GUNNER_SUPER_FRAME, UPGRADE_ICONS, spritePixels } from "./sprites";
import { UPGRADES } from "./waves";
import { unlockHero } from "./save";

const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
const DT = 1 / 60;
const def = () => superFor("gunner")!;
const F = () => def().frenzy!;

function makeGame() {
  unlockHero("gunner");
  const g = new Game(canvas as unknown as HTMLCanvasElement, "gunner");
  g.hints = [];
  g.enemies = [];
  g.banner.timer = 0;
  g.player.x = 100;
  g.player.y = 150;
  g.player.fx = 1;
  g.player.fy = 0;
  return { g, p: g.player };
}

function foe(g: Game, x: number, y: number) {
  const e = new Enemy("golem", x, y);
  e.spawn = 0;
  e.hp = e.maxHp = 9999;
  e.update = () => {};
  g.enemies.push(e);
  return e;
}

/** Superni boshlab, tez otish bosqichigacha yuritadi */
function toFrenzy(g: Game) {
  g.superMeter.value = g.superMeter.def!.charge;
  expect(g.useSuper()).toBe(true);
  const c = g.cast!;
  for (let t = 0; t < 3 && c.stage !== "strike"; t += DT) g.update(DT);
  expect(c.stage).toBe("strike");
  return c;
}

beforeEach(() => {
  localStorage.clear();
  saveSettings({ ...DEFAULT_SETTINGS });
});
afterEach(() => vi.restoreAllMocks());

describe("CHEKSIZ O'Q: ma'lumot", () => {
  it("is the Gunner's open super: 20 charge, 3.5 s of fire, boss cap 10%, dark orange orb", () => {
    const d = def();
    expect(d.id).toBe("endless-lead");
    expect(d.name).toBe("CHEKSIZ O'Q");
    expect(d.charge).toBe(20);
    expect(d.dmg.boss).toBe(0.08);
    expect(d.dmg.bossCap).toBe(0.1);
    expect(F().time).toBe(3.5);
    expect(frenzyTime(d)).toBe(3.5);
    expect(frenzyTime(d, true)).toBe(5);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(d.orb!.accent.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(g!);
    expect(g).toBeGreaterThan(b!);
    for (const c of Object.values(d.orb!)) expect(dangerDistance(c)).toBeGreaterThan(60);
    expect(d.card.sub).toBe("MERGAN SUPERI");
  });

  it("has two super cards with icons: QIZIGAN PO'LAT and UZUN DASHT", () => {
    const cards = UPGRADES.filter((u) => u.super === "endless-lead");
    expect(cards.map((u) => u.name)).toEqual(["QIZIGAN PO'LAT", "UZUN DASHT"]);
    for (const u of cards) {
      expect(u.hero).toBe("gunner");
      expect(UPGRADE_ICONS[u.icon!]?.length).toBe(12);
    }
  });

  it("caps only the extra boss damage of the fast fire at 10% of max HP", () => {
    const d = def();
    let extra = 0,
      total = 0;
    for (let i = 0; i < 200; i++) {
      const r = frenzyBossDamage(d, 300, extra, 2);
      extra += r.extra;
      total += r.dmg;
    }
    expect(extra).toBeCloseTo(30);
    expect(total).toBeCloseTo(30 + 200 * 2 * F().rate);
  });
});

describe("CHEKSIZ O'Q: o'yinda", () => {
  it("spins the drum (locked, invulnerable), then 3.5 s of free fast fire without reloading", () => {
    const { g, p } = makeGame();
    foe(g, 260, 150);
    g.superMeter.value = 20;
    g.useSuper();
    // karta va baraban aylanishi: joyida, daxlsiz
    for (let t = 0; t < 2 && g.cast!.stage !== "prep"; t += DT) g.update(DT);
    g.update(DT);
    expect(g.cast!.stage).toBe("prep");
    expect(p.casting).toBe(true);
    expect(p.superFrame).toBeGreaterThanOrEqual(GUNNER_SUPER_FRAME.up);
    const c = g.cast!;
    for (let t = 0; t < 2 && c.stage !== "strike"; t += DT) g.update(DT);
    expect(c.stage).toBe("strike");
    // boshqaruv qaytdi: daxlsizlik tugadi
    expect(p.casting).toBe(false);
    expect(p.invuln).toBeLessThanOrEqual(0);
    expect(p.frenzy).toBe(true);
    expect(c.strikeTime).toBe(3.5);
    // tepki bosib turiladi: o'qlar uzluksiz, baraban tugamaydi, qayta o'qlash yo'q
    g.input.setTouchAttack(true);
    let shots = 0;
    for (let t = 0; t < 1.5; t += DT) {
      const before = g.bolts.length;
      g.update(DT);
      shots += Math.max(0, g.bolts.length - before);
      expect(p.reloading).toBe(false);
    }
    expect(shots).toBeGreaterThan(GUN_AMMO * 2);
    expect(p.ammo).toBe(GUN_AMMO);
    // erkin yuradi
    const x0 = p.x;
    g.input.setTouchAxis(0, -1);
    for (let t = 0; t < 0.3; t += DT) g.update(DT);
    expect(p.y).toBeLessThan(150);
    expect(p.x).toBeCloseTo(x0, 0);
    g.input.setTouchAxis(0, 0);
    g.input.setTouchAttack(false);
    // gilzalar sahnada
    expect((g.scene as FrenzyScene).shells.length).toBeGreaterThan(0);
    // oqibat: baraban to'la, tez otish tugadi; keyin super tugaydi
    p.ammo = 2;
    for (let t = 0; t < 3 && c.stage === "strike"; t += DT) g.update(DT);
    expect(c.stage).toBe("after");
    expect(p.frenzy).toBe(false);
    expect(p.ammo).toBe(p.ammoMax);
    expect((g.scene as FrenzyScene).shells.length).toBe(0);
    expect((g.scene as FrenzyScene).puffs.length).toBeGreaterThan(0);
    for (let t = 0; t < 1 && g.cast; t += DT) g.update(DT);
    expect(g.cast).toBeNull();
    expect(p.casting).toBe(false);
    // super tugagach — odatdagi baraban
    g.input.pressAttack();
    g.update(DT);
    expect(p.ammo).toBe(p.ammoMax - 1);
  });

  it("UZUN DASHT makes it 5 s; QIZIGAN PO'LAT bullets are stronger and pierce", () => {
    const { g, p } = makeGame();
    p.longPrairie = true;
    p.hotSteel = true;
    foe(g, 260, 150);
    const c = toFrenzy(g);
    expect(c.strikeTime).toBe(5);
    g.input.pressAttack();
    g.update(DT);
    const b = g.bolts.find((x) => x.frenzy)!;
    expect(b.power).toBe(F().hot.dmg);
    expect(b.left).toBe(1 + p.pierce + F().hot.pierce);
  });

  it("a boss takes no more than 10% of its max HP of EXTRA damage from one super", () => {
    const { g, p } = makeGame();
    const boss = new Boss();
    boss.x = 200;
    boss.y = 150;
    boss.spawn = 0;
    boss.update = () => {};
    g.boss = boss;
    p.damage = 40;
    const c = toFrenzy(g);
    g.input.setTouchAttack(true);
    let hp = boss.hp;
    let shots = 0;
    for (let t = 0; t < 3.4 && c.stage === "strike" && !boss.dead; t += DT) {
      g.update(DT);
      if (boss.hp < hp) shots++;
      hp = boss.hp;
    }
    g.input.setTouchAttack(false);
    const extra = c.frenzyExtra.get(boss) ?? 0;
    expect(extra).toBeGreaterThan(0);
    expect(extra).toBeLessThanOrEqual(boss.maxHp * def().dmg.bossCap + 1e-6);
  });
});

describe("CHEKSIZ O'Q: sahna", () => {
  const ctxFor = (reduced: boolean): SceneCtx => ({
    x: 160,
    y: 150,
    dir: 1,
    theme: DEFAULT_THEME.gunner,
    reduced,
    fx: new Effects(),
    shake: () => {},
    view: { x: 0, y: 0, w: 320, h: 240 },
    orb: { ...DEFAULT_THEME.gunner, ...def().orb! },
  });

  it("keeps few shells with 'Reduce effects', heats the gun with the orb colours", () => {
    const run = (reduced: boolean) => {
      const s = new FrenzyScene();
      const c = new SuperCast(def(), 0);
      const ctx = ctxFor(reduced);
      s.stage("prep", c, ctx);
      for (let i = 0; i < 60; i++) s.shot(ctx);
      return s.shells.length;
    };
    expect(run(true)).toBe(def().params["shellsReduced"]);
    expect(run(false)).toBe(def().params["shells"]);
    const o = def().orb!;
    expect(heatColor(o, 0)).toBe(o.accentDark);
    expect(heatColor(o, 0.5)).toBe(o.accent);
    expect(heatColor(o, 1)).toBe(o.glow);
  });

  it("draws only theme / orb colours", () => {
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
    const s = new FrenzyScene();
    const c = new SuperCast(def(), 0);
    const ctx = ctxFor(false);
    s.stage("prep", c, ctx);
    s.update(0.2, c, ctx);
    s.renderAir(rec, c, ctx);
    c.update(def().stages.prep + 0.01);
    s.stage("strike", c, ctx);
    for (let i = 0; i < 5; i++) s.shot(ctx);
    c.update(1.5);
    s.update(0.1, c, ctx);
    s.renderGround(rec, c, ctx);
    s.renderAir(rec, c, ctx);
    s.stage("after", c, ctx);
    s.update(0.1, c, ctx);
    s.renderAir(rec, c, ctx);
    const T = DEFAULT_THEME.gunner;
    const o = def().orb!;
    const allowed = [T.accent, T.glint, T.mist, T.ink, o.glow, o.accent, o.accentDark].map((x) =>
      x.toLowerCase().slice(1, 7),
    );
    for (const col of used) {
      if (col.startsWith("rgba(10,6,2")) continue;
      const hex = col.startsWith("#")
        ? col.slice(1, 7).toLowerCase()
        : col
            .match(/\d+/g)!
            .slice(0, 3)
            .map((n) => (+n).toString(16).padStart(2, "0"))
            .join("");
      // qizish rangi — shar ranglari orasidagi aralashma (heatColor)
      const ch = (h: string) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
      const onHeat = Array.from({ length: 101 }, (_, i) => heatColor(o, i / 100)).some((h) => {
        const a = ch(h.slice(1)),
          b = ch(hex);
        return a.every((v, i) => Math.abs(v - b[i]!) <= 3);
      });
      expect(allowed.includes(hex) || onHeat, col).toBe(true);
    }
  });

  it("the Gunner sprite raises the revolver and spins the drum in two super frames", () => {
    const frames = Object.values(GUNNER_SUPER_FRAME).map((f) =>
      spritePixels("gunner", "attack", f).join(","),
    );
    expect(new Set(frames).size).toBe(2);
    expect(frames).not.toContain(spritePixels("gunner", "attack", 0).join(","));
  });
});

describe("Mergan portreti (cut-in)", () => {
  it("is 96x96, front-facing, 3 distinct frames, 4–5 shading tones, one glowing eye, two styles", () => {
    expect(GUNNER_PORTRAIT_STYLES).toBe(2);
    for (let s = 0; s < GUNNER_PORTRAIT_STYLES; s++) {
      const frames = [0, 1, 2].map((f) => gunnerPortraitPixels(f, s));
      for (const d of frames) expect(d.length).toBe(GUNNER_PORTRAIT_GRID ** 2);
      expect(new Set(frames.map((d) => d.join(","))).size).toBe(3);
      const d = frames[1]!;
      const used = new Set(d);
      // shlyapa 4–5 tonda (2..6), rim light, porlagan ko'z
      expect([2, 3, 4, 5, 6].filter((c) => used.has(c)).length).toBeGreaterThanOrEqual(4);
      expect(used.has(30)).toBe(true);
      expect(used.has(28)).toBe(true);
      // ko'z faqat bitta: porlash o'ng yarmida
      let left = 0,
        right = 0;
      for (let y = 30; y < 45; y++)
        for (let x = 0; x < 96; x++)
          if (d[y * 96 + x] === 28 || d[y * 96 + x] === 29) {
            if (x < 48) left++;
            else right++;
          }
      expect(left).toBe(0);
      expect(right).toBeGreaterThan(0);
      // gavda simmetrik (shlyapa va yelkalar)
      let same = 0,
        all = 0;
      for (let y = 0; y < 40; y++)
        for (let x = 0; x < 48; x++) {
          all++;
          if (!d[y * 96 + x] === !d[y * 96 + 95 - x]) same++;
        }
      expect(same / all).toBeGreaterThan(0.9);
    }
    expect(GUNNER_PORTRAIT_VARIANTS.length).toBe(3);
    for (const v of GUNNER_PORTRAIT_VARIANTS) expect(portraitPixels("gunner", v)).not.toBeNull();
  });

  it("is shown in the cut-in card of the super", () => {
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
    g.superMeter.value = 20;
    g.useSuper();
    expect(g.cast!.stage).toBe("card");
    (g as unknown as { renderCard(): void }).renderCard();
    expect(
      drawn.find((d) => d instanceof HTMLCanvasElement && d.width === GUNNER_PORTRAIT_GRID),
    ).toBeTruthy();
  });
});
