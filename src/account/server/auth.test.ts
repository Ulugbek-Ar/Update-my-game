// @vitest-environment node
import { describe, expect, it } from "vitest";
import { AUTH_MAX_AGE, LOGIN_TTL } from "../protocol";
import { Limiters, handleApi, type ApiEnv } from "./api";
import { botUpdate } from "./bot";
import { memoryDb } from "./memory-db";
import { AccountStore } from "./store";
import {
  signInitData,
  signLoginWidget,
  verifyInitData,
  verifyLoginWidget,
  webhookSecret,
} from "./telegram";

const TOKEN = "123456789:AAFakeBotTokenForTests_abcdefghijk";
const NOW = 1_780_000_000_000;
const sec = (ms: number) => Math.floor(ms / 1000);

function setup() {
  const store = new AccountStore(memoryDb());
  const lim = new Limiters();
  const env = (over: Partial<ApiEnv> = {}): ApiEnv => ({
    now: NOW,
    ip: "1.2.3.4",
    botToken: TOKEN,
    bot: "PikselQalaBot",
    ...over,
  });
  const api = (op: string, body: unknown, over: Partial<ApiEnv> = {}) =>
    handleApi(store, op, body, env(over), lim);
  return { store, api };
}

describe("Telegram Mini App initData", () => {
  it("accepts a correctly signed, fresh initData", async () => {
    const data = await signInitData({ id: 42, username: "ali_uz" }, TOKEN, sec(NOW) - 60);
    const u = await verifyInitData(data, TOKEN, NOW, AUTH_MAX_AGE);
    expect(u).toEqual({ id: 42, username: "ali_uz" });
  });

  it("rejects a forged or altered initData", async () => {
    const data = await signInitData({ id: 42 }, TOKEN, sec(NOW) - 60);
    // boshqa bot tokeni bilan imzolangan
    const other = await signInitData({ id: 42 }, "999:OtherToken", sec(NOW) - 60);
    expect(await verifyInitData(other, TOKEN, NOW, AUTH_MAX_AGE)).toBeNull();
    // foydalanuvchi o'zgartirilgan (hash eski)
    const p = new URLSearchParams(data);
    p.set("user", JSON.stringify({ id: 7 }));
    expect(await verifyInitData(p.toString(), TOKEN, NOW, AUTH_MAX_AGE)).toBeNull();
    // hash yo'q
    p.delete("hash");
    expect(await verifyInitData(p.toString(), TOKEN, NOW, AUTH_MAX_AGE)).toBeNull();
    expect(await verifyInitData("garbage", TOKEN, NOW, AUTH_MAX_AGE)).toBeNull();
  });

  it("rejects an expired initData", async () => {
    const old = await signInitData({ id: 42 }, TOKEN, sec(NOW) - AUTH_MAX_AGE - 10);
    expect(await verifyInitData(old, TOKEN, NOW, AUTH_MAX_AGE)).toBeNull();
  });

  it("includes every field except hash in the check string (signature too)", async () => {
    const data = await signInitData({ id: 5 }, TOKEN, sec(NOW), { signature: "abc" });
    expect(await verifyInitData(data, TOKEN, NOW, AUTH_MAX_AGE)).toEqual({ id: 5 });
    const p = new URLSearchParams(data);
    p.set("signature", "changed");
    expect(await verifyInitData(p.toString(), TOKEN, NOW, AUTH_MAX_AGE)).toBeNull();
  });
});

describe("Telegram Login Widget", () => {
  it("accepts a correct signature and rejects a fake one", async () => {
    const data = await signLoginWidget(
      { id: 77, first_name: "Vali", username: "vali" },
      TOKEN,
      sec(NOW) - 30,
    );
    expect(await verifyLoginWidget(data, TOKEN, NOW, AUTH_MAX_AGE)).toMatchObject({ id: 77 });
    expect(await verifyLoginWidget({ ...data, id: 78 }, TOKEN, NOW, AUTH_MAX_AGE)).toBeNull();
    expect(
      await verifyLoginWidget({ ...data, hash: "0".repeat(64) }, TOKEN, NOW, AUTH_MAX_AGE),
    ).toBeNull();
    const old = await signLoginWidget({ id: 77 }, TOKEN, sec(NOW) - AUTH_MAX_AGE - 5);
    expect(await verifyLoginWidget(old, TOKEN, NOW, AUTH_MAX_AGE)).toBeNull();
  });
});

