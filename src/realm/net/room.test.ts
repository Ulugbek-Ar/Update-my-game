// @vitest-environment node
import { describe, expect, it } from "vitest";
import { RealmRoom, STRIKE_LIMIT, type RoomConn } from "./room";
import { Lobby, BUSY_AT } from "./lobby";
import {
  NET_VERSION,
  ROOM_CAP,
  makeRoomCode,
  normalizeRoomCode,
  parseClientMsg,
  type HelloMsg,
  type ServerMsg,
  type SnapshotMsg,
} from "./protocol";
import { Rng } from "../rng";

/** Soxta ulanish: yuborilgan xabarlarni yig'adi */
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
  snaps() {
    return this.out.filter((m): m is SnapshotMsg => m.t === "s");
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
  const r = new Rng(5);
  return new RealmRoom("ABCDEF", { rand: () => r.next() });
}

function join(rm: RealmRoom, tag: string, now = 0, extra: Partial<HelloMsg> = {}) {
  const c = new FakeConn();
  const id = rm.newId();
  rm.receive(id, c, hello(tag, extra), now);
  return { c, id };
}

describe("Protokol sxemalari", () => {
  it("accepts valid client messages and rejects malformed ones", () => {
    expect(parseClientMsg(hello("1234"))?.t).toBe("hello");
    expect(parseClientMsg('{"t":"cmd","s":3,"c":[{"type":"move","x":1,"y":-1}]}')?.t).toBe("cmd");
    expect(parseClientMsg('{"t":"ping","id":7}')).toEqual({ t: "ping", id: 7 });
    expect(parseClientMsg('{"t":"chat","p":2}')).toEqual({ t: "chat", p: 2 });
    for (const bad of [
      "salom",
      "{}",
      '{"t":"cmd","s":1,"c":[]}',
      // tezlikni klient belgilay olmaydi: o'q qiymati -1..1
      '{"t":"cmd","s":1,"c":[{"type":"move","x":5,"y":0}]}',
      '{"t":"cmd","s":1,"c":[{"type":"teleport","x":0,"y":0}]}',
      '{"t":"cmd","s":1,"c":[{"type":"use","slot":9}]}',
      '{"t":"cmd","s":1,"c":[{"type":"buy","item":"<script>"}]}',
      '{"t":"chat","p":9}',
      '{"t":"chat","text":"erkin matn"}',
      hello("12345"),
      hello("1234", { hero: "dragon" as never }),
      42,
      "x".repeat(20_000),
    ])
      expect(parseClientMsg(bad)).toBeNull();
  });

  it("room codes are 6 unambiguous characters", () => {
    const r = new Rng(1);
    for (let i = 0; i < 50; i++) {
      const c = makeRoomCode(() => r.next());
      expect(c).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      expect(normalizeRoomCode(c.toLowerCase())).toBe(c);
    }
    expect(normalizeRoomCode(" abc-def ")).toBe("ABCDEF");
    expect(normalizeRoomCode("ABC0EF")).toBeNull();
    expect(normalizeRoomCode("ABCDE")).toBeNull();
    expect(normalizeRoomCode(null)).toBeNull();
  });
});

