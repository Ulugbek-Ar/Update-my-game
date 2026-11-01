// @vitest-environment node
/**
 * Gildiyalar (server): tuzish (oltin, takrorlanmas nom va teg, filtr), qo'shilish usullari,
 * rollar huquqlari, 24 soatlik cheklov, sig'im, qidirish va akkaunt o'chirilganda.
 */
import { describe, expect, it } from "vitest";
import { Limiters, handleApi } from "./api";
import { memoryDb } from "./memory-db";
import { AccountStore } from "./store";
import { TEST_BOT_TOKEN } from "./testing";
import {
  GUILD_COST,
  REJOIN_MS,
  checkGuildName,
  checkGuildTag,
  emblemAllowed,
  guildCap,
  parseEmblem,
} from "../guildRules";

const NOW = 1_780_000_000_000;
const H = 3_600_000;

type R = Record<string, unknown> & { ok: boolean; error?: string };

async function world() {
  const store = new AccountStore(memoryDb());
  const lim = new Limiters();
  let now = NOW;
  let ip = 0;
  const api = (op: string, body: unknown) =>
    handleApi(
      store,
      op,
      body,
      { now, ip: `10.0.${ip++ % 250}.1`, botToken: TEST_BOT_TOKEN, bot: "B" },
      lim,
    ) as Promise<R>;
  let tg = 100;
  /** Yangi o'yinchi (bulutda oltin bilan — tuzish narxini tekshirish uchun) */
  const user = async (nick: string, gold = 1000) => {
    const r = await store.login({ id: tg++, username: nick }, "web", now);
    store.putSave(
      r.me.id,
      { base: 0, time: now, device: "web", data: { "pixel-rpg-gold": String(gold) } },
      now,
    );
    return { token: r.token, id: r.me.id, nick, gold };
  };
  let rid = 0;
  const create = (
    u: { token: string; gold: number },
    name: string,
    tag: string,
    extra: Record<string, unknown> = {},
  ) =>
    api("guild/create", {
      token: u.token,
      name,
      tag,
      emblem: "0-1-3-0",
      mode: "open",
      lang: "uz",
      gold: u.gold,
      rid: `rid-${String(rid++).padStart(6, "0")}`,
      ...extra,
    });
  return {
    store,
    api,
    user,
    create,
    tick: (ms: number) => {
      now += ms;
    },
  };
}

describe("gildiya qoidalari", () => {
  it("nom: 3–20 belgi, apostrof va bo'shliq, haqoratli so'zlar va aralash yozuv yo'q", () => {
    expect(checkGuildName("Qal'a Qo'riqchilari")).toEqual({
      ok: true,
      name: "Qal'a Qo'riqchilari",
    });
    expect(checkGuildName("  Oq   Bo'rilar ")).toEqual({ ok: true, name: "Oq Bo'rilar" });
    expect(checkGuildName("Qoʻriqchilar").ok).toBe(true);
    expect(checkGuildName("Ab")).toEqual({ ok: false, error: "length" });
    expect(checkGuildName("A".repeat(21))).toEqual({ ok: false, error: "length" });
    expect(checkGuildName("Fuck Club")).toEqual({ ok: false, error: "bad" });
    expect(checkGuildName("Сука клан")).toEqual({ ok: false, error: "bad" });
    expect(checkGuildName("Qal'a <script>")).toEqual({ ok: false, error: "chars" });
    expect(checkGuildName("Mixed Кирилл")).toEqual({ ok: false, error: "script" });
    expect(checkGuildName("12345")).toEqual({ ok: false, error: "letter" });
    expect(checkGuildName("Admin Team")).toEqual({ ok: false, error: "reserved" });
  });

  it("teg: 2–4 harf (katta harfga), filtr", () => {
    expect(checkGuildTag("pq")).toEqual({ ok: true, name: "PQ" });
    expect(checkGuildTag("[QQ1]")).toEqual({ ok: true, name: "QQ1" });
    expect(checkGuildTag("P")).toEqual({ ok: false, error: "length" });
    expect(checkGuildTag("ABCDE")).toEqual({ ok: false, error: "length" });
    expect(checkGuildTag("FUCK")).toEqual({ ok: false, error: "bad" });
    expect(checkGuildTag("XUY")).toEqual({ ok: false, error: "bad" });
    expect(checkGuildTag("P!")).toEqual({ ok: false, error: "chars" });
  });

  it("gerb: 1-darajada asosiy ranglar va belgilar, keyingilari daraja bilan", () => {
    const e = parseEmblem("0-1-3-0")!;
    expect(emblemAllowed(e, 1)).toBe(true);
    // ikki rang bir xil — yo'q
    expect(emblemAllowed(parseEmblem("0-1-1-0")!, 1)).toBe(false);
    // qaqnus (12) — 10-daraja, oltin rang (12) — 8-daraja
    expect(emblemAllowed(parseEmblem("2-0-3-12")!, 1)).toBe(false);
    expect(emblemAllowed(parseEmblem("2-0-3-12")!, 10)).toBe(true);
    expect(emblemAllowed(parseEmblem("1-12-5-0")!, 7)).toBe(false);
    expect(emblemAllowed(parseEmblem("1-12-5-0")!, 8)).toBe(true);
    expect(parseEmblem("3-0-0-0")).toBeNull();
    expect(parseEmblem("x")).toBeNull();
  });
});

