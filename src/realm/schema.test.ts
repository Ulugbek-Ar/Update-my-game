import { describe, expect, it } from "vitest";
import valley from "./data/regions/valley.json";
import dialogs from "./data/dialogs.json";
import quests from "./data/quests.json";
import items from "./data/items.json";
import drops from "./data/drops.json";
import shops from "./data/shops.json";
import { RegionSchema, parseRealmData } from "./schema";
import { buildChunk, RealmMap } from "./map";
import { CHUNK } from "./tiles";

const raw = { region: valley, dialogs, quests, items, drops, shops };
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("JSON hudud validatsiyasi", () => {
  it("Boshlang'ich vodiy passes the schema and cross-reference checks", () => {
    const d = parseRealmData(raw);
    expect(d.region.name).toBe("BOSHLANG'ICH VODIY");
    expect(d.region.chunks).toEqual({ w: 6, h: 6 });
    expect(d.region.npcs.map((n) => n.id)).toEqual(["elder", "merchant", "oldgunner"]);
    // qishloq, o'rmon cheti, ko'prik, xarobalar, g'or
    for (const id of ["village", "stones", "bridge", "ruins", "cave"])
      expect(d.region.landmarks.some((l) => l.id === id)).toBe(true);
    expect(d.region.secrets.length).toBeGreaterThanOrEqual(5);
  });

  it("rejects an unknown tile, out-of-bounds NPC and broken secret references", () => {
    const bad = clone(valley) as Record<string, unknown> & typeof valley;
    (bad.terrain as { base: string }).base = "lava";
    expect(RegionSchema.safeParse(bad).success).toBe(false);

    const far = clone(valley);
    far.npcs[0]!.x = 999;
    const r1 = RegionSchema.safeParse(far);
    expect(r1.success).toBe(false);
    expect(JSON.stringify(r1.error?.issues)).toContain("hududdan tashqarida");

    const door = clone(valley);
    const s = door.secrets.find((x) => x.type === "nightdoor") as { door: string };
    s.door = "yo'q";
    expect(RegionSchema.safeParse(door).success).toBe(false);

    const dup = clone(valley);
    dup.objects.push({ ...dup.objects[0]! });
    expect(RegionSchema.safeParse(dup).success).toBe(false);
  });

  it("cross-file checks catch missing dialogs, quests and items", () => {
    const d1 = clone(dialogs) as Record<string, unknown>;
    delete d1["merchant"];
    expect(() => parseRealmData({ ...raw, dialogs: d1 })).toThrow(/dialog yo'q/);

    const q = clone(quests);
    q.ruins.steps[2]!.item = "olmos";
    expect(() => parseRealmData({ ...raw, quests: q })).toThrow(/olmos/);

    const sh = clone(shops);
    sh.merchant.push("meat");
    expect(() => parseRealmData({ ...raw, shops: sh })).toThrow(/narxsiz/);
  });

  it("a new region can be added with JSON alone", () => {
    const tiny = {
      id: "test",
      name: "SINOV",
      seed: 1,
      chunks: { w: 1, h: 1 },
      terrain: { base: "grass", layers: [{ tile: "tree", scale: 0.2, threshold: 0.7 }] },
      features: [{ type: "rect", tile: "path", x: 0, y: 10, w: 32, h: 2 }],
      spawn: [5, 10],
    };
    const r = RegionSchema.parse(tiny);
    const m = new RealmMap(r);
    expect(m.w).toBe(CHUNK);
    expect(m.base(5, 10)).toBe(3);
    // hududdan tashqari — o'tib bo'lmaydi
    expect(m.base(-1, 0)).toBe(9);
  });
});

describe("Chunk generatsiyasi", () => {
  it("is deterministic and seed-dependent", () => {
    const r = RegionSchema.parse(valley);
    const a = buildChunk(r, 1, 1),
      b = buildChunk(r, 1, 1);
    expect(a).toEqual(b);
    const other = buildChunk({ ...r, seed: r.seed + 1 }, 1, 1);
    expect(other).not.toEqual(a);
  });
});
