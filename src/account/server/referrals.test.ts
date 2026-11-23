// @vitest-environment node
import { describe, expect, it } from "vitest";
import { AccountStore } from "./store";
import { memoryDb } from "./memory-db";
import { SCHEMA } from "./db";
import { botUpdate } from "./bot";
import { MemoryStorage, testServer } from "./testing";
import { REF_DAILY_CAP, REF_GOLD, REF_SKIN_GOAL } from "../protocol";
import { GOLD_KEY } from "@/game/shop";
import {
  REFERRAL_SKIN,
  SKINS_KEY,
  buySkin,
  ownsSkin,
  paidSkinIds,
  parseSkins,
  skinById,
} from "@/game/skins";

const T0 = Date.parse("2026-11-23T08:00:00Z");
const DAY = 86_400_000;
const STATS = "pixel-rpg-stats";

const data = (waves: number, extra: Record<string, string> = {}) => ({
  [STATS]: JSON.stringify({ time: 0, kills: 0, bosses: 0, runs: 0, waves }),
  ...extra,
});

function setup() {
  const store = new AccountStore(memoryDb());
  const put = (id: number, d: Record<string, string>, now = T0) =>
    store.putSave(id, { base: store.saveVersion(id), time: now, device: "web", data: d }, now);
  /** yangi o'yinchi (Telegram ID) — ixtiyoriy taklif kodi bilan */
  const join = (tg: number, ref?: string, now = T0) => store.ensurePlayer({ id: tg }, now, ref);
  const gifts = (id: number) => store.gifts.list(id);
  /** yangi o'yinchi akkaunt bilan 1-to'lqinni tugatdi (birinchi yuklash, keyin to'lqin) */
  const playWave = (id: number, now = T0) => {
    put(id, data(0), now);
    return put(id, data(1), now);
  };
  return { store, put, join, gifts, playWave };
}

