// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Limiters, handleApi } from "./api";
import { memoryDb } from "./memory-db";
import { AccountStore } from "./store";
import { TEST_BOT_TOKEN } from "./testing";
import { parseAdminIds } from "./admin";
import {
  BOSS_KEYS,
  REALM_KEYS_KEY,
  REALM_SAVE_KEY,
  UNLOCK_GOLD,
  defaultLists,
  heroesIn,
  realmSecretIds,
  unlockAll,
} from "../grants";
import * as realmLink from "@/game/realmLink";
import { HERO_LIST } from "@/game/hero";
import { SHOP_ITEMS, SHOP_KEY, GOLD_KEY } from "@/game/shop";
import { ACHIEVEMENTS, ACHIEVEMENTS_KEY } from "@/game/achievements";
import { GIFT_KEY } from "@/game/gift";
import { UNLOCKED_HEROES_KEY } from "@/game/save";
import { WORLD3_WON_KEY } from "@/game/progress";
import { MAX_LEVEL, XP_KEY, levelOf, xpFromRaw } from "../xp";
import { GUILD_LEVEL_XP } from "../guildRules";
import type { CloudSave, ScoreTop } from "../protocol";

const NOW = Date.UTC(2026, 10, 4, 10, 0, 0);
const ADMIN_TG = 777;

function setup(admins = String(ADMIN_TG)) {
  const store = new AccountStore(memoryDb());
  const lim = new Limiters();
  let ids = parseAdminIds(admins);
  // olam serveri (raidWin) kabi to'g'ridan-to'g'ri chaqiruvlar uchun ham
  store.admin.ids = ids;
  const now = NOW;
  const api = (op: string, body: unknown) =>
    handleApi(
      store,
      op,
      body,
      { now, ip: "x", botToken: TEST_BOT_TOKEN, bot: "B", admins: ids },
      lim,
    ) as Promise<Record<string, unknown> & { ok: boolean; error?: string }>;
  const user = async (tg: number, nick: string) =>
    (await store.login({ id: tg, username: nick }, "web", now)).token;
  return {
    store,
    api,
    user,
    setAdmins: (raw: string) => (ids = parseAdminIds(raw)),
  };
}

const saveOf = (r: Record<string, unknown>) => r["save"] as CloudSave;

describe("ADMIN_TELEGRAM_IDS", () => {
  it("parses comma separated ids and ignores junk", () => {
    expect([...parseAdminIds("123, 456,abc,,789 ")]).toEqual([123, 456, 789]);
    expect(parseAdminIds("").size).toBe(0);
    expect(parseAdminIds(undefined).size).toBe(0);
    expect(parseAdminIds("-5, 0, 1.5").size).toBe(0);
  });

  it("empty list — nobody is admin (even the would-be author)", async () => {
    const t = setup("");
    const token = await t.user(ADMIN_TG, "Muallif");
    const me = await t.api("me", { token });
    expect((me["me"] as { admin?: boolean }).admin).toBeUndefined();
    for (const [op, body] of [
      ["admin/info", {}],
      ["admin/unlock", { base: 0 }],
      ["admin/grant", { base: 0, gold: 100 }],
      ["admin/find", { query: "Muallif" }],
    ] as const) {
      const r = await t.api(op, { token, ...body });
      expect(r).toMatchObject({ ok: false, error: "perm" });
    }
  });
});

