import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealmClient } from "../client";
import { RealmSim, TICK_DT, tileCenter } from "../sim";
import { loadRealmData } from "../data";
import { Loopback } from "./loopback";
import { RealmMirror } from "./mirror";
import { Predictor } from "./predict";
import { NetSession, MAX_RETRIES, type NetDeps } from "./session";
import { HelloSchema, NET_VERSION, ROOM_CAP, type HelloMsg, type ServerMsg } from "./protocol";

const data = loadRealmData();
const MS = TICK_DT * 1000;

/** Soxta canvas: RealmClient konstruktori faqat 2d kontekst so'raydi (chizish testda yo'q) */
const canvas = () =>
  ({ getContext: () => ({ imageSmoothingEnabled: true }) }) as unknown as HTMLCanvasElement;

function hello(sim: RealmSim, pid: string, tag: string) {
  return (near: boolean): HelloMsg => ({
    t: "hello",
    v: NET_VERSION,
    tag,
    hero: "knight",
    save: sim.savePlayer(pid),
    keys: [],
    near,
  });
}

/** Klient sessiyasi + ko'zgu (RealmClient'siz, DOM'siz) */
function peer(lb: Loopback, tag: string, code: string | null = null) {
  const local = new RealmSim(data);
  local.addPlayer("me", "knight");
  const out: { mirror: RealmMirror | null; net: NetSession; msgs: ServerMsg[] } = {
    mirror: null,
    net: new NetSession(lb.deps(), { code, hello: hello(local, "me", tag) }),
    msgs: [],
  };
  out.net.onMessage = (m) => {
    out.msgs.push(m);
    if (m.t === "welcome")
      out.mirror = new RealmMirror(data, m.pid, "knight", local.savePlayer("me"), m.tick);
    else if (m.t === "s") out.mirror?.apply(m, Date.now() / 1000);
  };
  out.net.start();
  return out;
}

/** Server 20 Hz tick qiladi, vaqt oldinga suriladi */
async function run(lb: Loopback, ticks: number, each?: () => void) {
  for (let i = 0; i < ticks; i++) {
    lb.step();
    each?.();
    await vi.advanceTimersByTimeAsync(MS);
  }
}

beforeEach(() => {
  vi.useFakeTimers({ now: 1_000_000 });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Onlayn klient", () => {
  it("a real progress save passes the hello schema", () => {
    const s = new RealmSim(data);
    const rp = s.addPlayer("me", "gunner");
    s.addItem(rp, "potion", 2);
    s.startQuest(rp, Object.keys(data.quests)[0]!);
    rp.secrets.push("s-wall");
    rp.opened.push("chest-river");
    rp.landmarks.push("village");
    const msg = hello(s, "me", "1234")(false);
    expect(HelloSchema.safeParse(JSON.parse(JSON.stringify(msg))).success).toBe(true);
  });

  it("two clients in one room see each other with names and HP", async () => {
    const lb = new Loopback(() => Date.now());
    const a = peer(lb, "1111");
    const b = peer(lb, "2222");
    await vi.advanceTimersByTimeAsync(10);
    expect(a.net.status).toBe("online");
    expect(b.net.status).toBe("online");
    expect(a.net.code).toBe(b.net.code);
    // B o'ngga yuradi
    const bid = b.net.pid;
    b.net.sendCmds(1, [{ type: "move", x: 1, y: 0 }]);
    await run(lb, 30);
    const ma = a.mirror!;
    ma.update(Date.now() / 1000, TICK_DT);
    const seen = ma.sim.players.get(bid);
    expect(seen).toBeDefined();
    expect(ma.names.get(bid)).toBe("Mehmon-2222");
    const real = lb.room(a.net.code!).sim.players.get(bid)!.p;
    // interpolatsiya ~150 ms orqada: 90 px/s * 0.15 s ~ 14 px
    expect(Math.abs(seen!.p.x - real.x)).toBeLessThan(20);
    expect(seen!.p.hp).toBe(real.hp);
    expect(ma.n).toBe(2);
    // B uchun A ham ko'rinadi
    b.mirror!.update(Date.now() / 1000, TICK_DT);
    expect(b.mirror!.sim.players.has(a.net.pid)).toBe(true);
  });

  it("goes offline after 3 failed reconnects when the server dies", async () => {
    const lb = new Loopback(() => Date.now());
    const a = peer(lb, "1111");
    const statuses: string[] = [];
    a.net.onStatus = (s) => statuses.push(s);
    await vi.advanceTimersByTimeAsync(10);
    expect(a.net.status).toBe("online");
    lb.crash();
    await vi.advanceTimersByTimeAsync(10);
    expect(a.net.status).toBe("reconnecting");
    await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 100);
    expect(a.net.status).toBe("offline");
    expect(a.net.retries).toBe(MAX_RETRIES);
    expect(statuses).toEqual(["online", "reconnecting", "offline"]);
  });

  it("reconnects if the server comes back during retries", async () => {
    const lb = new Loopback(() => Date.now());
    const a = peer(lb, "1111");
    await vi.advanceTimersByTimeAsync(10);
    const code = a.net.code;
    lb.crash();
    await vi.advanceTimersByTimeAsync(1500);
    lb.down = false;
    await vi.advanceTimersByTimeAsync(2100);
    expect(a.net.status).toBe("online");
    // aynan o'sha xonaga qaytadi
    expect(a.net.code).toBe(code);
  });

  it("busy server: no retries, offline with a polite message", async () => {
    let calls = 0;
    const deps: NetDeps = {
      join: async () => (calls++, { ok: false, reason: "busy" }),
      open: () => {
        throw new Error("chaqirilmasligi kerak");
      },
      now: () => Date.now(),
    };
    const s = new NetSession(deps, { code: null, hello: () => ({}) as HelloMsg });
    s.start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(s.status).toBe("offline");
    expect(calls).toBe(1);
    expect(s.notice).toBe("Server band, keyinroq urinib ko'ring");
  });

  it("a full room moves players to the next room; an invite to a full room says so", async () => {
    const lb = new Loopback(() => Date.now());
    const peers = Array.from({ length: ROOM_CAP }, (_, i) => peer(lb, String(1000 + i)));
    await vi.advanceTimersByTimeAsync(10);
    const first = peers[0]!.net.code;
    expect(peers.every((p) => p.net.code === first)).toBe(true);
    const ninth = peer(lb, "1999");
    await vi.advanceTimersByTimeAsync(10);
    expect(ninth.net.status).toBe("online");
    expect(ninth.net.code).not.toBe(first);
    // do'st havolasi bilan to'la xonaga: xabar va boshqa xona
    const invited = peer(lb, "2000", first);
    await vi.advanceTimersByTimeAsync(10);
    expect(invited.net.status).toBe("online");
    expect(invited.net.code).not.toBe(first);
    expect(invited.net.notice).toContain("Xona to'la");
  });
});

