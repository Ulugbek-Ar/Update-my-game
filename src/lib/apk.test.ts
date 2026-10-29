import { describe, expect, it } from "vitest";
import { apkCaption, apkFileName, isApkRelease } from "./apk";

describe("Telegram kanalga APK", () => {
  it("faqat x.y.0 versiyalarda yuboriladi", () => {
    expect(isApkRelease("2.3.0")).toBe(true);
    expect(isApkRelease("2.4.0")).toBe(true);
    expect(isApkRelease("10.0.0")).toBe(true);
    expect(isApkRelease("2.3.1")).toBe(false);
    expect(isApkRelease("2.2.10")).toBe(false);
    expect(isApkRelease("2.3")).toBe(false);
    expect(isApkRelease("2.3.0-beta")).toBe(false);
  });

  it("fayl nomi versiya bilan", () => {
    expect(apkFileName("2.3.0")).toBe("PikselQala-v2.3.0.apk");
  });

  it("izohda o'rnatish yo'riqnomasi bor va Telegram chegarasiga sig'adi", () => {
    const c = apkCaption("2.3.0");
    expect(c).toContain("v2.3.0");
    expect(c).toContain("Noma'lum manbalardan o'rnatish");
    expect(c).toContain("Yangi versiyani eskisi ustidan o'rnating — saqlanishlar o'chmaydi.");
    expect(c.length).toBeLessThanOrEqual(1024);
  });
});
