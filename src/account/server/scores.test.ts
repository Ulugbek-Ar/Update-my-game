// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Limiters, handleApi } from "./api";
import { memoryDb } from "./memory-db";
import { AccountStore } from "./store";
import { TEST_BOT_TOKEN } from "./testing";
import { TOP_N } from "./scores";
import { judgeRaid, judgeRun, nextWeekStart, tashkentDay, weekKey } from "../scoring";
import type { ScoreTop } from "../protocol";
import { RealmRoom, type RoomConn } from "@/realm/net/room";
import { NET_VERSION } from "@/realm/net/protocol";
import { Rng } from "@/realm/rng";

// 2026-11-04 (chorshanba) 10:00 UTC
const NOW = Date.UTC(2026, 10, 4, 10, 0, 0);

function setup() {
  const store = new AccountStore(memoryDb());
  const lim = new Limiters();
  let now = NOW;
  const api = (op: string, body: unknown) =>
    handleApi(store, op, body, { now, ip: "x", botToken: TEST_BOT_TOKEN, bot: "B" }, lim);
  const user = async (tg: number, nick: string) =>
    (await store.login({ id: tg, username: nick }, "web", now)).token;
  const run = (over: Record<string, unknown> = {}) => ({
    mode: "world",
    hero: "knight",
    score: 3000,
    wave: 5,
    time: 180,
    won: true,
    ...over,
  });
  return { store, api, user, run, at: (t: number) => (now = t) };
}

describe("weekly period (Monday 00:00 Tashkent)", () => {
  it("week key changes exactly at Monday 00:00 Tashkent (Sunday 19:00 UTC)", () => {
    // 2026-11-08 — yakshanba
    const sunday1859 = Date.UTC(2026, 10, 8, 18, 59, 59);
    const monday0000 = Date.UTC(2026, 10, 8, 19, 0, 0);
    expect(weekKey(NOW)).toBe("2026-11-02");
    expect(weekKey(sunday1859)).toBe("2026-11-02");
    expect(weekKey(monday0000)).toBe("2026-11-09");
    expect(nextWeekStart(NOW)).toBe(monday0000);
    expect(tashkentDay(Date.UTC(2026, 10, 4, 19, 30))).toBe("2026-11-05");
  });
});

describe("result checks", () => {
  it("typical results pass, impossible ones are refused, borderline ones hidden", () => {
    expect(judgeRun({ mode: "world", score: 3000, wave: 5, time: 180, won: true })).toBe("ok");
    expect(judgeRun({ mode: "world", score: 400, wave: 2, time: 30, won: false })).toBe("ok");
    // imkonsiz: 10 soniyada 5000 ochko, chegaradan katta, boss 20 s da, 6-to'lqin
    expect(judgeRun({ mode: "world", score: 5000, wave: 3, time: 10, won: false })).toBe("reject");
    expect(judgeRun({ mode: "world", score: 50_000, wave: 5, time: 900, won: true })).toBe(
      "reject",
    );
    expect(judgeRun({ mode: "world", score: 1500, wave: 5, time: 20, won: true })).toBe("reject");
    expect(judgeRun({ mode: "world", score: 100, wave: 6, time: 60, won: false })).toBe("reject");
    // shubhali: juda tez g'alaba yoki chegaraga yaqin ochko
    expect(judgeRun({ mode: "world", score: 2500, wave: 5, time: 45, won: true })).toBe("hidden");
    expect(judgeRun({ mode: "world", score: 9000, wave: 5, time: 600, won: true })).toBe("hidden");
    // cheksiz: to'lqin soniga bog'liq
    // 10-to'lqin: odatiy ≈ 15 000; nazariy eng ko'pi ≈ 28 000 — undan yuqori shubhali
    expect(judgeRun({ mode: "endless", score: 15_000, wave: 10, time: 300, won: false })).toBe(
      "ok",
    );
    expect(judgeRun({ mode: "endless", score: 30_000, wave: 10, time: 300, won: false })).toBe(
      "hidden",
    );
    expect(judgeRun({ mode: "endless", score: 30_000, wave: 10, time: 20, won: false })).toBe(
      "reject",
    );
    expect(judgeRun({ mode: "endless", score: 900_000, wave: 10, time: 300, won: false })).toBe(
      "reject",
    );
    expect(judgeRaid(5)).toBe("reject");
    expect(judgeRaid(20)).toBe("hidden");
    expect(judgeRaid(240)).toBe("ok");
  });
});