describe("gildiya tuzish", () => {
  it("oltin yetmasa — rad; yetsa — gildiya, rahbar va narx", async () => {
    const w = await world();
    const poor = await w.user("Kambag'al".replace("'", ""), 120);
    expect(await w.create(poor, "Kambag'allar", "KB")).toMatchObject({ ok: false, error: "gold" });
    const a = await w.user("Ulugbek", 800);
    const r = await w.create(a, "Qal'a Qo'riqchilari", "pq");
    expect(r).toMatchObject({ ok: true, cost: GUILD_COST });
    expect(r["guild"]).toMatchObject({ name: "Qal'a Qo'riqchilari", tag: "PQ", level: 1 });
    const st = await w.api("guild/get", { token: a.token });
    expect(st).toMatchObject({ ok: true, role: "leader" });
    expect((st["members"] as unknown[]).length).toBe(1);
  });

  it("klient aytgan oltin bulutdagidan juda ko'p bo'lsa — imkonsiz (rad)", async () => {
    const w = await world();
    const a = await w.user("Hiylakor", 0);
    // bulutda 0, klient 1 000 000 deydi — o'sish chegarasi 3 000
    expect(await w.create({ ...a, gold: 1_000_000 }, "Hiylalar", "HL")).toMatchObject({
      ok: false,
      error: "invalid",
    });
    // bulutda 0, lekin shu orada o'ynab 600 topgan bo'lishi mumkin — ruxsat
    expect(await w.create({ ...a, gold: 600 }, "Halollar", "HA")).toMatchObject({ ok: true });
  });

  it("nom va teg takrorlanmaydi (katta-kichik harf va apostrof farqsiz)", async () => {
    const w = await world();
    const a = await w.user("Birinchi");
    const b = await w.user("Ikkinchi");
    expect((await w.create(a, "Qal'a Qo'riqchilari", "PQ")).ok).toBe(true);
    expect(await w.create(b, "qala qoriqchilari", "ZZ")).toMatchObject({
      ok: false,
      error: "taken",
      field: "name",
    });
    expect(await w.create(b, "Boshqa Nom", "pq")).toMatchObject({
      ok: false,
      error: "taken",
      field: "tag",
    });
    expect(await w.create(b, "Fuck Club", "FC")).toMatchObject({
      ok: false,
      error: "name",
      field: "name",
      why: "bad",
    });
    expect(await w.create(b, "Yaxshi Nom", "SUKA")).toMatchObject({
      ok: false,
      error: "name",
      field: "tag",
      why: "bad",
    });
  });

  it("ochilmagan gerb rad etiladi; gildiyadagi o'yinchi ikkinchisini tuza olmaydi", async () => {
    const w = await world();
    const a = await w.user("Gerbchi");
    expect(await w.create(a, "Qaqnuslar", "QQ", { emblem: "0-0-3-12" })).toMatchObject({
      ok: false,
      error: "bad",
      field: "emblem",
    });
    expect((await w.create(a, "Qaqnuslar", "QQ")).ok).toBe(true);
    expect(await w.create(a, "Yana Biri", "YB")).toMatchObject({ ok: false, error: "guild" });
  });

  it("takroriy so'rov (bir xil rid) ikkinchi gildiya tuzmaydi — dup", async () => {
    const w = await world();
    const a = await w.user("Takror");
    const body = {
      token: a.token,
      name: "Bir Martalik",
      tag: "BM",
      emblem: "0-1-3-0",
      mode: "open",
      lang: "uz",
      gold: 900,
      rid: "same-rid-123",
    };
    expect(await w.api("guild/create", body)).toMatchObject({ ok: true });
    expect(await w.api("guild/create", body)).toMatchObject({ ok: true, dup: true });
    expect(w.store.db.exec("SELECT * FROM guilds").toArray().length).toBe(1);
  });
});