describe("login over the API", () => {
  it("Mini App login creates the player once and returns a working session", async () => {
    const { api } = setup();
    const initData = await signInitData({ id: 1001, username: "Botir_07" }, TOKEN, sec(NOW));
    const r = (await api("auth/webapp", { initData, device: "telegram" })) as {
      ok: boolean;
      token: string;
      me: { nick: string; level: number; code: string };
      created: boolean;
    };
    expect(r.ok).toBe(true);
    expect(r.created).toBe(true);
    // Telegram username taxallusga mos — o'zi olinadi
    expect(r.me.nick).toBe("Botir_07");
    expect(r.me.level).toBe(1);
    expect(r.me.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    const me = await api("me", { token: r.token });
    expect(me).toMatchObject({ ok: true, me: { nick: "Botir_07" } });
    // qayta kirish — o'sha o'yinchi
    const again = (await api("auth/webapp", { initData, device: "telegram" })) as {
      created: boolean;
      me: { id: number };
    };
    expect(again.created).toBe(false);
  });

  it("refuses a forged initData and works without a bot only in guest mode", async () => {
    const { api } = setup();
    const forged = await signInitData({ id: 1 }, "1:WrongToken", sec(NOW));
    expect(await api("auth/webapp", { initData: forged, device: "telegram" })).toMatchObject({
      ok: false,
      error: "sign",
    });
    const initData = await signInitData({ id: 1 }, TOKEN, sec(NOW));
    expect(
      await api("auth/webapp", { initData, device: "telegram" }, { botToken: null }),
    ).toMatchObject({ ok: false, error: "server" });
  });

  it("widget login over the API", async () => {
    const { api } = setup();
    const user = await signLoginWidget({ id: 555, username: "x" }, TOKEN, sec(NOW));
    const r = await api("auth/widget", { user, device: "web" });
    // "x" — taxallus uchun juda qisqa: Qahramon1234 ko'rinishida
    expect(r).toMatchObject({ ok: true, me: { nick: expect.stringMatching(/^Qahramon\d{4}$/) } });
  });

  it("logout deletes the session", async () => {
    const { api } = setup();
    const initData = await signInitData({ id: 9 }, TOKEN, sec(NOW));
    const { token } = (await api("auth/webapp", { initData, device: "web" })) as { token: string };
    expect(await api("me", { token })).toMatchObject({ ok: true });
    expect(await api("auth/logout", { token })).toEqual({ ok: true });
    expect(await api("me", { token })).toEqual({ ok: false, error: "auth" });
  });

  it("an expired session is refused", async () => {
    const { store } = setup();
    const { token } = await store.login({ id: 3 }, "android", NOW);
    expect(await store.authenticate(token, NOW + 59 * 86_400_000)).not.toBeNull();
    // 59-kuni foydalanildi — muddat uzaydi; keyin 61 kun hech narsa
    expect(await store.authenticate(token, NOW + 59 * 86_400_000 + 61 * 86_400_000)).toBeNull();
  });
});

describe("bot login code (APK and Windows)", () => {
  async function confirmFlow() {
    const ctx = setup();
    const start = (await ctx.api("auth/bot", { device: "android" })) as {
      ok: true;
      code: string;
      secret: string;
      link: string;
      expires: number;
    };
    return { ...ctx, start };
  }

  const startMsg = (code: string) => ({
    update_id: 1,
    message: {
      message_id: 10,
      chat: { id: 700, type: "private" },
      from: { id: 700, username: "Sardor" },
      text: `/start login_${code}`,
    },
  });
  const press = (code: string, ok = true) => ({
    update_id: 2,
    callback_query: {
      id: "cb1",
      from: { id: 700, username: "Sardor" },
      data: `${ok ? "ok" : "no"}:${code}`,
      message: { message_id: 11, chat: { id: 700 } },
    },
  });

  it("bot link -> confirm button -> the game logs in", async () => {
    const { store, api, start } = await confirmFlow();
    expect(start.ok).toBe(true);
    expect(start.link).toBe(`https://t.me/PikselQalaBot?start=login_${start.code}`);
    expect(start.expires).toBe(NOW + LOGIN_TTL);
    // hali tasdiqlanmagan
    expect(await api("auth/poll", { code: start.code, secret: start.secret })).toEqual({
      ok: true,
      status: "wait",
    });
    // bot /start login_KOD ni oladi — tasdiqlash tugmasi bilan javob
    const calls = botUpdate(store, startMsg(start.code), NOW + 1000, "https://site/");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("sendMessage");
    expect(JSON.stringify(calls[0]!.body)).toContain(`ok:${start.code}`);
    expect(JSON.stringify(calls[0]!.body)).toContain("Android ilova");
    // "Tasdiqlash"
    const done = botUpdate(store, press(start.code), NOW + 2000, "https://site/");
    expect(done.map((c) => c.method)).toEqual(["answerCallbackQuery", "editMessageText"]);
    const r = (await api(
      "auth/poll",
      { code: start.code, secret: start.secret },
      { now: NOW + 3000 },
    )) as { ok: true; status: string; token: string; me: { nick: string } };
    expect(r.status).toBe("done");
    expect(r.me.nick).toBe("Sardor");
    expect(await api("me", { token: r.token })).toMatchObject({ ok: true });
  });

  it("the code is single-use", async () => {
    const { store, api, start } = await confirmFlow();
    botUpdate(store, press(start.code), NOW + 1000, "https://site/");
    const first = await api("auth/poll", { code: start.code, secret: start.secret });
    expect(first).toMatchObject({ ok: true, status: "done" });
    expect(await api("auth/poll", { code: start.code, secret: start.secret })).toMatchObject({
      ok: false,
      error: "expired",
    });
    // eski kod bilan botda qayta tasdiqlab bo'lmaydi
    const again = botUpdate(store, press(start.code), NOW + 2000, "https://site/");
    expect(JSON.stringify(again)).toContain("eskirgan");
  });

  it("the code expires after 5 minutes", async () => {
    const { store, api, start } = await confirmFlow();
    const late = NOW + LOGIN_TTL + 1;
    // botda ham eskirgan
    const calls = botUpdate(store, startMsg(start.code), late, "https://site/");
    expect(JSON.stringify(calls)).toContain("eskirgan");
    expect(store.botConfirm(start.code, { id: 700 }, true, late)).toBe(false);
    expect(
      await api("auth/poll", { code: start.code, secret: start.secret }, { now: late }),
    ).toMatchObject({ ok: false, error: "expired" });
  });

  it("only the device that started the login can take the session", async () => {
    const { store, api, start } = await confirmFlow();
    botUpdate(store, press(start.code), NOW + 1000, "https://site/");
    // kod havolada ko'rinadi, lekin secret yo'q
    expect(await api("auth/poll", { code: start.code, secret: "x".repeat(32) })).toMatchObject({
      ok: false,
      error: "expired",
    });
    // haqiqiy qurilma baribir oladi
    expect(await api("auth/poll", { code: start.code, secret: start.secret })).toMatchObject({
      ok: true,
      status: "done",
    });
  });

  it("cancel button refuses the login", async () => {
    const { store, api, start } = await confirmFlow();
    botUpdate(store, press(start.code, false), NOW + 1000, "https://site/");
    expect(await api("auth/poll", { code: start.code, secret: start.secret })).toMatchObject({
      ok: false,
      error: "expired",
      field: "cancelled",
    });
  });

  it("bot ignores groups and answers a plain /start with the site link", async () => {
    const { store } = setup();
    const group = botUpdate(
      store,
      { message: { chat: { id: -5, type: "group" }, from: { id: 1 }, text: "/start" } },
      NOW,
      "https://site/",
    );
    expect(group).toEqual([]);
    const hi = botUpdate(
      store,
      { message: { chat: { id: 5, type: "private" }, from: { id: 5 }, text: "/start" } },
      NOW,
      "https://site/",
    );
    expect(JSON.stringify(hi)).toContain("https://site/");
  });

  it("rate-limits new login attempts per IP", async () => {
    const { api } = setup();
    let refused = 0;
    for (let i = 0; i < 40; i++) {
      const r = (await api("auth/bot", { device: "windows" })) as { ok: boolean; error?: string };
      if (!r.ok && r.error === "rate") refused++;
    }
    expect(refused).toBeGreaterThan(0);
  });

  it("webhook secret is derived from the bot token", async () => {
    const a = await webhookSecret(TOKEN);
    expect(a).toMatch(/^[0-9a-f]{40}$/);
    expect(await webhookSecret(TOKEN)).toBe(a);
    expect(await webhookSecret("1:other")).not.toBe(a);
  });
});
