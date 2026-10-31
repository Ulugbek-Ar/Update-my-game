import { describe, expect, it } from "vitest";
import { loadRealmData } from "./data";
import { RealmSim, type RealmPlayer } from "./sim";
import { MOB_STATS, PARTY_HP, RING_MAX, RING_SPEED, WARDEN_GUARDS, wardenHp } from "./mobs";
import { RealmRoom, type RoomConn } from "./net/room";
import { NET_VERSION } from "./net/protocol";
import { Rng } from "./rng";

const data = loadRealmData();

function sim() {
  const s = new RealmSim(data);
  const rp = s.addPlayer("p1", "knight");
  rp.p.takeHit = () => false;
  const w = s.mobs.find((m) => m.kind === "warden")!;
  return { s, rp, w };
}

/** Sardorni uyg'otib, jangga tayyorlaydi: o'yinchi (x, y) da, Sardor o'ngga qaragan. */
function awake(s: RealmSim, rp: RealmPlayer) {
  const w = s.mobs.find((m) => m.kind === "warden")!;
  rp.p.x = w.x - 40;
  rp.p.y = w.y;
  for (let i = 0; i < 40; i++) s.step();
  w.state = "chase";
  w.cd = 99;
  w.dirX = 1;
  w.dirY = 0;
  return w;
}

describe("Xaroba Sardori: qalqon", () => {
  it("blocks hits from the front, takes them from behind", () => {
    const { s, rp } = sim();
    const w = awake(s, rp);
    const hp = w.hp;
    // oldidan (o'ngdan)
    rp.p.x = w.x + 22;
    rp.p.y = w.y;
    (s as unknown as { hit(rp: RealmPlayer, m: unknown, d: number, k: number): void }).hit(
      rp,
      w,
      3,
      0,
    );
    expect(w.hp).toBe(hp);
    expect(s.events.some((e) => e.type === "block")).toBe(true);
    // orqasidan (chapdan)
    rp.p.x = w.x - 22;
    (s as unknown as { hit(rp: RealmPlayer, m: unknown, d: number, k: number): void }).hit(
      rp,
      w,
      3,
      0,
    );
    expect(w.hp).toBe(hp - 3);
  });

  it("the shield drops while the warden recovers or is stunned", () => {
    const { s, rp } = sim();
    const w = awake(s, rp);
    expect(w.shieldUp).toBe(true);
    w.state = "recover";
    expect(w.shieldUp).toBe(false);
    w.state = "chase";
    w.stun = 1;
    expect(w.shieldUp).toBe(false);
  });

  it("turns slowly toward the player — circling around works", () => {
    const { s, rp } = sim();
    const w = awake(s, rp);
    rp.p.x = w.x - 30;
    rp.p.y = w.y;
    s.step();
    // bir tickda 180° burila olmaydi
    expect(w.dirX).toBeGreaterThan(0.5);
  });
});

describe("Xaroba Sardori: to'lqin halqalari va qo'riqchilar", () => {
  it("phase 2 slams send a ground ring: it hurts unless you dash over it", () => {
    const { s, rp } = sim();
    const w = awake(s, rp);
    w.phase = 2;
    // Sardor joyida turadi — faqat halqa tegishi mumkin
    w.stun = 99;
    let hits = 0;
    rp.p.takeHit = () => {
      if (rp.p.evading) return false;
      hits++;
      return true;
    };
    rp.p.x = w.x + 60;
    rp.p.y = w.y;
    s.rings.push({ x: w.x, y: w.y, r: 8, hit: new Set() });
    for (let i = 0; i < 20; i++) s.step();
    expect(hits).toBe(1);
    // dash paytida halqa tegmaydi
    s.rings = [{ x: w.x, y: w.y, r: 8, hit: new Set() }];
    for (let i = 0; i < 20; i++) {
      rp.p.dashTimer = 0.1;
      s.step();
    }
    expect(hits).toBe(1);
    for (let i = 0; i < (RING_MAX / RING_SPEED) * 20 + 2; i++) s.step();
    expect(s.rings.length).toBe(0);
  });

  it("a phase 2 slam creates the ring (and tells the clients)", () => {
    const { s, rp } = sim();
    const w = awake(s, rp);
    w.hp = Math.floor(w.maxHp * 0.5);
    w.phase = 2;
    w.state = "windup";
    w.move = "slam";
    w.t = 0.01;
    s.step();
    expect(s.rings.length).toBe(1);
    expect(s.events.some((e) => e.type === "ring")).toBe(true);
  });

  it("phase 3 wakes 2 stone guardians", () => {
    const { s, rp } = sim();
    const w = awake(s, rp);
    const before = s.mobs.filter((m) => m.kind === "sentinel").length;
    w.dirX = -1;
    w.hp = Math.ceil(w.maxHp * 0.3) + 1;
    w.phase = 2;
    rp.p.x = w.x + 22;
    rp.p.y = w.y;
    (s as unknown as { hit(rp: RealmPlayer, m: unknown, d: number, k: number): void }).hit(
      rp,
      w,
      2,
      0,
    );
    expect(w.phase).toBe(3);
    s.step();
    const guards = s.mobs.filter((m) => m.kind === "sentinel").length - before;
    expect(guards).toBe(WARDEN_GUARDS);
  });
});