describe("qo'shilish usullari", () => {
  it("ochiq — darhol; ariza bilan — tasdiqlash; faqat taklif — taklif bilan", async () => {
    const w = await world();
    const lead = await w.user("Rahbar");
    const g = (await w.create(lead, "Ochiq Eshik", "OE"))["guild"] as { id: number };
    const a = await w.user("Ali");
    expect(await w.api("guild/join", { token: a.token, id: g.id })).toMatchObject({
      ok: true,
      joined: true,
    });

    await w.api("guild/settings", { token: lead.token, mode: "apply" });
    const b = await w.user("Bobur");
    expect(await w.api("guild/join", { token: b.token, id: g.id })).toMatchObject({
      ok: true,
      joined: false,
      applied: true,
    });
    const before = await w.api("guild/get", { token: b.token });
    expect(before["guild"]).toBeNull();
    expect((before["applications"] as unknown[]).length).toBe(1);
    // oddiy a'zo arizani qabul qila olmaydi
    expect(
      await w.api("guild/answer", { token: a.token, player: b.id, accept: true }),
    ).toMatchObject({ ok: false, error: "perm" });
    expect(
      await w.api("guild/answer", { token: lead.token, player: b.id, accept: true }),
    ).toMatchObject({ ok: true });
    expect((await w.api("guild/get", { token: b.token }))["role"]).toBe("member");

    await w.api("guild/settings", { token: lead.token, mode: "invite" });
    const c = await w.user("Charos");
    expect(await w.api("guild/join", { token: c.token, id: g.id })).toMatchObject({
      ok: false,
      error: "invite",
    });
    expect(await w.api("guild/invite", { token: lead.token, query: "charos" })).toMatchObject({
      ok: true,
      joined: false,
      nick: "Charos",
    });
    const inv = await w.api("guild/get", { token: c.token });
    expect((inv["invites"] as { by: string }[])[0]?.by).toBe("Rahbar");
    expect(await w.api("guild/reply", { token: c.token, id: g.id, accept: true })).toMatchObject({
      ok: true,
      joined: true,
    });
    expect((await w.api("guild/get", { token: lead.token }))["members"]).toHaveLength(4);
  });

  it("ariza yuborgan o'yinchini taklif qilish — darhol qabul; qo'shilgach boshqa arizalar o'chadi", async () => {
    const w = await world();
    const l1 = await w.user("Birov");
    const l2 = await w.user("Ikkov");
    const g1 = (await w.create(l1, "Birinchi Gildiya", "BG", { mode: "apply" }))["guild"] as {
      id: number;
    };
    const g2 = (await w.create(l2, "Ikkinchi Gildiya", "IG", { mode: "apply" }))["guild"] as {
      id: number;
    };
    const p = await w.user("Sayyoh");
    await w.api("guild/join", { token: p.token, id: g1.id });
    await w.api("guild/join", { token: p.token, id: g2.id });
    expect(await w.api("guild/invite", { token: l1.token, query: "Sayyoh" })).toMatchObject({
      ok: true,
      joined: true,
    });
    // ikkinchi gildiyadagi arizasi o'chdi
    const st = await w.api("guild/get", { token: l2.token });
    expect(st["requests"]).toEqual([]);
  });

  it("gildiya to'la bo'lsa (1-daraja — 20 a'zo) yangi a'zo qo'shilmaydi", async () => {
    const w = await world();
    const lead = await w.user("Sardor");
    const g = (await w.create(lead, "Katta Oila", "KO"))["guild"] as { id: number };
    for (let i = 1; i < guildCap(1); i++) {
      const u = await w.user(`Azo${i}`);
      expect((await w.api("guild/join", { token: u.token, id: g.id })).ok).toBe(true);
    }
    const late = await w.user("Kechikkan");
    expect(await w.api("guild/join", { token: late.token, id: g.id })).toMatchObject({
      ok: false,
      error: "full",
    });
  });
});

