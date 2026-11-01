// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Limiters, handleApi } from "./api";
import { memoryDb } from "./memory-db";
import { AccountStore } from "./store";
import { TEST_BOT_TOKEN } from "./testing";
import { XP_KEY, levelOf } from "../xp";
import { UNLOCKED_HEROES_KEY } from "@/game/save";
import { RealmRoom, type RoomConn } from "@/realm/net/room";
import { NET_VERSION, type ServerMsg, type SnapshotMsg } from "@/realm/net/protocol";
import { Rng } from "@/realm/rng";

const NOW = 1_780_000_000_000;

function setup() {
  const store = new AccountStore(memoryDb());
  const lim = new Limiters();
  const api = (op: string, body: unknown) =>
    handleApi(store, op, body, { now: NOW, ip: "x", botToken: TEST_BOT_TOKEN, bot: "B" }, lim);
  return { store, api };
}

describe("profile", () => {
  it("changes the nickname: rules, filter and uniqueness", async () => {
    const { store, api } = setup();
    const a = await store.login({ id: 1, username: "Ali_01" }, "web", NOW);
    const b = await store.login({ id: 2, username: "Vali_02" }, "web", NOW);
    expect(await api("profile", { token: a.token, nick: "Sardor_uz" })).toMatchObject({
      ok: true,
      me: { nick: "Sardor_uz" },
    });
    // band (katta-kichik harf farqsiz)
    expect(await api("profile", { token: b.token, nick: "sardor_UZ" })).toEqual({
      ok: false,
      error: "taken",
    });
    expect(await api("profile", { token: b.token, nick: "a b" })).toEqual({
      ok: false,
      error: "nick",
    });
    expect(await api("profile", { token: b.token, nick: "dalbayob" })).toEqual({
      ok: false,
      error: "nick",
    });
    // eski taxallus bo'shadi
    expect(await api("profile", { token: b.token, nick: "Ali_01" })).toMatchObject({ ok: true });
  });

  it("avatar must be an unlocked hero (from the cloud save)", async () => {
    const { store, api } = setup();
    const a = await store.login({ id: 3 }, "web", NOW);
    expect(await api("profile", { token: a.token, avatar: "mage" })).toMatchObject({
      ok: true,
      me: { avatar: "mage" },
    });
    // Paladin sotib olinmagan
    expect(await api("profile", { token: a.token, avatar: "paladin" })).toEqual({
      ok: false,
      error: "none",
    });
    store.putSave(
      store.playerByTg(3)!.id,
      {
        base: 0,
        time: NOW,
        device: "web",
        data: { [UNLOCKED_HEROES_KEY]: JSON.stringify(["paladin"]) },
      },
      NOW,
    );
    expect(await api("profile", { token: a.token, avatar: "paladin" })).toMatchObject({
      ok: true,
      me: { avatar: "paladin" },
    });
  });

  it("level comes from the cloud save XP", async () => {
    const { store, api } = setup();
    const a = await store.login({ id: 4 }, "web", NOW);
    const id = store.playerByTg(4)!.id;
    store.putSave(
      id,
      { base: 0, time: NOW, device: "web", data: { [XP_KEY]: JSON.stringify({ xp: 1700 }) } },
      NOW,
    );
    expect(await api("me", { token: a.token })).toMatchObject({
      ok: true,
      me: { xp: 1700, level: levelOf(1700) },
    });
  });
});

/** Soxta ulanish */
class Conn implements RoomConn {
  out: ServerMsg[] = [];
  send(s: string) {
    this.out.push(JSON.parse(s) as ServerMsg);
  }
  close() {}
}

