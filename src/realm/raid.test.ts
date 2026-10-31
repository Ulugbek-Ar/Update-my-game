import { describe, expect, it } from "vitest";
import { TRAP_HOLD } from "@/game/player";
import type { Hero } from "@/game/hero";
import { loadRealmData } from "./data";
import { RealmSim, TICK_DT, type RealmEvent, type RealmPlayer } from "./sim";
import type { RealmMob } from "./mobs";
import {
  KING_ENRAGE,
  KING_HP,
  KING_INTRO,
  KING_RESPAWN,
  KING_TITLE,
  LAVA_WARN,
  STORM_OUT,
  STORM_SOLO,
  STORM_SOLO_OUT,
  STORM_TOTAL,
  STORM_WARN,
  kingHp,
  stormShare,
} from "./raid";
import { RealmMirror } from "./net/mirror";
import { RealmRoom } from "./net/room";

const data = loadRealmData();

/** Faqat Kul qiroli qolgan olam va zal ichidagi o'yinchilar (zarar olmaydi, agar hurt: true bo'lmasa) */
function arena(heroes: Hero[], opts: { hurt?: boolean } = {}) {
  const s = new RealmSim(data);
  s.mobs = s.mobs.filter((m) => m.kind === "ashking");
  const raid = s.raid!;
  const boss = raid.boss(s)!;
  const ps = heroes.map((h, i) => {
    const rp = s.addPlayer(`p${i}`, h);
    rp.p.x = rp.px = boss.x - 45 + i * 30;
    rp.p.y = rp.py = boss.y + 70;
    if (!opts.hurt) rp.p.takeHit = () => false;
    return rp;
  });
  return { s, raid, boss, ps };
}

/** Shuncha soniya tick qiladi va shu orada chiqqan barcha voqealarni qaytaradi */
const steps = (s: RealmSim, seconds: number) => {
  const ev: RealmEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += TICK_DT) {
    s.step();
    ev.push(...s.events);
  }
  return ev;
};

const hit = (s: RealmSim, rp: RealmPlayer, m: RealmMob, d: number) =>
  (s as unknown as { hit(rp: RealmPlayer, m: RealmMob, d: number, k: number): boolean }).hit(
    rp,
    m,
    d,
    0,
  );

describe("Kul qiroli: zal va jang boshlanishi", () => {
  it("sleeps on its throne in the inner hall and wakes with an intro when players enter", () => {
    const s = new RealmSim(data);
    const raid = s.raid!;
    const boss = raid.boss(s)!;
    expect(boss.kind).toBe("ashking");
    expect(s.areaAt(boss.x, boss.y)?.id).toBe("ashmount");
    expect(raid.inArena(boss.x, boss.y)).toBe(true);
    expect(boss.state).toBe("dormant");
    // zalda hech kim yo'q — jang boshlanmaydi
    s.addPlayer("far", "knight");
    steps(s, 1);
    expect(raid.active).toBe(false);
    const { s: s2, raid: r2, boss: b2 } = arena(["paladin"]);
    s2.step();
    expect(r2.active).toBe(true);
    expect(s2.events.some((e) => e.type === "raid" && e.what === "start")).toBe(true);
    expect(b2.state).toBe("wake");
    steps(s2, KING_INTRO + 0.1);
    expect(b2.state).not.toBe("wake");
  });

  it("its sprite is bigger than 64x64 (96x96)", async () => {
    const { spriteGrid, spriteSize, spritePixels } = await import("@/game/sprites");
    expect(spriteGrid("ashking")).toBe(96);
    expect(spriteSize("ashking")).toBeGreaterThan(64);
    for (const [st, n] of [
      ["idle", 2],
      ["walk", 4],
      ["attack", 4],
      ["hurt", 1],
      ["death", 3],
    ] as const) {
      const frames = Array.from({ length: n }, (_, f) => spritePixels("ashking", st, f).join(","));
      expect(new Set(frames).size, st).toBe(n);
      expect(Math.max(...spritePixels("ashking", st, 0))).toBeLessThanOrEqual(5);
    }
  });
});

