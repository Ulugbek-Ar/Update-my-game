import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BACKUP_KEY,
  BAD_CODE,
  MAX_CODE,
  TRANSFER_PREFIX,
  applyTransfer,
  currentSummary,
  exportCode,
  loadBackup,
  packFog,
  readCode,
  restoreBackup,
  splitCode,
  unpackFog,
  type TransferData,
} from "./transfer";
import { SAVE_VERSION, SAVE_VERSION_KEY, UNLOCKED_HEROES_KEY, loadUnlockedHeroes } from "./save";
import { SETTINGS_KEY } from "./settings";
import { loadGold } from "./shop";
import { loadRealmData } from "@/realm/data";
import { RealmSim, INV_SLOTS, tileCenter } from "@/realm/sim";
import type { RealmSave } from "@/realm/client";
import { REALM_SAVE_KEY } from "./realmLink";

const data = loadRealmData();

/** Haqiqiy RealmSim saqlanishi: to'la inventar, topshiriqlar va tuman (fill — o'rganilganlik). */
function realmSave(fog: "none" | "walk" | "full"): string {
  const s = new RealmSim(data);
  const rp = s.addPlayer("me", "gunner");
  const items = Object.keys(data.items);
  rp.inv = Array.from({ length: INV_SLOTS }, (_, i) => ({ item: items[i % items.length]!, n: 9 }));
  for (const [i, q] of Object.keys(data.quests).entries())
    rp.quests[q] = { status: i % 2 ? "done" : "active", step: 3, progress: 7 };
  rp.secrets = ["a1", "b2", "c3", "d4", "e5"];
  rp.fragments = ["f1", "f2", "f3"];
  rp.opened = Array.from({ length: 20 }, (_, i) => `chest-${i}`);
  rp.landmarks = Array.from({ length: 9 }, (_, i) => `landmark-${i}`);
  rp.kills = 4321;
  rp.gold = 999;
  if (fog === "full") rp.explored.fill(255);
  if (fog === "walk") {
    // tasodifiy sayr: chegaralari ko'p — tuman uchun eng og'ir holat
    let x = 47,
      y = 97,
      a = 0,
      seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
    for (let i = 0; i < 2500; i++) {
      a += (rnd() - 0.5) * 0.8;
      x = Math.max(0, Math.min(s.map.w - 1, x + Math.cos(a)));
      y = Math.max(0, Math.min(s.map.h - 1, y + Math.sin(a)));
      if (x <= 0 || y <= 0 || x >= s.map.w - 1 || y >= s.map.h - 1) a += Math.PI;
      rp.p.x = tileCenter(Math.floor(x));
      rp.p.y = tileCenter(Math.floor(y));
      s.explore(rp);
    }
    rp.p.x = tileCenter(47);
    rp.p.y = tileCenter(97);
  }
  for (let i = 0; i < 30; i++) s.setTile(10 + i, 20, 3);
  const save: RealmSave = {
    v: 1,
    world: s.saveWorld(),
    player: s.savePlayer("me")!,
    intro: true,
    sharedGold: true,
  };
  save.world.wallHits = { w1: 2, w2: 1, w3: 3 };
  return JSON.stringify(save);
}

/** To'liq progress: barcha qahramon rekordlari, do'kon, yutuqlar, dunyolar, olam. */
function fullProgress(fog: "none" | "walk" | "full" = "walk"): Record<string, string> {
  const p: Record<string, string> = {
    "pixel-rpg-gold": "1234",
    "pixel-rpg-shop": JSON.stringify({ heart: 3, dash: 3, blade: 1, luck: 3 }),
    "pixel-rpg-unlocked-heroes": JSON.stringify(["knight", "mage", "hunter", "gunner"]),
    "pixel-rpg-achievements": JSON.stringify([
      "first",
      "clean",
      "combo10",
      "combo50",
      "rich",
      "boss",
      "winKnight",
      "winMage",
      "winHunter",
      "winGunner",
      "endless10",
      "daily",
      "chests",
      "queen",
      "noChill",
      "twoChapters",
      "drumKills",
      "firstHero",
    ]),
    "pixel-rpg-world1-won": "1",
    "pixel-rpg-world2-won": "1",
    "pixel-rpg-world3-won": "1",
    "pixel-rpg-world-wins": JSON.stringify({
      1: ["knight", "mage", "hunter", "gunner"],
      2: ["knight", "mage", "hunter", "gunner"],
      3: ["knight", "mage", "hunter", "gunner"],
    }),
    "pixel-rpg-daily": JSON.stringify({
      date: "2026-10-30",
      hero: "gunner",
      score: 5120,
      wave: 5,
      won: true,
    }),
    "pixel-rpg-realm": realmSave(fog),
    "pixel-rpg-realm-keys": JSON.stringify(["devil", "queen", "king"]),
    "pixel-rpg-realm-inbox": JSON.stringify(["horn", "potion"]),
    "pixel-rpg-hero": "gunner",
    "pixel-rpg-tutorial-done": "1",
    "pixel-rpg-attempt": "57",
    "pixel-rpg-map-world": "3",
    "pixel-rpg-save-version": String(SAVE_VERSION),
  };
  for (const h of ["", "-mage", "-hunter", "-gunner"]) {
    p[`pixel-rpg-best${h}`] = "98765";
    p[`pixel-rpg-endless-best${h}`] = "45678";
    p[`pixel-rpg-best-ch2${h}`] = "87654";
    p[`pixel-rpg-best-ch3${h}`] = "76543";
  }
  return p;
}

