import { useEffect, useState } from "react";
import type { Insets, Viewport } from "@/game/touchLayout";

let probe: HTMLDivElement | null = null;

/** Telefon kesigi (safe-area) chekinishlari, px — CSS env() qiymatlaridan o'qiladi. */
function readInsets(): Insets {
  if (typeof document === "undefined") return { l: 0, r: 0, t: 0, b: 0 };
  if (!probe) {
    probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
      "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  const n = (v: string) => parseFloat(v) || 0;
  return {
    l: n(cs.paddingLeft),
    r: n(cs.paddingRight),
    t: n(cs.paddingTop),
    b: n(cs.paddingBottom),
  };
}

export function measureViewport(): Viewport {
  if (typeof window === "undefined") return { w: 960, h: 540, safe: { l: 0, r: 0, t: 0, b: 0 } };
  return { w: window.innerWidth, h: window.innerHeight, safe: readInsets() };
}

/** Ekran o'lchami va kesik chekinishlari (aylantirilganda yangilanadi). */
export function useViewport() {
  const [vp, setVp] = useState<Viewport>(measureViewport);
  useEffect(() => {
    const on = () => setVp(measureViewport());
    on();
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    window.visualViewport?.addEventListener("resize", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
      window.visualViewport?.removeEventListener("resize", on);
    };
  }, []);
  return vp;
}
