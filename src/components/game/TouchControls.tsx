/**
 * Telefon (sensor) boshqaruvi: joystik va tugmalar. O'lcham, shaffoflik, joystik turi, o'lik zona,
 * chapaqay rejimi va joylashuv SOZLAMALAR -> BOSHQARUV dan olinadi va darhol qo'llanadi.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Game } from "@/game/game";
import { sfx } from "@/game/audio";
import { HERO_THEME, withAlpha, type Hero } from "@/game/hero";
import type { ControlId, TouchSettings } from "@/game/settings";
import {
  REALM_LABELS,
  fitLabel,
  floatingCenter,
  floatingZone,
  inRect,
  placeControl,
  stickAxis,
  touchLabels,
  type ButtonLabel,
  type Placed,
  type Viewport,
} from "@/game/touchLayout";
import { TouchIconSvg } from "./TouchIcon";
import { BTN_CLASS, heroVars, placedStyle } from "./touchUi";
import { useSettings } from "./useSettings";
import { useViewport } from "./useViewport";

/** Sensor boshqaruvi ishlatadigan qism: Game yoki olam klienti (RealmClient) */
export type TouchTarget = Pick<Game, "input" | "player" | "hero"> & {
  /** Hozir yurish mumkinmi (pauza, kuch tanlash, oynalar — yo'q) */
  acceptsMove?(): boolean;
  /** Ekrandagi shu nuqtada o'yin tugmasi bormi (suzuvchi joystik u yerda paydo bo'lmaydi) */
  touchUiAt?(clientX: number, clientY: number): boolean;
};

/** Olamdagi qo'shimcha tugmalar: gaplashish, jurnal, xarita */
export interface RealmButtons {
  pressInteract(): void;
  toggleJournal(): void;
  toggleMap(): void;
}

/** Tugma yozuvi: o'lchamga moslab kichrayadi, sig'masa — ikonka. */
export function ButtonFace({
  label,
  size,
  glow,
}: {
  label: ButtonLabel;
  size: number;
  glow: string;
}) {
  const fit = fitLabel(size, label.text, label.sub);
  if (!fit) return <TouchIconSvg id={label.icon} size={Math.round(size * 0.5)} glow={glow} />;
  return (
    <>
      <span style={{ fontSize: fit.main }}>{label.text}</span>
      {fit.sub > 0 && (
        <span className="opacity-80" style={{ fontSize: fit.sub, marginTop: fit.main * 0.35 }}>
          {label.sub}
        </span>
      )}
    </>
  );
}

/** Joystik asosi va dastagi (dastak o'lchami asosga mos) */
export function StickView({
  p,
  knob = { x: 0, y: 0 },
  className = "",
  style,
  children,
}: {
  p: Placed;
  knob?: { x: number; y: number };
  className?: string;
  style?: CSSProperties | undefined;
  children?: ReactNode;
}) {
  const k = Math.round(p.size * 0.42);
  return (
    <div
      className={`touch-stick absolute rounded-full border-2 border-foreground/30 bg-card/30 ${className}`}
      style={{ ...placedStyle(p), ...style }}
    >
      <div
        className="absolute left-1/2 top-1/2 rounded-full bg-foreground/40"
        style={{
          width: k,
          height: k,
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
        }}
      />
      {children}
    </div>
  );
}

