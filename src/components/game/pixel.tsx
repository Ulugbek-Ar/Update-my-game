/**
 * Akkaunt oynalari uchun umumiy piksel komponentlar: oyna ramkasi (menyudagi boshqa oynalar
 * uslubida), qahramon avatari, tanga/kubok ikonkasi, QR kod va daraja belgisi.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { renderSprite, renderUpgradeIcon } from "@/game/sprites";
import { makeQr } from "@/lib/qr";
import type { Hero } from "@/game/hero";
import { closeBtn } from "./pixelUi";

/**
 * Oyna: ekranga sig'adi (dvh'ni bilmaydigan eski WebView'da ham), sarlavha joyida, ichi aylanadi.
 * Esc yoki fonga bosish — yopish (onClose bo'lmasa — yopilmaydi).
 */
export function PixelWindow({
  label,
  title,
  onClose,
  wide = false,
  accent = false,
  head,
  children,
}: {
  label: string;
  title: ReactNode;
  onClose?: (() => void) | undefined;
  wide?: boolean;
  /** sariq ramka (muhim tanlov) */
  accent?: boolean;
  /** sarlavha yonidagi qo'shimcha (bo'limlar) */
  head?: ReactNode;
  children: ReactNode;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" && closeRef.current) {
        e.preventDefault();
        closeRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/70 p-2" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn(
          "fit-screen m-auto flex flex-col overflow-hidden border-4 bg-card text-[9px] sm:text-[10px] leading-4",
          wide ? "w-[min(96vw,720px)]" : "w-[min(94vw,520px)]",
          accent ? "border-primary" : "border-border",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4">
          <h2 className="text-primary text-xs sm:text-sm">{title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {head}
            {onClose && (
              <button onClick={onClose} aria-label="Yopish" className={closeBtn}>
                X
              </button>
            )}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Qahramon rasmi (kod bilan chizilgan sprite) — avatar sifatida */
export function HeroAvatar({
  hero,
  size = 24,
  dim = false,
}: {
  hero: Hero;
  size?: number;
  dim?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Paladinning ulkan qilichi 32 px ga sig'maydi
  const view = hero === "paladin" ? 48 : 32;
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, view, view);
    renderSprite(c, hero, "idle", 0, view / 2, view / 2, false);
  }, [hero, view]);
  return (
    <canvas
      ref={ref}
      width={view}
      height={view}
      aria-hidden="true"
      className="shrink-0"
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
        opacity: dim ? 0.4 : 1,
        filter: dim ? "grayscale(0.7)" : undefined,
      }}
    />
  );
}

/** 12x12 piksel ikonka (sprites.ts dagi UPGRADE_ICONS: coin, trophy, gift, heart...) */
export function Icon({ id, color, size = 12 }: { id: string; color: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, 12, 12);
    renderUpgradeIcon(c, id, color, 0, 0, 12);
  }, [id, color]);
  return (
    <canvas
      ref={ref}
      width={12}
      height={12}
      aria-hidden="true"
      className="shrink-0"
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    />
  );
}

/** Daraja belgisi: "12" kichik ramkada */
export function LevelBadge({ level, className }: { level: number; className?: string }) {
  return (
    <span
      title={`${level}-daraja`}
      className={cn(
        "inline-flex shrink-0 items-center border-2 border-primary bg-primary/15 px-1 text-[8px] leading-3 text-primary",
        className,
      )}
    >
      {level}
    </span>
  );
}

/** QR kod (t.me havolasi: kompyuterda telefon kamerasi bilan ochish uchun) */
export function QrCode({ text, size = 132 }: { text: string; size?: number }) {
  const qr = makeQr(text);
  const n = qr.size + 4;
  let d = "";
  qr.modules.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) d += `M${x + 2} ${y + 2}h1v1h-1z`;
    }),
  );
  return (
    <svg
      role="img"
      aria-label="QR kod"
      viewBox={`0 0 ${n} ${n}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="shrink-0 border-2 border-black"
    >
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

/** Telegram belgisi (piksel, 9x9): ko'k doira ichida oq qog'oz samolyot */
export function TelegramIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 9 9"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="shrink-0"
    >
      <path d="M2 0h5v1H2zM1 1h7v1H1zM0 2h9v5H0zM1 7h7v1H1zM2 8h5v1H2z" fill="#2aabee" />
      <path d="M6 2h1v1H6zM2 3h5v1H2zM3 4h3v1H3zM4 5h2v1H4zM5 6h1v1H5z" fill="#fff" />
    </svg>
  );
}

/** "MUALLIF" belgisi: o'yin muallifi (admin) ismi yonida — profil, do'stlar, gildiya, sovg'a */
export function AuthorBadge({ className }: { className?: string }) {
  return (
    <span
      title="O'yin muallifi"
      className={cn(
        "inline-flex shrink-0 items-center border-2 border-[#ff7ab6] bg-[#ff7ab6]/15 px-1 text-[8px] leading-3 text-[#ff9fcb]",
        className,
      )}
    >
      MUALLIF
    </span>
  );
}

/** Ekran bo'ylab tushadigan tangalar (bir marta): kunlik sovg'aning 7-kuni, oltin sovg'asi */
export function CoinRain() {
  const coins = Array.from({ length: 28 }, (_, i) => ({
    left: (i * 37 + 11) % 100,
    delay: ((i * 53) % 18) / 10,
    dur: 1.6 + ((i * 29) % 12) / 10,
    size: 14 + ((i * 17) % 3) * 6,
  }));
  return (
    <div
      aria-hidden="true"
      className="coin-rain pointer-events-none fixed inset-0 z-[56] overflow-hidden"
    >
      {coins.map((c, i) => (
        <span
          key={i}
          style={{
            left: `${c.left}%`,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.dur}s`,
          }}
        >
          <Icon id="coin" color="#ffcc33" size={c.size} />
        </span>
      ))}
    </div>
  );
}
