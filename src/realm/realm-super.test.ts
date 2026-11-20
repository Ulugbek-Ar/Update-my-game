/**
 * Onlayn olamda superlar (v3.14): faqat PvE, zaryad serverda, shar to'lmagan super rad etiladi,
 * boshqalar bitta qisqa voqea bilan ko'radi, eski klient va eski server buzilmaydi.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealmSim, TICK_DT, type RealmEvent, type RealmPlayer } from "./sim";
import { loadRealmData } from "./data";
import { RealmClient } from "./client";
import { Loopback } from "./net/loopback";
import { RealmMirror } from "./net/mirror";
import {
  CommandSchema,
  NET_VERSION,
  parseClientMsg,
  type NetMe,
  type SnapshotMsg,
} from "./net/protocol";
import { superFor } from "@/game/super";
import { HEROES, type Hero } from "@/game/hero";
import { realmBoss } from "./supers";

const data = loadRealmData();
const MS = TICK_DT * 1000;

function world(hero: Hero = "paladin") {
  const sim = new RealmSim(data);
  const rp = sim.addPlayer("a", hero);
  return { sim, rp };
}

/** Ekrandagi mob (paydo bo'lib bo'lgan) */
function mob(
  sim: RealmSim,
  rp: RealmPlayer,
  dx: number,
  dy: number,
  kind: "boar" | "warden" = "boar",
) {
  const m = sim.addMob(kind, rp.p.x + dx, rp.p.y + dy);
  m.spawnT = 0;
  if (kind === "warden") m.state = "chase";
  return m;
}

const fill = (rp: RealmPlayer) => {
  rp.meter.value = rp.meter.def!.charge;
};

/** Super tugaguncha tick (voqealar yig'iladi) */
function run(sim: RealmSim, rp: RealmPlayer, max = 8) {
  const evs: RealmEvent[] = [];
  for (let t = 0; t < max && (t === 0 || rp.cast); t += TICK_DT) {
    sim.step(t === 0 ? [{ pid: rp.id, cmd: { type: "super" } }] : []);
    evs.push(...sim.events);
  }
  return evs;
}

