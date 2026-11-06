// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTransport } from "./api";
import { AccountManager } from "./account";
import { CloudSync } from "./cloud";
import { ExpeditionManager } from "./expedition";
import {
  EXP_CHEST_ITEMS,
  EXP_GOLD_PER_HOUR,
  EXP_MAX_MS,
  EXP_XP_PER_HOUR,
  advanceLocal,
  expBonus,
  expeditionReward,
} from "./expeditionRules";
import { EXP_KEY } from "./keys";
import { MemoryStorage, installStorage, testServer } from "./server/testing";
import { XP_KEY, xpFromRaw } from "./xp";
import { GOLD_KEY } from "@/game/shop";
import { REALM_INBOX_KEY } from "@/game/realmLink";

const H = 3_600_000;
const MIN = 60_000;
const g = globalThis as { localStorage?: Storage };
const base = { level: 1, shop: 0, roll: 0.99, pick: 0 };

describe("expedition reward (rules)", () => {
  it("about 15% of one World-1 run per hour; stops at 8 hours", () => {
    const one = expeditionReward({ ...base, ms: H });
    expect(one).toMatchObject({ minutes: 60, gold: EXP_GOLD_PER_HOUR, xp: EXP_XP_PER_HOUR });
    // 1-dunyo o'yini ≈ 67 oltin va 100 XP — soatiga ~15%
    expect(one.gold / 67).toBeGreaterThan(0.12);
    expect(one.gold / 67).toBeLessThan(0.18);
    const eight = expeditionReward({ ...base, ms: 8 * H });
    expect(eight).toMatchObject({ minutes: 480, gold: 80, xp: 120 });
    // 20 soat — baribir 8 soatlik
    expect(expeditionReward({ ...base, ms: 20 * H })).toEqual(eight);
    expect(expeditionReward({ ...base, ms: 365 * 24 * H })).toEqual(eight);
  });

  it("less than 10 minutes gives nothing; negative time gives nothing", () => {
    expect(expeditionReward({ ...base, ms: 9 * MIN })).toMatchObject({ gold: 0, xp: 0 });
    expect(expeditionReward({ ...base, ms: -5 * H })).toMatchObject({ minutes: 0, gold: 0 });
  });

  it("level and shop upgrades raise it a little (at most +40%)", () => {
    expect(expBonus(1, 0)).toBe(1);
    expect(expBonus(50, 10)).toBeCloseTo(1.4);
    const top = expeditionReward({ ...base, ms: 8 * H, level: 50, shop: 10 });
    expect(top.gold).toBe(112);
    expect(top.xp).toBe(168);
  });

  it("chest: ~6% per hour, a rare realm item", () => {
    expect(expeditionReward({ ...base, ms: 8 * H, roll: 0.47, pick: 0.6 }).chest).toBe(
      EXP_CHEST_ITEMS[2],
    );
    expect(expeditionReward({ ...base, ms: 8 * H, roll: 0.49 }).chest).toBeNull();
    expect(expeditionReward({ ...base, ms: H, roll: 0.07 }).chest).toBeNull();
  });

  it("local clock: moving it back gives nothing, a jump forward is capped at 8 h", () => {
    const t = 1_000_000_000_000;
    let e = { hero: "knight", acc: 0, mark: t };
    e = advanceLocal(e, t - 2 * H);
    expect(e.acc).toBe(0);
    e = advanceLocal(e, t - H);
    expect(e.acc).toBe(H);
    e = advanceLocal(e, t + 100 * H);
    expect(e.acc).toBe(EXP_MAX_MS);
  });
});

describe("expedition (guest, device clock)", () => {
  beforeEach(() => {
    installStorage().clear();
    setTransport(async () => ({ ok: false, error: "net" }));
  });
  afterEach(() => setTransport(null));

  it("send -> return after 3 h: gold, XP; clock moved back: no reward", async () => {
    const m = new ExpeditionManager(new AccountManager());
    const t = Date.now();
    localStorage.setItem(GOLD_KEY, "10");
    expect((await m.send("knight", t)).ok).toBe(true);
    expect(m.view.hero).toBe("knight");
    // soat 2 soat orqaga surildi — hech narsa
    await m.checkReturn(t - 2 * H);
    expect(m.view.reward).toBeNull();
    expect(Number(localStorage.getItem(GOLD_KEY))).toBe(10);
    // hali ham orqada (asl vaqtdan 1 soat oldin) — 1 soat yig'ildi, mukofot
    await m.checkReturn(t - H);
    expect(m.view.reward).toMatchObject({ hero: "knight", minutes: 60, gold: 10, xp: 15 });
    expect(Number(localStorage.getItem(GOLD_KEY))).toBe(20);
    expect(xpFromRaw(localStorage.getItem(XP_KEY))).toBe(15);
    m.dismiss();
    expect(m.view).toEqual({ hero: null, reward: null });
    expect(localStorage.getItem(EXP_KEY)).toBeNull();
  });

  it("8-hour cap; playing with that hero ends it (short — without reward)", async () => {
    const m = new ExpeditionManager(new AccountManager());
    const t = Date.now();
    await m.send("mage", t);
    await m.checkReturn(t + 30 * H);
    expect(m.view.reward).toMatchObject({ minutes: 480, gold: 80, xp: 120 });
    m.dismiss();
    await m.send("mage", t);
    expect(await m.endFor("knight")).toBeNull();
    expect(m.view.hero).toBe("mage");
    expect(await m.endFor("mage")).toBeNull();
    expect(m.view.hero).toBeNull();
  });

  it("chest item goes to the realm inbox", async () => {
    const m = new ExpeditionManager(new AccountManager());
    const rnd = Math.random;
    Math.random = () => 0;
    try {
      const t = Date.now();
      await m.send("knight", t);
      await m.checkReturn(t + 8 * H);
    } finally {
      Math.random = rnd;
    }
    expect(m.view.reward?.chest).toBe(EXP_CHEST_ITEMS[0]);
    expect(JSON.parse(localStorage.getItem(REALM_INBOX_KEY)!)).toEqual([EXP_CHEST_ITEMS[0]]);
  });
});

