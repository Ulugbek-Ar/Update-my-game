/** Sensor boshqaruvi uchun umumiy yordamchilar (komponent emas). */
import type { CSSProperties } from "react";
import { HERO_THEME, withAlpha, type Hero } from "@/game/hero";
import { loadSettings, saveSettings, type TouchSettings } from "@/game/settings";
import type { Placed } from "@/game/touchLayout";

export function heroVars(hero: Hero) {
  // tugmalar tanlangan qahramon rangida (hero.ts: HERO_THEME)
  const theme = HERO_THEME[hero];
  return {
    "--hero-border": withAlpha(theme.accent, 0.7),
    "--hero-text": theme.uiText,
    "--hero-press": withAlpha(theme.accent, 0.4),
    "--hero-glow": theme.glow,
  } as CSSProperties;
}

export const BTN_CLASS =
  "touch-btn absolute flex flex-col items-center justify-center overflow-hidden rounded-full border-2 border-[color:var(--hero-border)] bg-card/60 text-[color:var(--hero-text)] leading-none select-none active:bg-[color:var(--hero-press)]";

export function placedStyle(p: Placed): CSSProperties {
  return { left: p.x - p.size / 2, top: p.y - p.size / 2, width: p.size, height: p.size };
}

export function setTouchSettings(patch: Partial<TouchSettings>) {
  const s = loadSettings();
  saveSettings({ ...s, touch: { ...s.touch, ...patch } });
}