describe("RealmRoom", () => {
  it("two players in one room see each other", () => {
    const rm = room();
    const a = join(rm, "1111");
    const b = join(rm, "2222", 0, { hero: "mage" });
    expect(a.c.last("welcome")).toMatchObject({ name: "Mehmon-1111", code: "ABCDEF", n: 1 });
    expect(b.c.last("welcome")).toMatchObject({ name: "Mehmon-2222", n: 2 });
    rm.step();
    rm.step();
    const names = (c: FakeConn) => new Set(c.snaps().flatMap((s) => (s.p ?? []).map((p) => p[2])));
    expect(names(a.c)).toEqual(new Set(["Mehmon-1111", "Mehmon-2222"]));
    expect(names(b.c)).toEqual(new Set(["Mehmon-1111", "Mehmon-2222"]));
    expect(a.c.snaps().at(-1)!.n).toBe(2);
    // B harakatlansa — A buni ko'radi (faqat o'zgargan o'yinchi yuboriladi)
    rm.receive(b.id, b.c, '{"t":"cmd","s":1,"c":[{"type":"move","x":1,"y":0}]}', 0.1);
    const x0 = rm.sim.players.get(b.id)!.p.x;
    for (let i = 0; i < 10; i++) rm.step();
    const x1 = rm.sim.players.get(b.id)!.p.x;
    expect(x1).toBeGreaterThan(x0 + 30);
    const seen = a.c
      .snaps()
      .flatMap((s) => s.p ?? [])
      .filter((p) => p[0] === b.id);
    expect(seen.at(-1)![3]).toBeCloseTo(x1, 0);
    // A turibdi — uning yozuvi oxirgi holatlarda takrorlanmaydi (delta)
    expect(
      a.c
        .snaps()
        .at(-1)!
        .p?.some((p) => p[0] === a.id),
    ).toBeFalsy();
    // chiqib ketgan o'yinchi boshqalarda o'chadi
    rm.leave(b.id);
    rm.step();
    rm.step();
    expect(a.c.snaps().at(-1)!.pr).toEqual([b.id]);
  });

  it("speed and damage are computed on the server", () => {
    const rm = room();
    const a = join(rm, "1111");
    // klient o'z tezligi/zararini yubora olmaydi; saqlanishdagi g'alati joy xarita ichiga qisiladi
    const b = join(rm, "2222", 0, {
      save: {
        hero: "knight",
        x: 999_99,
        y: -50,
        hp: 3,
        gold: 10,
        inv: [{ item: "nosuchitem", n: 5 }, { item: "bread", n: 999 }, null],
        quests: { fake: { status: "done", step: 0, progress: 0 } },
        secrets: [],
        fragments: [],
        opened: [],
        torchStep: 0,
        landmarks: [],
        kills: 0,
        explored: "",
        starNight: -1,
      },
    });
    const pa = rm.sim.players.get(a.id)!.p,
      pb = rm.sim.players.get(b.id)!;
    expect(pb.p.speed).toBe(pa.speed);
    expect(pb.p.damage).toBe(pa.damage);
    expect(pb.inv[0]).toBeNull();
    expect(pb.inv[1]!.n).toBeLessThanOrEqual(rm.sim.data.items["bread"]!.stack);
    expect(pb.quests["fake"]).toBeUndefined();
    expect(pb.p.x).toBeLessThan(rm.sim.map.w * 16);
    expect(pb.p.y).toBeGreaterThan(0);
  });

  it("only the owner receives private state (inventory, quests)", () => {
    const rm = room();
    const a = join(rm, "1111");
    const b = join(rm, "2222");
    rm.sim.addItem(rm.sim.players.get(a.id)!, "potion", 2);
    rm.step();
    rm.step();
    expect(
      a.c
        .snaps()
        .at(-1)!
        .me?.inv.some((s) => s?.item === "potion"),
    ).toBe(true);
    expect(JSON.stringify(b.c.out)).not.toContain("potion");
  });

  it("is capped at 8 players", () => {
    const rm = room();
    for (let i = 0; i < ROOM_CAP; i++) join(rm, String(1000 + i));
    const extra = join(rm, "9999");
    expect(extra.c.last("err")).toEqual({ t: "err", reason: "full" });
    expect(extra.c.closed).toBe("full");
    expect(rm.size).toBe(ROOM_CAP);
  });

  it("rejects an old protocol version and a busy server", () => {
    const rm = room();
    expect(join(rm, "1111", 0, { v: NET_VERSION + 1 }).c.last("err")?.reason).toBe("version");
    rm.busy = true;
    expect(join(rm, "2222").c.last("err")?.reason).toBe("busy");
    expect(rm.size).toBe(0);
  });

  it("rate limit drops flood and finally disconnects", () => {
    const rm = room();
    const a = join(rm, "1111");
    // me'yorida: 10 Hz buyruq — hech narsa tashlanmaydi
    for (let i = 0; i < 50; i++) rm.receive(a.id, a.c, `{"t":"ping","id":${i}}`, 1 + i * 0.1);
    expect(a.c.out.filter((m) => m.t === "pong")).toHaveLength(50);
    expect(a.c.closed).toBeNull();
    // bir lahzada yuzlab xabar: chelakdan oshgani tashlanadi, keyin ulanish uziladi
    for (let i = 0; i < 200; i++) rm.receive(a.id, a.c, `{"t":"ping","id":${i}}`, 10);
    const pongs = a.c.out.filter((m) => m.t === "pong").length;
    expect(pongs).toBeLessThan(50 + 25);
    expect(a.c.closed).toBe("rate");
    expect(rm.size).toBe(0);
  });

  it("invalid messages are rejected and repeated garbage disconnects", () => {
    const rm = room();
    const a = join(rm, "1111");
    const n = Math.ceil(STRIKE_LIMIT / 5);
    for (let i = 0; i < n - 1; i++) rm.receive(a.id, a.c, "{bad json", 1 + i);
    expect(a.c.closed).toBeNull();
    rm.receive(a.id, a.c, '{"t":"cmd","s":1,"c":[{"type":"move","x":99,"y":0}]}', 50);
    expect(a.c.closed).toBe("bad");
    // birinchi xabar salom bo'lmasa — qayta salomlashish so'raladi (server qayta ishga tushgan)
    const c = new FakeConn();
    rm.receive("zzz", c, '{"t":"ping","id":1}', 0);
    expect(c.last("rejoin")).toEqual({ t: "rejoin" });
  });

  it("chat sends only ready phrases, at most one per 1.5s", () => {
    const rm = room();
    const a = join(rm, "1111");
    const b = join(rm, "2222");
    rm.receive(a.id, a.c, '{"t":"chat","p":0}', 1);
    rm.receive(a.id, a.c, '{"t":"chat","p":1}', 1.5);
    expect(b.c.out.filter((m) => m.t === "chat")).toEqual([
      { t: "chat", pid: a.id, name: "Mehmon-1111", p: 0 },
    ]);
  });

  it("an invited player lands next to the room host", () => {
    const rm = room();
    const a = join(rm, "1111");
    const host = rm.sim.players.get(a.id)!.p;
    host.x += 200;
    const b = join(rm, "2222", 0, { near: true });
    const g = rm.sim.players.get(b.id)!.p;
    expect(Math.hypot(g.x - host.x, g.y - host.y)).toBeLessThan(80);
    // ikkinchisi birinchisining ustiga emas
    const c = join(rm, "3333", 0, { near: true });
    const h = rm.sim.players.get(c.id)!.p;
    expect(Math.abs(h.x - g.x) >= 44 || Math.abs(h.y - g.y) >= 24).toBe(true);
  });

  it("acks command batches so the client can reconcile its prediction", () => {
    const rm = room();
    const a = join(rm, "1111");
    rm.receive(a.id, a.c, '{"t":"cmd","s":7,"c":[{"type":"move","x":0,"y":1}]}', 0);
    rm.step();
    rm.step();
    rm.step();
    const s = a.c.snaps().at(-1)!;
    expect(s.ack).toBe(7);
    expect(s.at).toBe(1);
  });
});

