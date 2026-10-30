import { describe, expect, it } from "vitest";
import { fetchNewerVersion, isNewer } from "./update";

const ok = (body: unknown) =>
  (async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch;

describe("yangi versiya tekshiruvi", () => {
  it("versiyalarni to'g'ri solishtiradi", () => {
    expect(isNewer("2.8.1", "2.8.0")).toBe(true);
    expect(isNewer("2.10.0", "2.9.9")).toBe(true);
    expect(isNewer("3.0.0", "2.99.99")).toBe(true);
    expect(isNewer("2.8.0", "2.8.0")).toBe(false);
    expect(isNewer("2.7.9", "2.8.0")).toBe(false);
    expect(isNewer("v2.9.0", "2.8.0")).toBe(true);
  });

  it("faqat yangiroq versiyani qaytaradi", async () => {
    expect(await fetchNewerVersion("2.8.0", ok({ version: "2.9.0" }))).toBe("2.9.0");
    expect(await fetchNewerVersion("2.8.0", ok({ version: "2.8.0" }))).toBeNull();
    expect(await fetchNewerVersion("2.8.0", ok({ version: "2.7.0" }))).toBeNull();
    expect(await fetchNewerVersion("2.8.0", ok({ version: "abc" }))).toBeNull();
  });

  it("internet bo'lmasa jim (null)", async () => {
    const fail = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await fetchNewerVersion("2.8.0", fail)).toBeNull();
    const notFound = (async () => ({ ok: false })) as unknown as typeof fetch;
    expect(await fetchNewerVersion("2.8.0", notFound)).toBeNull();
  });
});
