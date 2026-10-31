import { beforeEach, describe, expect, it } from "vitest";
import { Game } from "./game";
import { Boss, ForestKing, Queen } from "./boss";
import {
  BERSERK_TIME,
  BOSS_FIGHT_TIME,
  INTRO_TIME,
  PHASE_GUARD,
  bossHpFor,
  heroDps,
  phaseFor,
} from "./bossPower";
import { Player, type PlayerInput, type Target } from "./player";
import { UPGRADES, cardFor, BOSS_WAVE } from "./waves";
import { applyShop, SHOP_ITEMS, emptyLevels } from "./shop";
import type { Hero } from "./hero";

type GI = {
  startWave(i: number): void;
  damageTarget(t: unknown, dmg: number): void;
};

function makeGame() {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement);
  return { g, gi: g as unknown as GI };
}

function tick(g: Game, seconds: number, dt = 0.02) {
  for (let t = 0; t < seconds; t += dt) g.update(dt);
}

beforeEach(() => localStorage.clear());

const HEROES: Hero[] = ["knight", "mage", "hunter", "gunner"];
type Power = "kuchsiz" | "o'rtacha" | "maksimal";

/** Kartani qahramonga moslab qo'llash (mumkin bo'lsa). */
function card(p: Player, id: string, times = 1) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u || (u.hero && u.hero !== p.hero)) return;
  const c = cardFor(u, p);
  for (let i = 0; i < times && c.ok(p); i++) c.apply(p);
}

/** Kuchsiz — yangi qahramon; o'rtacha — 2-3 karta va do'kon tig'i; maksimal — hamma zarar kartalari + do'kon to'liq. */
function powered(hero: Hero, power: Power) {
  const p = new Player(hero);
  if (power === "kuchsiz") return p;
  const shop = emptyLevels();
  if (power === "o'rtacha") {
    shop.blade = 1;
    applyShop(p, shop);
    card(p, "haste");
    if (hero === "mage") card(p, "triple");
    if (hero === "hunter") card(p, "venom");
    return p;
  }
  for (const item of SHOP_ITEMS) shop[item.id] = item.costs.length;
  applyShop(p, shop);
  card(p, "blade", 5);
  card(p, "haste", 5);
  for (const id of ["triple", "htriple", "venom", "drum"]) card(p, id);
  return p;
}

/**
 * "Ideal urib turish": bitta nishonga to'xtovsiz hujum, kuchli zarba tayyor bo'lishi bilan
 * bosib turib qo'yib yuboriladi (Merganda — oddiy otish va qayta o'qlash). Har zarba tegadi.
 * Haqiqiy Player.update bilan hisoblanadi — formula (heroDps) bilan solishtirish uchun mustaqil.
 */
function killTime(p: Player, hp: number) {
  let held = false;
  let press = false;
  const input: PlayerInput = {
    consumeAttack: () => {
      const a = press;
      press = false;
      return a;
    },
    consumeDash: () => false,
    axis: () => ({ x: 0, y: 0 }),
    attackHeld: () => held,
    consumeReload: () => false,
  };
  const dt = 1 / 60;
  let dmg = 0;
  let hitOnce = false;
  for (let t = 0; t < 400; t += dt) {
    const strong = !p.gunner && p.spinCooldown <= 0;
    if (strong) held = !p.charged;
    else {
      held = false;
      press = true;
    }
    const cd0 = p.cooldown,
      spin0 = p.spinTimer;
    p.update(dt, input);
    if (!p.ranged && p.cooldown > cd0 + 1e-6) dmg += p.damage;
    if ((p.hero === "knight" || p.hero === "mage") && p.spinTimer > 0 && spin0 <= 0)
      dmg += 2 * p.damage;
    for (const b of p.bolts) dmg += p.damage * (b.power ?? 1);
    if (p.bolts.length || dmg > 0) hitOnce = true;
    p.bolts = [];
    // zaharli uch: zahar uzilmaydi — har soniya 1 zarar
    if (p.poisonTip && hitOnce) dmg += dt;
    if (dmg >= hp) return t;
  }
  return Infinity;
}

describe("Boss kuchga moslashuvi", () => {
  for (const hero of HEROES)
    for (const power of ["kuchsiz", "o'rtacha", "maksimal"] as Power[])
      it(`${hero} (${power}): ideal urib turishda boss 50–120 s da o'ladi`, () => {
        const p = powered(hero, power);
        const hp = bossHpFor(p, 30);
        const t = killTime(p, hp);
        expect(t).toBeGreaterThanOrEqual(50);
        expect(t).toBeLessThanOrEqual(120);
      });

  it("stronger players face a tougher boss, never below the base hp", () => {
    for (const hero of HEROES) {
      const weak = bossHpFor(powered(hero, "kuchsiz"), 30);
      const mid = bossHpFor(powered(hero, "o'rtacha"), 30);
      const max = bossHpFor(powered(hero, "maksimal"), 30);
      expect(weak).toBeGreaterThanOrEqual(30);
      expect(mid).toBeGreaterThan(weak);
      expect(max).toBeGreaterThan(mid);
      expect(max).toBe(Math.ceil(heroDps(powered(hero, "maksimal")) * BOSS_FIGHT_TIME));
    }
    // juda katta asosiy jon — pastki chegara
    expect(bossHpFor(new Player(), 9999)).toBe(9999);
  });

  it("the game builds every boss from the player's current power", () => {
    const { g, gi } = makeGame();
    g.player.damage = 3;
    g.player.attackCd = 0.2;
    gi.startWave(BOSS_WAVE);
    expect(g.boss!.maxHp).toBe(bossHpFor(g.player, 30));
    expect(g.boss!.maxHp).toBeGreaterThan(bossHpFor(new Player(), 30));
  });
});

