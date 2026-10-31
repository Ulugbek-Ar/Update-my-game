import { beforeEach, describe, expect, it } from "vitest";
import { Game } from "@/game/game";
import { BOSS_WAVE } from "@/game/waves";
import { Boss, Queen } from "@/game/boss";
import { ACHIEVEMENTS_KEY } from "@/game/achievements";
import {
  HORN_ITEM,
  REALM_INBOX_KEY,
  REALM_KEYS_KEY,
  REALM_SAVE_KEY,
  isRealmUnlocked,
  loadBossKeys,
  realmInbox,
  recordBossKey,
  takeRealmInbox,
} from "@/game/realmLink";
import { loadRealmData } from "./data";
import { RealmSim, tileCenter, type RealmUi } from "./sim";
import { RealmMob } from "./mobs";

beforeEach(() => localStorage.clear());

function makeGame() {
  const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
  const g = new Game(canvas as unknown as HTMLCanvasElement, "knight");
  g.hints = [];
  return g;
}

/** 1-dunyo Boss to'lqini va Iblisni bir zarbada yengish. */
function killDevil(g: Game) {
  (g as unknown as { startWave(i: number): void }).startWave(BOSS_WAVE);
  const boss = g.boss!;
  expect(boss).toBeInstanceOf(Boss);
  expect(boss).not.toBeInstanceOf(Queen);
  (g as unknown as { damageTarget(t: Boss, d: number): void }).damageTarget(boss, boss.hp + 99);
}

function realmSaveWithHorn(
  status: "active" | "done",
  inv: ({ item: string; n: number } | null)[] = [],
) {
  localStorage.setItem(
    REALM_SAVE_KEY,
    JSON.stringify({ v: 1, player: { quests: { horn: { status, step: 0, progress: 0 } }, inv } }),
  );
}

describe("Olam qulfi", () => {
  it("is locked until the World 1 Devil is beaten", () => {
    expect(isRealmUnlocked()).toBe(false);
    const g = makeGame();
    killDevil(g);
    expect(isRealmUnlocked()).toBe(true);
    expect(loadBossKeys().has("devil")).toBe(true);
  });

  it("stays open for old saves where the Devil was already beaten", () => {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(["boss"]));
    expect(isRealmUnlocked()).toBe(true);
  });
});

describe("Darvoza kalitlari", () => {
  it("each main boss gives its key once and it is saved", () => {
    expect(recordBossKey("queen")).toBe(true);
    expect(recordBossKey("queen")).toBe(false);
    expect(JSON.parse(localStorage.getItem(REALM_KEYS_KEY)!)).toEqual(["queen"]);
    expect([...loadBossKeys()]).toEqual(["queen"]);
    expect(isRealmUnlocked()).toBe(false);
  });

  it("the Queen's gate says 'coming soon' with the key and stays locked without it", () => {
    const s = new RealmSim(loadRealmData());
    const rp = s.addPlayer("p1", "knight");
    const gate = s.region.objects.find((o) => o.type === "gate" && o.key === "queen")!;
    const look = () => {
      rp.ui = null;
      rp.p.x = tileCenter(gate.x);
      rp.p.y = tileCenter(gate.y) + 14;
      rp.p.fx = 0;
      rp.p.fy = -1;
      s.step([{ pid: "p1", cmd: { type: "interact" } }]);
      const ui = rp.ui as RealmUi | null;
      return ui?.kind === "sign" ? ui.text.join(" ") : "";
    };
    expect(look()).toContain("qulflangan");
    rp.keys = ["queen"];
    expect(look()).toContain("TEZ ORADA");
  });
});

describe("Iblisning shoxi", () => {
  it("drops only while the quest is active", () => {
    killDevil(makeGame());
    expect(realmInbox()).toEqual([]);
    realmSaveWithHorn("done");
    killDevil(makeGame());
    expect(realmInbox()).toEqual([]);
    realmSaveWithHorn("active");
    killDevil(makeGame());
    expect(realmInbox()).toEqual([HORN_ITEM]);
    // ikkinchi shox tushmaydi
    killDevil(makeGame());
    expect(realmInbox()).toEqual([HORN_ITEM]);
    localStorage.removeItem(REALM_INBOX_KEY);
    realmSaveWithHorn("active", [{ item: HORN_ITEM, n: 1 }]);
    killDevil(makeGame());
    expect(realmInbox()).toEqual([]);
  });

  it("goes to the realm inventory and the elder rewards it", () => {
    realmSaveWithHorn("active");
    killDevil(makeGame());
    const s = new RealmSim(loadRealmData());
    const rp = s.addPlayer("p1", "knight");
    s.startQuest(rp, "horn");
    for (const item of takeRealmInbox()) s.grant(rp, item);
    expect(realmInbox()).toEqual([]);
    expect(s.countItem(rp, HORN_ITEM)).toBe(1);
    const elder = s.region.npcs.find((n) => n.id === "elder")!;
    rp.p.x = tileCenter(elder.x);
    rp.p.y = tileCenter(elder.y) + 16;
    rp.p.fx = 0;
    rp.p.fy = -1;
    s.step([{ pid: "p1", cmd: { type: "interact" } }]);
    expect(s.questStatus(rp, "horn")).toBe("ready");
    const i = s.visibleChoices(rp).findIndex((c) => c.text.includes("shoxini olib keldim"));
    s.step([{ pid: "p1", cmd: { type: "choose", index: i } }]);
    expect(s.questStatus(rp, "horn")).toBe("done");
    expect(s.countItem(rp, HORN_ITEM)).toBe(0);
    expect(s.countItem(rp, "ember")).toBe(1);
  });
});

describe("Hujum ogohlantirishi", () => {
  it("a warning mark exists exactly during the windup", () => {
    const s = new RealmSim(loadRealmData());
    const rp = s.addPlayer("p1", "knight");
    rp.p.takeHit = () => false;
    s.mobs = [];
    rp.p.x = tileCenter(160);
    rp.p.y = tileCenter(108);
    const m = new RealmMob(900, "warden", rp.p.x + 40, rp.p.y, "test");
    m.spawnT = 0;
    s.mobs.push(m);
    const seen = new Set<string>();
    for (let i = 0; i < 600 && seen.size < 2; i++) {
      s.step([]);
      const k = s.marks.find((k) => k.owner === m.id && !k.dmg);
      if (m.state === "windup") {
        expect(k).toBeDefined();
        expect(k!.t).toBeCloseTo(m.t);
        expect(k!.kind).toBe(m.move === "slam" ? "circle" : "line");
        seen.add(m.move);
      } else expect(k).toBeUndefined();
    }
    expect([...seen].sort()).toEqual(["charge", "slam"]);
  });
});
