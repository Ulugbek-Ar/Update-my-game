import { describe, expect, it } from "vitest";
import { DEFAULT_TOUCH, type TouchSettings } from "./settings";
import {
  controlSize,
  floatingCenter,
  floatingZone,
  inRect,
  placeControl,
  stickAxis,
  toFraction,
  type Viewport,
} from "./touchLayout";
import { CONTROL_IDS } from "./settings";

/** Pixel 7 gorizontal (kesik chapda) va kichik telefon 360x640 gorizontal */
const PIXEL7: Viewport = { w: 915, h: 412, safe: { l: 32, r: 0, t: 0, b: 0 } };
const SMALL: Viewport = { w: 640, h: 360, safe: { l: 0, r: 0, t: 0, b: 0 } };
const TABLET: Viewport = { w: 1280, h: 800, safe: { l: 0, r: 0, t: 0, b: 0 } };
const ts = (p: Partial<TouchSettings> = {}): TouchSettings => ({ ...DEFAULT_TOUCH, ...p });

function inside(vp: Viewport, p: { x: number; y: number; size: number }) {
  const { l, r, t, b } = vp.safe;
  return (
    p.x - p.size / 2 >= l - 0.01 &&
    p.x + p.size / 2 <= vp.w - r + 0.01 &&
    p.y - p.size / 2 >= t - 0.01 &&
    p.y + p.size / 2 <= vp.h - b + 0.01
  );
}

