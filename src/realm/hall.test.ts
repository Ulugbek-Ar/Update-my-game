// @vitest-environment node
/**
 * Gildiya zali (v3.3): zal xaritasi va obyektlari, vodiydagi gildiya darvozasi, mashq
 * qo'g'irchog'i, zal xonasi — faqat a'zolar kiradi, trofeylar.
 */
import { describe, expect, it } from "vitest";
import { loadHallData, loadRealmData } from "./data";
import { RealmSim, DAY_TICKS, tileCenter, type RealmEvent } from "./sim";
import { HallRoom, HALL_CAP } from "./net/hall";
import { RealmRoom, type RoomConn } from "./net/room";
import {
  ERR_TEXT,
  NET_VERSION,
  hallCode,
  type HelloMsg,
  type NetIdent,
  type ServerMsg,
} from "./net/protocol";
import { Rng } from "./rng";
import { trophiesIn } from "@/account/server/guildLife";
import { AccountStore } from "@/account/server/store";
import { memoryDb } from "@/account/server/memory-db";

class FakeConn implements RoomConn {
  out: ServerMsg[] = [];
  closed: string | null = null;
  send(s: string) {
    this.out.push(JSON.parse(s) as ServerMsg);
  }
  close(_code: number, reason: string) {
    this.closed = reason;
  }
  last<T extends ServerMsg["t"]>(t: T) {
    return this.out.filter((m) => m.t === t).at(-1) as Extract<ServerMsg, { t: T }> | undefined;
  }
}

const hello = (extra: Partial<HelloMsg> = {}): string =>
  JSON.stringify({
    t: "hello",
    v: NET_VERSION,
    tag: "1234",
    hero: "knight",
    save: null,
    keys: [],
    ...extra,
  });

const member = (id: number, guild: number): NetIdent => ({
  id,
  nick: `Azo${id}`,
  level: 5,
  guild: { id: guild, tag: "PQ", emblem: "0-0-3-1" },
});

/** Sim'da o'yinchini obyekt oldiga qo'yib, "interact" bosish */
function interactAt(sim: RealmSim, id: string, tx: number, ty: number, fy = -1) {
  const rp = sim.players.get(id)!;
  rp.p.x = rp.px = tileCenter(tx);
  rp.p.y = rp.py = tileCenter(ty) - fy * 16;
  rp.p.fx = 0;
  rp.p.fy = fy;
  sim.step([{ pid: id, cmd: { type: "interact" } }]);
  return sim.events;
}

describe("Gildiya zali xaritasi", () => {
  it("alohida kichik olam: yopiq bino, xazina, topshiriqlar, a'zolar, chiqish va qo'g'irchoq", () => {
    const d = loadHallData();
    expect(d.region.id).toBe("guildhall");
    expect(d.region.indoor).toBe(true);
    const what = d.region.objects.flatMap((o) => (o.type === "guild" ? [o.what] : []));
    expect(what.sort()).toEqual(["exit", "members", "quests", "treasury"]);
    expect(d.region.mobZones).toMatchObject([{ mob: "dummy", count: 1 }]);
    const sim = new RealmSim(d);
    const [sx, sy] = d.region.spawn;
    expect(sim.solidAt(sx, sy)).toBe(false);
    // kecha bo'lsa ham zal yorug'
    sim.tick = Math.floor(DAY_TICKS * 0.7);
    expect(sim.darkness).toBe(0);
    expect(sim.mobs.filter((m) => m.kind === "dummy")).toHaveLength(1);
  });

  it("vodiy qishlog'ida gildiya darvozasi: bosilganda 'guild' (gate) voqeasi — faqat egasiga", () => {
    const d = loadRealmData();
    const gate = d.region.objects.find((o) => o.type === "guild" && o.what === "gate");
    expect(gate).toBeDefined();
    const village = d.region.landmarks.find((l) => l.id === "village")!;
    expect(Math.hypot(gate!.x - village.x, gate!.y - village.y)).toBeLessThan(village.r);
    const sim = new RealmSim(d);
    sim.addPlayer("me", "knight");
    const ev = interactAt(sim, "me", gate!.x, gate!.y);
    expect(ev).toContainEqual({ type: "guild", pid: "me", what: "gate" });
  });

  it("zal obyektlari: xazina sandig'i, taxta, kitob va eshik — oynani ochadi yoki chiqaradi", () => {
    const sim = new RealmSim(loadHallData());
    sim.addPlayer("me", "mage");
    for (const o of sim.region.objects) {
      if (o.type !== "guild") continue;
      const fy = o.what === "exit" ? 1 : -1;
      const ev = interactAt(sim, "me", o.x, o.y, fy);
      expect(ev.filter((e) => e.type === "guild")).toEqual([
        { type: "guild", pid: "me", what: o.what },
      ]);
    }
  });

  it("mashq qo'g'irchog'i: zararni ko'rsatadi (kim urgani bilan), o'lmaydi va qimirlamaydi", () => {
    const sim = new RealmSim(loadHallData());
    const rp = sim.addPlayer("me", "knight");
    const dummy = sim.mobs.find((m) => m.kind === "dummy")!;
    const x0 = dummy.x,
      y0 = dummy.y;
    rp.p.x = rp.px = dummy.x - 14;
    rp.p.y = rp.py = dummy.y;
    rp.p.fx = 1;
    rp.p.fy = 0;
    const hits: RealmEvent[] = [];
    for (let i = 0; i < 400; i++) {
      const down = i % 12 === 0;
      sim.step(
        down
          ? [{ pid: "me", cmd: { type: "attack", down: true } }]
          : i % 12 === 2
            ? [{ pid: "me", cmd: { type: "attack", down: false } }]
            : [],
      );
      hits.push(...sim.events.filter((e) => e.type === "hit" && e.kind === "dummy"));
    }
    expect(hits.length).toBeGreaterThan(5);
    expect(hits.every((e) => e.type === "hit" && e.pid === "me" && e.dmg > 0)).toBe(true);
    expect(dummy.dead).toBe(false);
    expect(dummy.hp).toBe(dummy.maxHp);
    expect([dummy.x, dummy.y]).toEqual([x0, y0]);
    expect(rp.p.hp).toBe(rp.p.maxHp);
  });
});

