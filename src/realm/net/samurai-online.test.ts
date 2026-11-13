import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealmRoom, netPlayer, type RoomConn } from "./room";
import {
  NET_VERSION,
  PF_CHARGE,
  PF_DASH,
  PF_IAI,
  PF_PARRY,
  parseClientMsg,
  type HelloMsg,
  type NetPlayer,
  type ServerMsg,
  type SnapshotMsg,
} from "./protocol";
import { RealmMirror } from "./mirror";
import { Rng } from "../rng";
import { RealmPlayer, RealmSim, TICK_DT, type RealmEvent } from "../sim";
import { loadRealmData } from "../data";
import { RealmClient } from "../client";
import {
  HERO_MARK,
  HERO_SINCE,
  HERO_VERSION,
  heroFor,
  heroVersion,
  legacyHeroes,
} from "@/game/heroCompat";
import { HEROES } from "@/game/hero";
import { IAI_CHARGE, IAI_DELAY, IAI_MIN, type IaiDash } from "@/game/player";
import { SAMURAI_FRAME } from "@/game/sprites";
import { call, setTransport } from "@/account/api";
import { SKINS, skinLook } from "@/game/skins";
import { SAM_DEMO, SkinDemo, samuraiPose } from "@/game/skinDemo";

class FakeConn implements RoomConn {
  out: ServerMsg[] = [];
  send(s: string) {
    this.out.push(JSON.parse(s) as ServerMsg);
  }
  close() {}
  snaps() {
    return this.out.filter((m): m is SnapshotMsg => m.t === "s");
  }
  /** Oxirgi ma'lum holat: id -> o'yinchi kortej */
  players() {
    const all = new Map<string, NetPlayer>();
    for (const s of this.snaps()) for (const p of s.p ?? []) all.set(p[0], p);
    return all;
  }
}

const hello = (tag: string, extra: Partial<HelloMsg> = {}): string =>
  JSON.stringify({
    t: "hello",
    v: NET_VERSION,
    tag,
    hero: "knight",
    save: null,
    keys: [],
    ...extra,
  });

function room() {
  const r = new Rng(9);
  return new RealmRoom("ABCDEF", { rand: () => r.next() });
}

function join(rm: RealmRoom, tag: string, extra: Partial<HelloMsg> = {}) {
  const c = new FakeConn();
  const id = rm.newId();
  rm.receive(id, c, hello(tag, extra), 0);
  return { c, id };
}

const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };

beforeEach(() => localStorage.clear());
afterEach(() => {
  setTransport(null);
  vi.unstubAllGlobals();
});