describe("Boss fazalari", () => {
  it("three phases at 60% and 30%", () => {
    expect(phaseFor(100, 100)).toBe(1);
    expect(phaseFor(61, 100)).toBe(1);
    expect(phaseFor(60, 100)).toBe(2);
    expect(phaseFor(31, 100)).toBe(2);
    expect(phaseFor(30, 100)).toBe(3);
    expect(phaseFor(1, 100)).toBe(3);
  });

  for (const make of [() => new Boss(100), () => new Queen(100), () => new ForestKing(100)])
    it(`${make().constructor.name}: a hit stops at the phase line, then a short guard`, () => {
      const b = make();
      b.spawn = 0;
      const p = new Player();
      p.takeHit = () => false;
      p.x = 40;
      p.y = 200;
      // katta zarba ham faza chegarasida to'xtaydi
      expect(b.takeDamage(55)).toBe(true);
      expect(b.hp).toBe(60);
      b.update(0.01, p as Target);
      expect(b.phase).toBe(2);
      expect(b.justPhased).toBe(true);
      expect(b.invulnerable).toBe(true);
      expect(b.takeDamage(5)).toBe(false);
      expect(b.hp).toBe(60);
      for (let t = 0; t < PHASE_GUARD + 0.1; t += 0.05) b.update(0.05, p as Target);
      expect(b.invulnerable).toBe(false);
      b.takeDamage(45);
      expect(b.hp).toBe(30);
      b.update(0.01, p as Target);
      expect(b.phase).toBe(3);
      // o'ldiradigan zarba chegarada to'xtamaydi
      for (let t = 0; t < PHASE_GUARD + 0.1; t += 0.05) b.update(0.05, p as Target);
      b.takeDamage(999);
      expect(b.dead).toBe(true);
    });

  it("the game shows a phase banner, flashes and clears fireballs", () => {
    const { g, gi } = makeGame();
    gi.startWave(BOSS_WAVE);
    g.enemies = [];
    const b = g.boss!;
    b.spawn = 0;
    g.player.takeHit = () => false;
    tick(g, 0.1);
    gi.damageTarget(b, b.maxHp * 0.5);
    tick(g, 0.04);
    expect(b.phase).toBe(2);
    expect(g.banner.title).toBe("2-FAZA: OLOV YO'LAGI");
    expect(g.phaseFlash).toBeGreaterThan(0);
    // daxlsizlikda zarar o'tmaydi
    const hp = b.hp;
    gi.damageTarget(b, 3);
    expect(b.hp).toBe(hp);
  });

  it("after 3 minutes the boss goes berserk: +1 damage and faster", () => {
    const b = new Boss(500);
    b.spawn = 0;
    const p = new Player();
    p.takeHit = () => false;
    p.x = 40;
    p.y = 200;
    expect(b.dmg(2)).toBe(2);
    for (let t = 0; t < BERSERK_TIME; t += 0.5) b.update(0.5, p as Target);
    b.update(0.05, p as Target);
    expect(b.berserk).toBe(true);
    expect(b.justBerserk).toBe(true);
    expect(b.dmg(2)).toBe(3);
    // bir xil vaqtda ko'proq yuradi
    const slow = new Boss(500);
    slow.spawn = 0;
    b.x = slow.x = 100;
    b.y = slow.y = 100;
    p.x = 260;
    p.y = 100;
    b.slamTimer = slow.slamTimer = 99;
    b.update(0.1, p as Target);
    slow.update(0.1, p as Target);
    expect(b.x - 100).toBeGreaterThan(slow.x - 100);
    expect(slow.x).toBeGreaterThan(100);
  });
});

describe("Boss kirishi", () => {
  it("zooms in with a name card; the world waits; any key skips", () => {
    const { g, gi } = makeGame();
    gi.startWave(BOSS_WAVE);
    expect(g.intro).toBe(INTRO_TIME);
    const e = g.enemies[0]!;
    const spawn = e.spawn;
    tick(g, 0.5);
    // dunyo to'xtab turadi, boss paydo bo'lmoqda
    expect(e.spawn).toBe(spawn);
    expect(g.intro).toBeLessThan(INTRO_TIME);
    expect(g.boss!.spawn).toBeGreaterThan(0);
    g.input.pressAttack();
    tick(g, 0.02);
    expect(g.intro).toBe(0);
    expect(g.boss!.spawn).toBeLessThanOrEqual(0.3);
    expect(g.bossKind()).toBe("devil");
  });

  it("ends by itself after the intro time", () => {
    const { g, gi } = makeGame();
    gi.startWave(BOSS_WAVE);
    tick(g, INTRO_TIME + 0.1);
    expect(g.intro).toBe(0);
    tick(g, 0.5);
    expect(g.boss!.active).toBe(true);
  });
});
