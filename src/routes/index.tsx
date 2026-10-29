import { createFileRoute } from "@tanstack/react-router";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as RPointerEvent,
} from "react";
import { Game } from "@/game/game";
import type { World } from "@/game/waves";
import { MapState, WorldMap, renderMap } from "@/game/map";
import {
  SCENE_H,
  SCENE_W,
  drawForestCard,
  drawHunterCard,
  renderMenuScene,
} from "@/game/menuScene";
import { migrateSave } from "@/game/save";
import {
  HEROES,
  HERO_NAMES,
  HERO_THEME,
  bestKeys,
  loadHero,
  saveHero,
  withAlpha,
  type Hero,
} from "@/game/hero";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pixelFocus, pixelPress } from "@/lib/pixel-ui";
import { getCombatTip } from "@/lib/coach.functions";
import { GAME_VERSION, CHANGELOG, SEEN_VERSION_KEY } from "@/game/version";
import { getLatestVersion } from "@/lib/version.functions";
import { sfx } from "@/game/audio";
import { loadSettings, saveSettings, type Settings } from "@/game/settings";
import { SHOP_ITEMS, buy, loadGold, loadShop, nextCost, type ShopItem } from "@/game/shop";
import { renderSprite, renderUpgradeIcon } from "@/game/sprites";
import { ACHIEVEMENTS, loadAchievements } from "@/game/achievements";
import { loadDaily, todayKey, type DailyResult } from "@/game/daily";
import { RealmClient } from "@/realm/client";

/** Telegram Mini App API (faqat Telegram ichida mavjud) */
interface TelegramWebApp {
  ready?: () => void;
  expand?: () => void;
  disableVerticalSwipes?: () => void;
  requestFullscreen?: () => void;
  lockOrientation?: () => void;
}

/** Telegram ichida: to'liq ekran, pastga tortib yopish o'chiq, gorizontal holat. Tashqarida — hech narsa. */
function initTelegram() {
  const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
  if (!tg) return;
  for (const f of [
    tg.ready,
    tg.expand,
    tg.disableVerticalSwipes,
    tg.requestFullscreen,
    tg.lockOrientation,
  ]) {
    try {
      f?.call(tg);
    } catch {
      /* eski Telegram versiyasi */
    }
  }
}