/** Qurilmaga xos kalitlar: kodga kirmasligi kerak */
const DEVICE: Record<string, string> = {
  "pixel-rpg-settings": JSON.stringify({ music: 20, touch: { leftHanded: true } }),
  "pixel-rpg-muted": "1",
  "pixel-rpg-dev": "1",
  "pixel-rpg-seen-version": "2.5.0",
};

function fill(keys: Record<string, string>) {
  for (const [k, v] of Object.entries(keys)) localStorage.setItem(k, v);
}

function snapshot() {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    out[k] = localStorage.getItem(k)!;
  }
  return out;
}

async function read(code: string): Promise<TransferData> {
  const r = await readCode(code);
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("Progressni ko'chirish kodi", () => {
  it("export -> import restores every progress key exactly", async () => {
    const src = fullProgress();
    fill({ ...src, ...DEVICE });
    const code = await exportCode();
    expect(code.startsWith(TRANSFER_PREFIX + "Z")).toBe(true);

    // boshqa qurilma: boshqa progress va o'z sozlamalari
    localStorage.clear();
    const other = { "pixel-rpg-settings": JSON.stringify({ music: 90 }), "pixel-rpg-muted": "0" };
    fill({ ...other, "pixel-rpg-gold": "3", "pixel-rpg-best-ch9-old": "1" });
    expect(applyTransfer(await read(code))).toBe(true);

    const after = snapshot();
    for (const [k, v] of Object.entries(src)) expect(after[k], k).toBe(v);
    // hozirgi qurilmaning sozlamalari o'zgarmaydi; kodda yo'q eski progress kaliti o'chadi
    expect(after["pixel-rpg-settings"]).toBe(other["pixel-rpg-settings"]);
    expect(after["pixel-rpg-muted"]).toBe("0");
    expect(after["pixel-rpg-best-ch9-old"]).toBeUndefined();
    expect(loadGold()).toBe(1234);
  });

  it("device-specific keys (settings, muted, dev, seen-version) never enter the code", async () => {
    fill({ ...fullProgress("none"), ...DEVICE });
    const d = await read(await exportCode());
    for (const k of Object.keys(DEVICE)) expect(d.keys[k], k).toBeUndefined();
    expect(d.keys[SETTINGS_KEY]).toBeUndefined();
    expect(d.keys["pixel-rpg-gold"]).toBe("1234");
  });

  it("rejects a code with any single character changed", async () => {
    fill(fullProgress("none"));
    const code = await exportCode();
    const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    for (let n = 0; n < 40; n++) {
      const i = 5 + Math.floor((n / 40) * (code.length - 5));
      const c = code[i]!;
      if (c === ".") continue;
      const swap = alpha[(alpha.indexOf(c) + 1 + n) % alpha.length]!;
      const broken = code.slice(0, i) + swap + code.slice(i + 1);
      const r = await readCode(broken);
      expect(r.ok, `pos ${i}`).toBe(false);
      if (!r.ok) expect(r.error).toBe(BAD_CODE);
    }
    // qisqartirilgan (to'liq nusxalanmagan) kod
    const cut = await readCode(code.slice(0, code.length - 20));
    expect(cut).toEqual({ ok: false, error: BAD_CODE });
    expect((await readCode("salom")).ok).toBe(false);
    expect((await readCode("  ")).ok).toBe(false);
  });

  it("tolerates spaces, line breaks and parts pasted in any order", async () => {
    fill(fullProgress("none"));
    const code = await exportCode();
    const mid = code.length >> 1;
    const spaced = `  ${code.slice(0, mid)}\n\n${code.slice(mid)} `;
    expect((await readCode(spaced)).ok).toBe(true);
    expect((await readCode(code.slice(mid) + "\n" + code.slice(0, mid))).ok).toBe(true);
  });

  it("backup before apply, then OLDINGI HOLATGA QAYTARISH restores it", async () => {
    fill(fullProgress("none"));
    const code = await exportCode();
    localStorage.clear();
    const mine = {
      "pixel-rpg-gold": "77",
      "pixel-rpg-hero": "mage",
      "pixel-rpg-achievements": JSON.stringify(["first"]),
      "pixel-rpg-save-version": String(SAVE_VERSION),
      "pixel-rpg-unlocked-heroes": JSON.stringify(["knight", "mage", "hunter"]),
    };
    fill({ ...mine, ...DEVICE });
    expect(loadBackup()).toBeNull();
    expect(applyTransfer(await read(code))).toBe(true);
    expect(loadGold()).toBe(1234);
    const b = loadBackup();
    expect(b?.keys).toEqual(mine);

    expect(restoreBackup()).toBe(true);
    const after = snapshot();
    expect(after).toEqual({ ...mine, ...DEVICE });
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
    expect(restoreBackup()).toBe(false);
  });

  it("the backup itself is not exported", async () => {
    fill(fullProgress("none"));
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ time: 1, keys: { "pixel-rpg-gold": "5" } }));
    const d = await read(await exportCode());
    expect(d.keys[BACKUP_KEY]).toBeUndefined();
  });

  it("stays shorter than 3500 characters, even with a fully explored realm", async () => {
    for (const fog of ["none", "walk", "full"] as const) {
      localStorage.clear();
      fill(fullProgress(fog));
      const code = await exportCode();
      expect(code.length, fog).toBeLessThan(MAX_CODE);
      expect(splitCode(code)).toEqual([code]);
    }
  });

  it("never contains '__' (Telegram would turn it into italics)", async () => {
    fill(fullProgress("walk"));
    expect(await exportCode()).not.toContain("__");
    expect(splitCode("PQ1-ab__cd")).toEqual(["PQ1-ab__cd"]);
  });

  it("preview summary: gold, heroes, achievements count and best record", async () => {
    fill(fullProgress("none"));
    const d = await read(await exportCode());
    expect(d.summary).toEqual({
      gold: 1234,
      heroes: ["knight", "mage", "hunter", "gunner"],
      achievements: 18,
      best: 98765,
    });
    localStorage.clear();
    expect(currentSummary()).toEqual({
      gold: 0,
      heroes: ["knight", "mage", "hunter"],
      achievements: 0,
      best: 0,
    });
  });

  it("an old-version code runs the save migrations on import", async () => {
    // v2 saqlanishi: Sehrgar tanlangan, ochilgan qahramonlar ro'yxati hali yo'q
    fill({
      "pixel-rpg-save-version": "2",
      "pixel-rpg-hero": "mage",
      "pixel-rpg-gold": "40",
      "pixel-rpg-achievements": JSON.stringify(["winKnight"]),
    });
    const code = await exportCode();
    localStorage.clear();
    expect(applyTransfer(await read(code))).toBe(true);
    expect(localStorage.getItem(SAVE_VERSION_KEY)).toBe(String(SAVE_VERSION));
    expect(localStorage.getItem(UNLOCKED_HEROES_KEY)).not.toBeNull();
    expect([...loadUnlockedHeroes()]).toContain("mage");
  });

  it("refuses a code from a newer save version", async () => {
    fill({ "pixel-rpg-save-version": String(SAVE_VERSION + 1), "pixel-rpg-gold": "5" });
    const r = await readCode(await exportCode());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/yangiroq versiya/);
  });

  it("without CompressionStream: plain fallback code, split into parts if long", async () => {
    vi.stubGlobal("CompressionStream", undefined);
    fill(fullProgress("walk"));
    const code = await exportCode();
    expect(code.startsWith(TRANSFER_PREFIX + "J")).toBe(true);
    const parts = splitCode(code);
    for (const p of parts) expect(p.length).toBeLessThan(MAX_CODE);
    expect(parts.join("")).toBe(code);
    const d = await read(parts.join("\n"));
    expect(d.keys["pixel-rpg-realm"]).toBe(localStorage.getItem("pixel-rpg-realm"));
  });

  it("without DecompressionStream: built-in inflate reads compressed codes", async () => {
    fill(fullProgress("walk"));
    const code = await exportCode();
    const realm = localStorage.getItem(REALM_SAVE_KEY);
    vi.stubGlobal("DecompressionStream", undefined);
    const d = await read(code);
    expect(d.keys[REALM_SAVE_KEY]).toBe(realm);
  });
});

describe("Olam tumani (bitset + RLE)", () => {
  it("round-trips any bitset exactly", () => {
    const cases = [new Uint8Array(4608), new Uint8Array(4608).fill(255), new Uint8Array(9)];
    const mixed = new Uint8Array(4608);
    for (let i = 0; i < mixed.length; i++) mixed[i] = (i * 73) % 7 ? (i * 31) & 0xff : 0;
    cases.push(mixed);
    for (const bytes of cases) {
      const b64 = btoa(String.fromCharCode(...bytes));
      const rle = packFog(b64)!;
      expect(rle.startsWith("rle:")).toBe(true);
      expect(unpackFog(rle)).toBe(b64);
    }
    // to'liq o'rganilgan olam — bir necha belgi
    expect(packFog(btoa(String.fromCharCode(...cases[1]!)))!.length).toBeLessThan(12);
  });

  it("leaves non-canonical data alone and rejects broken RLE", () => {
    expect(packFog("@@@")).toBeNull();
    expect(() => unpackFog("rle:@")).toThrow();
    expect(() => unpackFog("rle:B")).toThrow();
  });
});
