/**
 * Olam klienti (brauzer): klaviatura/sichqoncha/sensor -> buyruqlar, qat'iy 20 Hz tick,
 * voqealar -> effekt va ovoz, chizish va saqlash.
 *
 * Oflayn: RealmSim shu yerda tick qilinadi (avvalgidek). Onlayn (server bo'lsa avtomatik):
 * buyruqlar serverga ketadi, olam ko'zgusi (net/mirror.ts) server holatidan to'ladi, o'z qahramoni
 * darhol ko'rsatiladi (net/predict.ts) va server bilan solishtirib tuzatiladi. Ulanish uzilsa —
 * o'sha joydan oflayn davom etadi; progress (inventar, topshiriqlar, oltin) yo'qolmaydi.
 */
import { Input } from "@/game/input";
import { Effects } from "@/game/effects";
import { sfx, type MusicTrack } from "@/game/audio";
import { HERO_THEME, type Hero } from "@/game/hero";
import { playableHero } from "@/game/save";
import { loadSettings, onSettingsChange } from "@/game/settings";
import { BOSS_BUZZ, HIT_BUZZ, vibrate } from "@/game/haptics";
import { addGold, loadGold, saveGold } from "@/game/shop";
import { REALM_SAVE_KEY, loadBossKeys, takeRealmInbox } from "@/game/realmLink";
import { loadRealmData } from "./data";
import {
  RealmSim,
  TICK_DT,
  type RealmCommand,
  type RealmEvent,
  type RealmPlayer,
  type RealmPlayerSave,
  type RealmWorldSave,
} from "./sim";
import { RARITY_COLOR } from "./icons";
import { MOB_STATS } from "./mobs";
import { RealmRenderer, VIEW_H, VIEW_W, type Panel, type RealmView } from "./render";
import {
  ANIMS,
  NET_VERSION,
  PHRASES,
  SEND_HZ,
  type HelloMsg,
  type ServerMsg,
} from "./net/protocol";
import { NetSession, browserDeps, type NetDeps, type NetStatus } from "./net/session";
import { RealmMirror } from "./net/mirror";
import { Predictor, SNAP_DIST } from "./net/predict";
import { SERVER_URL, guestTag, inviteLink, onlineWanted } from "./net/config";
import { telegramApp, telegramShare } from "@/lib/telegram";

export { REALM_SAVE_KEY };
/** Oflayn o'yinchi id'si (onlayn — server beradi) */
const PID = "me";
/** Klientda ham darhol qo'llanadigan buyruqlar (harakat bashorati); qolganlari — faqat serverda */
const LOCAL_CMDS = new Set<RealmCommand["type"]>(["move", "attack", "ability", "reload", "aim"]);
const BOSS_KEY_IDS = ["devil", "queen", "king"] as const;
type BossKeyId = (typeof BOSS_KEY_IDS)[number];

export interface RealmOptions {
  /** do'st chaqiruvi: shu xona kodiga kirish */
  room?: string | null;
}
/** Har shuncha soniyada avtomatik saqlash */
const SAVE_EVERY = 10;

export interface RealmSave {
  v: 1;
  world: RealmWorldSave;
  player: RealmPlayerSave;
  intro: boolean;
  /** v2.2.1 dan: oltin asosiy o'yin bilan umumiy (eski olam oltini bir marta qo'shilgan) */
  sharedGold?: boolean;
}