describe("Eski klientlar bilan moslik (qahramonlar versiyasi)", () => {
  it("only the Samurai is new; heroFor turns unknown heroes into the knight", () => {
    expect(HERO_VERSION).toBe(1);
    for (const h of HEROES) expect(HERO_SINCE[h]).toBe(h === "samurai" ? 1 : 0);
    expect(heroFor("samurai", 0)).toBe("knight");
    expect(heroFor("samurai", 1)).toBe("samurai");
    expect(heroFor("paladin", 0)).toBe("paladin");
    expect(heroVersion(undefined)).toBe(0);
    expect(heroVersion(null)).toBe(0);
    expect(heroVersion("1")).toBe(1);
    expect(heroVersion("abc")).toBe(0);
    expect(heroVersion(-3)).toBe(0);
  });

  it("an old client (no hv in hello) still joins and sees another Samurai as a plain knight", () => {
    expect(parseClientMsg(hello("1111"))?.t).toBe("hello");
    expect(parseClientMsg(hello("1111", { hv: 1 }))?.t).toBe("hello");
    const rm = room();
    const old = join(rm, "1111");
    const fresh = join(rm, "2222", { hv: HERO_VERSION });
    const sam = join(rm, "3333", { hero: "samurai", skin: "samurai-moon", hv: HERO_VERSION });
    for (let i = 0; i < 6; i++) rm.step();
    const seenByOld = old.c.players().get(sam.id)!;
    expect(seenByOld[1]).toBe("knight");
    // eski klient Samuray skinini bilmaydi — asl ranglar (maydon yuborilmaydi)
    expect(seenByOld[16]).toBeUndefined();
    const seenByNew = fresh.c.players().get(sam.id)!;
    expect(seenByNew[1]).toBe("samurai");
    expect(seenByNew[16]).toBe("samurai-moon");
    // serverdagi haqiqiy qahramon o'zgarmaydi
    expect(rm.sim.players.get(sam.id)!.hero).toBe("samurai");
  });

  it("the Samurai's flags: IAI (with dash), charge stance and parry pose; old clients get only the dash", () => {
    const rp = new RealmPlayer("s1", "samurai", 100, 100, 16);
    const p = rp.p;
    p.iai = { speed: 300, mul: 1, k: 1, crit: false, from: { x: 0, y: 0 } } satisfies IaiDash;
    p.dashTimer = 0.1;
    let t = netPlayer(rp, "A");
    expect(t[11] & PF_IAI).toBeTruthy();
    expect(t[11] & PF_DASH).toBeTruthy();
    t = netPlayer(rp, "A", 0, "", "", 0);
    expect(t[1]).toBe("knight");
    expect(t[11] & PF_IAI).toBe(0);
    expect(t[11] & PF_DASH).toBeTruthy();
    p.iai = null;
    p.dashTimer = 0;
    p.charge = IAI_MIN + 0.1;
    expect(netPlayer(rp, "A")[11] & PF_CHARGE).toBeTruthy();
    p.charge = 0;
    p.parryPose = 0.2;
    expect(netPlayer(rp, "A")[11] & PF_PARRY).toBeTruthy();
    // boshqa qahramonlarda bu bitlar yo'q
    const knight = new RealmPlayer("k1", "knight", 100, 100, 16);
    knight.p.charge = 5;
    expect(netPlayer(knight, "B")[11] & (PF_IAI | PF_CHARGE | PF_PARRY)).toBe(0);
  });

  it("a new client draws the remote Samurai's IAI, stance and parry frames from those flags", () => {
    const mirror = new RealmMirror(loadRealmData(), "me", "knight", null, 1);
    const sim = mirror.sim;
    let tick = 1;
    const send = (flags: number) => {
      const t: NetPlayer = ["s1", "samurai", "Aki", 100, 100, 4, 4, 1, 0, 2, 0, flags, 0, "", 0];
      tick++;
      mirror.apply({ t: "s", tick, ack: 0, at: 0, n: 2, p: [t] } as SnapshotMsg, tick);
      mirror.update(tick + 5, 1 / 60);
      return sim.players.get("s1")!.p;
    };
    let p = send(PF_IAI | PF_DASH);
    expect(p.samuraiFrame()).toEqual(["attack", SAMURAI_FRAME.iai]);
    p = send(PF_CHARGE);
    expect(p.samuraiFrame()).toEqual(["attack", SAMURAI_FRAME.charge]);
    p = send(PF_PARRY);
    expect(p.samuraiFrame()).toEqual(["attack", SAMURAI_FRAME.parry]);
    p = send(0);
    expect(p.iai).toBeNull();
    expect(p.charge).toBe(0);
  });
});

