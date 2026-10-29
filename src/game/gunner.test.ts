import { beforeEach, describe, expect, it } from "vitest";
import {
  CHARGE_TIME,
  FAN_CD,
  FAN_SPREAD,
  FAN_TIME,
  GUN_AMMO,
  GUN_RANGE,
  GUNNER_MAX_HP,
  GUNNER_SPEED,
  Player,
  RELOAD_TIME,
  SLIDE_AMMO,
  SMOKE_CD,
  SMOKE_HIDE,
  TRAP_HOLD,
  type Bolt,
} from "./player";
import { Game, SMOKE_LIFE, SMOKE_RADIUS } from "./game";
import { Enemy } from "./enemy";
import { HERO_THEME, HERO_NAMES } from "./hero";
import { unlockHero } from "./save";
import type { Input } from "./input";

const DT = 0.02;

/** Boshqaruv: bosilgan/bosib turilgan tugmalar. */
function keys(
  o: Partial<{
    attack: boolean;
    held: boolean;
    dash: boolean;
    shift: boolean;
    reload: boolean;
    x: number;
    y: number;
  }>,
) {
  return {
    consumeAttack: () => !!o.attack,
    consumeDash: () => !!o.dash,
    consumeReload: () => !!o.reload,
    attackHeld: () => !!o.held,
    dashHeld: () => !!o.shift,
    axis: () => ({ x: o.x ?? 0, y: o.y ?? 0 }),
  } as unknown as Input;
}

function run(p: Player, seconds: number, input = keys({})) {
  for (let t = 0; t < seconds - 1e-9; t += DT) p.update(DT, input);
}

function gunner() {
  const p = new Player("gunner");
  p.fx = 1;
  p.fy = 0;
  return p;
}

/** Bitta o'q: tepkini bosadi va otishlar orasidagi vaqtni kutadi. */
function shot(p: Player) {
  p.update(DT, keys({ attack: true }));
  run(p, p.attackCd + 0.02);
}

/** Shift'ni qisqa bosish: qo'yib yuborilganda sirpanadi. */
function slide(p: Player, x = 0, y = 0) {
  p.update(DT, keys({ dash: true, shift: true, x, y }));
  p.update(DT, keys({ x, y }));
}

function makeGame() {
  unlockHero("gunner");
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement, "gunner");
  g.hints = [];
  // to'lqin tugab qolmasligi uchun uzoqda hali paydo bo'layotgan dushman
  const keeper = new Enemy("blob", 290, 30);
  keeper.spawn = 99;
  g.enemies = [keeper];
  g.banner.timer = 0;
  return g;
}

function tick(g: Game, seconds: number) {
  for (let t = 0; t < seconds - 1e-9; t += DT) g.update(DT);
}

/** Tutun bombasi: Shift'ni TRAP_HOLD dan ko'p bosib turish. */
function smokeBomb(g: Game) {
  g.input.pressDash();
  g.input.setTouchDash(true);
  tick(g, TRAP_HOLD + 0.06);
  g.input.setTouchDash(false);
  g.update(DT);
}

function foe(kind: Enemy["kind"], x: number, y: number) {
  const e = new Enemy(kind, x, y);
  e.spawn = 0;
  return e;
}

beforeEach(() => localStorage.clear());