describe("do'st chaqirish (server)", () => {
  it("yangi o'yinchi havola orqali kelib 1-to'lqinni tugatsa — ikkalasi 100 oltin (bir marta)", () => {
    const { store, join, gifts, playWave, put } = setup();
    const a = join(1).player;
    const b = join(2, a.code);
    expect(b.created).toBe(true);
    // akkaunt ochildi, lekin hali o'ynamadi — mukofot yo'q
    expect(gifts(a.id)).toHaveLength(0);
    expect(gifts(b.player.id)).toHaveLength(0);
    expect(store.referrals.info(a, "Bot", T0)).toMatchObject({ joined: 1, rewarded: 0 });
    playWave(b.player.id);
    expect(gifts(b.player.id).map((g) => g.gold)).toEqual([REF_GOLD]);
    expect(gifts(a.id).map((g) => g.gold)).toEqual([REF_GOLD]);
    expect(gifts(a.id)[0]!.from).toMatchObject({ nick: "Do'st chaqirish", author: false });
    // yana to'lqinlar — takror mukofot yo'q
    put(b.player.id, data(5));
    expect(gifts(a.id)).toHaveLength(1);
    expect(gifts(b.player.id)).toHaveLength(1);
    // sovg'a olinadi — bulutdagi progressga oltin
    const g = gifts(b.player.id)[0]!;
    const r = store.gifts.claim(b.player, g.id, store.saveVersion(b.player.id), T0);
    expect(r.ok && r.save.data[GOLD_KEY]).toBe(String(REF_GOLD));
    // muallif panelidagi "Yuborilgan sovg'alar"da tizim sovg'alari ko'rinmaydi
    expect(store.gifts.sent()).toHaveLength(0);
    expect(store.referrals.info(a, "Bot", T0)).toMatchObject({ joined: 1, rewarded: 1, queued: 0 });
  });

  it("mehmon progressi (birinchi yuklashda to'lqinlar bor) darhol hisoblanmaydi", () => {
    const { join, gifts, put } = setup();
    const a = join(1).player;
    const b = join(2, a.code).player;
    put(b.id, data(7));
    expect(gifts(b.id)).toHaveLength(0);
    put(b.id, data(7, { [GOLD_KEY]: "10" }));
    expect(gifts(b.id)).toHaveLength(0);
    put(b.id, data(8));
    expect(gifts(b.id)).toHaveLength(1);
    expect(gifts(a.id)).toHaveLength(1);
  });

  it("eski akkaunt havola bilan kirsa — hisoblanmaydi", () => {
    const { store, join, playWave, gifts } = setup();
    const a = join(1).player;
    const old = join(2).player;
    const again = join(2, a.code);
    expect(again.created).toBe(false);
    playWave(old.id);
    expect(gifts(a.id)).toHaveLength(0);
    expect(store.referrals.info(a, null, T0).joined).toBe(0);
  });

  it("bitta yangi akkaunt faqat bir marta: o'chirib qayta ochsa ham", () => {
    const { store, join, playWave, gifts } = setup();
    const a = join(1).player;
    const c = join(3).player;
    const b = join(2, a.code).player;
    playWave(b.id);
    expect(gifts(a.id)).toHaveLength(1);
    store.deleteAccount(b.id);
    // qayta ochdi — boshqa chaqiruvchi kodi bilan ham
    const b2 = join(2, c.code);
    expect(b2.created).toBe(true);
    playWave(b2.player.id);
    expect(gifts(c.id)).toHaveLength(0);
    expect(gifts(b2.player.id)).toHaveLength(0);
    expect(store.referrals.info(c, null, T0).joined).toBe(0);
    // taklifsiz ochib, o'chirib, havola bilan qayta ochsa ham — yangi emas
    const d = join(4).player;
    store.deleteAccount(d.id);
    const d2 = join(4, a.code).player;
    playWave(d2.id);
    expect(gifts(a.id)).toHaveLength(1);
  });

  it("1-to'lqingacha akkauntini o'chirgan do'st uchun chaqiruvchiga mukofot yo'q", () => {
    const { store, join, gifts } = setup();
    const a = join(1).player;
    const b = join(2, a.code).player;
    store.deleteAccount(b.id);
    store.referrals.flush(a.id, T0);
    expect(gifts(a.id)).toHaveLength(0);
    expect(store.referrals.info(a, null, T0)).toMatchObject({ joined: 1, rewarded: 0, queued: 0 });
  });

  it("o'zini o'zi chaqirib bo'lmaydi (bot va kod)", () => {
    const { store, join } = setup();
    const a = join(1).player;
    expect(store.referrals.botStart(1, a.code, T0)).toBe("self");
    // o'z kodini o'zi uchun yozib bo'lmaydi (attach — bir xil o'yinchi)
    expect(store.referrals.attach(a, a.code, T0)).toBe(false);
    expect(store.referrals.info(a, null, T0).joined).toBe(0);
  });

  it("kunlik chegara: kuniga 10 ta mukofot, qolgani ertaga beriladi", () => {
    const { store, join, playWave, gifts } = setup();
    const a = join(1).player;
    const n = REF_DAILY_CAP + 3;
    for (let i = 0; i < n; i++) playWave(join(100 + i, a.code).player.id);
    const gold = () => gifts(a.id).filter((g) => g.gold > 0).length;
    expect(gold()).toBe(REF_DAILY_CAP);
    // yangi o'yinchilar o'z mukofotini baribir oladi
    for (let i = 0; i < n; i++)
      expect(gifts(store.playerByTg(100 + i)!.id).map((g) => g.gold)).toEqual([REF_GOLD]);
    expect(store.referrals.info(a, null, T0)).toMatchObject({
      joined: n,
      rewarded: REF_DAILY_CAP,
      queued: 3,
    });
    // shu kuni qayta so'rash — o'zgarmaydi
    store.referrals.flush(a.id, T0 + 3600_000);
    expect(gold()).toBe(REF_DAILY_CAP);
    // ertasi kuni — navbatdagilar
    expect(store.referrals.info(a, null, T0 + DAY)).toMatchObject({ rewarded: n, queued: 0 });
    expect(gold()).toBe(n);
  });

  it("5 ta do'st — «Chaqiruvchi» skini (bir marta); qo'lda yozilgan skin rad etiladi", () => {
    const { store, join, playWave, gifts, put } = setup();
    const a = join(1).player;
    const cheat = join(2).player;
    put(cheat.id, data(0));
    const fake = JSON.stringify({ owned: [REFERRAL_SKIN], sel: { knight: REFERRAL_SKIN } });
    expect(put(cheat.id, data(0, { [SKINS_KEY]: fake }))).toMatchObject({
      ok: false,
      error: "invalid",
      field: "skin",
    });
    for (let i = 0; i < REF_SKIN_GOAL - 1; i++) playWave(join(100 + i, a.code).player.id);
    expect(gifts(a.id).some((g) => g.skin)).toBe(false);
    playWave(join(200, a.code).player.id);
    const skinGifts = gifts(a.id).filter((g) => g.skin);
    expect(skinGifts.map((g) => g.skin)).toEqual([REFERRAL_SKIN]);
    expect(store.referrals.info(a, null, T0).skin).toBe(true);
    // yana do'stlar — ikkinchi skin yo'q
    playWave(join(300, a.code).player.id);
    expect(gifts(a.id).filter((g) => g.skin)).toHaveLength(1);
    // olish: skin bulutdagi progressga, keyingi saqlanishlar qabul qilinadi
    const g = skinGifts[0]!;
    const r = store.gifts.claim(a, g.id, store.saveVersion(a.id), T0);
    expect(r.ok).toBe(true);
    const saved = store.getSave(a.id)!.data;
    expect(parseSkins(saved[SKINS_KEY]).owned).toContain(REFERRAL_SKIN);
    expect(put(a.id, saved).ok).toBe(true);
  });

  it("bot: /start ref_KOD eslab qoladi, akkaunt ochilganda bog'lanadi; eski o'yinchiga — rad", () => {
    const { store, join, playWave, gifts } = setup();
    const a = join(1).player;
    const msg = (tg: number, text: string) => ({
      message: { chat: { id: tg, type: "private" }, from: { id: tg }, text },
    });
    const calls = botUpdate(store, msg(5, `/start ref_${a.code}`), T0, "https://site/");
    expect(String(calls[0]!.body["text"])).toContain(`ref=${a.code}`);
    // kodsiz kirish (masalan, ilovadan) — botdagi taklif ishlaydi
    const b = join(5).player;
    playWave(b.id);
    expect(gifts(a.id)).toHaveLength(1);
    // eski o'yinchi
    const old = botUpdate(store, msg(5, `/start ref_${a.code}`), T0, "https://site/");
    expect(String(old[0]!.body["text"])).toContain("allaqachon akkaunt");
    // o'zi
    const self = botUpdate(store, msg(1, `/start ref_${a.code}`), T0, "https://site/");
    expect(String(self[0]!.body["text"])).toContain("o'z taklif havolangiz");
    // noma'lum kod — oddiy salomlashuv
    const bad = botUpdate(store, msg(9, "/start ref_ZZZZZZZZ"), T0, "https://site/");
    expect(String(bad[0]!.body["text"])).toContain("O'ynash");
    expect(store.referrals.info(a, null, T0).joined).toBe(1);
  });

  it("API: auth/poll dagi ref va ref/info", async () => {
    const srv = testServer();
    const api = (op: string, body: Record<string, unknown>) =>
      srv.transport(op, body) as Promise<Record<string, unknown> & { ok: boolean }>;
    const a = srv.store.ensurePlayer({ id: 1 }, Date.now()).player;
    const start = (await api("auth/bot", { device: "web" })) as unknown as {
      code: string;
      secret: string;
    };
    srv.store.botConfirm(start.code, { id: 2 }, true, Date.now());
    const r = await api("auth/poll", { code: start.code, secret: start.secret, ref: a.code });
    expect(r).toMatchObject({ ok: true, status: "done", created: true });
    // noto'g'ri kod formati — so'rov rad (eski klientlar ref yubormaydi)
    expect(
      await api("auth/poll", { code: start.code, secret: start.secret, ref: "x" }),
    ).toMatchObject({ ok: false, error: "bad" });
    const token = (await srv.store.login({ id: 1 }, "web", Date.now())).token;
    const info = await api("ref/info", { token });
    expect(info).toMatchObject({ ok: true, code: a.code, bot: "PikselQalaBot", joined: 1 });
    expect((await api("ref/info", { token: "x".repeat(43) })).ok).toBe(false);
  });
});

