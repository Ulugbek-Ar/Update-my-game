/** O'yinchi sozlamalari — bosh menyudagi "SOZLAMALAR" oynasi, localStorage'da saqlanadi. */
export const SETTINGS_KEY = "pixel-rpg-settings";

export interface Settings {
  /** Fon musiqasi ovozi, 0–100 */
  music: number;
  /** Ovoz effektlari ovozi, 0–100 */
  sfx: number;
  /** Ekran silkinishi yoqilganmi */
  shake: boolean;
}

export const DEFAULT_SETTINGS: Settings = { music: 60, sfx: 80, shake: true };

function volume(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(Math.max(0, Math.min(100, n))) : fallback;
}

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<Settings>;
    if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
    return {
      music: volume(raw.music, DEFAULT_SETTINGS.music),
      sfx: volume(raw.sfx, DEFAULT_SETTINGS.sfx),
      shake: typeof raw.shake === "boolean" ? raw.shake : DEFAULT_SETTINGS.shake,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* saqlash imkonsiz */
  }
}
