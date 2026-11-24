import { describe, expect, it } from "vitest";
import { portraitColors } from "./portrait";
import { heroSkins } from "./skins";
import { PALETTES } from "./sprites";
import { MAGE_PORTRAIT_COLORS } from "./magePortrait";
import { HUNTER_PORTRAIT_COLORS } from "./hunterPortrait";
import { GUNNER_PORTRAIT_COLORS } from "./gunnerPortrait";
import { SHINOBI_PORTRAIT_COLORS } from "./shinobiPortrait";
import { PRIESTESS_PORTRAIT_COLORS } from "./priestessPortrait";
import { WOLF_PORTRAIT_COLORS } from "./wolfPortrait";

/** Har qahramon: asl ranglar va o'zgarmasligi shart bo'lgan indekslar (1 dan: siyoh, teri, fon...) */
const CASES = [
  ["mage", MAGE_PORTRAIT_COLORS, [1, 16, 17, 18, 19, 20, 21, 22, 23]],
  ["hunter", HUNTER_PORTRAIT_COLORS, [1, 11, 12, 13, 14, 19]],
  ["gunner", GUNNER_PORTRAIT_COLORS, [1, 11, 12, 13, 14, 34]],
  ["shinobi", SHINOBI_PORTRAIT_COLORS, [1, 6, 7, 8, 9, 14]],
  ["priestess", PRIESTESS_PORTRAIT_COLORS, [1, 14, 15, 16, 17, 18, 19, 20]],
  ["wolf", WOLF_PORTRAIT_COLORS, [1, 2, 3, 4, 5, 17, 18, 19]],
] as const;

describe("super portretlari skin rangida", () => {
  for (const [hero, base, fixed] of CASES) {
    it(`${hero}: skinsiz — asl ranglar aynan`, () => {
      expect(portraitColors(hero)).toEqual([...base]);
      expect(portraitColors(hero, { id: "default", colors: PALETTES[hero] })).toEqual([...base]);
    });

    it(`${hero}: har skin kiyimni bo'yaydi, teri/siyoh/fon o'zgarmaydi`, () => {
      const skins = heroSkins(hero).filter((s) => s.id !== "default");
      expect(skins.length).toBeGreaterThanOrEqual(3);
      const seen = new Set<string>();
      for (const s of skins) {
        const c = portraitColors(hero, { id: s.id, colors: s.colors });
        expect(c).toHaveLength(base.length);
        for (const x of c) expect(x).toMatch(/^#[0-9a-f]{6}$/);
        for (const i of fixed) expect(c[i - 1]).toBe(base[i - 1]);
        const changed = c.filter((x, i) => x !== base[i]).length;
        expect(changed).toBeGreaterThanOrEqual(5);
        seen.add(c.join());
      }
      expect(seen.size).toBe(skins.length);
    });
  }
});
