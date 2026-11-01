// @vitest-environment node
/**
 * Gildiya hayoti (server): xazina kunlik chegarasi, darajalar va foydalar, haftalik topshiriq
 * hisobi (bulutli saqlanishdagi o'sishdan) va sovg'a, Kul qiroli g'alabalari, chat filtri,
 * o'chirish va jim qilish.
 */
import { describe, expect, it } from "vitest";
import { Limiters, handleApi } from "./api";
import { memoryDb } from "./memory-db";
import { AccountStore } from "./store";
import { TEST_BOT_TOKEN } from "./testing";
import {
  CHAT_KEEP,
  GIVE_DAILY,
  GUILD_LEVEL_XP,
  QUEST_DEFS,
  cleanChat,
  guildCap,
  guildGiftBonus,
  guildLevel,
  guildXpBonus,
  questTier,
  weeklyQuests,
} from "../guildRules";
import { weekKey } from "../scoring";

/** Seshanba, 12:00 Toshkent (07:00 UTC) — hafta o'rtasi */
const NOW = Date.parse("2026-11-03T07:00:00Z");
const H = 3_600_000;

type R = Record<string, unknown> & { ok: boolean; error?: string };

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
      { now: clock.now, ip: `10.1.${ip++ % 250}.1`, botToken: TEST_BOT_TOKEN, bot: "B" },
      lim,
    ) as Promise<R>;
  let tg = 900;
  let rid = 0;
  const nextRid = () => `rid-${String(rid++).padStart(8, "0")}`;
  /** O'yinchi: bulutda progress (oltin, statistika, XP) — versiya bilan */
  const user = async (nick: string, gold = 2000) => {
    const r = await store.login({ id: tg++, username: nick }, "web", clock.now);
    const u = {
      token: r.token,
      id: r.me.id,
      nick,
      gold,
      version: 0,
      stats: { kills: 0, bosses: 0, waves: 0, runs: 0, time: 0 },
      xp: 0,
      secrets: [] as string[],
    };
    await save(u);
    return u;
  };
  type U = Awaited<ReturnType<typeof user>>;
  /** Bulutga saqlash (o'yindagidek: oldingi versiyadan davom etadi) */
  const save = async (u: Omit<U, "id"> & { id?: number }) => {
    const r = await api("save/put", {
      token: u.token,
      base: u.version,
      time: clock.now,
      device: "web",
      data: {
        "pixel-rpg-gold": String(u.gold),
        "pixel-rpg-stats": JSON.stringify(u.stats),
        "pixel-rpg-xp": JSON.stringify({ xp: u.xp, lvl: 1, q: [], s: [] }),
        "pixel-rpg-realm": JSON.stringify({ v: 1, player: { secrets: u.secrets } }),
      },
    });
    expect(r.ok).toBe(true);
    u.version = r["version"] as number;
  };
  /** O'ynadi: statistika o'sdi va bulutga saqlandi */
  const play = async (u: U, d: Partial<U["stats"]> & { xp?: number; secrets?: number }) => {
    for (const k of ["kills", "bosses", "waves", "runs"] as const) u.stats[k] += d[k] ?? 0;
    u.xp += d.xp ?? 0;
    for (let i = 0; i < (d.secrets ?? 0); i++) u.secrets.push(`s${u.secrets.length}`);
    clock.now += 60_000;
    await save(u);
  };
  const guild = async (lead: U, name = "Sinov Gildiyasi", tag = "SG") => {
    const r = await api("guild/create", {
      token: lead.token,
      name,
      tag,
      emblem: "0-1-3-0",
      mode: "open",
      lang: "uz",
      gold: lead.gold,
      rid: nextRid(),
    });
    expect(r.ok).toBe(true);
    return (r["guild"] as { id: number }).id;
  };
  const join = async (u: U, id: number) =>
    expect((await api("guild/join", { token: u.token, id })).ok).toBe(true);
  const give = (u: U, amount: number) =>
    api("guild/give", { token: u.token, amount, gold: u.gold, rid: nextRid() });
  /** Shu hafta topshiriqlarini sinov uchun belgilash */
  const setQuests = (id: number, list: [string, number][]) => {
    store.guilds.life.ensureQuests(id, weekKey(clock.now));
    list.forEach(([kind, target], slot) =>
      store.db.exec(
        "UPDATE guild_quests SET kind = ?, target = ? WHERE guild = ? AND week = ? AND slot = ?",
        kind,
        target,
        id,
        weekKey(clock.now),
        slot,
      ),
    );
  };
  return { store, api, user, save, play, guild, join, give, setQuests, clock, nextRid };
}

