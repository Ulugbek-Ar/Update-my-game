/** Olam ma'lumotlarini JSON fayllardan yuklab, zod bilan tekshiradi (bir marta). */
import valley from "./data/regions/valley.json";
import ashmount from "./data/regions/ashmount.json";
import dialogs from "./data/dialogs.json";
import quests from "./data/quests.json";
import items from "./data/items.json";
import drops from "./data/drops.json";
import shops from "./data/shops.json";
import { parseRealmData, type RealmData } from "./schema";

let cached: RealmData | null = null;

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
