import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Game, BEST_KEY } from "@/game/game";
import { Button } from "@/components/ui/button";
import { getCombatTip } from "@/lib/coach.functions";
import { GAME_VERSION, CHANGELOG } from "@/game/version";
import { getLatestVersion } from "@/lib/version.functions";
import { sfx } from "@/game/audio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Piksel Qal'a — retro top-down RPG" },
      {
        name: "description",
        content: "Brauzerda 2D piksel uslubidagi RPG: dushmanlarni yeng va Bossni mag'lub et.",
      },
      { property: "og:title", content: "Piksel Qal'a — retro RPG" },
      { property: "og:description", content: "Bitta xona, 3 xil dushman va kuchli Boss." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [muted, setMuted] = useState(sfx.muted);
  const [best, setBest] = useState(0);
  const [touch, setTouch] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const startedRef = useRef(false);
  startedRef.current = started;
  useEffect(() => {
    setReady(true);
    setMuted(sfx.loadMute());
    try {
      setBest(Number(localStorage.getItem(BEST_KEY)) || 0);
    } catch {
      /* saqlash imkonsiz */
    }
    setTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // Avtomatik yangilanish: yangi versiya chiqsa menyuda darhol, o'yinda esa so'rab yangilanadi.
  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const r = await getLatestVersion();
        if (!alive || r.version === GAME_VERSION) return;
        if (!startedRef.current) window.location.reload();
        else setNewVersion(r.version);
      } catch {
        /* tarmoq xatosi — keyingi tekshiruvda */
      }
    }
    const id = window.setInterval(check, 60_000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!started || !canvasRef.current) return;
    const g = new Game(canvasRef.current);
    gameRef.current = g;
    setGame(g);
    if (import.meta.env.DEV) (window as unknown as { __game?: Game }).__game = g;
    g.start();
    return () => g.stop();
  }, [started]);

  return (
    <main className="game-viewport font-pixel">
      <div className="game-screen">
        <canvas ref={canvasRef} width={960} height={540} className="game-canvas" />
        {!started && (
          <div className="game-menu absolute inset-0 flex flex-col items-center justify-center gap-6 bg-card/95 text-center px-4">
            <h1 className="text-primary text-lg sm:text-2xl">PIKSEL QAL'A</h1>
            <p className="text-foreground text-xs sm:text-sm leading-6">
              {touch ? (
                <>
                  Chap doira — yurish
                  <br />
                  ZARBA — hujum, DASH — sirpanish
                </>
              ) : (
                <>
                  WASD / strelkalar — yurish
                  <br />
                  Space / J — hujum
                  <br />
                  Shift / K — dash
                  <br />
                  Esc — pauza, M — ovoz
                </>
              )}
            </p>
            <p className="text-muted-foreground text-[9px] sm:text-[10px] leading-5">
              5 to'lqin · har to'lqindan so'ng kuch tanlang · oxirida Boss
              {best > 0 && (
                <>
                  <br />
                  <span className="text-primary">Rekord: {best}</span>
                </>
              )}
            </p>
            <Button
              onClick={() => {
                sfx.unlock();
                setStarted(true);
              }}
              disabled={!ready}
              className="bg-primary text-primary-foreground px-6 py-3 text-xs sm:text-sm hover:brightness-110 active:translate-y-0.5 disabled:opacity-60 disabled:cursor-wait"
            >
              {ready ? "BOSHLASH" : "YUKLANMOQDA..."}
            </Button>
            <Button
              variant="link"
              onClick={() => setChangelogOpen(true)}
              className="text-[9px] sm:text-[10px] text-muted-foreground hover:text-foreground underline"
            >
              Yangilanishlar
            </Button>
            <Button
              variant="link"
              onClick={() => setCoachOpen(true)}
              className="text-[9px] sm:text-[10px] text-muted-foreground"
            >
              Jang maslahatchisi (AI)
            </Button>
            <button
              onClick={() => {
                sfx.unlock();
                setMuted(sfx.toggleMute());
              }}
              aria-label={muted ? "Ovozni yoqish" : "Ovozni o'chirish"}
              className="absolute bottom-2 left-2 text-sm sm:text-base"
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <span className="absolute bottom-2 right-2 text-[8px] sm:text-[9px] text-foreground/50">
              v{GAME_VERSION}
            </span>
          </div>
        )}
      </div>
      {started && touch && game && <TouchControls game={game} />}
      {newVersion && (
        <div className="fixed bottom-2 left-1/2 -translate-x-1/2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-2 border-primary bg-card px-3 py-2 text-[9px] sm:text-[10px] text-foreground max-w-full">
          Yangi versiya v{newVersion} tayyor
          <button
            onClick={() => window.location.reload()}
            className="bg-primary text-primary-foreground px-3 py-1 hover:brightness-110"
          >
            YANGILASH
          </button>
        </div>
      )}
      <div hidden={!coachOpen} className="fixed inset-0 z-50 bg-letterbox/70 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Jang maslahatchisi"
          className="absolute inset-4 m-auto h-fit max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto bg-card p-4"
        >
          <Button variant="ghost" onClick={() => setCoachOpen(false)} className="mb-3 text-[10px]">
            YOPISH
          </Button>
          <CoachPanel />
        </div>
      </div>
      {changelogOpen && <ChangelogWindow onClose={() => setChangelogOpen(false)} />}
    </main>
  );
}

