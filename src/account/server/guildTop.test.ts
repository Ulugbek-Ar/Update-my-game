// @vitest-environment node
/**
 * Gildiyalar reytingi (server): haftalik va umumiy gildiya XP, topshiriqlar, Kul qiroli (jamoa
 * bitta gildiyadan bo'lsa), hafta g'olibi (vodiydagi bayroq) va hududlar (controlled_by).
 */
import { describe, expect, it } from "vitest";
import { Limiters, handleApi } from "./api";
import { memoryDb } from "./memory-db";
import { AccountStore } from "./store";
import { TEST_BOT_TOKEN } from "./testing";
import { GUILD_RAID_XP, TERRITORIES } from "../guildRules";
import { loadRealmData } from "@/realm/data";

/** Seshanba, 12:00 Toshkent */
const NOW = Date.parse("2026-11-03T07:00:00Z");
const DAY = 86_400_000;

type R = Record<string, unknown> & { ok: boolean; error?: string };
type Row = { rank: number; tag: string; score: number; members: number; level: number };

async function world() {
  const store = new AccountStore(memoryDb());
  const lim = new Limiters();
  const clock = { now: NOW };
  let ip = 0;
  const api = (op: string, body: unknown) =>
    handleApi(
      store,
      op,
      body,
      { now: clock.now, ip: `10.2.${ip++ % 250}.1`, botToken: TEST_BOT_TOKEN, bot: "B" },
      lim,
    ) as Promise<R>;
  let tg = 2000;
  let rid = 0;
  const user = async (nick: string) => {
    const r = await store.login({ id: tg++, username: nick }, "web", clock.now);
    store.putSave(
      r.me.id,
      { base: 0, time: clock.now, device: "web", data: { "pixel-rpg-gold": "5000" } },
      clock.now,
    );
    return { token: r.token, id: r.me.id, nick };
  };
  const guild = async (lead: { token: string }, name: string, tag: string) => {
    const r = await api("guild/create", {
      token: lead.token,
      name,
      tag,
      emblem: "0-1-3-0",
      mode: "open",
      lang: "uz",
      gold: 5000,
      rid: `top-rid-${String(rid++).padStart(5, "0")}`,
    });
    expect(r.ok).toBe(true);
    return (r["guild"] as { id: number }).id;
  };
  const top = (board: string, period: "week" | "all", token?: string) =>
    api("guild/top", { board, period, ...(token ? { token } : {}) });
  return { store, api, user, guild, top, clock };
}

