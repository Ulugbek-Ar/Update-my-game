/**
 * Ekspeditsiya (kirgan o'yinchi): boshlanish vaqti ham, qaytish vaqti ham SERVER soati —
 * telefon soatini o'zgartirib aldab bo'lmaydi. Mukofot bir marta beriladi (qator o'chiriladi).
 * Hisob — ../expeditionRules.ts.
 */
import { SHOP_KEY } from "@/game/shop";
import { EXP_MIN_MINUTES, expeditionReward, shopTotal } from "../expeditionRules";
import { HERO_IDS, type ExpeditionReward, type ExpeditionState } from "../protocol";
import { levelOf } from "../xp";
import { heroesIn } from "../grants";
import { first, num, str, type Row } from "./db";
import type { AccountStore, PlayerRow } from "./store";
import type { Hero } from "@/game/hero";

interface ExpRow extends Row {
  player: number;
  hero: string;
  start: number;
}

const heroOf = (s: string): Hero => HERO_IDS.find((h) => h === s) ?? "knight";

export class Expeditions {
  /** testlar uchun: tasodif manbai */
  random: () => number = Math.random;

  constructor(private store: AccountStore) {}

  private get db() {
    return this.store.db;
  }

  private row(player: number) {
    return first<ExpRow>(this.db, "SELECT * FROM expeditions WHERE player = ?", player);
  }

  get(p: PlayerRow): ExpeditionState | null {
    const r = this.row(p.id);
    return r ? { hero: heroOf(str(r.hero)), start: num(r.start), now: 0 } : null;
  }

  /** Yuborish: faqat ochilgan qahramon; allaqachon ketgan bo'lsa — o'sha qoladi */
  start(p: PlayerRow, hero: Hero, now: number): { ok: true } | { ok: false; error: "none" } {
    if (this.row(p.id)) return { ok: true };
    if (!heroesIn(this.store.getSave(p.id)?.data ?? {}).includes(hero))
      return { ok: false, error: "none" };
    this.db.exec("INSERT INTO expeditions (player, hero, start) VALUES (?, ?, ?)", p.id, hero, now);
    return { ok: true };
  }

  /**
   * Qaytarish: o'tgan vaqt (server soati, 8 soatgacha) bo'yicha mukofot. 10 daqiqadan qisqa —
   * ekspeditsiya davom etadi (end bo'lsa — mukofotsiz tugaydi). Bir marta: qator o'chadi.
   */
  claim(p: PlayerRow, now: number, end: boolean): ExpeditionReward | null {
    return this.db.tx(() => {
      const r = this.row(p.id);
      if (!r) return null;
      const ms = now - num(r.start);
      const minutes = Math.floor(Math.max(0, ms) / 60_000);
      if (minutes < EXP_MIN_MINUTES) {
        if (end) this.db.exec("DELETE FROM expeditions WHERE player = ?", p.id);
        return null;
      }
      this.db.exec("DELETE FROM expeditions WHERE player = ?", p.id);
      const data = this.store.getSave(p.id)?.data ?? {};
      const res = expeditionReward({
        ms,
        level: levelOf(num(p.xp)),
        shop: shopTotal(data[SHOP_KEY]),
        roll: this.random(),
        pick: this.random(),
      });
      return { hero: heroOf(str(r.hero)), ...res };
    });
  }
}
