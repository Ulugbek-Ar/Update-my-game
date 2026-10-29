const GAME_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Space", "Escape"];

export class Input {
  private keys = new Set<string>();
  /** Shu kadrda bosilgan tugmalar (kadr oxirida tozalanadi) */
  private pressed = new Set<string>();
  private attackQueued = false;
  private dashQueued = false;
  private enterQueued = false;
  private pauseQueued = false;
  private touch = { x: 0, y: 0 };
  private touchAttack = false;
  private touchDash = false;
  /** J ham hujum tugmasi (ochiq olamda J — topshiriqlar jurnali) */
  jAttack = true;

  private down = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT")) return;
    if (GAME_KEYS.includes(e.key) || e.code === "Space") e.preventDefault();
    if (!e.repeat) {
      if (e.code === "Space" || (e.code === "KeyJ" && this.jAttack)) this.attackQueued = true;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyK")
        this.dashQueued = true;
      if (e.code === "Enter" || e.code === "NumpadEnter") this.enterQueued = true;
      if (e.code === "Escape" || e.code === "KeyP") this.pauseQueued = true;
      this.pressed.add(e.code);
    }
    this.keys.add(e.code);
  };
  private up = (e: KeyboardEvent) => this.keys.delete(e.code);
  private blur = () => {
    this.keys.clear();
    this.touch = { x: 0, y: 0 };
    this.touchAttack = false;
    this.touchDash = false;
  };

  attach() {
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
    window.addEventListener("blur", this.blur);
  }
  detach() {
    window.removeEventListener("keydown", this.down);
    window.removeEventListener("keyup", this.up);
    window.removeEventListener("blur", this.blur);
  }

  axis() {
    const k = this.keys;
    const x =
      (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) -
      (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
    const y =
      (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) - (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0);
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
    return this.keys.has("Space") || (this.jAttack && this.keys.has("KeyJ")) || this.touchAttack;
  }
  pressDash() {
    this.dashQueued = true;
  }
  /** Sakrash tugmasi bosib turilganmi (Ovchi tuzog'i uchun). */
  setTouchDash(on: boolean) {
    this.touchDash = on;
  }
  dashHeld() {
    return (
      this.keys.has("ShiftLeft") ||
      this.keys.has("ShiftRight") ||
      this.keys.has("KeyK") ||
      this.touchDash
    );
  }
  pressPause() {
    this.pauseQueued = true;
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
  /** Bir marta bosilgan Escape (iste'mol qilinadi). */
  consumePause() {
    const a = this.pauseQueued;
    this.pauseQueued = false;
    return a;
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
    this.attackQueued = this.dashQueued = this.enterQueued = false;
    this.pressed.clear();
  }
}
