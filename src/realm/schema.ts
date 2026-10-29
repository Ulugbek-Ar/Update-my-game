/**
 * Ochiq olam ma'lumotlari (hududlar, dialoglar, topshiriqlar, buyumlar) — JSON'dan zod bilan tekshiriladi.
 * Yangi hudud qo'shish uchun src/realm/data/regions/ ga JSON qo'shish yetarli.
 */
import { z } from "zod";
import { CHUNK, TILE_NAMES } from "./tiles";

const int = z.number().int();
const Pt = z.tuple([int, int]);
const Tile = z.enum(TILE_NAMES);

export const MOB_KINDS = ["boar", "rat", "sentinel", "wisp", "warden"] as const;
export type MobKind = (typeof MOB_KINDS)[number];
export const NPC_SPRITES = ["elder", "merchant"] as const;

const Feature = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("rect"),
    tile: Tile,
    x: int,
    y: int,
    w: int.positive(),
    h: int.positive(),
    /** faqat chegara (ichi o'zgarmaydi) */
    border: int.positive().optional(),
  }),
  z.object({
    type: z.literal("ellipse"),
    tile: Tile,
    x: int,
    y: int,
    rx: z.number().positive(),
    ry: z.number().positive(),
  }),
  z.object({
    type: z.literal("path"),
    tile: Tile,
    points: z.array(Pt).min(2),
    width: z.number().positive(),
  }),
  z.object({
    type: z.literal("stamp"),
    x: int,
    y: int,
    rows: z.array(z.string()).min(1),
    /** belgi -> plitka; "." va ko'rsatilmagan belgilar o'zgarmaydi */
    legend: z.record(z.string().length(1), Tile),
  }),
  z.object({
    type: z.literal("scatter"),
    tile: Tile,
    x: int,
    y: int,
    w: int.positive(),
    h: int.positive(),
    density: z.number().min(0).max(1),
    /** faqat shu plitkalar ustiga */
    on: z.array(Tile).optional(),
  }),
]);
export type Feature = z.infer<typeof Feature>;

const Layer = z.object({
  tile: Tile,
  /** shovqin masshtabi (kichik — katta dog'lar) */
  scale: z.number().positive(),
  /** shovqin shundan katta bo'lsa — shu plitka */
  threshold: z.number().min(0).max(1),
  on: z.array(Tile).optional(),
  area: z.tuple([int, int, int.positive(), int.positive()]).optional(),
});

const Loot = z.object({ item: z.string(), n: int.positive().default(1) });

const GameObject = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("chest"),
    id: z.string(),
    x: int,
    y: int,
    loot: z.array(Loot),
    gold: int.nonnegative().default(0),
    /** sir ochilgunicha ko'rinmaydi */
    hidden: z.boolean().default(false),
    /** suv ostida: faqat yaqindan izlansa chiqadi */
    submerged: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("torch"),
    id: z.string(),
    x: int,
    y: int,
    mark: z.enum(["moon", "sun", "star"]),
  }),
  z.object({ type: z.literal("sign"), id: z.string(), x: int, y: int, text: z.array(z.string()) }),
  z.object({ type: z.literal("fragment"), id: z.string(), x: int, y: int }),
  z.object({ type: z.literal("door"), id: z.string(), x: int, y: int, night: z.boolean() }),
  z.object({ type: z.literal("lamp"), id: z.string(), x: int, y: int }),
]);
export type GameObjectDef = z.infer<typeof GameObject>;

const Secret = z.discriminatedUnion("type", [
  z.object({ type: z.literal("breakwall"), id: z.string(), x: int, y: int, hits: int.positive() }),
  z.object({ type: z.literal("nightdoor"), id: z.string(), door: z.string() }),
  z.object({
    type: z.literal("tablet"),
    id: z.string(),
    fragments: z.array(z.string()).length(3),
    lore: z.array(z.string()).min(1),
  }),
  z.object({ type: z.literal("riverchest"), id: z.string(), chest: z.string() }),
  z.object({
    type: z.literal("torches"),
    id: z.string(),
    order: z.array(z.string()).min(2),
    reveal: z.array(z.string()),
    tiles: z.array(z.object({ x: int, y: int, tile: Tile })).default([]),
  }),
]);
export type SecretDef = z.infer<typeof Secret>;