export function loadRealmSave(): RealmSave | null {
  try {
    const raw = localStorage.getItem(REALM_SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as RealmSave;
    return s && s.v === 1 && s.world && s.player ? s : null;
  } catch {
    return null;
  }
}

function writeRealmSave(s: RealmSave) {
  try {
    localStorage.setItem(REALM_SAVE_KEY, JSON.stringify(s));
  } catch {
    /* saqlash imkonsiz */
  }
}

export class RealmClient {
  input = new Input();
  sim: RealmSim;
  me: RealmPlayer;
  /** joriy o'yinchi id'si: oflayn "me", onlayn — server bergani */
  pid = PID;
  /** onlayn ulanish (server sozlanmagan yoki oflayn — null) */
  net: NetSession | null = null;
  private mirror: RealmMirror | null = null;
  private pred = new Predictor();
  /** serverga ketadigan buyruqlar (ko'pi bilan 10 Hz) */
  private outbox: RealmCommand[] = [];
  private lastFlush = -99;
  private room: string | null;
  /** "do'stni chaqirish" pauzadan ochilgan */
  private inviteBack = false;
  fx = new Effects();
  touch = false;
  onExit: (() => void) | null = null;
  /** Pauzadagi SOZLAMALAR (React oynani ochadi; olam pauzada qoladi) */
  onSettings: (() => void) | null = null;
  private offSettings: (() => void) | null = null;
  view: RealmView;
  private renderer = new RealmRenderer();
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private time = 0;
  private pending: RealmCommand[] = [];
  private axis = { x: 0, y: 0 };
  private atkHeld = false;
  private dashHeld = false;
  private releaseAttack = false;
  private releaseAbility = false;
  private saveT = 0;
  private music: MusicTrack | null = null;
  private shakeOn = true;
  /** asosiy o'yin hisobidagi oltin (olamda o'zgarsa darhol yoziladi) */
  private gold = 0;
  /** Sardor yurish kadri (qadam — chang) */
  private wardenStep = new Map<number, number>();

  constructor(
    private canvas: HTMLCanvasElement,
    public hero: Hero,
    opts: RealmOptions = {},
  ) {
    this.room = opts.room ?? null;
    // olamda ham faqat ochilgan (sotib olingan) qahramon o'ynaydi
    hero = this.hero = playableHero(hero);
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    // olamda J — jurnal, M — xarita, E — gaplashish (qayta belgilansa ham shu amallar ustun)
    this.input.setContext("realm");
    const settings = loadSettings();
    this.shakeOn = settings.shake;
    sfx.setVolumes(settings.music, settings.sfx);
    this.sim = new RealmSim(loadRealmData());
    const save = loadRealmSave();
    if (save) this.sim.loadWorld(save.world);
    this.me = this.sim.addPlayer(this.pid, hero, save?.player ?? null);
    // oltin asosiy o'yin bilan umumiy: eski saqlanishdagi olam oltini bir marta hisobga qo'shiladi
    if (save && !save.sharedGold && save.player.gold > 0) addGold(save.player.gold);
    this.me.gold = this.gold = loadGold();
    this.me.keys = [...loadBossKeys()];
    this.view = {
      sim: this.sim,
      me: this.me,
      alpha: 0,
      time: 0,
      fx: this.fx,
      touch: false,
      keys: this.input.keyBinds,
      panel: save?.intro ? "none" : "intro",
      sel: 0,
      hover: null,
      toasts: [],
      banner: { text: "", sub: "", t: 0, color: "#ffe14d" },
      shake: 0,
      buttons: [],
      net: { mode: "offline", n: 1, ping: 0, code: null },
      names: new Map(),
      bubbles: new Map(),
      chatOpen: false,
      link: null,
      share: telegramApp() ? "telegram" : typeof navigator.share === "function" ? "share" : null,
      canConnect: !!SERVER_URL,
      act: {
        choose: (i) => this.send({ type: "choose", index: i }),
        buy: (item) => this.send({ type: "buy", item }),
        sell: (slot) => this.send({ type: "sell", slot }),
        use: (slot) => this.send({ type: "use", slot }),
        close: () => this.closeTop(),
        panel: (p) => this.setPanel(p),
        exit: () => this.exitToMenu(),
        settings: () => this.onSettings?.(),
        invite: () => this.openInvite(),
        copy: () => void this.copyInvite(),
        share: () => void this.shareInvite(),
        chat: () => this.toggleChat(),
        say: (i) => this.say(i),
        reconnect: () => this.connect(),
      },
    };
    // asosiy o'yindan kelgan buyumlar (masalan, Iblis shoxi)
    for (const item of takeRealmInbox()) {
      this.sim.grant(this.me, item);
      const def = this.sim.data.items[item];
      if (def) this.toast(`Asosiy o'yindan keldi: ${def.name}`, RARITY_COLOR[def.rarity]);
    }
  }

  /** TouchControls bilan moslik (Game kabi) */
  get player() {
    return this.me.p;
  }

  /** Buyruq keyingi tickda qo'llanadi (onlayn — serverga yuboriladi). */
  send(cmd: RealmCommand) {
    this.pending.push(cmd);
  }

  /** Onlayn xonadami */
  get online() {
    return this.mirror !== null;
  }

  /** Server bilan ulanish (start'da avtomatik). deps — test/dev uchun boshqa tarmoq. */
  connect(deps: NetDeps = browserDeps(SERVER_URL, NET_VERSION), room = this.room) {
    this.net?.close();
    this.goOffline();
    this.room = room;
    const net = new NetSession(deps, { code: room, hello: (near) => this.hello(near) });
    this.net = net;
    net.onMessage = (m) => this.onNet(m);
    net.onStatus = (s) => this.onNetStatus(net, s);
    this.view.net.mode = "connecting";
    net.start();
  }

  /** Salomlashuv: joriy progress bilan (har ulanishda yangidan) */
  private hello(near: boolean): HelloMsg {
    return {
      t: "hello",
      v: NET_VERSION,
      tag: guestTag(),
      hero: this.hero,
      save: this.sim.savePlayer(this.pid),
      keys: this.me.keys.filter((k): k is BossKeyId =>
        (BOSS_KEY_IDS as readonly string[]).includes(k),
      ),
      near,
    };
  }

  private onNet(m: ServerMsg) {
    if (m.t === "welcome") this.goOnline(m.pid, m.code, m.tick, m.n);
    else if (m.t === "s") this.mirror?.apply(m, performance.now() / 1000);
    else if (m.t === "chat") this.onChat(m.pid, m.name, m.p);
  }

  private onNetStatus(net: NetSession, s: NetStatus) {
    if (net !== this.net) return;
    const v = this.view.net;
    if (s === "online") {
      v.mode = "online";
      return;
    }
    // uzildi yoki rad etildi: shu joydan oflayn davom etadi
    this.goOffline();
    if (s === "offline") {
      v.mode = "offline";
      if (net.notice) this.toast(net.notice, "#ff9a3c");
      this.toast("Oflayn rejim", "#ff9a3c");
    } else v.mode = "connecting";
  }

  /** Onlaynga o'tish: ko'zgu joriy progressdan quriladi, keyin server holati bilan to'ladi */
  private goOnline(pid: string, code: string, tick: number, n: number) {
    const keys = this.me.keys;
    const mirror = new RealmMirror(
      this.sim.data,
      pid,
      this.hero,
      this.sim.savePlayer(this.pid),
      tick,
    );
    mirror.me.keys = keys;
    mirror.n = n;
    this.mirror = mirror;
    this.useSim(mirror.sim, mirror.me, pid);
    this.view.names = mirror.names;
    this.pred.reset();
    Object.assign(this.view.net, { mode: "online", n, code });
    const notice = this.net?.notice;
    if (notice && this.net) this.net.notice = null;
    this.toast(notice ?? `Onlayn: ${code} xonasi`, notice ? "#ff9a3c" : "#7be07b");
  }

  /** Oflaynga o'tish: ko'zgudagi dunyo va progress bilan mahalliy RealmSim */
  private goOffline() {
    if (!this.mirror) return;
    const keys = this.me.keys;
    const player = this.sim.savePlayer(this.pid);
    const sim = new RealmSim(this.sim.data);
    sim.loadWorld(this.sim.saveWorld());
    const me = sim.addPlayer(PID, this.hero, player);
    me.keys = keys;
    this.mirror = null;
    this.useSim(sim, me, PID);
    this.view.names = new Map();
    this.view.net.n = 1;
  }

  private useSim(sim: RealmSim, me: RealmPlayer, pid: string) {
    this.sim = sim;
    this.me = me;
    this.pid = pid;
    this.view.sim = sim;
    this.view.me = me;
    // server yangi o'yinchini to'xtab turgan holda boshlaydi — yo'nalish birinchi tick'da qayta
    // yuboriladi (bu bashorat va server tick'larini darhol moslaydi)
    this.axis = { x: NaN, y: NaN };
    this.atkHeld = this.dashHeld = false;
    this.outbox = [];
    this.lastFlush = -99;
    this.wardenStep.clear();
  }

  /** Tayyor ibora (chat) */
  say(p: number) {
    this.view.chatOpen = false;
    if (!this.net || !this.online) return;
    this.net.chat(p);
  }

  toggleChat() {
    this.view.chatOpen = this.online && !this.view.chatOpen;
  }

  /** "DO'STNI CHAQIRISH" oynasi (pauza menyusi va olam HUD'idan) */
  openInvite() {
    const code = this.online ? this.view.net.code : null;
    this.view.link = code ? inviteLink(code) : null;
    this.view.chatOpen = false;
    this.inviteBack = this.view.panel === "pause";
    this.view.panel = "invite";
    this.view.sel = 0;
  }

  private inviteText() {
    return `Piksel Qal'a: Abadiyat olamida birga o'ynaymiz! Xona kodi: ${this.view.net.code}`;
  }

  /** Havolani nusxalash (bosish ichida — brauzer ruxsat beradi) */
  private async copyInvite() {
    const link = this.view.link;
    if (!link) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(link);
      ok = true;
    } catch {
      // eski WebView: yashirin matn maydoni orqali
      try {
        const t = document.createElement("textarea");
        t.value = link;
        t.style.position = "fixed";
        t.style.opacity = "0";
        document.body.appendChild(t);
        t.select();
        ok = document.execCommand("copy");
        t.remove();
      } catch {
        /* nusxalab bo'lmadi */
      }
    }
    this.toast(
      ok ? "Havola nusxalandi" : "Nusxalab bo'lmadi — kodni ayting",
      ok ? "#7be07b" : "#ff9a3c",
    );
  }

  /** Telegram ichida — Telegram ulashish oynasi, aks holda telefonning ulashish oynasi */
  private async shareInvite() {
    const link = this.view.link;
    if (!link) return;
    if (telegramShare(link, this.inviteText())) return;
    try {
      await navigator.share({ title: "Piksel Qal'a", text: this.inviteText(), url: link });
    } catch {
      /* bekor qilindi yoki qo'llanmaydi */
    }
  }

  private onChat(pid: string, name: string, p: number) {
    const text = PHRASES[p];
    if (!text) return;
    this.view.bubbles.set(pid, { text, t: 3 });
    this.toast(`${pid === this.pid ? "Siz" : name}: ${text}`, "#9fd0ef");
    sfx.pickup();
  }

  setPanel(p: Panel) {
    if (p === "pause") this.save();
    // pauzadan ochilgan "do'stni chaqirish" yopilsa — pauzaga qaytadi
    if (p === "invite" && this.view.panel === "invite" && this.inviteBack) {
      this.view.panel = "pause";
      this.view.sel = 0;
      return;
    }
    this.view.panel = this.view.panel === p ? "none" : p;
    if (this.view.panel === "none" && p === "intro") this.save();
    this.view.sel = 0;
  }

  /** Sensor: hozir yurish mumkinmi (oyna va panellar ochiq bo'lmasa) */
  acceptsMove() {
    return !this.me.ui && this.view.panel === "none" && !this.me.p.dead;
  }

  /** Sensor: ekrandagi nuqtada olam tugmasi (inventar, minixarita) bormi */
  touchUiAt(clientX: number, clientY: number) {
    const { x, y } = this.toView({ clientX, clientY });
    return this.view.buttons.some((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  }

  /** Sensor tugmalari */
  pressInteract() {
    this.confirm();
  }
  toggleJournal() {
    if (!this.me.ui) this.setPanel("journal");
  }
  toggleMap() {
    if (!this.me.ui) this.setPanel("map");
  }
  pressPause() {
    this.input.pressPause();
  }

  private closeTop() {
    if (this.me.ui) {
      // yozuv va lore E bilan yopiladi (interact), dialog/do'kon — close
      this.send(
        this.me.ui.kind === "sign" || this.me.ui.kind === "lore"
          ? { type: "interact" }
          : { type: "close" },
      );
      this.view.sel = 0;
    } else if (this.view.panel !== "none") this.setPanel(this.view.panel);
  }

  private get frozen() {
    return this.view.panel === "pause" || this.view.panel === "intro";
  }

  /** E / Enter / Space: dialogda tanlash, do'konda olish-sotish, aks holda gaplashish. */
  private confirm() {
    const ui = this.me.ui;
    const v = this.view;
    if (v.panel === "intro") return this.setPanel("intro");
    if (v.panel !== "none") return this.setPanel(v.panel);
    if (ui?.kind === "dialog") {
      this.send({ type: "choose", index: v.sel });
      v.sel = 0;
      return;
    }
    if (ui?.kind === "shop") {
      const list = this.sim.shopList(ui.npc);
      if (v.sel < list.length) this.send({ type: "buy", item: list[v.sel]! });
      else this.send({ type: "sell", slot: v.sel - list.length });
      return;
    }
    this.send({ type: "interact" });
  }

  private moveSel(d: number) {
    const ui = this.me.ui;
    const n =
      ui?.kind === "dialog"
        ? this.sim.visibleChoices(this.me).length
        : ui?.kind === "shop"
          ? this.sim.shopList(ui.npc).length + 8
          : 0;
    if (n) this.view.sel = (this.view.sel + d + n) % n;
  }

  private toView(e: { clientX: number; clientY: number }) {
    const r = this.canvas.getBoundingClientRect();
    const bx = ((e.clientX - r.left) / r.width) * this.canvas.width;
    const by = ((e.clientY - r.top) / r.height) * this.canvas.height;
    const scale = Math.min(this.canvas.width / VIEW_W, this.canvas.height / VIEW_H);
    return {
      x: (bx - (this.canvas.width - VIEW_W * scale) / 2) / scale,
      y: (by - (this.canvas.height - VIEW_H * scale) / 2) / scale,
    };
  }

  private hitButton(x: number, y: number) {
    const bs = this.view.buttons;
    for (let i = bs.length - 1; i >= 0; i--) {
      const b = bs[i]!;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        b.act();
        return true;
      }
    }
    return false;
  }

  /** Kursor yo'nalishi (o'yinchiga nisbatan, ekran koordinatasida) */
  private aimAt(x: number, y: number) {
    const p = this.me.p;
    const camX = Math.max(0, Math.min(this.sim.map.w * 16 - VIEW_W, p.x - VIEW_W / 2));
    const camY = Math.max(0, Math.min(this.sim.map.h * 16 - VIEW_H, p.y - VIEW_H / 2));
    this.send({ type: "aim", x: x + camX - p.x, y: y + camY - p.y });
  }

  private onClick = (e: MouseEvent) => {
    sfx.unlock();
    const { x, y } = this.toView(e);
    if (this.hitButton(x, y)) return;
    if (this.me.ui || this.view.panel !== "none" || this.touch) return;
    // dunyoga bosish: shu tomonga hujum
    this.aimAt(x, y);
    this.send({ type: "attack", down: true });
    this.releaseAttack = true;
  };

  private onContext = (e: MouseEvent) => {
    e.preventDefault();
    if (this.me.ui || this.view.panel !== "none") return;
    const { x, y } = this.toView(e);
    this.aimAt(x, y);
    this.send({ type: "ability", down: true });
    this.releaseAbility = true;
  };

  private onMove = (e: MouseEvent) => {
    this.view.hover = this.toView(e);
  };

  private onVisibility = () => {
    if (document.hidden) {
      this.save();
      if (this.view.panel === "none") this.setPanel("pause");
      // onlayn olam to'xtamaydi: fonda qahramon joyida tursin
      this.halt();
    }
  };
  private onBlur = () => {
    if (this.view.panel === "none") this.setPanel("pause");
  };

  start() {
    this.input.attach();
    // SOZLAMALAR o'zgarsa darhol: silkinish (ovoz oynaning o'zida qo'llanadi)
    this.offSettings = onSettingsChange((st) => {
      this.shakeOn = st.shake;
    });
    this.canvas.addEventListener("click", this.onClick);
    this.canvas.addEventListener("contextmenu", this.onContext);
    this.canvas.addEventListener("mousemove", this.onMove);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("blur", this.onBlur);
    if (onlineWanted()) this.connect();
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.save();
    this.net?.close();
    this.net = null;
    this.input.detach();
    this.offSettings?.();
    this.offSettings = null;
    this.canvas.removeEventListener("click", this.onClick);
    this.canvas.removeEventListener("contextmenu", this.onContext);
    this.canvas.removeEventListener("mousemove", this.onMove);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("blur", this.onBlur);
    sfx.stopMusic();
    sfx.resume();
  }

  exitToMenu() {
    this.save();
    this.onExit?.();
  }

  save() {
    const player = this.sim.savePlayer(this.pid);
    if (!player) return;
    writeRealmSave({
      v: 1,
      world: this.sim.saveWorld(),
      player,
      intro: this.view.panel !== "intro",
      sharedGold: true,
    });
  }

  private keys() {
    const inp = this.input;
    const ui = this.me.ui;
    if (inp.consumePause()) {
      if (ui) this.closeTop();
      else if (this.view.chatOpen) this.view.chatOpen = false;
      else this.setPanel(this.view.panel === "none" ? "pause" : this.view.panel);
    }
    if (inp.consumeKey("KeyQ") && this.view.panel === "pause") this.exitToMenu();
    // T — tayyor iboralar (agar T boshqa amalga belgilanmagan bo'lsa)
    if (!Object.values(inp.keyBinds).flat().includes("KeyT") && inp.consumeKey("KeyT"))
      this.toggleChat();
    if (inp.consumeAction("journal")) this.toggleJournal();
    if (inp.consumeAction("map")) this.toggleMap();
    // Enter doim tasdiqlaydi; gaplashish tugmasi (asl E) qayta belgilanishi mumkin
    if (inp.consumeAction("interact") || inp.consumeKey("Enter", "NumpadEnter")) this.confirm();
    if (ui?.kind === "dialog" || ui?.kind === "shop") {
      const prev = [inp.consumeAction("up"), inp.consumeAction("left")];
      const next = [inp.consumeAction("down"), inp.consumeAction("right")];
      if (prev.some(Boolean) || inp.consumeKey("ArrowUp", "ArrowLeft")) this.moveSel(-1);
      if (next.some(Boolean) || inp.consumeKey("ArrowDown", "ArrowRight")) this.moveSel(1);
    }
    for (let i = 0; i < 8; i++)
      if (inp.consumeKey(`Digit${i + 1}`)) {
        if (this.view.chatOpen && !ui) {
          if (i < PHRASES.length) this.say(i);
        } else if (ui?.kind === "dialog") this.send({ type: "choose", index: i });
        else if (ui?.kind === "shop") this.send({ type: "sell", slot: i });
        else if (!ui) this.send({ type: "use", slot: i });
      }
    // Space: oynalarda — tasdiqlash
    if (ui || this.view.panel !== "none") {
      if (inp.consumeAttack()) this.confirm();
      inp.consumeDash();
    }
  }

  private frame(dt: number) {
    this.time += dt;
    this.keys();
    const v = this.view;
    // onlayn olam pauzada ham yashaydi (boshqalar o'ynayapti) — faqat boshqaruv to'xtaydi
    const still = this.frozen && !this.online;
    if (!still) {
      this.acc += dt;
      while (this.acc >= TICK_DT) {
        this.acc -= TICK_DT;
        this.tick();
      }
    } else this.acc = 0;
    this.mirror?.update(performance.now() / 1000, dt);
    this.input.endFrame();
    this.fx.update(dt);
    for (const t of v.toasts) t.t -= dt / 2.5;
    v.toasts = v.toasts.filter((t) => t.t > 0);
    if (v.banner.t > 0) v.banner.t -= dt / 2.5;
    for (const [id, b] of v.bubbles) if ((b.t -= dt) <= 0) v.bubbles.delete(id);
    v.net.ping = this.net?.rtt ?? 0;
    if (this.mirror) v.net.n = this.mirror.n;
    v.alpha = still ? 1 : this.acc / TICK_DT;
    v.time = this.time;
    v.touch = this.touch;
    v.keys = this.input.keyBinds;
    v.shake = this.shakeOn && !this.frozen ? this.fx.shake : 0;
    v.me = this.me;
    this.renderer.render(this.ctx, v);
  }

  /** Bu tick'dagi buyruqlar: kiritish holatidan (faqat o'zgarganda) va oynalardan */
  private gather(): RealmCommand[] {
    const inp = this.input;
    const cmds: RealmCommand[] = this.pending;
    this.pending = [];
    const blocked = !!this.me.ui || this.view.panel !== "none";
    const a = blocked ? { x: 0, y: 0 } : inp.axis();
    if (a.x !== this.axis.x || a.y !== this.axis.y) {
      this.axis = { x: a.x, y: a.y };
      cmds.push({ type: "move", x: a.x, y: a.y });
    }
    // faqat bosish va qo'yib yuborish yuboriladi (bosib turish — kuchli zarba / tuzoq)
    if (!blocked) {
      if (inp.consumeAttack()) cmds.push({ type: "attack", down: true });
      if (inp.consumeDash()) cmds.push({ type: "ability", down: true });
    }
    // Mergan: R (telefonda o'q belgisi) — qayta o'qlash; oynalar ochiq bo'lsa e'tiborsiz
    if (inp.consumeReload() && !blocked) cmds.push({ type: "reload" });
    const pressed = (t: "attack" | "ability") => cmds.some((c) => c.type === t && c.down);
    // qisqa bosish bitta tick ichida qo'yib yuborilgan bo'lsa ham "qo'yib yuborish" yuboriladi
    const atk = !blocked && inp.attackHeld();
    if ((this.atkHeld || pressed("attack")) && !atk && !this.releaseAttack)
      cmds.push({ type: "attack", down: false });
    this.atkHeld = atk;
    const dash = !blocked && inp.dashHeld();
    if ((this.dashHeld || pressed("ability")) && !dash && !this.releaseAbility)
      cmds.push({ type: "ability", down: false });
    this.dashHeld = dash;
    // sichqoncha bosishi: keyingi tickda qo'yib yuboriladi
    if (this.releaseAttack && !pressed("attack")) {
      if (!atk) cmds.push({ type: "attack", down: false });
      this.releaseAttack = false;
    }
    if (this.releaseAbility && !pressed("ability")) {
      if (!dash) cmds.push({ type: "ability", down: false });
      this.releaseAbility = false;
    }
    return cmds;
  }

  private tick() {
    const cmds = this.gather();
    let events: RealmEvent[];
    if (this.mirror) {
      this.tickOnline(cmds);
      events = this.mirror.events;
      this.mirror.events = [];
    } else {
      this.sim.step(cmds.map((cmd) => ({ pid: PID, cmd })));
      // qayta tug'ilishda Player obyekti yangilanadi
      this.me = this.view.me = this.sim.players.get(PID)!;
      events = this.sim.events;
    }
    if (this.me.gold !== this.gold) {
      // umumiy hisob: asosiy o'yindagi o'zgarishni ham saqlab, farqni qo'shamiz
      this.gold = Math.max(0, loadGold() + this.me.gold - this.gold);
      this.me.gold = this.gold;
      saveGold(this.gold);
    }
    for (const e of events) this.onEvent(e);
    // Sardorning og'ir qadami: oyoq yerga tekkan kadrda chang va juda yengil silkinish
    // (silkinish sozlamada o'chirilgan bo'lsa view.shake 0 — ko'rinmaydi)
    for (const m of this.sim.mobs) {
      if (m.kind !== "warden") continue;
      const f = m.anim.state === "walk" ? m.anim.frame : -1;
      if (f !== this.wardenStep.get(m.id) && (f === 0 || f === 2)) {
        const foot = f === 0 ? -1 : 1;
        this.fx.burst(m.x + foot * m.face * 10, m.y + m.size / 2, "#b8a888", 4, 22, 1);
        if (Math.hypot(m.x - this.me.p.x, m.y - this.me.p.y) < 200) this.fx.addShake(0.06);
      }
      this.wardenStep.set(m.id, f);
    }
    // hamladagi Sardor va to'ng'iz orqasida chang ko'tariladi
    for (const m of this.sim.mobs)
      if (m.state === "attack" && (m.kind === "warden" || m.kind === "boar") && !m.dead)
        this.fx.burst(m.x - m.dirX * m.size * 0.5, m.y + m.size * 0.4, "#b8a888", 2, 25, 1);
    if (this.me.p.dashing && !this.me.p.mage)
      this.fx.trail(this.me.p.x, this.me.p.y + 2, HERO_THEME[this.hero].trail);
    this.updateMusic();
    this.saveT += TICK_DT;
    if (this.saveT >= SAVE_EVERY) {
      this.saveT = 0;
      this.save();
    }
  }

  /** Onlayn tick: buyruqlar navbatga (ko'pi bilan 10 Hz serverga), o'z qahramoni bashorati */
  private tickOnline(cmds: RealmCommand[]) {
    for (const c of cmds) {
      // yurish — faqat oxirgisi muhim
      if (c.type === "move") this.outbox = this.outbox.filter((o) => o.type !== "move");
      this.outbox.push(c);
    }
    const pred = this.pred;
    pred.tick++;
    if (pred.tick - this.lastFlush >= 20 / SEND_HZ) this.flush();
    const me = this.me,
      p0 = me.p;
    me.px = p0.x;
    me.py = p0.y;
    // server holati: jon, o'lim, qayta tug'ilish va joy tuzatishi (silliq: px eski joyda qoladi)
    if (this.mirror?.fresh) {
      this.mirror.fresh = false;
      this.reconcile();
    }
    const p = me.p;
    if (p.dead) p.anim.update(TICK_DT);
    else {
      this.sim.movePlayer(me, TICK_DT);
      // o'q, tuzoq, tutun va xabarlar serverdan keladi
      p.bolts = [];
      p.traps = [];
      p.smokes = [];
      p.teleportFrom = null;
      p.trapDenied = p.smokeDenied = p.cutFree = false;
      if (p.hidden && !this.sim.inSmoke(p)) p.hideT = 0;
    }
    pred.record(p.x, p.y);
    if (pred.tick % 2 === 0) this.sim.explore(me);
  }

  /** Navbatdagi buyruqlarni serverga yuborish va o'zida ham qo'llash (shu tick raqami bilan) */
  private flush() {
    if (!this.outbox.length) return;
    const batch = this.outbox.slice(-16);
    this.outbox = [];
    for (const c of batch) if (LOCAL_CMDS.has(c.type)) this.sim.command(this.me, c);
    this.net?.sendCmds(this.pred.tick, batch);
    this.lastFlush = this.pred.tick;
  }

  /** Fonga o'tganda (onlayn): qahramon darhol to'xtaydi */
  private halt() {
    if (!this.online) return;
    this.axis = { x: 0, y: 0 };
    this.atkHeld = this.dashHeld = false;
    this.outbox.push(
      { type: "move", x: 0, y: 0 },
      { type: "attack", down: false },
      { type: "ability", down: false },
    );
    this.flush();
  }

  /** Server holati bilan solishtirish */
  private reconcile() {
    const m = this.mirror;
    const s = m?.self;
    if (!m || !s) return;
    const me = this.me;
    let p = me.p;
    const dead = ANIMS[s[9]] === "death";
    if (p.dead && !dead) {
      // qayta tug'ildi (qishloqda)
      const old = p;
      me.p = p = me.makePlayer(s[3], s[4]);
      p.fx = old.fx;
      p.fy = old.fy;
      me.base = { maxHp: p.maxHp, damage: p.damage, speed: p.speed };
      this.sim.applyBonuses(me);
      p.hp = s[5];
      me.px = p.x;
      me.py = p.y;
      this.pred.forget();
      return;
    }
    // zarba: miltillash, ovoz va qisqa daxlsizlik o'zida; itarilishni joy tuzatishi beradi
    if (s[5] < p.hp) p.takeHit(p.hp - s[5], p.x, p.y, 0);
    p.hp = s[5];
    if (dead && !p.dead) p.anim.set("death", true);
    const c = this.pred.correction(m.ack + m.at, s[3], s[4]);
    if (!c) return;
    const nx = p.x + c.dx,
      ny = p.y + c.dy;
    if (Math.hypot(c.dx, c.dy) > SNAP_DIST || this.sim.boxBlocked(nx, ny, p.size)) {
      p.x = me.px = s[3];
      p.y = me.py = s[4];
      this.pred.forget();
    } else {
      p.x = nx;
      p.y = ny;
    }
  }

  private toast(text: string, color = "#e0d6ee") {
    this.view.toasts.push({ text, color, t: 1 });
    if (this.view.toasts.length > 4) this.view.toasts.shift();
  }

  private banner(text: string, sub = "", color = "#ffe14d") {
    this.view.banner = { text, sub, t: 1, color };
  }

  private updateMusic() {
    const boss = this.sim.mobs.some((m) => m.kind === "warden" && m.target === this.pid && !m.dead);
    const track: MusicTrack = boss ? "boss" : this.sim.night ? "forest" : "normal";
    if (track !== this.music) {
      this.music = track;
      sfx.playMusic(track);
    }
  }

  private onEvent(e: RealmEvent) {
    const fx = this.fx;
    const mine = !("pid" in e) || e.pid === this.pid;
    switch (e.type) {
      case "hit":
        if (e.kind === "wall") {
          fx.burst(e.x, e.y, "#8a8692", 8, 50, 2);
          sfx.chestHit();
          return;
        }
        fx.burst(e.x, e.y, "#ffffff", 5, 60, 1);
        fx.text(e.x, e.y - 6, String(e.dmg), "#ffe14d");
        sfx.hit();
        return;
      case "kill":
        fx.burst(
          e.x,
          e.y,
          e.kind === "wisp"
            ? "#45b8e0"
            : e.kind === "sentinel" || e.kind === "warden"
              ? "#8a8692"
              : "#a8323a",
          14,
          80,
          2,
        );
        sfx.kill();
        if (e.kind === "warden" && mine) {
          this.banner("SARDOR YENGILDI!", "Xarobalar jim bo'ldi", "#ffb02e");
          sfx.victory();
        }
        return;
      case "mobHurtPlayer":
        if (e.pid === this.pid) {
          fx.addShake(0.15);
          fx.burst(e.x, e.y, "#ff4d6d", 8, 60, 1);
          // telefonda qisqa tebranish; Sardor (boss) zarbasi — kuchliroq
          if (this.touch) {
            const boss = this.sim.mobs.some(
              (m) => m.kind === "warden" && m.target === this.me.id && !m.dead,
            );
            vibrate(boss ? BOSS_BUZZ : HIT_BUZZ);
          }
        }
        return;
      case "bonk":
        fx.burst(e.x, e.y, "#d8c8a8", 10, 60, 2);
        fx.addShake(0.1);
        sfx.stomp();
        return;
      case "slam":
        fx.burst(e.x, e.y, "#8a8692", 16, 90, 2);
        fx.addShake(0.25);
        sfx.stomp();
        return;
      case "rocks":
        fx.burst(e.x, e.y, "#6e6a72", 12, 70, 2);
        fx.addShake(0.12);
        sfx.stomp();
        return;
      case "burst":
        fx.burst(e.x, e.y, "#c4f3ff", 16, 90, 2);
        sfx.fireball();
        return;
      case "wake":
        fx.burst(e.x, e.y - 10, "#5fe0c8", 6, 40, 1);
        sfx.block();
        return;
      case "roar":
        this.banner(MOB_STATS.warden.name, "Qadimiy qo'riqchi uyg'ondi!", "#ff7a2a");
        fx.addShake(0.3);
        sfx.roar();
        return;
      case "rage":
        if (e.phase === 3)
          this.banner("TOSH QO'RIQCHILAR!", "Sardor qo'riqchilarni uyg'otdi", "#5fe0c8");
        else this.banner("SARDOR G'AZABDA!", "Yer to'lqinidan dash bilan o'ting!", "#ff7a2a");
        fx.burst(e.x, e.y, "#ff7a2a", 20, 100, 2);
        fx.addShake(0.3);
        sfx.roar();
        return;
      case "block":
        // Sardor qalqoni to'sdi: orqasidan urish kerak
        fx.burst(e.x, e.y, "#ffe14d", 8, 80, 1);
        fx.text(e.x, e.y - 12, "QALQON!", "#c9a25a");
        sfx.block();
        return;
      case "ring":
        fx.addShake(0.12);
        return;
      case "evade":
        fx.text(e.x, e.y - 10, "QAYTDI", "#8a7a9a");
        return;
      case "pickup": {
        if (!mine) return;
        const def = this.sim.data.items[e.item];
        if (!def) return;
        this.toast(`+${e.n} ${def.name}`, RARITY_COLOR[def.rarity]);
        sfx.pickup();
        return;
      }
      case "gold":
        if (!mine) return;
        fx.text(e.x, e.y - 8, `+${e.n}`, "#ffcc33");
        sfx.pickup();
        return;
      case "secret":
        if (!mine) return;
        this.banner("KASHFIYOT!", `Kashfiyotlar: ${this.me.secrets.length}/?`, "#c9a25a");
        fx.burst(e.x, e.y, "#ffe14d", 24, 100, 2);
        sfx.upgrade();
        return;
      case "toast":
        if (mine) this.toast(e.text);
        return;
      case "quest":
        if (!mine) return;
        this.toast(e.text, "#ffe14d");
        sfx.upgrade();
        return;
      case "landmark":
        if (mine) this.banner(e.name);
        return;
      case "torch":
        fx.burst(e.x, e.y - 8, e.lit ? "#ff9a3c" : "#6e6a72", 10, 50, 1);
        if (e.lit) sfx.chestHit();
        return;
      case "door":
        fx.burst(e.x, e.y, "#9fd0ef", 16, 70, 2);
        sfx.chestOpen();
        return;
      case "chest":
        fx.burst(e.x, e.y - 4, "#ffe14d", 14, 70, 1);
        sfx.chestOpen();
        return;
      case "star":
        fx.burst(e.x, e.y, "#fff6c8", 20, 110, 2);
        fx.addShake(0.1);
        return;
      case "respawn":
        if (mine) this.toast("Qishloqda o'zingizga keldingiz", "#9fd0ef");
        return;
      case "teleport":
        fx.burst(e.fromX, e.fromY, "#1a1118", 14, 30, 3);
        fx.burst(e.fromX, e.fromY, "#ff3b3b", 6, 70, 1);
        fx.burst(e.x, e.y, "#ff5a3c", 10, 60, 1);
        return;
      case "heal":
        fx.burst(e.x, e.y, "#a6f08e", 8, 40, 1);
        return;
      case "shot":
        // to'pponcha og'zida uchqun va porox tutuni
        fx.burst(e.x, e.y, "#ffe2a0", 4, 80, 1);
        fx.burst(e.x, e.y - 2, "#a8a298", 3, 16, 2);
        return;
      case "smoke":
        fx.burst(e.x, e.y, "#b8b0a4", 18, 70, 3);
        fx.burst(e.x, e.y, "#6e6860", 10, 40, 3);
        return;
    }
  }
}