describe("admin rights are checked only on the server", () => {
  it("ordinary player's admin and gift requests are refused and logged", async () => {
    const t = setup();
    const admin = await t.user(ADMIN_TG, "Muallif");
    const player = await t.user(1001, "Oddiy");
    const pid = (t.store.playerByNick("Oddiy")!.id as number) ?? 0;
    const tries: [string, Record<string, unknown>][] = [
      ["admin/info", {}],
      ["admin/unlock", { base: 0 }],
      ["admin/grant", { base: 0, gold: 99999 }],
      ["admin/reset", { base: 0, confirm: "NOL" }],
      ["admin/guild", { name: "Hiyla", tag: "HIY", emblem: "0-1-3-0" }],
      ["admin/guildlevel", { level: 10 }],
      ["admin/find", { query: "Muallif" }],
      ["admin/gift", { to: pid, gold: 5000, xp: 0 }],
    ];
    for (const [op, body] of tries) {
      const r = await t.api(op, { token: player, ...body });
      expect(r, op).toMatchObject({ ok: false, error: "perm" });
    }
    // klientdagi "admin: true" flagi hech narsani ochmaydi — server uni o'qimaydi
    const forged = await t.api("admin/grant", { token: player, base: 0, gold: 5, admin: true });
    expect(forged.ok).toBe(false);
    // hech narsa o'zgarmadi: bulut bo'sh, sovg'a yo'q
    expect(t.store.getSave(pid)).toBeNull();
    expect(t.store.gifts.pending(pid)).toBe(0);
    // jurnalda — rad etilgan urinishlar
    const info = await t.api("admin/info", { token: admin });
    const log = info["log"] as { action: string; detail: string }[];
    expect(log.filter((e) => e.action === "denied").length).toBe(tries.length + 1);
    expect(log.some((e) => e.detail === "admin/gift")).toBe(true);
  });

  it("admin sees MUALLIF flag; others see it next to the admin's name", async () => {
    const t = setup();
    const admin = await t.user(ADMIN_TG, "Muallif");
    const me = await t.api("me", { token: admin });
    expect((me["me"] as { admin?: boolean }).admin).toBe(true);
    const other = await t.user(1002, "Dost");
    await t.api("friends/add", { token: other, query: "Muallif" });
    await t.api("friends/add", { token: admin, query: "Dost" });
    const list = await t.api("friends/list", { token: other });
    const f = (list["friends"] as { nick: string; author?: boolean }[])[0]!;
    expect(f).toMatchObject({ nick: "Muallif", author: true });
    const back = await t.api("friends/list", { token: admin });
    expect((back["friends"] as { author?: boolean }[])[0]!.author).toBeUndefined();
  });

  it("admin can be revoked: removing the id from the secret closes the panel", async () => {
    const t = setup();
    const admin = await t.user(ADMIN_TG, "Muallif");
    expect((await t.api("admin/info", { token: admin })).ok).toBe(true);
    t.setAdmins("");
    expect(await t.api("admin/info", { token: admin })).toMatchObject({ error: "perm" });
  });
});