describe("RealmClient onlayn/oflayn", () => {
  function client(lb: Loopback) {
    const c = new RealmClient(canvas(), "knight");
    c.connect(lb.deps(), null);
    return c;
  }
  const tick = (c: RealmClient) => (c as unknown as { tick(): void }).tick();

  it("prediction stays in sync with the server at 200 ms ping", async () => {
    const lb = new Loopback(() => Date.now());
    lb.latency = 100;
    const c = client(lb);
    // /join, ochilish, salom va welcome: 3 x 100 ms
    await vi.advanceTimersByTimeAsync(400);
    expect(c.online).toBe(true);
    // qishloqdagi ochiq joy: o'ngga va pastga yuramiz
    const p0 = c.me.p;
    p0.x = c.me.px = tileCenter(47);
    p0.y = c.me.py = tileCenter(97);
    const room = lb.room(c.net!.code!);
    const srv = room.sim.players.get(c.pid)!.p;
    srv.x = p0.x;
    srv.y = p0.y;
    let maxErr = 0;
    const fix = vi.spyOn(Predictor.prototype, "correction");
    for (let i = 0; i < 80; i++) {
      // 0-tick'da klient joriy yo'nalishni (sinxron) yuboradi
      if (i === 2) c.send({ type: "move", x: 1, y: 0 });
      if (i === 40) c.send({ type: "move", x: 0, y: 1 });
      if (i === 70) c.send({ type: "move", x: 0, y: 0 });
      lb.step();
      tick(c);
      await vi.advanceTimersByTimeAsync(MS);
    }
    // bir xil kod — yurishda tuzatish deyarli kerak bo'lmaydi
    const fixes = fix.mock.results.filter((r) => r.value !== null).map((r) => r.value);
    expect(fixes).toEqual([]);
    fix.mockRestore();
    // bosilgan zahoti o'zida yuradi (serverni kutmaydi)
    expect(c.me.p.x).toBeGreaterThan(tileCenter(47) + 40);
    for (let i = 0; i < 20; i++) {
      lb.step();
      tick(c);
      await vi.advanceTimersByTimeAsync(MS);
      maxErr = Math.max(maxErr, Math.hypot(c.me.p.x - srv.x, c.me.p.y - srv.y));
    }
    // to'xtagach klient va server bir joyda
    expect(maxErr).toBeLessThan(1);
  });

  it("server knockback and damage reach the predicted player", async () => {
    const lb = new Loopback(() => Date.now());
    const c = client(lb);
    await vi.advanceTimersByTimeAsync(10);
    const room = lb.room(c.net!.code!);
    const srv = room.sim.players.get(c.pid)!.p;
    const hp = srv.hp;
    srv.takeHit(1, srv.x - 10, srv.y, 160);
    for (let i = 0; i < 20; i++) {
      lb.step();
      tick(c);
      await vi.advanceTimersByTimeAsync(MS);
    }
    expect(c.me.p.hp).toBe(hp - 1);
    expect(Math.abs(c.me.p.x - srv.x)).toBeLessThan(1);
  });

  it("disconnect switches to offline without losing progress", async () => {
    const lb = new Loopback(() => Date.now());
    const c = client(lb);
    await vi.advanceTimersByTimeAsync(10);
    const room = lb.room(c.net!.code!);
    const srvRp = room.sim.players.get(c.pid)!;
    room.sim.addItem(srvRp, "potion", 2);
    srvRp.gold += 25;
    await run(lb, 4, () => tick(c));
    expect(c.me.inv.some((s) => s?.item === "potion")).toBe(true);
    const gold = c.me.gold;
    lb.crash();
    await vi.advanceTimersByTimeAsync(10);
    // darhol oflayn olam (mahalliy RealmSim), qayta ulanish fonda
    expect(c.online).toBe(false);
    expect(c.view.net.mode).toBe("connecting");
    expect(c.me.inv.some((s) => s?.item === "potion")).toBe(true);
    expect(c.me.gold).toBe(gold);
    await vi.advanceTimersByTimeAsync(8000);
    expect(c.view.net.mode).toBe("offline");
    expect(c.view.toasts.some((t) => t.text === "Oflayn rejim")).toBe(true);
    // oflayn o'yin davom etadi
    const tick0 = c.sim.tick;
    tick(c);
    expect(c.sim.tick).toBe(tick0 + 1);
  });
});