describe("Server muhiti (DOM'siz, Cloudflare Worker kabi)", () => {
  it("all heroes fight mobs, die and respawn without touching the DOM", () => {
    expect(typeof window).toBe("undefined");
    const rm = room();
    const heroes = ["knight", "mage", "hunter", "gunner"] as const;
    const ids = heroes.map((hero, i) => join(rm, String(1000 + i), 0, { hero }).id);
    // to'ng'izlar o'tlog'iga
    for (const id of ids) {
      const p = rm.sim.players.get(id)!.p;
      p.x = 112 * 16 + 8;
      p.y = 64 * 16 + 8;
    }
    const r = new Rng(9);
    for (let t = 0; t < 600; t++) {
      for (const [i, id] of ids.entries()) {
        const c = rm.members.get(id)!.conn;
        if (t % 6 === i)
          rm.receive(
            id,
            c,
            JSON.stringify({
              t: "cmd",
              s: t + 1,
              c: [
                { type: "move", x: r.int(3) - 1, y: r.int(3) - 1 },
                { type: "attack", down: r.next() < 0.5 },
                { type: "ability", down: r.next() < 0.2 },
              ],
            }),
            t * 0.05,
          );
      }
      rm.step();
    }
    expect(rm.sim.tick).toBe(600);
    expect(rm.size).toBe(4);
  });
});

describe("Lobbi", () => {
  it("fills a room up to 8, then opens the next one", () => {
    const r = new Rng(3);
    const lb = new Lobby(() => r.next());
    const codes = Array.from({ length: ROOM_CAP + 1 }, () => {
      const j = lb.assign(1000, null);
      if (!j.ok) throw new Error(j.reason);
      return j.code;
    });
    expect(new Set(codes.slice(0, ROOM_CAP)).size).toBe(1);
    expect(codes[ROOM_CAP]).not.toBe(codes[0]);
    // kod bilan to'la xonaga — "full"
    expect(lb.assign(1000, codes[0]!)).toEqual({ ok: false, reason: "full" });
    // kimdir chiqdi — yana joy bor
    lb.report(2000, codes[0]!, ROOM_CAP - 1, 0);
    expect(lb.assign(2000, codes[0]!)).toEqual({ ok: true, code: codes[0] });
    expect(lb.stats(2000)).toMatchObject({ rooms: 2, online: ROOM_CAP + 1 });
  });

  it("forgets rooms that stopped reporting, and empty rooms", () => {
    const lb = new Lobby();
    const j = lb.assign(0, null);
    expect(j.ok).toBe(true);
    expect(lb.stats(10 * 60_000).rooms).toBe(0);
    lb.report(0, "ABCDEF", 3, 0);
    lb.report(1, "ABCDEF", 0, 0);
    expect(lb.rooms.has("ABCDEF")).toBe(false);
  });

  it("refuses new connections near the daily limit and resets at UTC midnight", () => {
    const lb = new Lobby();
    const day = Date.UTC(2026, 9, 30, 12);
    lb.report(day, "ABCDEF", 2, BUSY_AT);
    expect(lb.assign(day, null)).toEqual({ ok: false, reason: "busy" });
    expect(lb.report(day, "ABCDEF", 2, 0).busy).toBe(true);
    const next = Date.UTC(2026, 9, 31, 0, 1);
    expect(lb.assign(next, null).ok).toBe(true);
    expect(lb.stats(next).used).toBeLessThan(10);
  });

  it("also refuses new connections when room run time nears the free Durable Object limit", () => {
    const lb = new Lobby();
    const day = Date.UTC(2026, 9, 30, 12);
    // 128 MB xona ~25 soat ishladi
    lb.report(day, "ABCDEF", 3, 0, 25 * 3600);
    expect(lb.stats(day).gbs).toBeGreaterThan(11_000);
    expect(lb.assign(day, null).ok).toBe(true);
    lb.report(day, "ABCDEF", 3, 0, 3 * 3600);
    expect(lb.assign(day, null)).toEqual({ ok: false, reason: "busy" });
  });
});