export const RegionSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    seed: int,
    /** dunyodagi joyi (chunk'larda) — keyingi hududlar yonma-yon qo'shiladi */
    origin: z.object({ cx: int, cy: int }).default({ cx: 0, cy: 0 }),
    chunks: z.object({ w: int.min(1).max(16), h: int.min(1).max(16) }),
    terrain: z.object({ base: Tile, layers: z.array(Layer).default([]) }),
    features: z.array(Feature).default([]),
    spawn: Pt,
    landmarks: z
      .array(z.object({ id: z.string(), name: z.string(), x: int, y: int, r: int.positive() }))
      .default([]),
    npcs: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          sprite: z.enum(NPC_SPRITES),
          x: int,
          y: int,
          dialog: z.string(),
        }),
      )
      .default([]),
    mobZones: z
      .array(
        z.object({
          id: z.string(),
          mob: z.enum(MOB_KINDS),
          x: int,
          y: int,
          r: int.nonnegative(),
          count: int.positive(),
          /** qayta tug'ilish (soniya) */
          respawn: z.number().positive(),
          time: z.enum(["any", "day", "night"]).default("any"),
        }),
      )
      .default([]),
    objects: z.array(GameObject).default([]),
    secrets: z.array(Secret).default([]),
  })
  .superRefine((r, ctx) => {
    const W = r.chunks.w * CHUNK,
      H = r.chunks.h * CHUNK;
    const inside = (x: number, y: number, path: (string | number)[]) => {
      if (x < 0 || y < 0 || x >= W || y >= H)
        ctx.addIssue({ code: "custom", path, message: `(${x}, ${y}) hududdan tashqarida` });
    };
    inside(r.spawn[0], r.spawn[1], ["spawn"]);
    r.npcs.forEach((n, i) => inside(n.x, n.y, ["npcs", i]));
    r.mobZones.forEach((z, i) => inside(z.x, z.y, ["mobZones", i]));
    r.objects.forEach((o, i) => inside(o.x, o.y, ["objects", i]));
    r.landmarks.forEach((l, i) => inside(l.x, l.y, ["landmarks", i]));
    const ids = new Set<string>();
    for (const [i, o] of r.objects.entries()) {
      if (ids.has(o.id))
        ctx.addIssue({ code: "custom", path: ["objects", i], message: `takror id: ${o.id}` });
      ids.add(o.id);
    }
    const need = (id: string, type: string, path: (string | number)[]) => {
      const o = r.objects.find((o) => o.id === id);
      if (!o || o.type !== type)
        ctx.addIssue({ code: "custom", path, message: `${type} topilmadi: ${id}` });
    };
    for (const [i, s] of r.secrets.entries()) {
      if (s.type === "nightdoor") need(s.door, "door", ["secrets", i]);
      if (s.type === "tablet") s.fragments.forEach((f) => need(f, "fragment", ["secrets", i]));
      if (s.type === "riverchest") need(s.chest, "chest", ["secrets", i]);
      if (s.type === "torches") {
        s.order.forEach((t) => need(t, "torch", ["secrets", i]));
        s.reveal.forEach((id) => {
          if (!ids.has(id))
            ctx.addIssue({ code: "custom", path: ["secrets", i], message: `topilmadi: ${id}` });
        });
      }
      if (s.type === "breakwall") inside(s.x, s.y, ["secrets", i]);
    }
  });
export type RegionDef = z.infer<typeof RegionSchema>;

const Cond = z.object({
  quest: z.string(),
  state: z.array(z.enum(["none", "active", "ready", "done"])).min(1),
});
const Action = z.union([
  z.object({ startQuest: z.string() }),
  z.object({ completeQuest: z.string() }),
  z.object({ shop: z.literal(true) }),
]);
const Choice = z.object({
  text: z.string(),
  /** keyingi tugun; ko'rsatilmasa dialog yopiladi */
  next: z.string().optional(),
  /** bitta shart yoki shartlar ro'yxati (hammasi bajarilishi kerak) */
  if: z.union([Cond, z.array(Cond).min(1)]).optional(),
  do: z.array(Action).default([]),
});
const DialogNode = z.object({
  text: z.array(z.string()).min(1),
  choices: z.array(Choice).min(1),
});
export const DialogsSchema = z.record(
  z.string(),
  z.object({ start: z.string(), nodes: z.record(z.string(), DialogNode) }),
);
export type DialogsDef = z.infer<typeof DialogsSchema>;
export type DialogChoice = z.infer<typeof Choice>;
export type DialogAction = z.infer<typeof Action>;

const QuestStep = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("kill"),
    mob: z.enum(MOB_KINDS),
    count: int.positive(),
    text: z.string(),
  }),
  z.object({ type: z.literal("find"), landmark: z.string(), text: z.string() }),
  z.object({ type: z.literal("talk"), npc: z.string(), text: z.string() }),
  z.object({
    type: z.literal("deliver"),
    item: z.string(),
    count: int.positive(),
    npc: z.string(),
    text: z.string(),
  }),
]);
export type QuestStepDef = z.infer<typeof QuestStep>;
export const QuestsSchema = z.record(
  z.string(),
  z.object({
    name: z.string(),
    giver: z.string(),
    desc: z.string(),
    steps: z.array(QuestStep).min(1),
    reward: z.object({ gold: int.nonnegative().default(0), items: z.array(Loot).default([]) }),
  }),
);
export type QuestsDef = z.infer<typeof QuestsSchema>;

