/** Olam ma'lumotlarini JSON fayllardan yuklab, zod bilan tekshiradi (bir marta). */
import valley from "./data/regions/valley.json";
import ashmount from "./data/regions/ashmount.json";
import dialogs from "./data/dialogs.json";
import quests from "./data/quests.json";
import items from "./data/items.json";
import drops from "./data/drops.json";
import shops from "./data/shops.json";
import guildhall from "./data/regions/guildhall.json";
import { parseRealmData, type RealmData } from "./schema";

let cached: RealmData | null = null;
let hall: RealmData | null = null;

export function loadRealmData(): RealmData {
  cached ??= parseRealmData({
    region: valley,
    regions: [ashmount],
    dialogs,
    quests,
    items,
    drops,
    shops,
  });
  return cached;
}

/**
 * Gildiya zali (v3.3): alohida kichik "olam" — har gildiyaning o'z xonasi (server/src/hall-do.ts).
 * Buyumlar asosiy olamniki (inventardagi kuchlar zalda ham ishlaydi), NPC va topshiriq yo'q.
 */
export function loadHallData(): RealmData {
  hall ??= parseRealmData({
    region: guildhall,
    dialogs: {},
    quests: {},
    items,
    drops,
    shops: {},
  });
  return hall;
}