describe("Mergan", () => {
  it("is the fourth hero: 5 hearts, speed 92, same collision size, copper theme", () => {
    const p = new Player("gunner");
    expect(HERO_NAMES.gunner).toBe("MERGAN");
    expect([p.hp, p.maxHp]).toEqual([GUNNER_MAX_HP, 5]);
    expect(p.speed).toBe(GUNNER_SPEED);
    expect(p.speed).toBe(92);
    expect(p.size).toBe(new Player("knight").size);
    expect(p.ammo).toBe(GUN_AMMO);
    expect(HERO_THEME.gunner).toMatchObject({
      accent: "#d9a441",
      accentDark: "#8a5a2a",
      glow: "#ffe2a0",
    });
  });

  it("Space fires one fast bullet in the facing direction (1 damage), not a melee swing", () => {
    const p = gunner();
    p.fx = 0;
    p.fy = -1;
    p.update(DT, keys({ attack: true }));
    expect(p.bolts).toHaveLength(1);
    const b = p.bolts[0]!;
    expect(b.bullet).toBe(true);
    expect(b.vy).toBeLessThan(-250);
    expect(Math.abs(b.vx)).toBeLessThan(1e-9);
    expect(Math.hypot(b.vx, b.vy)).toBeGreaterThan(new Player("hunter").boltSpeed);
    expect(p.damage).toBe(1);
    expect(p.attackBox()).toBeNull();
    expect(p.ammo).toBe(GUN_AMMO - 1);
  });

  it("the cylinder holds 6 rounds, then reloads by itself in 1.2s", () => {
    const p = gunner();
    for (let i = 0; i < 5; i++) shot(p);
    p.update(DT, keys({ attack: true }));
    expect(p.bolts).toHaveLength(6);
    expect(p.ammo).toBe(0);
    expect(p.reloading).toBe(true);
    expect(p.reloadT).toBeCloseTo(RELOAD_TIME, 5);
    // qayta o'qlash paytida tepki bosilsa ham o'q chiqmaydi
    run(p, p.attackCd + 0.02);
    p.update(DT, keys({ attack: true }));
    expect(p.bolts).toHaveLength(6);
    run(p, p.reloadT - 0.06);
    expect(p.reloading).toBe(true);
    run(p, 0.12);
    expect(p.reloading).toBe(false);
    expect(p.ammo).toBe(6);
    shot(p);
    expect(p.bolts).toHaveLength(7);
  });

  it("R reloads at any time", () => {
    const p = gunner();
    shot(p);
    shot(p);
    expect(p.ammo).toBe(4);
    p.update(DT, keys({ reload: true }));
    expect(p.reloading).toBe(true);
    run(p, RELOAD_TIME + 0.02);
    expect(p.ammo).toBe(6);
    // to'la barabanda qayta o'qlanmaydi
    p.update(DT, keys({ reload: true }));
    expect(p.reloading).toBe(false);
  });

  it("holding Space empties the whole cylinder in 0.4s as a fan, then reloads; 3s cooldown", () => {
    const p = gunner();
    run(p, CHARGE_TIME + 0.04, keys({ held: true }));
    expect(p.charged).toBe(true);
    expect(p.bolts).toHaveLength(0);
    p.update(DT, keys({}));
    expect(p.spinCooldown).toBeCloseTo(FAN_CD, 1);
    run(p, FAN_TIME + 0.04);
    const fan = p.bolts;
    expect(fan).toHaveLength(6);
    expect(fan.every((b) => b.bullet && b.vx > 0)).toBe(true);
    const angles = fan.map((b) => Math.atan2(b.vy, b.vx));
    expect(Math.min(...angles)).toBeCloseTo(-FAN_SPREAD, 5);
    expect(Math.max(...angles)).toBeCloseTo(FAN_SPREAD, 5);
    expect(new Set(angles.map((a) => a.toFixed(3))).size).toBe(6);
    expect(p.ammo).toBe(0);
    expect(p.reloading).toBe(true);
  });

  it("the fan fires whatever is left in the cylinder", () => {
    const p = gunner();
    shot(p);
    shot(p);
    run(p, CHARGE_TIME + 0.04, keys({ held: true }));
    p.update(DT, keys({}));
    run(p, FAN_TIME + 0.04);
    expect(p.bolts).toHaveLength(2 + 4);
  });

  it("Shift slides forward with dash protection and adds 2 rounds at the end", () => {
    const p = gunner();
    p.x = 100;
    p.y = 120;
    for (let i = 0; i < 4; i++) shot(p);
    expect(p.ammo).toBe(2);
    slide(p);
    expect(p.dashing).toBe(true);
    expect(p.takeHit(1, p.x + 4, p.y, 100)).toBe(false);
    for (let i = 0; i < 50 && p.dashing; i++) p.update(DT, keys({}));
    expect(p.x).toBeGreaterThan(130);
    expect(p.ammo).toBe(2 + SLIDE_AMMO);
    // himoya dumi: sirpanish tugagach ham bir zum daxlsiz
    expect(p.guarded).toBe(true);
    expect(p.takeHit(1, p.x + 4, p.y, 100)).toBe(false);
    expect(p.hp).toBe(p.maxHp);
  });

  it("a slide during a reload loads 2 rounds at once — you can shoot right away", () => {
    const p = gunner();
    for (let i = 0; i < 6; i++) shot(p);
    expect(p.reloading).toBe(true);
    slide(p, 0, 1);
    for (let i = 0; i < 50 && p.dashing; i++) p.update(DT, keys({}));
    expect(p.ammo).toBe(SLIDE_AMMO);
    expect(p.reloading).toBe(false);
    shot(p);
    expect(p.ammo).toBe(SLIDE_AMMO - 1);
  });

  it("holding Shift throws a smoke bomb: hidden for 2s, 6s cooldown", () => {
    const p = gunner();
    run(p, TRAP_HOLD + 0.04, keys({ dash: true, shift: true }));
    expect(p.smokes).toHaveLength(1);
    expect(p.hidden).toBe(true);
    expect(p.hideT).toBeCloseTo(SMOKE_HIDE, 1);
    expect(p.smokeCooldown).toBeCloseTo(SMOKE_CD - 0.04, 1);
    expect(p.dashing).toBe(false);
    p.update(DT, keys({}));
    run(p, TRAP_HOLD + 0.04, keys({ dash: true, shift: true }));
    expect(p.smokes).toHaveLength(1);
    expect(p.smokeDenied).toBe(true);
    run(p, SMOKE_HIDE);
    expect(p.hidden).toBe(false);
  });
});

