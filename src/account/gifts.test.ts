// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTransport } from "./api";
import { AccountManager } from "./account";
import { CloudSync } from "./cloud";
import { GiftBox } from "./giftbox";
import { MemoryStorage, testServer } from "./server/testing";
import { cleanNote } from "./server/gifts";
import { XP_KEY, xpFromRaw } from "./xp";
import { GOLD_KEY } from "@/game/shop";
import { UNLOCKED_HEROES_KEY, loadUnlockedHeroes } from "@/game/save";
import type { CloudSave, GiftInfo, SentGift } from "./protocol";

const g = globalThis as { localStorage?: Storage };
const ADMIN = 777;

function device(srv: ReturnType<typeof testServer>) {
  const storage = new MemoryStorage();
  const acc = new AccountManager();
  const sync = new CloudSync(acc);
  const box = new GiftBox(acc, sync);
  const switchTo = () => {
    g.localStorage = storage;
    return { acc, sync, storage, box };
  };
  const login = async (tg: number, nick: string) => {
    switchTo();
    await acc.startBotLogin(false);
    srv.confirmPending(tg, nick);
    await acc.pollNow();
    if (sync.view.decision) await sync.resolve("local");
  };
  return { acc, sync, storage, box, switchTo, login };
}

describe("gifts (author -> player)", () => {
  let srv: ReturnType<typeof testServer>;
  beforeEach(() => {
    srv = testServer({ admins: String(ADMIN) });
    setTransport(srv.transport);
  });
  afterEach(() => setTransport(null));

  const api = (op: string, body: Record<string, unknown>) =>
    srv.transport(op, body) as Promise<Record<string, unknown> & { ok: boolean; error?: string }>;

  async function twoPlayers() {
    const admin = device(srv);
    await admin.login(ADMIN, "Muallif");
    const friend = device(srv);
    friend.switchTo().storage.setItem(GOLD_KEY, "40");
    await friend.login(1001, "Dost");
    const aTok = admin.acc.sessionToken!;
    const fTok = friend.acc.sessionToken!;
    const fid = srv.store.playerByNick("Dost")!.id;
    return { admin, friend, aTok, fTok, fid };
  }

  it("admin finds the player (name, level, avatar, owned heroes) and sends; it is claimed once", async () => {
    const { friend, aTok, fTok, fid } = await twoPlayers();
    friend.switchTo();
    const found = await api("admin/find", { token: aTok, query: "dos" });
    expect(found["players"]).toMatchObject([
      { id: fid, nick: "Dost", level: 1, avatar: "knight", heroes: ["knight", "mage", "hunter"] },
    ]);
    const byCode = await api("admin/find", { token: aTok, query: srv.store.player(fid)!.code });
    expect((byCode["players"] as { id: number }[])[0]!.id).toBe(fid);

    const sent = await api("admin/gift", {
      token: aTok,
      to: fid,
      gold: 500,
      xp: 120,
      hero: "paladin",
      note: "  Rahmat,\n do'stim!  ",
    });
    expect(sent).toMatchObject({ ok: true, gift: { to: { nick: "Dost" }, claimed: 0 } });
    expect((sent["gift"] as SentGift).note).toBe("Rahmat, do'stim!");

    // qabul qiluvchi: onlayn holatda soni keladi
    const pr = await api("presence", { token: fTok, place: "menu" });
    expect(pr["gifts"]).toBe(1);
    const list = await friend.box.load();
    expect(list).toHaveLength(1);
    expect(list![0]).toMatchObject({
      gold: 500,
      xp: 120,
      hero: "paladin",
      from: { nick: "Muallif", author: true },
    });

    // OLISH: server bulutga yozadi, qurilmaga qo'llanadi
    const r = await friend.box.claim(list![0]!.id);
    expect(r.ok).toBe(true);
    expect(Number(localStorage.getItem(GOLD_KEY))).toBe(540);
    expect(xpFromRaw(localStorage.getItem(XP_KEY))).toBe(120);
    // qahramon sovg'asi unlockedHeroes'ga yozildi
    expect(JSON.parse(localStorage.getItem(UNLOCKED_HEROES_KEY)!)).toContain("paladin");
    expect(loadUnlockedHeroes().has("paladin")).toBe(true);
    const cloud = srv.store.getSave(fid)!;
    expect(cloud.data[GOLD_KEY]).toBe("540");
    expect(JSON.parse(cloud.data[UNLOCKED_HEROES_KEY]!)).toContain("paladin");

    // ikkinchi marta — yo'q
    const again = await friend.box.claim(list![0]!.id);
    expect(again).toMatchObject({ ok: false, error: "none" });
    expect(Number(localStorage.getItem(GOLD_KEY))).toBe(540);
    expect(srv.store.gifts.pending(fid)).toBe(0);
    expect(friend.box.state.pending).toBe(0);

    // panelda: olindi
    const info = await api("admin/info", { token: aTok });
    expect((info["gifts"] as SentGift[])[0]!.claimed).toBeGreaterThan(0);
  });

  it("gift survives a device change and is not lost if the other device had unsaved progress", async () => {
    const { friend, aTok, fid } = await twoPlayers();
    await api("admin/gift", { token: aTok, to: fid, gold: 300, xp: 0 });
    // ikkinchi qurilma: o'sha akkaunt
    const phone = device(srv);
    await phone.login(1001, "Dost");
    expect(Number(localStorage.getItem(GOLD_KEY))).toBe(40);
    // telefon: saqlanmagan o'zgarish (o'yinda 7 oltin terdi)
    localStorage.setItem(GOLD_KEY, "47");
    const [gift] = (await phone.box.load())!;
    const r = await phone.box.claim(gift!.id);
    expect(r.ok).toBe(true);
    // avval saqlandi, keyin sovg'a qo'shildi — ikkalasi ham bor
    expect(Number(localStorage.getItem(GOLD_KEY))).toBe(347);
    // birinchi qurilmada: sovg'a endi yo'q, bulutdan progress keladi
    friend.switchTo();
    expect(await friend.box.load()).toEqual([]);
    await friend.sync.pull();
    expect(Number(localStorage.getItem(GOLD_KEY))).toBe(347);
  });

  it("stale base is refused with the cloud copy (mutate retries after loading it)", async () => {
    const { friend, aTok, fTok, fid } = await twoPlayers();
    await api("admin/gift", { token: aTok, to: fid, gold: 10, xp: 0 });
    const [gift] = (await friend.box.load()) as GiftInfo[];
    const r = await api("gifts/claim", { token: fTok, id: gift!.id, base: 0 });
    expect(r).toMatchObject({ ok: false, error: "conflict" });
    expect((r["save"] as CloudSave).version).toBeGreaterThan(0);
    expect(srv.store.gifts.pending(fid)).toBe(1);
  });

  it("guest (no account) cannot receive a gift; owned hero and empty gifts are refused", async () => {
    const { aTok, fid } = await twoPlayers();
    // akkauntsiz o'yinchi serverda yo'q
    expect(await api("admin/gift", { token: aTok, to: 99999, gold: 100, xp: 0 })).toMatchObject({
      ok: false,
      error: "none",
    });
    expect((await api("admin/find", { token: aTok, query: "Mehmon123" }))["players"]).toEqual([]);
    // u allaqachon ochgan qahramon
    expect(
      await api("admin/gift", { token: aTok, to: fid, gold: 0, xp: 0, hero: "mage" }),
    ).toMatchObject({ ok: false, error: "bad" });
    // bo'sh sovg'a va uzun xat — sxema rad etadi
    expect(await api("admin/gift", { token: aTok, to: fid, gold: 0, xp: 0 })).toMatchObject({
      ok: false,
      error: "bad",
    });
    expect(
      await api("admin/gift", { token: aTok, to: fid, gold: 1, xp: 0, note: "x".repeat(121) }),
    ).toMatchObject({ ok: false, error: "bad" });
  });

  it("only the author sends gifts; another player cannot claim someone else's gift", async () => {
    const { friend, aTok, fTok, fid } = await twoPlayers();
    const third = device(srv);
    await third.login(1002, "Uchinchi");
    const tTok = third.acc.sessionToken!;
    expect(await api("admin/gift", { token: fTok, to: fid, gold: 5, xp: 0 })).toMatchObject({
      error: "perm",
    });
    await api("admin/gift", { token: aTok, to: fid, gold: 5, xp: 0 });
    friend.switchTo();
    const [gift] = (await friend.box.load())!;
    third.switchTo();
    const base = srv.store.saveVersion(srv.store.playerByNick("Uchinchi")!.id);
    expect(await api("gifts/claim", { token: tTok, id: gift!.id, base })).toMatchObject({
      error: "none",
    });
    expect(srv.store.gifts.pending(fid)).toBe(1);
  });

  it("note is cleaned (control chars, spaces) and cut to 120", () => {
    expect(cleanNote("a\u0000b\n\nc")).toBe("a b c");
    expect(cleanNote("y".repeat(200))).toHaveLength(120);
    expect(cleanNote(undefined)).toBe("");
  });
});
