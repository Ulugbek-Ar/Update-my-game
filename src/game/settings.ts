/**
 * O'yinchi sozlamalari — bosh menyudagi va pauzadagi "SOZLAMALAR" oynasi, localStorage'da saqlanadi.
 * Eski saqlanish (faqat ovoz va silkinish) buzilmaydi: yangi maydonlar asl qiymat bilan to'ldiriladi.
 */
import { sanitizeKeys, copyKeys, DEFAULT_KEYS, type KeyBinds } from "./keys";

export const SETTINGS_KEY = "pixel-rpg-settings";

/** Sensor boshqaruvi elementlari (joystik va tugmalar) */
export type ControlId =
  "stick" | "attack" | "dash" | "reload" | "pause" | "interact" | "journal" | "map";
export const CONTROL_IDS: readonly ControlId[] = [
  "stick",
  "attack",
  "dash",
  "reload",
  "pause",
  "interact",
  "journal",
  "map",
];

/** Element markazi — xavfsiz hudud (safe-area) eni va bo'yiga nisbatan, 0–1 */
export interface ControlPos {
  x: number;
  y: number;
}

export type StickMode = "fixed" | "floating";

export interface TouchSettings {
  /** Joystik o'lchami, % (80–200) */
  stickSize: number;
  /** Tugmalar o'lchami, % (80–200) */
  buttonSize: number;
  /** Shaffoflik, % (30–100) */
  opacity: number;
  /** Qo'zg'almas yoki suzuvchi (barmoq tekkan joyda paydo bo'ladi) */
  stickMode: StickMode;
  /** O'lik zona, % (5–50): joystik shundan kam surilsa — yurmaydi */
  deadzone: number;
  /** Chapaqay: joystik o'ngda, tugmalar chapda */
  leftHanded: boolean;
  /** Zarba yeganda qisqa tebranish */
  vibrate: boolean;
  /** Foydalanuvchi joylashtirgan elementlar (yo'qlari — asl joyida) */
  layout: Partial<Record<ControlId, ControlPos>>;
}

export interface Settings {
  /** Fon musiqasi ovozi, 0–100 */
  music: number;
  /** Ovoz effektlari ovozi, 0–100 */
  sfx: number;
  /** Ekran silkinishi yoqilganmi */
  shake: boolean;
  /** Telefon (sensor) boshqaruvi */
  touch: TouchSettings;
  /** Kompyuter klaviaturasi */
  keys: KeyBinds;
}

export const SIZE_RANGE = [80, 200] as const;
export const OPACITY_RANGE = [30, 100] as const;
export const DEADZONE_RANGE = [5, 50] as const;

export const DEFAULT_TOUCH: TouchSettings = {
  // eski 100% telefonda kichik ko'rinardi
  stickSize: 150,
  buttonSize: 100,
  opacity: 100,
  stickMode: "floating",
  // v2.4 gacha joystik o'q bo'yicha 25% dan kam surilsa yurmasdi
  deadzone: 25,
  leftHanded: false,
  vibrate: true,
  layout: {},
};

export const DEFAULT_SETTINGS: Settings = {
  music: 60,
  sfx: 80,
  shake: true,
  touch: DEFAULT_TOUCH,
  keys: DEFAULT_KEYS,
};

function clampNum(v: unknown, [min, max]: readonly [number, number], fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(Math.max(min, Math.min(max, n))) : fallback;
}

function volume(v: unknown, fallback: number) {
  return clampNum(v, [0, 100], fallback);
}

const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

function sanitizeLayout(raw: unknown): TouchSettings["layout"] {
  const out: TouchSettings["layout"] = {};
  if (!raw || typeof raw !== "object") return out;
  for (const id of CONTROL_IDS) {
    const p = (raw as Record<string, unknown>)[id] as Partial<ControlPos> | undefined;
    const x = Number(p?.x),
      y = Number(p?.y);
    if (Number.isFinite(x) && Number.isFinite(y))
      out[id] = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }
  return out;
}

function sanitizeTouch(raw: unknown): TouchSettings {
  const d = DEFAULT_TOUCH;
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<
    Record<keyof TouchSettings, unknown>
  >;
  return {
    stickSize: clampNum(r.stickSize, SIZE_RANGE, d.stickSize),
    buttonSize: clampNum(r.buttonSize, SIZE_RANGE, d.buttonSize),
    opacity: clampNum(r.opacity, OPACITY_RANGE, d.opacity),
    stickMode: r.stickMode === "fixed" || r.stickMode === "floating" ? r.stickMode : d.stickMode,
    deadzone: clampNum(r.deadzone, DEADZONE_RANGE, d.deadzone),
    leftHanded: bool(r.leftHanded, d.leftHanded),
    vibrate: bool(r.vibrate, d.vibrate),
    layout: sanitizeLayout(r.layout),
  };
}

function defaults(): Settings {
  return {
    ...DEFAULT_SETTINGS,
    touch: { ...DEFAULT_TOUCH, layout: {} },
    keys: copyKeys(DEFAULT_KEYS),
  };
}

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<
      Record<keyof Settings, unknown>
    >;
    if (!raw || typeof raw !== "object") return defaults();
    return {
      music: volume(raw.music, DEFAULT_SETTINGS.music),
      sfx: volume(raw.sfx, DEFAULT_SETTINGS.sfx),
      shake: bool(raw.shake, DEFAULT_SETTINGS.shake),
      touch: sanitizeTouch(raw.touch),
      keys: sanitizeKeys(raw.keys),
    };
  } catch {
    return defaults();
  }
}

type Listener = (s: Settings) => void;
const listeners = new Set<Listener>();
let cached: Settings | null = null;

/** Joriy sozlamalar (har kadr chizishda o'qish uchun — localStorage'ni qayta o'qimaydi). */
export function currentSettings() {
  return (cached ??= loadSettings());
}

/** Sozlama o'zgarganda chaqiriladi (o'yin va olam darhol qo'llaydi); qaytgani — obunani bekor qilish. */
export function onSettingsChange(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* saqlash imkonsiz */
  }
  cached = s;
  for (const fn of listeners) fn(s);
}
