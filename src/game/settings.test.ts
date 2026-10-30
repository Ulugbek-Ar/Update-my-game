import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  DEFAULT_TOUCH,
  SETTINGS_KEY,
  loadSettings,
  onSettingsChange,
  saveSettings,
} from "./settings";
import { DEFAULT_KEYS } from "./keys";

beforeEach(() => localStorage.clear());

describe("Sozlamalar", () => {
  it("returns defaults when nothing is saved", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("saves and loads music, effects volume and shake", () => {
    saveSettings({ ...DEFAULT_SETTINGS, music: 25, sfx: 0, shake: false });
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, music: 25, sfx: 0, shake: false });
  });

  it("clamps bad values and survives broken JSON", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ music: 250, sfx: -4, shake: "ha" }));
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, music: 100, sfx: 0, shake: true });
    localStorage.setItem(SETTINGS_KEY, "{buzuq");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe("Boshqaruv sozlamalari (v2.5)", () => {
  it("migrates a v2.4 save: old fields kept, controls get defaults", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ music: 35, sfx: 70, shake: false }));
    const s = loadSettings();
    expect(s).toMatchObject({ music: 35, sfx: 70, shake: false });
    expect(s.touch).toEqual(DEFAULT_TOUCH);
    expect(s.keys).toEqual(DEFAULT_KEYS);
    // telefonda default: kattaroq joystik va suzuvchi rejim
    expect(s.touch.stickSize).toBe(150);
    expect(s.touch.stickMode).toBe("floating");
  });

  it("clamps sliders, ignores unknown values and keeps valid layout points", () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        music: 10,
        touch: {
          stickSize: 999,
          buttonSize: 10,
          opacity: 5,
          stickMode: "zigzag",
          deadzone: "x",
          leftHanded: true,
          vibrate: "ha",
          layout: { attack: { x: 1.4, y: 0.25 }, stick: { x: "a" }, foo: { x: 0, y: 0 } },
        },
        keys: { attack: ["KeyL", 5, "KeyL", "ShiftRight"], dash: [], up: "KeyW" },
      }),
    );
    const s = loadSettings();
    expect(s.touch).toEqual({
      ...DEFAULT_TOUCH,
      stickSize: 200,
      buttonSize: 80,
      opacity: 30,
      leftHanded: true,
      layout: { attack: { x: 1, y: 0.25 } },
    });
    expect(s.keys.attack).toEqual(["KeyL", "Shift"]);
    // bo'sh yoki noto'g'ri ro'yxat — asl tugmalar
    expect(s.keys.dash).toEqual(DEFAULT_KEYS.dash);
    expect(s.keys.up).toEqual(DEFAULT_KEYS.up);
  });

  it("notifies listeners on save (applied immediately in game and realm)", () => {
    const seen: number[] = [];
    const off = onSettingsChange((s) => seen.push(s.touch.opacity));
    saveSettings({ ...DEFAULT_SETTINGS, touch: { ...DEFAULT_TOUCH, opacity: 55 } });
    off();
    saveSettings(DEFAULT_SETTINGS);
    expect(seen).toEqual([55]);
    expect(loadSettings().touch.opacity).toBe(100);
  });
});
