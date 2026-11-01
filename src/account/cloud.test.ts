// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTransport, type Transport } from "./api";
import { AccountManager } from "./account";
import { CloudSync, REALM_DELAY, SAVE_DELAY } from "./cloud";
import { CLOUD_KEY } from "./keys";
import { GOLD_CAP, GOLD_BURST, checkSave } from "./limits";
import { BACKUP_SLOTS, REALM_KEY } from "./server/store";
import { MemoryStorage, testServer } from "./server/testing";
import { XP_KEY } from "./xp";
import { GOLD_KEY } from "@/game/shop";
import { REALM_SAVE_KEY } from "@/game/realmLink";
import { SETTINGS_KEY } from "@/game/settings";
import { bestKeys } from "@/game/hero";

const g = globalThis as { localStorage?: Storage };

/** Har qurilmaning o'z localStorage'i: qurilma nomidan ish qilishdan oldin almashtiriladi */
function device(srv: ReturnType<typeof testServer>) {
  const storage = new MemoryStorage();
  const acc = new AccountManager();
  const sync = new CloudSync(acc);
  const switchTo = () => {
    g.localStorage = storage;
    return { acc, sync, storage };
  };
  const login = async (tg: number) => {
    switchTo();
    await acc.startBotLogin(false);
    srv.confirmPending(tg);
    await acc.pollNow();
    if (sync.view.decision) await sync.resolve("local");
  };
  return { acc, sync, storage, switchTo, login };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("cloud sync", () => {
  let srv: ReturnType<typeof testServer>;
  beforeEach(() => {
    srv = testServer();
    setTransport(srv.transport);
  });
  afterEach(() => setTransport(null));

  const cloudSave = (tg: number) => srv.store.getSave(srv.store.playerByTg(tg)!.id)!;

  it("debounce: an important change goes up after 10 s, a realm-only change after 60 s", async () => {
    const a = device(srv);
    a.switchTo().storage.setItem(GOLD_KEY, "10");
    await a.login(11);
    expect(cloudSave(11).version).toBe(1);
    const t0 = Date.now();
    // oltin o'zgardi
    localStorage.setItem(GOLD_KEY, "25");
    await a.sync.tick(t0);
    expect(a.sync.view.status).toBe("pending");
    await a.sync.tick(t0 + SAVE_DELAY - 1000);
    expect(cloudSave(11).version).toBe(1);
    await a.sync.tick(t0 + SAVE_DELAY);
    expect(cloudSave(11).version).toBe(2);
    expect(cloudSave(11).data[GOLD_KEY]).toBe("25");
    expect(a.sync.view.status).toBe("saved");
    // faqat olam saqlanishi (joy) o'zgardi — daqiqada bir
    localStorage.setItem(REALM_SAVE_KEY, JSON.stringify({ player: { x: 1 } }));
    const t1 = t0 + 20_000;
    await a.sync.tick(t1);
    await a.sync.tick(t1 + SAVE_DELAY);
    expect(cloudSave(11).version).toBe(2);
    await a.sync.tick(t1 + REALM_DELAY);
    expect(cloudSave(11).version).toBe(3);
  });

  it("device settings never go to the cloud", async () => {
    const a = device(srv);
    a.switchTo().storage.setItem(GOLD_KEY, "5");
    await a.login(12);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ music: 3 }));
    // sozlama — qurilmaga xos: o'zgarish deb hisoblanmaydi
    expect(a.sync.isDirty()).toBe(false);
    expect(cloudSave(12).data[SETTINGS_KEY]).toBeUndefined();
  });

  it("offline: progress stays local and syncs when the internet is back", async () => {
    const a = device(srv);
    a.switchTo().storage.setItem(GOLD_KEY, "1");
    await a.login(13);
    const real = srv.transport;
    const down: Transport = async () => {
      throw new Error("offline");
    };
    setTransport(down);
    localStorage.setItem(GOLD_KEY, "40");
    const t0 = Date.now();
    await a.sync.tick(t0);
    await a.sync.tick(t0 + SAVE_DELAY);
    expect(a.sync.view.status).toBe("offline");
    expect(localStorage.getItem(GOLD_KEY)).toBe("40");
    expect(cloudSave(13).data[GOLD_KEY]).toBe("1");
    // internet qaytdi
    setTransport(real);
    await a.sync.syncNow();
    expect(cloudSave(13).data[GOLD_KEY]).toBe("40");
    expect(a.sync.view.status).toBe("saved");
  });

  it("two devices: newer change wins, the other one is backed up on the server", async () => {
    const a = device(srv);
    a.switchTo().storage.setItem(GOLD_KEY, "100");
    await a.login(14);
    const b = device(srv);
    await b.login(14);
    expect(b.storage.getItem(GOLD_KEY)).toBe("100");
    const t0 = Date.now();
    // B oflayn o'ynadi (avvalroq), keyin A o'ynadi va saqladi
    b.switchTo();
    localStorage.setItem(GOLD_KEY, "130");
    await b.sync.tick(t0 - 60_000);
    a.switchTo();
    localStorage.setItem(GOLD_KEY, "170");
    await a.sync.tick(t0);
    await a.sync.tick(t0 + SAVE_DELAY);
    expect(cloudSave(14).data[GOLD_KEY]).toBe("170");
    // B internetga chiqdi: uning o'zgarishi eskiroq — bulutdagisi (A) qoladi va B'ga yuklanadi
    b.switchTo();
    await b.sync.push();
    await flush();
    expect(cloudSave(14).data[GOLD_KEY]).toBe("170");
    expect(localStorage.getItem(GOLD_KEY)).toBe("170");
    expect(b.acc.state.notice).toContain("yangiroq progress");
    // B'ning rad etilgan progressi yo'qolmagan — zaxirada
    const backups = srv.store.backups(srv.store.playerByTg(14)!.id);
    expect(backups.some((x) => x.reason === "stale" && x.data[GOLD_KEY] === "130")).toBe(true);
  });

  it("two devices: the later change from a stale base still wins by time", async () => {
    const a = device(srv);
    a.switchTo().storage.setItem(GOLD_KEY, "100");
    await a.login(15);
    const b = device(srv);
    await b.login(15);
    const t0 = Date.now();
    a.switchTo();
    localStorage.setItem(GOLD_KEY, "150");
    await a.sync.tick(t0 - 120_000);
    await a.sync.push();
    // B keyinroq o'ynadi (base eski) — vaqt bo'yicha B yangi
    b.switchTo();
    localStorage.setItem(GOLD_KEY, "120");
    await b.sync.tick(t0);
    await b.sync.push();
    expect(cloudSave(15).data[GOLD_KEY]).toBe("120");
    // A menyuga qaytganda B'nikini oladi
    a.switchTo();
    await a.sync.pull();
    expect(localStorage.getItem(GOLD_KEY)).toBe("120");
    // A'ning almashtirilgan nusxasi zaxirada
    const backups = srv.store.backups(srv.store.playerByTg(15)!.id);
    expect(backups.some((x) => x.data[GOLD_KEY] === "150")).toBe(true);
  });

  it("a cloud update during a game waits until the menu", async () => {
    const a = device(srv);
    a.switchTo().storage.setItem(GOLD_KEY, "1");
    await a.login(16);
    const b = device(srv);
    await b.login(16);
    b.switchTo();
    localStorage.setItem(GOLD_KEY, "60");
    await b.sync.push();
    a.switchTo();
    let inGame = true;
    a.sync.canApply = () => !inGame;
    await a.sync.pull();
    expect(localStorage.getItem(GOLD_KEY)).toBe("1");
    expect(a.sync.view.status).toBe("pending");
    inGame = false;
    a.sync.resume();
    expect(localStorage.getItem(GOLD_KEY)).toBe("60");
  });

  it("closing the game sends unsaved progress right away (keepalive)", async () => {
    const a = device(srv);
    a.switchTo().storage.setItem(GOLD_KEY, "1");
    await a.login(17);
    const seen: { op: string; keepalive: boolean }[] = [];
    setTransport((op, body, opts) => {
      seen.push({ op, keepalive: !!opts?.keepalive });
      return srv.transport(op, body, opts);
    });
    localStorage.setItem(GOLD_KEY, "2");
    a.sync.flush();
    await flush();
    await flush();
    expect(seen).toEqual([{ op: "save/put", keepalive: true }]);
    expect(cloudSave(17).data[GOLD_KEY]).toBe("2");
  });

  it("impossible values are refused and the cloud keeps the old save", async () => {
    const a = device(srv);
    a.switchTo().storage.setItem(GOLD_KEY, "50");
    await a.login(18);
    localStorage.setItem(GOLD_KEY, "999999");
    await a.sync.push();
    expect(a.sync.view.status).toBe("error");
    expect(a.sync.view.error).toContain("oltin");
    expect(cloudSave(18).data[GOLD_KEY]).toBe("50");
    // rekord ham
    localStorage.setItem(GOLD_KEY, "60");
    localStorage.setItem(bestKeys("mage").best, "99999999");
    await a.sync.syncNow();
    expect(a.sync.view.error).toContain("rekord");
  });

  it("restoring a backup brings back the old progress on the cloud and the device", async () => {
    const a = device(srv);
    a.switchTo().storage.setItem(GOLD_KEY, "300");
    await a.login(19);
    const b = device(srv);
    await b.login(19);
    b.switchTo();
    localStorage.setItem(GOLD_KEY, "5");
    await b.sync.push();
    // boshqa qurilmaga o'tilganda eski nusxa zaxirada
    const list = (await b.sync.backups())!;
    const old = list.find((x) => x.data[GOLD_KEY] === "300")!;
    expect(old).toBeTruthy();
    expect(await b.sync.restore(old.slot)).toBe(true);
    expect(localStorage.getItem(GOLD_KEY)).toBe("300");
    expect(cloudSave(19).data[GOLD_KEY]).toBe("300");
    // tiklashdan oldingisi ham zaxirada
    const again = (await b.sync.backups())!;
    expect(again.some((x) => x.reason === "restore" && x.data[GOLD_KEY] === "5")).toBe(true);
  });

  it("keeps at most 5 backups", () => {
    const p = srv.store.ensurePlayer({ id: 20 }, Date.now()).player;
    let t = Date.now();
    srv.store.putSave(p.id, { base: 0, time: t, device: "web", dev: "dev0aaaa", data: {} }, t);
    for (let i = 1; i <= 9; i++) {
      t += 60_000;
      // har safar boshqa qurilmadan — har biri zaxira oladi
      const r = srv.store.putSave(
        p.id,
        { base: i, time: t, device: "web", dev: `dev${i}aaaa`, data: { [GOLD_KEY]: String(i) } },
        t,
      );
      expect(r.ok).toBe(true);
    }
    expect(srv.store.backups(p.id)).toHaveLength(BACKUP_SLOTS);
  });

  it("logout first sends unsaved progress", async () => {
    const a = device(srv);
    a.switchTo().storage.setItem(GOLD_KEY, "1");
    await a.login(21);
    localStorage.setItem(GOLD_KEY, "9");
    await a.acc.logout();
    expect(cloudSave(21).data[GOLD_KEY]).toBe("9");
    // sinxron holati qoladi: shu akkaunt bilan qayta kirsa — davom etadi
    expect(localStorage.getItem(CLOUD_KEY)).not.toBeNull();
  });
});

