import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Input } from "@/game/input";
import type { Hero } from "@/game/hero";
import { DEFAULT_SETTINGS, DEFAULT_TOUCH, saveSettings, type TouchSettings } from "@/game/settings";
import { MIN_LABEL_FONT, fitLabel, touchLabels, REALM_LABELS } from "@/game/touchLayout";
import { DEFAULT_THEME } from "@/game/skinFx";
import { SuperMeter } from "@/game/super";
import { SuperOrb } from "@/game/superFx";
import { TouchControls, type TouchTarget } from "./TouchControls";

/** Pixel 7 gorizontal */
const W = 915,
  H = 412;

function target(hero: Hero = "knight", active = true): TouchTarget & { input: Input } {
  return {
    input: new Input(),
    hero,
    player: { mage: hero === "mage", hunter: hero === "hunter", gunner: hero === "gunner" },
    acceptsMove: () => active,
    touchUiAt: () => false,
  } as unknown as TouchTarget & { input: Input };
}

function setTouch(p: Partial<TouchSettings>) {
  saveSettings({ ...DEFAULT_SETTINGS, touch: { ...DEFAULT_TOUCH, ...p } });
}

function mount(t: TouchTarget) {
  return render(
    <main className="game-viewport">
      <canvas className="game-canvas" />
      <TouchControls game={t} />
    </main>,
  );
}

function pointer(el: EventTarget, type: string, x: number, y: number, id = 1) {
  const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(e, "pointerId", { value: id });
  act(() => {
    el.dispatchEvent(e);
  });
}