describe("online name and level", () => {
  const hello = (tag: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      t: "hello",
      v: NET_VERSION,
      tag,
      hero: "knight",
      save: null,
      keys: [],
      ...extra,
    });

  it("logged-in players show nickname and level, guests stay Mehmon-1234", () => {
    const r = new Rng(3);
    const room = new RealmRoom("ABCDEF", { rand: () => r.next() });
    const a = new Conn();
    const b = new Conn();
    const ida = room.newId();
    const idb = room.newId();
    room.receive(ida, a, hello("1111", { acct: "x".repeat(43) }), 0, {
      id: 7,
      nick: "Sardor_uz",
      level: 12,
    });
    room.receive(idb, b, hello("2222"), 0);
    expect(a.out.find((m) => m.t === "welcome")).toMatchObject({ name: "Sardor_uz" });
    expect(b.out.find((m) => m.t === "welcome")).toMatchObject({ name: "Mehmon-2222" });
    room.step();
    room.step();
    // to'liq ro'yxat — b kirgandagi birinchi holatda (keyingilari — faqat o'zgarganlar)
    const all = b.out.filter((m): m is SnapshotMsg => m.t === "s").flatMap((m) => m.p ?? []);
    const pa = all.find((p) => p[0] === ida)!;
    expect(pa[2]).toBe("Sardor_uz");
    expect(pa[14]).toBe(12);
    const pb = all.find((p) => p[0] === idb)!;
    expect(pb[14]).toBe(0);
  });

  it("'join friend' lands next to that exact account", () => {
    const r = new Rng(4);
    const room = new RealmRoom("ABCDEF", { rand: () => r.next() });
    const first = room.newId();
    room.receive(first, new Conn(), hello("1000"), 0);
    const friend = room.newId();
    room.receive(friend, new Conn(), hello("2000"), 0, { id: 42, nick: "Dost", level: 3 });
    // do'stni boshqa joyga
    const fp = room.sim.players.get(friend)!;
    fp.p.x += 300;
    fp.p.y += 40;
    const me = room.newId();
    room.receive(me, new Conn(), hello("3000", { near: true, nearAcc: 42 }), 0);
    const mp = room.sim.players.get(me)!;
    const d = Math.hypot(mp.p.x - fp.p.x, mp.p.y - fp.p.y);
    expect(d).toBeLessThan(110);
  });
});

describe("account deletion", () => {
  it("removes everything on the server; the device keeps playing as a guest", async () => {
    const { store, api } = setup();
    const a = await store.login({ id: 50, username: "Ketuvchi" }, "web", NOW);
    const b = await store.login({ id: 51, username: "Qoluvchi" }, "web", NOW);
    const ida = store.playerByTg(50)!.id;
    const idb = store.playerByTg(51)!.id;
    store.putSave(ida, { base: 0, time: NOW, device: "web", data: { "pixel-rpg-gold": "5" } }, NOW);
    store.putSave(
      ida,
      { base: 1, time: NOW + 1, device: "web", dev: "otherdev1", data: {} },
      NOW + 1,
    );
    await api("friends/add", { token: a.token, query: "Qoluvchi" });
    await api("friends/answer", { token: b.token, id: ida, accept: true });
    await api("friends/msg", { token: b.token, to: ida, phrase: 0 });
    await api("presence", { token: a.token, place: "menu" });
    await api("scores/submit", {
      token: a.token,
      mode: "world",
      hero: "knight",
      score: 1000,
      wave: 3,
      time: 120,
      won: false,
    });
    // tasdiqsiz — so'rov rad
    expect(await api("account/delete", { token: a.token })).toEqual({ ok: false, error: "bad" });
    expect(await api("account/delete", { token: a.token, confirm: true })).toEqual({ ok: true });
    const count = (q: string, ...b: (number | string)[]) =>
      Number(store.db.exec<{ n: number }>(q, ...b).toArray()[0]!.n);
    expect(store.playerByTg(50)).toBeNull();
    expect(count("SELECT COUNT(*) AS n FROM sessions WHERE player = ?", ida)).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM saves WHERE player = ?", ida)).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM backups WHERE player = ?", ida)).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM friends WHERE a = ? OR b = ?", ida, ida)).toBe(0);
    expect(
      count("SELECT COUNT(*) AS n FROM messages WHERE sender = ? OR receiver = ?", ida, ida),
    ).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM presence WHERE player = ?", ida)).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM scores WHERE player = ?", ida)).toBe(0);
    // sessiya ham ishlamaydi; ikkinchi o'yinchining do'stlar ro'yxati bo'sh
    expect(await api("me", { token: a.token })).toEqual({ ok: false, error: "auth" });
    expect(await api("friends/list", { token: b.token })).toMatchObject({ friends: [] });
    // qayta kirsa — yangi, bo'sh akkaunt
    const again = await store.login({ id: 50, username: "Ketuvchi" }, "web", NOW);
    expect(again.created).toBe(true);
    expect(store.getSave(again.me.id)).toBeNull();
    expect(idb).toBeGreaterThan(0);
  });
});