describe("Gildiya zali xonasi (server)", () => {
  function hall(guild = 7) {
    const r = new Rng(3);
    const h = new HallRoom(guild, { rand: () => r.next() });
    h.info = {
      id: guild,
      name: "Qal'a Qo'riqchilari",
      tag: "PQ",
      emblem: "0-0-3-1",
      level: 6,
      trophies: ["devil"],
    };
    return h;
  }

  it("faqat shu gildiya a'zolari kiradi: mehmon va boshqa gildiya — rad ('member')", () => {
    const h = hall(7);
    expect(h.code).toBe(hallCode(7));
    const guest = new FakeConn();
    h.receive(h.newId(), guest, hello(), 0, null);
    expect(guest.last("err")).toEqual({ t: "err", reason: "member" });
    expect(guest.closed).toBe("member");
    expect(ERR_TEXT.member).toContain("a'zolari");
    const other = new FakeConn();
    h.receive(h.newId(), other, hello({ acct: "x".repeat(40) }), 0, member(2, 99));
    expect(other.last("err")?.reason).toBe("member");
    const ok = new FakeConn();
    h.receive(h.newId(), ok, hello({ acct: "y".repeat(40) }), 0, member(3, 7));
    const w = ok.last("welcome");
    expect(w).toMatchObject({ code: "G7", hall: { tag: "PQ", level: 6, trophies: ["devil"] } });
    expect(h.size).toBe(1);
    expect(h.cap).toBe(HALL_CAP);
  });

  it("hamma eshik oldida paydo bo'ladi; buyum ishlatish va savdo zalda yo'q", () => {
    const h = hall(7);
    const c = new FakeConn();
    const id = h.newId();
    const save = {
      hero: "knight",
      x: 1000,
      y: 1000,
      hp: 3,
      gold: 10,
      inv: [{ item: "potion", n: 2 }],
      quests: {},
      secrets: [],
      fragments: [],
      opened: [],
      torchStep: 0,
      landmarks: [],
      kills: 0,
      explored: "",
      starNight: -1,
    };
    h.receive(
      id,
      c,
      hello({ acct: "z".repeat(40), save: save as HelloMsg["save"] }),
      0,
      member(4, 7),
    );
    const rp = h.sim.players.get(id)!;
    const [sx, sy] = h.sim.region.spawn;
    expect([rp.p.x, rp.p.y]).toEqual([tileCenter(sx), tileCenter(sy)]);
    h.receive(id, c, JSON.stringify({ t: "cmd", s: 1, c: [{ type: "use", slot: 0 }] }), 0.1);
    h.step();
    expect(rp.inv[0]).toEqual({ item: "potion", n: 2 });
  });

  it("bezak o'zgarsa zaldagilarga 'hall' xabari ketadi; oddiy olam xonasi a'zolikni so'ramaydi", () => {
    const h = hall(7);
    const c = new FakeConn();
    h.receive(h.newId(), c, hello({ acct: "q".repeat(40) }), 0, member(5, 7));
    h.setInfo({ ...h.info!, level: 7, trophies: ["devil", "ashking"] });
    expect(c.last("hall")?.hall).toMatchObject({ level: 7, trophies: ["devil", "ashking"] });
    const r = new RealmRoom("ABCDEF");
    const g = new FakeConn();
    r.receive(r.newId(), g, hello(), 0, null);
    expect(g.last("welcome")).toBeDefined();
  });
});