function box(el: Element) {
  const s = (el as HTMLElement).style;
  const left = parseFloat(s.left),
    top = parseFloat(s.top),
    w = parseFloat(s.width);
  return { x: left + w / 2, y: top + w / 2, size: w };
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: W });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: H });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Telefon boshqaruvi (komponent)", () => {
  it("restores controls and floating movement after a card is picked even when choices remain", () => {
    vi.useFakeTimers();
    setTouch({ stickMode: "floating" });
    const t = Object.assign(target(), { stage: "upgrade", choices: [{}, {}, {}] });
    const { container } = mount(t);
    const canvas = container.querySelector("canvas");
    const controls = container.querySelector(".touch-controls");
    const attack = container.querySelector<HTMLButtonElement>(".touch-attack");
    const dash = container.querySelector<HTMLButtonElement>(".touch-dash");
    if (!canvas || !controls || !attack || !dash) throw new Error("Missing touch controls");

    act(() => vi.advanceTimersByTime(120));
    expect(controls).not.toBeVisible();
    pointer(canvas, "pointerdown", 260, 230);
    pointer(window, "pointermove", 330, 230);
    expect(t.input.axis()).toEqual({ x: 0, y: 0 });

    t.stage = "fight";
    act(() => vi.advanceTimersByTime(120));
    expect(t.choices).toHaveLength(3);
    expect(controls).toBeVisible();
    pointer(canvas, "pointerdown", 260, 230);
    pointer(window, "pointermove", 330, 230);
    expect(t.input.axis()).toEqual({ x: 1, y: 0 });
    pointer(window, "pointerup", 330, 230);
    expect(t.input.axis()).toEqual({ x: 0, y: 0 });

    for (const button of [attack, dash]) button.setPointerCapture = () => {};
    pointer(attack, "pointerdown", 850, 350);
    expect(t.input.consumeAttack()).toBe(true);
    pointer(attack, "pointerup", 850, 350);
    expect(t.input.attackHeld()).toBe(false);
    pointer(dash, "pointerdown", 790, 280);
    expect(t.input.consumeDash()).toBe(true);
    pointer(dash, "pointerup", 790, 280);
    expect(t.input.dashHeld()).toBe(false);
  });

  it("floating stick appears where the finger touches the left half and steers", () => {
    setTouch({ stickMode: "floating" });
    const t = target();
    const { container } = mount(t);
    const canvas = container.querySelector("canvas")!;
    const stick = () => container.querySelector(".touch-stick")!;
    pointer(canvas, "pointerdown", 260, 230);
    expect(box(stick())).toMatchObject({ x: 260, y: 230 });
    pointer(window, "pointermove", 330, 230);
    expect(t.input.axis()).toEqual({ x: 1, y: 0 });
    pointer(window, "pointerup", 330, 230);
    expect(t.input.axis()).toEqual({ x: 0, y: 0 });
    // o'ng yarmida (tugmalar tomoni) — joystik chiqmaydi
    pointer(canvas, "pointerdown", 700, 230, 2);
    pointer(window, "pointermove", 760, 230, 2);
    expect(t.input.axis()).toEqual({ x: 0, y: 0 });
  });

  it("floating stick does not appear while the game is paused or picking a card", () => {
    setTouch({ stickMode: "floating" });
    const t = target("knight", false);
    const { container } = mount(t);
    pointer(container.querySelector("canvas")!, "pointerdown", 260, 230);
    pointer(window, "pointermove", 330, 230);
    expect(t.input.axis()).toEqual({ x: 0, y: 0 });
  });

  it("left-handed mode: stick on the right, attack button on the left", () => {
    setTouch({ stickMode: "fixed", leftHanded: true });
    const { container } = mount(target());
    expect(box(container.querySelector(".touch-stick")!).x).toBeGreaterThan(W / 2);
    expect(box(container.querySelector(".touch-attack")!).x).toBeLessThan(W / 2);
    expect(box(container.querySelector(".touch-pause")!).x).toBeGreaterThan(W / 2);
  });

  it("size and opacity sliders apply at once, without remounting", () => {
    setTouch({ stickMode: "fixed" });
    const { container } = mount(target());
    const before = box(container.querySelector(".touch-stick")!).size;
    act(() => setTouch({ stickMode: "fixed", stickSize: 200, opacity: 40 }));
    expect(box(container.querySelector(".touch-stick")!).size).toBeGreaterThan(before);
    expect((container.querySelector(".touch-controls") as HTMLElement).style.opacity).toBe("0.4");
  });

  it("every hero's button labels fit inside the round button at every size", () => {
    const heroes: Hero[] = ["knight", "mage", "hunter", "gunner"];
    for (const size of [26, 32, 38, 48, 56, 64, 80, 96, 112, 128, 160]) {
      for (const h of heroes)
        for (const label of Object.values(touchLabels(h))) {
          const fit = fitLabel(size, label.text, label.sub);
          // sig'masa — yozuv o'rniga ikonka (null), sig'sa — shrift kamida 4px
          if (fit) {
            expect(fit.main).toBeGreaterThanOrEqual(MIN_LABEL_FONT);
            expect(label.text.length * fit.main).toBeLessThanOrEqual(size - 4);
          }
        }
      for (const label of Object.values(REALM_LABELS)) {
        const fit = fitLabel(size, label.text);
        if (fit) expect(label.text.length * fit.main).toBeLessThanOrEqual(size - 4);
      }
    }
    // Sehrgarning TELEPORT yozuvi telefondagi asl tugmaga (48px) sig'adi
    const tp = fitLabel(48, "TELEPORT")!;
    expect(tp.main * 8).toBeLessThanOrEqual(48 - 7);
  });

  it("the super orb button appears only for a hero that has a super and queues the super when pressed", () => {
    setTouch({ stickMode: "fixed" });
    // superi yo'q qahramon: tugma umuman yo'q
    const plain = mount(target("knight"));
    expect(plain.container.querySelector(".touch-super")).toBeNull();
    cleanup();
    const t = target("paladin");
    const meter = new SuperMeter("paladin");
    Object.assign(t, { superMeter: meter, orb: new SuperOrb(), theme: DEFAULT_THEME.paladin });
    const { container } = mount(t);
    const btn = container.querySelector(".touch-super") as HTMLElement;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute("aria-label")).toBe("Super: ILOHIY HUKM");
    // ekran ichida (915x412) va boshqa tugmalar ustiga tushmaydi
    const b = box(btn);
    expect(b.x + b.size / 2).toBeLessThanOrEqual(W);
    expect(b.y + b.size / 2).toBeLessThanOrEqual(H);
    for (const other of [".touch-attack", ".touch-dash"]) {
      const o = box(container.querySelector(other)!);
      expect(Math.hypot(o.x - b.x, o.y - b.y)).toBeGreaterThanOrEqual((o.size + b.size) / 2);
    }
    expect(t.input.consumeSuper()).toBe(false);
    btn.setPointerCapture = () => {};
    pointer(btn, "pointerdown", b.x, b.y);
    expect(t.input.consumeSuper()).toBe(true);
    // joystik va hujum tugmasi o'z ishida
    expect(container.querySelector(".touch-stick")).not.toBeNull();
    expect(container.querySelector(".touch-attack")).not.toBeNull();
  });

  it("mage button shows TELEPORT, small buttons fall back to a drawn icon", () => {
    setTouch({ stickMode: "fixed" });
    const { container } = mount(target("mage"));
    const dash = container.querySelector(".touch-dash")!;
    expect(dash.textContent).toBe("TELEPORT");
    act(() => setTouch({ stickMode: "fixed", buttonSize: 80 }));
    // 80%: 38px tugmaga TELEPORT o'qiladigan o'lchamda sig'maydi — ikonka
    expect(container.querySelector(".touch-dash svg")).not.toBeNull();
    expect(container.querySelector(".touch-dash")!.getAttribute("aria-label")).toBe("Teleport");
  });
});