describe("Sensor boshqaruvi joylashuvi", () => {
  it("default stick is 150% (bigger than v2.4) and sizes follow the sliders", () => {
    expect(controlSize("stick", ts(), SMALL)).toBe(120);
    expect(controlSize("stick", ts({ stickSize: 100 }), SMALL)).toBe(80);
    expect(controlSize("stick", ts({ stickSize: 200 }), TABLET)).toBe(256);
    expect(controlSize("attack", ts({ buttonSize: 200 }), SMALL)).toBe(128);
    expect(controlSize("dash", ts({ buttonSize: 80 }), PIXEL7)).toBe(38);
  });

  it("every control stays inside the safe area on any phone, at any size", () => {
    for (const vp of [PIXEL7, SMALL, TABLET])
      for (const stickSize of [80, 150, 200])
        for (const buttonSize of [80, 100, 200])
          for (const leftHanded of [false, true])
            for (const id of CONTROL_IDS) {
              const p = placeControl(id, ts({ stickSize, buttonSize, leftHanded }), vp);
              expect(inside(vp, p), `${id} ${vp.w}x${vp.h} ${stickSize}/${buttonSize}`).toBe(true);
            }
  });

  it("default buttons do not overlap each other", () => {
    for (const vp of [PIXEL7, SMALL, TABLET])
      for (const buttonSize of [80, 100, 150]) {
        const ids = ["attack", "dash", "reload", "interact"] as const;
        const ps = ids.map((id) => placeControl(id, ts({ buttonSize }), vp));
        for (let i = 0; i < ps.length; i++)
          for (let j = i + 1; j < ps.length; j++) {
            const d = Math.hypot(ps[i]!.x - ps[j]!.x, ps[i]!.y - ps[j]!.y);
            expect(d, `${ids[i]}-${ids[j]}`).toBeGreaterThanOrEqual(
              (ps[i]!.size + ps[j]!.size) / 2,
            );
          }
      }
  });

  it("saved positions are fractions of the safe area and fit a different screen", () => {
    const s = ts({ layout: { attack: { x: 0.5, y: 0.5 } } });
    expect(placeControl("attack", s, SMALL)).toMatchObject({ x: 320, y: 180 });
    // Pixel 7: kesik (32 px) hisobga olinadi
    expect(placeControl("attack", s, PIXEL7)).toMatchObject({ x: 32 + 883 / 2, y: 206 });
    // ekran chetidagi nuqta — tugma ekrandan chiqmaydi
    const edge = ts({ layout: { attack: { x: 1, y: 1 } } });
    const p = placeControl("attack", edge, SMALL);
    expect(p).toMatchObject({ x: 640 - 32, y: 360 - 32 });
    // ekrandagi joy -> nisbat -> boshqa ekranda xuddi shu nisbat
    const f = toFraction("dash", 600, 100, s, PIXEL7);
    expect(f).toEqual({
      x: Math.round((568 / 883) * 10000) / 10000,
      y: Math.round((100 / 412) * 10000) / 10000,
    });
    const back = placeControl("dash", ts({ layout: { dash: f } }), PIXEL7);
    expect(back.x).toBeCloseTo(600, 0);
    expect(back.y).toBeCloseTo(100, 0);
  });

  it("left-handed mode swaps sides: stick right, action buttons left", () => {
    for (const vp of [PIXEL7, SMALL]) {
      const right = {
        stick: placeControl("stick", ts(), vp),
        attack: placeControl("attack", ts(), vp),
      };
      const left = {
        stick: placeControl("stick", ts({ leftHanded: true }), vp),
        attack: placeControl("attack", ts({ leftHanded: true }), vp),
        dash: placeControl("dash", ts({ leftHanded: true }), vp),
      };
      expect(right.stick.x).toBeLessThan(vp.w / 2);
      expect(right.attack.x).toBeGreaterThan(vp.w / 2);
      expect(left.stick.x).toBeGreaterThan(vp.w / 2);
      expect(left.attack.x).toBeLessThan(vp.w / 2);
      expect(left.dash.x).toBeLessThan(vp.w / 2);
      // pauza yuqori o'ngda qoladi (chapda o'yin HUD'i)
      expect(placeControl("pause", ts({ leftHanded: true }), vp).x).toBeGreaterThan(vp.w / 2);
    }
    // joylashtirilgan tugma ham ko'zgudek o'tadi va saqlashda qaytariladi
    const s = ts({ leftHanded: true, layout: { attack: { x: 0.8, y: 0.7 } } });
    expect(placeControl("attack", s, SMALL).x).toBeCloseTo(0.2 * 640, 5);
    expect(toFraction("attack", 0.2 * 640, 0.7 * 360, s, SMALL)).toEqual({ x: 0.8, y: 0.7 });
  });

  it("floating stick appears where the finger touches (left half, right half when left-handed)", () => {
    const zone = floatingZone(ts(), PIXEL7);
    expect(inRect(zone, 200, 300)).toBe(true);
    expect(inRect(zone, 700, 300)).toBe(false);
    expect(inRect(floatingZone(ts({ leftHanded: true }), PIXEL7), 700, 300)).toBe(true);
    const size = controlSize("stick", ts(), PIXEL7);
    expect(floatingCenter(300, 200, size, PIXEL7)).toEqual({ x: 300, y: 200 });
    // chetga tegsa — joystik to'liq ko'rinadigan joyga suriladi (kesik ham hisobga olinadi)
    expect(floatingCenter(10, 405, size, PIXEL7)).toEqual({ x: 32 + size / 2, y: 412 - size / 2 });
  });

  it("dead zone: default 25% keeps the v2.4 feel, lower is more sensitive", () => {
    expect(stickAxis(20, 0, 100, 25)).toMatchObject({ x: 0, y: 0 });
    expect(stickAxis(30, 0, 100, 25)).toMatchObject({ x: 0.3, y: 0 });
    expect(stickAxis(20, 0, 100, 10)).toMatchObject({ x: 0.2, y: 0 });
    // radiusdan tashqari — chekkada to'xtaydi
    const far = stickAxis(300, 400, 100, 25);
    expect(far.knob.x).toBeCloseTo(60);
    expect(far.knob.y).toBeCloseTo(80);
    expect(far.x).toBeCloseTo(0.6);
  });
});