describe("darajalar va foydalar", () => {
  it("gildiya darajasi XP bo'yicha 1..10, sig'im 20 → 25 → 30, foydalar kichik", () => {
    expect(guildLevel(0)).toBe(1);
    expect(guildLevel(GUILD_LEVEL_XP[1]! - 1)).toBe(1);
    expect(guildLevel(GUILD_LEVEL_XP[1]!)).toBe(2);
    expect(guildLevel(10_000_000)).toBe(10);
    expect([1, 4, 5, 7, 8, 10].map(guildCap)).toEqual([20, 20, 25, 25, 30, 30]);
    expect([1, 2, 3, 4, 9, 10].map(guildXpBonus)).toEqual([0, 2, 2, 4, 8, 10]);
    expect([1, 2, 3, 5, 6, 9, 10].map(guildGiftBonus)).toEqual([0, 0, 3, 3, 5, 8, 8]);
  });

  it("xazinaga hissa gildiya XP'sini oshiradi va daraja ko'tariladi", async () => {
    const w = await world();
    const lead = await w.user("Rahbar");
    const id = await w.guild(lead);
    // xazina topshirig'i bo'lmasin (u ham XP beradi)
    w.setQuests(id, [
      ["kills", 1000],
      ["bosses", 100],
      ["secrets", 100],
    ]);
    const team = [lead];
    for (let i = 0; i < 4; i++) {
      const u = await w.user(`Azo${i}`);
      await w.join(u, id);
      team.push(u);
    }
    for (const u of team) expect((await w.give(u, GIVE_DAILY)).ok).toBe(true);
    const st = await w.api("guild/get", { token: lead.token });
    expect(st["guild"]).toMatchObject({ treasury: 500, xp: 500, level: 2 });
    expect((st["members"] as { given: number }[]).every((m) => m.given === GIVE_DAILY)).toBe(true);
  });
});

describe("xazina", () => {
  it("kunlik chegara (Toshkent kuni), kamida 5 oltin, takroriy rid — bir marta", async () => {
    const w = await world();
    const lead = await w.user("Xazinachi");
    await w.guild(lead);
    expect(await w.give(lead, 3)).toMatchObject({ ok: false, error: "bad" });
    expect(await w.give(lead, 60)).toMatchObject({ ok: true, given: 60, cap: GIVE_DAILY });
    const over = await w.give(lead, 50);
    expect(over).toMatchObject({ ok: false, error: "limit" });
    // chegara Toshkent yarim tunida (19:00 UTC) yangilanadi
    expect(over["until"]).toBe(Date.parse("2026-11-03T19:00:00Z"));
    expect(await w.give(lead, 40)).toMatchObject({ ok: true, given: 100 });
    const body = { token: lead.token, amount: 30, gold: lead.gold, rid: "same-give-rid-1" };
    w.clock.now = Date.parse("2026-11-03T19:00:01Z");
    expect(await w.api("guild/give", body)).toMatchObject({ ok: true, given: 30 });
    expect(await w.api("guild/give", body)).toMatchObject({ ok: true, dup: true, given: 30 });
    const st = await w.api("guild/get", { token: lead.token });
    expect(st["guild"]).toMatchObject({ treasury: 130, xp: 130 });
    expect(st["given"]).toBe(30);
  });

  it("gildiyani almashtirsa ham kunlik chegara bir xil; oltin yetmasa — rad", async () => {
    const w = await world();
    const a = await w.user("Birinchi");
    const b = await w.user("Ikkinchi");
    const id2 = await w.guild(b, "Ikkinchi Uy", "IU");
    await w.guild(a, "Birinchi Uy", "BU");
    const p = await w.user("Saxiy", 70);
    expect(await w.give(p, 10)).toMatchObject({ ok: false, error: "guild" });
    await w.join(p, id2);
    expect(await w.give({ ...p, gold: 50 }, 60)).toMatchObject({ ok: false, error: "gold" });
    expect((await w.give(p, 70)).ok).toBe(true);
    // jurnalda hissa
    const log = await w.api("guild/log", { token: b.token });
    expect((log["entries"] as { kind: string; nick: string; amount: number }[])[0]).toMatchObject({
      kind: "give",
      nick: "Saxiy",
      amount: 70,
    });
  });
});