describe("expedition (account, server clock)", () => {
  let srv: ReturnType<typeof testServer>;
  let serverNow = Date.UTC(2026, 10, 4, 20, 0, 0);
  beforeEach(() => {
    srv = testServer({ admins: "777" });
    serverNow = Date.UTC(2026, 10, 4, 20, 0, 0);
    srv.clock.now = () => serverNow;
    // Kirish kodi muddati (server soati) qurilma soati bilan solishtiriladi —
    // qurilma soatini ham shu sanaga qotiramiz, aks holda kun o'tgach testlar yiqiladi.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(serverNow);
    setTransport(srv.transport);
  });
  afterEach(() => {
    setTransport(null);
    vi.useRealTimers();
  });

  async function player(tg: number) {
    const storage = new MemoryStorage();
    g.localStorage = storage;
    const acc = new AccountManager();
    new CloudSync(acc);
    const m = new ExpeditionManager(acc);
    await acc.startBotLogin(false);
    srv.confirmPending(tg);
    await acc.pollNow();
    return { acc, m, id: srv.store.playerByTg(tg)!.id };
  }

  it("uses the server clock: changing the phone clock gives nothing", async () => {
    const { m } = await player(5001);
    expect((await m.send("knight")).ok).toBe(true);
    // telefon soati 8 soat oldinga — server bo'yicha 5 daqiqa
    serverNow += 5 * MIN;
    await m.checkReturn(Date.now() + 8 * H);
    expect(m.view.reward).toBeNull();
    expect(m.view.hero).toBe("knight");
    // server bo'yicha 2 soat — telefon soati orqada bo'lsa ham beriladi
    serverNow += 2 * H;
    await m.checkReturn(Date.now() - 24 * H);
    expect(m.view.reward).toMatchObject({ hero: "knight", minutes: 125 });
    expect(Number(localStorage.getItem(GOLD_KEY))).toBe(m.view.reward!.gold);
  });

  it("stops at 8 hours and is given only once", async () => {
    const { acc, m, id } = await player(5002);
    await m.send("hunter");
    serverNow += 30 * H;
    const p = srv.store.player(id)!;
    const r = srv.store.exp.claim(p, serverNow, false);
    expect(r).toMatchObject({ minutes: 480, gold: 80, xp: 120 });
    expect(srv.store.exp.claim(p, serverNow, false)).toBeNull();
    const again = await srv.transport("exp/claim", { token: acc.sessionToken });
    expect(again).toEqual({ ok: true, reward: null });
  });

  it("clock moved back on the server side (start in the future) gives nothing", async () => {
    const { m, id } = await player(5003);
    await m.send("knight");
    serverNow -= 3 * H;
    expect(srv.store.exp.claim(srv.store.player(id)!, serverNow, false)).toBeNull();
    expect(srv.store.exp.get(srv.store.player(id)!)).not.toBeNull();
  });

  it("only an unlocked hero can be sent; a running expedition is kept", async () => {
    const { acc, m } = await player(5004);
    expect(await m.send("paladin")).toMatchObject({ ok: false, error: "none" });
    await m.send("mage");
    serverNow += H;
    const r = await srv.transport("exp/start", { token: acc.sessionToken, hero: "knight" });
    expect(r).toMatchObject({ ok: true, exp: { hero: "mage" } });
  });

  it("works for the author too (rewards are not leaderboard results)", async () => {
    const { m } = await player(777);
    await m.send("knight");
    serverNow += 3 * H;
    await m.checkReturn();
    expect(m.view.reward).toMatchObject({ minutes: 180 });
    expect(srv.store.db.exec("SELECT * FROM scores").toArray()).toHaveLength(0);
  });
});
