import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  FX_SLOTS,
  PLAIN_FX,
  THEME_SLOTS,
  defaultLook,
  heroBurst,
  heroImpact,
  heroTrail,
  renderFlair,
} from "./skinFx";
import { DANGER_COLORS, dangerDistance } from "./danger";
import { HEROES, HERO_THEME, chargeRingColor, hudBarColors, withAlpha } from "./hero";
import { SkinDemo, demoPhase } from "./skinDemo";
import { RealmPlayer, type RealmSim } from "@/realm/sim";
import { lookOf, nearestLook } from "@/realm/render";
import { SKINS, buySkin, skinLook } from "./skins";
import { Effects, MAX_PARTICLES, REDUCED_MAX_PARTICLES } from "./effects";
import { Game } from "./game";
import { unlockHero } from "./save";

beforeEach(() => localStorage.clear());

/** Chizilgan ranglarni yozib boradigan soxta canvas konteksti. */
function recordingCanvas() {
  const fills: string[] = [];
  const strokes: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_, k) =>
        k === "measureText"
          ? () => ({ width: 0 })
          : k === "canvas"
            ? { width: 960, height: 540 }
            : () => {},
      set: (_, k, v) => {
        if (k === "fillStyle") fills.push(v);
        if (k === "strokeStyle") strokes.push(v);
        return true;
      },
    },
  );
  const canvas = { getContext: () => ctx, width: 960, height: 540 };
  return { canvas: canvas as unknown as HTMLCanvasElement, fills, strokes };
}

const wallet = () => {
  let g = 9999;
  return { get: () => g, set: (n: number) => (g = n) };
};

type Internals = { renderSlash(c: unknown): void; ctx: unknown };

