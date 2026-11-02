/**
 * Ekspeditsiya (klient): o'yinchi o'yinni yopganda yoki menyuda "EKSPEDITSIYAGA YUBORISH"
 * bosganda tanlangan qahramon sarguzashtga ketadi; qaytib kirganda — "Ekspeditsiyadan qaytdi"
 * (oltin, XP, ehtimoliy sandiq). U qahramon bilan o'ynalsa — ekspeditsiya tugaydi va to'plangan
 * mukofot beriladi.
 *
 * Kirgan o'yinchi: boshlanish va qaytish vaqti SERVER soati (exp/*) — telefon soati ta'sir
 * qilmaydi, mukofotni server hisoblaydi va bir marta beradi. Mehmon: qurilma soati, kichik
 * qadamlar bilan (soat orqaga surilsa — hisoblanmaydi, oldinga sakrash — 8 soatdan oshmaydi).
 * Hisob: expeditionRules.ts.
 */
import { useSyncExternalStore } from "react";
import { HERO_LIST, type Hero } from "@/game/hero";
import { sendToRealm } from "@/game/realmLink";
import { SHOP_KEY, addGold } from "@/game/shop";
import { account, type AccountManager } from "./account";
import { call } from "./api";
import {
  EXP_MAX_MS,
  EXP_MIN_MINUTES,
  advanceLocal,
  expeditionReward,
  shopTotal,
  type LocalExp,
} from "./expeditionRules";
import { EXP_KEY } from "./keys";
import type { ErrCode, ExpeditionReward } from "./protocol";
import { addXp, levelOf, loadXp } from "./xp";

/** Qurilmada saqlanadigan holat */
interface Stored {
  hero: Hero;
  /** kirgan o'yinchi: akkaunt, boshlanish (server soati) va server − qurilma farqi */
  acc?: number;
  start?: number;
  off?: number;
  /** mehmon: yig'ilgan vaqt */
  local?: LocalExp;
  /** o'yin paytida (yoki yopilish oldidan) olingan, hali ko'rsatilmagan mukofot */
  reward?: ExpeditionReward;
}

export interface ExpeditionView {
  /** ekspeditsiyadagi qahramon */
  hero: Hero | null;
  /** ko'rsatilishi kerak bo'lgan mukofot ("Ekspeditsiyadan qaytdi") */
  reward: ExpeditionReward | null;
}

const isHero = (h: unknown): h is Hero => HERO_LIST.some((x) => x.id === h);

function read(): Stored | null {
  try {
    const v = JSON.parse(localStorage.getItem(EXP_KEY) ?? "null") as Stored | null;
    return v && isHero(v.hero) ? v : null;
  } catch {
    return null;
  }
}

function write(s: Stored | null) {
  try {
    if (s) localStorage.setItem(EXP_KEY, JSON.stringify(s));
    else localStorage.removeItem(EXP_KEY);
  } catch {
    /* saqlash imkonsiz */
  }
}

export class ExpeditionManager {
  view: ExpeditionView = { hero: null, reward: null };
  private subs = new Set<() => void>();
  private started = false;
  private busy = false;

  constructor(private acc: AccountManager = account) {
    // mehmon ekspeditsiyasi akkauntga o'tadi (vaqt server soatidan qaytadan boshlanadi)
    acc.onLogin(() => void this.afterLogin());
    acc.onSessionEnd(() => {
      const s = read();
      if (s?.acc !== undefined) write(s.reward ? { hero: s.hero, reward: s.reward } : null);
      this.refresh();
    });
  }

  subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  };

  getView = () => this.view;

  private refresh() {
    const s = read();
    const active = s && (s.local || s.start !== undefined) ? s.hero : null;
    this.view = { hero: active, reward: s?.reward ?? null };
    for (const f of this.subs) f();
  }

  private get online() {
    return !!this.acc.sessionToken && !!this.acc.state.me;
  }

  /** Ilova ochilganda bir marta: yopilishda — yuborish, qaytishda — tekshirish */
  start(hero: () => Hero | null, canShow: () => boolean) {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    this.refresh();
    // o'yin/olam paytida fonga o'tish — ilovani almashtirish (qahramon o'yinda band)
    const away = () => {
      const h = hero();
      if (h) this.sendOnClose(h);
      else this.tickLocal();
    };
    window.addEventListener("pagehide", away);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") away();
      else if (canShow()) void this.checkReturn();
    });
    // mehmon: soat qadamlari (orqaga surilsa — sezilsin)
    window.setInterval(() => this.tickLocal(), 60_000);
    if (canShow()) void this.checkReturn();
  }

  /** Ekspeditsiyada o'tgan vaqt (ms, 8 soatgacha) */
  elapsed(now = Date.now()) {
    const s = read();
    if (!s) return 0;
    if (s.local) return advanceLocal(s.local, now).acc;
    if (s.start !== undefined)
      return Math.max(0, Math.min(EXP_MAX_MS, now + (s.off ?? 0) - s.start));
    return 0;
  }

  private tickLocal(now = Date.now()) {
    const s = read();
    if (s?.local) write({ ...s, local: advanceLocal(s.local, now) });
  }

  /** "EKSPEDITSIYAGA YUBORISH" */
  async send(hero: Hero, now = Date.now()): Promise<{ ok: true } | { ok: false; error: ErrCode }> {
    const cur = read();
    if (cur && (cur.local || cur.start !== undefined)) return { ok: true };
    if (this.online) {
      const r = await call("exp/start", { token: this.acc.sessionToken!, hero });
      if (!r.ok) return r;
      if (r.exp)
        write({
          ...(cur?.reward ? { reward: cur.reward } : {}),
          hero: r.exp.hero,
          acc: this.acc.state.me!.id,
          start: r.exp.start,
          off: r.now - now,
        });
    } else
      write({
        ...(cur?.reward ? { reward: cur.reward } : {}),
        hero,
        local: { hero, acc: 0, mark: now },
      });
    this.refresh();
    return { ok: true };
  }

  /** O'yin yopilmoqda yoki fonga o'tdi: ekspeditsiya bo'lmasa — tanlangan qahramon ketadi */
  sendOnClose(hero: Hero, now = Date.now()) {
    const cur = read();
    if (cur && (cur.local || cur.start !== undefined)) {
      this.tickLocal(now);
      return;
    }
    if (this.online) {
      // javob kutilmaydi: server o'z soatida boshlaydi; nusxa qaytganda (exp/get) aniqlanadi
      void call("exp/start", { token: this.acc.sessionToken!, hero }, { keepalive: true });
      write({
        ...(cur?.reward ? { reward: cur.reward } : {}),
        hero,
        acc: this.acc.state.me!.id,
        start: now,
        off: 0,
      });
    } else
      write({
        ...(cur?.reward ? { reward: cur.reward } : {}),
        hero,
        local: { hero, acc: 0, mark: now },
      });
    this.refresh();
  }

  /** Qaytib kirdi (menyuda): 10 daqiqadan ko'p o'tgan bo'lsa — mukofot */
  async checkReturn(now = Date.now()) {
    if (this.busy) return;
    if (this.online) {
      this.busy = true;
      const r = await call("exp/get", { token: this.acc.sessionToken! });
      this.busy = false;
      if (!r.ok) return;
      const cur = read();
      if (!r.exp) {
        write(cur?.reward ? { hero: cur.hero, reward: cur.reward } : null);
        return this.refresh();
      }
      write({
        ...(cur?.reward ? { reward: cur.reward } : {}),
        hero: r.exp.hero,
        acc: this.acc.state.me!.id,
        start: r.exp.start,
        off: r.now - now,
      });
      this.refresh();
      if (r.now - r.exp.start >= EXP_MIN_MINUTES * 60_000) await this.claim(false, now);
      return;
    }
    this.tickLocal(now);
    if (this.elapsed(now) >= EXP_MIN_MINUTES * 60_000) await this.claim(false, now);
  }

  /**
   * Ekspeditsiyani tugatish: mukofot qo'shiladi va "qaytdi" oynasi uchun saqlanadi.
   * end — qahramon bilan o'ynash boshlandi (10 daqiqadan qisqa bo'lsa ham tugaydi).
   */
  async claim(end: boolean, now = Date.now()): Promise<ExpeditionReward | null> {
    const s = read();
    if (!s || (!s.local && s.start === undefined)) return null;
    let reward: ExpeditionReward | null = null;
    if (s.acc !== undefined) {
      if (!this.online) return null;
      this.busy = true;
      const r = await call("exp/claim", { token: this.acc.sessionToken!, ...(end ? { end } : {}) });
      this.busy = false;
      if (!r.ok) return null;
      reward = r.reward;
      // qisqa va tugatilmagan — ekspeditsiya davom etadi
      if (!reward && !end) return null;
    } else {
      const local = advanceLocal(s.local!, now);
      const res = expeditionReward({
        ms: local.acc,
        level: levelOf(loadXp().xp),
        shop: shopTotal(localStorage.getItem(SHOP_KEY)),
        roll: Math.random(),
        pick: Math.random(),
      });
      if (res.minutes < EXP_MIN_MINUTES) {
        if (!end) {
          write({ ...s, local });
          return null;
        }
      } else reward = { hero: s.hero, ...res };
    }
    if (reward) this.apply(reward);
    write(reward ? { hero: s.hero, reward } : null);
    this.refresh();
    return reward;
  }

  private apply(r: ExpeditionReward) {
    if (r.gold > 0) addGold(r.gold);
    if (r.xp > 0) addXp(r.xp);
    // noyob buyum — Abadiyat olami pochtasiga (olamga kirganda inventarga o'tadi)
    if (r.chest) sendToRealm(r.chest);
  }

  /** Shu qahramon bilan o'yin boshlandi: ekspeditsiya tugaydi (mukofot — menyuga qaytganda) */
  endFor(hero: Hero) {
    if (this.view.hero !== hero) return Promise.resolve(null);
    return this.claim(true);
  }

  /** "Ekspeditsiyadan qaytdi" oynasi yopildi */
  dismiss() {
    const s = read();
    if (!s?.reward) return;
    const rest: Stored = { ...s };
    delete rest.reward;
    write(rest.local || rest.start !== undefined ? rest : null);
    this.refresh();
  }

  private async afterLogin() {
    const s = read();
    if (s?.local) {
      const hero = s.hero;
      write(s.reward ? { hero, reward: s.reward } : null);
      await this.send(hero);
    } else await this.checkReturn();
  }
}

export const expedition = new ExpeditionManager();

export function useExpedition() {
  return useSyncExternalStore(expedition.subscribe, expedition.getView, expedition.getView);
}