describe("save limits", () => {
  it("server knows the realm save key", () => {
    expect(REALM_KEY).toBe(REALM_SAVE_KEY);
  });

  it("absolute caps", () => {
    expect(checkSave({ [GOLD_KEY]: "500" }, null, 0)).toBeNull();
    expect(checkSave({ [GOLD_KEY]: String(GOLD_CAP + 1) }, null, 0)).toBe("gold");
    expect(checkSave({ [bestKeys("knight").best]: "400000" }, null, 0)).toBe("score");
    expect(checkSave({ [XP_KEY]: JSON.stringify({ xp: 5_000_000 }) }, null, 0)).toBe("xp");
    // buzuq yozuv (o'yin uni 0 deb o'qiydi) saqlashni to'xtatmaydi
    expect(checkSave({ [GOLD_KEY]: "abc" }, null, 0)).toBeNull();
  });

  it("growth since the previous save is limited by time", () => {
    const prev = { [GOLD_KEY]: "100" };
    expect(checkSave({ [GOLD_KEY]: String(100 + GOLD_BURST) }, prev, 0)).toBeNull();
    expect(checkSave({ [GOLD_KEY]: String(100 + GOLD_BURST + 1) }, prev, 0)).toBe("gold");
    // 3 soat o'ynagan bo'lsa — ko'proq
    expect(checkSave({ [GOLD_KEY]: String(100 + GOLD_BURST + 5000) }, prev, 3)).toBeNull();
    // sarflash (kamayish) — har doim mumkin
    expect(checkSave({ [GOLD_KEY]: "0" }, prev, 0)).toBeNull();
  });
});
