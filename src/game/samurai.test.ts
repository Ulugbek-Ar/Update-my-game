import { beforeEach, describe, expect, it } from "vitest";
import {
  COMBO_WIDE,
  DASH_GUARD,
  DODGE_CD,
  DODGE_SLOW,
  DODGE_WINDOW,
  IAI_CD,
  IAI_CHARGE,
  IAI_DELAY,
  IAI_GAP,
  IAI_MAX_DIST,
  IAI_MIN,
  IAI_MIN_DIST,
  IAI_TIME,
  KATANA_CD,
  KATANA_MUL,
  KATANA_REACH,
  KATANA_TIME,
  PARRY_STUN,
  PARRY_WHIFF_CD,
  PARRY_WINDOW,
  PLAYER_MAX_HP,
  Player,
  SAMURAI_MAX_HP,
  SAMURAI_SPEED,
  HUNTER_SPEED,
} from "./player";
import { ROOM } from "./animation";
import {
  COLD_BLOOD_CRIT,
  COLD_BLOOD_HP,
  Game,
  PARRY_BOSS_CAP,
  PARRY_BOSS_DMG,
  REFLECT_MUL,
} from "./game";
import { Enemy } from "./enemy";
import { Boss } from "./boss";
import { heroDps } from "./bossPower";
import { CRIT_MUL, SLOWMO_SPEED } from "./crit";
import { unlockHero } from "./save";
import { loadAchievements } from "./achievements";
import { SUPERS, SUPERS_ENABLED, SuperMeter, superFor } from "./super";
import { UPGRADES } from "./waves";
import { HERO_LIST } from "./hero";
import type { Input } from "./input";

const DT = 1 / 60;

function keys(o: Partial<{ attack: boolean; held: boolean; dash: boolean; x: number; y: number }>) {
  return {
    consumeAttack: () => !!o.attack,
    consumeDash: () => !!o.dash,
    attackHeld: () => !!o.held,
    dashHeld: () => false,
    axis: () => ({ x: o.x ?? 0, y: o.y ?? 0 }),
  } as unknown as Input;
}

function run(p: Player, seconds: number, input = keys({})) {
  for (let t = 0; t < seconds - 1e-9; t += DT) p.update(DT, input);
}

function samurai(x = 100, y = 120) {
  const p = new Player("samurai");
  p.x = x;
  p.y = y;
  p.fx = 1;
  p.fy = 0;
  return p;
}

/** Hujumni `hold` soniya bosib turib qo'yib yuboradi (IAI); sirpanish tugaguncha yuritadi. */
function iai(p: Player, hold: number, axis: { x?: number; y?: number } = {}) {
  run(p, hold, keys({ held: true, ...axis }));
  p.update(DT, keys({ ...axis }));
  const from = { x: p.x, y: p.y };
  for (let i = 0; i < 60 && p.dashing; i++) p.update(DT, keys({}));
  return { dist: Math.hypot(p.x - from.x, p.y - from.y), from };
}

type GI = {
  startWave(i: number): void;
  damageTarget(t: unknown, d: number): void;
  strike(t: unknown, d: number): void;
};

function makeGame() {
  unlockHero("samurai");
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement, "samurai");
  g.hints = [];
  // to'lqin tugab qolmasligi uchun: uzoqda, hali paydo bo'lmagan dushman
  const keeper = new Enemy("blob", 290, 30);
  keeper.spawn = 99;
  g.enemies = [keeper];
  g.banner.timer = 0;
  const p = g.player;
  p.x = 100;
  p.y = 120;
  p.fx = 1;
  p.fy = 0;
  return { g, gi: g as unknown as GI, p };
}

/** Qimirlamaydigan, paydo bo'lib bo'lgan dushman */
function dummy(g: Game, kind: ConstructorParameters<typeof Enemy>[0], x: number, y: number) {
  const e = new Enemy(kind, x, y);
  e.spawn = 0;
  e.hp = e.maxHp = 40;
  e.update = () => {};
  g.enemies.push(e);
  return e;
}

