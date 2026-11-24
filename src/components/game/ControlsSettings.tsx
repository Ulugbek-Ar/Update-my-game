/**
 * SOZLAMALAR -> BOSHQARUV: telefon (joystik, tugmalar, joylashuv, tebranish) va kompyuter
 * (tugmalarni qayta belgilash). O'zgarish darhol saqlanadi va o'yinda qo'llanadi.
 */
import { t } from "@/i18n";
import { superFor } from "@/game/super";
import { SuperOrbFace } from "./SuperOrbButton";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { pixelFocus, pixelPress } from "@/lib/pixel-ui";
import { HERO_THEME, type Hero } from "@/game/hero";
import {
  DEADZONE_RANGE,
  DEFAULT_TOUCH,
  OPACITY_RANGE,
  SIZE_RANGE,
  loadSettings,
  saveSettings,
  type ControlId,
  type TouchSettings,
} from "@/game/settings";
import { REALM_LABELS, floatingZone, placeControl, touchLabels } from "@/game/touchLayout";
import { ButtonFace, StickView } from "./TouchControls";
import { BTN_CLASS, buttonTheme, heroVars, placedStyle, setTouchSettings } from "./touchUi";
import { TouchIconSvg } from "./TouchIcon";
import { LayoutEditor } from "./LayoutEditor";
import { KeyBindsPanel } from "./KeyBindsPanel";
import { useSettings } from "./useSettings";
import { useViewport } from "./useViewport";

export function Toggle({
  on,
  label,
  onChange,
  yes = t("ctl.on"),
  no = t("ctl.off"),
}: {
  on: boolean;
  label: string;
  onChange: (v: boolean) => void;
  yes?: string;
  no?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-foreground">
      {label}
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`min-w-20 shrink-0 border-2 px-3 py-1 ${pixelPress} ${pixelFocus} ${
          on
            ? "border-primary bg-primary text-primary-foreground hover:border-primary-hover hover:bg-primary-hover"
            : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
        }`}
      >
        {on ? yes : no}
      </button>
    </div>
  );
}