describe("Onlayn super: server (RealmSim)", () => {
  it("rejects a super while the orb is not full — nothing happens, nothing is sent", () => {
    const { sim, rp } = world();
    const m = mob(sim, rp, 40, 0);
    rp.meter.value = rp.meter.def!.charge - 1;
    sim.step([{ pid: rp.id, cmd: { type: "super" } }]);
    expect(rp.cast).toBeNull();
    expect(rp.p.casting).toBe(false);
    expect(sim.events.some((e) => e.type === "super")).toBe(false);
    expect(rp.meter.value).toBe(rp.meter.def!.charge - 1);
    expect(m.dead).toBe(false);
  });

  it("every hero's super works online: one short event, mobs on screen die, far ones and players do not get hurt", () => {
    for (const hero of HEROES) {
      const { sim, rp } = world(hero);
      const other = sim.addPlayer("b", "knight");
      other.p.x = rp.p.x + 20;
      other.p.y = rp.p.y;
      const hp = other.p.hp;
      rp.p.fx = 1;
      rp.p.fy = 0;
      const near = mob(sim, rp, 50, 0);
      // mob boshqa o'yinchiga tegmasin (faqat superning o'zi tekshiriladi)
      near.stun = 99;
      const far = mob(sim, rp, 600, 0);
      fill(rp);
      const evs = run(sim, rp);
      const sup = evs.filter((e) => e.type === "super");
      expect(sup.length, hero).toBe(1);
      expect(sup[0]).toMatchObject({ pid: "a", id: superFor(hero)!.id });
      // bitta qisqa xabar: kalitlar soni kam
      expect(JSON.stringify(sup[0]).length, hero).toBeLessThan(120);
      expect(rp.cast, hero).toBeNull();
      expect(rp.p.casting, hero).toBe(false);
      expect(rp.meter.value, hero).toBeLessThan(rp.meter.def!.charge);
      if (hero !== "gunner") expect(near.dead, hero).toBe(true);
      expect(far.dead, hero).toBe(false);
      // faqat PvE: boshqa o'yinchi jon yo'qotmaydi
      expect(other.p.hp, hero).toBe(hp);
    }
  });

  it("the caster stands still and is invulnerable only during the super", () => {
    const { sim, rp } = world("mage");
    fill(rp);
    sim.step([
      { pid: rp.id, cmd: { type: "super" } },
      { pid: rp.id, cmd: { type: "move", x: 1, y: 0 } },
    ]);
    const x = rp.p.x;
    expect(rp.p.casting).toBe(true);
    expect(sim.hurtPlayer(rp, 1, rp.p.x + 5, rp.p.y, 0)).toBe(false);
    for (let i = 0; i < 10; i++) sim.step([]);
    expect(rp.p.x).toBe(x);
    while (rp.cast) sim.step([]);
    expect(rp.p.casting).toBe(false);
    expect(rp.p.invuln).toBeLessThanOrEqual(0);
  });

  it("a boss (warden) loses at most 10% of its max HP to one super", () => {
    for (const hero of HEROES.filter((h) => h !== "gunner")) {
      const { sim, rp } = world(hero);
      rp.p.fx = 1;
      rp.p.fy = 0;
      const w = mob(sim, rp, 40, 0, "warden");
      expect(realmBoss(w)).toBe(true);
      const hp = w.hp;
      fill(rp);
      run(sim, rp);
      expect(hp - w.hp, hero).toBeGreaterThan(0);
      expect(hp - w.hp, hero).toBeLessThanOrEqual(w.maxHp * 0.1 + 1e-6);
      expect(w.dead, hero).toBe(false);
    }
  });

  it("the orb charges from damage dealt (not from the super itself) and from hits taken", () => {
    const { sim, rp } = world("knight");
    const m = mob(sim, rp, 30, 0);
    m.hp = m.maxHp = 50;
    sim.hit(rp, m, 3, 0);
    expect(rp.meter.value).toBe(3);
    sim.hit(rp, m, 5, 0, true);
    expect(rp.meter.value).toBe(3);
    rp.p.invuln = 0;
    sim.hurtPlayer(rp, 1, rp.p.x + 5, rp.p.y, 0);
    expect(rp.meter.value).toBe(4);
  });

  it("CHEKSIZ O'Q online: the Gunner is free, never runs out of ammo, the drum is full at the end", () => {
    const { sim, rp } = world("gunner");
    fill(rp);
    sim.step([{ pid: rp.id, cmd: { type: "super" } }]);
    while (rp.cast && rp.cast.cast.stage !== "strike") sim.step([]);
    expect(rp.p.frenzy).toBe(true);
    expect(rp.p.casting).toBe(false);
    sim.step([{ pid: rp.id, cmd: { type: "attack", down: true } }]);
    for (let i = 0; i < 40; i++) sim.step([]);
    expect(rp.p.ammo).toBe(rp.p.ammoMax);
    expect(rp.p.reloading).toBe(false);
    while (rp.cast) sim.step([]);
    expect(rp.p.frenzy).toBe(false);
    expect(rp.p.ammo).toBe(rp.p.ammoMax);
  });
});