function tick(g: Game, seconds: number, dt = DT) {
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    g.update(dt);
    g.input.endFrame();
  }
}

beforeEach(() => localStorage.clear());

describe("Samuray: ko'rsatkichlar", () => {
  it("has fewer hearts than the knight, is among the fastest and strikes fast but lighter", () => {
    const p = new Player("samurai");
    expect(p.samurai).toBe(true);
    expect(p.maxHp).toBe(SAMURAI_MAX_HP);
    expect(SAMURAI_MAX_HP).toBeLessThan(PLAYER_MAX_HP);
    // Ovchidan keyingi eng tez qahramon
    const speeds = HERO_LIST.map((h) => new Player(h.id).speed).sort((a, b) => b - a);
    expect(speeds[0]).toBe(HUNTER_SPEED);
    expect(speeds[1]).toBe(SAMURAI_SPEED);
    const k = new Player("knight");
    expect(p.attackCd).toBe(KATANA_CD);
    expect(p.attackCd).toBeLessThan(k.attackCd);
    expect(p.reach).toBe(KATANA_REACH);
    expect(p.reach).toBeLessThan(k.reach);
    // har zarba Ritsarnikidan biroz kam
    expect(p.hitDamage).toBe(KATANA_MUL);
    expect(p.hitDamage).toBeLessThan(k.hitDamage);
    expect(p.hitDamage).toBeGreaterThan(k.hitDamage * 0.6);
    // yaqin jangchi: shar/o'q otmaydi
    expect(p.ranged).toBe(false);
    p.update(DT, keys({ attack: true }));
    expect(p.bolts).toHaveLength(0);
    expect(p.attackTimer).toBeCloseTo(KATANA_TIME, 5);
  });

  it("balance: average DPS sits between the Paladin and the Knight", () => {
    const [knight, paladin, sam] = (["knight", "paladin", "samurai"] as const).map((h) =>
      heroDps(new Player(h)),
    );
    expect(sam).toBeGreaterThan(paladin!);
    expect(sam).toBeLessThan(knight!);
    expect(sam).toBeCloseTo(KATANA_MUL / KATANA_CD, 5);
  });

  it("skill (perfect dodge crits and parried shots) pushes her above both", () => {
    const knight = heroDps(new Player("knight"));
    const base = KATANA_MUL / KATANA_CD;
    // har DODGE_CD da bitta kafolatlangan kritik zarba: +1 zarba qiymati
    const withDodge = base + (KATANA_MUL * (CRIT_MUL - 1)) / DODGE_CD;
    expect(withDodge).toBeGreaterThan(knight);
    // qaytarilgan snaryad oddiy dushmanga 2 baravar zarar beradi
    expect(REFLECT_MUL).toBeGreaterThan(1);
  });
});

describe("Samuray: katana kombosi", () => {
  it("three quick slashes make a combo; the third has a wider arc", () => {
    const p = samurai();
    const boxes: number[] = [];
    for (let i = 0; i < 3; i++) {
      p.update(DT, keys({ attack: true }));
      expect(p.comboStep).toBe(i);
      boxes.push(p.attackBox()!.size);
      run(p, KATANA_CD);
    }
    expect(boxes[0]).toBe(KATANA_REACH);
    expect(boxes[1]).toBe(KATANA_REACH);
    expect(boxes[2]).toBeCloseTo(KATANA_REACH * COMBO_WIDE, 5);
    // 4-zarba — yana birinchisi
    p.update(DT, keys({ attack: true }));
    expect(p.comboStep).toBe(0);
  });

  it("the combo resets after a pause", () => {
    const p = samurai();
    p.update(DT, keys({ attack: true }));
    run(p, KATANA_CD);
    p.update(DT, keys({ attack: true }));
    expect(p.comboStep).toBe(1);
    run(p, 1);
    p.update(DT, keys({ attack: true }));
    expect(p.comboStep).toBe(0);
  });

  it("each slash deals 0.75 and the damage number shows it exactly", () => {
    const { g, p } = makeGame();
    const e = dummy(g, "rammer", 114, 120);
    g.input.pressAttack();
    tick(g, 0.1);
    expect(e.hp).toBe(40 - KATANA_MUL * p.damage);
    expect(g.fx.damages[0]!.n).toBe(0.75);
  });
});