describe("Jon o'yinchilar soniga moslashadi", () => {
  it("1 player: base HP; every extra player +80%", () => {
    expect(kingHp(1)).toBe(KING_HP);
    expect(kingHp(2)).toBe(Math.round(KING_HP * 1.8));
    expect(kingHp(4)).toBe(Math.round(KING_HP * 3.4));
    for (const n of [1, 2, 3, 4]) {
      const { s, boss } = arena(Array<Hero>(n).fill("knight"));
      s.step();
      expect(boss.maxHp, `${n}`).toBe(kingHp(n));
    }
  });

  it("a late joiner raises the max HP but keeps the HP share", () => {
    const { s, boss, raid } = arena(["paladin", "hunter"]);
    s.step();
    boss.hp = boss.maxHp / 2;
    const late = s.addPlayer("late", "mage");
    late.p.takeHit = () => false;
    late.p.x = boss.x + 40;
    late.p.y = boss.y + 60;
    s.step();
    expect(raid.party).toBe(3);
    expect(boss.maxHp).toBe(kingHp(3));
    expect(boss.hp / boss.maxHp).toBeCloseTo(0.5, 2);
  });
});

describe("Xavf (threat): tank ushlab turadi", () => {
  it("chases the most dangerous player until the Paladin's QASAM pulls it to the tank", () => {
    const { s, boss, ps } = arena(["hunter", "paladin"]);
    const [dps, tank] = ps as [RealmPlayer, RealmPlayer];
    steps(s, KING_INTRO + 0.2);
    boss.state = "chase";
    boss.t = 0;
    boss.cd = 99;
    hit(s, dps, boss, 20);
    boss.cd = 99;
    s.step();
    expect(boss.target).toBe(dps.id);
    tank.p.x = boss.x + 30;
    tank.p.y = boss.y + 10;
    s.command(tank, { type: "ability", down: true });
    for (let t = 0; t < TRAP_HOLD + 0.1; t += TICK_DT) {
      boss.cd = 99;
      s.step();
    }
    expect(tank.p.vowing).toBe(true);
    expect(boss.target).toBe(tank.id);
    for (let i = 0; i < 30; i++) {
      boss.cd = 99;
      if (i % 6 === 0) hit(s, dps, boss, 3);
      s.step();
      expect(boss.target).toBe(tank.id);
    }
  });
});

describe("Fazalar", () => {
  it("phase 2 at 60%: half the hall floods with lava after a warning, 2 ash spirits come", () => {
    const { s, boss, raid, ps } = arena(["knight", "hunter"], { hurt: false });
    steps(s, KING_INTRO + 0.2);
    boss.hp = Math.floor(boss.maxHp * 0.55);
    s.step();
    expect(boss.phase).toBe(2);
    expect(s.events.some((e) => e.type === "raid" && e.what === "phase" && e.phase === 2)).toBe(
      true,
    );
    // ruhlar
    steps(s, 0.2);
    expect(s.mobs.filter((m) => m.kind === "ashspirit" && !m.dead)).toHaveLength(2);
    // lava: avval ogohlantirish (kuydirmaydi), keyin to'ladi
    steps(s, 1.6);
    expect(raid.lava).toBeGreaterThanOrEqual(0);
    expect(raid.lavaWarn).toBe(true);
    const mid = (raid.x0 + raid.x1) / 2;
    const side = raid.lava === 0 ? raid.x0 + 20 : raid.x1 - 20;
    expect(raid.lavaAt(side, (raid.y0 + raid.y1) / 2)).toBe(false);
    steps(s, LAVA_WARN + 0.1);
    expect(raid.lavaWarn).toBe(false);
    expect(raid.lavaAt(side, (raid.y0 + raid.y1) / 2)).toBe(true);
    // boshqa yarmi xavfsiz
    const safe = raid.lava === 0 ? mid + 20 : mid - 20;
    expect(raid.lavaAt(safe, (raid.y0 + raid.y1) / 2)).toBe(false);
    // lavaga tushgan o'yinchi kuyadi
    const rp = ps[0]!;
    rp.p.takeHit = Object.getPrototypeOf(rp.p).takeHit.bind(rp.p);
    rp.p.x = side;
    rp.p.y = (raid.y0 + raid.y1) / 2;
    const hp = rp.p.hp;
    s.step();
    expect(rp.p.hp).toBeLessThan(hp);
  });

  it("phase 3 at 30%: KUL BO'RONI — a gathering circle with a warning", () => {
    const { s, boss } = arena(["knight", "mage"]);
    steps(s, KING_INTRO + 0.2);
    boss.hp = Math.floor(boss.maxHp * 0.25);
    s.step();
    expect(boss.phase).toBe(3);
    steps(s, 2.2);
    const k = s.marks.find((m) => m.kind === "stack");
    expect(k).toBeDefined();
    expect(k!.total).toBe(STORM_WARN);
  });

  it("every blow is warned: slam circle or fire cone appears before it lands", () => {
    const { s, boss } = arena(["paladin"]);
    steps(s, KING_INTRO + 0.2);
    const seen = new Set<string>();
    for (let i = 0; i < 400 && seen.size < 2; i++) {
      s.step();
      if (boss.state === "windup") {
        const k = s.marks.find(
          (m) => m.owner === boss.id && (m.kind === "circle" || m.kind === "cone"),
        );
        expect(k, `${boss.move}`).toBeDefined();
        seen.add(k!.kind);
      }
    }
    expect([...seen].sort()).toEqual(["circle", "cone"]);
  });
});