export function TouchControls({ game, realm }: { game: TouchTarget; realm?: RealmButtons }) {
  const { touch: ts } = useSettings();
  const vp = useViewport();
  const live = useRef<{ ts: TouchSettings; vp: Viewport }>({ ts, vp });
  live.current = { ts, vp };
  const pointer = useRef<number | null>(null);
  const center = useRef({ x: 0, y: 0 });
  /** Suzuvchi joystik: barmoq tekkan joy (null — joyida, xira) */
  const [floatAt, setFloatAt] = useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const home = placeControl("stick", ts, vp);
  const steer = (x: number, y: number) => {
    const { ts, vp } = live.current;
    const R = placeControl("stick", ts, vp).size / 2;
    const a = stickAxis(x - center.current.x, y - center.current.y, R, ts.deadzone);
    setKnob(a.knob);
    game.input.setTouchAxis(a.x, a.y);
  };
  const end = () => {
    pointer.current = null;
    setFloatAt(null);
    setKnob({ x: 0, y: 0 });
    game.input.setTouchAxis(0, 0);
  };
  const endRef = useRef(end);
  endRef.current = end;
  const steerRef = useRef(steer);
  steerRef.current = steer;

  // Suzuvchi joystik: ekranning chap yarmida (chapaqayda — o'ngida) barmoq qayerga tegsa — o'sha yerda
  useEffect(() => {
    if (ts.stickMode !== "floating") return;
    const down = (e: PointerEvent) => {
      if (pointer.current !== null) return;
      const t = e.target as Element | null;
      if (!t?.closest?.(".game-viewport")) return;
      if (t.closest("button, [role=dialog], [data-touch-control], .game-menu")) return;
      const { ts, vp } = live.current;
      if (!inRect(floatingZone(ts, vp), e.clientX, e.clientY)) return;
      if (game.acceptsMove && !game.acceptsMove()) return;
      if (game.touchUiAt?.(e.clientX, e.clientY)) return;
      const c = floatingCenter(e.clientX, e.clientY, placeControl("stick", ts, vp).size, vp);
      pointer.current = e.pointerId;
      center.current = c;
      setFloatAt(c);
      steerRef.current(e.clientX, e.clientY);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId === pointer.current) steerRef.current(e.clientX, e.clientY);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === pointer.current) endRef.current();
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      endRef.current();
    };
  }, [ts.stickMode, game]);

  const glow = HERO_THEME[game.hero].glow;
  const labels = touchLabels(game.hero);
  const button = (
    id: ControlId,
    label: ButtonLabel | null,
    down: () => void,
    up?: () => void,
    face?: ReactNode,
  ) => {
    const p = placeControl(id, ts, vp);
    return (
      <button
        key={id}
        data-touch-control={id}
        aria-label={label?.aria ?? "Pauza"}
        className={`${BTN_CLASS} touch-${id} pointer-events-auto`}
        style={placedStyle(p)}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          sfx.unlock();
          down();
        }}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {face ?? (label && <ButtonFace label={label} size={p.size} glow={glow} />)}
      </button>
    );
  };

  const fixed = ts.stickMode === "fixed";
  const stickP = floatAt ? { ...home, ...floatAt } : home;
  return (
    <div
      className="touch-controls pointer-events-none fixed inset-0 z-40 touch-none select-none"
      style={{ ...heroVars(game.hero), opacity: ts.opacity / 100 }}
    >
      <StickView
        p={stickP}
        knob={knob}
        className={fixed ? "pointer-events-auto" : "pointer-events-none"}
        // suzuvchi joystik bo'sh turganda — xira ishora
        style={!fixed && !floatAt ? { opacity: 0.45 } : undefined}
      >
        {fixed && (
          <div
            data-touch-control="stick"
            className="absolute inset-0 rounded-full"
            onPointerDown={(e) => {
              pointer.current = e.pointerId;
              e.currentTarget.setPointerCapture(e.pointerId);
              center.current = { x: home.x, y: home.y };
              steer(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (pointer.current === e.pointerId) steer(e.clientX, e.clientY);
            }}
            onPointerUp={end}
            onPointerCancel={end}
          />
        )}
      </StickView>
      {button(
        "attack",
        labels.attack,
        () => {
          game.input.pressAttack();
          game.input.setTouchAttack(true);
        },
        () => game.input.setTouchAttack(false),
      )}
      {button(
        "dash",
        labels.dash,
        () => {
          // Ovchi: bosib turilsa tuzoq qo'yadi, Mergan — tutun bombasi
          game.input.pressDash();
          game.input.setTouchDash(true);
        },
        () => game.input.setTouchDash(false),
      )}
      {game.player.gunner &&
        button(
          "reload",
          { text: "", aria: "Qayta o'qlash", icon: "bullet" },
          () => game.input.pressReload(),
          undefined,
          <TouchIconSvg
            id="bullet"
            size={Math.round(placeControl("reload", ts, vp).size * 0.5)}
            glow={glow}
          />,
        )}
      {button(
        "pause",
        null,
        () => game.input.pressPause(),
        undefined,
        <span style={{ fontSize: Math.max(6, Math.round(placeControl("pause", ts, vp).size / 4)) }}>
          II
        </span>,
      )}
      {realm && (
        <>
          {button("interact", REALM_LABELS.interact, () => realm.pressInteract())}
          {button("journal", REALM_LABELS.journal, () => realm.toggleJournal())}
          {button("map", REALM_LABELS.map, () => realm.toggleMap())}
        </>
      )}
    </div>
  );
}