describe("Samuray: IAI", () => {
  it("needs a minimum hold; a short hold is just a slash", () => {
    const p = samurai();
    run(p, IAI_MIN - 0.1, keys({ held: true }));
    p.update(DT, keys({}));
    expect(p.iai).toBeNull();
    expect(p.dashing).toBe(false);
    expect(p.spinCooldown).toBeLessThanOrEqual(0);
  });

  it("charge grows the distance and damage, up to a cap", () => {
    const short = iai(samurai(60), IAI_MIN + 0.02);
    const full = iai(samurai(60), IAI_CHARGE + 0.02);
    const over = iai(samurai(60), IAI_CHARGE + 1.5);
    expect(short.dist).toBeGreaterThanOrEqual(IAI_MIN_DIST - 0.5);
    expect(short.dist).toBeLessThan(IAI_MIN_DIST + 6);
    expect(full.dist).toBeCloseTo(IAI_MAX_DIST, 0);
    // chegara: bundan ortiq bosib turish masofani oshirmaydi
    expect(over.dist).toBeCloseTo(IAI_MAX_DIST, 0);
    expect(full.dist).toBeGreaterThan(short.dist * 1.8);

    const a = samurai(60);
    run(a, IAI_MIN + 0.02, keys({ held: true }));
    a.update(DT, keys({}));
    const b = samurai(60);
    run(b, IAI_CHARGE + 1, keys({ held: true }));
    b.update(DT, keys({}));
    expect(a.iai!.mul).toBeGreaterThanOrEqual(1);
    expect(a.iai!.mul).toBeLessThan(1.1);
    expect(b.iai!.mul).toBe(b.strongMul);
    expect(b.iai!.mul).toBe(2);
  });

  it("goes along the move direction (or the facing) and starts the cooldown", () => {
    // yuqoridan boshlaydi: zaryad paytida sekin pastga yuradi, so'ng pastga sirpanadi
    const p = samurai(100, 30);
    const r = iai(p, IAI_CHARGE, { x: 0, y: 1 });
    expect(p.x).toBeCloseTo(100, 5);
    expect(p.y).toBeGreaterThan(30 + IAI_MIN_DIST);
    expect(r.dist).toBeCloseTo(IAI_MAX_DIST, 0);
    expect(p.fy).toBe(1);
    expect(p.spinCooldown).toBeGreaterThan(IAI_CD - IAI_TIME - 0.5);
    // sovish paytida zaryad yig'ilmaydi
    run(p, 0.5, keys({ held: true }));
    expect(p.charge).toBe(0);
  });

  it("never passes through the room walls", () => {
    const p = samurai(ROOM.w - ROOM.wall - 30, 120);
    iai(p, IAI_CHARGE + 0.1);
    expect(p.x).toBeLessThanOrEqual(ROOM.w - ROOM.wall - p.size / 2);
    const up = samurai(100, ROOM.wall + 20);
    iai(up, IAI_CHARGE + 0.1, { x: 0, y: -1 });
    expect(up.y).toBeGreaterThanOrEqual(ROOM.wall + up.size / 2);
  });

  it("is invulnerable while sliding and keeps the dash guard tail (the old dash bug stays fixed)", () => {
    const p = samurai(60);
    run(p, IAI_CHARGE, keys({ held: true }));
    p.update(DT, keys({}));
    expect(p.iai).not.toBeNull();
    expect(p.dashing).toBe(true);
    expect(p.takeHit(1, p.x + 4, p.y, 100)).toBe(false);
    for (let i = 0; i < 60 && p.dashing; i++) p.update(DT, keys({}));
    // sirpanish tugagan kadrda ham daxlsiz (himoya dumi)
    expect(p.dashing).toBe(false);
    expect(p.guarded).toBe(true);
    expect(p.takeHit(1, p.x + 4, p.y, 100)).toBe(false);
    run(p, DASH_GUARD - 0.05);
    expect(p.takeHit(1, p.x + 4, p.y, 100)).toBe(false);
    run(p, 0.1);
    expect(p.guarded).toBe(false);
    expect(p.takeHit(1, p.x + 4, p.y, 100)).toBe(true);
    expect(p.hp).toBe(p.maxHp - 1);
    // IAI — hujum: mukammal chetlanish hisoblanmaydi
    expect(p.perfect).toBe(false);
  });

  it("marks everyone on the path, freezes them, then cuts them one by one after 0.25 s", () => {
    const { g, p } = makeGame();
    const a = dummy(g, "blob", 125, 120);
    const b = dummy(g, "rammer", 150, 123);
    const c = dummy(g, "wisp", 175, 117);
    const far = dummy(g, "blob", 150, 180);
    g.input.setTouchAttack(true);
    tick(g, IAI_CHARGE + 0.05);
    g.input.setTouchAttack(false);
    g.update(DT);
    expect(p.iai).not.toBeNull();
    while (p.dashing) g.update(DT);
    const end = g.time;
    // sirpanib o'tdi: uchalasi belgilangan, hali zarar yo'q, chetdagisi tegilmagan
    expect(p.x).toBeGreaterThan(180);
    expect(g.iaiMarks).toEqual([a, b, c]);
    expect([a.hp, b.hp, c.hp, far.hp]).toEqual([40, 40, 40, 40]);
    expect(a.stun).toBeGreaterThan(0);
    // belgilangan dushman tegib zarar bermaydi (himoya dumisiz ham)
    p.guardAge = -1;
    p.x = c.x;
    p.y = c.y;
    tick(g, 0.2);
    expect(p.evading).toBe(false);
    expect(p.hp).toBe(p.maxHp);
    expect(a.hp).toBe(40);
    // 0.25 s dan keyin ketma-ket ("chiq-chiq"): avval birinchisi, so'ng qolganlari
    while (a.hp === 40 && g.time - end < 1) g.update(DT);
    expect(g.time - end).toBeGreaterThanOrEqual(IAI_DELAY - 0.02);
    expect(g.time - end).toBeLessThan(IAI_DELAY + 0.06);
    expect(a.hp).toBe(40 - 2 * p.damage);
    expect(c.hp).toBe(40);
    while (c.hp === 40 && g.time - end < 1) g.update(DT);
    expect(g.time - end).toBeGreaterThanOrEqual(IAI_DELAY + IAI_GAP * 2 - 0.03);
    expect([a.hp, b.hp, c.hp, far.hp]).toEqual([38, 38, 38, 40]);
    expect(g.cuts.length).toBeGreaterThan(0);
    tick(g, 0.2);
    expect(g.iaiMarks).toHaveLength(0);
    expect(loadAchievements().has("firstIai")).toBe(true);
  });

  it("cuts enemy shots on the path and hits the boss too", () => {
    const { g, gi, p } = makeGame();
    gi.startWave(4);
    g.enemies = [];
    g.intro = 0;
    const boss = g.boss!;
    boss.spawn = 0;
    boss.update = () => {};
    boss.x = 150;
    boss.y = 120;
    p.x = 100;
    p.y = 120;
    p.fx = 1;
    p.fy = 0;
    g.shots = [{ x: 125, y: 121, vx: 0, vy: 0, size: 6 }];
    const hp = boss.hp;
    g.input.setTouchAttack(true);
    tick(g, IAI_CHARGE + 0.05);
    g.input.setTouchAttack(false);
    tick(g, IAI_TIME + IAI_DELAY + 0.2);
    expect(g.shots).toHaveLength(0);
    expect(boss.hp).toBe(hp - 2 * p.damage);
  });
});

