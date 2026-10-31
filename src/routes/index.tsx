import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
import { loadPlayableHero, loadUnlockedHeroes, migrateSave, selectHero } from "@/game/save";
import {
  HERO_LIST,
  HERO_ROLE,
  HERO_THEME,
  ROLE_INFO,
  bestKeys,
  withAlpha,
  type Hero,
} from "@/game/hero";
import { drawRoleIcon } from "@/game/roles";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pixelFocus, pixelPress } from "@/lib/pixel-ui";
import { getCombatTip } from "@/lib/coach.functions";
import { GAME_VERSION, CHANGELOG, SEEN_VERSION_KEY } from "@/game/version";
import { getLatestVersion } from "@/lib/version.functions";
import { HAS_SERVER, IS_APP, IS_DESKTOP } from "@/lib/platform";
import { backAction, exitApp, onAppActive, onBackButton } from "@/lib/native";
import { sfx } from "@/game/audio";
import { loadSettings, saveSettings, type Settings } from "@/game/settings";
import {
  SHOP_ITEMS,
  buy,
  buyHero,
  goldShort,
  loadGold,
  loadShop,
  nextCost,
  type ShopItem,
} from "@/game/shop";
import { renderSprite, renderUpgradeIcon } from "@/game/sprites";
import type { AnimState } from "@/game/animation";
import { ACHIEVEMENTS, loadAchievements } from "@/game/achievements";
import { loadDaily, todayKey, type DailyResult } from "@/game/daily";
import { GIFT_REWARDS, claimGift, giftStatus, type GiftClaim } from "@/game/gift";
import { RealmClient } from "@/realm/client";
import { SERVER_URL } from "@/realm/net/config";
import { normalizeRoomCode } from "@/realm/net/protocol";
import { telegramStartParam } from "@/lib/telegram";
import { isRealmUnlocked } from "@/game/realmLink";
import { TouchControls } from "@/components/game/TouchControls";
import { ControlsSettings, Toggle } from "@/components/game/ControlsSettings";
import { TransferPanel } from "@/components/game/TransferPanel";
import { lockGameKeys } from "@/game/input";
import { actionKey, actionKeys, moveLabel } from "@/game/keys";
import { useSettings } from "@/components/game/useSettings";
import { UpdateBanner } from "@/components/game/UpdateBanner";
import { NEEDS_UPDATE_CHECK } from "@/lib/update";

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
  // Android ilova o'zi to'liq ekran va gorizontal (AndroidManifest); Windows dasturida — F11
  if (IS_APP || IS_DESKTOP) return;
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
  /** Do'konning ochiladigan bo'limi: qulfli qahramon kartasi bosilsa — QAHRAMONLAR */
  const [shopTab, setShopTab] = useState<ShopTab>("upgrades");
  /** Do'kon ochilganda ko'rsatiladigan qahramon kartasi (qulfli karta bosilganda) */
  const [shopHero, setShopHero] = useState<Hero | null>(null);
  /** Ochilgan (bepul va sotib olingan) qahramonlar */
  const [unlocked, setUnlocked] = useState<ReadonlySet<Hero>>(
    () => new Set(HERO_LIST.filter((h) => h.price <= 0).map((h) => h.id)),
  );
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
  /** OLAM tugmasi: 1-dunyo Iblisi yengilgach ochiladi (dev rejimida — har doim) */
  const [realmOpen, setRealmOpen] = useState(false);
  /** XONAGA KIRISH oynasi va unga yozilgan kod (do'st havolasi ?xona=KOD bilan to'ladi) */
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  /** olamga shu xona kodi bilan kiriladi (null — avtomatik xona) */
  const realmRoomRef = useRef<string | null>(null);
  /** "Chiqishni xohlaysizmi?" oynasi (ilovada bosh menyuda "Orqaga") */
  const [exitOpen, setExitOpen] = useState(false);
  /** KUNLIK SOVG'A oynasi va bugungi sovg'a hali olinmaganmi (menyuda SOVG'A miltillaydi) */
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftReady, setGiftReady] = useState(false);
  /** Oyna shu sanada o'zi ochilgan (yopilsa, shu kuni qayta ochilmaydi — tugma miltillaydi) */
  const giftShownRef = useRef("");
  /** Bosh menyu ochilganda: bugungi sovg'a olinmagan bo'lsa oyna kuniga bir marta o'zi ochiladi */
  const checkGift = () => {
    const ready = !giftStatus().claimed;
    setGiftReady(ready);
    const today = todayKey();
    if (ready && giftShownRef.current !== today) {
      giftShownRef.current = today;
      setGiftOpen(true);
    }
  };
  /** Progress ko'chirish kodi bilan almashtirilganda oshadi (rekordlar qayta o'qiladi) */
  const [progressRev, setProgressRev] = useState(0);
  /** Ko'chirish kodi qo'llangach yoki zaxira qaytarilgach: menyu holati saqlanishdan qayta o'qiladi */
  const refreshProgress = () => {
    setHero(loadPlayableHero());
    setUnlocked(loadUnlockedHeroes());
    setDaily(loadDaily());
    setAchCount(loadAchievements().size);
    setRealmOpen(isRealmUnlocked());
    setGold(loadGold());
    setGiftReady(!giftStatus().claimed);
    setProgressRev((r) => r + 1);
  };
  /** Menyu ko'rsatmalari uchun: telefon boshqaruvi va qayta belgilangan tugmalar */
  const { touch: ts, keys: kb } = useSettings();
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
    // qulfli qahramon saqlangan bo'lsa ham faqat ochilgani tanlanadi
    setHero(loadPlayableHero());
    setUnlocked(loadUnlockedHeroes());
    setDaily(loadDaily());
    setAchCount(loadAchievements().size);
    setRealmOpen(isRealmUnlocked());
    checkGift();
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
    // do'st chaqiruvi: sayt havolasi ?xona=KOD — kod kiritish oynasi to'lib ochiladi
    const invited = normalizeRoomCode(new URLSearchParams(location.search).get("xona"));
    if (invited && SERVER_URL) {
      setJoinCode(invited);
      setJoinOpen(true);
      // qayta yuklanganda oyna yana ochilmasin
      const u = new URL(location.href);
      u.searchParams.delete("xona");
      history.replaceState(history.state, "", u.toString());
    }
    // skript hali yuklanmagan bo'lsa — sahifa yuklangach (ilovada skript yo'q)
    if (IS_APP) return;
    const onTelegram = () => {
      initTelegram();
      // Telegram Mini App havolasi: ...?startapp=KOD
      const code = normalizeRoomCode(telegramStartParam()?.replace(/^xona_?/i, ""));
      if (code && SERVER_URL && !invited) {
        setJoinCode(code);
        setJoinOpen(true);
      }
    };
    if (document.readyState === "complete") onTelegram();
    else window.addEventListener("load", onTelegram, { once: true });
  }, []);

  // Ertasi kuni ilova/sahifaga menyuda qaytilsa — yangi sovg'a
  const checkGiftRef = useRef(checkGift);
  checkGiftRef.current = checkGift;
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && !startedRef.current) checkGiftRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
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
  }, [hero, progressRev]);

  // Avtomatik yangilanish: yangi versiya chiqsa menyuda darhol, o'yinda esa so'rab yangilanadi.
  useEffect(() => {
    // statik build'da (GitHub Pages, ilova) server yo'q — yangilanish do'kon yoki sahifa orqali
    if (!HAS_SERVER) return;
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
    g.onSettings = () => setSettingsOpen(true);
    g.onExit = () => {
      setBest(g.best);
      setEndlessBest(g.endlessBest);
      setCh2Best(g.ch2Best);
      setGold(loadGold());
      setDaily(loadDaily());
      setAchCount(loadAchievements().size);
      setRealmOpen(isRealmUnlocked());
      checkGift();
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
    const c = new RealmClient(canvasRef.current, hero, { room: realmRoomRef.current });
    realmRoomRef.current = null;
    c.touch = touch;
    c.onSettings = () => setSettingsOpen(true);
    c.onExit = () => {
      setGold(loadGold());
      checkGift();
      setRealmClient(null);
      setRealm(false);
    };
    setRealmClient(c);
    if (import.meta.env.DEV) {
      const w = window as unknown as { __realm?: RealmClient; __realmDemo?: unknown };
      w.__realm = c;
      // serversiz onlayn sinov: sahifa ichidagi xona va botlar (net/demo.ts)
      w.__realmDemo = (bots?: import("@/realm/net/demo").DemoBot[]) =>
        import("@/realm/net/demo").then((m) => m.startDemo(c, bots));
    }
    c.start();
    return () => c.stop();
    // qahramon faqat menyuda o'zgaradi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realm, touch]);

  // Telefonning "Orqaga" tugmasi (ilovada; brauzerda — "app:back" hodisasi):
  // o'yinda — pauza, pauzada va oynalarda — yopish, bosh menyuda — chiqish so'rovi.
  const backRef = useRef(() => {});
  backRef.current = () => {
    const windows = [
      [exitOpen, () => setExitOpen(false)],
      [joinOpen, () => setJoinOpen(false)],
      [coachOpen, () => setCoachOpen(false)],
      [
        shopOpen,
        () => {
          setShopOpen(false);
          setGold(loadGold());
          setUnlocked(loadUnlockedHeroes());
        },
      ],
      [settingsOpen, () => setSettingsOpen(false)],
      [giftOpen, () => setGiftOpen(false)],
      [changelogOpen, () => setChangelogOpen(false)],
      [achOpen, () => setAchOpen(false)],
      [newsOpen && !started, () => setNewsOpen(false)],
    ] as const;
    const top = windows.find(([open]) => open);
    const action = backAction({
      windowOpen: !!top,
      inGame: !!game,
      inRealm: !!realmClient,
      inMap: mapOpen && !started && !realm,
    });
    if (action === "close-window") top?.[1]();
    else if (action === "game") game?.setPaused(!game.paused);
    else if (action === "realm") realmClient?.pressPause();
    else if (action === "map") setMapOpen(false);
    else setExitOpen(true);
  };
  useEffect(() => onBackButton(() => backRef.current()), []);

  // Ilova fonga o'tganda: pauza va ovoz to'xtaydi; qaytganda pauza menyusi turadi.
  const activeRef = useRef((_active: boolean) => {});
  activeRef.current = (active) => {
    if (!active) {
      game?.setPaused(true);
      const panel = realmClient?.view.panel;
      if (realmClient && panel !== "pause" && panel !== "intro") realmClient.setPanel("pause");
      realmClient?.save();
      sfx.suspend();
    } else if (!game?.paused) sfx.resume();
  };
  useEffect(() => onAppActive((active) => activeRef.current(active)), []);

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
              {HERO_LIST.map(({ id: h, name, price }) => {
                const locked = !unlocked.has(h);
                return (
                  <button
                    key={h}
                    aria-pressed={hero === h}
                    aria-label={locked ? `${name} — qulflangan, ${price} oltin` : undefined}
                    onClick={() => {
                      // sotib olinmagan qahramon: do'konning QAHRAMONLAR bo'limi ochiladi
                      if (locked) {
                        setShopTab("heroes");
                        setShopHero(h);
                        setShopOpen(true);
                        return;
                      }
                      if (selectHero(h)) setHero(h);
                    }}
                    style={
                      hero === h
                        ? {
                            borderColor: HERO_THEME[h].accent,
                            // rang qatlami to'q karta foni ustida — orqadagi sahna ko'rinmaydi
                            background: `linear-gradient(${withAlpha(HERO_THEME[h].accent, 0.15)}, ${withAlpha(HERO_THEME[h].accent, 0.15)}), var(--color-card)`,
                            color: HERO_THEME[h].uiText,
                          }
                        : undefined
                    }
                    className={`flex shrink-0 snap-center flex-col items-center gap-1 overflow-hidden border-2 bg-card px-3 py-2 text-[9px] sm:text-[10px] ${pixelPress} ${pixelFocus} ${
                      hero === h
                        ? ""
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    <HeroPreview hero={h} active={hero === h} locked={locked} />
                    {name}
                    <RoleBadge hero={h} />
                    {locked && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <LockIcon />
                        <PixelIcon id="coin" color="#ffcc33" size={10} />
                        {price}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-foreground text-xs sm:text-sm leading-6">
              {touch ? (
                <>
                  {/* telefonda — tugma nomlari (SOZLAMALAR -> BOSHQARUV ga mos) */}
                  {ts.stickMode === "floating"
                    ? `Ekranning ${ts.leftHanded ? "o'ng" : "chap"} yarmi — yurish`
                    : `${ts.leftHanded ? "O'ngdagi" : "Chapdagi"} joystik — yurish`}
                  <br />
                  {hero === "paladin"
                    ? "SHANG — qilich zarbasi, HAMLA — oldinga yugurish"
                    : hero === "mage"
                      ? "SHAR — sehrli shar, TELEPORT — sakrash"
                      : hero === "hunter"
                        ? "O'Q — o'q otish, SAKRASH — orqaga sakrash"
                        : hero === "gunner"
                          ? "O'Q — otish, o'q belgisi — qayta o'qlash, SIRPANISH — +2 o'q"
                          : "ZARBA — hujum, DASH — sirpanish"}
                  <br />
                  {hero === "paladin"
                    ? "SHANG ni bosib turing — osmon hukmi, HAMLA ni — qasam"
                    : hero === "mage"
                      ? "SHAR ni bosib turing — sehrli halqa"
                      : hero === "hunter"
                        ? "O'Q ni bosib turing — teshuvchi o'q, SAKRASH ni — tuzoq"
                        : hero === "gunner"
                          ? "O'Q ni bosib turing — barabanni bo'shatish, SIRPANISH ni — tutun"
                          : "ZARBA ni bosib turing — aylana zarba"}
                </>
              ) : (
                <>
                  {/* kompyuterda — qayta belgilangan tugmalar */}
                  {[moveLabel(kb), moveLabel(kb, 1)].filter(Boolean).join(" / ")} — yurish
                  <br />
                  {actionKeys(kb, "attack")} —{" "}
                  {hero === "paladin"
                    ? "SHANG (yo'lak bo'ylab zarba)"
                    : hero === "mage"
                      ? "sehrli shar"
                      : hero === "hunter"
                        ? "o'q"
                        : hero === "gunner"
                          ? `o'q (barabanda 6 ta), ${actionKey(kb, "reload")} — qayta o'qlash`
                          : "hujum"}
                  <br />
                  {actionKey(kb, "attack")} ni bosib turish —{" "}
                  {hero === "paladin"
                    ? "osmon hukmi (gangitadi)"
                    : hero === "mage"
                      ? "sehrli halqa"
                      : hero === "hunter"
                        ? "teshuvchi o'q"
                        : hero === "gunner"
                          ? "barabanni bo'shatish"
                          : "aylana zarba"}
                  <br />
                  {actionKeys(kb, "dash")} —{" "}
                  {hero === "paladin"
                    ? "muqaddas hamla, bosib turish — qasam"
                    : hero === "mage"
                      ? "teleport"
                      : hero === "hunter"
                        ? "orqaga sakrash, bosib turish — tuzoq"
                        : hero === "gunner"
                          ? "sirpanish, bosib turish — tutun bombasi"
                          : "dash"}
                  <br />
                  {actionKey(kb, "pause")} — pauza, {actionKey(kb, "mute")} — ovoz
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
                onClick={() => {
                  setShopTab("upgrades");
                  setShopHero(null);
                  setShopOpen(true);
                }}
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
                  if (!realmOpen) return;
                  sfx.unlock();
                  if (touch) void enterLandscape();
                  setRealm(true);
                }}
                disabled={!ready || !realmOpen}
                aria-label={realmOpen ? "OLAM (SINOV)" : "OLAM — qulflangan: Iblisni yeng"}
                title="Abadiyat olami: Iblis, Qor Malikasi va O'rmon Shohi shu olamdan kelgan"
                variant="pixelOutline"
                className="px-5 py-2 text-[10px] sm:text-xs"
              >
                {!realmOpen && <LockIcon />}
                OLAM (SINOV)
              </Button>
              {/* do'stning onlayn xonasiga kod bilan (server bo'lmagan build'da yashirin) */}
              {SERVER_URL && (
                <Button
                  onClick={() => setJoinOpen(true)}
                  disabled={!ready}
                  title="Do'st yuborgan 6 belgili xona kodini yozing"
                  variant="pixelOutline"
                  className="px-5 py-2 text-[10px] sm:text-xs"
                >
                  XONAGA KIRISH
                </Button>
              )}
            </div>
            <p className="max-w-sm text-muted-foreground text-[9px] sm:text-[10px] leading-5">
              {realmOpen
                ? "Bosslar Abadiyat olamidan kelgan — uch dunyo uning darvozalari"
                : "Iblisni yeng — darvoza ochiladi"}
            </p>
            {daily && (
              <p className="text-muted-foreground text-[9px] sm:text-[10px] leading-5">
                Bugungi sinov: {daily.score} ochko ·{" "}
                {daily.won ? "yutildi" : `${daily.wave}-to'lqin`} · ertaga yana
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-x-4">
              {/* bugungi sovg'a olinmagan bo'lsa — miltillaydi */}
              <Button
                variant="pixelLink"
                onClick={() => setGiftOpen(true)}
                title={giftReady ? "Bugungi sovg'a sizni kutmoqda" : "Kunlik sovg'a"}
                className={cn(
                  "gap-1 text-[9px] sm:text-[10px]",
                  giftReady && "gift-blink text-primary",
                )}
              >
                <PixelIcon id="gift" color="#ffcc33" size={12} />
                SOVG'A
              </Button>
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
              {/* AI server talab qiladi — GitHub Pages va ilovada yashirin */}
              {HAS_SERVER && (
                <Button
                  variant="pixelLink"
                  onClick={() => setCoachOpen(true)}
                  className="text-[9px] sm:text-[10px]"
                >
                  Jang maslahatchisi (AI)
                </Button>
              )}
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
            {/* portativ HTML, Windows dasturi va ilova o'zi yangilanmaydi — yangi versiya xabari */}
            {NEEDS_UPDATE_CHECK && <UpdateBanner />}
          </div>
        )}
      </div>
      {started && touch && game && <TouchControls game={game} />}
      {realm && touch && realmClient && <TouchControls game={realmClient} realm={realmClient} />}
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
      {HAS_SERVER && (
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
      )}
      {changelogOpen && <ChangelogWindow onClose={() => setChangelogOpen(false)} />}
      {achOpen && <AchievementsWindow onClose={() => setAchOpen(false)} />}
      {newsOpen && !started && <NewsWindow hero={hero} onClose={() => setNewsOpen(false)} />}
      {settingsOpen && (
        <SettingsWindow
          hero={hero}
          touch={touch}
          canImport={!started && !realm}
          onProgressChanged={refreshProgress}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {exitOpen && <ExitWindow onClose={() => setExitOpen(false)} />}
      {joinOpen && !started && !realm && (
        <JoinRoomWindow
          code={joinCode}
          locked={!realmOpen}
          onChange={setJoinCode}
          onClose={() => setJoinOpen(false)}
          onJoin={(code) => {
            sfx.unlock();
            if (touch) void enterLandscape();
            realmRoomRef.current = code;
            setJoinOpen(false);
            setRealm(true);
          }}
        />
      )}
      {giftOpen && !newsOpen && !started && !realm && (
        <GiftWindow
          onClose={() => setGiftOpen(false)}
          onClaim={() => {
            setGiftReady(false);
            setGold(loadGold());
            setAchCount(loadAchievements().size);
          }}
        />
      )}
      {shopOpen && (
        <ShopWindow
          tab={shopTab}
          focusHero={shopHero}
          onHeroBought={(h) => {
            // sotib olingan qahramon darhol tanlanadi
            setUnlocked(loadUnlockedHeroes());
            if (selectHero(h)) setHero(h);
          }}
          onClose={() => {
            setShopOpen(false);
            setGold(loadGold());
            setUnlocked(loadUnlockedHeroes());
          }}
        />
      )}
    </main>
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
    // past ekranda (telefon gorizontal) figuralar kichik va chetda — tugmalar ochiq qoladi
    const short = window.matchMedia("(max-height: 450px)");
    const loop = (now: number) => {
      // ~30 kadr/s yetarli — sahna sekin harakatlanadi
      if (now - last > 33) {
        last = now;
        renderMenuScene(c, (now - start) / 1000, short.matches);
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

/** Qulf belgisi (piksel, 8x9) — qulflangan tugmalarda. */
function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 8 9"
      width={10}
      height={11}
      shapeRendering="crispEdges"
      className="shrink-0"
    >
      <path d="M2 0h4v1H2zM1 1h1v3H1zM6 1h1v3H6z" fill="currentColor" />
      <path d="M0 4h8v5H0z" fill="currentColor" />
      <path d="M3 5h2v2H3z" fill="#000" />
    </svg>
  );
}

/** Do'kon kartasidagi namoyish: nafas, yurish va hujum kadrlari navbat bilan. */
const SHOWCASE: readonly (readonly [AnimState, number])[] = [
  ["idle", 0],
  ["idle", 1],
  ["idle", 0],
  ["idle", 1],
  ...[0, 1, 2, 3, 0, 1, 2, 3].map((f) => ["walk", f] as const),
  ["attack", 0],
  ["attack", 1],
  ["attack", 2],
  ["attack", 2],
];

/**
 * Menyudagi qahramon rasmi: kod bilan chizilgan sprite, tanlanganda "nafas oladi".
 * showcase — do'konda yurish va hujumni ham ko'rsatadi; locked — xira (sotib olinmagan).
 */
function HeroPreview({
  hero,
  active,
  locked = false,
  showcase = false,
  size = 48,
}: {
  hero: Hero;
  active: boolean;
  locked?: boolean;
  showcase?: boolean;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState(0);
  // Paladinning ulkan qilichi 32 px kartaga sig'maydi — kattaroq ko'rinish (tana biroz kichrayadi)
  const view = hero === "paladin" ? 48 : 32;
  useEffect(() => {
    if (!active) return setFrame(0);
    const id = window.setInterval(() => setFrame((f) => f + 1), showcase ? 160 : 500);
    return () => window.clearInterval(id);
  }, [active, showcase]);
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, view, view);
    const [state, f] = showcase
      ? SHOWCASE[frame % SHOWCASE.length]!
      : (["idle", frame % 2] as const);
    renderSprite(c, hero, state, f, view / 2, view / 2, false);
  }, [hero, frame, showcase, view]);
  return (
    <canvas
      ref={ref}
      width={view}
      height={view}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
        opacity: locked ? 0.4 : 1,
        filter: locked ? "grayscale(0.7)" : undefined,
      }}
    />
  );
}

/** Kuch kartalaridagi 12x12 piksel ikonka — kod bilan chiziladi. */
/** Rol belgisi: kod bilan chizilgan ikonka va rol nomi (TANK, JANGCHI, SEHRGAR, UZOQDAN). */
function RoleBadge({ hero, label = true }: { hero: Hero; label?: boolean }) {
  const role = HERO_ROLE[hero];
  const info = ROLE_INFO[role];
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, 9, 9);
    drawRoleIcon(c, role, 1, 1);
  }, [role]);
  return (
    <span
      className="inline-flex items-center gap-1 text-[8px] sm:text-[9px]"
      style={{ color: info.color }}
      title={info.desc}
    >
      <canvas
        ref={ref}
        width={9}
        height={9}
        aria-hidden="true"
        style={{ width: 11, height: 11, imageRendering: "pixelated" }}
      />
      {label ? info.name : <span className="sr-only">{info.name}</span>}
    </span>
  );
}

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

/** Do'kon bo'limlari: doimiy kuchaytirishlar va qahramonlar */
type ShopTab = "upgrades" | "heroes";

function ShopWindow({
  onClose,
  tab: firstTab,
  focusHero,
  onHeroBought,
}: {
  onClose: () => void;
  tab: ShopTab;
  /** Shu qahramon kartasi ko'rinadigan joyga aylantiriladi (telefonda pastda qolmasin) */
  focusHero: Hero | null;
  onHeroBought: (h: Hero) => void;
}) {
  const [tab, setTab] = useState<ShopTab>(firstTab);
  const focusRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // natijasi qaytarilmaydi: yangi brauzerlarda scrollIntoView Promise qaytaradi
    focusRef.current?.scrollIntoView?.({ block: "nearest" });
  }, []);
  const [gold, setGold] = useState(loadGold);
  const [levels, setLevels] = useState(loadShop);
  const [unlocked, setUnlocked] = useState(loadUnlockedHeroes);
  /** Xarid ochgan yutuq ("YANGI QAHRAMON") */
  const [award, setAward] = useState<string | null>(null);
  const purchase = (item: ShopItem) => {
    sfx.unlock();
    if (!buy(item.id)) return;
    sfx.upgrade();
    setGold(loadGold());
    setLevels(loadShop());
  };
  const purchaseHero = (h: Hero) => {
    sfx.unlock();
    const had = loadAchievements();
    if (!buyHero(h)) return;
    const fresh = ACHIEVEMENTS.find((a) => !had.has(a.id) && loadAchievements().has(a.id));
    if (fresh) setAward(fresh.name);
    sfx.upgrade();
    setGold(loadGold());
    setUnlocked(loadUnlockedHeroes());
    onHeroBought(h);
  };
  const tabBtn = (id: ShopTab, label: string) => (
    <button
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`border-2 px-3 py-1 ${pixelPress} ${pixelFocus} ${
        tab === id
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
  return (
    // ekranga sig'adi (dvh'ni bilmaydigan eski WebView'da ham), sarlavha joyida, ichi aylanadi
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/70 p-2" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Do'kon"
        className="fit-screen m-auto flex w-[min(94vw,640px)] flex-col overflow-hidden border-4 border-border bg-card text-[9px] sm:text-[10px] leading-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-col gap-3 px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-primary text-xs sm:text-sm">DO'KON</h2>
            <span className="inline-flex items-center gap-2 text-primary">
              <PixelIcon id="coin" color="#ffcc33" size={16} />
              {gold}
            </span>
          </div>
          <div role="tablist" aria-label="Do'kon bo'limlari" className="flex flex-wrap gap-2">
            {tabBtn("upgrades", "KUCHAYTIRISHLAR")}
            {tabBtn("heroes", "QAHRAMONLAR")}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-4">
          {tab === "upgrades" ? (
            <>
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
                        {/* "Dash/teleport/sakrash/sirpanish" kartaga sig'sin: "/" dan keyin qator bo'linadi */}
                        <span className="flex-1 text-foreground">
                          {item.desc.replace(/\//g, "/\u200b")}
                        </span>
                        <span
                          className="flex gap-1"
                          aria-label={`Bosqich ${lvl}/${item.costs.length}`}
                        >
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
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                Dastlabki 3 qahramon bepul. 4-qahramondan boshlab har biri oltinga bir marta sotib
                olinadi va doim ochiq qoladi.
              </p>
              {award && (
                <p
                  role="status"
                  className="inline-flex items-center gap-2 self-start border-2 border-primary px-2 py-1 text-primary"
                >
                  <PixelIcon id="trophy" color="#ffcc33" size={12} />
                  YUTUQ OCHILDI: {award}
                </p>
              )}
              <ul aria-label="Qahramonlar" className="grid gap-2 sm:grid-cols-2">
                {HERO_LIST.map((h) => {
                  const open = unlocked.has(h.id);
                  const short = goldShort(h.id, gold);
                  const canBuy = !open && short === 0;
                  return (
                    <li
                      key={h.id}
                      ref={h.id === focusHero ? focusRef : undefined}
                      className="flex p-[2px]"
                      style={{ background: open || canBuy ? h.theme.accent : "#5c4a6e" }}
                    >
                      <div className="flex w-full items-center gap-3 bg-[#1f1730] p-2">
                        <HeroPreview hero={h.id} active showcase size={64} />
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <span className="flex flex-wrap items-center gap-2">
                            <span style={{ color: h.theme.uiText }}>{h.name}</span>
                            <RoleBadge hero={h.id} />
                          </span>
                          <span className="text-foreground">{h.desc}</span>
                          {open ? (
                            <span
                              className="self-start border-2 px-2 py-1"
                              style={{ borderColor: h.theme.accent, color: h.theme.uiText }}
                            >
                              {h.price > 0 ? "OCHIQ" : "BEPUL · OCHIQ"}
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => purchaseHero(h.id)}
                                disabled={!canBuy}
                                className={cn(
                                  buttonVariants({ variant: "pixel", size: "none" }),
                                  "w-full gap-1 whitespace-normal px-2 py-1 text-[9px] sm:text-[10px] disabled:border-border disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-100",
                                )}
                              >
                                SOTIB OLISH
                                <PixelIcon id="coin" color="#ffcc33" size={10} />
                                {h.price}
                              </button>
                              {short > 0 && (
                                <span className="text-muted-foreground">
                                  Yana {short} oltin kerak
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <button
            onClick={onClose}
            className={cn(
              buttonVariants({ variant: "pixel", size: "none" }),
              "self-start px-4 py-2",
            )}
          >
            YOPISH
          </button>
        </div>
      </div>
    </div>
  );
}

type SettingsTab = "general" | "controls";

function SettingsWindow({
  onClose,
  hero,
  touch,
  canImport,
  onProgressChanged,
}: {
  onClose: () => void;
  hero: Hero;
  touch: boolean;
  /** Kodni kiritish faqat bosh menyuda (o'yin yoki olam saqlanishi ustidan yozmasin) */
  canImport: boolean;
  onProgressChanged: () => void;
}) {
  // jonli: boshqaruv bo'limida o'zgargan qiymatlar ustidan yozilmaydi
  const s = useSettings();
  const [tab, setTab] = useState<SettingsTab>("general");
  const update = (patch: Partial<Settings>) => {
    const next = { ...loadSettings(), ...patch };
    saveSettings(next);
    sfx.setVolumes(next.music, next.sfx);
  };
  // o'yin ichidan ochilganda ham o'yin klaviaturaga javob bermaydi; Esc — yopish
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const release = lockGameKeys();
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" && !document.querySelector("[data-key-capture]")) {
        e.preventDefault();
        closeRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      release();
      window.removeEventListener("keydown", onKey);
    };
  }, []);
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
  const tabBtn = (id: SettingsTab, label: string) => (
    <button
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`border-2 px-3 py-1 ${pixelPress} ${pixelFocus} ${
        tab === id
          ? "border-primary text-primary"
          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
  // Past telefon ekrani va dvh'ni bilmaydigan eski WebView: oyna ekranga sig'adi (fit-screen),
  // sarlavha va X aylanmaydi, ichi alohida aylanadi; baribir sig'masa — fon aylanadi (m-auto)
  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/70 p-2" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sozlamalar"
        className={`settings-window fit-screen m-auto flex flex-col overflow-hidden border-4 border-border bg-card text-[10px] sm:text-xs leading-5 ${
          tab === "controls" ? "w-[min(96vw,760px)]" : "w-[min(92vw,420px)]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4">
          <h2 className="text-primary">SOZLAMALAR</h2>
          <div role="tablist" aria-label="Sozlamalar bo'limlari" className="flex gap-2">
            {tabBtn("general", "UMUMIY")}
            {tabBtn("controls", "BOSHQARUV")}
            <button
              onClick={onClose}
              aria-label="Yopish"
              className={`border-2 border-border px-2 py-1 text-muted-foreground hover:border-foreground hover:text-foreground ${pixelPress} ${pixelFocus}`}
            >
              X
            </button>
          </div>
        </div>
        <div className="settings-body flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pb-4 pt-2">
          {tab === "general" ? (
            <>
              {slider("music", "Musiqa ovozi", () => sfx.wave())}
              {slider("sfx", "Effektlar ovozi", () => sfx.pickup())}
              <Toggle
                label="Ekran silkinishi"
                on={s.shake}
                onChange={(v) => update({ shake: v })}
              />
              <TransferPanel canImport={canImport} onChanged={onProgressChanged} />
            </>
          ) : (
            <ControlsSettings hero={hero} touch={touch} />
          )}
          <button
            onClick={onClose}
            className={cn(
              buttonVariants({ variant: "pixel", size: "none" }),
              "self-start px-4 py-2",
            )}
          >
            YOPISH
          </button>
        </div>
      </div>
    </div>
  );
}

/** Belgi (piksel, 8x7) — olingan kunlik sovg'a kataklarida. */
function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 8 7" width={12} height={11} shapeRendering="crispEdges">
      <path
        d="M7 0h1v2H7zM6 2h1v1H6zM5 3h1v1H5zM4 4h1v1H4zM3 5h1v2H3zM2 4h1v2H2zM1 3h1v2H1zM0 2h1v2H0z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 7-kun: ekran bo'ylab tushadigan tangalar (bir marta). */
function CoinRain() {
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
          <PixelIcon id="coin" color="#ffcc33" size={c.size} />
        </span>
      ))}
    </div>
  );
}

/** KUNLIK SOVG'A: 7 katak (bugungisi yoritilgan, olinganlari belgili), OLISH — oltin hisobga. */
function GiftWindow({ onClose, onClaim }: { onClose: () => void; onClaim: () => void }) {
  const [status, setStatus] = useState(giftStatus);
  const [claim, setClaim] = useState<GiftClaim | null>(null);
  const take = () => {
    sfx.unlock();
    const c = claimGift();
    if (!c) return;
    sfx.upgrade();
    setClaim(c);
    setStatus(giftStatus());
    onClaim();
  };
  const next = (status.day % GIFT_REWARDS.length) + 1;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Kunlik sovg'a"
        className="fit-screen flex w-[min(94vw,600px)] flex-col gap-3 overflow-y-auto border-4 border-primary bg-card p-3 sm:p-4 text-[10px] sm:text-xs leading-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-primary">
            <PixelIcon id="gift" color="#ffcc33" size={16} />
            KUNLIK SOVG'A
          </h2>
          <button
            onClick={onClose}
            aria-label="Yopish"
            className={`border-2 border-border px-2 py-1 text-muted-foreground hover:border-foreground hover:text-foreground ${pixelPress} ${pixelFocus}`}
          >
            X
          </button>
        </div>
        <p className="text-muted-foreground text-[9px] sm:text-[10px] leading-4">
          Har kuni kiring — sovg'a kattalashadi, 7-kuni katta sovg'a. Bir kun o'tkazib yuborilsa —
          yana 1-kundan.
        </p>
        <ol aria-label="7 kunlik sovg'alar" className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {GIFT_REWARDS.map((gold, i) => {
            const day = i + 1;
            const today = day === status.day;
            const got = day < status.day || (today && status.claimed);
            const big = day === GIFT_REWARDS.length;
            return (
              <li
                key={day}
                aria-current={today ? "date" : undefined}
                aria-label={`${day}-kun: ${gold} oltin${got ? ", olingan" : today ? ", bugun" : ""}`}
                className={cn(
                  "relative flex flex-col items-center gap-1 border-2 px-1 py-2 text-center",
                  today && !got
                    ? "gift-today border-primary bg-primary/15 text-primary"
                    : got
                      ? "border-primary/60 text-foreground/70"
                      : "border-border text-muted-foreground",
                )}
              >
                <span className="text-[8px] sm:text-[9px]">{day}-KUN</span>
                <PixelIcon id={big ? "gift" : "coin"} color="#ffcc33" size={big ? 26 : 20} />
                <span className={big ? "text-primary" : undefined}>{gold}</span>
                {got && (
                  <span className="absolute right-0.5 top-0.5 text-[#a6f08e]">
                    <CheckIcon />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {claim ? (
          <div role="status" className="flex flex-col gap-1">
            <p className="gift-pop inline-flex items-center gap-2 self-start text-primary text-xs sm:text-sm">
              <PixelIcon id="coin" color="#ffcc33" size={16} />+{claim.gold} OLTIN!
            </p>
            {claim.achievement && (
              <p className="inline-flex items-center gap-2 self-start border-2 border-primary px-2 py-1 text-primary">
                <PixelIcon id="trophy" color="#ffcc33" size={12} />
                YUTUQ OCHILDI: {claim.achievement.name}
              </p>
            )}
            <p className="text-muted-foreground">
              Ertaga: {GIFT_REWARDS[next - 1]} oltin{" "}
              <span className="whitespace-nowrap">({next}-kun).</span>
            </p>
          </div>
        ) : status.claimed ? (
          <p className="text-muted-foreground">
            Bugungi sovg'a olindi. Ertaga: {GIFT_REWARDS[next - 1]} oltin{" "}
            <span className="whitespace-nowrap">({next}-kun).</span>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {!status.claimed && (
            <button
              autoFocus
              onClick={take}
              className={cn(buttonVariants({ variant: "pixel", size: "none" }), "px-4 py-2")}
            >
              OLISH: +{status.reward} OLTIN
            </button>
          )}
          <button
            onClick={onClose}
            className={cn(
              buttonVariants({ variant: status.claimed ? "pixel" : "pixelOutline", size: "none" }),
              "px-4 py-2",
            )}
          >
            YOPISH
          </button>
        </div>
      </div>
      {claim?.day === GIFT_REWARDS.length && <CoinRain />}
    </div>
  );
}

/** Ilovadan chiqish so'rovi (brauzerning confirm oynasi o'rniga o'yin uslubidagi oyna) */
/** XONAGA KIRISH: do'st yuborgan 6 belgili kod bilan uning onlayn xonasiga */
function JoinRoomWindow({
  code,
  locked,
  onChange,
  onClose,
  onJoin,
}: {
  code: string;
  locked: boolean;
  onChange: (code: string) => void;
  onClose: () => void;
  onJoin: (code: string) => void;
}) {
  const [error, setError] = useState("");
  const submit = () => {
    const c = normalizeRoomCode(code);
    if (!c) return setError("Kod — 6 ta harf va raqam (masalan, K7QW2M)");
    onJoin(c);
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Xonaga kirish"
        className="flex w-[min(92vw,380px)] flex-col items-center gap-3 border-4 border-border bg-card p-4 text-center text-[10px] sm:text-xs leading-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-primary">XONAGA KIRISH</h2>
        <p className="text-muted-foreground">
          Do'stingiz pauza menyusidagi DO'STNI CHAQIRISH oynasidan yuborgan xona kodini yozing.
        </p>
        <input
          autoFocus
          value={code}
          maxLength={7}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label="Xona kodi"
          placeholder="K7QW2M"
          onChange={(e) => {
            setError("");
            onChange(e.target.value.toUpperCase());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !locked) submit();
          }}
          className={`w-44 border-2 border-border bg-background px-3 py-2 text-center text-base tracking-[0.3em] text-primary ${pixelFocus}`}
        />
        {error && <p className="text-[#ff4d6d]">{error}</p>}
        {locked && (
          <p className="text-[#ff9a3c]">Abadiyat olamiga kirish uchun avval Iblisni yeng.</p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={submit}
            disabled={locked}
            className={cn(
              buttonVariants({ variant: "pixel", size: "none" }),
              "px-4 py-2 disabled:opacity-50",
            )}
          >
            KIRISH
          </button>
          <button
            onClick={onClose}
            className={cn(buttonVariants({ variant: "pixelOutline", size: "none" }), "px-4 py-2")}
          >
            BEKOR
          </button>
        </div>
      </div>
    </div>
  );
}

function ExitWindow({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chiqish"
        className="flex w-[min(92vw,380px)] flex-col items-center gap-4 border-4 border-border bg-card p-4 text-center text-[10px] sm:text-xs leading-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-primary">Chiqishni xohlaysizmi?</h2>
        <p className="text-muted-foreground">Rekord, oltin va yutuqlar saqlangan.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={exitApp}
            className={cn(buttonVariants({ variant: "pixel", size: "none" }), "px-4 py-2")}
          >
            HA, CHIQISH
          </button>
          <button
            autoFocus
            onClick={onClose}
            className={cn(buttonVariants({ variant: "pixelOutline", size: "none" }), "px-4 py-2")}
          >
            YO'Q
          </button>
        </div>
      </div>
    </div>
  );
}

function AchievementsWindow({ onClose }: { onClose: () => void }) {
  const [got] = useState(loadAchievements);
  return (
    // ekranga sig'adi (dvh'ni bilmaydigan eski WebView'da ham), sarlavha joyida, ichi aylanadi
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/70 p-2" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Yutuqlar"
        className="fit-screen m-auto flex w-[min(94vw,520px)] flex-col overflow-hidden border-4 border-border bg-card text-[9px] sm:text-[10px] leading-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="shrink-0 px-4 pb-3 pt-4 text-primary text-xs sm:text-sm">
          YUTUQLAR {got.size}/{ACHIEVEMENTS.length}
        </h2>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-4">
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
            className={cn(
              buttonVariants({ variant: "pixel", size: "none" }),
              "self-start px-4 py-2",
            )}
          >
            YOPISH
          </button>
        </div>
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
    // ekranga sig'adi (dvh'ni bilmaydigan eski WebView'da ham), sarlavha joyida, ichi aylanadi
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/70 p-2" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Yangiliklar"
        className={`fit-screen m-auto flex ${big ? "w-[min(94vw,720px)]" : "w-[min(92vw,480px)]"} flex-col overflow-hidden border-4 border-primary bg-card text-[10px] sm:text-xs leading-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="shrink-0 px-4 pb-3 pt-4 text-primary">
          {big ? `PIKSEL QAL'A 2.0!` : "YANGILIKLAR"} · v{entry.version}
        </h2>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-4">
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
            className={cn(
              buttonVariants({ variant: "pixel", size: "none" }),
              "self-start px-4 py-2",
            )}
          >
            O'YNASH
          </button>
        </div>
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