describe("Onlayn: Samuray effektlari boshqalarga ham ko'rinadi", () => {
  /** Mob ustidan IAI: sim voqealarini yig'ib qaytaradi */
  function iaiThroughMob() {
    const s = new RealmSim(loadRealmData());
    const rp = s.addPlayer("p1", "samurai");
    rp.p.takeHit = () => false;
    const m = s.mobs.find((m) => m.kind === "boar")!;
    for (let t = 0; t < 1.2; t += TICK_DT) s.step();
    m.stun = 30;
    const events: RealmEvent[] = [];
    const drain = () => {
      events.push(...s.events);
      s.events = [];
    };
    drain();
    rp.p.x = m.x - 30;
    rp.p.y = m.y;
    rp.p.fx = 1;
    rp.p.fy = 0;
    s.command(rp, { type: "attack", down: true });
    for (let t = 0; t < IAI_CHARGE + 0.1; t += TICK_DT) {
      s.step();
      drain();
    }
    s.command(rp, { type: "attack", down: false });
    for (let t = 0; t < 0.3 + IAI_DELAY + 0.3; t += TICK_DT) {
      s.step();
      drain();
    }
    return { s, rp, m, events };
  }

  it("the sim sends the IAI streak and each delayed cut (with order and slant)", () => {
    const { m, events } = iaiThroughMob();
    const iai = events.find((e) => e.type === "iai");
    expect(iai).toMatchObject({ pid: "p1" });
    const cut = events.find((e) => e.type === "cut");
    expect(cut).toMatchObject({ pid: "p1", n: 0, r: Math.round(m.size / 2 + 9) });
    if (iai?.type !== "iai" || cut?.type !== "cut") throw new Error("voqealar yo'q");
    expect(iai.x2).toBeGreaterThan(iai.x);
    // kesik — mob turgan joyda, sirpanish yo'lining ustida
    expect(cut.x).toBeGreaterThan(iai.x);
    expect(cut.x).toBeLessThan(iai.x2);
    expect(Math.abs(cut.y - iai.y)).toBeLessThan(6);
    // ikkinchi kesik (agar bo'lsa) tartibi oshadi
    const cuts = events.filter((e) => e.type === "cut");
    cuts.forEach((c, i) => expect(c).toMatchObject({ n: i }));
  });

  it("the sim reports parries and perfect dodges", () => {
    const s = new RealmSim(loadRealmData());
    const rp = s.addPlayer("p1", "samurai");
    rp.p.perfect = true;
    rp.p.parried = [{ x: rp.p.x + 10, y: rp.p.y }];
    s.step();
    const types = s.events.map((e) => e.type);
    expect(types).toContain("dodge");
    expect(types).toContain("parry");
    expect(rp.p.critReady).toBe(true);
  });

  it("the client draws them in the owner's skin; the legendary adds the red moon", () => {
    const c = new RealmClient(canvas as unknown as HTMLCanvasElement, "knight");
    const sim = (c as unknown as { sim: RealmSim }).sim;
    const other = sim.addPlayer("p2", "samurai");
    other.skin = "samurai-moon";
    const on = (e: RealmEvent) => (c as unknown as { onEvent(e: RealmEvent): void }).onEvent(e);
    const v = c.view;
    on({ type: "iai", pid: "p2", x: 100, y: 100, x2: 160, y2: 100 });
    expect(v.streaks).toHaveLength(1);
    expect(v.streaks[0]!.theme).toBe(skinLook("samurai", "samurai-moon").theme);
    on({ type: "cut", pid: "p2", x: 150, y: 100, a: 0.9, r: 14, n: 0 });
    expect(v.cuts).toHaveLength(1);
    expect(v.cuts[0]!.shards).toBe(false);
    on({ type: "dodge", pid: "p2", x: 150, y: 100 });
    expect(v.moons).toHaveLength(1);
    on({ type: "parry", pid: "p2", x: 150, y: 100 });
    // Qor lotos: kesik — muz chizig'i; oddiy skinda oy yo'q
    other.skin = "samurai-lotus";
    on({ type: "cut", pid: "p2", x: 150, y: 100, a: 0.9, r: 14, n: 0 });
    expect(v.cuts[1]!.shards).toBe(true);
    on({ type: "dodge", pid: "p2", x: 150, y: 100 });
    expect(v.moons).toHaveLength(1);
  });
});