describe("rollar va huquqlar", () => {
  async function guildOf4() {
    const w = await world();
    const lead = await w.user("Rahbar");
    const g = (await w.create(lead, "Rollar Uyi", "RU"))["guild"] as { id: number };
    const [o, m1, m2] = [await w.user("Orinbosar"), await w.user("Azo1"), await w.user("Azo2")];
    for (const u of [o, m1, m2]) await w.api("guild/join", { token: u.token, id: g.id });
    await w.api("guild/role", { token: lead.token, player: o.id, role: "officer" });
    return { w, lead, o, m1, m2, g };
  }

  it("a'zo boshqani chiqara olmaydi; o'rinbosar — faqat a'zoni; rahbar — o'rinbosarni ham", async () => {
    const { w, lead, o, m1, m2 } = await guildOf4();
    expect(await w.api("guild/kick", { token: m1.token, player: m2.id })).toMatchObject({
      ok: false,
      error: "perm",
    });
    expect(await w.api("guild/kick", { token: o.token, player: lead.id })).toMatchObject({
      ok: false,
      error: "perm",
    });
    expect(await w.api("guild/kick", { token: o.token, player: m2.id })).toMatchObject({
      ok: true,
    });
    expect(await w.api("guild/kick", { token: lead.token, player: o.id })).toMatchObject({
      ok: true,
    });
    const st = await w.api("guild/get", { token: lead.token });
    expect((st["members"] as { nick: string }[]).map((m) => m.nick)).toEqual(["Rahbar", "Azo1"]);
  });

  it("rol berish: o'rinbosar faqat ko'taradi, rahbar tushiradi ham; o'rinbosarlar 3 tadan oshmaydi", async () => {
    const { w, lead, o, m1, m2, g } = await guildOf4();
    expect(
      await w.api("guild/role", { token: m1.token, player: m2.id, role: "officer" }),
    ).toMatchObject({ ok: false, error: "perm" });
    expect(
      await w.api("guild/role", { token: o.token, player: m1.id, role: "officer" }),
    ).toMatchObject({ ok: true });
    // o'rinbosar boshqa o'rinbosarni tushira olmaydi
    expect(
      await w.api("guild/role", { token: o.token, player: m1.id, role: "member" }),
    ).toMatchObject({ ok: false, error: "perm" });
    expect(
      await w.api("guild/role", { token: lead.token, player: m2.id, role: "officer" }),
    ).toMatchObject({ ok: true });
    const extra = await w.user("Tortinchi");
    await w.api("guild/join", { token: extra.token, id: g.id });
    expect(
      await w.api("guild/role", { token: lead.token, player: extra.id, role: "officer" }),
    ).toMatchObject({ ok: false, error: "limit" });
    expect(
      await w.api("guild/role", { token: lead.token, player: m1.id, role: "member" }),
    ).toMatchObject({ ok: true });
  });

  it("rahbarlikni topshirish va tarqatish; rahbar a'zolari bor holda chiqa olmaydi", async () => {
    const { w, lead, o, m1, g } = await guildOf4();
    expect(await w.api("guild/leave", { token: lead.token })).toMatchObject({
      ok: false,
      error: "perm",
    });
    expect(await w.api("guild/transfer", { token: o.token, player: m1.id })).toMatchObject({
      ok: false,
      error: "perm",
    });
    expect(await w.api("guild/transfer", { token: lead.token, player: m1.id })).toMatchObject({
      ok: true,
    });
    const st = await w.api("guild/get", { token: lead.token });
    expect(st["role"]).toBe("officer");
    expect((st["guild"] as { leader: string }).leader).toBe("Azo1");
    // eski rahbar endi tarqata olmaydi, yangisi — ha
    expect(await w.api("guild/disband", { token: lead.token, confirm: true })).toMatchObject({
      ok: false,
      error: "perm",
    });
    expect(await w.api("guild/disband", { token: m1.token, confirm: true })).toMatchObject({
      ok: true,
    });
    expect((await w.api("guild/get", { token: o.token }))["guild"]).toBeNull();
    expect(await w.api("guild/info", { id: g.id })).toMatchObject({ ok: false, error: "none" });
  });

  it("sozlamalar va gerb — faqat rahbar; gerb darajaga qarab", async () => {
    const { w, lead, o } = await guildOf4();
    expect(await w.api("guild/settings", { token: o.token, lang: "ru" })).toMatchObject({
      ok: false,
      error: "perm",
    });
    expect(
      await w.api("guild/settings", { token: lead.token, lang: "ru", emblem: "2-4-6-5" }),
    ).toMatchObject({ ok: true });
    expect(await w.api("guild/settings", { token: lead.token, emblem: "2-4-6-12" })).toMatchObject({
      ok: false,
      error: "bad",
    });
    const st = await w.api("guild/get", { token: o.token });
    expect(st["guild"]).toMatchObject({ lang: "ru", emblem: "2-4-6-5" });
  });
});