describe("Skin effekt tizimi", () => {
  it("default skin keeps the exact v3.6 theme and plain effects", () => {
    for (const h of HEROES) {
      const l = defaultLook(h);
      expect(skinLook(h, "default")).toMatchObject({ tier: "default", fx: PLAIN_FX });
      for (const k of Object.keys(HERO_THEME[h]) as (keyof typeof HERO_THEME.knight)[])
        expect(l.theme[k], `${h}.${k}`).toBe(HERO_THEME[h][k]);
      // HUD va zaryad halqasi — default skinda aynan eski ranglar
      expect(hudBarColors(l.theme)).toEqual(hudBarColors(h));
      expect(chargeRingColor(l.theme, true, 1)).toBe(chargeRingColor(h, true, 1));
    }
    // asl qattiq yozilgan ranglar slotlarga ko'chgan
    expect(DEFAULT_THEME.knight.edge).toBe("#ffffff");
    expect(DEFAULT_THEME.mage.edge).toBe("#d62832");
    expect(DEFAULT_THEME.gunner.ink).toBe("#0b0907");
  });

  it("every skin has a full theme (all slots) and effects", () => {
    for (const h of HEROES)
      for (const s of SKINS[h]) {
        for (const k of THEME_SLOTS) expect(s.theme[k], `${s.id}.${k}`).toMatch(/^#[0-9a-f]{6}$/);
        expect(s.theme.trail).toMatch(/^rgba\(\d+,\d+,\d+,0\.8\)$/);
        expect(s.fx.particle).toBeTruthy();
        expect(s.fx.trail).toBeTruthy();
        expect(Array.isArray(s.fx.bits)).toBe(true);
      }
  });

  it("paid skin effect colours stay far from enemy danger colours", () => {
    expect(DANGER_COLORS.length).toBeGreaterThan(8);
    for (const h of HEROES)
      for (const s of SKINS[h].slice(1)) {
        for (const k of FX_SLOTS)
          expect(dangerDistance(s.theme[k]), `${s.id}.${k} ${s.theme[k]}`).toBeGreaterThan(100);
        for (const b of s.fx.bits)
          expect(dangerDistance(b), `${s.id} bit ${b}`).toBeGreaterThan(100);
      }
  });

  it("the knight slash is drawn in the skin colours (default: white + accent)", () => {
    const run = () => {
      const r = recordingCanvas();
      const g = new Game(r.canvas, "knight");
      g.player.attackTimer = 0.2;
      (g as unknown as Internals).renderSlash((g as unknown as Internals).ctx);
      return r.strokes;
    };
    const plain = run();
    expect(plain.some((s) => s.startsWith("rgba(255,255,255,"))).toBe(true);
    expect(plain.some((s) => s.startsWith("rgba(104,205,228,"))).toBe(true);
    buySkin("knight", "knight-black", wallet());
    const black = run();
    expect(black.some((s) => s.startsWith("rgba(228,224,255,"))).toBe(true);
    expect(black.some((s) => s.startsWith("rgba(255,255,255,"))).toBe(false);
  });

  it("the game and HUD use the active skin theme", () => {
    unlockHero("paladin");
    buySkin("paladin", "paladin-silver", wallet());
    const g = new Game(recordingCanvas().canvas, "paladin");
    expect(g.look.id).toBe("paladin-silver");
    expect(g.theme.accent).toBe(SKINS.paladin[1]!.theme.accent);
  });
});

describe("Zarrachalar chegarasi va kamaytirish", () => {
  it("never keeps more than MAX_PARTICLES at once", () => {
    const fx = new Effects();
    fx.reduced = false;
    for (let i = 0; i < 100; i++) fx.burst(0, 0, "#fff", 20);
    expect(fx.particles.length).toBe(MAX_PARTICLES);
  });

  it("reduce-effects shrinks bursts and trails and skips impact flashes", () => {
    const count = (reduced: boolean) => {
      const fx = new Effects();
      fx.reduced = reduced;
      const look = skinLook("knight", "knight-ice");
      for (let i = 0; i < 10; i++) {
        heroBurst(fx, look, 0, 0, "#fff", 12);
        heroTrail(fx, look, 0, 0, look.theme.trail);
        fx.impact(0, 0, "crystal", "#fff", "#fff");
      }
      return { n: fx.particles.length, imp: fx.impacts.length };
    };
    const full = count(false),
      low = count(true);
    expect(low.n).toBeLessThan(full.n / 2);
    expect(low.imp).toBe(0);
    const fx = new Effects();
    fx.reduced = true;
    for (let i = 0; i < 100; i++) fx.burst(0, 0, "#fff", 20);
    expect(fx.particles.length).toBe(REDUCED_MAX_PARTICLES);
  });
});

describe("Skin darajalari", () => {
  it("each hero: one common (colours only), one rare (own particles/trail), one legendary", () => {
    for (const h of HEROES) {
      const [, common, rare, legend] = SKINS[h];
      expect([common!.tier, rare!.tier, legend!.tier]).toEqual(["common", "rare", "legendary"]);
      expect([common!.price, rare!.price, legend!.price]).toEqual([80, 150, 250]);
      // ODDIY: faqat ranglar
      expect(common!.fx).toEqual(PLAIN_FX);
      expect(common!.theme).not.toEqual(DEFAULT_THEME[h]);
      // NOYOB: o'z zarrachasi, izi va qo'shimcha ranglari; afsonaviy narsalar yo'q
      expect(rare!.fx.particle).not.toBe("square");
      expect(rare!.fx.trail).not.toBe("square");
      expect(rare!.fx.bits.length).toBeGreaterThan(0);
      expect([rare!.fx.impact, rare!.fx.flair, rare!.fx.tone]).toEqual([null, null, null]);
      // AFSONAVIY: + animatsiya, zarba shakli va ovoz
      expect(legend!.fx.particle).not.toBe("square");
      expect(legend!.fx.trail).not.toBe("square");
      expect(legend!.fx.impact).toBeTruthy();
      expect(legend!.fx.flair).toBeTruthy();
      expect(legend!.fx.tone).toBeTruthy();
    }
    // har afsonaviy skinning o'z shakli, animatsiyasi va ohangi
    const legends = HEROES.map((h) => SKINS[h][3]!.fx);
    for (const k of ["impact", "flair", "tone"] as const)
      expect(new Set(legends.map((f) => f[k])).size).toBe(HEROES.length);
  });

  it("legendary hits leave an impact shape; flair draws only for legendary skins", () => {
    unlockHero("gunner");
    const fx = new Effects();
    fx.reduced = false;
    heroImpact(fx, skinLook("knight", "knight-gold"), 0, 0);
    expect(fx.impacts).toHaveLength(0);
    heroImpact(fx, skinLook("knight", "knight-ice"), 0, 0);
    expect(fx.impacts[0]?.kind).toBe("crystal");
    for (const [id, draws] of [
      ["knight-ice", true],
      ["knight-gold", false],
      ["default", false],
    ] as const) {
      const r = recordingCanvas();
      const body = {
        x: 50,
        y: 50,
        fx: 1,
        dead: false,
        dashing: false,
        attackTimer: 0.2,
        spinning: false,
        anim: { state: "idle" },
      };
      renderFlair(r.canvas.getContext("2d")!, skinLook("knight", id), body, 1);
      expect(r.fills.length > 0, id).toBe(draws);
    }
  });
});

describe("Do'kon jonli preview va onlayn", () => {
  it("the shop demo cycles attack, strong attack and dash with the skin effects", () => {
    for (const h of HEROES)
      for (const s of SKINS[h]) {
        const r = recordingCanvas();
        const d = new SkinDemo(h, s, undefined);
        d.fx.reduced = false;
        const seen = new Set<string>();
        for (let i = 0; i < 260; i++) {
          d.update(1 / 60);
          d.render(r.canvas.getContext("2d")!);
          seen.add(demoPhase(d.t));
        }
        expect([...seen].sort(), s.id).toEqual(["attack", "charge", "dash", "idle", "strong"]);
        // skin ranglari chiziladi
        const used = new Set([...r.fills, ...r.strokes]);
        expect(
          [...used].some(
            (c) =>
              c.startsWith(withAlpha(s.theme.edge, 0).slice(0, -2)) ||
              c === s.theme.glow ||
              c === s.theme.accent ||
              c === s.theme.hot ||
              c === s.theme.spark,
          ),
          s.id,
        ).toBe(true);
      }
  });

  it("other players' effects use their skin id from the protocol (no extra field)", () => {
    // nearestLook faqat players'dan foydalanadi
    const sim = { players: new Map<string, RealmPlayer>() } as unknown as RealmSim;
    const a = new RealmPlayer("a", "gunner", 100, 100, 16);
    const b = new RealmPlayer("b", "gunner", 400, 100, 16);
    a.skin = "gunner-steppe";
    sim.players.set("a", a);
    sim.players.set("b", b);
    expect(lookOf(a).tier).toBe("legendary");
    // eski klient: skin maydonisiz — default ko'rinish
    expect(lookOf(b)).toBe(skinLook("gunner", null));
    expect(lookOf(b).tier).toBe("default");
    expect(nearestLook(sim, 110, 100, "gunner").id).toBe("gunner-steppe");
    expect(nearestLook(sim, 390, 100, "gunner").id).toBe("default");
    // noma'lum id — default
    b.skin = "gunner-nope";
    expect(lookOf(b).tier).toBe("default");
  });
});

describe("Skin kuch bermaydi", () => {
  /** O'yinchining barcha son va mantiqiy maydonlari (zarar, tezlik, cooldown, maydon, jon...) */
  const stats = (g: Game) => {
    const p = g.player as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(p))
      if (typeof p[k] === "number" || typeof p[k] === "boolean") out[k] = p[k];
    // hisoblanadigan qiymatlar
    out["reach"] = g.player.reach;
    out["hitDamage"] = g.player.hitDamage;
    out["size"] = g.player.size;
    return out;
  };

  it("damage, speed, cooldowns, reach and hitboxes are identical for every skin", () => {
    for (const h of HEROES) {
      unlockHero(h);
      const base = new Game(recordingCanvas().canvas, h);
      const want = stats(base);
      base.player.attackTimer = 0.2;
      const box = base.player.attackBox();
      for (const s of SKINS[h].slice(1)) {
        buySkin(h, s.id, wallet());
        const g = new Game(recordingCanvas().canvas, h);
        expect(g.look.id).toBe(s.id);
        expect(stats(g), s.id).toEqual(want);
        g.player.attackTimer = 0.2;
        expect(g.player.attackBox(), s.id).toEqual(box);
      }
    }
  });
});
