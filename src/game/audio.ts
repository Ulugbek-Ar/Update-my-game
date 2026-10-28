const MUTE_KEY = "pixel-rpg-muted";

export type MusicTrack = "normal" | "boss" | "ice" | "queen";

/** Fon musiqasi treki: har qadamda bitta nota (MIDI raqami, null — pauza). */
export interface Track {
  /** Bitta qadam davomiyligi, soniya */
  step: number;
  lead: (number | null)[];
  bass: (number | null)[];
  leadWave: OscillatorType;
  bassWave: OscillatorType;
  /** Har shuncha qadamda baraban zarbasi (0 — yo'q) */
  kick: number;
}

// prettier-ignore
export const TRACKS: Record<MusicTrack, Track> = {
  // la minor, sarguzasht kuyi
  normal: {
    step: 60 / 112 / 2,
    lead: [
      69, null, 72, 76, 74, null, 72, 69, 67, null, 71, 74, 72, null, 71, 67,
      65, null, 69, 72, 71, null, 69, 65, 64, 67, 71, 74, 72, 71, 69, null,
    ],
    bass: [
      45, null, 57, null, 45, null, 57, null, 43, null, 55, null, 43, null, 55, null,
      41, null, 53, null, 41, null, 53, null, 40, null, 52, null, 40, null, 52, null,
    ],
    leadWave: "square",
    bassWave: "triangle",
    kick: 0,
  },
  // Boss: tezroq, past registr, xromatik va tritonli qo'rqinchli kuy
  boss: {
    step: 60 / 152 / 2,
    lead: [
      64, 65, 64, null, 70, null, 71, 70, 64, 65, 64, null, 67, null, 66, null,
      64, 65, 64, null, 70, null, 71, 74, 75, null, 74, 70, 71, null, 65, null,
    ],
    bass: [
      40, 40, 52, 40, 40, 40, 52, 40, 41, 41, 53, 41, 41, 41, 53, 41,
      40, 40, 52, 40, 40, 40, 52, 40, 46, 46, 58, 46, 45, 45, 57, 45,
    ],
    leadWave: "sawtooth",
    bassWave: "square",
    kick: 2,
  },
  // 2-bob: sekin, sovuq — mi minor, baland "qo'ng'iroqcha" notalar va cho'ziq bas
  ice: {
    step: 60 / 84 / 2,
    lead: [
      76, null, 79, null, 83, null, 81, 79, 76, null, null, 74, 76, null, null, null,
      72, null, 76, null, 79, null, 78, 76, 71, null, 74, null, 76, null, null, null,
    ],
    bass: [
      40, null, null, null, 47, null, null, null, 40, null, null, null, 47, null, null, null,
      36, null, null, null, 43, null, null, null, 35, null, null, null, 42, null, null, null,
    ],
    leadWave: "triangle",
    bassWave: "sine",
    kick: 0,
  },
  // Qor Malikasi: re minor, muz kuyidan tezroq, baland "muz qo'ng'iroq" notalari va pulsli bas
  queen: {
    step: 60 / 132 / 2,
    lead: [
      74, null, 77, 74, 73, null, 74, null, 81, null, 80, 77, 74, null, 73, null,
      74, null, 77, 81, 82, null, 81, 77, 80, null, 77, 73, 74, null, null, null,
    ],
    bass: [
      38, null, 50, null, 38, null, 50, null, 37, null, 49, null, 37, null, 49, null,
      34, null, 46, null, 34, null, 46, null, 33, null, 45, null, 37, null, 49, null,
    ],
    leadWave: "square",
    bassWave: "triangle",
    kick: 4,
  },
};

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** Retro chiptune ovoz effektlari va fon musiqasi — Web Audio API, tashqi fayl kerak emas. */
class SoundFX {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxVol = 0.8;
  private musicVol = 0.6;
  muted = false;
  /** Hozir chalinayotgan trek (null — musiqa yo'q) */
  music: MusicTrack | null = null;
  private musicStep = 0;
  private musicNext = 0;
  private musicTimer: ReturnType<typeof setInterval> | null = null;

