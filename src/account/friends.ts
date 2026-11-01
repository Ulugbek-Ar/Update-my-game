/**
 * Do'stlar (klient): ro'yxat, so'rovlar, bloklash, tayyor iboralar va onlayn holat.
 * Holat serverga daqiqada bir va o'zgarganda (menyu / dunyo / olam + xona kodi) yuboriladi;
 * javobda yangi xabarlar va kelgan so'rovlar soni keladi. Ilova yopilsa — "off" (darhol oflayn).
 */
import { useSyncExternalStore } from "react";
import { account, type AccountManager } from "./account";
import { ERROR_TEXT, call } from "./api";
import {
  FRIEND_PHRASES,
  type ErrCode,
  type FriendInfo,
  type FriendLists,
  type FriendMessage,
  type GuildPing,
  type Place,
} from "./protocol";

/** Holat yuborish oralig'i (ekran ko'rinib turganda) */
export const BEAT_MS = 60_000;

export interface FriendsState {
  lists: FriendLists | null;
  loading: boolean;
  error: string | null;
  /** kelgan do'stlik so'rovlari soni */
  requests: number;
  /** kelgan xabarlar (yangisi oxirida) va o'qilmaganlari */
  inbox: FriendMessage[];
  unread: number;
}

const EMPTY: FriendsState = {
  lists: null,
  loading: false,
  error: null,
  requests: 0,
  inbox: [],
  unread: 0,
};

export const ADD_ERROR: Partial<Record<ErrCode, string>> = {
  none: "Bunday o'yinchi topilmadi",
  limit: "Chegaraga yetdingiz (100 do'st, 30 ta kutilayotgan so'rov)",
  bad: "Bu o'yinchini bloklagansiz — avval blokdan chiqaring",
};

export class FriendsManager {
  state: FriendsState = EMPTY;
  /** yangi xabar keldi (menyu — yozuv, olam — o'yin ichida xabar) */
  onMessage: (m: FriendMessage, text: string) => void = () => {};
  private subs = new Set<() => void>();
  private place: Place = "menu";
  private room: string | null = null;
  private started = false;
  private beating = false;
  /** holat javobini kutayotganlar (gildiya qisqachasi — guild.ts) */
  private presenceHooks: ((r: { guild?: GuildPing }) => void)[] = [];

  constructor(private acc: AccountManager = account) {
    acc.onLogin(() => {
      void this.beat();
    });
    acc.onSessionEnd(() => this.set({ ...EMPTY }));
  }

  subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  };

  getState = () => this.state;

  private set(patch: Partial<FriendsState>) {
    this.state = { ...this.state, ...patch };
    for (const f of this.subs) f();
  }

  /** Har holat javobida (daqiqada bir): javobdagi qo'shimchalar (gildiya) shu yerga */
  onPresence(fn: (r: { guild?: GuildPing }) => void) {
    this.presenceHooks.push(fn);
  }

  /** Ilova ochilganda bir marta: daqiqada bir holat, yopilganda "off" */
  start() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    window.setInterval(() => {
      if (document.visibilityState === "visible") void this.beat();
    }, BEAT_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void this.beat("off");
      else void this.beat();
    });
    window.addEventListener("pagehide", () => void this.beat("off"));
    void this.beat();
  }

  /** Qayerdaman: menyu, dunyo yoki olam (xona kodi bilan) — o'zgarsa darhol yuboriladi */
  setPlace(place: Place, room: string | null = null) {
    if (place === this.place && room === this.room) return;
    this.place = place;
    this.room = room;
    void this.beat();
  }

  /** Holat yuborish; off — ilova yopilmoqda (keepalive, javob kutilmaydi) */
  async beat(off?: "off") {
    const token = this.acc.sessionToken;
    if (!token || (this.beating && !off)) return;
    const body = {
      token,
      place: off ?? this.place,
      ...(this.place === "realm" && this.room && !off ? { room: this.room } : {}),
    };
    if (off) {
      void call("presence", body, { keepalive: true });
      return;
    }
    this.beating = true;
    const r = await call("presence", body);
    this.beating = false;
    if (!r.ok) return;
    this.receive(r.messages, r.requests);
    for (const f of this.presenceHooks) f(r);
  }

  private receive(messages: FriendMessage[], requests: number) {
    const fresh = messages.filter((m) => !this.state.inbox.some((x) => x.id === m.id));
    if (requests !== this.state.requests || fresh.length)
      this.set({
        requests,
        inbox: [...this.state.inbox, ...fresh].slice(-30),
        unread: this.state.unread + fresh.length,
      });
    for (const m of fresh) this.onMessage(m, `${m.nick}: ${FRIEND_PHRASES[m.phrase] ?? ""}`);
  }

  /** Xabarlar o'qildi */
  markRead() {
    if (this.state.unread) this.set({ unread: 0 });
  }

  clearInbox() {
    this.set({ inbox: [], unread: 0 });
  }

  async refresh() {
    const token = this.acc.sessionToken;
    if (!token) return;
    this.set({ loading: true, error: null });
    const r = await call("friends/list", { token });
    if (!r.ok) return this.set({ loading: false, error: ERROR_TEXT[r.error] });
    const { ok: _ok, ...lists } = r;
    this.set({ loading: false, lists, requests: lists.incoming.length });
  }

  /** Taxallus yoki do'st kodi bo'yicha so'rov. Natija matni (xato yoki muvaffaqiyat). */
  async add(query: string): Promise<{ ok: boolean; text: string }> {
    const token = this.acc.sessionToken;
    const q = query.trim();
    if (!token || !q) return { ok: false, text: "Taxallus yoki do'st kodini yozing" };
    const r = await call("friends/add", { token, query: q });
    if (!r.ok) return { ok: false, text: ADD_ERROR[r.error] ?? ERROR_TEXT[r.error] };
    void this.refresh();
    return {
      ok: true,
      text: r.accepted
        ? `${r.friend.nick} endi do'stingiz!`
        : `${r.friend.nick} ga so'rov yuborildi — u qabul qilishini kuting`,
    };
  }

  private async act(op: () => Promise<{ ok: boolean; error?: ErrCode }>) {
    const r = await op();
    if (!r.ok && r.error) this.set({ error: ERROR_TEXT[r.error] });
    await this.refresh();
    return r.ok;
  }

  answer(id: number, accept: boolean) {
    const token = this.acc.sessionToken;
    if (!token) return Promise.resolve(false);
    return this.act(() => call("friends/answer", { token, id, accept }));
  }

  remove(id: number) {
    const token = this.acc.sessionToken;
    if (!token) return Promise.resolve(false);
    return this.act(() => call("friends/remove", { token, id }));
  }

  block(id: number) {
    const token = this.acc.sessionToken;
    if (!token) return Promise.resolve(false);
    return this.act(() => call("friends/block", { token, id }));
  }

  unblock(id: number) {
    const token = this.acc.sessionToken;
    if (!token) return Promise.resolve(false);
    return this.act(() => call("friends/unblock", { token, id }));
  }

  /** Tayyor ibora yuborish */
  async send(to: number, phrase: number) {
    const token = this.acc.sessionToken;
    if (!token) return false;
    const r = await call("friends/msg", { token, to, phrase });
    if (!r.ok)
      this.set({ error: r.error === "limit" ? "Biroz kuting — juda tez" : ERROR_TEXT[r.error] });
    return r.ok;
  }
}

export const friends = new FriendsManager();

export function useFriends() {
  return useSyncExternalStore(friends.subscribe, friends.getState, friends.getState);
}

/** "Onlayn — olamda" / "Oflayn" */
export function placeText(f: FriendInfo) {
  if (!f.online) return "Oflayn";
  return f.place === "realm"
    ? "Onlayn — Abadiyat olamida"
    : f.place === "world"
      ? "Onlayn — sarguzashtda"
      : "Onlayn — menyuda";
}