function TouchControls({ game }: { game: Game }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const move = (e: RPointerEvent) => {
    const el = baseRef.current;
    if (!el || pointer.current !== e.pointerId) return;
    const r = el.getBoundingClientRect();
    const R = r.width / 2;
    let dx = e.clientX - (r.left + R),
      dy = e.clientY - (r.top + R);
    const l = Math.hypot(dx, dy);
    if (l > R) {
      dx = (dx / l) * R;
      dy = (dy / l) * R;
    }
    setKnob({ x: dx, y: dy });
    const ax = dx / R,
      ay = dy / R;
    game.input.setTouchAxis(Math.abs(ax) > 0.25 ? ax : 0, Math.abs(ay) > 0.25 ? ay : 0);
  };
  const end = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    game.input.setTouchAxis(0, 0);
  };
  const btn =
    "flex items-center justify-center rounded-full border-2 border-primary/70 bg-card/60 text-primary select-none active:bg-primary/40";

  return (
    <div className="pointer-events-none fixed inset-0 z-40 touch-none select-none">
      <div
        ref={baseRef}
        className="pointer-events-auto absolute bottom-6 left-6 h-32 w-32 rounded-full border-2 border-foreground/30 bg-card/30"
        onPointerDown={(e) => {
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div
          className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-foreground/40"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
      </div>
      <button
        aria-label="Hujum"
        className={`${btn} pointer-events-auto absolute bottom-8 right-6 h-20 w-20 text-[10px]`}
        onPointerDown={(e) => {
          e.preventDefault();
          game.input.pressAttack();
        }}
      >
        ZARBA
      </button>
      <button
        aria-label="Dash"
        className={`${btn} pointer-events-auto absolute bottom-32 right-24 h-14 w-14 text-[8px]`}
        onPointerDown={(e) => {
          e.preventDefault();
          game.input.pressDash();
        }}
      >
        DASH
      </button>
      <button
        aria-label="Pauza"
        className={`${btn} pointer-events-auto absolute right-3 top-3 h-10 w-10 text-[10px]`}
        onPointerDown={(e) => {
          e.preventDefault();
          game.input.pressPause();
        }}
      >
        II
      </button>
    </div>
  );
}

function ChangelogWindow({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-[min(92vw,480px)] max-h-[80vh] overflow-y-auto border-4 border-border bg-card p-4 text-[10px] sm:text-xs leading-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-primary mb-3">YANGILANISHLAR</h2>
        <ul className="flex flex-col gap-3">
          {CHANGELOG.map((entry) => (
            <li key={entry.version}>
              <p className="text-foreground">
                v{entry.version} <span className="text-muted-foreground">— {entry.date}</span>
              </p>
              <p className="text-muted-foreground">{entry.notes}</p>
            </li>
          ))}
        </ul>
        <button
          onClick={onClose}
          className="mt-4 bg-primary text-primary-foreground px-4 py-2 hover:brightness-110"
        >
          YOPISH
        </button>
      </div>
    </div>
  );
}

function CoachPanel() {
  const [enemy, setEnemy] = useState<"slime" | "bat" | "skeleton" | "boss">("boss");
  const [problem, setProblem] = useState("");
  const [tip, setTip] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask() {
    setLoading(true);
    setError("");
    setTip("");
    try {
      const r = await getCombatTip({ data: { enemy, problem } });
      if (r.ok) setTip(r.text);
      else setError(r.error);
    } catch {
      setError("Maslahat olishda xato yuz berdi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="w-full min-w-0 flex flex-col gap-3 text-[10px] sm:text-xs leading-5">
      <h2 className="text-primary">JANG MASLAHATCHISI (AI)</h2>
      <label className="flex flex-col gap-1 text-foreground">
        Kim bilan qiynalyapsiz?
        <select
          value={enemy}
          onChange={(e) => setEnemy(e.target.value as typeof enemy)}
          className="bg-background text-foreground border-2 border-border p-2"
        >
          <option value="slime">Slime</option>
          <option value="bat">Ko'rshapalak</option>
          <option value="skeleton">Skelet jangchi</option>
          <option value="boss">Boss (iblis)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-foreground">
        Nima qiyin? (ixtiyoriy)
        <textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value.slice(0, 500))}
          rows={2}
          placeholder="Masalan: bolta zarbasidan qochib ulgurmayapman"
          className="bg-background text-foreground border-2 border-border p-2 resize-none"
        />
      </label>
      <button
        onClick={ask}
        disabled={loading}
        className="self-start bg-primary text-primary-foreground px-4 py-2 hover:brightness-110 disabled:opacity-60 disabled:cursor-wait"
      >
        {loading ? "O'YLAYAPTI..." : "MASLAHAT OLISH"}
      </button>
      {error && <p className="text-destructive">{error}</p>}
      {tip && <p className="text-foreground whitespace-pre-wrap">{tip}</p>}
    </section>
  );
}
