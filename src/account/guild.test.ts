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
import { GuildManager, cachedGuild } from "./guild";
import { GUILD_SPEND_KEY } from "./keys";
import { MemoryStorage, testServer } from "./server/testing";
import { GOLD_KEY, loadGold } from "@/game/shop";

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