describe("24 soatlik cheklov", () => {
  it("chiqqan o'yinchi 24 soat boshqa gildiyaga qo'shila olmaydi va yangisini tuza olmaydi", async () => {
    const w = await world();
    const l1 = await w.user("Birinchi");
    const l2 = await w.user("Ikkinchi");
    const g1 = (await w.create(l1, "Eski Uy", "EU"))["guild"] as { id: number };
    const g2 = (await w.create(l2, "Yangi Uy", "YU"))["guild"] as { id: number };
    const p = await w.user("Sakrovchi");
    await w.api("guild/join", { token: p.token, id: g1.id });
    expect(await w.api("guild/leave", { token: p.token })).toMatchObject({ ok: true });
    const r = await w.api("guild/join", { token: p.token, id: g2.id });
    expect(r).toMatchObject({ ok: false, error: "cooldown" });
    expect(r["until"]).toBe(NOW + REJOIN_MS);
    expect(await w.create(p, "Uchinchi Uy", "UU")).toMatchObject({ ok: false, error: "cooldown" });
    expect((await w.api("guild/get", { token: p.token }))["cooldown"]).toBe(NOW + REJOIN_MS);
    // taklif ham kutadi
    await w.api("guild/settings", { token: l2.token, mode: "invite" });
    await w.api("guild/invite", { token: l2.token, query: "Sakrovchi" });
    expect(await w.api("guild/reply", { token: p.token, id: g2.id, accept: true })).toMatchObject({
      ok: false,
      error: "cooldown",
    });
    w.tick(23 * H);
    expect((await w.api("guild/join", { token: p.token, id: g1.id })).error).toBe("cooldown");
    w.tick(H + 1);
    expect(await w.api("guild/reply", { token: p.token, id: g2.id, accept: true })).toMatchObject({
      ok: true,
      joined: true,
    });
  });

  it("chiqarilgan o'yinchiga cheklov yo'q", async () => {
    const w = await world();
    const l1 = await w.user("Qattiq");
    const l2 = await w.user("Yumshoq");
    const g1 = (await w.create(l1, "Qattiqlar", "QT"))["guild"] as { id: number };
    const g2 = (await w.create(l2, "Yumshoqlar", "YM"))["guild"] as { id: number };
    const p = await w.user("Quvilgan");
    await w.api("guild/join", { token: p.token, id: g1.id });
    await w.api("guild/kick", { token: l1.token, player: p.id });
    expect(await w.api("guild/join", { token: p.token, id: g2.id })).toMatchObject({
      ok: true,
      joined: true,
    });
  });
});

