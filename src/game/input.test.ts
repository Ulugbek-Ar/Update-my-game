import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Input, lockGameKeys } from "./input";
import { DEFAULT_KEYS, bindKey } from "./keys";
import { DEFAULT_SETTINGS, saveSettings } from "./settings";
import { Game } from "./game";

function key(type: "keydown" | "keyup", code: string, k = "") {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: k, cancelable: true }));
}
function tap(code: string) {
  key("keydown", code);
  key("keyup", code);
}

let inp: Input;
beforeEach(() => {
  localStorage.clear();
  inp = new Input();
});
afterEach(() => inp.detach());

describe("Klaviatura: qayta belgilangan tugmalar", () => {
  it("default keys work as before (Space/J attack, Shift dash, Esc pause, WASD and arrows)", () => {
    inp.attach();
    tap("KeyJ");
    expect(inp.consumeAttack()).toBe(true);
    tap("ShiftRight");
    expect(inp.consumeDash()).toBe(true);
    tap("Escape");
    expect(inp.consumePause()).toBe(true);
    key("keydown", "KeyD");
    key("keydown", "ArrowUp");
    expect(inp.axis()).toEqual({ x: 1, y: -1 });
    key("keyup", "KeyD");
    key("keyup", "ArrowUp");
    expect(inp.axis()).toEqual({ x: 0, y: 0 });
  });

  it("uses rebound keys and applies a change while the game runs", () => {
    inp.attach();
    saveSettings({ ...DEFAULT_SETTINGS, keys: bindKey(DEFAULT_KEYS, "attack", 0, "KeyL") });
    tap("KeyL");
    expect(inp.consumeAttack()).toBe(true);
    // eski asosiy tugma (Space) endi hujum emas
    tap("Space");
    expect(inp.consumeAttack()).toBe(false);
    key("keydown", "KeyL");
    expect(inp.attackHeld()).toBe(true);
    key("keyup", "KeyL");
    const moved = {
      ...DEFAULT_KEYS,
      up: ["KeyI"],
      left: ["KeyJ"],
      down: ["KeyK"],
      right: ["KeyL"],
    };
    saveSettings({ ...DEFAULT_SETTINGS, keys: moved });
    key("keydown", "KeyJ");
    expect(inp.axis()).toEqual({ x: -1, y: 0 });
    key("keyup", "KeyJ");
  });

  it("in the realm J is the journal, not attack; M is the map, not mute", () => {
    inp.attach();
    inp.setContext("realm");
    tap("KeyJ");
    expect(inp.consumeAttack()).toBe(false);
    expect(inp.consumeAction("journal")).toBe(true);
    tap("KeyM");
    expect(inp.consumeAction("mute")).toBe(false);
    tap("KeyM");
    expect(inp.consumeAction("map")).toBe(true);
    tap("KeyE");
    expect(inp.consumeAction("interact")).toBe(true);
    // asosiy o'yinda J — hujum, M — ovoz
    inp.setContext("game");
    tap("KeyJ");
    expect(inp.consumeAttack()).toBe(true);
    tap("KeyM");
    expect(inp.consumeAction("mute")).toBe(true);
  });

  it("keys are ignored while the settings window is open (key capture)", () => {
    inp.attach();
    const release = lockGameKeys();
    tap("Space");
    tap("Escape");
    expect(inp.consumeAttack()).toBe(false);
    expect(inp.consumePause()).toBe(false);
    release();
    release();
    tap("Space");
    expect(inp.consumeAttack()).toBe(true);
  });

  it("a bound key does not scroll the page; Ctrl+R still reloads", () => {
    inp.attach();
    const e = new KeyboardEvent("keydown", { code: "KeyR", cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    const c = new KeyboardEvent("keydown", { code: "KeyR", ctrlKey: true, cancelable: true });
    window.dispatchEvent(c);
    expect(c.defaultPrevented).toBe(false);
  });
});

describe("Pauzada SOZLAMALAR", () => {
  it("the pause menu has a settings button that calls onSettings and keeps the game paused", () => {
    const canvas = { getContext: () => ({ imageSmoothingEnabled: false }) };
    const g = new Game(canvas as unknown as HTMLCanvasElement);
    let opened = 0;
    g.onSettings = () => opened++;
    g.setPaused(true);
    const buttons = (
      g as unknown as { pauseButtons(): { label: string; act(): void }[] }
    ).pauseButtons();
    expect(buttons.map((b) => b.label)).toEqual([
      "Davom etish: Esc",
      "Sozlamalar",
      "Qaytadan boshlash",
      "Bosh menyuga qaytish",
    ]);
    buttons[1]!.act();
    expect(opened).toBe(1);
    expect(g.paused).toBe(true);
  });
});