describe("Samuray: mukammal chetlanish", () => {
  const dash = (p: Player) => p.update(DT, keys({ dash: true }));

  it("a hit that would land right after the dash starts is a perfect dodge", () => {
    const p = samurai();
    dash(p);
    expect(p.dashing).toBe(true);
    run(p, 0.05);
    expect(p.takeHit(1, p.x + 4, p.y, 100)).toBe(false);
    expect(p.perfect).toBe(true);
    expect(p.hp).toBe(p.maxHp);
  });

  it("a late dodge (after the window) is just a dodge", () => {
    const p = samurai();
    dash(p);
    run(p, DODGE_WINDOW + 0.04);
    // hali himoya dumida — zarar yo'q, lekin "mukammal" emas
    expect(p.evading).toBe(true);
    expect(p.takeHit(1, p.x + 4, p.y, 100)).toBe(false);
    expect(p.perfect).toBe(false);
  });

  it("cannot be spammed: 1.5 s cooldown", () => {
    const p = samurai();
    dash(p);
    p.takeHit(1, p.x + 4, p.y, 100);
    expect(p.perfect).toBe(true);
    p.perfect = false;
    run(p, 0.9);
    dash(p);
    expect(p.dashing).toBe(true);
    p.takeHit(1, p.x + 4, p.y, 100);
    expect(p.perfect).toBe(false);
    run(p, DODGE_CD);
    dash(p);
    p.takeHit(1, p.x + 4, p.y, 100);
    expect(p.perfect).toBe(true);
  });

  it("other heroes never get it", () => {
    const p = new Player("knight");
    p.update(DT, keys({ dash: true }));
    p.takeHit(1, p.x + 4, p.y, 100);
    expect(p.perfect).toBe(false);
  });

  it("slows time for 0.6 s (the samurai herself keeps full speed) and makes the next hit a crit", () => {
    const { g, p } = makeGame();
    const foe = dummy(g, "rammer", 114, 120);
    // dushmanning o'qi tegish arafasida: dash bilan chetlanadi
    g.input.pressDash();
    g.update(DT);
    g.shots = [{ x: p.x, y: p.y, vx: 0, vy: 0, size: 6, arrow: true }];
    g.update(DT);
    expect(g.focus).toBeGreaterThan(0);
    expect(g.slowmo).toBeCloseTo(DODGE_SLOW, 1);
    expect(p.critReady).toBe(true);
    expect(g.fx.texts.some((t) => t.s === "CHETLANDI!")).toBe(true);
    // dunyo sekin: 0.1 s da o'yin vaqti 0.03 s yuradi; Samurayning sovishi to'liq tezlikda
    const t0 = g.time;
    const cd0 = p.dashCooldown;
    tick(g, 0.1);
    expect(g.time - t0).toBeCloseTo(0.1 * SLOWMO_SPEED, 2);
    expect(cd0 - p.dashCooldown).toBeCloseTo(0.1, 2);
    // sekin vaqt tugaydi
    tick(g, DODGE_SLOW);
    expect(g.focus).toBeLessThanOrEqual(0);
    expect(g.slowmo).toBeLessThanOrEqual(0);
    // keyingi zarba — kafolatlangan kritik (sinovlarda tasodifiy krit o'chiq)
    p.x = 100;
    p.y = 120;
    p.fx = 1;
    p.fy = 0;
    // katana yetadi, lekin tanalar tegmaydi
    foe.x = 114;
    foe.y = 120;
    g.input.pressAttack();
    tick(g, 0.1);
    expect(foe.hp).toBe(40 - KATANA_MUL * CRIT_MUL);
    expect(p.critReady).toBe(false);
    // undan keyingisi — oddiy
    tick(g, KATANA_CD);
    g.input.pressAttack();
    tick(g, 0.1);
    expect(foe.hp).toBe(40 - KATANA_MUL * CRIT_MUL - KATANA_MUL);
  });

  it("ten perfect dodges in one run unlock the achievement", () => {
    const { g, p } = makeGame();
    for (let i = 0; i < 10; i++) {
      p.perfect = true;
      g.update(DT);
      g.slowmo = 0;
    }
    expect(g.perfectDodges).toBe(10);
    expect(loadAchievements().has("dodge10")).toBe(true);
  });
});