function Slider({
  label,
  value,
  range,
  unit = "%",
  note,
  onChange,
}: {
  label: string;
  value: number;
  range: readonly [number, number];
  unit?: string;
  note?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-foreground">
      <span>
        {label}: <span className="text-primary">{value + unit}</span>
        {note && <span className="text-muted-foreground"> · {note}</span>}
      </span>
      <input
        type="range"
        min={range[0]}
        max={range[1]}
        step={5}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </label>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1 text-foreground" role="radiogroup" aria-label={label}>
      {label}
      <div className="flex gap-2">
        {options.map(([v, name]) => (
          <button
            key={v}
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={`flex-1 border-2 px-2 py-1 ${pixelPress} ${pixelFocus} ${
              value === v
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Jonli ko'rinish: shu ekranda tugmalar qanday turishi — kichraytirilgan nusxa. */
export function ControlsPreview({ hero, ts }: { hero: Hero; ts: TouchSettings }) {
  const vp = useViewport();
  const box = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(280);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const on = () => setBoxW(el.clientWidth || 280);
    on();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const k = boxW / vp.w;
  const labels = touchLabels(hero);
  const glow = buttonTheme(hero).glow;
  // o'yin maydoni 16:9, chetlari — qora hoshiya (haqiqiy ekrandagidek)
  const gameW = Math.min(vp.w, (vp.h * 16) / 9);
  const zone = floatingZone(ts, vp);
  const face = (id: ControlId, size: number): ReactNode => {
    if (id === "attack" || id === "dash")
      return <ButtonFace label={labels[id]} size={size} glow={glow} />;
    if (id === "interact" || id === "journal" || id === "map")
      return <ButtonFace label={REALM_LABELS[id]} size={size} glow={glow} />;
    if (id === "reload")
      return <TouchIconSvg id="bullet" size={Math.round(size * 0.5)} glow={glow} />;
    if (id === "super") return <SuperOrbFace hero={hero} size={size} />;
    return <span style={{ fontSize: Math.max(6, Math.round(size / 4)) }}>II</span>;
  };
  const ids: ControlId[] = [
    "attack",
    "dash",
    "pause",
    ...(hero === "gunner" ? ["reload" as const] : []),
    // super shari — faqat superi bor qahramonda
    ...(superFor(hero) ? ["super" as const] : []),
  ];
  return (
    <div
      ref={box}
      aria-label={t("ctl.view")}
      className="controls-preview relative w-full overflow-hidden border-2 border-border bg-black"
      style={{ height: vp.h * k }}
    >
      <div
        className="pointer-events-none absolute left-0 top-0 origin-top-left"
        style={{ width: vp.w, height: vp.h, transform: `scale(${k})`, ...heroVars(hero) }}
      >
        <div
          className="absolute top-0 h-full bg-[#2a1f38]"
          style={{ left: (vp.w - gameW) / 2, width: gameW }}
        >
          <div className="absolute inset-x-[6%] bottom-[8%] top-[10%] bg-[#3b2a4e]" />
        </div>
        {ts.stickMode === "floating" && (
          <div
            className="absolute border-2 border-dashed border-foreground/30"
            style={{ left: zone.x, top: zone.y, width: zone.w, height: zone.h }}
          />
        )}
        <div className="absolute inset-0" style={{ opacity: ts.opacity / 100 }}>
          <StickView
            p={placeControl("stick", ts, vp)}
            style={ts.stickMode === "floating" ? { opacity: 0.45 } : undefined}
          />
          {ids.map((id) => {
            const p = placeControl(id, ts, vp);
            return (
              <div key={id} className={BTN_CLASS} style={placedStyle(p)}>
                {face(id, p.size)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function TouchSettingsPanel({ hero }: { hero: Hero }) {
  const { touch: ts } = useSettings();
  const [editing, setEditing] = useState(false);
  const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-2 sm:sticky sm:top-0 sm:self-start">
        <span className="text-muted-foreground">{t("ctl.live")}</span>
        <ControlsPreview hero={hero} ts={ts} />
        <button
          onClick={() => setEditing(true)}
          className={`border-2 border-primary px-3 py-2 text-primary hover:bg-primary hover:text-primary-foreground ${pixelPress} ${pixelFocus}`}
        >
          {t("ctl.editLayout")}
        </button>
        {Object.keys(ts.layout).length > 0 && (
          <span className="text-muted-foreground">{t("ctl.yourLayout")}</span>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <Slider
          label={t("ctl.stickSize")}
          value={ts.stickSize}
          range={SIZE_RANGE}
          onChange={(v) => setTouchSettings({ stickSize: v })}
        />
        <Slider
          label={t("ctl.btnSize")}
          value={ts.buttonSize}
          range={SIZE_RANGE}
          onChange={(v) => setTouchSettings({ buttonSize: v })}
        />
        <Slider
          label="Shaffoflik"
          value={ts.opacity}
          range={OPACITY_RANGE}
          onChange={(v) => setTouchSettings({ opacity: v })}
        />
        <Segmented
          label={t("ctl.stickType")}
          value={ts.stickMode}
          options={[
            ["fixed", t("ctl.fixed")],
            ["floating", t("ctl.floating")],
          ]}
          onChange={(v) => setTouchSettings({ stickMode: v })}
        />
        {ts.stickMode === "floating" && (
          <span className="text-muted-foreground">
            {t(ts.leftHanded ? "ctl.floatNoteR" : "ctl.floatNoteL")}
          </span>
        )}
        <Slider
          label={t("ctl.deadzone")}
          value={ts.deadzone}
          range={DEADZONE_RANGE}
          note={t("ctl.deadzoneNote")}
          onChange={(v) => setTouchSettings({ deadzone: v })}
        />
        <Toggle
          label={t("ctl.left")}
          on={ts.leftHanded}
          onChange={(v) => setTouchSettings({ leftHanded: v })}
        />
        <Toggle
          label={canVibrate ? "Tebranish" : t("ctl.vibrate")}
          on={ts.vibrate}
          onChange={(v) => setTouchSettings({ vibrate: v })}
        />
        <button
          onClick={() => setTouchSettings({ ...DEFAULT_TOUCH, layout: {} })}
          className={`self-start border-2 border-border px-3 py-1 text-muted-foreground hover:border-foreground hover:text-foreground ${pixelPress} ${pixelFocus}`}
        >
          {t("ctl.reset")}
        </button>
      </div>
      {editing && <LayoutEditor hero={hero} onClose={() => setEditing(false)} />}
    </div>
  );
}

/** BOSHQARUV bo'limi: telefonda — TELEFON, kompyuterda — KOMPYUTER ochiladi */
export function ControlsSettings({ hero, touch }: { hero: Hero; touch: boolean }) {
  const [part, setPart] = useState<"touch" | "keys">(touch ? "touch" : "keys");
  const tab = (id: "touch" | "keys", label: string) => (
    <button
      role="tab"
      aria-selected={part === id}
      onClick={() => setPart(id)}
      className={`flex-1 border-b-2 px-2 py-1 ${pixelFocus} ${
        part === id
          ? "border-primary text-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label={t("ctl.type")} className="flex gap-2">
        {tab("touch", t("ctl.phone"))}
        {tab("keys", t("ctl.pc"))}
      </div>
      {part === "touch" ? <TouchSettingsPanel hero={hero} /> : <KeyBindsPanel />}
    </div>
  );
}