describe("Kul bo'roni: zararni bo'lishish", () => {
  it("shares the damage: 4 players stacked take little, someone outside takes a lot", () => {
    expect(stormShare(4, 4)).toEqual([Math.ceil(STORM_TOTAL / 4), STORM_OUT]);
    expect(stormShare(4, 2)).toEqual([Math.ceil(STORM_TOTAL / 2), STORM_OUT]);
    expect(stormShare(4, 4)[0]).toBeLessThan(STORM_OUT);
    // 1 o'yinchi — kamroq zarar
    expect(stormShare(1, 1)).toEqual([STORM_SOLO, STORM_SOLO_OUT]);
    expect(STORM_SOLO).toBeLessThan(Math.ceil(STORM_TOTAL / 2));
  });

  it("in a real fight with 4 players: stacked lose 2 each, the one outside loses 5", () => {
    const { s, boss, raid, ps } = arena(["knight", "hunter", "mage", "gunner"], { hurt: true });
    for (const rp of ps) rp.lastHurt = 1e9;
    s.step();
    boss.hp = Math.floor(boss.maxHp * 0.25);
    boss.phase = 3;
    // bo'ron belgisini qo'lda qo'yamiz (zal markazi), boss urmaydi
    const cx = (raid.x0 + raid.x1) / 2,
      cy = raid.y1 - 60;
    s.marks.push({
      kind: "stack",
      x: cx,
      y: cy,
      r: 40,
      dx: 0,
      dy: 0,
      len: 0,
      t: 0.05,
      total: 0.05,
      owner: boss.id,
    });
    ps.forEach((rp, i) => {
      rp.p.x = i < 3 ? cx + (i - 1) * 10 : cx + 120;
      rp.p.y = cy;
      rp.p.invuln = 0;
    });
    const before = ps.map((rp) => rp.p.hp);
    boss.state = "recover";
    boss.t = 99;
    steps(s, 0.1);
    const lost = ps.map((rp, i) => before[i]! - rp.p.hp);
    expect(lost.slice(0, 3)).toEqual([2, 2, 2]);
    expect(lost[3]).toBe(STORM_OUT);
  });

  it("alone in the fight the storm hurts less", () => {
    const { s, boss, raid, ps } = arena(["knight"], { hurt: true });
    const rp = ps[0]!;
    rp.lastHurt = 1e9;
    s.step();
    boss.state = "recover";
    boss.t = 99;
    s.marks.push({
      kind: "stack",
      x: rp.p.x,
      y: rp.p.y,
      r: 40,
      dx: 0,
      dy: 0,
      len: 0,
      t: 0.05,
      total: 0.05,
      owner: boss.id,
    });
    rp.p.invuln = 0;
    const hp = rp.p.hp;
    steps(s, 0.1);
    expect(hp - rp.p.hp).toBe(STORM_SOLO);
    void raid;
  });
});