describe("Samuray: parry", () => {
  it("a hit during the first 0.12 s of a slash is cancelled; the attacker is stunned", () => {
    const { g, p } = makeGame();
    const foe = dummy(g, "rammer", 111, 120);
    g.input.pressAttack();
    g.update(DT);
    expect(p.parrying).toBe(true);
    // dushman zarbasi aynan shu payt tegadi
    expect(p.takeHit(1, foe.x, foe.y, 180)).toBe(false);
    g.update(DT);
    expect(p.hp).toBe(p.maxHp);
    expect(foe.stun).toBeGreaterThan(PARRY_STUN - 0.1);
    expect(g.fx.texts.some((t) => t.s === "SHIK!")).toBe(true);
  });

  it("outside the window the hit lands", () => {
    const p = samurai();
    p.update(DT, keys({ attack: true }));
    run(p, PARRY_WINDOW + 0.03);
    expect(p.parrying).toBe(false);
    expect(p.takeHit(1, p.x + 5, p.y, 100)).toBe(true);
    expect(p.hp).toBe(p.maxHp - 1);
  });

  it("a whiffed parry delays the next one — mashing attack does not parry everything", () => {
    const p = samurai();
    p.update(DT, keys({ attack: true }));
    expect(p.parrying).toBe(true);
    run(p, KATANA_CD);
    // darhol keyingi zarba: parry oynasi ochilmaydi
    p.update(DT, keys({ attack: true }));
    expect(p.attackTimer).toBeGreaterThan(0);
    expect(p.parrying).toBe(false);
    run(p, PARRY_WHIFF_CD + 0.1);
    p.update(DT, keys({ attack: true }));
    expect(p.parrying).toBe(true);
    // muvaffaqiyatli parry dan keyin kechikish yo'q
    p.takeHit(1, p.x + 5, p.y, 100);
    run(p, KATANA_CD);
    p.invuln = 0;
    p.update(DT, keys({ attack: true }));
    expect(p.parrying).toBe(true);
  });

  it("a parried projectile flies back to its owner and hurts it", () => {
    const { g, p } = makeGame();
    const archer = dummy(g, "archer", 220, 120);
    g.shots = [{ x: p.x + 8, y: p.y, vx: -110, vy: 0, size: 4, arrow: true, owner: archer }];
    g.input.pressAttack();
    g.update(DT);
    expect(g.shots).toHaveLength(0);
    const back = g.bolts.find((b) => b.reflect);
    expect(back?.reflect).toBe("arrow");
    // egasiga qarab, tezroq
    expect(back!.vx).toBeGreaterThan(110);
    expect(p.hp).toBe(p.maxHp);
    tick(g, 1);
    expect(archer.hp).toBe(40 - REFLECT_MUL * p.damage);
    expect(g.bolts.some((b) => b.reflect)).toBe(false);
  });

  it("without a parry window the katana just cuts the projectile (like the knight)", () => {
    const { g, p } = makeGame();
    g.input.pressAttack();
    tick(g, PARRY_WINDOW + 0.03);
    expect(p.attackTimer).toBeGreaterThan(0);
    g.shots = [{ x: p.x + 8, y: p.y, vx: -110, vy: 0, size: 4, arrow: true }];
    g.update(DT);
    expect(g.shots).toHaveLength(0);
    expect(g.bolts.some((b) => b.reflect)).toBe(false);
  });

  it("works on the boss, but the returned damage is capped", () => {
    const { g, gi, p } = makeGame();
    gi.startWave(4);
    g.enemies = [];
    g.intro = 0;
    const boss = g.boss!;
    boss.spawn = 0;
    boss.update = () => {};
    boss.x = 160;
    boss.y = 120;
    p.x = 100;
    p.y = 120;
    p.fx = 1;
    p.fy = 0;
    p.damage = 3;
    const hp = boss.hp;
    // o'nta olov shari bir vaqtda qaytariladi
    g.shots = Array.from({ length: 10 }, (_, i) => ({
      x: p.x + 8,
      y: p.y - 4 + (i % 3) * 3,
      vx: -75,
      vy: 0,
      size: 6,
      dmg: 1,
      owner: boss,
    }));
    g.input.pressAttack();
    g.update(DT);
    expect(g.bolts.filter((b) => b.reflect)).toHaveLength(10);
    tick(g, 0.6);
    // har snaryad 1, soniyasiga jami 3 dan oshmaydi (zarar kuchaytirishlari ham ta'sir qilmaydi)
    expect(hp - boss.hp).toBe(PARRY_BOSS_CAP);
    expect(PARRY_BOSS_DMG).toBe(1);
    expect(loadAchievements().has("parryBoss")).toBe(true);
  });

  it("parrying the boss's own strike unlocks the achievement and slows it", () => {
    const { g, gi, p } = makeGame();
    gi.startWave(4);
    g.enemies = [];
    g.intro = 0;
    const boss = g.boss!;
    boss.spawn = 0;
    boss.update = () => {};
    g.input.pressAttack();
    g.update(DT);
    expect(p.takeHit(2, boss.x, boss.y, 260)).toBe(false);
    g.update(DT);
    expect(p.hp).toBe(p.maxHp);
    expect(boss.slow).toBeGreaterThan(0);
    expect(boss instanceof Boss).toBe(true);
    expect(loadAchievements().has("parryBoss")).toBe(true);
  });
});

