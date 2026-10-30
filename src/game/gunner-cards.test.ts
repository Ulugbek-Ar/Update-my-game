import { beforeEach, describe, expect, it } from "vitest";
import { GUN_RANGE, GUN_SPEED, Player, RELOAD_TIME, type Bolt } from "./player";
import { UPGRADES, cardFor, pickUpgrades, upgradeIcon } from "./waves";
import { UPGRADE_ICONS } from "./sprites";
import { Game } from "./game";
import { Enemy } from "./enemy";
import { unlockHero } from "./save";

const card = (id: string) => UPGRADES.find((u) => u.id === id)!;

beforeEach(() => localStorage.clear());

describe("Mergan kuch kartalari", () => {
  // id -> [Ritsar nomi, Mergan nomi, Mergan ikonkasi]
  const expected: Record<string, [string, string, string]> = {
    heart: ["TEMIR YURAK", "QAYSAR YURAK", "gheart"],
    blade: ["O'TKIR QILICH", "OG'IR O'Q", "slug"],
    reach: ["UZUN TIG'", "UZOQ NISHON", "sight"],
    haste: ["CHAQQON QO'L", "TEZ QO'L", "cylinder"],
    wind: ["SHAMOL QADAMI", "CHAQQON OYOQ", "spur"],
    vamp: ["QON TOMIRI", "OV PULI", "bounty"],
    thorns: ["TIKANLI ZIRH", "TEMIR KAMZUL", "vest"],
    dash2: ["IKKI KARRA DASH", "IKKI KARRA SIRPANISH", "slide2"],
    mend: ["SHIFO", "DORI SHISHASI", "flask"],
  };
  const SWORDS = ["blade", "reach", "dash2", "thorns", "haste", "wind", "vamp", "heart", "mend"];

  it("every shared card has its own Mergan name, icon and copper/brass colour", () => {
    const knight = new Player("knight");
    const gunner = new Player("gunner");
    for (const [id, [kName, gName, gIcon]] of Object.entries(expected)) {
      const k = cardFor(card(id), knight);
      const g = cardFor(card(id), gunner);
      expect(k.name).toBe(kName);
      expect(g.name).toBe(gName);
      expect(upgradeIcon(g)).toBe(gIcon);
      expect(UPGRADE_ICONS[gIcon]).toBeDefined();
      expect(SWORDS).not.toContain(upgradeIcon(g));
      expect(g.color).not.toBe(k.color);
      expect(g.desc).not.toMatch(/[Qq]ilich|[Dd]ash|[Zz]arba maydoni|[Kk]amon/);
    }
  });

  it("Mergan has 11 cards of its own, including KATTA BARABAN and RIKOSHET", () => {
    const seen = new Map<string, string>();
    for (let i = 0; i < 400; i++) {
      // jon kam — DORI SHISHASI ham chiqa oladi
      const p = new Player("gunner");
      p.hp = 1;
      for (const u of pickUpgrades(p)) seen.set(u.id, u.name);
    }
    expect(seen.size).toBe(11);
    expect(seen.get("drum")).toBe("KATTA BARABAN");
    expect(seen.get("ricochet")).toBe("RIKOSHET");
    // Sehrgar va Ovchining maxsus kartalari chiqmaydi
    for (const id of ["triple", "pierce", "htriple", "venom"]) expect(seen.has(id)).toBe(false);
  });

  it("KATTA BARABAN and RIKOSHET never show up for the other heroes", () => {
    expect(card("drum").hero).toBe("gunner");
    expect(card("ricochet").hero).toBe("gunner");
    for (const hero of ["knight", "mage", "hunter"] as const)
      for (let i = 0; i < 300; i++)
        for (const u of pickUpgrades(new Player(hero))) {
          expect(u.id).not.toBe("drum");
          expect(u.id).not.toBe("ricochet");
        }
  });

  it("applies the gunner effects", () => {
    const apply = (id: string) => {
      const p = new Player("gunner");
      cardFor(card(id), p).apply(p);
      return p;
    };
    expect(apply("blade").damage).toBe(2);
    const far = apply("reach");
    expect(far.boltSpeed).toBe(GUN_SPEED + 60);
    expect(far.range).toBe(GUN_RANGE + 60);
    expect(apply("haste").reloadTime).toBeCloseTo(RELOAD_TIME * 0.7);
    expect(apply("dash2").dashMax).toBe(2);
    expect(apply("thorns").thorns).toBe(true);
    expect(apply("vamp").lifesteal).toBe(6);
    const drum = apply("drum");
    expect([drum.ammoMax, drum.ammo]).toEqual([8, 8]);
    expect(cardFor(card("drum"), drum).ok(drum)).toBe(false);
    const rico = apply("ricochet");
    expect(rico.bounce).toBe(1);
    expect(cardFor(card("ricochet"), rico).ok(rico)).toBe(false);
    // TEZ QO'L ko'pi bilan 2 marta
    const quick = new Player("gunner");
    const haste = cardFor(card("haste"), quick);
    haste.apply(quick);
    haste.apply(quick);
    expect(haste.ok(quick)).toBe(false);
  });

  it("with KATTA BARABAN the fan fires all 8 rounds", () => {
    const p = new Player("gunner");
    cardFor(card("drum"), p).apply(p);
    const input = {
      consumeAttack: () => false,
      consumeDash: () => false,
      axis: () => ({ x: 0, y: 0 }),
      attackHeld: () => held,
    };
    let held = true;
    for (let t = 0; t < 0.7; t += 0.02) p.update(0.02, input);
    held = false;
    for (let t = 0; t < 0.6; t += 0.02) p.update(0.02, input);
    expect(p.bolts).toHaveLength(8);
  });

  it("RIKOSHET: a bullet bounces off a wall once and hits the enemy behind", () => {
    unlockHero("gunner");
    const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
    const make = () => {
      const g = new Game(canvas as unknown as HTMLCanvasElement, "gunner");
      g.player.update = () => {};
      g.player.x = 120;
      g.player.y = 60;
      const e = new Enemy("rammer", 230, 150);
      e.spawn = 0;
      e.aiTimer = 99;
      g.enemies = [e];
      return { g, e };
    };
    const bullet = (bounce: number, range = 400): Bolt => ({
      x: 262,
      y: 150,
      vx: 300,
      vy: 0,
      size: 4,
      left: 1,
      hit: [],
      bullet: true,
      range,
      bounce,
    });
    const plain = make();
    plain.g.bolts = [bullet(0)];
    for (let i = 0; i < 40; i++) plain.g.update(0.02);
    expect(plain.e.hp).toBe(plain.e.maxHp);
    const rico = make();
    rico.g.bolts = [bullet(1)];
    for (let i = 0; i < 40; i++) rico.g.update(0.02);
    expect(rico.e.hp).toBe(rico.e.maxHp - 1);
    // faqat bir marta qaytadi: ikkinchi devorda yo'qoladi
    const once = make();
    once.g.enemies[0]!.x = 290;
    once.g.enemies[0]!.y = 40;
    once.g.bolts = [{ ...bullet(1, 2000), y: 120 }];
    for (let i = 0; i < 120; i++) once.g.update(0.02);
    expect(once.g.bolts).toHaveLength(0);
  });
});
