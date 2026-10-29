import { describe, expect, it, vi } from "vitest";
import { BACK_EVENT, backAction, exitApp, onAppActive, onBackButton } from "./native";

const base = { windowOpen: false, inGame: false, inRealm: false, inMap: false };

describe("Orqaga tugmasi", () => {
  it("bosh menyuda — chiqish so'rovi", () => {
    expect(backAction(base)).toBe("exit-confirm");
  });

  it("ochiq oyna birinchi yopiladi", () => {
    expect(backAction({ ...base, windowOpen: true })).toBe("close-window");
    expect(backAction({ ...base, windowOpen: true, inGame: true })).toBe("close-window");
  });

  it("o'yinda — pauza, olamda — olam, xaritada — orqaga", () => {
    expect(backAction({ ...base, inGame: true })).toBe("game");
    expect(backAction({ ...base, inRealm: true })).toBe("realm");
    expect(backAction({ ...base, inMap: true })).toBe("map");
  });

  it("saytda brauzer hodisasi bilan sinaladi va tinglovchi olib tashlanadi", () => {
    const cb = vi.fn();
    const off = onBackButton(cb);
    window.dispatchEvent(new Event(BACK_EVENT));
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    window.dispatchEvent(new Event(BACK_EVENT));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("saytda fon hodisalari va chiqish hech narsa qilmaydi", () => {
    const cb = vi.fn();
    onAppActive(cb)();
    exitApp();
    expect(cb).not.toHaveBeenCalled();
  });
});