describe("haftalik topshiriqlar", () => {
  it("har gildiyaga har hafta 3 ta (oddiy, o'rta, maxsus), maqsad a'zolar soniga qarab", () => {
    const q = weeklyQuests(7, "2026-11-02");
    expect(q).toHaveLength(3);
    expect(["kills", "xp", "waves", "runs"]).toContain(q[0]);
    expect(["bosses", "gold"]).toContain(q[1]);
    expect(["ashking", "secrets"]).toContain(q[2]);
    expect(weeklyQuests(7, "2026-11-02")).toEqual(q);
    expect([1, 5, 6, 14, 15, 30].map(questTier)).toEqual([0, 0, 1, 1, 2, 2]);
    expect(QUEST_DEFS.kills.targets[2]).toBe(5000);
    expect(QUEST_DEFS.ashking.targets[2]).toBe(10);
  });

  it("a'zolarning o'yindagi o'sishi hissa bo'ladi; bajarilganda hammaga sovg'a va gildiya XP", async () => {
    const w = await world();
    const lead = await w.user("Rahbar");
    const id = await w.guild(lead);
    const a = await w.user("Ali");
    const b = await w.user("Vali");
    await w.join(a, id);
    await w.join(b, id);
    w.setQuests(id, [
      ["kills", 100],
      ["bosses", 3],
      ["secrets", 2],
    ]);
    // gildiyaga qo'shilishdan oldingi o'yin hisobga kirmaydi (oldingi saqlanish yo'q edi)
    await w.play(a, { kills: 30 });
    await w.play(b, { kills: 50, bosses: 1 });
    await w.play(a, { kills: 30, bosses: 2, secrets: 1 });
    let st = await w.api("guild/get", { token: lead.token });
    const q = st["quests"] as {
      kind: string;
      progress: number;
      done: number;
      top: { nick: string; amount: number }[];
    }[];
    expect(q[0]).toMatchObject({ kind: "kills", progress: 110, done: expect.any(Number) });
    expect(q[0]!.done).toBeGreaterThan(0);
    expect(q[0]!.top).toEqual([
      { id: a.id, nick: "Ali", amount: 60 },
      { id: b.id, nick: "Vali", amount: 50 },
    ]);
    expect(q[1]).toMatchObject({ kind: "bosses", progress: 3 });
    expect(q[1]!.done).toBeGreaterThan(0);
    expect(q[2]).toMatchObject({ kind: "secrets", progress: 1, done: 0 });
    // har a'zoga ikki topshiriq sovg'asi (oltin), gildiyaga XP
    expect(st["guild"]).toMatchObject({
      xp: QUEST_DEFS.kills.gxp + QUEST_DEFS.bosses.gxp,
    });
    const rewards = st["rewards"] as { gold: number; kind: string }[];
    expect(rewards.map((r) => r.kind).sort()).toEqual(["bosses", "kills"]);
    st = await w.api("guild/get", { token: b.token });
    expect((st["rewards"] as unknown[]).length).toBe(2);
    // presence: oxirgi sovg'a raqami (klient olinmaganini biladi)
    const pr = await w.api("presence", { token: b.token, place: "menu" });
    expect((pr["guild"] as { reward: number }).reward).toBeGreaterThan(0);
    // ikkinchi marta bajarilmaydi
    await w.play(a, { kills: 500 });
    const again = await w.api("guild/get", { token: lead.token });
    expect((again["rewards"] as unknown[]).length).toBe(2);
  });

  it("imkonsiz sakrash cheklanadi; boshqa qurilma ziddiyatidagi saqlanish hisobga kirmaydi", async () => {
    const w = await world();
    const lead = await w.user("Cheklov");
    const id = await w.guild(lead);
    w.setQuests(id, [
      ["kills", 100_000],
      ["gold", 100_000],
      ["secrets", 1000],
    ]);
    await w.play(lead, { kills: 50_000 });
    let st = await w.api("guild/get", { token: lead.token });
    expect((st["quests"] as { progress: number }[])[0]!.progress).toBe(3000);
    // eski versiyadan (ziddiyat) — rad etiladi yoki hisoblanmaydi
    const stale = {
      ...lead,
      version: lead.version - 1,
      stats: { ...lead.stats, kills: lead.stats.kills + 999 },
    };
    w.clock.now += 120_000;
    await w.api("save/put", {
      token: lead.token,
      base: stale.version,
      time: w.clock.now,
      device: "web",
      data: { "pixel-rpg-stats": JSON.stringify(stale.stats) },
    });
    st = await w.api("guild/get", { token: lead.token });
    expect((st["quests"] as { progress: number }[])[0]!.progress).toBe(3000);
  });

  it("dushanba 00:00 (Toshkent) — yangi hafta, yangi topshiriqlar va hissalar noldan", async () => {
    const w = await world();
    const lead = await w.user("Haftalik");
    const id = await w.guild(lead);
    w.setQuests(id, [
      ["kills", 1000],
      ["bosses", 100],
      ["secrets", 100],
    ]);
    await w.play(lead, { kills: 200 });
    // yakshanba 23:59 Toshkent → dushanba 00:00
    w.clock.now = Date.parse("2026-11-08T18:59:00Z");
    let st = await w.api("guild/get", { token: lead.token });
    expect(st["week"]).toBe("2026-11-02");
    expect(st["resets"]).toBe(Date.parse("2026-11-08T19:00:00Z"));
    w.clock.now = Date.parse("2026-11-08T19:00:00Z");
    st = await w.api("guild/get", { token: lead.token });
    expect(st["week"]).toBe("2026-11-09");
    expect((st["quests"] as { progress: number }[]).every((q) => q.progress === 0)).toBe(true);
  });

  it("Kul qiroli: bir jangda bir gildiyadan 3 a'zo — gildiyaga bitta g'alaba, har biriga ishtirok", async () => {
    const w = await world();
    const lead = await w.user("Tank");
    const id = await w.guild(lead);
    const a = await w.user("Mergan");
    const b = await w.user("Sehrgar");
    const out = await w.user("Begona");
    await w.join(a, id);
    await w.join(b, id);
    w.setQuests(id, [
      ["kills", 1000],
      ["bosses", 100],
      ["ashking", 2],
    ]);
    w.store.guilds.life.raid([lead.id, a.id, b.id, out.id], w.clock.now);
    let st = await w.api("guild/get", { token: lead.token });
    let ash = (st["quests"] as { progress: number; done: number; top: unknown[] }[])[2]!;
    expect(ash.progress).toBe(1);
    expect(ash.top).toHaveLength(3);
    w.store.guilds.life.raid([lead.id, a.id], w.clock.now + 600_000);
    st = await w.api("guild/get", { token: lead.token });
    ash = (st["quests"] as { progress: number; done: number; top: unknown[] }[])[2]!;
    expect(ash.progress).toBe(2);
    expect(ash.done).toBeGreaterThan(0);
    expect((st["rewards"] as { gold: number }[])[0]!.gold).toBe(QUEST_DEFS.ashking.gold);
  });
});

