import { describe, expect, it } from "vitest";
import { deflateRawSync, constants } from "node:zlib";
import { inflateRaw } from "./inflate";

/** Baytlar bir xilmi (jsdom'ning TextEncoder massivi boshqa "realm"dan — toEqual turini ham solishtiradi). */
const same = (a: Uint8Array, b: Uint8Array) => Buffer.from(a).equals(Buffer.from(b));

const text = (n: number) =>
  Array.from({ length: n }, (_, i) => `qahramon-${i % 7}:${(i * 37) % 101};`).join("");

describe("inflateRaw (DecompressionStream zaxirasi)", () => {
  it("decodes zlib raw-deflate output at every level (stored, fixed and dynamic blocks)", () => {
    const src = new TextEncoder().encode(text(3000));
    for (const level of [0, 1, 6, 9]) {
      const packed = new Uint8Array(deflateRawSync(src, { level }));
      expect(same(inflateRaw(packed), src), `level ${level}`).toBe(true);
    }
    const fixed = new Uint8Array(deflateRawSync(src, { strategy: constants.Z_FIXED }));
    expect(same(inflateRaw(fixed), src)).toBe(true);
  });

  it("handles binary data, long repeats and empty input", () => {
    const bin = new Uint8Array(70000);
    for (let i = 0; i < bin.length; i++) bin[i] = i % 3000 < 1500 ? 255 : (i * 131) & 0xff;
    expect(same(inflateRaw(new Uint8Array(deflateRawSync(bin))), bin)).toBe(true);
    expect(inflateRaw(new Uint8Array(deflateRawSync(new Uint8Array(0)))).length).toBe(0);
  });

  it("throws on truncated or garbage input", () => {
    const packed = new Uint8Array(deflateRawSync(new TextEncoder().encode(text(500))));
    expect(() => inflateRaw(packed.subarray(0, packed.length >> 1))).toThrow();
    expect(() => inflateRaw(new Uint8Array([0xff, 0xff, 0xff, 0xff]))).toThrow();
  });
});
