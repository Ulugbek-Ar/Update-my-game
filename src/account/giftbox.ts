/**
 * Sovg'a qutisi (klient): muallifdan kelgan sovg'alar. Kutayotganlar soni har onlayn holat
 * javobida keladi (daqiqada bir, kirganda — darhol): menyuda belgi va "Sovg'a keldi!" oynasi.
 * Sovg'ani server bulutdagi progressga yozadi (cloud.mutate) — bir marta, qurilma almashsa ham
 * yo'qolmaydi; javobdagi yangi progress shu qurilmaga qo'llanadi.
 */
import { useSyncExternalStore } from "react";
import { account, type AccountManager } from "./account";
import { call } from "./api";
import { cloud, type CloudSync } from "./cloud";
import { friends } from "./friends";
import type { CloudSave, ErrCode, GiftInfo } from "./protocol";

export interface GiftBoxState {
  /** kutayotgan sovg'alar soni */
  pending: number;
  /** ro'yxat (oyna ochilganda yuklanadi) */
  gifts: GiftInfo[] | null;
}

const EMPTY: GiftBoxState = { pending: 0, gifts: null };

export class GiftBox {
  state: GiftBoxState = EMPTY;
  /** yangi sovg'a keldi (menyu "Sovg'a keldi!" oynasini ochadi) */
  onArrive: () => void = () => {};
  private subs = new Set<() => void>();
  /** shu sessiyada ko'rsatilgan son (har yangi sovg'ada bir marta ochiladi) */
  private shown = 0;

  constructor(
    private acc: AccountManager = account,
    private sync: CloudSync = cloud,
  ) {
    acc.onSessionEnd(() => {
      this.shown = 0;
      this.set({ ...EMPTY });
    });
  }

  subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  };

  getState = () => this.state;

  private set(patch: Partial<GiftBoxState>) {
    this.state = { ...this.state, ...patch };
    for (const f of this.subs) f();
  }

  /** Onlayn holat javobi: kutayotganlar soni */
  ping(n: number) {
    if (n !== this.state.pending) this.set({ pending: n });
    if (n > this.shown) {
      this.shown = n;
      this.onArrive();
    } else if (n < this.shown) this.shown = n;
  }

  async load() {
    const token = this.acc.sessionToken;
    if (!token) return null;
    const r = await call("gifts/list", { token });
    if (!r.ok) return null;
    this.shown = r.gifts.length;
    this.set({ gifts: r.gifts, pending: r.gifts.length });
    return r.gifts;
  }

  /** Sovg'ani olish: server progressga yozadi; xato — kod */
  async claim(id: number): Promise<{ ok: true; gift: GiftInfo } | { ok: false; error: ErrCode }> {
    const token = this.acc.sessionToken;
    if (!token) return { ok: false, error: "auth" };
    const r = await this.sync.mutate<{ ok: true; save: CloudSave; gift: GiftInfo }>((base) =>
      call("gifts/claim", { token, id, base }),
    );
    if (!r.ok) {
      // allaqachon olingan (boshqa qurilmada) — ro'yxat yangilanadi
      if (r.error === "none") void this.load();
      return r;
    }
    const gifts = (this.state.gifts ?? []).filter((g) => g.id !== id);
    this.shown = Math.max(0, this.shown - 1);
    this.set({ gifts, pending: Math.max(0, this.state.pending - 1) });
    return { ok: true, gift: r.gift };
  }
}

export const giftBox = new GiftBox();
friends.onPresence((r) => giftBox.ping(r.gifts ?? 0));

export function useGiftBox() {
  return useSyncExternalStore(giftBox.subscribe, giftBox.getState, giftBox.getState);
}
