const MUTE_KEY = "pixel-rpg-muted";

/** Retro chiptune ovoz effektlari — Web Audio API, tashqi fayl kerak emas. */
class SoundFX {
  private ctx: AudioContext | null = null;
  muted = false;

  /** Brauzer ruxsati uchun: birinchi foydalanuvchi bosishida chaqiriladi. */
  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  /** Pauza: barcha ovozni to'xtatadi. */
  suspend() {
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
  }

  /** Pauzadan chiqish: ovozni qaytaradi. */
  resume() {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0");
    } catch {
      /* saqlash imkonsiz */
    }
    return this.muted;
  }

  loadMute() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      /* saqlash imkonsiz */
    }
    return this.muted;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slideTo?: number,
    delay = 0,
  ) {
    if (this.muted || !this.ctx || this.ctx.state !== "running") return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined)
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  /** Qisqa "vush" — hujum */
  attack() {
    this.tone(700, 0.09, "square", 0.06, 180);
  }

  /** Past "pak" — zarba tegganda */
  hit() {
    this.tone(160, 0.08, "square", 0.09, 70);
  }

  /** Pasayuvchi ohang — o'lim */
  death() {
    this.tone(400, 0.5, "sawtooth", 0.08, 50);
    this.tone(300, 0.5, "square", 0.05, 40, 0.1);
  }

  /** O'yinchi zarba yedi */
  hurt() {
    this.tone(220, 0.15, "sawtooth", 0.08, 90);
  }

  /** Dash — tez sirpanish */
  dash() {
    this.tone(260, 0.12, "triangle", 0.07, 900);
  }

  /** Dushman o'ldi */
  kill() {
    this.tone(520, 0.1, "square", 0.05, 260);
    this.tone(260, 0.12, "triangle", 0.05, 80, 0.04);
  }

  /** Yurak terildi */
  pickup() {
    this.tone(660, 0.08, "square", 0.06);
    this.tone(990, 0.12, "square", 0.06, undefined, 0.07);
  }

  /** Yangi to'lqin boshlandi */
  wave() {
    this.tone(330, 0.14, "square", 0.06);
    this.tone(440, 0.2, "square", 0.06, undefined, 0.14);
  }

  /** To'lqin tozalandi */
  clear() {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, "square", 0.06, undefined, i * 0.09));
  }

  /** Kuchaytirish tanlandi */
  upgrade() {
    [784, 1047, 1319].forEach((f, i) => this.tone(f, 0.1, "triangle", 0.08, undefined, i * 0.06));
  }

  /** Boss bo'kirishi */
  roar() {
    this.tone(140, 0.7, "sawtooth", 0.09, 45);
    this.tone(90, 0.7, "square", 0.05, 40, 0.05);
  }

  /** Boss olov sharlari */
  fireball() {
    this.tone(240, 0.25, "sawtooth", 0.05, 100);
  }

  /** G'alaba melodiyasi */
  victory() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone(f, 0.16, "square", 0.07, undefined, i * 0.15));
    this.tone(1319, 0.4, "square", 0.07, undefined, notes.length * 0.15);
  }
}

export const sfx = new SoundFX();
