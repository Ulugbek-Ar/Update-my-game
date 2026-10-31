import { describe, expect, it } from "vitest";
import valley from "./data/regions/valley.json";
import ashmount from "./data/regions/ashmount.json";
import dialogs from "./data/dialogs.json";
import quests from "./data/quests.json";
import items from "./data/items.json";
import drops from "./data/drops.json";
import shops from "./data/shops.json";
import { loadRealmData } from "./data";
import { RegionSchema, parseRealmData } from "./schema";
import { RealmSim, LAVA_EVERY, tileCenter, type RealmPlayer, type RealmUi } from "./sim";
import { LAVA, TILE, TILE_IDS } from "./tiles";
import { RealmMap } from "./map";
import { GUARD_DMG, HOUND_PACK_R, RealmMob } from "./mobs";

const data = loadRealmData();
const ash = data.areas.find((a) => a.id === "ashmount")!;
const raw = { region: valley, regions: [ashmount], dialogs, quests, items, drops, shops };
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Kul tog'i plitkasi (hudud koordinatasi) -> global piksel markazi */
const at = (x: number, y: number) => ({ x: tileCenter(ash.x + x), y: tileCenter(ash.y + y) });

function put(rp: RealmPlayer, p: { x: number; y: number }) {
  rp.p.x = rp.px = p.x;
  rp.p.y = rp.py = p.y;
}

function run(s: RealmSim, ticks: number) {
  for (let i = 0; i < ticks; i++) s.step();
}

