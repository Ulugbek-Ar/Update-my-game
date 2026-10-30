import { describe, expect, it } from "vitest";
import {
  DEFAULT_KEYS,
  actionKey,
  bindKey,
  clearAltKey,
  effectiveKeys,
  keyConflicts,
  keyLabel,
  moveLabel,
  normKey,
} from "./keys";

describe("Tugmalarni qayta belgilash", () => {
  it("default keys have no conflicts (J: attack in game, journal in realm)", () => {
    expect(keyConflicts(DEFAULT_KEYS)).toEqual([]);
    expect(effectiveKeys(DEFAULT_KEYS, "game").attack).toEqual(["Space", "KeyJ"]);
    expect(effectiveKeys(DEFAULT_KEYS, "realm").attack).toEqual(["Space"]);
    expect(effectiveKeys(DEFAULT_KEYS, "realm").journal).toEqual(["KeyJ"]);
    // M: asosiy o'yinda ovoz, olamda xarita
    expect(effectiveKeys(DEFAULT_KEYS, "game").map).toEqual([]);
    expect(effectiveKeys(DEFAULT_KEYS, "realm").mute).toEqual([]);
  });

  it("binds the main and the extra key without duplicating inside one action", () => {
    let k = bindKey(DEFAULT_KEYS, "attack", 0, "KeyL");
    expect(k.attack).toEqual(["KeyL", "KeyJ"]);
    k = bindKey(k, "attack", 1, "KeyL");
    expect(k.attack).toEqual(["KeyL"]);
    k = bindKey(k, "attack", 1, "ShiftRight");
    expect(k.attack).toEqual(["KeyL", "Shift"]);
    expect(clearAltKey(k, "attack").attack).toEqual(["KeyL"]);
    // asl ro'yxat o'zgarmaydi
    expect(DEFAULT_KEYS.attack).toEqual(["Space", "KeyJ"]);
  });

  it("warns when one key is given to two actions", () => {
    const k = bindKey(DEFAULT_KEYS, "dash", 0, "KeyW");
    expect(keyConflicts(k)).toEqual([{ key: "KeyW", actions: ["up", "dash"] }]);
    // asosiy o'yinda M — ovoz: hujumga ham berilsa — ziddiyat
    expect(keyConflicts(bindKey(DEFAULT_KEYS, "attack", 1, "KeyM"))).toContainEqual({
      key: "KeyM",
      actions: ["attack", "mute"],
    });
  });

  it("in the realm an action without any working key is a conflict", () => {
    // hujum faqat E da: olamda E — gaplashish, hujumga tugma qolmaydi
    const k = { ...DEFAULT_KEYS, attack: ["KeyE"] };
    expect(keyConflicts(k)).toEqual([{ key: "KeyE", actions: ["attack", "interact"] }]);
    // qo'shimcha tugma qolsa — ziddiyat emas
    expect(keyConflicts({ ...DEFAULT_KEYS, attack: ["Space", "KeyE"] })).toEqual([]);
  });

  it("normalises left/right modifiers and prints readable names", () => {
    expect(normKey("ShiftLeft")).toBe("Shift");
    expect(normKey("ControlRight")).toBe("Control");
    expect(normKey("NumpadEnter")).toBe("Enter");
    expect(keyLabel("KeyW")).toBe("W");
    expect(keyLabel("Digit3")).toBe("3");
    expect(keyLabel("Escape")).toBe("Esc");
    expect(keyLabel("ArrowLeft")).toBe("←");
    expect(keyLabel("Numpad4")).toBe("Num4");
    expect(actionKey(DEFAULT_KEYS, "dash")).toBe("Shift");
    expect(moveLabel(DEFAULT_KEYS)).toBe("WASD");
    const arrows = {
      ...DEFAULT_KEYS,
      up: ["ArrowUp"],
      down: ["ArrowDown"],
      left: ["ArrowLeft"],
      right: ["ArrowRight"],
    };
    expect(moveLabel(arrows)).toBe("Strelkalar");
    expect(moveLabel({ ...arrows, up: ["KeyI"] })).toBe("I/←/↓/→");
  });
});
