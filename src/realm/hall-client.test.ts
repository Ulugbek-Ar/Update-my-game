/**
 * Gildiya zali (klient): vodiydagi darvoza faqat kirgan va gildiyadagi o'yinchini o'tkazadi,
 * zalda olam saqlanishi o'zgarmaydi, a'zo bo'lmasa server rad etadi va klient vodiyga qaytadi.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealmClient, loadRealmSave } from "./client";
import { loadHallData, loadRealmData } from "./data";
import { tileCenter } from "./sim";
import { Loopback } from "./net/loopback";
import { HallRoom } from "./net/hall";
import { hallCode, type NetIdent } from "./net/protocol";
import { GUILD_CACHE_KEY } from "@/account/keys";

const canvas = () =>
  ({ getContext: () => ({ imageSmoothingEnabled: true }) }) as unknown as HTMLCanvasElement;
const tick = (c: RealmClient) => (c as unknown as { tick(): void }).tick();

beforeEach(() => {
  vi.useFakeTimers({ now: 1_000_000 });
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

/** Vodiydagi gildiya darvozasi oldida "interact" */
function pressGate(c: RealmClient) {
  const gate = loadRealmData().region.objects.find((o) => o.type === "guild" && o.what === "gate")!;
  const p = c.me.p;
  p.x = c.me.px = tileCenter(gate.x);
  p.y = c.me.py = tileCenter(gate.y) + 16;
  p.fx = 0;
  p.fy = -1;
  c.send({ type: "interact" });
  tick(c);
}

describe("Gildiya darvozasi va zal (klient)", () => {
  it("kirmagan yoki gildiyasiz o'yinchi darvozadan o'tmaydi (xabar chiqadi)", () => {
    const c = new RealmClient(canvas(), "knight");
    let entered: number | null = null;
    c.onEnterHall = (g) => {
      entered = g;
    };
    pressGate(c);
    expect(entered).toBeNull();
    expect(c.view.toasts.at(-1)?.text).toContain("Telegram");
  });

  it("zal klienti: zal xaritasi, eshik oldida, olam saqlanishiga yozmaydi; eshik — vodiyga", () => {
    const valley = new RealmClient(canvas(), "knight");
    const x = (valley.me.p.x = valley.me.px = tileCenter(47));
    valley.save();
    const before = loadRealmSave();
    expect(before?.player.x).toBe(x);
    const c = new RealmClient(canvas(), "knight", { hall: { guild: 7 } });
    expect(c.sim.region.id).toBe("guildhall");
    const [sx, sy] = loadHallData().region.spawn;
    expect([c.me.p.x, c.me.p.y]).toEqual([tileCenter(sx), tileCenter(sy)]);
    expect(c.view.panel).toBe("none");
    c.save();
    expect(loadRealmSave()).toEqual(before);
    let left: string | null | undefined;
    c.onLeaveHall = (n) => {
      left = n;
    };
    const exit = c.sim.region.objects.find((o) => o.type === "guild" && o.what === "exit")!;
    c.me.p.x = c.me.px = tileCenter(exit.x);
    c.me.p.y = c.me.py = tileCenter(exit.y) - 16;
    c.me.p.fx = 0;
    c.me.p.fy = 1;
    c.send({ type: "interact" });
    tick(c);
    expect(left).toBeNull();
  });

  it("a'zo emas — server rad etadi, klient sabab bilan vodiyga qaytadi; a'zo — onlayn zalda", async () => {
    // qurilmadagi gildiya qisqachasi (zal bezagi ulanguncha shundan)
    localStorage.setItem(
      GUILD_CACHE_KEY,
      JSON.stringify({
        id: 7,
        name: "Qal'a",
        tag: "PQ",
        emblem: "0-0-3-1",
        level: 3,
        role: "member",
      }),
    );
    const lb = new Loopback(() => Date.now());
    lb.makeRoom = () => new HallRoom(7);
    const idents = new Map<string, NetIdent>([
      ["guest-token-".padEnd(40, "g"), { id: 2, nick: "Begona", level: 1 }],
      [
        "member-token-".padEnd(40, "m"),
        { id: 3, nick: "Azo", level: 4, guild: { id: 7, tag: "PQ", emblem: "0-0-3-1" } },
      ],
    ]);
    lb.identify = (t) => idents.get(t) ?? null;
    const enter = (token: string) => {
      const c = new RealmClient(canvas(), "knight", { hall: { guild: 7 } });
      // salomlashuvdagi akkaunt tokeni (o'yinda account.sessionToken)
      const h = (c as unknown as { hello(near: boolean): object }).hello.bind(c);
      (c as unknown as { hello(near: boolean): object }).hello = (near) => ({
        ...h(near),
        acct: token,
      });
      return c;
    };
    const guest = enter("guest-token-".padEnd(40, "g"));
    expect(guest.view.hall).toMatchObject({ tag: "PQ", level: 3 });
    let left: string | null | undefined;
    guest.onLeaveHall = (n) => {
      left = n;
    };
    guest.connect(lb.deps(), hallCode(7));
    await vi.advanceTimersByTimeAsync(50);
    expect(left).toContain("a'zolari");
    const m = enter("member-token-".padEnd(40, "m"));
    m.connect(lb.deps(), hallCode(7));
    await vi.advanceTimersByTimeAsync(50);
    expect(m.online).toBe(true);
    expect(m.net?.code).toBe("G7");
    expect(lb.room("G7").size).toBe(1);
  });
});