describe("Samuray: SOVUQ QON va kritik", () => {
  it("low health raises the crit chance", () => {
    const { g, gi, p } = makeGame();
    const foe = dummy(g, "rammer", 200, 120);
    p.coldBlood = true;
    // tasodif 0.2: oddiy ehtimoldan (0.08) yuqori, SOVUQ QON bilan (0.33) past
    g.critRand = () => 0.2;
    gi.strike(foe, 1);
    expect(foe.hp).toBe(39);
    p.hp = COLD_BLOOD_HP;
    gi.strike(foe, 1);
    expect(foe.hp).toBe(39 - CRIT_MUL);
    expect(COLD_BLOOD_CRIT).toBeGreaterThan(0.1);
  });
});

describe("Super MING KESIM: tayyor, lekin yopiq", () => {
  it("the data exists for v4.0 but the super is locked everywhere", () => {
    expect(SUPERS_ENABLED).toBe(false);
    expect(SUPERS.samurai?.name).toBe("MING KESIM");
    expect(superFor("samurai")).toBeNull();
    for (const h of HERO_LIST) expect(superFor(h.id)).toBeNull();
    // kartalarda va qahramon tavsifida yo'q
    const text = JSON.stringify(UPGRADES) + JSON.stringify(HERO_LIST);
    expect(text).not.toMatch(/MING KESIM|super/i);
  });

  it("the meter never charges and cannot be used while locked", () => {
    const m = new SuperMeter("samurai");
    m.add(9999);
    expect(m.value).toBe(0);
    expect(m.ratio).toBe(0);
    expect(m.ready).toBe(false);
    expect(m.use()).toBe(false);
    const { g, gi } = makeGame();
    const foe = dummy(g, "rammer", 200, 120);
    gi.damageTarget(foe, 30);
    expect(g.superMeter.value).toBe(0);
    expect(g.useSuper()).toBe(false);
  });
});
