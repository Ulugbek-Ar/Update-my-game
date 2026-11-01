// @vitest-environment node
/**
 * Gildiya (klient): 500 oltin faqat server "ok" degandan keyin yechiladi; xatoda oltin joyida;
 * javob yo'qolsa — keyingi yangilanishda aynan shu rid bilan qayta yuboriladi (bir marta).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTransport, type Transport } from "./api";
import { AccountManager } from "./account";
import { CloudSync } from "./cloud";
import { FriendsManager } from "./friends";
import { GUILD_PROGRESS_KEY, GuildManager, cachedGuild } from "./guild";
import { GUILD_LEVEL_XP } from "./guildRules";
import { GUILD_SPEND_KEY } from "./keys";
import { MemoryStorage, testServer } from "./server/testing";
import { addXp, loadXp } from "./xp";
import { GOLD_KEY, loadGold } from "@/game/shop";
import { GIFT_REWARDS, claimGift } from "@/game/gift";

const g = globalThis as { localStorage?: Storage };

async function device(srv: ReturnType<typeof testServer>, tg: number, gold: number) {
  g.localStorage = new MemoryStorage();
  localStorage.setItem(GOLD_KEY, String(gold));
  const acc = new AccountManager();
  const sync = new CloudSync(acc);
  const fr = new FriendsManager(acc);
  const guild = new GuildManager(acc, fr);
  await acc.startBotLogin(false);
  srv.confirmPending(tg, `user${tg}`);
  await acc.pollNow();
  if (sync.view.decision) await sync.resolve("local");
  return { acc, sync, fr, guild };
}

const input = {
  name: "Qal'a Qo'riqchilari",
  tag: "PQ",
  emblem: "0-1-3-0",
  mode: "open" as const,
  lang: "uz" as const,
};

describe("gildiya tuzish (klient)", () => {
  let srv: ReturnType<typeof testServer>;
  beforeEach(() => {
    srv = testServer();
    setTransport(srv.transport);
  });
  afterEach(() => setTransport(null));

  it("muvaffaqiyatda 500 oltin yechiladi va qisqacha qurilmada saqlanadi", async () => {
    const d = await device(srv, 501, 720);
    const r = await d.guild.create(input);
    expect(r.ok).toBe(true);
    expect(loadGold()).toBe(220);
    expect(d.guild.view.state?.guild?.tag).toBe("PQ");
    expect(cachedGuild()).toMatchObject({ tag: "PQ", role: "leader", level: 1 });
    expect(localStorage.getItem(GUILD_SPEND_KEY)).toBeNull();
  });

  it("oltin yetmasa yoki server rad etsa — oltin joyida", async () => {
    const d = await device(srv, 502, 300);
    expect((await d.guild.create(input)).ok).toBe(false);
    expect(loadGold()).toBe(300);
    localStorage.setItem(GOLD_KEY, "900");
    const bad = await d.guild.create({ ...input, name: "Fuck Club" });
    expect(bad).toMatchObject({ ok: false, text: "Bu nom odobsiz — boshqasini tanlang" });
    expect(loadGold()).toBe(900);
    expect(localStorage.getItem(GUILD_SPEND_KEY)).toBeNull();
  });

  it("javob yo'qolsa: oltin yechilmaydi, keyin o'sha rid bilan — bitta gildiya, bitta to'lov", async () => {
    const d = await device(srv, 503, 800);
    // server so'rovni bajardi, lekin javob yo'qoldi
    const lossy: Transport = async (op, body, opts) => {
      const r = await srv.transport(op, body, opts);
      if (op === "guild/create") throw new Error("aloqa uzildi");
      return r;
    };
    setTransport(lossy);
    const r = await d.guild.create(input);
    expect(r.ok).toBe(false);
    expect(loadGold()).toBe(800);
    expect(localStorage.getItem(GUILD_SPEND_KEY)).not.toBeNull();
    setTransport(srv.transport);
    await d.guild.refresh();
    expect(loadGold()).toBe(300);
    expect(d.guild.view.state?.guild?.name).toBe("Qal'a Qo'riqchilari");
    expect(srv.store.db.exec("SELECT * FROM guilds").toArray()).toHaveLength(1);
    // yana yangilansa — qayta yechilmaydi
    await d.guild.refresh();
    expect(loadGold()).toBe(300);
  });

  it("chiqish: 24 soatlik cheklov oynada ko'rinadi; sessiya tugasa qisqacha o'chadi", async () => {
    const lead = await device(srv, 504, 900);
    await lead.guild.create(input);
    const id = lead.guild.view.state!.guild!.id;
    const m = await device(srv, 505, 0);
    expect((await m.guild.join(id)).ok).toBe(true);
    expect(cachedGuild()?.tag).toBe("PQ");
    const out = await m.guild.leave();
    expect(out.ok).toBe(true);
    const st = m.guild.view.state;
    expect(st?.guild).toBeNull();
    expect(st && !st.guild && st.cooldown).toBeGreaterThan(Date.now());
    await m.acc.dropSession();
    expect(cachedGuild()).toBeNull();
  });
});

describe("gildiya hayoti (klient)", () => {
  let srv: ReturnType<typeof testServer>;
  beforeEach(() => {
    srv = testServer();
    setTransport(srv.transport);
  });
  afterEach(() => setTransport(null));

  it("daraja foydalari: +XP % (kasr qoldig'i yig'iladi) va kunlik sovg'aga qo'shimcha", async () => {
    const d = await device(srv, 601, 900);
    await d.guild.create(input);
    expect(addXp(10)).toBe(10);
    // 4-daraja: +4 % XP
    srv.store.db.exec("UPDATE guilds SET xp = ?", GUILD_LEVEL_XP[3]!);
    await d.guild.refresh();
    expect(d.guild.level).toBe(4);
    const before = loadXp().xp;
    for (let i = 0; i < 5; i++) addXp(10);
    // 5 × 10 = 50, +4 % = 2 (0.4 dan yig'ilib)
    expect(loadXp().xp - before).toBe(52);
    // 6-daraja: kunlik sovg'aga +5 oltin
    srv.store.db.exec("UPDATE guilds SET xp = ?", GUILD_LEVEL_XP[5]!);
    await d.guild.refresh();
    const gold = loadGold();
    const c = claimGift();
    expect(c?.bonus).toBe(5);
    expect(loadGold() - gold).toBe(c?.gold ?? 0);
    expect(c!.gold).toBe(GIFT_REWARDS[0]! + 5);
  });

  it("xazinaga hissa: oltin faqat muvaffaqiyatdan keyin, chegara oshsa — joyida", async () => {
    const d = await device(srv, 602, 1000);
    await d.guild.create(input);
    expect(loadGold()).toBe(500);
    expect((await d.guild.give(60)).ok).toBe(true);
    expect(loadGold()).toBe(440);
    const over = await d.guild.give(60);
    expect(over).toMatchObject({ ok: false });
    expect(over.text).toContain("chegara");
    expect(loadGold()).toBe(440);
    const st = d.guild.view.state;
    expect(st?.guild && st.given).toBe(60);
  });

  it("topshiriq sovg'asi bir marta olinadi (olingan oxirgi raqam progressda)", async () => {
    const d = await device(srv, 603, 900);
    await d.guild.create(input);
    const me = d.acc.state.me!.id;
    const gid = d.guild.view.state!.guild!.id;
    for (const gold of [25, 50])
      srv.store.db.exec(
        "INSERT INTO guild_rewards (player, guild, gold, kind, week, at) VALUES (?, ?, ?, 'kills', 'w', ?)",
        me,
        gid,
        gold,
        Date.now(),
      );
    let got = 0;
    d.guild.onReward = (g) => {
      got += g;
    };
    const before = loadGold();
    await d.guild.refresh();
    expect(got).toBe(75);
    expect(loadGold() - before).toBe(75);
    await d.guild.refresh();
    expect(loadGold() - before).toBe(75);
    expect(JSON.parse(localStorage.getItem(GUILD_PROGRESS_KEY)!)).toEqual({
      r: expect.any(Number),
    });
  });

  it("chat: yozish, ro'yxat va o'qilmagan belgi", async () => {
    const a = await device(srv, 604, 900);
    await a.guild.create(input);
    const gid = a.guild.view.state!.guild!.id;
    const b = await device(srv, 605, 0);
    await b.guild.join(gid);
    expect((await b.guild.say("Salom hammaga!")).ok).toBe(true);
    expect(b.guild.view.chat.map((m) => m.text)).toEqual(["Salom hammaga!"]);
  });
});
