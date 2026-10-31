import { beforeEach, describe, expect, it } from "vitest";
import { HERO_THEME, ROLE_INFO } from "./hero";
import { ICON_COLORS, PALETTES } from "./sprites";
import { UPGRADES, cardFor } from "./waves";
import { Player, SHANG_WINDUP, SKY_CHARGE, VOW_TIME, SHANG_TIME } from "./player";
import { Game } from "./game";
import { Enemy } from "./enemy";
import { unlockHero } from "./save";
import {
  renderCrack,
  renderDazeStars,
  renderQuake,
  renderShockwave,
  renderSkyColumn,
  renderVowAura,
  renderWindupSparks,
} from "./paladinFx";
import { drawPaladinCard, drawRolesCard, drawTankCard } from "./menuScene";
import { heroBadge } from "./map";
import { drawRoleIcon } from "./roles";
import { RealmSim } from "@/realm/sim";
import { loadRealmData } from "@/realm/data";
import { netMob } from "@/realm/net/room";

const DT = 0.02;
/** O'yindagi tanga va ochko sarig'i */
const COIN_YELLOW = "#ffcc33";

function rgb(color: string): [number, number, number] | null {
  const h = /^#([0-9a-f]{6})$/i.exec(color);
  if (h) {
    const n = parseInt(h[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const r = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  return r ? [+r[1]!, +r[2]!, +r[3]!] : null;
}

/** To'q sariq (apelsin) oilasi: ton 10°–40°, to'yingan, juda qora ham, deyarli oq ham emas. */
function isOrange(color: string) {
  const c = rgb(color);
  if (!c) return false;
  const [r, g, b] = c.map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2,
    d = max - min;
  if (d < 0.15 || l < 0.2 || l > 0.88) return false;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return s > 0.45 && h >= 10 && h < 40;
}

/** Chizilgan barcha ranglarni (fill, stroke, gradient) yozib boradigan soxta canvas. */
function recorder() {
  const colors: string[] = [];
  const grad = { addColorStop: (_: number, c: string) => colors.push(c) };
  const ctx = new Proxy(
    {},
    {
      get: (_, k) =>
        k === "createLinearGradient" || k === "createRadialGradient"
          ? () => grad
          : k === "measureText"
            ? () => ({ width: 0 })
            : k === "canvas"
              ? { width: 320, height: 240 }
              : () => {},
      set: (_, k, v) => {
        if ((k === "fillStyle" || k === "strokeStyle") && typeof v === "string") colors.push(v);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, colors };
}

const noOrange = (colors: readonly string[]) => expect(colors.filter(isOrange)).toEqual([]);

function paladinGame() {
  unlockHero("paladin");
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement, "paladin");
  g.hints = [];
  const keeper = new Enemy("blob", 290, 30);
  keeper.spawn = 99;
  g.enemies = [keeper];
  g.banner.timer = 0;
  g.player.x = 60;
  g.player.y = 120;
  g.player.fx = 1;
  g.player.fy = 0;
  return g;
}

function foe(x: number, y: number) {
  const e = new Enemy("blob", x, y);
  e.spawn = 0;
  e.hp = e.maxHp = 30;
  e.speedMul = 0;
  return e;
}

const tick = (g: Game, s: number) => {
  for (let t = 0; t < s - 1e-9; t += DT) g.update(DT);
};

beforeEach(() => localStorage.clear());

describe("Paladin oltin rangda", () => {
  it("theme is gold + white holy light, not the coin yellow", () => {
    expect(HERO_THEME.paladin).toMatchObject({
      accent: "#f2c14e",
      accentDark: "#a87a12",
      glow: "#fff2b0",
    });
    const t = HERO_THEME.paladin;
    noOrange([t.accent, t.accentDark, t.glow, t.uiText, t.empty, t.trail]);
    for (const c of [t.accent, t.glow, t.uiText]) expect(c).not.toBe(COIN_YELLOW);
    // TANK belgisi va onlayn ism rangi ham oltin
    expect(ROLE_INFO.tank.color).toBe(t.accent);
    expect(t.uiText).toBe(t.accent);
  });

  it("sprite: gold armour, white tabard, silver blade — five colours, none orange", () => {
    const pal = PALETTES.paladin;
    expect(pal).toHaveLength(5);
    noOrange(pal);
    expect(pal).toContain(HERO_THEME.paladin.accent);
    // kumush tig': sovuq kulrang (ko'k kanal qizildan ko'p)
    const silver = rgb(pal[3]!)!;
    expect(silver[2]).toBeGreaterThan(silver[0]);
    // oq tabard
    expect(rgb(pal[4]!)!.every((v) => v > 230)).toBe(true);
  });

  it("power cards and their icons are gold", () => {
    const p = new Player("paladin");
    for (const u of UPGRADES) {
      if (u.hero && u.hero !== "paladin") continue;
      const c = cardFor(u, p);
      expect(isOrange(c.color), `${u.id}: ${c.color}`).toBe(false);
    }
    noOrange(["A", "Q", "U", "V", "Z"].map((k) => ICON_COLORS[k]!));
  });

  it("SHANG, OSMON HUKMI, ZARB TO'LQINI, QASAM and charge effects draw no orange", () => {
    const { ctx, colors } = recorder();
    const p = new Player("paladin");
    p.fx = 1;
    renderCrack(ctx, { x: 10, y: 10, fx: 1, fy: 0, len: 40, life: 1, seed: 3 });
    renderQuake(ctx, { x: 10, y: 10, r: 30, life: 0.2, max: 0.45 });
    renderShockwave(ctx, { x: 10, y: 10, vx: 100, vy: 0, size: 10 } as never);
    renderDazeStars(ctx, 10, 10, 0.3);
    p.vowT = VOW_TIME;
    renderVowAura(ctx, p, 0.5);
    p.charge = p.chargeTime;
    renderSkyColumn(ctx, p, 0.5);
    p.slamT = SHANG_WINDUP / 2;
    renderWindupSparks(ctx, p, 0.5);
    p.slamT = 0;
    p.attackTimer = SHANG_TIME / 2;
    renderWindupSparks(ctx, p, 0.5);
    expect(colors.length).toBeGreaterThan(20);
    noOrange(colors);
  });

  it("in a real fight every Paladin particle and text is gold or white", () => {
    const g = paladinGame();
    const p = g.player;
    g.enemies.push(foe(84, 120), foe(60, 96));
    g.input.pressAttack();
    tick(g, SHANG_WINDUP + 0.1);
    expect(g.cracks.length).toBe(1);
    // OSMON HUKMI
    tick(g, 1);
    g.input.setTouchAttack(true);
    tick(g, SKY_CHARGE + 0.1);
    g.input.setTouchAttack(false);
    tick(g, 0.06);
    // QASAM
    p.vowCooldown = 0;
    g.input.pressDash();
    g.input.setTouchDash(true);
    tick(g, 0.5);
    g.input.setTouchDash(false);
    tick(g, 0.04);
    expect(p.vowing).toBe(true);
    const texts = g.fx.texts.map((t) => t.s);
    expect(texts).toEqual(expect.arrayContaining(["OSMON HUKMI!", "QASAM!"]));
    noOrange(g.fx.particles.map((x) => x.color));
    noOrange(g.fx.texts.map((x) => x.color));
  });

  it("menu cards, map badge and the TANK role icon use the gold theme", () => {
    const { ctx, colors } = recorder();
    drawPaladinCard(ctx);
    drawRolesCard(ctx);
    drawTankCard(ctx);
    heroBadge(ctx, "paladin", 10, 10, true);
    drawRoleIcon(ctx, "tank", 0, 0);
    expect(colors).toContain(HERO_THEME.paladin.accent);
    noOrange(colors);
  });

  it("in the Realm OSMON HUKMI marks dazed mobs as holy (gold stars, sent to other players)", () => {
    const s = new RealmSim(loadRealmData());
    const rp = s.addPlayer("p1", "paladin");
    rp.p.takeHit = () => false;
    const m = s.mobs.find((m) => m.kind === "boar")!;
    rp.p.x = m.x - 14;
    rp.p.y = m.y;
    s.command(rp, { type: "attack", down: true });
    for (let t = 0; t < SKY_CHARGE + 0.1; t += 0.05) s.step();
    s.command(rp, { type: "attack", down: false });
    s.step();
    s.step();
    expect(m.stun).toBeGreaterThan(0);
    expect(m.holy).toBe(true);
    expect(netMob(m)[13]).toBe(2);
  });
});
