// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Limiters, handleApi } from "./api";
import { memoryDb } from "./memory-db";
import { AccountStore } from "./store";
import { TEST_BOT_TOKEN } from "./testing";
import { MAX_OUTGOING, ONLINE_MS, formatFriendCode } from "../protocol";

const NOW = 1_780_000_000_000;

async function world() {
  const store = new AccountStore(memoryDb());
  const lim = new Limiters();
  let now = NOW;
  const api = (op: string, body: unknown) =>
    handleApi(
      store,
      op,
      body,
      { now, ip: "x", botToken: TEST_BOT_TOKEN, bot: "B" },
      lim,
    ) as Promise<Record<string, unknown> & { ok: boolean }>;
  const user = async (tg: number, nick: string) => {
    const r = await store.login({ id: tg, username: nick }, "web", now);
    return { token: r.token, id: r.me.id, code: r.me.code, nick };
  };
  return {
    store,
    api,
    user,
    at: (t: number) => {
      now = t;
    },
  };
}

type Lists = {
  friends: {
    id: number;
    nick: string;
    online: boolean;
    place: string | null;
    room: string | null;
  }[];
  incoming: { id: number }[];
  outgoing: { id: number }[];
  blocked: { id: number }[];
};

describe("friends", () => {
  it("request by nickname -> accept -> both are friends", async () => {
    const w = await world();
    const ali = await w.user(1, "Ali_01");
    const vali = await w.user(2, "Vali_02");
    expect(await w.api("friends/add", { token: ali.token, query: "vali_02" })).toMatchObject({
      ok: true,
      accepted: false,
    });
    const v = (await w.api("friends/list", { token: vali.token })) as unknown as Lists;
    expect(v.incoming.map((x) => x.id)).toEqual([ali.id]);
    const a = (await w.api("friends/list", { token: ali.token })) as unknown as Lists;
    expect(a.outgoing.map((x) => x.id)).toEqual([vali.id]);
    expect(await w.api("friends/answer", { token: vali.token, id: ali.id, accept: true })).toEqual({
      ok: true,
    });
    const a2 = (await w.api("friends/list", { token: ali.token })) as unknown as Lists;
    const v2 = (await w.api("friends/list", { token: vali.token })) as unknown as Lists;
    expect(a2.friends.map((x) => x.nick)).toEqual(["Vali_02"]);
    expect(v2.friends.map((x) => x.nick)).toEqual(["Ali_01"]);
    expect(a2.outgoing).toEqual([]);
  });

  it("request by friend code (with dash, any case) and reject", async () => {
    const w = await world();
    const ali = await w.user(1, "Ali_01");
    const vali = await w.user(2, "Vali_02");
    const code = formatFriendCode(vali.code).toLowerCase();
    expect(await w.api("friends/add", { token: ali.token, query: code })).toMatchObject({
      ok: true,
    });
    expect(await w.api("friends/answer", { token: vali.token, id: ali.id, accept: false })).toEqual(
      { ok: true },
    );
    const a = (await w.api("friends/list", { token: ali.token })) as unknown as Lists;
    expect(a.outgoing).toEqual([]);
    expect(a.friends).toEqual([]);
  });

  it("mutual requests become a friendship right away", async () => {
    const w = await world();
    const ali = await w.user(1, "Ali_01");
    const vali = await w.user(2, "Vali_02");
    await w.api("friends/add", { token: ali.token, query: "Vali_02" });
    expect(await w.api("friends/add", { token: vali.token, query: "Ali_01" })).toMatchObject({
      ok: true,
      accepted: true,
    });
  });

  it("unknown player, self and limits", async () => {
    const w = await world();
    const ali = await w.user(1, "Ali_01");
    expect(await w.api("friends/add", { token: ali.token, query: "Nobody_99" })).toEqual({
      ok: false,
      error: "none",
    });
    expect(await w.api("friends/add", { token: ali.token, query: "Ali_01" })).toEqual({
      ok: false,
      error: "none",
    });
    for (let i = 0; i < MAX_OUTGOING; i++) {
      await w.user(100 + i, `Player_${i}`);
      expect(await w.api("friends/add", { token: ali.token, query: `Player_${i}` })).toMatchObject({
        ok: true,
      });
    }
    await w.user(999, "Extra_1");
    expect(await w.api("friends/add", { token: ali.token, query: "Extra_1" })).toEqual({
      ok: false,
      error: "limit",
    });
  });

  it("block: friendship ends, no requests or messages from them", async () => {
    const w = await world();
    const ali = await w.user(1, "Ali_01");
    const vali = await w.user(2, "Vali_02");
    await w.api("friends/add", { token: ali.token, query: "Vali_02" });
    await w.api("friends/answer", { token: vali.token, id: ali.id, accept: true });
    expect(await w.api("friends/block", { token: vali.token, id: ali.id })).toEqual({ ok: true });
    const a = (await w.api("friends/list", { token: ali.token })) as unknown as Lists;
    expect(a.friends).toEqual([]);
    const v = (await w.api("friends/list", { token: vali.token })) as unknown as Lists;
    expect(v.blocked.map((x) => x.id)).toEqual([ali.id]);
    // Ali qayta so'rov yubora olmaydi (bloklanganini bilmaydi — "topilmadi")
    expect(await w.api("friends/add", { token: ali.token, query: "Vali_02" })).toEqual({
      ok: false,
      error: "none",
    });
    expect(await w.api("friends/msg", { token: ali.token, to: vali.id, phrase: 0 })).toEqual({
      ok: false,
      error: "none",
    });
    // blokdan chiqarilgach — yana so'rov mumkin
    await w.api("friends/unblock", { token: vali.token, id: ali.id });
    expect(await w.api("friends/add", { token: ali.token, query: "Vali_02" })).toMatchObject({
      ok: true,
    });
  });

  it("remove a friend", async () => {
    const w = await world();
    const ali = await w.user(1, "Ali_01");
    const vali = await w.user(2, "Vali_02");
    await w.api("friends/add", { token: ali.token, query: "Vali_02" });
    await w.api("friends/answer", { token: vali.token, id: ali.id, accept: true });
    await w.api("friends/remove", { token: ali.token, id: vali.id });
    const v = (await w.api("friends/list", { token: vali.token })) as unknown as Lists;
    expect(v.friends).toEqual([]);
  });

  it("online/offline, where and the realm room — only for friends", async () => {
    const w = await world();
    const ali = await w.user(1, "Ali_01");
    const vali = await w.user(2, "Vali_02");
    const sardor = await w.user(3, "Sardor_03");
    await w.api("friends/add", { token: ali.token, query: "Vali_02" });
    await w.api("friends/answer", { token: vali.token, id: ali.id, accept: true });
    await w.api("presence", { token: vali.token, place: "realm", room: "K7QW2M" });
    const a = (await w.api("friends/list", { token: ali.token })) as unknown as Lists;
    expect(a.friends[0]).toMatchObject({ online: true, place: "realm", room: "K7QW2M" });
    // do'st bo'lmagan — so'rovlar ro'yxatida xona ko'rinmaydi
    await w.api("friends/add", { token: sardor.token, query: "Vali_02" });
    const v = (await w.api("friends/list", { token: vali.token })) as unknown as Lists & {
      incoming: { room: string | null }[];
    };
    expect(v.incoming[0]!.room).toBeNull();
    // 5 daqiqa holat yo'q — oflayn
    w.at(NOW + ONLINE_MS + 1000);
    const a2 = (await w.api("friends/list", { token: ali.token })) as unknown as Lists;
    expect(a2.friends[0]).toMatchObject({ online: false, place: null, room: null });
    // ilova yopildi — darhol oflayn
    w.at(NOW + ONLINE_MS + 2000);
    await w.api("presence", { token: vali.token, place: "menu" });
    expect(
      ((await w.api("friends/list", { token: ali.token })) as unknown as Lists).friends[0]!.online,
    ).toBe(true);
    await w.api("presence", { token: vali.token, place: "off" });
    expect(
      ((await w.api("friends/list", { token: ali.token })) as unknown as Lists).friends[0]!.online,
    ).toBe(false);
  });

  it("quick phrases go only to friends and are delivered once", async () => {
    const w = await world();
    const ali = await w.user(1, "Ali_01");
    const vali = await w.user(2, "Vali_02");
    expect(await w.api("friends/msg", { token: ali.token, to: vali.id, phrase: 1 })).toEqual({
      ok: false,
      error: "none",
    });
    await w.api("friends/add", { token: ali.token, query: "Vali_02" });
    const beat = await w.api("presence", { token: vali.token, place: "menu" });
    expect(beat).toMatchObject({ ok: true, requests: 1, messages: [] });
    await w.api("friends/answer", { token: vali.token, id: ali.id, accept: true });
    expect(await w.api("friends/msg", { token: ali.token, to: vali.id, phrase: 1 })).toEqual({
      ok: true,
    });
    // erkin matn yo'q: noma'lum ibora raqami — so'rov xato
    expect(await w.api("friends/msg", { token: ali.token, to: vali.id, phrase: 99 })).toEqual({
      ok: false,
      error: "bad",
    });
    const got = (await w.api("presence", { token: vali.token, place: "menu" })) as unknown as {
      messages: { nick: string; phrase: number }[];
    };
    expect(got.messages).toEqual([expect.objectContaining({ nick: "Ali_01", phrase: 1 })]);
    const again = (await w.api("presence", { token: vali.token, place: "menu" })) as unknown as {
      messages: unknown[];
    };
    expect(again.messages).toEqual([]);
  });

  it("presence is not rewritten every minute when nothing changed", async () => {
    const w = await world();
    const ali = await w.user(1, "Ali_01");
    const before = (w.store.db as unknown as { rowsWritten: () => number }).rowsWritten();
    await w.api("presence", { token: ali.token, place: "menu" });
    const one = (w.store.db as unknown as { rowsWritten: () => number }).rowsWritten();
    w.at(NOW + 60_000);
    await w.api("presence", { token: ali.token, place: "menu" });
    w.at(NOW + 120_000);
    await w.api("presence", { token: ali.token, place: "menu" });
    const three = (w.store.db as unknown as { rowsWritten: () => number }).rowsWritten();
    expect(one - before).toBe(1);
    expect(three).toBe(one);
  });
});
