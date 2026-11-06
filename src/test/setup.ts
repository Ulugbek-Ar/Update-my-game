import "@testing-library/jest-dom/vitest";
import { setCritSource } from "@/game/crit";

// kritik zarba sinovlarda o'chiq (aniq zarar tekshiriladi); crit.test.ts o'zi yoqadi
setCritSource(() => 1);

// server testlari (// @vitest-environment node) — DOM'siz, Cloudflare Worker kabi
if (typeof window !== "undefined") {
  Object.defineProperty(window, "scrollTo", {
    writable: true,
    value: () => {},
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