describe("Akkaunt: reyting, do'stlar va profil eski klientda yiqilmaydi", () => {
  it("an old client gets the Samurai as a knight in display fields; saves are untouched", () => {
    const reply = {
      ok: true,
      rows: [
        { rank: 1, id: 1, nick: "Aki", avatar: "samurai", level: 9, score: 900, hero: "samurai" },
        { rank: 2, id: 2, nick: "Bo", avatar: "mage", level: 3, score: 500, hero: "paladin" },
      ],
      friends: [{ id: 3, nick: "Cy", avatar: "samurai", level: 2, online: true }],
      card: { id: 1, nick: "Aki", avatar: "samurai", heroes: ["knight", "samurai", "paladin"] },
      gift: { from: { nick: "Muallif", avatar: "samurai", author: true }, hero: "samurai" },
      save: { version: 3, data: { "pixel-rpg-hero": "samurai", hero: "samurai" } },
    };
    const old = legacyHeroes(reply, 0);
    expect(old.rows[0]).toMatchObject({ avatar: "knight", hero: "knight", nick: "Aki" });
    expect(old.rows[1]).toMatchObject({ avatar: "mage", hero: "paladin" });
    expect(old.friends[0]!.avatar).toBe("knight");
    expect(old.card.heroes).toEqual(["knight", "paladin"]);
    expect(old.gift.from.avatar).toBe("knight");
    expect(old.gift.hero).toBe("knight");
    // bulutli saqlanish — aynan o'zi (sotib olingan qahramon yo'qolmaydi)
    expect(old.save).toEqual(reply.save);
    // yangi klientga — o'zgarishsiz
    expect(legacyHeroes(reply, HERO_VERSION)).toBe(reply);
    expect(reply.rows[0]!.avatar).toBe("samurai");
  });

  it("the client tells the server which heroes it can draw (?hv=1, no CORS preflight)", async () => {
    const urls: string[] = [];
    const inits: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string, init: RequestInit) => {
        urls.push(u);
        inits.push(init);
        return { json: async () => ({ ok: true }) } as Response;
      }),
    );
    setTransport(null);
    await call("me", { token: "x".repeat(40) });
    expect(urls[0]).toMatch(new RegExp(`/acc/me\\?${HERO_MARK}=${HERO_VERSION}$`));
    expect(inits[0]!.headers).toEqual({ "Content-Type": "text/plain;charset=UTF-8" });
  });
});

describe("Do'kon: Samuray namoyishi", () => {
  it("shows the katana combo, the IAI (stance, slide, sheathing for Qizil oy) and the dash", () => {
    const F = SAMURAI_FRAME;
    expect(samuraiPose(0.55, false)).toMatchObject({ state: "attack", frame: 0 });
    expect(samuraiPose(0.5 + SAM_DEMO.slash * 2.5, false).frame).toBeGreaterThanOrEqual(F.wide);
    expect(samuraiPose(1.3, false)).toMatchObject({ x: SAM_DEMO.back, frame: F.charge });
    const slide = samuraiPose(SAM_DEMO.iai + SAM_DEMO.slide / 2, false);
    expect(slide).toMatchObject({ frame: F.iai, iai: true });
    expect(slide.x).toBeGreaterThan(SAM_DEMO.back);
    // afsonaviy — qinga qaytarish kadri, qolganlari — kesish kadrida qoladi
    expect(samuraiPose(1.9, true).frame).toBe(F.sheathe);
    expect(samuraiPose(1.9, false).frame).toBe(F.iai);
    expect(samuraiPose(2.1, false)).toMatchObject({ frame: F.dash, flip: true });
    expect(samuraiPose(3, false)).toMatchObject({ state: "idle", x: SAM_DEMO.home });
  });

  it("every Samurai skin's demo cuts the target after the IAI", () => {
    for (const s of SKINS.samurai) {
      const d = new SkinDemo("samurai", s, undefined);
      d.fx.reduced = false;
      let cut = false;
      for (let i = 0; i < 140; i++) {
        d.update(1 / 60);
        cut ||= (d as unknown as { cuts: unknown[] }).cuts.length > 0;
      }
      expect(cut, s.id).toBe(true);
    }
  });
});