describe("qidirish, teg ko'rinishi va akkaunt o'chirilishi", () => {
  it("qidirish: nomi qismi, tegi va tili bo'yicha; a'zolar soni va daraja", async () => {
    const w = await world();
    const a = await w.user("Aziz");
    const b = await w.user("Bahrom");
    await w.create(a, "Qal'a Qo'riqchilari", "PQ");
    await w.create(b, "Tungi Bo'rilar", "TB", { lang: "ru" });
    const all = await w.api("guild/search", { query: "" });
    expect((all["guilds"] as unknown[]).length).toBe(2);
    const byName = await w.api("guild/search", { query: "qo'riq" });
    expect((byName["guilds"] as { tag: string }[]).map((g) => g.tag)).toEqual(["PQ"]);
    const byTag = await w.api("guild/search", { query: "[tb]" });
    expect(byTag["guilds"]).toMatchObject([{ tag: "TB", members: 1, level: 1, cap: 20 }]);
    const ru = await w.api("guild/search", { query: "", lang: "ru" });
    expect((ru["guilds"] as { tag: string }[]).map((g) => g.tag)).toEqual(["TB"]);
  });

  it("teg va gerb: reytingda, do'stlar ro'yxatida va olam xonasi uchun", async () => {
    const w = await world();
    const a = await w.user("Tegli");
    const b = await w.user("Dost");
    await w.create(a, "Tegli Gildiya", "TG", { emblem: "2-0-3-1" });
    expect(w.store.guilds.badgeOf(a.id)).toMatchObject({ tag: "TG", emblem: "2-0-3-1" });
    expect(w.store.guilds.badgeOf(b.id)).toBeNull();
    await w.api("scores/submit", {
      token: a.token,
      mode: "world",
      hero: "knight",
      score: 900,
      wave: 3,
      time: 200,
      won: false,
    });
    const top = await w.api("scores/top", { board: "w1:knight", period: "all" });
    expect((top["rows"] as { guild?: unknown }[])[0]?.guild).toEqual({
      tag: "TG",
      emblem: "2-0-3-1",
    });
    await w.api("friends/add", { token: b.token, query: "Tegli" });
    await w.api("friends/answer", { token: a.token, id: b.id, accept: true });
    const fl = await w.api("friends/list", { token: b.token });
    expect((fl["friends"] as { guild?: unknown }[])[0]?.guild).toEqual({
      tag: "TG",
      emblem: "2-0-3-1",
    });
    // onlayn holat javobida gildiya qisqachasi
    const pr = await w.api("presence", { token: a.token, place: "menu" });
    expect(pr["guild"]).toMatchObject({
      guild: { tag: "TG", role: "leader", level: 1 },
      pending: 0,
    });
  });

  it("rahbar akkauntini o'chirsa — rahbarlik eng eski o'rinbosarga; oxirgisi o'chsa — gildiya ham", async () => {
    const w = await world();
    const lead = await w.user("Ketuvchi");
    const g = (await w.create(lead, "Meros Uyi", "MU"))["guild"] as { id: number };
    const m = await w.user("Azo");
    const o = await w.user("Orinbosar");
    await w.api("guild/join", { token: m.token, id: g.id });
    await w.api("guild/join", { token: o.token, id: g.id });
    await w.api("guild/role", { token: lead.token, player: o.id, role: "officer" });
    await w.api("account/delete", { token: lead.token, confirm: true });
    const st = await w.api("guild/get", { token: o.token });
    expect(st["role"]).toBe("leader");
    expect(st["members"]).toHaveLength(2);
    await w.api("account/delete", { token: m.token, confirm: true });
    await w.api("account/delete", { token: o.token, confirm: true });
    expect(w.store.db.exec("SELECT * FROM guilds").toArray()).toEqual([]);
    expect(w.store.db.exec("SELECT * FROM guild_log").toArray()).toEqual([]);
  });
});
