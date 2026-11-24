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
import { translateRealmData, type Lang } from "../i18n";

const cached = new Map<Lang, RealmData>();
const halls = new Map<Lang, RealmData>();

/**
 * Olam ma'lumotlari. lang — klientda ko'rinadigan matnlar tili (nomlar, dialoglar, topshiriqlar);
 * id, xarita va raqamlar har tilda bir xil, server o'zbekcha (asl) nusxa bilan ishlaydi.
 */
export function loadRealmData(lang: Lang = "uz"): RealmData {
  let d = cached.get(lang);
  if (!d) {
    d = parseRealmData(
      translateRealmData(
        { region: valley, regions: [ashmount], dialogs, quests, items, drops, shops },
        lang,
      ),
    );
    cached.set(lang, d);
  }
  return d;
}

/**
 * Gildiya zali (v3.3): alohida kichik "olam" — har gildiyaning o'z xonasi (server/src/hall-do.ts).
 * Buyumlar asosiy olamniki (inventardagi kuchlar zalda ham ishlaydi), NPC va topshiriq yo'q.
 */
export function loadHallData(lang: Lang = "uz"): RealmData {
  let d = halls.get(lang);
  if (!d) {
    d = parseRealmData(
      translateRealmData(
        { region: guildhall, dialogs: {}, quests: {}, items, drops, shops: {} },
        lang,
      ),
    );
    halls.set(lang, d);
  }
  return d;
}
