import { beforeEach, describe, expect, it } from "vitest";
import {
  HAMLA_TIME,
  PALADIN_MAX_HP,
  PALADIN_SPEED,
  Player,
  SHANG_CD,
  SHANG_WINDUP,
  SKY_CD,
  SKY_CHARGE,
  SKY_STUN,
  TRAP_HOLD,
  VOW_CD,
  VOW_TIME,
} from "./player";
import { Game } from "./game";
import { Enemy } from "./enemy";
import { BIG_HIT, heroDps } from "./bossPower";
import { unlockHero } from "./save";
import type { Input } from "./input";

const DT = 0.02;

function keys(
  o: Partial<{
    attack: boolean;
    held: boolean;
    dash: boolean;
    shift: boolean;
    x: number;
    y: number;
  }>,
) {
  return {
    consumeAttack: () => !!o.attack,
    consumeDash: () => !!o.dash,
    attackHeld: () => !!o.held,
    dashHeld: () => !!o.shift,
    axis: () => ({ x: o.x ?? 0, y: o.y ?? 0 }),
  } as unknown as Input;
}

function run(p: Player, seconds: number, input = keys({})) {
  for (let t = 0; t < seconds - 1e-9; t += DT) p.update(DT, input);
}

function paladin() {
  const p = new Player("paladin");
  p.fx = 1;
  p.fy = 0;
  return p;
}

