import { describe, expect, it } from "vitest";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

describe("Menyu tugmalari uslubi", () => {
  // Button kabi: cn (tailwind-merge) bilan — brauzerga aynan shu klasslar boradi
  const cls = (variant: "pixel" | "pixelOutline" | "pixelLink") =>
    cn(buttonVariants({ variant })).split(" ");

  it("outline tugma hover'da teskari kontrast: sariq fon, to'q yozuv", () => {
    const c = cls("pixelOutline");
    expect(c).toContain("bg-card");
    expect(c).toContain("text-primary");
    expect(c).toContain("hover:bg-primary");
    expect(c).toContain("hover:text-primary-foreground");
    // standart variantning sariq hover foni sariq yozuv ustiga tushmasin
    expect(c).not.toContain("hover:bg-primary/90");
  });

  it("hech bir menyu tugmasi rangni brightness filtri bilan o'zgartirmaydi", () => {
    for (const v of ["pixel", "pixelOutline", "pixelLink"] as const)
      expect(cls(v).some((k) => k.includes("brightness"))).toBe(false);
  });

  it("hammasida 2px bosilish va aniq klaviatura fokusi bor", () => {
    for (const v of ["pixel", "pixelOutline", "pixelLink"] as const) {
      const c = cls(v);
      expect(c).toContain("active:translate-y-[2px]");
      expect(c).toContain("focus-visible:ring-2");
      expect(c).not.toContain("focus-visible:ring-1");
    }
  });
});
