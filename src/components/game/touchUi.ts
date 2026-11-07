/** Sensor boshqaruvi uchun umumiy yordamchilar (komponent emas). */
import type { CSSProperties } from "react";
import { withAlpha, type Hero, type HeroTheme } from "@/game/hero";
import { skinLook } from "@/game/skins";
import { loadSettings, saveSettings, type TouchSettings } from "@/game/settings";
import type { Placed } from "@/game/touchLayout";

/** Tugmalar ranglari: tanlangan qahramonning faol skini (skinFx.ts; default — HERO_THEME) */
export function buttonTheme(hero: Hero): HeroTheme {
  return skinLook(hero).theme;
}

export function heroVars(hero: Hero, theme: HeroTheme = buttonTheme(hero)) {
  // tugmalar tanlangan qahramon (skin) rangida
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