describe("HAMMASINI OCHISH", () => {
  it("unlocks heroes, shop, worlds, bosses, achievements, level 50 and 99 999 gold", async () => {
    const t = setup();
    const admin = await t.user(ADMIN_TG, "Muallif");
    const r = await t.api("admin/unlock", { token: admin, base: 0 });
    expect(r.ok).toBe(true);
    const d = saveOf(r).data;
    expect(saveOf(r).version).toBe(1);
    expect(heroesIn(d).sort()).toEqual(HERO_LIST.map((h) => h.id).sort());
    const shop = JSON.parse(d[SHOP_KEY]!) as Record<string, number>;
    for (const item of SHOP_ITEMS) expect(shop[item.id]).toBe(item.costs.length);
    expect(d[WORLD3_WON_KEY]).toBe("1");
    expect(JSON.parse(d[REALM_KEYS_KEY]!)).toEqual([...BOSS_KEYS]);
    expect((JSON.parse(d[ACHIEVEMENTS_KEY]!) as string[]).length).toBe(ACHIEVEMENTS.length);
    expect(levelOf(xpFromRaw(d[XP_KEY]))).toBe(MAX_LEVEL);
    expect(Number(d[GOLD_KEY])).toBe(UNLOCK_GOLD);
    // server bilan bir xil: daraja ism yonida
    expect((await t.api("me", { token: admin }))["me"]).toMatchObject({ level: MAX_LEVEL });
  });

  it("works for heroes added later (lists are dynamic) and keeps existing progress", () => {
    const base = defaultLists();
    const first = unlockAll({ [GOLD_KEY]: "150000", "pixel-rpg-best": "4200" }, base);
    expect(Number(first[GOLD_KEY])).toBe(150000);
    expect(first["pixel-rpg-best"]).toBe("4200");
    // keyingi versiya: yangi qahramon, yangi do'kon buyumi va yutuq
    const next = {
      ...base,
      heroes: [...base.heroes, { id: "druid", price: 600 }],
      shop: [...base.shop, { id: "armor", costs: [10, 20] }],
      achievements: [...base.achievements, { id: "newAch" }],
    };
    expect(heroesIn(first, next.heroes)).not.toContain("druid");
    const again = unlockAll(first, next);
    expect(heroesIn(again, next.heroes)).toContain("druid");
    expect(JSON.parse(again[SHOP_KEY]!)).toMatchObject({ armor: 2 });
    expect(JSON.parse(again[ACHIEVEMENTS_KEY]!)).toContain("newAch");
    // oldingilari ham joyida
    expect(heroesIn(again, next.heroes)).toEqual(expect.arrayContaining(["gunner", "paladin"]));
  });

  it("server uses injected lists — a new hero is unlocked on the next press", async () => {
    const t = setup();
    const admin = await t.user(ADMIN_TG, "Muallif");
    const r1 = await t.api("admin/unlock", { token: admin, base: 0 });
    t.store.admin.lists = { ...defaultLists(), heroes: [...HERO_LIST, { id: "druid", price: 1 }] };
    const r2 = await t.api("admin/unlock", { token: admin, base: saveOf(r1).version });
    expect(JSON.parse(saveOf(r2).data[UNLOCKED_HEROES_KEY]!)).toContain("druid");
  });

  it("finds realm secrets when a realm save exists", () => {
    const ids = realmSecretIds();
    expect(ids.length).toBeGreaterThan(3);
    const realm = JSON.stringify({ v: 1, world: {}, player: { secrets: ["s-wall"] } });
    const out = unlockAll({ [REALM_SAVE_KEY]: realm });
    const p = JSON.parse(out[REALM_SAVE_KEY]!) as { player: { secrets: string[] } };
    expect(new Set(p.player.secrets)).toEqual(new Set(ids));
    // olamga kirilmagan — olam saqlanishi yaratilmaydi
    expect(unlockAll({})[REALM_SAVE_KEY]).toBeUndefined();
  });

  it("realm keys match src/game/realmLink.ts", () => {
    expect(REALM_SAVE_KEY).toBe(realmLink.REALM_SAVE_KEY);
    expect(REALM_KEYS_KEY).toBe(realmLink.REALM_KEYS_KEY);
    expect([...BOSS_KEYS]).toEqual([...realmLink.BOSS_KEYS]);
  });
});

describe("admin progress tools", () => {
  it("gold, level, XP, hero open/close and daily gift reset", async () => {
    const t = setup();
    const admin = await t.user(ADMIN_TG, "Muallif");
    let v = 0;
    const grant = async (b: Record<string, unknown>) => {
      const r = await t.api("admin/grant", { token: admin, base: v, ...b });
      expect(r.ok).toBe(true);
      v = saveOf(r).version;
      return saveOf(r).data;
    };
    expect(Number((await grant({ gold: 500 }))[GOLD_KEY])).toBe(500);
    expect(Number((await grant({ gold: -200 }))[GOLD_KEY])).toBe(300);
    expect(levelOf(xpFromRaw((await grant({ level: 10 }))[XP_KEY]))).toBe(10);
    expect(xpFromRaw((await grant({ xp: 100 }))[XP_KEY])).toBe(1620 + 100);
    expect(heroesIn(await grant({ hero: "paladin" }))).toContain("paladin");
    expect(heroesIn(await grant({ lock: "paladin" }))).not.toContain("paladin");
    // bepul qahramon yopilmaydi
    expect(heroesIn(await grant({ lock: "knight" }))).toContain("knight");
    // kunlik sovg'a
    const withGift = t.store.writeSave(
      t.store.playerByNick("Muallif")!.id,
      { ...t.store.getSave(t.store.playerByNick("Muallif")!.id)!.data, [GIFT_KEY]: "{}" },
      NOW,
      "admin",
    );
    v = withGift.version;
    expect((await grant({ daily: true }))[GIFT_KEY]).toBeUndefined();
  });

  it("stale base -> conflict with the cloud copy; nothing is written", async () => {
    const t = setup();
    const admin = await t.user(ADMIN_TG, "Muallif");
    await t.api("admin/grant", { token: admin, base: 0, gold: 100 });
    const r = await t.api("admin/grant", { token: admin, base: 0, gold: 100 });
    expect(r).toMatchObject({ ok: false, error: "conflict" });
    expect(Number(saveOf(r).data[GOLD_KEY])).toBe(100);
  });

  it("reset: progress becomes empty, previous copy goes to backups", async () => {
    const t = setup();
    const admin = await t.user(ADMIN_TG, "Muallif");
    const u = await t.api("admin/unlock", { token: admin, base: 0 });
    const r = await t.api("admin/reset", { token: admin, base: saveOf(u).version, confirm: "NOL" });
    expect(saveOf(r).data).toEqual({});
    const b = await t.api("save/backups", { token: admin });
    expect((b["backups"] as { reason: string }[]).some((x) => x.reason === "admin")).toBe(true);
    // tasdiqsiz — rad (sxema)
    const bad = await t.api("admin/reset", { token: admin, base: 2 });
    expect(bad).toMatchObject({ ok: false, error: "bad" });
  });

  it("test guild needs no gold; guild level can be set", async () => {
    const t = setup();
    const admin = await t.user(ADMIN_TG, "Muallif");
    const g = await t.api("admin/guild", {
      token: admin,
      name: "Sinov Gildiyasi",
      tag: "TEST",
      emblem: "0-1-3-0",
    });
    expect(g).toMatchObject({ ok: true, cost: 0 });
    const l = await t.api("admin/guildlevel", { token: admin, level: 7 });
    expect(l).toMatchObject({ ok: true, guild: { level: 7, xp: GUILD_LEVEL_XP[6] } });
    const info = await t.api("admin/info", { token: admin });
    const actions = (info["log"] as { action: string }[]).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["guild", "guildlevel"]));
  });
});