describe("Onlayn super: protokol va eski klient", () => {
  it("the protocol version is unchanged; the new command is optional for old clients", () => {
    expect(NET_VERSION).toBe(4);
    expect(CommandSchema.safeParse({ type: "super" }).success).toBe(true);
    // eski klient xabari (super yo'q) — o'zgarishsiz qabul qilinadi
    const old = JSON.stringify({ t: "cmd", s: 3, c: [{ type: "attack", down: true }] });
    expect(parseClientMsg(old)).not.toBeNull();
  });

  it("an old client's mirror accepts new snapshots: unknown event and the new 'sp' field are harmless", () => {
    const mirror = new RealmMirror(data, "x", "knight", null, 0);
    const me: NetMe = {
      gold: 0,
      inv: [],
      quests: {},
      secrets: [],
      fragments: [],
      opened: [],
      torchStep: 0,
      landmarks: [],
      kills: 0,
      ui: null,
      starNight: -1,
      titles: [],
    };
    const snap = (extra: Partial<SnapshotMsg>): SnapshotMsg => ({
      t: "s",
      tick: 1,
      ack: 0,
      at: 0,
      n: 2,
      ...extra,
    });
    // eski server: sp yo'q — zaryad 0
    expect(() => mirror.apply(snap({ me }), 0)).not.toThrow();
    expect(mirror.me.meter.value).toBe(0);
    // yangi server: sp va super voqeasi (eski klient kodida — noma'lum tur, e'tiborsiz)
    const ev = [
      { type: "super", pid: "y", id: "divine-judgment", x: 1, y: 2, ax: 1, ay: 0 },
      { type: "future-thing", x: 0, y: 0 },
    ] as unknown as RealmEvent[];
    expect(() => mirror.apply(snap({ tick: 2, me: { ...me, sp: 7 }, ev }), 0.1)).not.toThrow();
    expect(mirror.me.meter.value).toBe(7);
  });
});

describe("Onlayn super: ikki klient (Loopback)", () => {
  const canvas = () =>
    ({ getContext: () => ({ imageSmoothingEnabled: true }) }) as unknown as HTMLCanvasElement;
  const tick = (c: RealmClient) => (c as unknown as { tick(): void }).tick();

  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 });
    localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it("the server rejects an unfilled super; a full one is seen by the other player", async () => {
    const lb = new Loopback(() => Date.now());
    const a = new RealmClient(canvas(), "paladin");
    const b = new RealmClient(canvas(), "knight");
    a.connect(lb.deps(), null);
    await vi.advanceTimersByTimeAsync(10);
    b.connect(lb.deps(), a.net!.code);
    await vi.advanceTimersByTimeAsync(10);
    expect(a.online && b.online).toBe(true);
    const room = lb.room(a.net!.code!);
    const srvA = room.sim.players.get(a.pid)!;
    const step = async (n: number) => {
      for (let i = 0; i < n; i++) {
        lb.step();
        tick(a);
        tick(b);
        await vi.advanceTimersByTimeAsync(MS);
      }
    };
    // shar to'lmagan: klient yubormaydi, qo'lda yuborilsa — server rad etadi
    expect(a.canSuper()).toBe(false);
    a.net!.sendCmds(999, [{ type: "super" }]);
    await step(4);
    expect(srvA.cast).toBeNull();
    expect(b.supers.casts.size).toBe(0);
    // server sharni to'ldiradi (o'yinda — zarar berish bilan), klient zaryadni snapshotdan oladi
    srvA.meter.value = srvA.meter.def!.charge;
    b.me.p.x = srvA.p.x + 30;
    b.me.p.y = srvA.p.y;
    room.sim.players.get(b.pid)!.p.x = srvA.p.x + 30;
    room.sim.players.get(b.pid)!.p.y = srvA.p.y;
    await step(4);
    expect(a.superMeter.ready).toBe(true);
    expect(a.canSuper()).toBe(true);
    // kirish oynasi yopiq (oynada tugmalar o'yinga ketmaydi)
    a.setPanel("none");
    a.input.pressSuper();
    await step(8);
    expect(srvA.cast ?? srvA.p.casting).toBeTruthy();
    // B superni ko'radi (bitta voqea), A — o'zining kartasi bilan
    expect(b.supers.casts.has(a.pid)).toBe(true);
    expect(a.supers.casts.has(a.pid)).toBe(true);
    expect(a.supers.card).not.toBeNull();
    expect(b.supers.card).toBeNull();
  });

  it("with an old server (no 'sup' in welcome) the client never sends a super", async () => {
    const lb = new Loopback(() => Date.now());
    const a = new RealmClient(canvas(), "paladin");
    a.connect(lb.deps(), null);
    await vi.advanceTimersByTimeAsync(10);
    (a as unknown as { serverSupers: boolean }).serverSupers = false;
    a.me.meter.value = a.me.meter.def!.charge;
    expect(a.canSuper()).toBe(false);
  });
});