export function makePaladinGame() {
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

function tick(g: Game, seconds: number) {
  for (let t = 0; t < seconds - 1e-9; t += DT) g.update(DT);
}

function foe(kind: Enemy["kind"], x: number, y: number, hp = 20) {
  const e = new Enemy(kind, x, y);
  e.spawn = 0;
  e.hp = e.maxHp = hp;
  e.speedMul = 0;
  return e;
}

beforeEach(() => localStorage.clear());

describe("Paladin ko'rsatkichlari", () => {
  it("is the toughest and slowest hero", () => {
    const p = paladin();
    expect(p.maxHp).toBe(PALADIN_MAX_HP);
    expect(PALADIN_MAX_HP).toBe(8);
    for (const h of ["knight", "mage", "hunter", "gunner"] as const) {
      const o = new Player(h);
      expect(p.maxHp).toBeGreaterThan(o.maxHp);
      expect(p.speed).toBeLessThan(o.speed);
    }
    expect(p.speed).toBe(PALADIN_SPEED);
    expect(p.ranged).toBe(false);
    expect(p.anim.defs.attack.frames).toBe(4);
  });

  it("heavy armour turns 2-heart hits into 1 and halves knockback", () => {
    const p = paladin();
    const k = new Player("knight");
    p.takeHit(BIG_HIT, p.x - 10, p.y, 260);
    k.takeHit(BIG_HIT, k.x - 10, k.y, 260);
    expect(p.maxHp - p.hp).toBe(1);
    expect(k.maxHp - k.hp).toBe(2);
    expect(p.vx).toBeCloseTo(k.vx / 2);
    // oddiy 1 yurakli zarba o'zgarmaydi
    const q = paladin();
    q.takeHit(1, q.x - 10, q.y, 100);
    expect(q.maxHp - q.hp).toBe(1);
  });
});

describe("SHANG", () => {
  it("raises the sword for 0.4 s, then strikes a lane twice the knight's reach", () => {
    const p = paladin();
    p.update(DT, keys({ attack: true }));
    expect(p.slamT).toBeGreaterThan(0);
    expect(p.attackBox()).toBeNull();
    run(p, SHANG_WINDUP - 0.06);
    expect(p.attackBox()).toBeNull();
    run(p, 0.08);
    const box = p.attackBox()!;
    expect(box).not.toBeNull();
    const knight = new Player("knight");
    knight.fx = 1;
    knight.fy = 0;
    knight.update(DT, keys({ attack: true }));
    const kb = knight.attackBox()!;
    const kReach = kb.x - knight.x + kb.size / 2;
    const pReach = box.x - p.x + box.w! / 2;
    expect(pReach).toBeGreaterThanOrEqual(kReach * 2 - 1);
    expect(p.hitDamage).toBe(2);
  });

  it("hits every enemy along the lane for 2 damage, knocks them back, and cools down 0.9 s", () => {
    const g = makePaladinGame();
    const near = foe("blob", 72, 120);
    const far = foe("blob", 98, 120);
    const out = foe("blob", 130, 120);
    g.enemies.push(near, far, out);
    g.input.pressAttack();
    tick(g, SHANG_WINDUP + 0.1);
    expect(near.maxHp - near.hp).toBe(2);
    expect(far.maxHp - far.hp).toBe(2);
    expect(out.hp).toBe(out.maxHp);
    expect(g.player.cooldown).toBeGreaterThan(0);
    expect(SHANG_CD).toBe(0.9);
    expect(g.cracks.length).toBe(1);
  });
});

describe("OSMON HUKMI", () => {
  it("charges 1 s, then hits all around for 3x and stuns for 1 s", () => {
    const g = makePaladinGame();
    const p = g.player;
    const a = foe("blob", 60, 90);
    const b = foe("blob", 30, 120);
    g.enemies.push(a, b);
    // SHANG bosilmasin — faqat bosib turish (hujum navbati bo'sh)
    g.input.setTouchAttack(true);
    tick(g, SKY_CHARGE + 0.04);
    expect(p.charged).toBe(true);
    g.input.setTouchAttack(false);
    tick(g, 0.04);
    expect(a.maxHp - a.hp).toBe(3);
    expect(b.maxHp - b.hp).toBe(3);
    expect(a.stun).toBeGreaterThan(SKY_STUN - 0.1);
    expect(p.spinCooldown).toBeGreaterThan(SKY_CD - 0.2);
  });
});

describe("MUQADDAS HAMLA", () => {
  it("is a short heavy rush: invulnerable while rushing and in the guard tail, rams for 1 damage", () => {
    const g = makePaladinGame();
    const p = g.player;
    const e = foe("blob", 84, 120);
    g.enemies.push(e);
    g.input.pressDash();
    g.input.setTouchDash(true);
    g.update(DT);
    g.input.setTouchDash(false);
    g.update(DT);
    expect(p.dashing).toBe(true);
    expect(p.takeHit(1, p.x + 5, p.y, 100)).toBe(false);
    tick(g, HAMLA_TIME);
    expect(e.maxHp - e.hp).toBe(1);
    expect(p.evading).toBe(true);
    expect(p.hp).toBe(p.maxHp);
  });
});

describe("QASAM", () => {
  it("holding Shift swears the vow: 4 s, half damage, 10 s cooldown", () => {
    const p = paladin();
    p.update(DT, keys({ dash: true, shift: true }));
    run(p, TRAP_HOLD + 0.04, keys({ shift: true }));
    expect(p.vowing).toBe(true);
    expect(p.vowT).toBeGreaterThan(VOW_TIME - 0.1);
    expect(p.vowCooldown).toBeGreaterThan(VOW_CD - 0.5);
    // ikki 1 yurakli zarba — jami 1 yurak
    p.takeHit(1, p.x - 5, p.y, 50);
    p.invuln = 0;
    p.takeHit(1, p.x - 5, p.y, 50);
    expect(p.maxHp - p.hp).toBe(1);
    run(p, VOW_TIME);
    expect(p.vowing).toBe(false);
  });

  it("big hits during the vow: 2 -> 1 (armour) -> half", () => {
    const p = paladin();
    p.vowT = VOW_TIME;
    p.takeHit(BIG_HIT, p.x - 5, p.y, 50);
    p.invuln = 0;
    p.takeHit(BIG_HIT, p.x - 5, p.y, 50);
    expect(p.maxHp - p.hp).toBe(1);
  });
});

describe("Boss kuchi", () => {
  it("adapts boss hp to the paladin's dps", () => {
    const p = paladin();
    const dps = heroDps(p);
    expect(dps).toBeGreaterThan(1.5);
    expect(dps).toBeLessThan(heroDps(new Player("knight")) * 1.2);
  });
});