describe("leaderboards", () => {
  it("keeps the best result, weekly resets on Monday, all-time stays", async () => {
    const s = setup();
    const t = await s.user(1, "Ali_01");
    expect(await s.api("scores/submit", { token: t, ...s.run({ score: 3000 }) })).toMatchObject({
      ok: true,
      best: 3000,
      rank: 1,
    });
    // yomonroq natija — eng yaxshisi qoladi
    expect(await s.api("scores/submit", { token: t, ...s.run({ score: 2000 }) })).toMatchObject({
      best: 3000,
    });
    const week = (await s.api("scores/top", {
      token: t,
      board: "w1:knight",
      period: "week",
    })) as unknown as ScoreTop;
    expect(week.rows.map((r) => r.score)).toEqual([3000]);
    expect(week.week).toBe("2026-11-02");
    // yangi hafta (dushanba 00:00 Toshkent)
    s.at(Date.UTC(2026, 10, 8, 19, 0, 1));
    const next = (await s.api("scores/top", {
      board: "w1:knight",
      period: "week",
    })) as unknown as ScoreTop;
    expect(next.rows).toEqual([]);
    expect(next.week).toBe("2026-11-09");
    const all = (await s.api("scores/top", {
      board: "w1:knight",
      period: "all",
    })) as unknown as ScoreTop;
    expect(all.rows.map((r) => r.nick)).toEqual(["Ali_01"]);
  });

  it("top-50 per hero and the player's own place beyond the top", async () => {
    const s = setup();
    let mine = "";
    for (let i = 0; i < 60; i++) {
      const t = await s.user(100 + i, `Player_${i}`);
      if (i === 0) mine = t;
      await s.api("scores/submit", { token: t, ...s.run({ score: 1000 + i * 10 }) });
    }
    // boshqa qahramon jadvali alohida
    const t2 = await s.user(999, "Mage_one");
    await s.api("scores/submit", { token: t2, ...s.run({ hero: "mage", score: 5000 }) });
    const top = (await s.api("scores/top", {
      token: mine,
      board: "w1:knight",
      period: "week",
    })) as unknown as ScoreTop;
    expect(top.rows).toHaveLength(TOP_N);
    expect(top.rows[0]).toMatchObject({ rank: 1, nick: "Player_59", score: 1590 });
    expect(top.rows.some((r) => r.nick === "Mage_one")).toBe(false);
    // o'yinchi 60-o'rinda (eng past) — ro'yxatda yo'q, lekin o'rni ko'rinadi
    expect(top.me).toMatchObject({ rank: 60, score: 1000, hidden: false });
    const mageTop = (await s.api("scores/top", {
      board: "w1:mage",
      period: "all",
    })) as unknown as ScoreTop;
    expect(mageTop.rows.map((r) => r.nick)).toEqual(["Mage_one"]);
  });

  it("impossible results are refused; suspicious ones are hidden from the board", async () => {
    const s = setup();
    const t = await s.user(1, "Cheater");
    expect(
      await s.api("scores/submit", { token: t, ...s.run({ score: 99_999, time: 30 }) }),
    ).toEqual({ ok: false, error: "invalid" });
    expect(
      await s.api("scores/submit", { token: t, ...s.run({ score: 2500, time: 45 }) }),
    ).toMatchObject({ ok: true, hidden: true, rank: null });
    const top = (await s.api("scores/top", {
      token: t,
      board: "w1:knight",
      period: "week",
    })) as unknown as ScoreTop;
    expect(top.rows).toEqual([]);
    expect(top.me).toMatchObject({ hidden: true });
  });

  it("guests cannot submit, but can view", async () => {
    const s = setup();
    expect(await s.api("scores/submit", { ...s.run() })).toMatchObject({ ok: false });
    expect(await s.api("scores/top", { board: "endless", period: "all" })).toMatchObject({
      ok: true,
      rows: [],
      me: null,
    });
  });

  it("daily challenge: one attempt per day", async () => {
    const s = setup();
    const t = await s.user(1, "Ali_01");
    const daily = s.run({ mode: "daily", score: 1200, wave: 4, won: false, date: "2026-11-04" });
    expect(await s.api("scores/submit", { token: t, ...daily })).toMatchObject({ ok: true });
    expect(await s.api("scores/submit", { token: t, ...daily, score: 4000 })).toEqual({
      ok: false,
      error: "limit",
    });
    // juda eski sana — rad
    expect(await s.api("scores/submit", { token: t, ...daily, date: "2026-10-01" })).toMatchObject({
      ok: false,
    });
  });

  it("Ash King: fastest team time from the realm server, lower is better", async () => {
    const s = setup();
    const a = await s.user(1, "Tank_01");
    const b = await s.user(2, "Healer_02");
    const ida = s.store.playerByTg(1)!.id;
    const idb = s.store.playerByTg(2)!.id;
    expect(s.store.scores.raid([ida, idb], 241.5, NOW)).toMatchObject({ ok: true });
    s.store.scores.raid([ida], 300, NOW);
    expect(s.store.scores.raid([ida], 3, NOW)).toEqual({ ok: false });
    const top = (await s.api("scores/top", {
      token: b,
      board: "ashking",
      period: "week",
    })) as unknown as ScoreTop;
    expect(top.rows.map((r) => [r.nick, r.score])).toEqual([
      ["Tank_01", 2415],
      ["Healer_02", 2415],
    ]);
    expect(top.rows[0]!.team).toEqual(["Tank_01", "Healer_02"]);
    expect(a).toBeTruthy();
  });

  it("the realm room reports the Ash King team (logged-in players only)", () => {
    const r = new Rng(9);
    const room = new RealmRoom("ABCDEF", { rand: () => r.next() });
    const conn: RoomConn = { send() {}, close() {} };
    const hello = (tag: string) =>
      JSON.stringify({ t: "hello", v: NET_VERSION, tag, hero: "paladin", save: null, keys: [] });
    const p1 = room.newId();
    room.receive(p1, conn, hello("1111"), 0, { id: 77, nick: "Tank", level: 5 });
    const p2 = room.newId();
    room.receive(p2, conn, hello("2222"), 0);
    const got: [number, number[]][] = [];
    room.onRaidWin = (secs, team) => got.push([secs, team]);
    room.sim.event({ type: "raid", what: "win", x: 0, y: 0, secs: 180.5, team: [p1, p2] });
    // step ichida voqealar tozalanadi — qo'lda qo'yilganini step ko'rishi uchun
    const step = room.sim.step.bind(room.sim);
    room.sim.step = (c) => {
      const keep = [...room.sim.events];
      step(c);
      room.sim.events.push(...keep);
    };
    room.step();
    expect(got).toEqual([[180.5, [77]]]);
  });
});