describe("gildiya chati", () => {
  async function chatWorld() {
    const w = await world();
    const lead = await w.user("Rahbar");
    const id = await w.guild(lead);
    const off = await w.user("Orinbosar");
    const mem = await w.user("Azo");
    const out = await w.user("Begona");
    await w.join(off, id);
    await w.join(mem, id);
    await w.api("guild/role", { token: lead.token, player: off.id, role: "officer" });
    const say = (u: { token: string }, body: Record<string, unknown>) => {
      w.clock.now += 3000;
      return w.api("guild/say", { token: u.token, ...body });
    };
    const read = (u: { token: string }, since = 0, rev = 0) =>
      w.api("guild/chat", { token: u.token, since, rev });
    return { ...w, lead, off, mem, out, say, read };
  }

  it("filtr: haqoratli so'zlar yulduzcha, havolalar yashirin; tayyor iboralar", async () => {
    expect(cleanChat("salom fuck  dunyo")).toBe("salom **** dunyo");
    expect(cleanChat("bu suka!")).toBe("bu *****");
    expect(cleanChat("kir: https://evil.example/x")).toBe("kir: [havola]");
    expect(cleanChat("a".repeat(500))).toHaveLength(120);
    const w = await chatWorld();
    const r = await w.say(w.mem, { text: "Bugun Kul qiroliga boramiz, fuck yeah" });
    expect(r).toMatchObject({ ok: true });
    expect((r["message"] as { text: string }).text).toBe("Bugun Kul qiroliga boramiz, **** yeah");
    expect((await w.say(w.mem, { phrase: 2 })).ok).toBe(true);
    expect(await w.say(w.mem, { text: "   " })).toMatchObject({ ok: false, error: "bad" });
    const list = await w.read(w.lead);
    expect(list["messages"]).toMatchObject([
      { nick: "Azo", role: "member", phrase: -1 },
      { nick: "Azo", phrase: 2, text: "" },
    ]);
    // faqat gildiya ichida
    expect(await w.read(w.out)).toMatchObject({ ok: false, error: "guild" });
    expect(await w.say(w.out, { text: "salom" })).toMatchObject({ ok: false, error: "guild" });
  });

  it("jim qilish: o'rinbosar a'zoni jim qiladi (rahbarni — yo'q), muddat tugagach yozadi", async () => {
    const w = await chatWorld();
    expect(
      await w.api("guild/mute", { token: w.mem.token, player: w.off.id, minutes: 10 }),
    ).toMatchObject({ ok: false, error: "perm" });
    expect(
      await w.api("guild/mute", { token: w.off.token, player: w.lead.id, minutes: 10 }),
    ).toMatchObject({ ok: false, error: "perm" });
    expect(
      await w.api("guild/mute", { token: w.off.token, player: w.mem.id, minutes: 60 }),
    ).toMatchObject({ ok: true });
    const r = await w.say(w.mem, { text: "salom" });
    expect(r).toMatchObject({ ok: false, error: "muted" });
    expect(r["until"]).toBeGreaterThan(w.clock.now);
    expect((await w.read(w.mem))["muted"]).toBeGreaterThan(w.clock.now);
    w.clock.now += 61 * 60_000;
    expect((await w.say(w.mem, { text: "salom" })).ok).toBe(true);
    // ruxsatsiz qisqa vaqtda ketma-ket — rad
    w.clock.now += 500;
    expect(await w.api("guild/say", { token: w.mem.token, text: "yana" })).toMatchObject({
      ok: false,
      error: "limit",
    });
  });

  it("o'chirish: a'zo boshqanikini o'chira olmaydi, o'zinikini — ha; o'rinbosar a'zonikini — ha", async () => {
    const w = await chatWorld();
    const m1 = (await w.say(w.mem, { text: "birinchi" }))["message"] as { id: number };
    const m2 = (await w.say(w.lead, { text: "rahbardan" }))["message"] as { id: number };
    const m3 = (await w.say(w.mem, { text: "uchinchi" }))["message"] as { id: number };
    expect(await w.api("guild/unsay", { token: w.mem.token, id: m2.id })).toMatchObject({
      ok: false,
      error: "perm",
    });
    expect(await w.api("guild/unsay", { token: w.off.token, id: m2.id })).toMatchObject({
      ok: false,
      error: "perm",
    });
    expect((await w.api("guild/unsay", { token: w.mem.token, id: m1.id })).ok).toBe(true);
    expect((await w.api("guild/unsay", { token: w.off.token, id: m3.id })).ok).toBe(true);
    // versiya o'zgardi — klient to'liq ro'yxatni oladi
    const full = await w.read(w.lead, m3.id, 0);
    expect(full).toMatchObject({ full: true });
    expect((full["messages"] as { text: string }[]).map((m) => m.text)).toEqual(["rahbardan"]);
    const same = await w.read(w.lead, m2.id, full["rev"] as number);
    expect(same).toMatchObject({ full: false, messages: [] });
  });

  it("serverda oxirgi 100 ta xabar qoladi", async () => {
    const w = await chatWorld();
    for (let i = 0; i < CHAT_KEEP + 15; i++) await w.say(w.mem, { text: `xabar ${i}` });
    const list = (await w.read(w.lead))["messages"] as { text: string }[];
    expect(list).toHaveLength(CHAT_KEEP);
    expect(list[0]!.text).toBe("xabar 15");
    expect(list.at(-1)!.text).toBe(`xabar ${CHAT_KEEP + 14}`);
    expect(w.store.db.exec("SELECT COUNT(*) AS n FROM guild_chat").toArray()[0]?.["n"]).toBe(
      CHAT_KEEP,
    );
  });

  it("akkaunt o'chirilsa — chatdagi xabarlari, hissalari va sovg'alari ham o'chadi", async () => {
    const w = await chatWorld();
    await w.say(w.mem, { text: "men ketaman" });
    await w.give(w.mem, 20);
    await w.api("account/delete", { token: w.mem.token, confirm: true });
    for (const t of ["guild_chat", "guild_gifts", "guild_qc", "guild_rewards", "guild_log"])
      expect(
        w.store.db.exec(`SELECT COUNT(*) AS n FROM ${t} WHERE player = ?`, w.mem.id).toArray()[0]?.[
          "n"
        ],
      ).toBe(0);
  });
});