export const ItemsSchema = z.record(
  z.string(),
  z.object({
    name: z.string(),
    rarity: z.enum(["common", "rare", "legendary"]),
    desc: z.string(),
    icon: z.string(),
    stack: int.min(1).max(99).default(9),
    /** sotib olish narxi (savdogarda bo'lsa) */
    price: int.nonnegative().optional(),
    /** savdogarga sotish narxi */
    sell: int.nonnegative().default(1),
    /** ishlatilganda */
    heal: int.positive().optional(),
    /** inventarda turganda doimiy kuch */
    bonus: z
      .object({
        damage: int.optional(),
        maxHp: int.optional(),
        speed: z.number().optional(),
        light: z.number().optional(),
      })
      .optional(),
  }),
);
export type ItemsDef = z.infer<typeof ItemsSchema>;
export type ItemDef = ItemsDef[string];
export type Rarity = ItemDef["rarity"];

export const DropsSchema = z.record(
  z.enum(MOB_KINDS),
  z.object({
    gold: z.tuple([int.nonnegative(), int.nonnegative()]),
    items: z.array(z.object({ item: z.string(), chance: z.number().min(0).max(1) })),
  }),
);
export type DropsDef = z.infer<typeof DropsSchema>;

export const ShopSchema = z.record(z.string(), z.array(z.string()));

export interface RealmData {
  region: RegionDef;
  dialogs: DialogsDef;
  quests: QuestsDef;
  items: ItemsDef;
  drops: DropsDef;
  shops: Record<string, string[]>;
}

/**
 * Hudud va unga bog'liq fayllarni tekshiradi: sxema + o'zaro havolalar
 * (NPC dialogi, topshiriqdagi NPC/joy/buyum, sandiq lut'i, savdogar buyumlari).
 * Xato bo'lsa — barcha muammolar ro'yxati bilan Error.
 */
export function parseRealmData(raw: {
  region: unknown;
  dialogs: unknown;
  quests: unknown;
  items: unknown;
  drops: unknown;
  shops: unknown;
}): RealmData {
  const data: RealmData = {
    region: RegionSchema.parse(raw.region),
    dialogs: DialogsSchema.parse(raw.dialogs),
    quests: QuestsSchema.parse(raw.quests),
    items: ItemsSchema.parse(raw.items),
    drops: DropsSchema.parse(raw.drops),
    shops: ShopSchema.parse(raw.shops),
  };
  const errors: string[] = [];
  const { region, dialogs, quests, items } = data;
  const npcs = new Set(region.npcs.map((n) => n.id));
  const item = (id: string, where: string) => {
    if (!items[id]) errors.push(`${where}: buyum topilmadi "${id}"`);
  };
  for (const n of region.npcs) if (!dialogs[n.dialog]) errors.push(`NPC ${n.id}: dialog yo'q`);
  for (const [id, d] of Object.entries(dialogs)) {
    if (!d.nodes[d.start]) errors.push(`dialog ${id}: start tuguni yo'q`);
    for (const [nid, node] of Object.entries(d.nodes))
      for (const c of node.choices) {
        if (c.next && !d.nodes[c.next]) errors.push(`dialog ${id}.${nid}: "${c.next}" yo'q`);
        for (const cond of c.if ? [c.if].flat() : [])
          if (!quests[cond.quest]) errors.push(`dialog ${id}.${nid}: topshiriq yo'q`);
        for (const a of c.do) {
          const q = "startQuest" in a ? a.startQuest : "completeQuest" in a ? a.completeQuest : "";
          if (q && !quests[q]) errors.push(`dialog ${id}.${nid}: topshiriq "${q}" yo'q`);
        }
      }
  }
  for (const [id, q] of Object.entries(quests)) {
    if (!npcs.has(q.giver)) errors.push(`topshiriq ${id}: NPC "${q.giver}" yo'q`);
    q.reward.items.forEach((l) => item(l.item, `topshiriq ${id}`));
    for (const s of q.steps) {
      if (s.type === "find" && !region.landmarks.some((l) => l.id === s.landmark))
        errors.push(`topshiriq ${id}: joy "${s.landmark}" yo'q`);
      if ((s.type === "talk" || s.type === "deliver") && !npcs.has(s.npc))
        errors.push(`topshiriq ${id}: NPC "${s.npc}" yo'q`);
      if (s.type === "deliver") item(s.item, `topshiriq ${id}`);
    }
  }
  for (const o of region.objects)
    if (o.type === "chest") o.loot.forEach((l) => item(l.item, `sandiq ${o.id}`));
  for (const [kind, d] of Object.entries(data.drops))
    d.items.forEach((l) => item(l.item, `lut ${kind}`));
  for (const [npc, list] of Object.entries(data.shops)) {
    if (!npcs.has(npc)) errors.push(`do'kon: NPC "${npc}" yo'q`);
    list.forEach((id) => {
      item(id, `do'kon ${npc}`);
      if (items[id] && items[id].price === undefined) errors.push(`do'kon: "${id}" narxsiz`);
    });
  }
  if (errors.length) throw new Error(`Olam ma'lumotlarida xato:\n${errors.join("\n")}`);
  return data;
}
