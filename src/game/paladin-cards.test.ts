import { beforeEach, describe, expect, it } from "vitest";
import { UPGRADES, cardFor, pickUpgrades, upgradeIcon } from "./waves";
import { UPGRADE_ICONS } from "./sprites";
import { AURA_EVERY, Player, SHANG_WINDUP, WAVE_RANGE } from "./player";
import { HEROES } from "./hero";
import { Game } from "./game";
import { Enemy } from "./enemy";
import { unlockHero } from "./save";

const card = (id: string) => UPGRADES.find((u) => u.id === id)!;
const DT = 0.02;

beforeEach(() => localStorage.clear());

describe("Paladin kuch kartalari", () => {
  const expected: Record<string, [string, string]> = {
    heart: ["MUQADDAS YURAK", "pheart"],
    blade: ["OG'IR TIG'", "greatblade"],
    reach: ["OSMON QILICHI", "skyblade"],
    haste: ["QAT'IYAT", "resolve"],
    wind: ["HAQ YO'LI", "path"],
    vamp: ["IMON NURI", "faith"],
    thorns: ["QASOS ZIRHI", "avenger"],
    dash2: ["IKKI KARRA HAMLA", "hamla2"],
    mend: ["DUO", "prayer"],
  };

  it("every shared card has its own Paladin name, gold colour and code-drawn icon", () => {
    const knight = new Player("knight");
    const p = new Player("paladin");
    for (const [id, [name, icon]] of Object.entries(expected)) {
      const k = cardFor(card(id), knight);
      const c = cardFor(card(id), p);
      expect(c.name).toBe(name);
      expect(upgradeIcon(c)).toBe(icon);
      expect(UPGRADE_ICONS[icon]).toHaveLength(12);
      expect(["#f2c14e", "#fff2b0"]).toContain(c.color);
      expect(c.color).not.toBe(k.color);
      expect(c.desc).not.toMatch(/[Dd]ash|[Tt]eleport|[Qq]alqon/);
    }
  });

  it("OSMON QILICHI lengthens the SHANG lane; QAT'IYAT shortens the cooldown", () => {
    const p = new Player("paladin");
    p.fx = 1;
    const reach = cardFor(card("reach"), p);
    reach.apply(p);
    expect(p.reach).toBe(25);
    reach.apply(p);
    expect(reach.ok(p)).toBe(false);
    const haste = cardFor(card("haste"), p);
    const cd = p.attackCd;
    haste.apply(p);
    expect(p.attackCd).toBeCloseTo(cd * 0.75);
  });

  it("Paladin has 11 cards, including ZARB TO'LQINI and MUQADDAS AURA", () => {
    const seen = new Map<string, string>();
    for (let i = 0; i < 400; i++) {
      const p = new Player("paladin");
      p.hp = 1;
      for (const u of pickUpgrades(p)) seen.set(u.id, u.name);
    }
    expect(seen.size).toBe(11);
    expect(seen.get("shockwave")).toBe("ZARB TO'LQINI");
    expect(seen.get("aura")).toBe("MUQADDAS AURA");
  });

  it("ZARB TO'LQINI and MUQADDAS AURA only show up for the Paladin", () => {
    expect(card("shockwave").hero).toBe("paladin");
    expect(card("aura").hero).toBe("paladin");
    for (const h of HEROES.filter((h) => h !== "paladin"))
      for (let i = 0; i < 200; i++)
        for (const u of pickUpgrades(new Player(h)))
          expect(["shockwave", "aura"]).not.toContain(u.id);
  });

  it("ZARB TO'LQINI: SHANG launches a wave that flies on and hits everything in its path", () => {
    unlockHero("paladin");
    const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
    const g = new Game(canvas as unknown as HTMLCanvasElement, "paladin");
    g.hints = [];
    g.banner.timer = 0;
    const keeper = new Enemy("blob", 290, 30);
    keeper.spawn = 99;
    const far = new Enemy("blob", 150, 120);
    far.spawn = 0;
    far.hp = far.maxHp = 9;
    far.speedMul = 0;
    g.enemies = [keeper, far];
    const p = g.player;
    p.x = 60;
    p.y = 120;
    p.fx = 1;
    p.fy = 0;
    p.shockwave = true;
    g.input.pressAttack();
    for (let t = 0; t < SHANG_WINDUP + 0.05; t += DT) g.update(DT);
    expect(g.bolts.some((b) => b.wave)).toBe(true);
    for (let t = 0; t < WAVE_RANGE / 190; t += DT) g.update(DT);
    expect(far.hp).toBeLessThan(far.maxHp);
  });

  it("MUQADDAS AURA heals 1 heart every 15 s", () => {
    const p = new Player("paladin");
    p.aura = true;
    p.hp = 3;
    const input = {
      consumeAttack: () => false,
      consumeDash: () => false,
      attackHeld: () => false,
      axis: () => ({ x: 0, y: 0 }),
    };
    for (let t = 0; t < AURA_EVERY - 0.1; t += 0.05) p.update(0.05, input);
    expect(p.hp).toBe(3);
    for (let t = 0; t < 0.2; t += 0.05) p.update(0.05, input);
    expect(p.hp).toBe(4);
  });
});