describe("Trofeylar", () => {
  it("saqlanishdagi yengilgan bosslar: kalitlar, yutuqlar, Sardor va Kul qiroli", () => {
    expect(trophiesIn({})).toEqual([]);
    expect(
      trophiesIn({
        "pixel-rpg-realm-keys": JSON.stringify(["devil", "queen"]),
        "pixel-rpg-world3-won": "1",
        "pixel-rpg-realm": JSON.stringify({
          player: { titles: ["ashking"], quests: { ruins: { status: "done" } }, inv: [] },
        }),
      }),
    ).toEqual(["devil", "queen", "king", "warden", "ashking"]);
    expect(trophiesIn({ "pixel-rpg-achievements": JSON.stringify(["boss"]) })).toEqual(["devil"]);
  });

  it("a'zo saqlaganda va Kul qiroli g'alabasida gildiya trofeylari to'ldiriladi", async () => {
    const store = new AccountStore(memoryDb());
    const now = Date.now();
    const a = await store.login({ id: 1, username: "Trofey" }, "web", now);
    store.putSave(
      a.me.id,
      { base: 0, time: now, device: "web", data: { "pixel-rpg-gold": "900" } },
      now,
    );
    const r = store.guilds.create(
      store.player(a.me.id)!,
      {
        name: "Trofeychilar",
        tag: "TR",
        emblem: "0-1-3-0",
        mode: "open",
        lang: "uz",
        gold: 900,
        rid: "trophy-rid-01",
      },
      now,
    );
    if (!r.ok) throw new Error(r.error);
    expect(store.guilds.hallInfo(r.guild.id)?.trophies).toEqual([]);
    store.putSave(
      a.me.id,
      {
        base: 1,
        time: now + 1000,
        device: "web",
        data: { "pixel-rpg-gold": "400", "pixel-rpg-realm-keys": '["devil"]' },
      },
      now + 1000,
    );
    expect(store.guilds.hallInfo(r.guild.id)?.trophies).toEqual(["devil"]);
    store.guilds.life.raid([a.me.id], now + 2000);
    expect(store.guilds.hallInfo(r.guild.id)).toMatchObject({
      tag: "TR",
      level: 1,
      trophies: ["devil", "ashking"],
    });
  });
});

describe("Hafta g'olibi bayrog'i (vodiy maydoni)", () => {
  it("bayroq qishloq maydonida; bosilganda g'olib haqida yozuv, yana bosilsa yopiladi", () => {
    const d = loadRealmData();
    const flag = d.region.objects.find((o) => o.type === "guild" && o.what === "flag")!;
    const village = d.region.landmarks.find((l) => l.id === "village")!;
    expect(Math.hypot(flag.x - village.x, flag.y - village.y)).toBeLessThan(village.r);
    const sim = new RealmSim(d);
    const rp = sim.addPlayer("me", "knight");
    interactAt(sim, "me", flag.x, flag.y);
    expect(rp.ui).toMatchObject({ kind: "sign", title: "HAFTA G'OLIBI" });
    expect(rp.ui?.kind === "sign" && rp.ui.text[0]).toContain("hali bo'sh");
    sim.step([{ pid: "me", cmd: { type: "interact" } }]);
    expect(rp.ui).toBeNull();
    sim.champ = { name: "Tungi Bo'rilar", tag: "TB", xp: 4200 };
    interactAt(sim, "me", flag.x, flag.y);
    expect(rp.ui?.kind === "sign" && rp.ui.text[0]).toBe("[TB] Tungi Bo'rilar");
  });

  it("olam xonasi g'olibni welcome'da yuboradi va bayroq yozuvi serverdagi sim'dan", () => {
    const r = new RealmRoom("ABCDEF");
    r.setChamp({
      name: "Tungi Bo'rilar",
      tag: "TB",
      emblem: "2-5-6-11",
      xp: 4200,
      week: "2026-10-26",
    });
    const c = new FakeConn();
    r.receive(r.newId(), c, hello(), 0, null);
    expect(c.last("welcome")?.champ).toMatchObject({ tag: "TB", xp: 4200 });
    expect(r.sim.champ).toMatchObject({ tag: "TB" });
    // zalda bayroq yo'q — g'olib yuborilmaydi
    const h = new HallRoom(7);
    h.info = { id: 7, name: "Z", tag: "Z", emblem: "0-0-3-1", level: 1, trophies: [] };
    const hc = new FakeConn();
    h.receive(h.newId(), hc, hello({ acct: "w".repeat(40) }), 0, member(9, 7));
    expect(hc.last("welcome")?.champ).toBeUndefined();
  });
});
