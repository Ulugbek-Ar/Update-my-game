/** Akkaunt oynalari uchun umumiy uslub va matn yordamchilari (komponent emas) */
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pixelFocus, pixelPress } from "@/lib/pixel-ui";
import type { CloudStatus } from "@/account/cloud";

export const btn = (variant: "pixel" | "pixelOutline" = "pixel", extra = "") =>
  cn(buttonVariants({ variant, size: "none" }), "px-3 py-2 disabled:opacity-50", extra);

export const closeBtn = `border-2 border-border px-2 py-1 text-muted-foreground hover:border-foreground hover:text-foreground ${pixelPress} ${pixelFocus}`;

export const tabBtn = (on: boolean) =>
  `border-2 px-3 py-1 ${pixelPress} ${pixelFocus} ${
    on
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
  }`;

/** "2 daqiqa oldin", "kecha" — vaqt farqi o'zbekcha */
export function ago(ms: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "hozirgina";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} daqiqa oldin`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} soat oldin`;
  const d = Math.round(h / 24);
  return d === 1 ? "kecha" : `${d} kun oldin`;
}

/** Sana va vaqt: 01.11.2026 14:05 */
export function when(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const CLOUD_TEXT: Record<CloudStatus, string> = {
  off: "",
  syncing: "Bulut: sinxronlanmoqda...",
  saved: "Bulut: saqlangan",
  pending: "Bulut: o'zgarish tez orada saqlanadi",
  choose: "Bulut: progress tanlovi kutilmoqda",
  offline: "Bulut: internet yo'q — keyin saqlanadi",
  error: "Bulut: saqlanmadi",
};

export const cloudText = (s: CloudStatus) => CLOUD_TEXT[s];