describe("gildiyalar reytingi", () => {
  it("gildiya XP: haftalik — shu hafta to'plangani, umumiy — jami; o'z gildiyasi o'rni", async () => {
    const w = await world();
    const a = await w.user("Aziz");
    const b = await w.user("Bobur");
    const c = await w.user("Charos");
    const ga = await w.guild(a, "Birinchi Gildiya", "BG");
    const gb = await w.guild(b, "Ikkinchi Gildiya", "IG");
    await w.guild(c, "Uchinchi Gildiya", "UG");
    w.store.guilds.life.addXp(ga, 900, NOW - 7 * DAY); // o'tgan hafta
    w.store.guilds.life.addXp(ga, 300, NOW);
    w.store.guilds.life.addXp(gb, 700, NOW);
    const week = await w.top("xp", "week", a.token);
    expect((week["rows"] as Row[]).map((r) => [r.tag, r.score])).toEqual([
      ["IG", 700],
      ["BG", 300],
    ]);
    expect(week["me"]).toMatchObject({ tag: "BG", rank: 2 });
    const all = await w.top("xp", "all");
    expect((all["rows"] as Row[]).map((r) => [r.tag, r.score, r.level])).toEqual([
      ["BG", 1200, 2],
      ["IG", 700, 2],
    ]);
    expect(all["me"]).toBeNull();
  });

  it("topshiriqlar: haftalik va umumiy bajarilganlar soni", async () => {
    const w = await world();
    const a = await w.user("Topshiriqchi");
    const g = await w.guild(a, "Ishchan Gildiya", "IS");
    for (const [week, n] of [
      ["2026-10-26", 2],
      ["2026-11-02", 1],
    ] as const)
      w.store.db.exec("INSERT INTO guild_week (guild, week, quests) VALUES (?, ?, ?)", g, week, n);
    expect((await w.top("quests", "week"))["rows"]).toMatchObject([{ tag: "IS", score: 1 }]);
    expect((await w.top("quests", "all"))["rows"]).toMatchObject([{ tag: "IS", score: 3 }]);
  });

  it("Kul qiroli: jamoa (kamida 2) bitta gildiyadan bo'lsa — eng tez vaqt va gildiya XP", async () => {
    const w = await world();
    const [a, b, c, d] = [
      await w.user("Tank1"),
      await w.user("Mergan1"),
      await w.user("Tank2"),
      await w.user("Begona2"),
    ];
    const g1 = await w.guild(a, "Kul Ovchilari", "KO");
    const g2 = await w.guild(c, "Olov Yuraklar", "OY");
    await w.api("guild/join", { token: b.token, id: g1 });
    const r = w.store.guilds.ranks;
    // aralash jamoa (boshqa gildiyadan yoki gildiyasiz) — hisoblanmaydi
    expect(r.raid([a.id, c.id], 95, NOW)).toBeNull();
    expect(r.raid([c.id, d.id], 95, NOW)).toBeNull();
    // yolg'iz — jamoa emas
    expect(r.raid([a.id], 95, NOW)).toBeNull();
    // juda tez (shubhali) — yo'q
    expect(r.raid([a.id, b.id], 20, NOW)).toBeNull();
    expect(r.raid([a.id, b.id], 125.4, NOW)).toBe(g1);
    expect(r.raid([a.id, b.id], 98.2, NOW + 1000)).toBe(g1);
    expect(r.raid([a.id, b.id], 140, NOW + 2000)).toBe(g1);
    const top = await w.top("ashking", "week", b.token);
    expect(top["rows"]).toMatchObject([{ tag: "KO", score: 982 }]);
    expect(top["me"]).toMatchObject({ tag: "KO", rank: 1 });
    // har g'alabaga gildiya XP
    const st = await w.api("guild/get", { token: a.token });
    expect((st["guild"] as { xp: number }).xp).toBe(3 * GUILD_RAID_XP);
    expect(g2).toBeGreaterThan(0);
  });

  it("hafta g'olibi: o'tgan haftada eng ko'p gildiya XP to'plagan gildiya (bayroq uchun)", async () => {
    const w = await world();
    const a = await w.user("Golib");
    const b = await w.user("Ikkinchi");
    const ga = await w.guild(a, "G'olib Gildiya", "GG");
    const gb = await w.guild(b, "Kuchli Gildiya", "KG");
    expect(w.store.guilds.ranks.champion(NOW)).toBeNull();
    w.store.guilds.life.addXp(ga, 800, NOW - 7 * DAY);
    w.store.guilds.life.addXp(gb, 500, NOW - 7 * DAY);
    // shu haftadagi XP g'olibni o'zgartirmaydi
    w.store.guilds.life.addXp(gb, 5000, NOW);
    // keshda null — yangi hafta kelganda qayta hisoblanadi
    const next = NOW + 7 * DAY;
    expect(w.store.guilds.ranks.champion(next)).toMatchObject({
      tag: "KG",
      xp: 5000,
      week: "2026-11-02",
    });
    const fresh = new AccountStore(w.store.db);
    expect(fresh.guilds.ranks.champion(NOW)).toMatchObject({ tag: "GG", xp: 800 });
    // onlayn holat javobida ham (olam oflayn bo'lsa ham bayroq ko'rinsin)
    w.clock.now = next;
    const pr = await w.api("presence", { token: a.token, place: "menu" });
    expect((pr["guild"] as { champ: unknown }).champ).toMatchObject({ tag: "KG" });
  });

  it("hududlar: controlled_by maydoni (hozircha hech kim), gildiya tarqalsa — bo'shaydi", async () => {
    const w = await world();
    expect(TERRITORIES.map((t) => t.id)).toEqual(loadRealmData().areas.map((a) => a.id));
    const t0 = await w.top("xp", "all");
    expect(t0["territories"]).toEqual(
      TERRITORIES.map((t) => ({ id: t.id, name: t.name, controlledBy: null, since: 0 })),
    );
    const a = await w.user("Hukmdor");
    const g = await w.guild(a, "Vodiy Egalari", "VE");
    w.store.guilds.ranks.setController("valley", g, NOW);
    const t1 = await w.top("xp", "all");
    expect((t1["territories"] as { controlledBy: unknown }[])[0]!.controlledBy).toMatchObject({
      tag: "VE",
      name: "Vodiy Egalari",
    });
    await w.api("guild/disband", { token: a.token, confirm: true });
    const t2 = await w.top("xp", "all");
    expect((t2["territories"] as { controlledBy: unknown }[])[0]!.controlledBy).toBeNull();
  });
});