describe("Mergan o'yinda", () => {
  it("bullets hit enemies for 1 damage and fade after their range", () => {
    const g = makeGame();
    const p = g.player;
    p.update = () => {};
    p.x = 60;
    p.y = 120;
    const e = foe("rammer", 120, 120);
    e.aiTimer = 99;
    g.enemies = [e, foe("rammer", 290, 30)];
    const bullet = (vx: number, vy: number): Bolt => ({
      x: 70,
      y: 120,
      vx,
      vy,
      size: 4,
      left: 1,
      hit: [],
      bullet: true,
      range: GUN_RANGE,
      bounce: 0,
    });
    g.bolts = [bullet(300, 0)];
    tick(g, 0.4);
    expect(e.hp).toBe(e.maxHp - 1);
    // pastga — devorgacha 100px dan ko'p, lekin masofa tugaydi
    g.bolts = [{ ...bullet(0, 300), range: 40 }];
    tick(g, 0.1);
    expect(g.bolts).toHaveLength(1);
    tick(g, 0.1);
    expect(g.bolts).toHaveLength(0);
  });

  it("hidden in smoke: enemies aim at the spot where Mergan vanished", () => {
    const g = makeGame();
    const p = g.player;
    p.x = 100;
    p.y = 120;
    smokeBomb(g);
    expect(g.smokes).toHaveLength(1);
    expect(p.hidden).toBe(true);
    // tutun ichida chetga o'tdi — dushmanlar uni ko'rmaydi
    p.y = 120 + SMOKE_RADIUS - 6;
    const archer = foe("archer", 200, p.y);
    archer.aiTimer = 0.01;
    const rammer = foe("rammer", 220, p.y);
    rammer.aiTimer = 0.01;
    g.enemies = [archer, rammer];
    g.update(DT);
    expect(p.hidden).toBe(true);
    // ikkalasi ham tutun markaziga (yuqoriga) qaraydi, Merganga emas
    expect(g.shots).toHaveLength(1);
    expect(g.shots[0]!.vy).toBeLessThan(-5);
    expect(rammer.dashY).toBeLessThan(-0.1);
  });

  it("aimed attacks miss the hidden Mergan; once seen again they hit", () => {
    const g = makeGame();
    const p = g.player;
    p.x = 160;
    p.y = 120;
    smokeBomb(g);
    // tepish doirasida, lekin tegib turmaydi (tegish zarari tutunda ham bor)
    const golem = foe("golem", 182, 120);
    golem.stompWindup = 0.01;
    g.enemies = [golem];
    g.update(DT);
    expect(golem.stompShock).toBeGreaterThan(0);
    expect(p.hp).toBe(p.maxHp);
    // tutundan chiqdi — yana ko'rinadi
    p.y = 120 + SMOKE_RADIUS + 20;
    g.update(DT);
    expect(p.hidden).toBe(false);
    golem.x = p.x + 22;
    golem.y = p.y;
    golem.stompShock = 0;
    golem.stompWindup = 0.01;
    g.update(DT);
    expect(p.hp).toBe(p.maxHp - 1);
  });

  it("enemies inside the smoke are slowed; the smoke fades after a while", () => {
    const g = makeGame();
    const p = g.player;
    p.x = 100;
    p.y = 120;
    smokeBomb(g);
    const inside = foe("blob", 110, 130);
    const outside = foe("blob", 260, 60);
    g.enemies = [inside, outside];
    g.update(DT);
    expect(inside.slow).toBeGreaterThan(0);
    expect(outside.slow).toBe(0);
    p.x = 280;
    p.y = 200;
    tick(g, SMOKE_LIFE);
    expect(g.smokes).toHaveLength(0);
  });
});
