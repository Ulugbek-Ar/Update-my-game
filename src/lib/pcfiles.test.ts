import { describe, expect, it } from "vitest";
import {
  PORTABLE_ZIP,
  WINDOWS_ZIP,
  fitsTelegram,
  isPcRelease,
  pcCaption,
  releaseUrl,
  tooBigMessage,
} from "./pcfiles";

describe("PC fayllarini Telegram'ga yuborish", () => {
  it("faqat x.y.0 versiyalarda", () => {
    expect(isPcRelease("2.8.0")).toBe(true);
    expect(isPcRelease("3.0.0")).toBe(true);
    expect(isPcRelease("2.8.1")).toBe(false);
  });

  it("50 MB chegarasi", () => {
    expect(fitsTelegram(5 * 1024 * 1024)).toBe(true);
    expect(fitsTelegram(50 * 1024 * 1024)).toBe(true);
    expect(fitsTelegram(50 * 1024 * 1024 + 1)).toBe(false);
    expect(fitsTelegram(0)).toBe(false);
  });

  it("izohlar Telegram chegarasiga sig'adi va o'zbekcha", () => {
    for (const f of [WINDOWS_ZIP, PORTABLE_ZIP]) {
      const c = pcCaption(f, "2.8.0");
      expect(c.length).toBeLessThanOrEqual(1024);
      expect(c).toContain("v2.8.0");
    }
    expect(pcCaption(WINDOWS_ZIP, "2.8.0")).toContain("Baribir ishga tushirish");
  });

  it("katta fayl uchun Release havolasi", () => {
    const url = releaseUrl("Ulugbek-Ar/Update-my-game", "2.8.0");
    expect(url).toBe("https://github.com/Ulugbek-Ar/Update-my-game/releases/tag/v2.8.0");
    expect(tooBigMessage(WINDOWS_ZIP, "2.8.0", url)).toContain(url);
  });
});
