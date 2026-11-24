import { afterEach, describe, expect, it } from "vitest";
import { DICTS, LANG_KEY, getLang, initLang, langFromCode, setLang, t } from "./index";
import { uz } from "./uz";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("i18n", () => {
  afterEach(() => {
    localStorage.clear();
    setLang("uz");
  });

  for (const lang of ["ru", "en"] as const) {
    it(`${lang}: hamma kalitlar bor va bo'sh emas`, () => {
      const dict = DICTS[lang] as Record<string, string>;
      const missing = Object.keys(uz).filter((k) => !dict[k]?.trim());
      expect(missing).toEqual([]);
      const extra = Object.keys(dict).filter((k) => !(k in uz));
      expect(extra).toEqual([]);
    });
    it(`${lang}: {o'rinlar} o'zbekcha bilan bir xil`, () => {
      const dict = DICTS[lang] as Record<string, string>;
      const bad = Object.entries(uz as Record<string, string>)
        .filter(([k, v]) => placeholders(v).join() !== placeholders(dict[k] ?? "").join())
        .map(([k]) => k);
      expect(bad).toEqual([]);
    });
  }

  it("til kodi: ru → rus, uz → o'zbek, boshqasi → ingliz", () => {
    expect(langFromCode("ru-RU")).toBe("ru");
    expect(langFromCode("uz")).toBe("uz");
    expect(langFromCode("uz-Latn-UZ")).toBe("uz");
    expect(langFromCode("en-US")).toBe("en");
    expect(langFromCode("de")).toBe("en");
    expect(langFromCode("")).toBe("en");
  });

  it("tanlangan til saqlanadi va t() darhol shu tilda", () => {
    setLang("ru");
    expect(localStorage.getItem(LANG_KEY)).toBe("ru");
    expect(t("common.close")).toBe("ЗАКРЫТЬ");
    setLang("en");
    initLang();
    expect(getLang()).toBe("en");
    expect(t("common.close")).toBe("CLOSE");
  });
});

import valley from "@/realm/data/regions/valley.json";
import ashmount from "@/realm/data/regions/ashmount.json";
import guildhall from "@/realm/data/regions/guildhall.json";
import dialogs from "@/realm/data/dialogs.json";
import quests from "@/realm/data/quests.json";
import items from "@/realm/data/items.json";
import { REALM_TEXT_FIELDS, REALM_TR } from "./realm";
import { translateRealmData } from "./index";
import { loadRealmData } from "@/realm/data";

describe("olam ma'lumotlari tarjimasi", () => {
  const texts = new Set<string>();
  const walk = (v: unknown, field: string) => {
    if (typeof v === "string") {
      if (REALM_TEXT_FIELDS.has(field) && v.trim()) texts.add(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, field));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  for (const d of [valley, ashmount, guildhall, dialogs, quests, items]) walk(d, "");

  it("har bir ko'rinadigan matn rus va ingliz tilida bor", () => {
    const missing = [...texts].filter(
      (s) => !REALM_TR[s]?.[0]?.trim() || !REALM_TR[s]?.[1]?.trim(),
    );
    expect(missing).toEqual([]);
  });

  it("tarjima id, xarita va raqamlarga tegmaydi", () => {
    const uz = loadRealmData();
    const ru = loadRealmData("ru");
    expect(Object.keys(ru.quests)).toEqual(Object.keys(uz.quests));
    expect(JSON.stringify(translateRealmData(valley, "ru")).length).toBeGreaterThan(0);
    expect(translateRealmData(valley, "ru").terrain).toEqual(valley.terrain);
    const q = Object.keys(uz.quests)[0]!;
    expect(ru.quests[q]!.name).not.toBe(uz.quests[q]!.name);
  });
});
