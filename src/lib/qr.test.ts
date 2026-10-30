import { describe, expect, it } from "vitest";
import { makeQr } from "./qr";

/** 7x7 qidiruv naqshi (finder) (x, y) dan boshlab */
function finderOk(m: boolean[][], x: number, y: number) {
  for (let dy = 0; dy < 7; dy++)
    for (let dx = 0; dx < 7; dx++) {
      const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      if (m[y + dy]![x + dx] !== (d !== 2)) return false;
    }
  return true;
}

describe("QR kod generatori", () => {
  it("Telegram kanal havolasi — 2-versiya (25x25)", () => {
    const q = makeQr("https://t.me/piksel_qala");
    expect(q.size).toBe(25);
    expect(q.modules).toHaveLength(25);
    expect(finderOk(q.modules, 0, 0)).toBe(true);
    expect(finderOk(q.modules, 18, 0)).toBe(true);
    expect(finderOk(q.modules, 0, 18)).toBe(true);
    // qora modul (8, size-8) har doim qora
    expect(q.modules[17]![8]).toBe(true);
  });

  it("matn uzunligiga qarab versiya tanlanadi va natija barqaror", () => {
    expect(makeQr("x").size).toBe(21);
    expect(makeQr("A".repeat(150)).size).toBe(49);
    expect(makeQr("salom")).toEqual(makeQr("salom"));
    expect(() => makeQr("A".repeat(400))).toThrow();
  });
});
