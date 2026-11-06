/** Telefonda qisqa tebranish (sozlamada o'chirilgan yoki qurilma qo'llamasa — jim o'tadi). */
import { loadSettings, onSettingsChange } from "./settings";

let enabled: boolean | null = null;
onSettingsChange((s) => {
  enabled = s.touch.vibrate;
});

/** Oddiy zarba */
export const HIT_BUZZ = 35;
/** Boss zarbasi — kuchliroq */
export const BOSS_BUZZ = [70, 40, 70];

export function vibrate(pattern: number | number[]) {
  enabled ??= loadSettings().touch.vibrate;
  if (!enabled) return false;
  try {
    return typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
      ? navigator.vibrate(pattern)
      : false;
  } catch {
    return false;
  }
}