/** BOSHLASH bosilganda (foydalanuvchi bosishi ichida): to'liq ekran va gorizontal qulf. iOS'da jim o'tadi. */
async function enterLandscape() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
  } catch {
    /* qo'llanmaydi */
  }
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.("landscape");
  } catch {
    /* qo'llanmaydi — aylantirish oynasi zaxira */
  }
}

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [gold, setGold] = useState(0);
  const [coachOpen, setCoachOpen] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [muted, setMuted] = useState(sfx.muted);
  const [best, setBest] = useState(0);
  const [endlessBest, setEndlessBest] = useState(0);
  const [ch2Best, setCh2Best] = useState(0);
  const [touch, setTouch] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [hero, setHero] = useState<Hero>("knight");
  const [daily, setDaily] = useState<DailyResult | null>(null);
  const [achOpen, setAchOpen] = useState(false);
  const [achCount, setAchCount] = useState(0);
  const [newsOpen, setNewsOpen] = useState(false);
  /** Sarguzasht xaritasi ochiq (BOSHLASH dan keyin dunyo tanlanadi) */
  const [mapOpen, setMapOpen] = useState(false);
  const [world, setWorld] = useState<World>(1);
  /** Abadiyat olami (sinov): ochiq olam rejimi */
  const [realm, setRealm] = useState(false);
  const [realmClient, setRealmClient] = useState<RealmClient | null>(null);
  /** Kunlik sinov sanasi (oddiy o'yinda null) */
  const dailyRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  // olamda ham avtomatik yangilanish so'rab qilinadi
  startedRef.current = started || realm;
  useEffect(() => {
    // eski versiya ma'lumotlari (rekord, oltin, do'kon, yutuqlar) saqlanadi, xarita uchun to'ldiriladi
    migrateSave();
    setReady(true);
    setMuted(sfx.loadMute());
    setHero(loadHero());
    setDaily(loadDaily());
    setAchCount(loadAchievements().size);
    try {
      setGold(loadGold());
      // yangi versiyaga birinchi kirishda — oxirgi yangiliklar bir marta
      if (localStorage.getItem(SEEN_VERSION_KEY) !== GAME_VERSION) {
        localStorage.setItem(SEEN_VERSION_KEY, GAME_VERSION);
        setNewsOpen(true);
      }
    } catch {
      /* saqlash imkonsiz */
    }
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    // skript hali yuklanmagan bo'lsa — sahifa yuklangach
    if (document.readyState === "complete") initTelegram();
    else window.addEventListener("load", initTelegram, { once: true });
  }, []);

  // Sensorli qurilmada vertikal holat: "aylantiring" oynasi, o'yin pauzada
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    if (!touch) return;
    const mq = window.matchMedia("(orientation: portrait)");
    const on = () => setPortrait(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [touch]);
  useEffect(() => {
    // gorizontalga qaytganda pauza menyusi qoladi — o'yinchi o'zi davom ettiradi
    if (portrait) game?.setPaused(true);
    if (portrait && realmClient && realmClient.view.panel === "none") realmClient.setPanel("pause");
  }, [portrait, game, realmClient]);

  // o'yin paytida ikki marta bosib kattalashtirish va pastga tortib yangilash o'chiq
  useEffect(() => {
    document.documentElement.classList.toggle("in-game", started || realm);
    return () => document.documentElement.classList.remove("in-game");
  }, [started, realm]);

  // Rekordlar tanlangan qahramonniki
  useEffect(() => {
    try {
      const keys = bestKeys(hero);
      setBest(Number(localStorage.getItem(keys.best)) || 0);
      setEndlessBest(Number(localStorage.getItem(keys.endless)) || 0);
      setCh2Best(Number(localStorage.getItem(keys.ch2)) || 0);
    } catch {
      /* saqlash imkonsiz */
    }
  }, [hero]);

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
    const g = new Game(
      canvasRef.current,
      hero,
      dailyRef.current ? { daily: dailyRef.current } : { world },
    );
    g.touch = touch;
    g.onExit = () => {
      setBest(g.best);
      setEndlessBest(g.endlessBest);
      setCh2Best(g.ch2Best);
      setGold(loadGold());
      setDaily(loadDaily());
      setAchCount(loadAchievements().size);
      setGame(null);
      setStarted(false);
    };
    gameRef.current = g;
    setGame(g);
    if (import.meta.env.DEV) (window as unknown as { __game?: Game }).__game = g;
    g.start();
    return () => g.stop();
    // qahramon faqat menyuda o'zgaradi — o'yin davomida qayta yaratilmaydi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, touch]);

  // Abadiyat olami: o'sha canvas'da alohida klient (o'z saqlanishi bilan)
  useEffect(() => {
    if (!realm || !canvasRef.current) return;
    const c = new RealmClient(canvasRef.current, hero);
    c.touch = touch;
    c.onExit = () => {
      setRealmClient(null);
      setRealm(false);
    };
    setRealmClient(c);
    if (import.meta.env.DEV) (window as unknown as { __realm?: RealmClient }).__realm = c;
    c.start();
    return () => c.stop();
    // qahramon faqat menyuda o'zgaradi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realm, touch]);

  return (
    <main className="game-viewport font-pixel">
      <div className="game-screen">
        <canvas ref={canvasRef} width={960} height={540} className="game-canvas" />
        {mapOpen && !started && !realm && canvasRef.current && (
          <MapScreen
            canvas={canvasRef.current}
            hero={hero}
            touch={touch}
            onBack={() => setMapOpen(false)}
            onEnter={(w) => {
              sfx.unlock();
              dailyRef.current = null;
              setWorld(w);
              setMapOpen(false);
              setStarted(true);
            }}
          />
        )}
        {!started && !mapOpen && !realm && (
          <div
            className="game-menu absolute inset-0 isolate flex flex-col items-center justify-center gap-6 overflow-hidden bg-card text-center px-4"
            style={{ textShadow: "1px 1px 0 #000" }}
          >
            <MenuScene />
            <h1 className="text-primary text-lg sm:text-2xl drop-shadow-[2px_2px_0_#000]">
              PIKSEL QAL'A
            </h1>
            {/* 10 tagacha qahramon: sig'masa gorizontal aylanadi */}
            <div
              aria-label="Qahramon tanlash"
              className="hero-row flex max-w-full snap-x gap-3 overflow-x-auto p-1"
            >
              {HEROES.map((h) => (
                <button
                  key={h}
                  aria-pressed={hero === h}
                  onClick={() => {
                    setHero(h);
                    saveHero(h);
                  }}
                  style={
                    hero === h
                      ? {
                          borderColor: HERO_THEME[h].accent,
                          background: withAlpha(HERO_THEME[h].accent, 0.15),
                          color: HERO_THEME[h].uiText,
                        }
                      : undefined
                  }
                  className={`flex shrink-0 snap-center flex-col items-center gap-1 border-2 px-3 py-2 text-[9px] sm:text-[10px] ${pixelPress} ${pixelFocus} ${
                    hero === h
                      ? ""
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  <HeroPreview hero={h} active={hero === h} />
                  {HERO_NAMES[h]}
                </button>
              ))}
            </div>
            <p className="text-foreground text-xs sm:text-sm leading-6">
              {touch ? (
                <>
                  Chap doira — yurish
                  <br />
                  {hero === "mage"
                    ? "SHAR — sehrli shar, TELEPORT — sakrash"
                    : hero === "hunter"
                      ? "O'Q — o'q otish, SAKRASH — orqaga sakrash"
                      : "ZARBA — hujum, DASH — sirpanish"}
                  <br />
                  {hero === "mage"
                    ? "SHAR ni bosib turing — sehrli halqa"
                    : hero === "hunter"
                      ? "O'Q ni bosib turing — teshuvchi o'q, SAKRASH ni — tuzoq"
                      : "ZARBA ni bosib turing — aylana zarba"}
                </>
              ) : (
                <>
                  WASD / strelkalar — yurish
                  <br />
                  Space / J —{" "}
                  {hero === "mage" ? "sehrli shar" : hero === "hunter" ? "o'q" : "hujum"}
                  <br />
                  Space ni bosib turish —{" "}
                  {hero === "mage"
                    ? "sehrli halqa"
                    : hero === "hunter"
                      ? "teshuvchi o'q"
                      : "aylana zarba"}
                  <br />
                  Shift / K —{" "}
                  {hero === "mage"
                    ? "teleport"
                    : hero === "hunter"
                      ? "orqaga sakrash, bosib turish — tuzoq"
                      : "dash"}
                  <br />
                  Esc — pauza, M — ovoz
                </>
              )}
            </p>
            <p className="text-muted-foreground text-[9px] sm:text-[10px] leading-5">
              5 to'lqin · har to'lqindan so'ng kuch tanlang · oxirida Boss
              <br />
              Xaritada dunyolar: har birining o'z dushmanlari va Bossi
              {best > 0 && (
                <>
                  <br />
                  <span className="text-primary">Rekord: {best}</span>
                </>
              )}
              {ch2Best > 0 && (
                <>
                  <br />
                  <span className="text-[#9fd0ef]">❄ 2-dunyo yutilgan rekord: {ch2Best}</span>
                </>
              )}
              {endlessBest > 0 && (
                <>
                  <br />
                  <span className="text-primary">Cheksiz rekord: {endlessBest}</span>
                </>
              )}
              <br />
              <span className="inline-flex items-center gap-1 text-primary">
                <PixelIcon id="coin" color="#ffcc33" size={12} />
                Oltin: {gold}
              </span>
            </p>
            <Button
              onClick={() => {
                sfx.unlock();
                if (touch) void enterLandscape();
                setMapOpen(true);
              }}
              disabled={!ready}
              variant="pixel"
              className="px-6 py-3 text-xs sm:text-sm disabled:opacity-60 disabled:cursor-wait"
            >
              {ready ? "BOSHLASH" : "YUKLANMOQDA..."}
            </Button>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                onClick={() => setShopOpen(true)}
                disabled={!ready}
                variant="pixelOutline"
                className="px-5 py-2 text-[10px] sm:text-xs"
              >
                DO'KON
              </Button>
              <Button
                onClick={() => {
                  sfx.unlock();
                  if (touch) void enterLandscape();
                  dailyRef.current = todayKey();
                  setStarted(true);
                }}
                disabled={!ready || !!daily}
                title={daily ? "Bugungi urinish ishlatilgan — ertaga yangi sinov" : undefined}
                variant="pixelOutline"
                className="px-5 py-2 text-[10px] sm:text-xs"
              >
                {daily ? `KUNLIK: ${daily.score}` : "KUNLIK SINOV"}
              </Button>
              <Button
                onClick={() => {
                  sfx.unlock();
                  if (touch) void enterLandscape();
                  setRealm(true);
                }}
                disabled={!ready}
                title="Kelajakdagi ko'p o'yinchili ochiq olamning sinov versiyasi"
                variant="pixelOutline"
                className="px-5 py-2 text-[10px] sm:text-xs"
              >
                OLAM (SINOV)
              </Button>
            </div>
            {daily && (
              <p className="text-muted-foreground text-[9px] sm:text-[10px] leading-5">
                Bugungi sinov: {daily.score} ochko ·{" "}
                {daily.won ? "yutildi" : `${daily.wave}-to'lqin`} · ertaga yana
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-x-4">
              <Button
                variant="pixelLink"
                onClick={() => setSettingsOpen(true)}
                className="text-[9px] sm:text-[10px]"
              >
                SOZLAMALAR
              </Button>
              <Button
                variant="pixelLink"
                onClick={() => setAchOpen(true)}
                className="text-[9px] sm:text-[10px]"
              >
                YUTUQLAR {achCount}/{ACHIEVEMENTS.length}
              </Button>
              <Button
                variant="pixelLink"
                onClick={() => setChangelogOpen(true)}
                className="text-[9px] sm:text-[10px]"
              >
                Yangilanishlar
              </Button>
              <Button
                variant="pixelLink"
                onClick={() => setCoachOpen(true)}
                className="text-[9px] sm:text-[10px]"
              >
                Jang maslahatchisi (AI)
              </Button>
            </div>
            <button
              onClick={() => {
                sfx.unlock();
                setMuted(sfx.toggleMute());
              }}
              aria-label={muted ? "Ovozni yoqish" : "Ovozni o'chirish"}
              className={`absolute bottom-2 left-2 text-sm sm:text-base ${pixelFocus}`}
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
      {realm && touch && realmClient && (
        <>
          <TouchControls game={realmClient} />
          <RealmTouchButtons client={realmClient} />
        </>
      )}
      {touch && portrait && <RotateOverlay />}
      {newVersion && (
        <div className="fixed bottom-2 left-1/2 -translate-x-1/2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-2 border-primary bg-card px-3 py-2 text-[9px] sm:text-[10px] text-foreground max-w-full">
          Yangi versiya v{newVersion} tayyor
          <button
            onClick={() => window.location.reload()}
            className={cn(buttonVariants({ variant: "pixel", size: "none" }), "px-3 py-1")}
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
          <Button
            variant="pixel"
            size="none"
            onClick={() => setCoachOpen(false)}
            className="mb-3 px-4 py-2 text-[10px]"
          >
            YOPISH
          </Button>
          <CoachPanel hero={hero} />
        </div>
      </div>
      {changelogOpen && <ChangelogWindow onClose={() => setChangelogOpen(false)} />}
      {achOpen && <AchievementsWindow onClose={() => setAchOpen(false)} />}
      {newsOpen && !started && <NewsWindow hero={hero} onClose={() => setNewsOpen(false)} />}
      {settingsOpen && <SettingsWindow onClose={() => setSettingsOpen(false)} />}
      {shopOpen && (
        <ShopWindow
          onClose={() => {
            setShopOpen(false);
            setGold(loadGold());
          }}
        />
      )}
    </main>
  );
}

/** Sensor boshqaruvi ishlatadigan qism: Game yoki olam klienti (RealmClient) */
type TouchTarget = Pick<Game, "input" | "player" | "hero">;

function TouchControls({ game }: { game: TouchTarget }) {
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
  // tugmalar tanlangan qahramon rangida (hero.ts: HERO_THEME)
  const theme = HERO_THEME[game.hero];
  const vars = {
    "--hero-border": withAlpha(theme.accent, 0.7),
    "--hero-text": theme.uiText,
    "--hero-press": withAlpha(theme.accent, 0.4),
  } as CSSProperties;
  const btn =
    "flex items-center justify-center rounded-full border-2 border-[color:var(--hero-border)] bg-card/60 text-[color:var(--hero-text)] select-none active:bg-[color:var(--hero-press)]";

  return (
    <div
      className="touch-controls pointer-events-none fixed inset-0 z-40 touch-none select-none"
      style={vars}
    >
      <div
        ref={baseRef}
        className="touch-stick pointer-events-auto absolute rounded-full border-2 border-foreground/30 bg-card/30"
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
        aria-label={game.player.mage ? "Sehrli shar" : game.player.hunter ? "O'q" : "Hujum"}
        className={`${btn} touch-attack pointer-events-auto absolute text-[10px]`}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          game.input.pressAttack();
          game.input.setTouchAttack(true);
        }}
        onPointerUp={() => game.input.setTouchAttack(false)}
        onPointerCancel={() => game.input.setTouchAttack(false)}
      >
        {game.player.mage ? "SHAR" : game.player.hunter ? "O'Q" : "ZARBA"}
      </button>
      <button
        aria-label={game.player.mage ? "Teleport" : game.player.hunter ? "Sakrash" : "Dash"}
        className={`${btn} touch-dash pointer-events-auto absolute ${game.player.mage || game.player.hunter ? "text-[6px]" : "text-[8px]"}`}
        onPointerDown={(e) => {
          e.preventDefault();
          // Ovchi: bosib turilsa tuzoq qo'yadi
          e.currentTarget.setPointerCapture(e.pointerId);
          game.input.pressDash();
          game.input.setTouchDash(true);
        }}
        onPointerUp={() => game.input.setTouchDash(false)}
        onPointerCancel={() => game.input.setTouchDash(false)}
      >
        {game.player.mage ? (
          "TELEPORT"
        ) : game.player.hunter ? (
          <span className="flex flex-col items-center leading-[9px]">
            SAKRASH
            <span className="text-[5px] opacity-80">tursa: tuzoq</span>
          </span>
        ) : (
          "DASH"
        )}
      </button>
      <button
        aria-label="Pauza"
        className={`${btn} touch-pause pointer-events-auto absolute text-[10px]`}
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

/** Olamdagi qo'shimcha sensor tugmalari: gaplashish, jurnal, xarita. */
function RealmTouchButtons({ client }: { client: RealmClient }) {
  const theme = HERO_THEME[client.hero];
  const vars = {
    "--hero-border": withAlpha(theme.accent, 0.7),
    "--hero-text": theme.uiText,
    "--hero-press": withAlpha(theme.accent, 0.4),
  } as CSSProperties;
  const btn =
    "pointer-events-auto absolute flex items-center justify-center rounded-full border-2 border-[color:var(--hero-border)] bg-card/60 text-[color:var(--hero-text)] select-none active:bg-[color:var(--hero-press)]";
  const tap = (f: () => void) => (e: RPointerEvent) => {
    e.preventDefault();
    sfx.unlock();
    f();
  };
  return (
    <div
      className="touch-controls pointer-events-none fixed inset-0 z-40 touch-none select-none"
      style={vars}
    >
      <button
        aria-label="Gaplashish"
        className={`${btn} touch-interact text-[7px]`}
        onPointerDown={tap(() => client.pressInteract())}
      >
        GAPLASH
      </button>
      <button
        aria-label="Topshiriqlar jurnali"
        className={`${btn} touch-journal text-[6px]`}
        onPointerDown={tap(() => client.toggleJournal())}
      >
        JURNAL
      </button>
      <button
        aria-label="Xarita"
        className={`${btn} touch-map text-[6px]`}
        onPointerDown={tap(() => client.toggleMap())}
      >
        XARITA
      </button>
    </div>
  );
}

/** Vertikal telefon: butun ekranli "aylantiring" oynasi (o'yin shu paytda pauzada). */
function RotateOverlay() {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Telefonni aylantiring"
      className="font-pixel fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-card px-6 text-center"
      style={{ textShadow: "1px 1px 0 #000" }}
    >
      <svg
        className="rotate-phone"
        width={96}
        height={96}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        <rect x={5} y={1} width={6} height={14} fill="#e0d6ee" />
        <rect x={6} y={2} width={4} height={10} fill="#1f1730" />
        <rect x={7} y={13} width={2} height={1} fill="#5c4a6e" />
        <rect x={7} y={4} width={2} height={2} fill="#ffcc33" />
      </svg>
      <h2 className="text-primary text-sm leading-6">TELEFONNI AYLANTIRING</h2>
      <p className="text-foreground text-[10px] leading-5">O'yin gorizontal holatda o'ynaladi</p>
    </div>
  );
}

/** Bosh menyu foni: qasr, oy, yulduzlar, qahramonlar va moblar — sekin animatsiya. */
function MenuScene() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const loop = (now: number) => {
      // ~30 kadr/s yetarli — sahna sekin harakatlanadi
      if (now - last > 33) {
        last = now;
        renderMenuScene(c, (now - start) / 1000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <>
      <canvas
        ref={ref}
        width={SCENE_W}
        height={SCENE_H}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
        style={{ imageRendering: "pixelated" }}
      />
      {/* matn o'qilishi uchun markazda qorong'i, chetlarda sahna ochiq */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 40% 58% at 50% 48%, rgba(12,8,24,0.74) 0%, rgba(12,8,24,0.55) 60%, rgba(12,8,24,0.08) 100%)",
        }}
      />
    </>
  );
}

/** Menyudagi qahramon rasmi: kod bilan chizilgan sprite, tanlanganda "nafas oladi". */
function HeroPreview({ hero, active }: { hero: Hero; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return setFrame(0);
    const id = window.setInterval(() => setFrame((f) => (f + 1) % 2), 500);
    return () => window.clearInterval(id);
  }, [active]);
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, 32, 32);
    renderSprite(c, hero, "idle", frame, 16, 16, false);
  }, [hero, frame]);
  return (
    <canvas
      ref={ref}
      width={32}
      height={32}
      aria-hidden="true"
      style={{ width: 48, height: 48, imageRendering: "pixelated" }}
    />
  );
}

/** Kuch kartalaridagi 12x12 piksel ikonka — kod bilan chiziladi. */
function PixelIcon({ id, color, size }: { id: string; color: string; size: number }) {
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
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    />
  );
}

function ShopWindow({ onClose }: { onClose: () => void }) {
  const [gold, setGold] = useState(loadGold);
  const [levels, setLevels] = useState(loadShop);
  const purchase = (item: ShopItem) => {
    sfx.unlock();
    if (!buy(item.id)) return;
    sfx.upgrade();
    setGold(loadGold());
    setLevels(loadShop());
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Do'kon"
        className="flex w-[min(94vw,640px)] max-h-[90dvh] flex-col gap-3 overflow-y-auto border-4 border-border bg-card p-4 text-[9px] sm:text-[10px] leading-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-primary text-xs sm:text-sm">DO'KON</h2>
          <span className="inline-flex items-center gap-2 text-primary">
            <PixelIcon id="coin" color="#ffcc33" size={16} />
            {gold}
          </span>
        </div>
        <p className="text-muted-foreground">
          Doimiy kuchaytirishlar har yangi o'yin boshida beriladi.
        </p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SHOP_ITEMS.map((item) => {
            const lvl = levels[item.id];
            const cost = nextCost(item, levels);
            const canBuy = cost !== null && gold >= cost;
            return (
              <li
                key={item.id}
                className="flex flex-col items-center gap-2 p-[2px]"
                style={{ background: canBuy ? item.color : "#5c4a6e" }}
              >
                <div className="flex w-full flex-1 flex-col items-center gap-2 bg-[#1f1730] p-2 text-center">
                  <PixelIcon id={item.icon} color={item.color} size={36} />
                  <span style={{ color: item.color }}>{item.name}</span>
                  <span className="flex-1 text-foreground">{item.desc}</span>
                  <span className="flex gap-1" aria-label={`Bosqich ${lvl}/${item.costs.length}`}>
                    {item.costs.map((_, i) => (
                      <span
                        key={i}
                        className="h-2 w-2"
                        style={{ background: i < lvl ? item.color : "#3b2a3a" }}
                      />
                    ))}
                  </span>
                  <button
                    onClick={() => purchase(item)}
                    disabled={!canBuy}
                    className={cn(
                      buttonVariants({ variant: "pixel", size: "none" }),
                      "w-full gap-1 px-2 py-1 disabled:border-border disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-100",
                    )}
                  >
                    {cost === null ? (
                      "TO'LIQ"
                    ) : (
                      <>
                        <PixelIcon id="coin" color="#ffcc33" size={10} />
                        {cost}
                      </>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <button
          onClick={onClose}
          className={cn(buttonVariants({ variant: "pixel", size: "none" }), "self-start px-4 py-2")}
        >
          YOPISH
        </button>
      </div>
    </div>
  );
}

function SettingsWindow({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<Settings>(loadSettings);
  const update = (patch: Partial<Settings>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveSettings(next);
    sfx.setVolumes(next.music, next.sfx);
  };
  const slider = (key: "music" | "sfx", label: string, preview: () => void) => (
    <label className="flex flex-col gap-2 text-foreground">
      <span>
        {label}: <span className="text-primary">{s[key]}</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={s[key]}
        aria-label={label}
        onChange={(e) => update({ [key]: Number(e.target.value) })}
        onPointerUp={() => {
          sfx.unlock();
          preview();
        }}
        className="w-full accent-primary"
      />
    </label>
  );
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sozlamalar"
        className="flex w-[min(92vw,420px)] flex-col gap-4 border-4 border-border bg-card p-4 text-[10px] sm:text-xs leading-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-primary">SOZLAMALAR</h2>
        {slider("music", "Musiqa ovozi", () => sfx.wave())}
        {slider("sfx", "Effektlar ovozi", () => sfx.pickup())}
        <div className="flex items-center justify-between gap-3 text-foreground">
          Ekran silkinishi
          <button
            role="switch"
            aria-checked={s.shake}
            onClick={() => update({ shake: !s.shake })}
            className={`min-w-20 border-2 px-3 py-1 ${pixelPress} ${pixelFocus} ${
              s.shake
                ? "border-primary bg-primary text-primary-foreground hover:border-primary-hover hover:bg-primary-hover"
                : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
          >
            {s.shake ? "YOQIQ" : "O'CHIQ"}
          </button>
        </div>
        <button
          onClick={onClose}
          className={cn(buttonVariants({ variant: "pixel", size: "none" }), "self-start px-4 py-2")}
        >
          YOPISH
        </button>
      </div>
    </div>
  );
}

function AchievementsWindow({ onClose }: { onClose: () => void }) {
  const [got] = useState(loadAchievements);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Yutuqlar"
        className="flex w-[min(94vw,520px)] max-h-[90dvh] flex-col gap-3 overflow-y-auto border-4 border-border bg-card p-4 text-[9px] sm:text-[10px] leading-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-primary text-xs sm:text-sm">
          YUTUQLAR {got.size}/{ACHIEVEMENTS.length}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => {
            const on = got.has(a.id);
            return (
              <li
                key={a.id}
                className={`flex items-center gap-2 border-2 p-2 ${on ? "border-primary" : "border-border opacity-60"}`}
              >
                <PixelIcon id="trophy" color={on ? "#ffcc33" : "#5c4a6e"} size={24} />
                <span className="flex flex-col gap-1">
                  <span className={on ? "text-primary" : "text-foreground"}>{a.name}</span>
                  <span className="text-muted-foreground">{a.desc}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <button
          onClick={onClose}
          className={cn(buttonVariants({ variant: "pixel", size: "none" }), "self-start px-4 py-2")}
        >
          YOPISH
        </button>
      </div>
    </div>
  );
}

/** "Yangiliklar" oynasidagi rasmli karta: rasm kod bilan chiziladi. */
function NewsCard({
  title,
  text,
  width,
  height,
  draw,
}: {
  title: string;
  text: string;
  width: number;
  height: number;
  draw: (c: CanvasRenderingContext2D) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (c) draw(c);
  }, [draw]);
  return (
    <li className="flex flex-col gap-2 border-2 border-primary bg-[#1f1730] p-2">
      <canvas
        ref={ref}
        width={width}
        height={height}
        aria-hidden="true"
        className="w-full border-2 border-black"
        style={{ imageRendering: "pixelated", aspectRatio: `${width} / ${height}` }}
      />
      <span className="text-primary">{title}</span>
      <span className="text-muted-foreground text-[9px] sm:text-[10px] leading-4">{text}</span>
    </li>
  );
}

/** 2.0 e'loni: uchta katta yangilik rasmli kartalarda. */
const NEWS_2_0: readonly {
  title: string;
  text: string;
  width: number;
  height: number;
  draw: (c: CanvasRenderingContext2D, hero: Hero) => void;
}[] = [
  {
    title: "SARGUZASHT XARITASI",
    text: "3 dunyo yo'l bilan bog'langan: rekordlar, yutgan qahramonlar va qulflar.",
    width: 320,
    height: 240,
    draw: (c, hero) => renderMap(c, new MapState(), 1.2, hero),
  },
  {
    title: "3-DUNYO: ZULMAT O'RMONI",
    text: "4 ta yangi mob va O'rmon Shohi — qorong'ida faqat atrofingiz yorug'.",
    width: 160,
    height: 120,
    draw: (c) => drawForestCard(c, 1),
  },
  {
    title: "YANGI QAHRAMON: OVCHI",
    text: "O'q, teshuvchi kuchli o'q, orqaga sakrash va tuzoq.",
    width: 160,
    height: 120,
    draw: (c) => drawHunterCard(c),
  },
];

/** Yangi versiyaga birinchi kirishda: CHANGELOG'dagi oxirgi yozuv, har gap alohida qatorda. */
function NewsWindow({ onClose, hero }: { onClose: () => void; hero: Hero }) {
  const entry = CHANGELOG[0];
  if (!entry) return null;
  const big = entry.version.startsWith("2.0");
  const lines = entry.notes
    .split(/(?<=\.)\s+/)
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Yangiliklar"
        className={`flex ${big ? "w-[min(94vw,720px)]" : "w-[min(92vw,480px)]"} max-h-[85dvh] flex-col gap-3 overflow-y-auto border-4 border-primary bg-card p-4 text-[10px] sm:text-xs leading-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-primary">
          {big ? `PIKSEL QAL'A 2.0!` : "YANGILIKLAR"} · v{entry.version}
        </h2>
        {big && (
          <ul aria-label="Katta yangiliklar" className="grid gap-3 sm:grid-cols-3">
            {NEWS_2_0.map((n) => (
              <NewsCard
                key={n.title}
                title={n.title}
                text={n.text}
                width={n.width}
                height={n.height}
                draw={(c) => n.draw(c, hero)}
              />
            ))}
          </ul>
        )}
        <ul className="flex flex-col gap-2 text-foreground">
          {lines.map((l) => (
            <li key={l} className="flex gap-2">
              <span className="text-primary">▸</span>
              <span>{l}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={onClose}
          className={cn(buttonVariants({ variant: "pixel", size: "none" }), "self-start px-4 py-2")}
        >
          O'YNASH
        </button>
      </div>
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
          className={cn(buttonVariants({ variant: "pixel", size: "none" }), "mt-4 px-4 py-2")}
        >
          YOPISH
        </button>
      </div>
    </div>
  );
}

function CoachPanel({ hero }: { hero: Hero }) {
  const [enemy, setEnemy] = useState<
    | "slime"
    | "bat"
    | "skeleton"
    | "archer"
    | "boss"
    | "iceblob"
    | "frost"
    | "golem"
    | "shield"
    | "wolf"
    | "queen"
    | "spider"
    | "shroom"
    | "treant"
    | "owl"
    | "king"
  >("boss");
  const [problem, setProblem] = useState("");
  const [tip, setTip] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask() {
    setLoading(true);
    setError("");
    setTip("");
    try {
      const r = await getCombatTip({ data: { enemy, problem, hero } });
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
          <optgroup label="1-DUNYO: Olovli zindon">
            <option value="slime">Slime</option>
            <option value="bat">Ko'rshapalak</option>
            <option value="skeleton">Skelet jangchi</option>
            <option value="archer">Kamonchi skelet</option>
            <option value="boss">Boss (iblis)</option>
          </optgroup>
          <optgroup label="2-DUNYO: Muz sardobasi">
            <option value="iceblob">Muz slime</option>
            <option value="frost">Muz ruhi</option>
            <option value="golem">Qor odam</option>
            <option value="shield">Muz qalqonli skelet</option>
            <option value="wolf">Qor bo'risi</option>
            <option value="queen">Qor Malikasi (Boss)</option>
          </optgroup>
          <optgroup label="3-DUNYO: Zulmat o'rmoni">
            <option value="spider">O'rmon o'rgimchagi</option>
            <option value="shroom">Zaharli qo'ziqorin</option>
            <option value="treant">Daraxt odam</option>
            <option value="owl">Tungi boyo'g'li</option>
            <option value="king">O'rmon Shohi (Boss)</option>
          </optgroup>
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
        className={cn(
          buttonVariants({ variant: "pixel", size: "none" }),
          "self-start px-4 py-2 disabled:opacity-60 disabled:cursor-wait",
        )}
      >
        {loading ? "O'YLAYAPTI..." : "MASLAHAT OLISH"}
      </button>
      {error && <p className="text-destructive">{error}</p>}
      {tip && <p className="text-foreground whitespace-pre-wrap">{tip}</p>}
    </section>
  );
}

/** Sarguzasht xaritasi: o'yin canvasida chiziladi, pastda sensor/sichqoncha uchun tugmalar. */
function MapScreen({
  canvas,
  hero,
  touch,
  onEnter,
  onBack,
}: {
  canvas: HTMLCanvasElement;
  hero: Hero;
  touch: boolean;
  onEnter: (w: World) => void;
  onBack: () => void;
}) {
  const mapRef = useRef<WorldMap | null>(null);
  const enterRef = useRef(onEnter);
  const backRef = useRef(onBack);
  enterRef.current = onEnter;
  backRef.current = onBack;
  useEffect(() => {
    const m = new WorldMap(canvas, hero);
    m.touch = touch;
    m.onEnter = (w) => enterRef.current(w as World);
    m.onBack = () => backRef.current();
    mapRef.current = m;
    if (import.meta.env.DEV) (window as unknown as { __map?: WorldMap }).__map = m;
    m.start();
    return () => {
      m.stop();
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [canvas, hero, touch]);
  const btn = cn(
    buttonVariants({ variant: "pixelOutline", size: "none" }),
    "w-[10%] min-w-10 py-2 text-[7px] sm:text-[10px]",
  );
  // xona 4:3 — 16:9 ekranning chap va o'ng chetidagi bo'sh joyda tugmalar
  return (
    <div aria-label="Sarguzasht xaritasi" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-y-0 left-[1%] flex w-[10.5%] flex-col items-center justify-center gap-3">
        <button className={cn(btn, "pointer-events-auto w-full")} onClick={onBack}>
          ORQAGA
        </button>
        <button
          aria-label="Chapdagi dunyo"
          className={cn(btn, "pointer-events-auto w-full")}
          onClick={() => mapRef.current?.move(-1)}
        >
          {"<"}
        </button>
      </div>
      <div className="absolute inset-y-0 right-[1%] flex w-[10.5%] flex-col items-center justify-center gap-3">
        <button
          aria-label="O'ngdagi dunyo"
          className={cn(btn, "pointer-events-auto w-full")}
          onClick={() => mapRef.current?.move(1)}
        >
          {">"}
        </button>
        <button
          className={cn(
            buttonVariants({ variant: "pixel", size: "none" }),
            "pointer-events-auto w-full py-2 text-[8px] sm:text-[10px]",
          )}
          onClick={() => mapRef.current?.enter()}
        >
          KIRISH
        </button>
      </div>
    </div>
  );
}
