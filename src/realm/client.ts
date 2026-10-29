/**
 * Olam klienti (brauzer): klaviatura/sichqoncha/sensor -> buyruqlar, qat'iy 20 Hz tick bilan RealmSim,
 * voqealar -> effekt va ovoz, chizish va saqlash. Kelajakda RealmSim serverga ko'chadi,
 * klient esa buyruqlarni tarmoq orqali yuboradi.
 */
import { Input } from "@/game/input";
import { Effects } from "@/game/effects";
import { sfx, type MusicTrack } from "@/game/audio";
import { HERO_THEME, type Hero } from "@/game/hero";
import { loadSettings } from "@/game/settings";
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

export const REALM_SAVE_KEY = "pixel-rpg-realm";
const PID = "me";
/** Har shuncha soniyada avtomatik saqlash */
const SAVE_EVERY = 10;

export interface RealmSave {
  v: 1;
  world: RealmWorldSave;
  player: RealmPlayerSave;
  intro: boolean;
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
  fx = new Effects();
  touch = false;
  onExit: (() => void) | null = null;
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

  constructor(
    private canvas: HTMLCanvasElement,
    public hero: Hero,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.input.jAttack = false;
    const settings = loadSettings();
    this.shakeOn = settings.shake;
    sfx.setVolumes(settings.music, settings.sfx);
    this.sim = new RealmSim(loadRealmData());
    const save = loadRealmSave();
    if (save) this.sim.loadWorld(save.world);
    this.me = this.sim.addPlayer(PID, hero, save?.player ?? null);
    this.view = {
      sim: this.sim,
      me: this.me,
      alpha: 0,
      time: 0,
      fx: this.fx,
      touch: false,
      panel: save?.intro ? "none" : "intro",
      sel: 0,
      hover: null,
      toasts: [],
      banner: { text: "", sub: "", t: 0, color: "#ffe14d" },
      shake: 0,
      buttons: [],
      act: {
        choose: (i) => this.send({ type: "choose", index: i }),
        buy: (item) => this.send({ type: "buy", item }),
        sell: (slot) => this.send({ type: "sell", slot }),
        use: (slot) => this.send({ type: "use", slot }),
        close: () => this.closeTop(),
        panel: (p) => this.setPanel(p),
        exit: () => this.exitToMenu(),
      },
    };
  }

  /** TouchControls bilan moslik (Game kabi) */
  get player() {
    return this.me.p;
  }

  /** Buyruq keyingi tickda yuboriladi (serverga yuborish ham shu yerda bo'ladi). */
  send(cmd: RealmCommand) {
    this.pending.push(cmd);
  }

  setPanel(p: Panel) {
    if (p === "pause") this.save();
    this.view.panel = this.view.panel === p ? "none" : p;
    if (this.view.panel === "none" && p === "intro") this.save();
    this.view.sel = 0;
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

  private toView(e: MouseEvent) {
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
    }
  };
  private onBlur = () => {
    if (this.view.panel === "none") this.setPanel("pause");
  };

  start() {
    this.input.attach();
    this.canvas.addEventListener("click", this.onClick);
    this.canvas.addEventListener("contextmenu", this.onContext);
    this.canvas.addEventListener("mousemove", this.onMove);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("blur", this.onBlur);
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
    this.input.detach();
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
    const player = this.sim.savePlayer(PID);
    if (!player) return;
    writeRealmSave({
      v: 1,
      world: this.sim.saveWorld(),
      player,
      intro: this.view.panel !== "intro",
    });
  }

  private keys() {
    const inp = this.input;
    const ui = this.me.ui;
    if (inp.consumePause()) {
      if (ui) this.closeTop();
      else this.setPanel(this.view.panel === "none" ? "pause" : this.view.panel);
    }
    if (inp.consumeKey("KeyQ") && this.view.panel === "pause") this.exitToMenu();
    if (inp.consumeKey("KeyJ")) this.toggleJournal();
    if (inp.consumeKey("KeyM")) this.toggleMap();
    if (inp.consumeKey("KeyE", "Enter", "NumpadEnter")) this.confirm();
    if (ui?.kind === "dialog" || ui?.kind === "shop") {
      if (inp.consumeKey("ArrowUp", "KeyW", "ArrowLeft", "KeyA")) this.moveSel(-1);
      if (inp.consumeKey("ArrowDown", "KeyS", "ArrowRight", "KeyD")) this.moveSel(1);
    }
    for (let i = 0; i < 8; i++)
      if (inp.consumeKey(`Digit${i + 1}`)) {
        if (ui?.kind === "dialog") this.send({ type: "choose", index: i });
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
    if (!this.frozen) {
      this.acc += dt;
      while (this.acc >= TICK_DT) {
        this.acc -= TICK_DT;
        this.tick();
      }
    } else this.acc = 0;
    this.input.endFrame();
    this.fx.update(dt);
    for (const t of v.toasts) t.t -= dt / 2.5;
    v.toasts = v.toasts.filter((t) => t.t > 0);
    if (v.banner.t > 0) v.banner.t -= dt / 2.5;
    v.alpha = this.frozen ? 1 : this.acc / TICK_DT;
    v.time = this.time;
    v.touch = this.touch;
    v.shake = this.shakeOn && !this.frozen ? this.fx.shake : 0;
    v.me = this.me;
    this.renderer.render(this.ctx, v);
  }

  private tick() {
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
    this.sim.step(cmds.map((cmd) => ({ pid: PID, cmd })));
    // qayta tug'ilishda Player obyekti yangilanadi
    this.me = this.sim.players.get(PID)!;
    for (const e of this.sim.events) this.onEvent(e);
    if (this.me.p.dashing && !this.me.p.mage)
      this.fx.trail(this.me.p.x, this.me.p.y + 2, HERO_THEME[this.hero].trail);
    this.updateMusic();
    this.saveT += TICK_DT;
    if (this.saveT >= SAVE_EVERY) {
      this.saveT = 0;
      this.save();
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
    const boss = this.sim.mobs.some((m) => m.kind === "warden" && m.target === PID && !m.dead);
    const track: MusicTrack = boss ? "boss" : this.sim.night ? "forest" : "normal";
    if (track !== this.music) {
      this.music = track;
      sfx.playMusic(track);
    }
  }

  private onEvent(e: RealmEvent) {
    const fx = this.fx;
    const mine = !("pid" in e) || e.pid === PID;
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
        if (e.pid === PID) {
          fx.addShake(0.15);
          fx.burst(e.x, e.y, "#ff4d6d", 8, 60, 1);
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
        this.banner("SARDOR G'AZABDA!", "U tezlashdi — osmonga qarang", "#ff7a2a");
        fx.burst(e.x, e.y, "#ff7a2a", 20, 100, 2);
        fx.addShake(0.3);
        sfx.roar();
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
    }
  }
}
