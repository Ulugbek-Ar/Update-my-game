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
  drawPaladinCard,
  drawRolesCard,
  drawTankCard,
  renderMenuScene,
} from "@/game/menuScene";
import { loadPlayableHero, loadUnlockedHeroes, migrateSave, selectHero } from "@/game/save";
import { HERO_LIST, HERO_ROLE, ROLE_INFO, bestKeys, withAlpha, type Hero } from "@/game/hero";
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
import { currentSettings, loadSettings, saveSettings, type Settings } from "@/game/settings";
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
import { heroView, renderSprite, renderUpgradeIcon, visualFrames } from "@/game/sprites";
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
import { account } from "@/account/account";
import { cloud } from "@/account/cloud";
import { useAccount, useCloud } from "@/account/useAccount";
import { AccountCorner } from "@/components/game/AccountCorner";
import { LoginWindow } from "@/components/game/LoginWindow";
import { MigrateWindow } from "@/components/game/MigrateWindow";
import { ProfileWindow } from "@/components/game/ProfileWindow";
import { AdminWindow } from "@/components/game/AdminWindow";
import { CoinRain } from "@/components/game/pixel";
import { SkinsShop } from "@/components/game/SkinsShop";
import { skinLook, skinPalette } from "@/game/skins";
import { GiftInboxWindow } from "@/components/game/GiftInboxWindow";
import { giftBox, useGiftBox } from "@/account/giftbox";
import { expedition, useExpedition } from "@/account/expedition";
import { ExpeditionBadge, ExpeditionWindow } from "@/components/game/ExpeditionWindow";
import type { AdminStart } from "@/account/admin";
import { LevelUpWindow } from "@/components/game/LevelUpWindow";
import { FriendsWindow } from "@/components/game/FriendsWindow";
import { LeaderboardWindow } from "@/components/game/LeaderboardWindow";
import { GuildWindow, type GuildTab } from "@/components/game/GuildWindow";
import { guild, useGuild } from "@/account/guild";
import { flushScores, submitRun } from "@/account/scores";
import { friends, useFriends } from "@/account/friends";
import type { FriendInfo } from "@/account/protocol";
import { checkLevelUp } from "@/account/progression";
import { XP, addXp, type LevelUp } from "@/account/xp";
import { LANGS, getLang, initLang, setLang, t, tk } from "@/i18n";
import { useLang } from "@/i18n/react";

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
  // til o'zgarsa butun menyu qayta chiziladi; til klientda aniqlanadi (gidratsiya o'zbekcha)
  useLang();
  useEffect(() => initLang(), []);
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
  /** Akkaunt: kirish va profil oynalari, progress tanlovi (birinchi kirishda) */
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  /** Muallif paneli (faqat server admin deb tasdiqlasa ichi ko'rinadi) */
  const [adminOpen, setAdminOpen] = useState(false);
  /** Muallif paneli: keyingi o'yin shu dunyo/to'lqindan (bir martalik) */
  const adminStartRef = useRef<AdminStart | null>(null);
  /** Sovg'a qutisi ("Sovg'a keldi!"): muallifdan kelgan sovg'alar */
  const [inboxOpen, setInboxOpen] = useState(false);
  const box = useGiftBox();
  /** o'yin/olam paytida kelgan sovg'a — menyuga qaytganda ochiladi */
  const giftWaitRef = useRef(false);
  /** Ekspeditsiya: qaysi qahramon sarguzashtda va ko'rsatilmagan mukofot */
  const ex = useExpedition();
  const [decisionOpen, setDecisionOpen] = useState(true);
  /** REYTING oynasi */
  const [boardOpen, setBoardOpen] = useState(false);
  /** DO'STLAR oynasi; "yoniga kirish" — shu do'st (akkaunt) yoniga */
  const [friendsOpen, setFriendsOpen] = useState(false);
  const fr = useFriends();
  /** GILDIYA oynasi; nishon — kelgan takliflar (gildiyasiz) yoki arizalar (rahbar/o'rinbosar) */
  const [guildOpen, setGuildOpen] = useState(false);
  /** oyna qaysi bo'limda ochiladi (Gildiya zalidagi sandiq — XAZINA...) */
  const [guildTab, setGuildTab] = useState<GuildTab>("home");
  const gv = useGuild();
  /** Abadiyat olamidagi Gildiya zali (gildiya raqami; null — oddiy olam) */
  const [hall, setHall] = useState<number | null>(null);
  /** zaldan chiqqanda vodiyda ko'rsatiladigan xabar ("ulanish uzildi" va h.k.) */
  const hallNoticeRef = useRef<string | null>(null);
  const nearAccRef = useRef<number | null>(null);
  /** Daraja oshdi: oltin sovg'asi va unvon (menyuda, o'yin tugagach) */
  const [levelUp, setLevelUp] = useState<LevelUp | null>(null);
  /** Akkaunt xabari ("Xush kelibsiz!", "Akkauntdan chiqdingiz") — menyuda bir necha soniya */
  const [notice, setNotice] = useState<string | null>(null);
  const acc = useAccount();
  const cloudView = useCloud();
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
  // bulutdan progress kelganda menyu qayta o'qiladi; o'yin yoki olam ketayotganda kutadi
  const refreshRef = useRef(refreshProgress);
  refreshRef.current = refreshProgress;
  /** Menyu ko'rsatmalari uchun: telefon boshqaruvi va qayta belgilangan tugmalar */
  const { touch: ts, keys: kb } = useSettings();
  /** Kunlik sinov sanasi (oddiy o'yinda null) */
  const dailyRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  // olamda ham avtomatik yangilanish so'rab qilinadi
  startedRef.current = started || realm;
  cloud.canApply = () => !startedRef.current;
  cloud.onApplied = () => refreshRef.current();
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
    // dev: serversiz akkaunt (skrinshotlar) — await window.__accountDemo()
    if (import.meta.env.DEV)
      (window as unknown as { __accountDemo?: unknown }).__accountDemo = (
        o?: Parameters<typeof import("@/account/demo").startAccountDemo>[0],
      ) => import("@/account/demo").then((m) => m.startAccountDemo(o));
    // akkaunt: saqlangan sessiya, kutilayotgan bot kodi (Telegram ichida — skript yuklangach);
    // bulutli saqlanish: kirgan bo'lsa — yangiroq progress yuklanadi, o'zgarishlar yuboriladi
    account.init();
    cloud.start();
    // do'stlar: onlayn holat (daqiqada bir) va tez xabarlar
    friends.start();
    // ekspeditsiya: yopilganda tanlangan qahramon sarguzashtga ketadi, qaytganda — mukofot
    expedition.start(
      () => (startedRef.current ? null : loadPlayableHero()),
      () => !startedRef.current,
    );
    // internet yo'qligida qolgan reyting natijalari
    void flushScores();
    window.addEventListener("online", () => void flushScores());
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
      // Mini App: initData bilan avtomatik kirish
      account.checkTelegram();
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

  // akkaunt xabari: bir necha soniya menyuda
  useEffect(() => {
    if (!acc.notice) return;
    setNotice(account.takeNotice());
  }, [acc.notice]);
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(id);
  }, [notice]);
  // do'stlarga: qayerdaman (menyu / dunyo / olam — xona kodi RealmClient.onRoom dan)
  useEffect(() => {
    if (!realm) friends.setPlace(started ? "world" : "menu");
  }, [started, realm]);
  // ekspeditsiyadagi qahramon bilan o'ynash boshlandi: ekspeditsiya tugaydi (mukofot — menyuda)
  useEffect(() => {
    if (started || realm) void expedition.endFor(hero);
    // qahramon faqat menyuda o'zgaradi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, realm]);
  // ekspeditsiya mukofoti qo'shildi: menyudagi oltin va daraja qayta o'qiladi
  useEffect(() => {
    if (ex.reward) refreshRef.current();
  }, [ex.reward]);
  // muallifdan sovg'a keldi: menyuda — darhol "Sovg'a keldi!", o'yinda — menyuga qaytganda
  useEffect(() => {
    giftBox.onArrive = () => {
      if (startedRef.current) giftWaitRef.current = true;
      else setInboxOpen(true);
    };
  }, []);
  useEffect(() => {
    if (started || realm || !giftWaitRef.current) return;
    giftWaitRef.current = false;
    if (giftBox.state.pending > 0) setInboxOpen(true);
  }, [started, realm]);
  // gildiya topshirig'i sovg'asi (oyna ochilganda o'zi olinadi): oltin va xabar
  useEffect(() => {
    guild.onReward = (g) => {
      setGold(loadGold());
      account.notify(t("m.guildGift", { n: g }));
    };
  }, []);
  // do'stdan tayyor ibora: olamda — o'yin ichida, menyuda — yuqorida yozuv
  const realmClientRef = useRef<RealmClient | null>(null);
  realmClientRef.current = realmClient;
  useEffect(() => {
    friends.onMessage = (_m, text) => {
      if (realmClientRef.current) realmClientRef.current.notify(text);
      else if (!startedRef.current) account.notify(text);
    };
  }, []);
  // o'yin yoki olamdan menyuga qaytildi: bulutdagi yangiroq progress (boshqa qurilmadan) shu yerda
  useEffect(() => {
    if (!started && !realm) cloud.resume();
  }, [started, realm]);
  // menyuda: yig'ilgan XP bo'yicha yangi darajalar sovg'asi (o'yin, olam, sovg'a, bulutdan keyin)
  useEffect(() => {
    if (!ready || started || realm) return;
    const up = checkLevelUp();
    if (!up) return;
    setLevelUp(up);
    setGold(loadGold());
  }, [ready, started, realm, progressRev]);
  // yangi tanlov (birinchi kirish) — oyna o'zi ochiladi
  useEffect(() => {
    if (cloudView.decision) setDecisionOpen(true);
  }, [cloudView.decision]);

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
    // reyting: tugagan o'yin natijasi (faqat kirgan o'yinchida yuboriladi)
    g.onRunEnd = (r) => void submitRun(r);
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
    // muallif paneli: tanlangan to'lqindan
    const jump = adminStartRef.current;
    adminStartRef.current = null;
    if (jump) g.jumpToWave(jump.wave);
    return () => g.stop();
    // qahramon faqat menyuda o'zgaradi — o'yin davomida qayta yaratilmaydi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, touch]);

  // Abadiyat olami: o'sha canvas'da alohida klient (o'z saqlanishi bilan)
  useEffect(() => {
    if (!realm || !canvasRef.current) return;
    const c = new RealmClient(canvasRef.current, hero, {
      room: realmRoomRef.current,
      nearAcc: nearAccRef.current,
      hall: hall ? { guild: hall } : null,
    });
    realmRoomRef.current = null;
    nearAccRef.current = null;
    c.onRoom = (code) => friends.setPlace("realm", code);
    // gildiya: vodiydagi darvoza — zalga, zal eshigi — vodiyga; sandiq, taxta, kitob — oyna
    c.onEnterHall = (g) => setHall(g);
    c.onLeaveHall = (notice) => {
      hallNoticeRef.current = notice;
      setHall(null);
    };
    c.onGuildPanel = (tab) => {
      setGuildTab(tab);
      setGuildOpen(true);
    };
    if (hallNoticeRef.current) {
      c.notify(hallNoticeRef.current);
      hallNoticeRef.current = null;
    }
    c.touch = touch;
    c.onSettings = () => setSettingsOpen(true);
    c.onExit = () => {
      setGold(loadGold());
      checkGift();
      setRealmClient(null);
      setHall(null);
      setRealm(false);
    };
    setRealmClient(c);
    if (import.meta.env.DEV) {
      const w = window as unknown as {
        __realm?: RealmClient;
        __realmDemo?: unknown;
        __hallDemo?: unknown;
      };
      w.__realm = c;
      // serversiz onlayn sinov: sahifa ichidagi xona va botlar (net/demo.ts)
      w.__realmDemo = (bots?: import("@/realm/net/demo").DemoBot[]) =>
        import("@/realm/net/demo").then((m) => m.startDemo(c, bots));
      // Gildiya zali (avval window.__realm.onEnterHall(7)): sahifa ichidagi zal va a'zolar
      w.__hallDemo = (
        bots?: import("@/realm/net/demo").DemoBot[],
        info?: Partial<import("@/realm/net/protocol").HallInfo>,
      ) => import("@/realm/net/demo").then((m) => m.startHallDemo(c, bots, info));
    }
    c.start();
    return () => c.stop();
    // qahramon faqat menyuda o'zgaradi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realm, touch, hall]);

  // Telefonning "Orqaga" tugmasi (ilovada; brauzerda — "app:back" hodisasi):
  // o'yinda — pauza, pauzada va oynalarda — yopish, bosh menyuda — chiqish so'rovi.
  const backRef = useRef(() => {});
  backRef.current = () => {
    const windows = [
      [exitOpen, () => setExitOpen(false)],
      [loginOpen, () => setLoginOpen(false)],
      [friendsOpen, () => setFriendsOpen(false)],
      [guildOpen, () => setGuildOpen(false)],
      [boardOpen, () => setBoardOpen(false)],
      [!!levelUp && !started && !realm, () => setLevelUp(null)],
      [adminOpen, () => setAdminOpen(false)],
      [inboxOpen, () => setInboxOpen(false)],
      [
        !!ex.reward && !started && !realm,
        () => {
          expedition.dismiss();
          refreshProgress();
        },
      ],
      [profileOpen, () => setProfileOpen(false)],
      [!!cloudView.decision && decisionOpen && !started && !realm, () => setDecisionOpen(false)],
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
      // ilova fonga o'tdi — saqlanmagan progress darhol bulutga
      cloud.flush();
      sfx.suspend();
    } else if (!game?.paused) sfx.resume();
  };
  useEffect(() => onAppActive((active) => activeRef.current(active)), []);

  return (
    <main className="game-viewport font-pixel">
      {/* ekran almashganda piksel parda ochiladi (kalit o'zgarsa animatsiya qaytadan boshlanadi) */}
      <ScreenWipe key={started ? "game" : realm ? "realm" : mapOpen ? "map" : "menu"} />
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
            <h1 className="logo-live text-primary text-lg sm:text-2xl drop-shadow-[2px_2px_0_#000]">
              PIKSEL QAL'A
            </h1>
            {/* 10 tagacha qahramon: sig'masa gorizontal aylanadi */}
            <div
              aria-label={t("m.heroSelect")}
              className="hero-row flex max-w-full shrink-0 snap-x gap-3 overflow-x-auto p-1"
            >
              {HERO_LIST.map(({ id: h, name, price }) => {
                const locked = !unlocked.has(h);
                return (
                  <button
                    key={h}
                    aria-pressed={hero === h}
                    aria-label={locked ? t("m.lockedAria", { name, price }) : undefined}
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
                            // tanlangan skin rangida (default — qahramon rangi)
                            borderColor: skinLook(h).theme.accent,
                            // rang qatlami to'q karta foni ustida — orqadagi sahna ko'rinmaydi
                            background: `linear-gradient(${withAlpha(skinLook(h).theme.accent, 0.15)}, ${withAlpha(skinLook(h).theme.accent, 0.15)}), var(--color-card)`,
                            color: skinLook(h).theme.uiText,
                          }
                        : undefined
                    }
                    className={`hero-card ${!locked && skinLook(h).tier === "legendary" ? "skin-legend" : ""} flex w-[6.75rem] shrink-0 snap-center flex-col items-center gap-1 overflow-hidden border-2 bg-card px-1 py-2 text-[9px] sm:text-[10px] ${pixelPress} ${pixelFocus} ${
                      hero === h
                        ? ""
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    <HeroPreview hero={h} active={hero === h} locked={locked} />
                    {name}
                    <RoleBadge hero={h} />
                    {ex.hero === h && <ExpeditionBadge hero={h} />}
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
            {/* ko'rsatma: hamma qahramon matni bir katakda — blok balandligi eng uzuniga teng,
                qahramon almashtirilganda menyu siljimaydi */}
            <div className="menu-hint grid w-full max-w-[34rem] shrink-0 items-center px-2">
              {HERO_LIST.map(({ id: h }) => (
                <p
                  key={h}
                  aria-hidden={h !== hero}
                  className={`[grid-area:1/1] text-foreground text-xs sm:text-sm leading-6 ${h === hero ? "" : "invisible"}`}
                >
                  {touch ? (
                    <>
                      {/* telefonda — tugma nomlari (SOZLAMALAR -> BOSHQARUV ga mos) */}
                      {t(
                        ts.stickMode === "floating"
                          ? ts.leftHanded
                            ? "hs.floatR"
                            : "hs.floatL"
                          : ts.leftHanded
                            ? "hs.stickR"
                            : "hs.stickL",
                      )}
                      <br />
                      {tk(`hs.t1.${h}`)}
                      <br />
                      {tk(`hs.t2.${h}`)}
                    </>
                  ) : (
                    <>
                      {/* kompyuterda — qayta belgilangan tugmalar */}
                      {[moveLabel(kb), moveLabel(kb, 1)].filter(Boolean).join(" / ")} —{" "}
                      {t("hs.move")}
                      <br />
                      {actionKeys(kb, "attack")} —{" "}
                      {tk(`hs.k1.${h}`, { R: actionKey(kb, "reload") })}
                      <br />
                      {t("hs.hold", { k: actionKey(kb, "attack") })} {tk(`hs.k2.${h}`)}
                      <br />
                      {actionKeys(kb, "dash")} — {tk(`hs.k3.${h}`)}
                      <br />
                      {t("hs.pauseMute", { p: actionKey(kb, "pause"), m: actionKey(kb, "mute") })}
                    </>
                  )}
                </p>
              ))}
            </div>
            <p className="text-muted-foreground text-[9px] sm:text-[10px] leading-5">
              {t("m.rules1")}
              <br />
              {t("m.rules2")}
              {best > 0 && (
                <>
                  <br />
                  <span className="text-primary">{t("m.best", { n: best })}</span>
                </>
              )}
              {ch2Best > 0 && (
                <>
                  <br />
                  <span className="text-[#9fd0ef]">{t("m.ch2Best", { n: ch2Best })}</span>
                </>
              )}
              {endlessBest > 0 && (
                <>
                  <br />
                  <span className="text-primary">{t("m.endlessBest", { n: endlessBest })}</span>
                </>
              )}
              <br />
              <span className="inline-flex items-center gap-1 text-primary">
                <PixelIcon id="coin" color="#ffcc33" size={12} />
                {t("m.gold", { n: gold })}
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
              {ready ? t("m.start") : t("m.loading")}
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
                {t("m.shop")}
              </Button>
              <Button
                onClick={() => {
                  sfx.unlock();
                  if (touch) void enterLandscape();
                  dailyRef.current = todayKey();
                  setStarted(true);
                }}
                disabled={!ready || !!daily}
                title={daily ? t("m.dailyUsed") : undefined}
                variant="pixelOutline"
                className="px-5 py-2 text-[10px] sm:text-xs"
              >
                {daily ? t("m.dailyScore", { n: daily.score }) : t("m.daily")}
              </Button>
              <Button
                onClick={() => {
                  const name = HERO_LIST.find((x) => x.id === (ex.hero ?? hero))?.name ?? "";
                  if (ex.hero)
                    void expedition.claim(true).then((r) => {
                      if (!r) account.notify(t("m.expBack", { name }));
                    });
                  else
                    void expedition
                      .send(hero)
                      .then((r) =>
                        account.notify(r.ok ? t("m.expSent", { name }) : t("m.expFail")),
                      );
                }}
                disabled={!ready}
                title={ex.hero ? t("m.expRecallT") : t("m.expSendT")}
                variant="pixelOutline"
                className="px-5 py-2 text-[10px] sm:text-xs"
              >
                {ex.hero ? t("m.expRecall") : t("m.expSend")}
              </Button>
              <Button
                onClick={() => {
                  if (!realmOpen) return;
                  sfx.unlock();
                  if (touch) void enterLandscape();
                  setRealm(true);
                }}
                disabled={!ready || !realmOpen}
                aria-label={realmOpen ? t("m.realm") : t("m.realmLocked")}
                title={t("m.realmT")}
                variant="pixelOutline"
                className="px-5 py-2 text-[10px] sm:text-xs"
              >
                {!realmOpen && <LockIcon />}
                {t("m.realm")}
              </Button>
              {/* do'stning onlayn xonasiga kod bilan (server bo'lmagan build'da yashirin) */}
              {SERVER_URL && (
                <Button
                  onClick={() => setJoinOpen(true)}
                  disabled={!ready}
                  title={t("m.joinT")}
                  variant="pixelOutline"
                  className="px-5 py-2 text-[10px] sm:text-xs"
                >
                  {t("m.join")}
                </Button>
              )}
            </div>
            <p className="max-w-sm text-muted-foreground text-[9px] sm:text-[10px] leading-5">
              {realmOpen ? t("m.realmOpen") : t("m.realmHint")}
            </p>
            {daily && (
              <p className="text-muted-foreground text-[9px] sm:text-[10px] leading-5">
                {t("m.dailyToday", {
                  s: daily.score,
                  r: daily.won ? t("m.dailyWon") : t("m.dailyWave", { n: daily.wave }),
                })}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-x-4">
              {/* bugungi sovg'a olinmagan bo'lsa — miltillaydi */}
              <Button
                variant="pixelLink"
                onClick={() => setGiftOpen(true)}
                title={giftReady ? t("m.giftReady") : t("m.giftT")}
                className={cn(
                  "gap-1 text-[9px] sm:text-[10px]",
                  giftReady && "gift-blink text-primary",
                )}
              >
                <PixelIcon id="gift" color="#ffcc33" size={12} />
                {t("m.gift")}
              </Button>
              {/* sovg'a qutisi: muallifdan sovg'a kutayotgan bo'lsa — kichik belgi */}
              {acc.me && box.pending > 0 && (
                <Button
                  variant="pixelLink"
                  onClick={() => setInboxOpen(true)}
                  aria-label={t("m.giftBoxAria", { n: box.pending })}
                  title={t("m.giftBoxT")}
                  className="gift-blink gap-1 text-[9px] text-[#ff9fcb] sm:text-[10px]"
                >
                  <PixelIcon id="gift" color="#ff9fcb" size={12} />
                  {t("m.giftBoxN", { n: box.pending })}
                </Button>
              )}
              <Button
                variant="pixelLink"
                onClick={() => setSettingsOpen(true)}
                className="text-[9px] sm:text-[10px]"
              >
                {t("m.settings")}
              </Button>
              {/* do'stlar: kirgan o'yinchida (mehmon — kirish oynasi); yangi so'rov/xabar — nishon */}
              {account.enabled && (
                <Button
                  variant="pixelLink"
                  onClick={() => (acc.me ? setFriendsOpen(true) : setLoginOpen(true))}
                  aria-label={t("m.friends")}
                  title={
                    acc.me && fr.requests + fr.unread > 0
                      ? t("m.friendsNew", { n: fr.requests + fr.unread })
                      : t("m.friendsT")
                  }
                  className={cn(
                    "gap-1 text-[9px] sm:text-[10px]",
                    fr.requests + fr.unread > 0 && "gift-blink text-primary",
                  )}
                >
                  {t("m.friends")}
                  {acc.me && fr.requests + fr.unread > 0 ? ` (${fr.requests + fr.unread})` : ""}
                </Button>
              )}
              {/* gildiya: kirgan o'yinchida (mehmon — kirish oynasi); taklif/ariza — nishon */}
              {account.enabled && (
                <Button
                  variant="pixelLink"
                  onClick={() => {
                    if (!acc.me) return setLoginOpen(true);
                    setGuildTab("home");
                    setGuildOpen(true);
                  }}
                  aria-label={t("m.guild")}
                  title={
                    acc.me && gv.pending > 0
                      ? t("m.guildNew", { n: gv.pending })
                      : acc.me && gv.reward
                        ? t("m.guildReward")
                        : acc.me && gv.unread
                          ? t("m.guildChat")
                          : t("m.guildT")
                  }
                  className={cn(
                    "gap-1 text-[9px] sm:text-[10px]",
                    acc.me &&
                      (gv.pending > 0 || gv.reward || gv.unread) &&
                      "gift-blink text-primary",
                  )}
                >
                  {t("m.guild")}
                  {acc.me && gv.pending > 0 ? ` (${gv.pending})` : ""}
                  {acc.me && !gv.pending && (gv.reward || gv.unread) ? " •" : ""}
                </Button>
              )}
              {account.enabled && (
                <Button
                  variant="pixelLink"
                  onClick={() => setBoardOpen(true)}
                  title={t("m.rankT")}
                  className="text-[9px] sm:text-[10px]"
                >
                  {t("m.rank")}
                </Button>
              )}
              <Button
                variant="pixelLink"
                onClick={() => setAchOpen(true)}
                className="text-[9px] sm:text-[10px]"
              >
                {t("m.achN", { n: achCount, total: ACHIEVEMENTS.length })}
              </Button>
              <Button
                variant="pixelLink"
                onClick={() => setChangelogOpen(true)}
                className="text-[9px] sm:text-[10px]"
              >
                {t("m.updates")}
              </Button>
              {/* AI server talab qiladi — GitHub Pages va ilovada yashirin */}
              {HAS_SERVER && (
                <Button
                  variant="pixelLink"
                  onClick={() => setCoachOpen(true)}
                  className="text-[9px] sm:text-[10px]"
                >
                  {t("m.coachAi")}
                </Button>
              )}
            </div>
            <button
              onClick={() => {
                sfx.unlock();
                setMuted(sfx.toggleMute());
              }}
              aria-label={muted ? t("m.unmute") : t("m.mute")}
              className={`absolute bottom-2 left-2 text-sm sm:text-base ${pixelFocus}`}
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <span className="absolute bottom-2 right-2 text-[8px] sm:text-[9px] text-foreground/50">
              v{GAME_VERSION}
            </span>
            {/* chap yuqori: akkaunt (kirish / profil); sarlavha (o'rtada) va oy (o'ngda) yopilmaydi */}
            <div className="menu-corner absolute left-2 top-2 z-10 flex max-w-[30%] flex-col items-start gap-2 text-[8px] sm:text-[10px]">
              <AccountCorner
                rev={progressRev}
                onLogin={() => setLoginOpen(true)}
                onProfile={() => setProfileOpen(true)}
                onDecision={() => setDecisionOpen(true)}
              />
              {/* portativ HTML, Windows dasturi va ilova o'zi yangilanmaydi — yangi versiya xabari */}
              {NEEDS_UPDATE_CHECK && <UpdateBanner inline />}
            </div>
            {notice && (
              <p
                role="status"
                className="absolute left-1/2 top-2 z-10 -translate-x-1/2 border-2 border-primary bg-card px-3 py-1 text-[8px] sm:text-[10px] text-primary"
              >
                {notice}
              </p>
            )}
          </div>
        )}
      </div>
      {started && touch && game && <TouchControls game={game} />}
      {realm && touch && realmClient && <TouchControls game={realmClient} realm={realmClient} />}
      {touch && portrait && <RotateOverlay />}
      {newVersion && (
        <div className="fixed bottom-2 left-1/2 -translate-x-1/2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-2 border-primary bg-card px-3 py-2 text-[9px] sm:text-[10px] text-foreground max-w-full">
          {t("m.newVersion", { v: newVersion })}
          <button
            onClick={() => window.location.reload()}
            className={cn(buttonVariants({ variant: "pixel", size: "none" }), "px-3 py-1")}
          >
            {t("m.update")}
          </button>
        </div>
      )}
      {HAS_SERVER && (
        <div hidden={!coachOpen} className="fixed inset-0 z-50 bg-letterbox/70 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("m.coach")}
            className="absolute inset-4 m-auto h-fit max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto bg-card p-4"
          >
            <Button
              variant="pixel"
              size="none"
              onClick={() => setCoachOpen(false)}
              className="mb-3 px-4 py-2 text-[10px]"
            >
              {t("common.close")}
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
      {loginOpen && !started && !realm && <LoginWindow onClose={() => setLoginOpen(false)} />}
      {profileOpen && !started && !realm && (
        <ProfileWindow
          rev={progressRev}
          onClose={() => setProfileOpen(false)}
          onRestored={refreshProgress}
          onAdmin={() => {
            setProfileOpen(false);
            setAdminOpen(true);
          }}
        />
      )}
      {ex.reward && !inboxOpen && !newsOpen && !started && !realm && (
        <ExpeditionWindow reward={ex.reward} onClose={refreshProgress} />
      )}
      {inboxOpen && acc.me && !started && !realm && (
        <GiftInboxWindow
          onClose={() => setInboxOpen(false)}
          onClaimed={() => {
            refreshProgress();
            // XP sovg'asi: yangi daraja bo'lsa — oyna yopilgach ko'rinadi
            const up = checkLevelUp();
            if (up) setLevelUp(up);
            setGold(loadGold());
          }}
        />
      )}
      {adminOpen && acc.me && !started && !realm && (
        <AdminWindow
          onClose={() => setAdminOpen(false)}
          onChanged={refreshProgress}
          onStart={(s) => {
            sfx.unlock();
            if (touch) void enterLandscape();
            adminStartRef.current = s;
            dailyRef.current = null;
            setWorld(s.world);
            setAdminOpen(false);
            setStarted(true);
          }}
        />
      )}
      {boardOpen && !started && !realm && (
        <LeaderboardWindow
          hero={hero}
          onClose={() => setBoardOpen(false)}
          onLogin={() => {
            setBoardOpen(false);
            setLoginOpen(true);
          }}
        />
      )}
      {friendsOpen && acc.me && !started && !realm && (
        <FriendsWindow
          onClose={() => setFriendsOpen(false)}
          onJoin={(f: FriendInfo) => {
            if (!f.room) return;
            if (!realmOpen) {
              account.notify(t("m.realmNeedDevil"));
              return;
            }
            sfx.unlock();
            if (touch) void enterLandscape();
            realmRoomRef.current = f.room;
            nearAccRef.current = f.id;
            setFriendsOpen(false);
            setRealm(true);
          }}
        />
      )}
      {/* menyuda va olamda (Gildiya zalidagi sandiq, taxta, kitob) */}
      {guildOpen && acc.me && !started && (
        <GuildWindow
          tab={guildTab}
          onClose={() => {
            setGuildOpen(false);
            setGuildTab("home");
            setGold(loadGold());
          }}
        />
      )}
      {levelUp && !giftOpen && !inboxOpen && !ex.reward && !newsOpen && !started && !realm && (
        <LevelUpWindow up={levelUp} onClose={() => setLevelUp(null)} />
      )}
      {cloudView.decision && decisionOpen && !started && !realm && !loginOpen && (
        <MigrateWindow decision={cloudView.decision} onLater={() => setDecisionOpen(false)} />
      )}
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
            // kunlik sovg'a XP beradi; daraja oshsa — sovg'a oynasi yopilgach ko'rinadi
            addXp(XP.gift);
            const up = checkLevelUp();
            if (up) setLevelUp(up);
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
      aria-label={t("m.rotate")}
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
      <p className="text-foreground text-[10px] leading-5">{t("m.landscape")}</p>
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
        renderMenuScene(c, (now - start) / 1000, short.matches, currentSettings().reduceFx);
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
 * Menyuda tanlangan qahramon kadri: joyida yuradi (oraliq kadrlar bilan), ora-sira to'xtab nafas
 * oladi. moving = false — faqat sekin nafas (tanlanmagan yoki effektlar kamaytirilgan).
 */
function selectedHeroFrame(
  hero: Hero,
  tick: number,
  moving: boolean,
): readonly [AnimState, number, number] {
  // 110 ms lik taymer: nafas — har 5 tikda bir kadr
  // Samuray va Ninja: o'z kadrlari (4 nafas, 6 qadam), oraliq kadrsiz
  const own = hero === "samurai" || hero === "shinobi" || hero === "priestess";
  if (!moving) return ["idle", Math.floor(tick / 5) % (own ? 4 : 2), 0];
  const n = visualFrames(hero, "walk", own ? 6 : 4);
  // 3 aylana yuradi, so'ng 8 tik nafas oladi
  const cycle = n * 3 + 8;
  const k = tick % cycle;
  if (k >= n * 3) return ["idle", Math.floor((k - n * 3) / 4) % 2, 0];
  const v = k % n;
  return own ? ["walk", v, 0] : ["walk", v >> 1, v & 1];
}

/** Ekran almashganda ochiladigan piksel parda (styles.css: screen-wipe) — faqat bezak. */
function ScreenWipe() {
  return (
    <div aria-hidden="true" className="screen-wipe">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} style={{ animationDelay: `${(i % 5) * 28}ms` }} />
      ))}
    </div>
  );
}

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
  const pal = skinPalette(hero);
  // Paladinning ulkan qilichi va Samuray katanasi 32 px kartaga sig'maydi — kattaroq ko'rinish
  const view = heroView(hero);
  useEffect(() => {
    if (!active) return setFrame(0);
    // tanlangan qahramon joyida yuradi (oraliq kadrlar bilan — tezroq taymer)
    const id = window.setInterval(() => setFrame((f) => f + 1), showcase ? 160 : 110);
    return () => window.clearInterval(id);
  }, [active, showcase]);
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, view, view);
    const [state, f, sub] = showcase
      ? ([...SHOWCASE[frame % SHOWCASE.length]!, 0] as const)
      : selectedHeroFrame(hero, active ? frame : 0, active && !currentSettings().reduceFx);
    // tanlangan skin (do'kondan qaytganda menyu qayta chiziladi)
    renderSprite(c, hero, state, f, view / 2, view / 2, false, false, false, pal, sub);
  }, [hero, frame, showcase, view, pal, active]);
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
type ShopTab = "upgrades" | "heroes" | "skins";

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
        aria-label={t("shop.title")}
        className="fit-screen m-auto flex w-[min(94vw,640px)] flex-col overflow-hidden border-4 border-border bg-card text-[9px] sm:text-[10px] leading-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-col gap-3 px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-primary text-xs sm:text-sm">{t("m.shop")}</h2>
            <span className="inline-flex items-center gap-2 text-primary">
              <PixelIcon id="coin" color="#ffcc33" size={16} />
              {gold}
            </span>
          </div>
          <div role="tablist" aria-label={t("shop.tabsAria")} className="flex flex-wrap gap-2">
            {tabBtn("upgrades", t("shop.tabUpgrades"))}
            {tabBtn("heroes", t("shop.tabHeroes"))}
            {tabBtn("skins", t("shop.tabSkins"))}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-4">
          {tab === "skins" ? (
            <SkinsShop gold={gold} onGold={setGold} startHero={focusHero ?? loadPlayableHero()} />
          ) : tab === "upgrades" ? (
            <>
              <p className="text-muted-foreground">{t("shop.upgradesNote")}</p>
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
                          aria-label={t("shop.level", { n: lvl, total: item.costs.length })}
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
                            t("shop.maxed")
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
              <p className="text-muted-foreground">{t("shop.heroesNote")}</p>
              {award && (
                <p
                  role="status"
                  className="inline-flex items-center gap-2 self-start border-2 border-primary px-2 py-1 text-primary"
                >
                  <PixelIcon id="trophy" color="#ffcc33" size={12} />
                  {t("shop.achUnlocked", { name: award })}
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
                              {h.price > 0 ? t("shop.owned") : t("shop.free")}
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
                                {t("shop.buy")}
                                <PixelIcon id="coin" color="#ffcc33" size={10} />
                                {h.price}
                              </button>
                              {short > 0 && (
                                <span className="text-muted-foreground">
                                  {t("shop.needGold", { n: short })}
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
            {t("common.close")}
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
        aria-label={t("set.aria")}
        className={`settings-window fit-screen m-auto flex flex-col overflow-hidden border-4 border-border bg-card text-[10px] sm:text-xs leading-5 ${
          tab === "controls" ? "w-[min(96vw,760px)]" : "w-[min(92vw,420px)]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4">
          <h2 className="text-primary">{t("m.settings")}</h2>
          <div role="tablist" aria-label={t("set.tabsAria")} className="flex gap-2">
            {tabBtn("general", t("set.general"))}
            {tabBtn("controls", t("set.controls"))}
            <button
              onClick={onClose}
              aria-label={t("common.closeAria")}
              className={`border-2 border-border px-2 py-1 text-muted-foreground hover:border-foreground hover:text-foreground ${pixelPress} ${pixelFocus}`}
            >
              X
            </button>
          </div>
        </div>
        <div className="settings-body flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pb-4 pt-2">
          {tab === "general" ? (
            <>
              <div className="flex flex-col gap-2 text-foreground">
                <span>{t("settings.lang")}</span>
                <div
                  role="radiogroup"
                  aria-label={t("settings.lang")}
                  className="flex flex-wrap gap-2"
                >
                  {LANGS.map((l) => (
                    <button
                      key={l.id}
                      role="radio"
                      aria-checked={getLang() === l.id}
                      onClick={() => setLang(l.id)}
                      className={`border-2 px-2 py-1 ${pixelPress} ${pixelFocus} ${
                        getLang() === l.id
                          ? "border-primary text-primary"
                          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              {slider("music", t("set.music"), () => sfx.wave())}
              {slider("sfx", t("set.sfx"), () => sfx.pickup())}
              <Toggle label={t("set.shake")} on={s.shake} onChange={(v) => update({ shake: v })} />
              <Toggle
                label={t("set.dmg")}
                on={s.damageNumbers}
                onChange={(v) => update({ damageNumbers: v })}
              />
              <Toggle
                label={t("set.reduceFx")}
                on={s.reduceFx}
                onChange={(v) => update({ reduceFx: v })}
              />
              <p className="-mt-3 text-[8px] leading-4 text-muted-foreground">
                {t("set.reduceFxNote")}
              </p>
              <Toggle
                label={t("set.superShort")}
                on={s.superCardShort}
                onChange={(v) => update({ superCardShort: v })}
              />
              <p className="-mt-3 text-[8px] leading-4 text-muted-foreground">
                {t("set.superShortNote")}
              </p>
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
            {t("common.close")}
          </button>
          {/* pixelfx (MIT) — litsenziya talabi: muallif va litsenziya ko'rsatiladi */}
          <p className="text-[8px] leading-4 text-muted-foreground">{t("set.pixelfx")}</p>
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
        aria-label={t("m.giftT")}
        className="fit-screen flex w-[min(94vw,600px)] flex-col gap-3 overflow-y-auto border-4 border-primary bg-card p-3 sm:p-4 text-[10px] sm:text-xs leading-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-primary">
            <PixelIcon id="gift" color="#ffcc33" size={16} />
            {t("gift.title")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.closeAria")}
            className={`border-2 border-border px-2 py-1 text-muted-foreground hover:border-foreground hover:text-foreground ${pixelPress} ${pixelFocus}`}
          >
            X
          </button>
        </div>
        <p className="text-muted-foreground text-[9px] sm:text-[10px] leading-4">
          {t("gift.note")}
        </p>
        <ol aria-label={t("gift.daysAria")} className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {GIFT_REWARDS.map((gold, i) => {
            const day = i + 1;
            const today = day === status.day;
            const got = day < status.day || (today && status.claimed);
            const big = day === GIFT_REWARDS.length;
            return (
              <li
                key={day}
                aria-current={today ? "date" : undefined}
                aria-label={t("gift.dayAria", {
                  d: day,
                  g: gold,
                  s: got ? t("gift.got") : today ? t("gift.today") : "",
                })}
                className={cn(
                  "relative flex flex-col items-center gap-1 border-2 px-1 py-2 text-center",
                  today && !got
                    ? "gift-today border-primary bg-primary/15 text-primary"
                    : got
                      ? "border-primary/60 text-foreground/70"
                      : "border-border text-muted-foreground",
                )}
              >
                <span className="text-[8px] sm:text-[9px]">{t("gift.day", { d: day })}</span>
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
            {/* quti silkinib ochiladi, so'ng mukofot chiqadi (styles.css: gift-open) */}
            <span aria-hidden="true" className="gift-open self-start">
              <span className="gift-open-box" />
              <span className="gift-open-lid" />
            </span>
            <p className="gift-pop gift-late inline-flex items-center gap-2 self-start text-primary text-xs sm:text-sm">
              <PixelIcon id="coin" color="#ffcc33" size={16} />
              {t("gift.plusGold", { n: claim.gold })}
            </p>
            {!!claim.bonus && (
              <p className="text-[#ffd97a]">{t("gift.guildBonus", { n: claim.bonus })}</p>
            )}
            {claim.achievement && (
              <p className="inline-flex items-center gap-2 self-start border-2 border-primary px-2 py-1 text-primary">
                <PixelIcon id="trophy" color="#ffcc33" size={12} />
                {t("shop.achUnlocked", { name: claim.achievement.name })}
              </p>
            )}
            <p className="text-muted-foreground">
              {t("gift.tomorrow", { g: GIFT_REWARDS[next - 1] ?? 0, d: next })}
            </p>
          </div>
        ) : status.claimed ? (
          <p className="text-muted-foreground">
            {t("gift.claimedTomorrow", { g: GIFT_REWARDS[next - 1] ?? 0, d: next })}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {!status.claimed && (
            <button
              autoFocus
              onClick={take}
              className={cn(buttonVariants({ variant: "pixel", size: "none" }), "px-4 py-2")}
            >
              {t("gift.take", { n: status.reward })}
            </button>
          )}
          <button
            onClick={onClose}
            className={cn(
              buttonVariants({ variant: status.claimed ? "pixel" : "pixelOutline", size: "none" }),
              "px-4 py-2",
            )}
          >
            {t("common.close")}
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
    if (!c) return setError(t("join.codeHint"));
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
        aria-label={t("join.title")}
        className="flex w-[min(92vw,380px)] flex-col items-center gap-3 border-4 border-border bg-card p-4 text-center text-[10px] sm:text-xs leading-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-primary">{t("m.join")}</h2>
        <p className="text-muted-foreground">{t("join.note")}</p>
        <input
          autoFocus
          value={code}
          maxLength={7}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label={t("join.codeAria")}
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
        {locked && <p className="text-[#ff9a3c]">{t("join.needDevil")}</p>}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={submit}
            disabled={locked}
            className={cn(
              buttonVariants({ variant: "pixel", size: "none" }),
              "px-4 py-2 disabled:opacity-50",
            )}
          >
            {t("map.enter")}
          </button>
          <button
            onClick={onClose}
            className={cn(buttonVariants({ variant: "pixelOutline", size: "none" }), "px-4 py-2")}
          >
            {t("join.cancel")}
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
        <h2 className="text-primary">{t("exit.q")}</h2>
        <p className="text-muted-foreground">{t("exit.saved")}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={exitApp}
            className={cn(buttonVariants({ variant: "pixel", size: "none" }), "px-4 py-2")}
          >
            {t("exit.yes")}
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
        aria-label={t("ach.aria")}
        className="fit-screen m-auto flex w-[min(94vw,520px)] flex-col overflow-hidden border-4 border-border bg-card text-[9px] sm:text-[10px] leading-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="shrink-0 px-4 pb-3 pt-4 text-primary text-xs sm:text-sm">
          {t("m.achN", { n: got.size, total: ACHIEVEMENTS.length })}
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
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** t("news.aria") oynasidagi rasmli karta: rasm kod bilan chiziladi. */
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
    get title() {
      return t("news.n.map.t");
    },
    get text() {
      return t("news.n.map.x");
    },
    width: 320,
    height: 240,
    draw: (c, hero) => renderMap(c, new MapState(), 1.2, hero),
  },
  {
    get title() {
      return t("news.n.w3.t");
    },
    get text() {
      return t("news.n.w3.x");
    },
    width: 160,
    height: 120,
    draw: (c) => drawForestCard(c, 1),
  },
  {
    get title() {
      return t("news.n.hunter.t");
    },
    get text() {
      return t("news.n.hunter.x");
    },
    width: 160,
    height: 120,
    draw: (c) => drawHunterCard(c),
  },
];

/** 3.0 e'loni: Paladin, rollar va tank — katta rasmli kartalar. */
const NEWS_3_0: typeof NEWS_2_0 = [
  {
    get title() {
      return t("news.n.paladin.t");
    },
    get text() {
      return t("news.n.paladin.x");
    },
    width: 160,
    height: 120,
    draw: (c) => drawPaladinCard(c),
  },
  {
    get title() {
      return t("news.n.roles.t");
    },
    get text() {
      return t("news.n.roles.x");
    },
    width: 160,
    height: 120,
    draw: (c) => drawRolesCard(c),
  },
  {
    get title() {
      return t("news.n.tank.t");
    },
    get text() {
      return t("news.n.tank.x");
    },
    width: 160,
    height: 120,
    draw: (c) => drawTankCard(c),
  },
];

/** Yangi versiyaga birinchi kirishda: CHANGELOG'dagi oxirgi yozuv, har gap alohida qatorda. */
function NewsWindow({ onClose, hero }: { onClose: () => void; hero: Hero }) {
  const entry = CHANGELOG[0];
  if (!entry) return null;
  // katta e'lonlar (2.0, 3.0): rasmli kartalar
  const cards = entry.version.startsWith("2.0")
    ? NEWS_2_0
    : entry.version.startsWith("3.0")
      ? NEWS_3_0
      : null;
  const big = !!cards;
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
        aria-label={t("news.aria")}
        className={`fit-screen m-auto flex ${big ? "w-[min(94vw,720px)]" : "w-[min(92vw,480px)]"} flex-col overflow-hidden border-4 border-primary bg-card text-[10px] sm:text-xs leading-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="shrink-0 px-4 pb-3 pt-4 text-primary">
          {big ? `PIKSEL QAL'A ${entry.version.slice(0, 3)}!` : t("news.title")} · v{entry.version}
        </h2>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-4">
          {cards && (
            <ul aria-label={t("news.bigAria")} className="grid gap-3 sm:grid-cols-3">
              {cards.map((n) => (
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
            {t("news.play")}
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
          {t("common.close")}
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
    | "ninja"
    | "tengu"
    | "kitsune"
    | "oni"
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
      const r = await getCombatTip({ data: { enemy, problem, hero, lang: getLang() } });
      if (r.ok) setTip(r.text);
      else setError(r.error);
    } catch {
      setError(t("coach.err"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="w-full min-w-0 flex flex-col gap-3 text-[10px] sm:text-xs leading-5">
      <h2 className="text-primary">JANG MASLAHATCHISI (AI)</h2>
      <label className="flex flex-col gap-1 text-foreground">
        {t("coach.who")}
        <select
          value={enemy}
          onChange={(e) => setEnemy(e.target.value as typeof enemy)}
          className="bg-background text-foreground border-2 border-border p-2"
        >
          <optgroup label={t("coach.w1")}>
            <option value="slime">{t("coach.e.slime")}</option>
            <option value="bat">{t("coach.e.bat")}</option>
            <option value="skeleton">{t("coach.e.skeleton")}</option>
            <option value="archer">{t("coach.e.archer")}</option>
            <option value="boss">{t("coach.e.boss")}</option>
          </optgroup>
          <optgroup label={t("coach.w2")}>
            <option value="iceblob">{t("coach.e.iceblob")}</option>
            <option value="frost">{t("coach.e.frost")}</option>
            <option value="golem">{t("coach.e.golem")}</option>
            <option value="shield">{t("coach.e.shield")}</option>
            <option value="wolf">{t("coach.e.wolf")}</option>
            <option value="queen">{t("coach.e.queen")}</option>
          </optgroup>
          <optgroup label={t("coach.w3")}>
            <option value="spider">{t("coach.e.spider")}</option>
            <option value="shroom">{t("coach.e.shroom")}</option>
            <option value="treant">{t("coach.e.treant")}</option>
            <option value="owl">{t("coach.e.owl")}</option>
            <option value="king">{t("coach.e.king")}</option>
          </optgroup>
          <optgroup label={t("coach.w4")}>
            <option value="ninja">{t("coach.e.ninja")}</option>
            <option value="tengu">{t("coach.e.tengu")}</option>
            <option value="kitsune">{t("coach.e.kitsune")}</option>
            <option value="oni">{t("coach.e.oni")}</option>
          </optgroup>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-foreground">
        {t("coach.what")}
        <textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value.slice(0, 500))}
          rows={2}
          placeholder={t("coach.ph")}
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
        {loading ? t("coach.thinking") : t("coach.ask")}
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
    <div aria-label={t("map.aria")} className="pointer-events-none absolute inset-0">
      <div className="absolute inset-y-0 left-[1%] flex w-[10.5%] flex-col items-center justify-center gap-3">
        <button className={cn(btn, "pointer-events-auto w-full")} onClick={onBack}>
          {t("map.back")}
        </button>
        <button
          aria-label={t("map.leftAria")}
          className={cn(btn, "pointer-events-auto w-full")}
          onClick={() => mapRef.current?.move(-1)}
        >
          {"<"}
        </button>
      </div>
      <div className="absolute inset-y-0 right-[1%] flex w-[10.5%] flex-col items-center justify-center gap-3">
        <button
          aria-label={t("map.rightAria")}
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
          {t("map.enter")}
        </button>
      </div>
    </div>
  );
}