  /** Brauzer ruxsati uchun: birinchi foydalanuvchi bosishida chaqiriladi. */
  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.ctx.destination);
      this.applyVolumes();
      if (this.music) this.startMusicTimer();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  /** Sozlamalardagi ovoz balandligi (0–100). */
  setVolumes(music: number, effects: number) {
    this.musicVol = Math.max(0, Math.min(100, music)) / 100;
    this.sfxVol = Math.max(0, Math.min(100, effects)) / 100;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVol;
    if (this.musicGain) this.musicGain.gain.value = this.musicVol;
  }

  /** Fon musiqasini boshlash yoki trekni almashtirish. */
  playMusic(track: MusicTrack) {
    if (this.music === track) return;
    this.music = track;
    this.musicStep = 0;
    this.musicNext = 0;
    if (this.ctx) this.startMusicTimer();
  }

  stopMusic() {
    this.music = null;
    if (this.musicTimer !== null) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private startMusicTimer() {
    if (this.musicTimer === null) this.musicTimer = setInterval(() => this.scheduleMusic(), 50);
  }

  /** Oldindan ~0.2s notalarni rejalashtiradi; pauzada (ctx suspend) hech narsa chalinmaydi. */
  private scheduleMusic() {
    const ctx = this.ctx;
    const t = this.music && TRACKS[this.music];
    if (!ctx || !t || !this.musicGain || ctx.state !== "running") return;
    const now = ctx.currentTime;
    if (this.musicNext < now) this.musicNext = now + 0.05;
    while (this.musicNext < now + 0.2) {
      const i = this.musicStep % t.lead.length;
      const at = this.musicNext;
      if (!this.muted) {
        const l = t.lead[i];
        if (l != null) this.voice(midi(l), t.step * 0.85, t.leadWave, 0.05, at, this.musicGain);
        const b = t.bass[i];
        if (b != null) this.voice(midi(b), t.step * 0.9, t.bassWave, 0.07, at, this.musicGain);
        if (t.kick && i % t.kick === 0) this.voice(150, 0.09, "sine", 0.12, at, this.musicGain, 40);
      }
      this.musicNext += t.step;
      this.musicStep++;
    }
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
    if (this.muted || !this.ctx || !this.sfxGain || this.ctx.state !== "running") return;
    this.voice(freq, dur, type, vol, this.ctx.currentTime + delay, this.sfxGain, slideTo);
  }

  private voice(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    t0: number,
    out: AudioNode,
    slideTo?: number,
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined)
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(out);
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

  /** Kuchli aylana zarba */
  spin() {
    this.tone(300, 0.22, "sawtooth", 0.07, 1200);
    this.tone(900, 0.18, "square", 0.04, 200, 0.06);
  }

  /** Qalqon zarbani to'sdi — metall "dzing" */
  block() {
    this.tone(1900, 0.09, "square", 0.05, 1500);
    this.tone(2800, 0.16, "triangle", 0.04, 2400, 0.02);
  }

  /** Sandiqqa zarba — yog'och "tak" */
  chestHit() {
    this.tone(210, 0.07, "square", 0.07, 120);
  }

  /** Sandiq ochildi — oltin jiringlashi */
  chestOpen() {
    [784, 988, 1175, 1568].forEach((f, i) =>
      this.tone(f, 0.12, "square", 0.05, undefined, i * 0.07),
    );
  }

  /** Kamonchi o'q uzdi */
  arrow() {
    this.tone(1200, 0.07, "triangle", 0.04, 500);
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

  /** Muz nayzasi yerdan chiqdi */
  iceSpike() {
    this.tone(1400, 0.12, "triangle", 0.05, 2600);
    this.tone(700, 0.1, "square", 0.03, 300, 0.03);
  }

  /** Bo'ron boshlandi — shamol guvillashi */
  blizzard() {
    this.tone(180, 0.9, "sawtooth", 0.03, 420);
    this.tone(260, 0.8, "triangle", 0.03, 120, 0.2);
  }

  /** Muz golemi yerga urdi */
  stomp() {
    this.tone(110, 0.25, "square", 0.08, 40);
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