describe("Kul tog'i: JSON hudud", () => {
  it("passes the schema and sits south of the valley (6x6 chunks)", () => {
    const r = RegionSchema.parse(ashmount);
    expect(r.name).toBe("KUL TOG'I");
    expect(r.chunks).toEqual({ w: 6, h: 6 });
    expect(r.origin).toEqual({ cx: 0, cy: 6 });
    expect(ash).toMatchObject({ x: 0, y: 192, w: 192, h: 192 });
    expect(new Set(r.mobZones.map((z) => z.mob))).toEqual(
      new Set(["ashhound", "lavaworm", "obsguard"]),
    );
    expect(r.npcs.map((n) => n.name)).toEqual(["SURGUN QILINGAN ROHIB"]);
    for (const id of ["ashgate", "camp", "lavalake", "obsruins", "temple", "kinghall"])
      expect(
        r.landmarks.some((l) => l.id === id),
        id,
      ).toBe(true);
    // kamida 4 ta sir, bittasi jamoaviy (ikki plita)
    expect(r.secrets.length).toBeGreaterThanOrEqual(4);
    expect(r.secrets.filter((x) => x.type === "plates")).toHaveLength(1);
    // monk: 3 ta topshiriq, Paladin bilan boshqacha gaplashadi
    expect(Object.values(data.quests).filter((q) => q.giver === "monk")).toHaveLength(3);
    expect(data.dialogs["monk"]!.heroStart?.["paladin"]).toBe("paladin");
  });

  it("has black volcanic rock, red lava rivers, obsidian ruins and the Iblis temple", () => {
    const s = new RealmSim(data);
    const count: Record<string, number> = {};
    for (let ty = ash.y; ty < ash.y + ash.h; ty++)
      for (let tx = ash.x; tx < ash.x + ash.w; tx++) {
        const t = s.tileAt(tx, ty);
        count[t] = (count[t] ?? 0) + 1;
      }
    const n = (name: keyof typeof TILE_IDS) => count[TILE_IDS[name]] ?? 0;
    expect(n("lava")).toBeGreaterThan(400);
    expect(n("basalt")).toBeGreaterThan(300);
    expect(n("obsidian")).toBeGreaterThan(60);
    expect(n("tfloor")).toBeGreaterThan(800);
    // vodiy relyefi o'zgarmadi (yolg'iz vodiydan qurilgan xarita bilan bir xil)
    const v = new RealmMap(RegionSchema.parse(valley));
    for (let y = 0; y < 192; y += 7)
      for (let x = 0; x < 192; x += 5) expect(s.map.base(x, y)).toBe(v.base(x, y));
  });

  it("rejects broken data: gate to nowhere, plates secret without a plate, overlapping regions", () => {
    const g = clone(ashmount);
    (g.objects.find((o) => o.id === "gate-ash") as { to: string }).to = "yoq";
    expect(() => parseRealmData({ ...raw, regions: [g] })).toThrow(/darvozasi yo'q/);

    const pl = clone(ashmount);
    (pl.secrets.find((x) => x.type === "plates") as { plates: string[] }).plates[1] = "sign-ash";
    expect(RegionSchema.safeParse(pl).success).toBe(false);

    const over = clone(ashmount);
    over.origin = { cx: 2, cy: 2 };
    expect(() => parseRealmData({ ...raw, regions: [over] })).toThrow(/ustma-ust/);
  });

  it("new rare and legendary loot gives its bonus in the realm inventory", () => {
    for (const id of ["beads", "cinderheart", "ashcloak", "obsblade"])
      expect(data.items[id]!.rarity, id).toBe("rare");
    for (const id of ["phoenix", "twinheart"]) expect(data.items[id]!.rarity, id).toBe("legendary");
    const s = new RealmSim(data);
    const rp = s.addPlayer("p1", "knight");
    const hp = rp.p.maxHp,
      dmg = rp.p.damage;
    s.grant(rp, "twinheart");
    expect([rp.p.maxHp, rp.p.damage]).toEqual([hp + 1, dmg + 1]);
    // yangi moblarning luti bor
    for (const k of ["ashhound", "lavaworm", "obsguard"] as const)
      expect(data.drops[k]?.items.length, k).toBeGreaterThan(0);
  });
});

describe("Iblis kaliti darvozasi", () => {
  function use(s: RealmSim, rp: RealmPlayer, id: string) {
    const o = s.object(id)!;
    rp.ui = null;
    rp.p.x = tileCenter(o.x);
    rp.p.y = tileCenter(o.y) + 14;
    rp.p.fx = 0;
    rp.p.fy = -1;
    s.step([{ pid: rp.id, cmd: { type: "interact" } }]);
  }

  it("stays locked without the key; with it leads to Ash Mountain and back", () => {
    const s = new RealmSim(data);
    const rp = s.addPlayer("p1", "knight");
    use(s, rp, "gate-devil");
    expect((rp.ui as RealmUi | null)?.kind).toBe("sign");
    expect(JSON.stringify(rp.ui)).toContain("qulflangan");
    expect(s.areaAt(rp.p.x, rp.p.y)?.id).toBe("valley");

    rp.keys = ["devil"];
    use(s, rp, "gate-devil");
    expect(s.events.some((e) => e.type === "portal" && e.area === "ashmount")).toBe(true);
    expect(s.areaAt(rp.p.x, rp.p.y)?.id).toBe("ashmount");
    const back = s.object("gate-ash")!;
    expect(Math.hypot(rp.p.x - tileCenter(back.x), rp.p.y - tileCenter(back.y))).toBeLessThan(48);
    expect(s.boxBlocked(rp.p.x, rp.p.y, rp.p.size)).toBe(false);

    use(s, rp, "gate-ash");
    expect(s.areaAt(rp.p.x, rp.p.y)?.id).toBe("valley");
  });

  it("dying on Ash Mountain respawns at the Ash gate, not in the village", () => {
    const s = new RealmSim(data);
    const rp = s.addPlayer("p1", "knight");
    put(rp, at(60, 60));
    rp.p.hp = 1;
    rp.p.takeHit(1, rp.p.x, rp.p.y, 0);
    run(s, 70);
    expect(s.areaAt(rp.p.x, rp.p.y)?.id).toBe("ashmount");
    expect(rp.p.dead).toBe(false);
  });
});

describe("Lava", () => {
  /** Hamma tomoni lava bo'lgan plitka (daryo o'rtasi) */
  function deepLava(s: RealmSim) {
    for (let ty = ash.y + 8; ty < ash.y + ash.h - 8; ty++)
      for (let tx = 8; tx < ash.w - 8; tx++) {
        let ok = true;
        for (let dy = -1; dy <= 1 && ok; dy++)
          for (let dx = -1; dx <= 1 && ok; dx++) ok = LAVA[s.tileAt(tx + dx, ty + dy)] === true;
        if (ok) return { x: tileCenter(tx), y: tileCenter(ty) - 4 };
      }
    throw new Error("lava yo'q");
  }

  it("burns 1 heart on contact and then every second", () => {
    const s = new RealmSim(data);
    s.mobs = [];
    const rp = s.addPlayer("p1", "paladin");
    put(rp, deepLava(s));
    const hp = rp.p.hp;
    s.step();
    expect(rp.p.hp).toBe(hp - 1);
    expect(s.events.some((e) => e.type === "burn")).toBe(true);
    run(s, 10);
    expect(rp.p.hp).toBe(hp - 1);
    run(s, 12);
    expect(rp.p.hp).toBe(hp - 2);
    run(s, 20);
    expect(rp.p.hp).toBe(hp - 3);
    // lavadan chiqdi — kuymaydi
    put(rp, at(23, 16));
    run(s, 40);
    expect(rp.p.hp).toBe(hp - 3);
    expect(LAVA_EVERY).toBe(1);
  });

  it("the Ash cloak makes lava burn half as often", () => {
    const s = new RealmSim(data);
    s.mobs = [];
    const rp = s.addPlayer("p1", "knight");
    s.grant(rp, "ashcloak");
    put(rp, deepLava(s));
    const hp = rp.p.hp;
    run(s, 1 + 30);
    expect(rp.p.hp).toBe(hp - 1);
    run(s, 12);
    expect(rp.p.hp).toBe(hp - 2);
  });
});

describe("Jamoaviy sir: ikki plita", () => {
  it("opens only when two different players stand on both plates at the same time", () => {
    const s = new RealmSim(data);
    s.mobs = [];
    const a = s.addPlayer("a", "knight");
    const b = s.addPlayer("b", "paladin");
    const pw = s.object("plate-west")!,
      pe = s.object("plate-east")!;
    const chest = s.object("chest-vault")!;
    const on = (rp: RealmPlayer, o: { x: number; y: number }) =>
      put(rp, { x: tileCenter(o.x), y: tileCenter(o.y) });
    // yolg'iz: bitta plita, keyin ikkinchisi — bir kishi ikkalasini bir vaqtda bosolmaydi
    on(a, pw);
    run(s, 50);
    on(a, pe);
    run(s, 50);
    expect(a.secrets).not.toContain("s-ash-plates");
    expect(s.visible(a, chest)).toBe(false);
    expect(Math.hypot(pw.x - pe.x, pw.y - pe.y) * TILE).toBeGreaterThan(200);
    // ikkovi birga
    on(a, pw);
    on(b, pe);
    s.step();
    expect(a.secrets).toContain("s-ash-plates");
    expect(b.secrets).toContain("s-ash-plates");
    expect(s.visible(a, chest)).toBe(true);
    expect(s.visible(b, chest)).toBe(true);
    // plitada bo'lmagan uchinchi o'yinchi kashfiyot olmaydi
    const c = s.addPlayer("c", "mage");
    s.step();
    expect(c.secrets).not.toContain("s-ash-plates");
    expect(s.visible(c, chest)).toBe(false);
  });

  it("a cracked obsidian wall hides a niche until it is broken", () => {
    const s = new RealmSim(data);
    s.mobs = [];
    const rp = s.addPlayer("p1", "knight");
    const wall = data.region.secrets.find((x) => x.id === "s-ash-wall")!;
    if (wall.type !== "breakwall") throw new Error();
    expect(s.solidAt(wall.x, wall.y)).toBe(true);
    put(rp, { x: tileCenter(wall.x - 1), y: tileCenter(wall.y) });
    rp.p.fx = 1;
    rp.p.fy = 0;
    for (let i = 0; i < 6; i++) {
      s.command(rp, { type: "attack", down: true });
      s.command(rp, { type: "attack", down: false });
      run(s, 12);
    }
    expect(rp.secrets).toContain("s-ash-wall");
    expect(s.solidAt(wall.x, wall.y)).toBe(false);
  });
});

describe("Kul tog'i moblari", () => {
  it("ash hounds run as a pack: when one sees the player, its pack chases too", () => {
    const s = new RealmSim(data);
    s.mobs = [];
    const rp = s.addPlayer("p1", "knight");
    rp.p.takeHit = () => false;
    const c = at(40, 62);
    put(rp, { x: c.x - 50, y: c.y });
    const pack = [
      [0, 0],
      [100, 0],
      [60, 100],
      [130, -40],
    ].map(([dx, dy], i) => {
      const m = new RealmMob(700 + i, "ashhound", c.x + dx!, c.y + dy!, "hounds1");
      m.spawnT = 0;
      m.state = "idle";
      m.t = 9;
      s.mobs.push(m);
      return m;
    });
    // faqat birinchisi o'yinchini ko'radi, qolganlari uzoqda, lekin to'da masofasida
    expect(Math.hypot(pack[1]!.x - rp.p.x, pack[1]!.y - rp.p.y)).toBeGreaterThan(96);
    for (const m of pack.slice(1))
      expect(Math.hypot(m.x - pack[0]!.x, m.y - pack[0]!.y)).toBeLessThan(HOUND_PACK_R);
    s.step();
    expect(pack.map((m) => m.target)).toEqual(["p1", "p1", "p1", "p1"]);
    expect(s.events.some((e) => e.type === "howl")).toBe(true);
  });

  it("a lava worm hides underground, cracks the ground under the player, then erupts and spits", () => {
    const s = new RealmSim(data);
    s.mobs = [];
    const rp = s.addPlayer("p1", "knight");
    const p = at(150, 66);
    put(rp, p);
    rp.p.fx = 1;
    rp.p.fy = 0;
    const m = new RealmMob(800, "lavaworm", p.x + 12, p.y, "test");
    m.spawnT = 0;
    s.mobs.push(m);
    expect(m.under).toBe(true);
    // yer ostida — qilich tegmaydi
    s.command(rp, { type: "attack", down: true });
    s.command(rp, { type: "attack", down: false });
    run(s, 6);
    expect(m.hp).toBe(m.maxHp);
    let warned = false;
    for (let i = 0; i < 60 && m.state !== "windup"; i++) s.step();
    expect(m.state).toBe("windup");
    warned = s.marks.some((k) => k.owner === m.id && k.kind === "crack");
    expect(warned).toBe(true);
    expect(Math.hypot(m.x - rp.p.x, m.y - rp.p.y)).toBeLessThan(12);
    const hp = rp.p.hp;
    for (let i = 0; i < 40 && m.state === "windup"; i++) s.step();
    expect(m.state).toBe("cast");
    expect(m.under).toBe(false);
    expect(rp.p.hp).toBeLessThan(hp);
    // yer ustida olov shari otadi
    for (let i = 0; i < 40 && !s.fireballs.length; i++) s.step();
    expect(s.fireballs.length).toBeGreaterThan(0);
  });

  it("an obsidian guard blocks hits from the front and its maul takes 2 hearts", () => {
    const s = new RealmSim(data);
    s.mobs = [];
    const rp = s.addPlayer("p1", "knight");
    const p = at(150, 140);
    put(rp, p);
    const m = new RealmMob(900, "obsguard", p.x + 22, p.y, "test");
    m.spawnT = 0;
    m.state = "chase";
    m.dirX = -1;
    m.dirY = 0;
    s.mobs.push(m);
    expect(m.shieldUp).toBe(true);
    expect(m.blocks(rp.p.x, rp.p.y)).toBe(true);
    expect(m.blocks(m.x + 30, m.y)).toBe(false);
    const hp = rp.p.hp;
    for (let i = 0; i < 80 && rp.p.hp === hp; i++) s.step();
    expect(hp - rp.p.hp).toBe(GUARD_DMG);
    expect(GUARD_DMG).toBe(2);
  });

  it("stays deterministic with hounds, worms and fireballs", () => {
    const go = () => {
      const s = new RealmSim(data);
      const rp = s.addPlayer("p1", "hunter");
      put(rp, at(150, 64));
      for (let i = 0; i < 240; i++)
        s.step([{ pid: "p1", cmd: { type: "move", x: Math.sin(i / 9), y: Math.cos(i / 13) } }]);
      return s.digest();
    };
    expect(go()).toBe(go());
  });
});
