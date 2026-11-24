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
