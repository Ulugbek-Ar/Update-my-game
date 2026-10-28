import { describe, expect, it } from "vitest";
import { UPGRADES, cardFor, upgradeIcon } from "./waves";
import { Player } from "./player";
import { UPGRADE_ICONS } from "./sprites";

/** Ko'k yoki binafsha: rang tusi 180°–300° oralig'ida va kulrang emas. */
function bluish(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  if (max - min < 0.12) return false;
  const d = max - min;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return h >= 180 && h <= 300;
}

const mage = new Player("mage");
const mageCards = UPGRADES.filter((u) => !u.hero || u.hero === "mage").map((u) => cardFor(u, mage));

describe("Sehrgar kartalari qizil-qora uslubda", () => {
  it("the helper recognises blue and purple", () => {
    expect(["#5fb8ff", "#b18cff", "#8f6bff", "#9be7ff"].every(bluish)).toBe(true);
    expect(["#c1121f", "#ff4d4d", "#ff9a3c", "#d9d4e0", "#1f1520"].some(bluish)).toBe(false);
  });

  it("no mage card uses a blue or purple card or text color", () => {
    expect(mageCards.length).toBe(11);
    for (const u of mageCards) {
      expect(bluish(u.color), `${u.name} ${u.color}`).toBe(false);
      if (u.text) expect(bluish(u.text), `${u.name} ${u.text}`).toBe(false);
    }
  });

  it("mage icons only use the red-black palette letters", () => {
    for (const u of mageCards)
      for (const row of UPGRADE_ICONS[upgradeIcon(u)]!) expect(row).toMatch(/^[.XoRLFSK]+$/);
  });

  it("knight cards are unchanged", () => {
    const knight = new Player("knight");
    const blade = cardFor(
      UPGRADES.find((u) => u.id === "blade")!,
      knight,
    );
    expect([blade.name, blade.color]).toEqual(["O'TKIR QILICH", "#68cde4"]);
  });
});
