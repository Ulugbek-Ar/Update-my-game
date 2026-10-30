/**
 * O'z qahramonini oldindan ko'rsatish (client-side prediction) va server bilan solishtirib tuzatish.
 *
 * Klient har tick'da (20 Hz) buyruqni o'zida ham qo'llaydi va RealmSim.movePlayer bilan yuradi —
 * serverdagi bilan aynan bir xil kod, shuning uchun odatda xato yo'q. Server holati kelganda
 * (ack — buyruq to'plami, at — undan beri o'tgan tick'lar) klientning o'sha tick'dagi joyi bilan
 * solishtiriladi; farq (itarilish, server rad etgan harakat) hozirgi joyga qo'shiladi.
 */
/** Bundan katta farq — sakrab tuzatiladi (qayta tug'ilish, uzoq uzilish) */
export const SNAP_DIST = 64;
/** Shuncha tick tarix saqlanadi (4 s — ping 1 s bo'lsa ham yetadi) */
const KEEP = 80;

interface Entry {
  t: number;
  x: number;
  y: number;
}

export class Predictor {
  /** klient tick raqami (welcome'dan beri) */
  tick = 0;
  private hist: Entry[] = [];

  reset() {
    this.tick = 0;
    this.hist = [];
  }

  /** Tarixni tozalash (sakrab tuzatilganda) — tick raqami saqlanadi */
  forget() {
    this.hist = [];
  }

  /** Shu tick'dan keyingi bashorat qilingan joy */
  record(x: number, y: number) {
    this.hist.push({ t: this.tick, x, y });
    if (this.hist.length > KEEP) this.hist.shift();
  }

  /**
   * Server: klient tick'i ct dan keyin o'yinchi (sx, sy) da. Qaytaradi — hozirgi joyga qo'shiladigan
   * tuzatish (null — farq yo'q yoki solishtirib bo'lmaydi). Tuzatish tarixga ham yoziladi (ikki marta qo'llanmaydi).
   */
  correction(ct: number, sx: number, sy: number): { dx: number; dy: number } | null {
    const h = this.hist;
    const last = h[h.length - 1];
    if (!last) return null;
    // soatlar biroz siljigan bo'lsa — eng oxirgisi bilan
    const e = ct >= last.t ? last : h.find((x) => x.t === ct);
    if (!e) return null;
    const dx = sx - e.x,
      dy = sy - e.y;
    // server joyni 0.1 px aniqlikda yuboradi
    if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) return null;
    for (const x of h)
      if (x.t >= e.t) {
        x.x += dx;
        x.y += dy;
      }
    return { dx, dy };
  }
}