describe("do'st chaqirish: eski akkauntlar va saqlashlar", () => {
  it("yangi jadvallarsiz eski baza: akkaunt, saqlanish va skinlar buzilmaydi", () => {
    const db = memoryDb();
    // eski versiya: do'st chaqirish jadvallarisiz
    for (const q of SCHEMA) if (!/\breferrals\b|\bref_/.test(q)) db.exec(q);
    const oldSkins = JSON.stringify({ owned: ["knight-gold"], sel: { knight: "knight-gold" } });
    db.exec(
      "INSERT INTO players (tg, nick, nick_key, avatar, code, created, xp) VALUES (10, 'Eski', 'eski', 'knight', 'ABCDEFGH', 1, 0)",
    );
    const id = Number(db.exec<{ id: number }>("SELECT id FROM players").toArray()[0]!.id);
    db.exec(
      "INSERT INTO saves (player, version, time, at, device, dev, data) VALUES (?, 3, 1, 1, 'web', '', ?)",
      id,
      JSON.stringify({ ...data(40), [GOLD_KEY]: "500", [SKINS_KEY]: oldSkins }),
    );
    const store = new AccountStore(db);
    const p = store.playerByTg(10)!;
    expect(store.ensurePlayer({ id: 10 }, T0, "ZZZZZZZZ").created).toBe(false);
    const save = store.getSave(id)!;
    expect(save.version).toBe(3);
    expect(save.data[GOLD_KEY]).toBe("500");
    expect(parseSkins(save.data[SKINS_KEY]).owned).toEqual(["knight-gold"]);
    // eski saqlanish davom etadi (pullik skin bilan) — referral tekshiruvi to'smaydi
    const r = store.putSave(
      id,
      { base: 3, time: T0, device: "web", data: { ...save.data, ...data(41) } },
      T0,
    );
    expect(r).toEqual({ ok: true, version: 4 });
    expect(store.referrals.info(p, null, T0)).toMatchObject({ code: "ABCDEFGH", joined: 0 });
    // eski o'yinchi endi chaqira oladi
    const b = store.ensurePlayer({ id: 11 }, T0, "ABCDEFGH").player;
    store.putSave(b.id, { base: 0, time: T0, device: "web", data: data(0) }, T0);
    store.putSave(b.id, { base: 1, time: T0, device: "web", data: data(1) }, T0);
    expect(store.gifts.list(id).map((g) => g.gold)).toEqual([REF_GOLD]);
  });

  it("«Chaqiruvchi» skini: do'konda sotilmaydi, default emas, pullik ro'yxat o'zgarmagan", () => {
    const skin = skinById("knight", REFERRAL_SKIN)!;
    expect(skin.name).toBe("CHAQIRUVCHI");
    expect(skin.reward).toBe("referral");
    expect(ownsSkin(skin, { owned: [], sel: {} })).toBe(false);
    expect(ownsSkin(skin, { owned: [REFERRAL_SKIN], sel: {} })).toBe(true);
    expect(paidSkinIds()).not.toContain(REFERRAL_SKIN);
    const g = globalThis as { localStorage?: Storage };
    const prev = g.localStorage;
    g.localStorage = new MemoryStorage();
    try {
      let gold = 10_000;
      expect(buySkin("knight", REFERRAL_SKIN, { get: () => gold, set: (n) => (gold = n) })).toBe(
        false,
      );
      expect(gold).toBe(10_000);
    } finally {
      if (prev) g.localStorage = prev;
      else delete g.localStorage;
    }
  });
});