describe("Onlayn: Sardor joni o'yinchilar soniga qarab", () => {
  it("+70% per extra player", () => {
    expect(wardenHp(1)).toBe(MOB_STATS.warden.hp);
    expect(wardenHp(2)).toBe(Math.round(MOB_STATS.warden.hp * (1 + PARTY_HP)));
    expect(wardenHp(3)).toBe(Math.round(MOB_STATS.warden.hp * (1 + 2 * PARTY_HP)));
  });

  it("the server room (same RealmSim as the client) scales the warden for 3 players", () => {
    const r = new Rng(5);
    const room = new RealmRoom("ABCDEF", { rand: () => r.next() });
    const conn: RoomConn = { send() {}, close() {} };
    for (const tag of ["1111", "2222", "3333"]) {
      const hello = { t: "hello", v: NET_VERSION, tag, hero: "knight", save: null, keys: [] };
      room.receive(room.newId(), conn, JSON.stringify(hello), 0);
    }
    const s = room.sim;
    expect(s.players.size).toBe(3);
    const w = s.mobs.find((m) => m.kind === "warden")!;
    let i = 0;
    for (const rp of s.players.values()) {
      rp.p.takeHit = () => false;
      rp.p.x = w.x - 40;
      rp.p.y = w.y - 20 + i++ * 20;
    }
    for (let t = 0; t < 40; t++) room.step();
    expect(w.state).not.toBe("dormant");
    expect(w.maxHp).toBe(wardenHp(3));
    expect(w.hp).toBe(w.maxHp);
  });

  it("a player joining mid-fight raises max hp but keeps the hp share", () => {
    const { s, rp, w } = sim();
    awake(s, rp);
    w.hp = w.maxHp / 2;
    const p2 = s.addPlayer("p2", "mage");
    p2.p.takeHit = () => false;
    p2.p.x = w.x - 40;
    p2.p.y = w.y + 20;
    s.step();
    expect(w.maxHp).toBe(wardenHp(2));
    expect(w.hp / w.maxHp).toBeCloseTo(0.5, 1);
  });

  it("loot is personal: every fighter gets their own blade and gold", () => {
    const { s, rp, w } = sim();
    awake(s, rp);
    const p2 = s.addPlayer("p2", "mage");
    p2.p.takeHit = () => false;
    const hit = (s as unknown as { hit(rp: RealmPlayer, m: unknown, d: number, k: number): void })
      .hit;
    w.hp = 4;
    const gold = [rp.gold, p2.gold];
    rp.p.x = p2.p.x = w.x - 22;
    rp.p.y = p2.p.y = w.y;
    hit.call(s, p2, w, 1, 0);
    hit.call(s, rp, w, 9, 0);
    expect(w.dead).toBe(true);
    for (const p of [rp, p2]) expect(p.inv.some((i) => i?.item === "wardblade")).toBe(true);
    expect(rp.gold).toBeGreaterThan(gold[0]!);
    expect(p2.gold).toBeGreaterThan(gold[1]!);
    // yerda talashiladigan lut yo'q
    expect(s.items.some((i) => i.item === "wardblade")).toBe(false);
  });
});
