import {
  ACTIONS,
  DEFAULT_KEYS,
  effectiveKeys,
  normKey,
  type Action,
  type KeyBinds,
  type KeyContext,
} from "./keys";
import { loadSettings, onSettingsChange } from "./settings";

const GAME_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Space", "Escape"];

/** Sozlamalar oynasi ochiq bo'lsa o'yin klaviaturaga javob bermaydi (tugma belgilash ham shu yerda). */
let locks = 0;
/** Qulflaydi; qaytgan funksiya qulfni bo'shatadi (bir martalik). */
export function lockGameKeys() {
  locks++;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    locks--;
  };
}
export function gameKeysLocked() {
  return locks > 0;
}

export class Input {
  private keys = new Set<string>();
  /** Shu kadrda bosilgan tugmalar (kadr oxirida tozalanadi) */
  private pressed = new Set<string>();
  private attackQueued = false;
  private dashQueued = false;
  private enterQueued = false;
  private pauseQueued = false;
  /** Mergan: R (telefonda o'q belgisi) — qayta o'qlash */
  private reloadQueued = false;
  private touch = { x: 0, y: 0 };
  private touchAttack = false;
  private touchDash = false;
  /** Asosiy o'yin yoki olam: olamda gaplashish/jurnal/xarita tugmalari umumiy amallardan ustun */
  private ctx: KeyContext = "game";
  /** SOZLAMALAR -> BOSHQARUV dagi tugmalar */
  private raw: KeyBinds = DEFAULT_KEYS;
  /** Shu rejimda ishlaydigan tugmalar */
  keyBinds: KeyBinds = effectiveKeys(DEFAULT_KEYS, "game");
  private offSettings: (() => void) | null = null;

  /** Olamda (J — jurnal, M — xarita, E — gaplashish) yoki asosiy o'yinda. */
  setContext(ctx: KeyContext) {
    this.ctx = ctx;
    this.keyBinds = effectiveKeys(this.raw, ctx);
  }
  /** Qayta belgilangan tugmalar (sozlama o'zgarsa darhol). */
  setKeys(k: KeyBinds) {
    this.raw = k;
    this.keyBinds = effectiveKeys(k, this.ctx);
  }
  private is(a: Action, key: string) {
    return this.keyBinds[a].includes(key);
  }
  private held(a: Action) {
    return this.keyBinds[a].some((c) => this.keys.has(c));
  }

  private down = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT")) return;
    if (locks > 0) return;
    const key = normKey(e.code);
    // belgilangan tugma brauzer amalini qilmaydi (Ctrl/Cmd bilan birga — qiladi: Ctrl+R va h.k.)
    const bound = ACTIONS.some((a) => this.is(a, key));
    const combo = (e.ctrlKey || e.metaKey || e.altKey) && !/^(Control|Meta|Alt)$/.test(key);
    if (GAME_KEYS.includes(e.key) || e.code === "Space" || (bound && !combo)) e.preventDefault();
    if (!e.repeat) {
      if (this.is("attack", key)) this.attackQueued = true;
      if (this.is("dash", key)) this.dashQueued = true;
      if (e.code === "Enter" || e.code === "NumpadEnter") this.enterQueued = true;
      if (this.is("pause", key)) this.pauseQueued = true;
      if (this.is("reload", key)) this.reloadQueued = true;
      this.pressed.add(e.code);
      this.pressed.add(key);
    }
    this.keys.add(key);
  };
  private up = (e: KeyboardEvent) => this.keys.delete(normKey(e.code));
  private blur = () => {
    this.keys.clear();
    this.touch = { x: 0, y: 0 };
    this.touchAttack = false;
    this.touchDash = false;
  };

  attach() {
    this.setKeys(loadSettings().keys);
    this.offSettings?.();
    this.offSettings = onSettingsChange((st) => this.setKeys(st.keys));
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
    window.addEventListener("blur", this.blur);
  }
  detach() {
    this.offSettings?.();
    this.offSettings = null;
    window.removeEventListener("keydown", this.down);
    window.removeEventListener("keyup", this.up);
    window.removeEventListener("blur", this.blur);
  }

  axis() {
    const x = (this.held("right") ? 1 : 0) - (this.held("left") ? 1 : 0);
    const y = (this.held("down") ? 1 : 0) - (this.held("up") ? 1 : 0);
    if (x || y) return { x, y };
    return { x: this.touch.x, y: this.touch.y };
  }

  // Sensorli boshqaruv (telefon)
  setTouchAxis(x: number, y: number) {
    this.touch = { x, y };
  }
  pressAttack() {
    this.attackQueued = true;
  }
  /** ZARBA tugmasi bosib turilganmi (kuchli zarba uchun). */
  setTouchAttack(on: boolean) {
    this.touchAttack = on;
  }
  attackHeld() {
    return this.held("attack") || this.touchAttack;
  }
  pressDash() {
    this.dashQueued = true;
  }
  /** Sakrash tugmasi bosib turilganmi (Ovchi tuzog'i uchun). */
  setTouchDash(on: boolean) {
    this.touchDash = on;
  }
  dashHeld() {
    return this.held("dash") || this.touchDash;
  }
  pressPause() {
    this.pauseQueued = true;
  }
  /** Telefondagi qayta o'qlash tugmasi (Mergan). */
  pressReload() {
    this.reloadQueued = true;
  }

  /** Bir marta bosilgan hujum (iste'mol qilinadi). */
  consumeAttack() {
    const a = this.attackQueued;
    this.attackQueued = false;
    return a;
  }
  consumeDash() {
    const a = this.dashQueued;
    this.dashQueued = false;
    return a;
  }
  consumeEnter() {
    const a = this.enterQueued;
    this.enterQueued = false;
    return a;
  }
  /** Bir marta bosilgan qayta o'qlash (iste'mol qilinadi). */
  consumeReload() {
    const a = this.reloadQueued;
    this.reloadQueued = false;
    return a;
  }
  /** Bir marta bosilgan Escape (iste'mol qilinadi). */
  consumePause() {
    const a = this.pauseQueued;
    this.pauseQueued = false;
    return a;
  }
  /** Amal tugmasi (qayta belgilangan) shu kadrda bosilganmi — ovoz, gaplashish, jurnal, xarita. */
  consumeAction(a: Action) {
    let hit = false;
    for (const c of this.keyBinds[a]) if (this.pressed.delete(c)) hit = true;
    return hit;
  }
  /** Berilgan tugmalardan biri shu kadrda bosilganmi. */
  consumeKey(...codes: string[]) {
    let hit = false;
    for (const c of codes) if (this.pressed.delete(c)) hit = true;
    return hit;
  }
  endFrame() {
    this.pressed.clear();
  }
  /** Navbatdagi barcha bir martalik bosishlarni bekor qilish. */
  clearQueued() {
    this.attackQueued = this.dashQueued = this.enterQueued = this.reloadQueued = false;
    this.pressed.clear();
  }
}