describe("admin is excluded from leaderboards", () => {
  const run = { mode: "world", hero: "knight", score: 3000, wave: 5, time: 180, won: true };

  it("admin results are not written to the leaderboard", async () => {
    const t = setup();
    const admin = await t.user(ADMIN_TG, "Muallif");
    const player = await t.user(1003, "Oyinchi");
    expect((await t.api("scores/submit", { token: admin, ...run, score: 4000 })).ok).toBe(true);
    expect((await t.api("scores/submit", { token: player, ...run })).ok).toBe(true);
    const top = (await t.api("scores/top", {
      board: "w1:knight",
      period: "week",
    })) as unknown as ScoreTop;
    expect(top.rows.map((r) => r.nick)).toEqual(["Oyinchi"]);
    const n = t.store.db.exec("SELECT * FROM scores WHERE player = ?", 1).toArray().length;
    expect(n).toBe(0);
  });

  it("raid team: admin gets no raid score; old admin scores are hidden", async () => {
    const t = setup();
    await t.user(ADMIN_TG, "Muallif");
    await t.user(1004, "Jangchi");
    const aid = t.store.playerByNick("Muallif")!.id;
    const pid = t.store.playerByNick("Jangchi")!.id;
    t.store.scores.raid([aid, pid], 300, NOW);
    const rows = t.store.db.exec<{ player: number }>("SELECT player FROM scores").toArray();
    expect(new Set(rows.map((r) => r.player))).toEqual(new Set([pid]));
    // admin bo'lishidan oldin yozilgan natija ham ko'rinmaydi
    t.store.db.exec(
      "INSERT INTO scores (board, period, player, score, at) VALUES ('endless', 'all', ?, 999999, ?)",
      aid,
      NOW,
    );
    const top = t.store.scores.top("endless", "all", null, NOW)!;
    expect(top.rows.some((r) => r.id === aid)).toBe(false);
  });

  it("admin's saves do not count toward weekly guild quests", async () => {
    const t = setup();
    const admin = await t.user(ADMIN_TG, "Muallif");
    await t.api("admin/guild", { token: admin, name: "Adolat", tag: "ADL", emblem: "0-1-3-0" });
    const aid = t.store.playerByNick("Muallif")!.id;
    const put = (base: number, kills: number) =>
      t.api("save/put", {
        token: admin,
        base,
        time: NOW + base,
        device: "web",
        data: { "pixel-rpg-stats": JSON.stringify({ kills, waves: kills, runs: 1, time: 1 }) },
      });
    await put(0, 0);
    await put(1, 200);
    const qc = t.store.db.exec("SELECT * FROM guild_qc WHERE player = ?", aid).toArray();
    expect(qc.length).toBe(0);
  });
});
