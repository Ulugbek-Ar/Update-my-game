/**
 * Telefondagi SUPER tugmasi — hujum tugmasi yonidagi shisha shar. O'yindagi super sharining o'zi
 * (superFx.ts: renderSuperOrb) shu tugma ichida chiziladi: suyuqlik zaryad bilan ko'tariladi,
 * chayqaladi, to'lganda porlaydi va ustida t("g.ready") chiqadi. Bosilsa — super (to'lgan bo'lsa).
 * Faqat superi bor qahramonda ko'rinadi (TouchControls).
 */
import { t } from "@/i18n";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/game/audio";
import type { Hero } from "@/game/hero";
import type { Input } from "@/game/input";
import { skinLook } from "@/game/skins";
import type { SkinTheme } from "@/game/skinFx";
import { currentSettings } from "@/game/settings";
import type { SuperMeter } from "@/game/super";
import { ORB_PAD, SuperOrb, renderSuperOrb } from "@/game/superFx";
import type { Placed } from "@/game/touchLayout";
import { placedStyle } from "./touchUi";

/** Shar chiziladigan mantiqiy to'r: radius 13 + porlash va uchqunlar uchun chet */
const ORB_R = 13;
const MID = ORB_R + ORB_PAD;
const GRID = MID * 2 + 1;
/** Kanvas tugmadan shuncha baravar katta (porlash va uchqunlar tugma chetidan chiqadi) */
const OVER = GRID / (ORB_R * 2 + 1);

/** Super tugmasi o'qiydigan qism: Game yoki olam klienti */
export interface SuperSource {
  input: Pick<Input, "pressSuper">;
  superMeter: Pick<SuperMeter, "def" | "ready" | "ratio">;
  orb: SuperOrb;
  theme: SkinTheme;
}

function OrbCanvas({ draw, size }: { draw: (c: CanvasRenderingContext2D) => void; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    c.imageSmoothingEnabled = false;
    let raf = 0;
    const loop = () => {
      c.clearRect(0, 0, GRID, GRID);
      drawRef.current(c);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const css = Math.round(size * OVER);
  return (
    <canvas
      ref={ref}
      width={GRID}
      height={GRID}
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
      style={{ width: css, height: css, imageRendering: "pixelated" }}
    />
  );
}

/** Joylashuv tahrirchisidagi ko'rinish: yarim to'lgan, qimirlamaydigan shar */
export function SuperOrbFace({ hero, size }: { hero: Hero; size: number }) {
  const orb = useRef<SuperOrb | null>(null);
  if (!orb.current) {
    orb.current = new SuperOrb();
    orb.current.level = 0.6;
  }
  const theme = skinLook(hero).theme;
  return (
    <OrbCanvas
      size={size}
      draw={(c) => {
        const o = orb.current!;
        o.update(1 / 60, 0.6, false, 0, currentSettings().reduceFx);
        renderSuperOrb(c, o, MID, MID, ORB_R, theme, currentSettings().reduceFx);
      }}
    />
  );
}

export function SuperOrbButton({ game, p }: { game: SuperSource; p: Placed }) {
  const [ready, setReady] = useState(game.superMeter.ready);
  const readyRef = useRef(ready);
  const name = game.superMeter.def?.name ?? "Super";
  return (
    <button
      data-touch-control="super"
      aria-label={`Super: ${name}`}
      className="touch-btn touch-super pointer-events-auto absolute rounded-full select-none"
      style={placedStyle(p)}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        sfx.unlock();
        game.input.pressSuper();
      }}
    >
      <OrbCanvas
        size={p.size}
        draw={(c) => {
          const m = game.superMeter;
          if (m.ready !== readyRef.current) {
            readyRef.current = m.ready;
            setReady(m.ready);
          }
          renderSuperOrb(c, game.orb, MID, MID, ORB_R, game.theme, currentSettings().reduceFx);
        }}
      />
      {ready && (
        <span
          className="super-ready pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap leading-none"
          style={{ fontSize: Math.max(6, Math.round(p.size / 7)), color: game.theme.glow }}
        >
          {t("g.ready")}
        </span>
      )}
    </button>
  );
}
