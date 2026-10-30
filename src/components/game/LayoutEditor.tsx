/**
 * "JOYLASHUVNI TAHRIRLASH": joystik va har tugmani barmoq bilan surib joylashtirish.
 * Joy xavfsiz hudud o'lchamiga nisbatan (foizda) saqlanadi; tugma ekrandan chiqib ketmaydi.
 */
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { HERO_THEME, type Hero } from "@/game/hero";
import {
  CONTROL_IDS,
  loadSettings,
  saveSettings,
  type ControlId,
  type TouchSettings,
} from "@/game/settings";
import {
  REALM_LABELS,
  clampCenter,
  placeControl,
  safeRect,
  toFraction,
  touchLabels,
} from "@/game/touchLayout";
import { lockGameKeys } from "@/game/input";
import { ButtonFace, StickView } from "./TouchControls";
import { BTN_CLASS, heroVars, placedStyle } from "./touchUi";
import { TouchIconSvg } from "./TouchIcon";
import { useViewport } from "./useViewport";

const NAMES: Record<ControlId, string> = {
  stick: "JOYSTIK",
  attack: "HUJUM",
  dash: "QOBILIYAT",
  reload: "O'QLASH",
  pause: "PAUZA",
  interact: "GAPLASH",
  journal: "JURNAL",
  map: "XARITA",
};

const TOOL =
  "border-2 px-2 py-1 text-[7px] leading-none active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground";

export function LayoutEditor({ hero, onClose }: { hero: Hero; onClose: () => void }) {
  const vp = useViewport();
  const [draft, setDraft] = useState<TouchSettings>(() => loadSettings().touch);
  const drag = useRef<{ id: ControlId; pid: number; dx: number; dy: number } | null>(null);
  const [active, setActive] = useState<ControlId | null>(null);
  // tahrirlash paytida o'yin klaviaturaga javob bermaydi
  useEffect(() => lockGameKeys(), []);

  const labels = touchLabels(hero);
  const glow = HERO_THEME[hero].glow;
  const safe = safeRect(vp);
  const gameW = Math.min(vp.w, (vp.h * 16) / 9);

  const save = () => {
    const s = loadSettings();
    saveSettings({ ...s, touch: { ...s.touch, layout: draft.layout } });
    onClose();
  };

  const face = (id: ControlId, size: number) => {
    if (id === "attack" || id === "dash")
      return <ButtonFace label={labels[id]} size={size} glow={glow} />;
    if (id === "interact" || id === "journal" || id === "map")
      return <ButtonFace label={REALM_LABELS[id]} size={size} glow={glow} />;
    if (id === "reload")
      return <TouchIconSvg id="bullet" size={Math.round(size * 0.5)} glow={glow} />;
    return <span style={{ fontSize: Math.max(6, Math.round(size / 4)) }}>II</span>;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Joylashuvni tahrirlash"
      className="layout-editor fixed inset-0 z-[70] touch-none select-none bg-[#0c0814] font-pixel"
      style={heroVars(hero)}
    >
      {/* o'yin maydoni (16:9) — tugmalar o'yin ustida qanday turishini ko'rish uchun */}
      <div
        className="pointer-events-none absolute top-0 h-full bg-[#2a1f38]"
        style={{ left: (vp.w - gameW) / 2, width: gameW }}
      >
        <div className="absolute inset-x-[6%] bottom-[8%] top-[10%] bg-[#3b2a4e]" />
      </div>
      {/* xavfsiz hudud chegarasi (kesikdan tashqari) */}
      <div
        className="pointer-events-none absolute border border-dashed border-foreground/25"
        style={{ left: safe.x, top: safe.y, width: safe.w, height: safe.h }}
      />
      <div className="absolute left-1/2 top-[max(0.5rem,env(safe-area-inset-top))] z-10 flex -translate-x-1/2 flex-col items-center gap-1">
        <div className="flex items-center gap-1 whitespace-nowrap">
          <button
            onClick={save}
            className={`${TOOL} border-primary bg-primary text-primary-foreground`}
          >
            SAQLASH
          </button>
          <button
            onClick={() => setDraft((d) => ({ ...d, layout: {} }))}
            className={`${TOOL} border-primary bg-card text-primary`}
          >
            ASL HOLIGA QAYTARISH
          </button>
          <button onClick={onClose} className={`${TOOL} border-border bg-card text-foreground`}>
            BEKOR
          </button>
        </div>
        <p className="pointer-events-none whitespace-nowrap text-[5px] leading-[8px] text-foreground/80">
          Barmoq bilan surib joylashtiring
          <br />
          O'QLASH — Mergan, GAPLASH/JURNAL/XARITA — olamda
        </p>
      </div>
      {CONTROL_IDS.map((id) => {
        const p = placeControl(id, draft, vp);
        const handlers = {
          onPointerDown: (e: RPointerEvent) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { id, pid: e.pointerId, dx: e.clientX - p.x, dy: e.clientY - p.y };
            setActive(id);
          },
          onPointerMove: (e: RPointerEvent) => {
            const d = drag.current;
            if (!d || d.pid !== e.pointerId) return;
            const c = clampCenter(e.clientX - d.dx, e.clientY - d.dy, p.size, vp);
            setDraft((s) => ({
              ...s,
              layout: { ...s.layout, [id]: toFraction(id, c.x, c.y, s, vp) },
            }));
          },
          onPointerUp: () => {
            drag.current = null;
            setActive(null);
          },
        };
        const ring = active === id ? "ring-2 ring-primary" : "";
        return (
          <div key={id}>
            {id === "stick" ? (
              <StickView p={p} className={`cursor-grab ${ring}`}>
                <div data-edit={id} className="absolute inset-0 rounded-full" {...handlers} />
              </StickView>
            ) : (
              <div
                data-edit={id}
                className={`${BTN_CLASS} cursor-grab ${ring}`}
                style={placedStyle(p)}
                {...handlers}
              >
                {face(id, p.size)}
              </div>
            )}
            <span
              className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-[5px] text-foreground"
              style={{ left: p.x, top: Math.min(vp.h - 7, p.y + p.size / 2 + 2) }}
            >
              {NAMES[id]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
