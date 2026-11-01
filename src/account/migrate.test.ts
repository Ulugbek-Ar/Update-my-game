// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTransport } from "./api";
import { AccountManager } from "./account";
import { CloudSync } from "./cloud";
import { ACCOUNT_KEY, CLOUD_KEY } from "./keys";
import { installStorage, testServer } from "./server/testing";
import { GOLD_KEY } from "@/game/shop";
import { ACHIEVEMENTS_KEY } from "@/game/achievements";
import { BACKUP_KEY } from "@/game/transfer";
import { SETTINGS_KEY } from "@/game/settings";

/** Bitta qurilma: o'z akkaunt holati va bulut sinxroni (localStorage — jsdom'niki) */
function device() {
  const acc = new AccountManager();
  const sync = new CloudSync(acc);
  return { acc, sync };
}

async function loginViaBot(
  d: ReturnType<typeof device>,
  srv: ReturnType<typeof testServer>,
  tg: number,
) {
  await d.acc.startBotLogin(false);
  expect(d.acc.state.pending).not.toBeNull();
  srv.confirmPending(tg, `player${tg}`);
  await d.acc.pollNow();
  expect(d.acc.state.me).not.toBeNull();
}

installStorage();

describe("guest progress -> account", () => {
  let srv: ReturnType<typeof testServer>;
  beforeEach(() => {
    localStorage.clear();
    srv = testServer();
    setTransport(srv.transport);
  });
  afterEach(() => setTransport(null));

  it("first login into an empty account offers to move the guest progress", async () => {
    localStorage.setItem(GOLD_KEY, "120");
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(["first", "boss"]));
    // qurilmaga xos sozlama — bulutga ketmasligi kerak
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ music: 10 }));
    const d = device();
    await loginViaBot(d, srv, 501);
    expect(d.sync.view.decision?.kind).toBe("migrate");
    expect(d.sync.view.decision?.local).toMatchObject({ gold: 120, achievements: 2 });
    await d.sync.resolve("local");
    expect(d.sync.view.decision).toBeNull();
    const p = srv.store.playerByTg(501)!;
    const save = srv.store.getSave(p.id)!;
    expect(save.version).toBe(1);
    expect(save.data[GOLD_KEY]).toBe("120");
    expect(save.data[SETTINGS_KEY]).toBeUndefined();
    // sessiya tokeni ham bulutga ketmaydi
    expect(Object.keys(save.data)).not.toContain(ACCOUNT_KEY);
    expect(d.sync.view.status).toBe("saved");
  });

  it("an empty device simply downloads the account progress", async () => {
    // A qurilmasi: progress akkauntga
    localStorage.setItem(GOLD_KEY, "300");
    const a = device();
    await loginViaBot(a, srv, 777);
    await a.sync.resolve("local");
    // B qurilmasi: bo'sh (yangi o'rnatilgan)
    localStorage.clear();
    const b = device();
    await loginViaBot(b, srv, 777);
    expect(b.sync.view.decision).toBeNull();
    expect(localStorage.getItem(GOLD_KEY)).toBe("300");
  });

  it("both have progress: preview of both, chosen one stays, the other is backed up", async () => {
    localStorage.setItem(GOLD_KEY, "300");
    const a = device();
    await loginViaBot(a, srv, 900);
    await a.sync.resolve("local");
    // B qurilmasida o'z mehmon progressi
    localStorage.clear();
    localStorage.setItem(GOLD_KEY, "45");
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(["first"]));
    const b = device();
    let applied = 0;
    b.sync.onApplied = () => applied++;
    await loginViaBot(b, srv, 900);
    const dec = b.sync.view.decision!;
    expect(dec.kind).toBe("choose");
    expect(dec.local.gold).toBe(45);
    expect(dec.cloud?.gold).toBe(300);
    expect(dec.cloud?.device).toBe("web");
    await b.sync.resolve("cloud");
    expect(localStorage.getItem(GOLD_KEY)).toBe("300");
    expect(applied).toBe(1);
    // mehmon progressi zaxirada: Sozlamalar -> OLDINGI HOLATGA QAYTARISH
    const backup = JSON.parse(localStorage.getItem(BACKUP_KEY)!) as {
      keys: Record<string, string>;
    };
    expect(backup.keys[GOLD_KEY]).toBe("45");
  });

  it("choosing this device overwrites the account", async () => {
    localStorage.setItem(GOLD_KEY, "300");
    const a = device();
    await loginViaBot(a, srv, 901);
    await a.sync.resolve("local");
    localStorage.clear();
    localStorage.setItem(GOLD_KEY, "55");
    const b = device();
    await loginViaBot(b, srv, 901);
    await b.sync.resolve("local");
    const p = srv.store.playerByTg(901)!;
    expect(srv.store.getSave(p.id)!.data[GOLD_KEY]).toBe("55");
    expect(srv.store.getSave(p.id)!.version).toBe(2);
  });

  it("start fresh: guest progress goes to the local backup, the account starts empty", async () => {
    localStorage.setItem(GOLD_KEY, "80");
    const d = device();
    await loginViaBot(d, srv, 333);
    await d.sync.resolve("fresh");
    expect(localStorage.getItem(GOLD_KEY)).toBeNull();
    const backup = JSON.parse(localStorage.getItem(BACKUP_KEY)!) as {
      keys: Record<string, string>;
    };
    expect(backup.keys[GOLD_KEY]).toBe("80");
    const p = srv.store.playerByTg(333)!;
    expect(srv.store.getSave(p.id)!.data[GOLD_KEY]).toBeUndefined();
  });

  it("logout keeps the progress on the device and plays on as a guest", async () => {
    localStorage.setItem(GOLD_KEY, "10");
    const d = device();
    await loginViaBot(d, srv, 444);
    await d.sync.resolve("local");
    const token = d.acc.sessionToken!;
    await d.acc.logout();
    expect(d.acc.state.me).toBeNull();
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull();
    expect(localStorage.getItem(GOLD_KEY)).toBe("10");
    expect(await srv.store.authenticate(token, Date.now())).toBeNull();
  });

  it("deleting the account clears the server, keeps the device progress as a guest", async () => {
    localStorage.setItem(GOLD_KEY, "77");
    const d = device();
    await loginViaBot(d, srv, 555);
    await d.sync.resolve("local");
    const id = srv.store.playerByTg(555)!.id;
    expect(await d.acc.deleteAccount()).toBe(true);
    expect(d.acc.state.me).toBeNull();
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull();
    expect(localStorage.getItem(CLOUD_KEY)).toBeNull();
    expect(localStorage.getItem(GOLD_KEY)).toBe("77");
    expect(srv.store.player(id)).toBeNull();
    expect(srv.store.getSave(id)).toBeNull();
  });
});