describe("G'azab taymeri, o'lim va qayta tug'ilish", () => {
  it("after 6 minutes the King enrages", () => {
    const { s, raid } = arena(["paladin"]);
    s.step();
    raid.elapsed = KING_ENRAGE - 0.05;
    const ev = steps(s, 0.1);
    expect(raid.enraged).toBe(true);
    expect(ev.some((e) => e.type === "raid" && e.what === "enrage")).toBe(true);
    expect(KING_ENRAGE).toBe(360);
  });

  it("a fallen player respawns at the hall entrance after 10 s while the fight goes on", () => {
    const { s, raid, ps } = arena(["paladin", "hunter"], { hurt: true });
    s.step();
    const [a, b] = ps as [RealmPlayer, RealmPlayer];
    b.p.takeHit = () => false;
    a.p.hp = 1;
    a.p.invuln = 0;
    a.p.takeHit(1, a.p.x, a.p.y, 0);
    expect(a.p.dead).toBe(true);
    steps(s, KING_RESPAWN - 1);
    expect(a.p.dead).toBe(true);
    expect(raid.active).toBe(true);
    steps(s, 1.2);
    expect(a.p.dead).toBe(false);
    expect(Math.hypot(a.p.x - raid.entry.x, a.p.y - raid.entry.y)).toBeLessThan(2);
    expect(raid.active).toBe(true);
  });

  it("when everyone falls the King fully resets", () => {
    const { s, raid, boss, ps } = arena(["knight", "mage"], { hurt: true });
    s.step();
    boss.hp = Math.floor(boss.maxHp * 0.4);
    for (const rp of ps) {
      rp.p.hp = 1;
      rp.p.invuln = 0;
      rp.p.takeHit(1, rp.p.x, rp.p.y, 0);
    }
    const ev = steps(s, 0.1);
    expect(raid.active).toBe(false);
    expect(boss.hp).toBe(KING_HP);
    expect(boss.maxHp).toBe(KING_HP);
    expect(boss.phase).toBe(1);
    expect(ev.some((e) => e.type === "raid" && e.what === "wipe")).toBe(true);
    // ular ham zal kirishida tug'iladi
    steps(s, KING_RESPAWN + 0.2);
    for (const rp of ps)
      expect(Math.hypot(rp.p.x - raid.entry.x, rp.p.y - raid.entry.y)).toBeLessThan(2);
  });
});

describe("G'alaba: lut har o'yinchiga va unvon", () => {
  it("each fighter gets their own loot and the first win gives the title", () => {
    const { s, boss, ps } = arena(["paladin", "hunter", "mage"]);
    steps(s, KING_INTRO + 0.2);
    for (const rp of ps) hit(s, rp, boss, 1);
    const gold = ps.map((rp) => rp.gold);
    boss.hp = 1;
    hit(s, ps[0]!, boss, 5);
    for (const [i, rp] of ps.entries()) {
      expect(rp.gold).toBeGreaterThan(gold[i]!);
      expect(rp.inv.some((x) => x?.item === "ashcrown" || x?.item === "kingblade")).toBe(true);
      expect(rp.titles).toContain(KING_TITLE);
    }
    // saqlashda unvon qoladi
    expect(s.savePlayer(ps[1]!.id)!.titles).toContain(KING_TITLE);
  });
});

describe("Onlayn: boss holati serverda, klient ko'zgusida bir xil", () => {
  it("the room streams the King, the raid state and titles to the client mirror", () => {
    const room = new RealmRoom("RAIDZZ", { rand: () => 0.5 });
    const sent: string[] = [];
    const conn = { send: (m: string) => sent.push(m), close: () => {} };
    room.receive(
      "c1",
      conn,
      JSON.stringify({
        t: "hello",
        v: 3,
        tag: "1234",
        hero: "paladin",
        save: null,
        keys: ["devil"],
      }),
      0,
    );
    const rp = room.sim.players.get("c1")!;
    const boss = room.sim.raid!.boss(room.sim)!;
    rp.p.takeHit = () => false;
    rp.p.x = boss.x;
    rp.p.y = boss.y + 70;
    rp.titles = [KING_TITLE];
    for (let i = 0; i < 12; i++) room.step();
    const mirror = new RealmMirror(data, "c1", "paladin", null, 0);
    for (const m of sent.map((x) => JSON.parse(x) as { t: string }))
      if (m.t === "s") mirror.apply(m as never, 0);
    mirror.update(1, 0.05);
    expect(mirror.sim.raid!.active).toBe(true);
    const mk = mirror.sim.mobs.find((m) => m.kind === "ashking");
    expect(mk).toBeDefined();
    expect(mk!.maxHp).toBe(boss.maxHp);
    expect(mirror.me.titles).toContain(KING_TITLE);
  });
});
