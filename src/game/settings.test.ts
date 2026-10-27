import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, saveSettings } from "./settings";

beforeEach(() => localStorage.clear());

describe("Sozlamalar", () => {
  it("returns defaults when nothing is saved", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("saves and loads music, effects volume and shake", () => {
    saveSettings({ music: 25, sfx: 0, shake: false });
    expect(loadSettings()).toEqual({ music: 25, sfx: 0, shake: false });
  });

  it("clamps bad values and survives broken JSON", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ music: 250, sfx: -4, shake: "ha" }));
    expect(loadSettings()).toEqual({ music: 100, sfx: 0, shake: true });
    localStorage.setItem(SETTINGS_KEY, "{buzuq");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
