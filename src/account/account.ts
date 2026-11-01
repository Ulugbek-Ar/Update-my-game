/**
 * Akkaunt holati (klient): sessiya tokeni, uchta kirish usuli va chiqish. React'dan tashqarida —
 * menyu useAccount() bilan kuzatadi. Token qurilmaga xos (ACCOUNT_KEY): progress bilan ham,
 * ko'chirish kodi bilan ham ketmaydi. Parol yo'q — Telegram tasdiqlaydi.
 *
 *  a) Telegram Mini App ichida: initData serverga — avtomatik kirish;
 *  b) saytda: Telegram Login Widget (popup);
 *  c) ilova, Windows va portativ: bot havolasi (t.me/<bot>?start=login_<kod>) -> botda "Tasdiqlash"
 *     -> o'yin kodni so'rab turadi (poll) va o'zi kiradi.
 */
import { openExternal } from "@/lib/desktop";
import { telegramApp, telegramUserId } from "@/lib/telegram";
import { ACCOUNTS_ENABLED, ERROR_TEXT, accConfig, call, currentDevice } from "./api";
import { ACCOUNT_KEY, LOGIN_KEY } from "./keys";
import type { ErrCode, Me } from "./protocol";
import { widgetAuth, loadWidget } from "./widget";

export interface AccountState {
  /** kirgan o'yinchi (mehmon — null) */
  me: Me | null;
  /** bot orqali kirish kutilmoqda: havola va muddat */
  pending: { link: string; expires: number } | null;
  busy: boolean;
  error: string | null;
  /** bir martalik xabar (menyuda ko'rsatiladi va o'chiriladi) */
  notice: string | null;
}

interface Cached {
  token: string;
  me: Me;
}

interface PendingLogin {
  code: string;
  secret: string;
  link: string;
  expires: number;
}

export type LoginHook = (info: { created: boolean }) => void | Promise<void>;

/** Bot kodi tasdig'ini shuncha vaqtda bir so'raymiz (ekran ko'rinib tursa) */
const POLL_MS = 3000;

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}

function write(key: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* saqlash imkonsiz */
  }
}

const errText = (e: ErrCode, field?: string) =>
  field === "cancelled" ? "Kirish botda bekor qilindi" : ERROR_TEXT[e];

export class AccountManager {
  state: AccountState = { me: null, pending: null, busy: false, error: null, notice: null };
  private token: string | null = null;
  private subs = new Set<() => void>();
  private loginHooks: LoginHook[] = [];
  private beforeLogoutHooks: (() => void | Promise<void>)[] = [];
  private endHooks: (() => void)[] = [];
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private polling = false;
  private inited = false;

  get enabled() {
    return ACCOUNTS_ENABLED;
  }

  get sessionToken() {
    return this.token;
  }

  get loggedIn() {
    return !!this.token && !!this.state.me;
  }

  subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  };

  getState = () => this.state;

  private set(patch: Partial<AccountState>) {
    this.state = { ...this.state, ...patch };
    for (const f of this.subs) f();
  }

  /** Kirgandan keyin (bulutli saqlanish shu yerda ulanadi) */
  onLogin(fn: LoginHook) {
    this.loginHooks.push(fn);
  }

  /** Chiqishdan oldin (saqlanmagan progress bulutga yuboriladi) */
  beforeLogout(fn: () => void | Promise<void>) {
    this.beforeLogoutHooks.push(fn);
  }

  /** Sessiya tugadi (chiqish, akkaunt o'chirildi yoki server rad etdi) */
  onSessionEnd(fn: () => void) {
    this.endHooks.push(fn);
  }

  /** Ilova ochilganda bir marta: saqlangan sessiya, kutilayotgan bot kodi, Telegram ichida — kirish */
  init() {
    if (this.inited || !ACCOUNTS_ENABLED) return;
    this.inited = true;
    const c = read<Cached>(ACCOUNT_KEY);
    if (c?.token && c.me) {
      this.token = c.token;
      this.set({ me: c.me });
    }
    if (typeof document !== "undefined")
      document.addEventListener("visibilitychange", () => {
        // botdan qaytdi — darhol so'raymiz
        if (document.visibilityState === "visible" && this.state.pending) void this.poll();
      });
    const p = read<PendingLogin>(LOGIN_KEY);
    if (p && p.expires > Date.now()) {
      this.set({ pending: { link: p.link, expires: p.expires } });
      void this.poll();
    } else if (p) write(LOGIN_KEY, null);
    if (!this.checkTelegram() && this.token) void this.refreshMe();
  }

  /**
   * Telegram Mini App ichida (skript yuklangach ham chaqiriladi): boshqa (yoki hech qanday)
   * akkaunt bilan kirilgan bo'lsa — initData bilan avtomatik kirish. true — kirish boshlandi.
   */
  checkTelegram() {
    if (!ACCOUNTS_ENABLED || !this.inited) return false;
    const tg = telegramApp();
    const id = telegramUserId();
    if (!tg?.initData || !id || this.state.busy) return false;
    if (this.token && this.state.me?.tg === id) return false;
    void this.loginWebApp(tg.initData);
    return true;
  }

  private async loginWebApp(initData: string) {
    this.set({ busy: true, error: null });
    const r = await call("auth/webapp", { initData, device: "telegram" });
    this.set({ busy: false });
    if (!r.ok) return this.set({ error: errText(r.error) });
    await this.finish(r.token, r.me, !!(r as { created?: boolean }).created);
  }

  /** Saytda: Login Widget skripti va bot raqami oldindan (popup bosish ichida ochilsin) */
  async prepareWidget() {
    const cfg = await accConfig();
    if (!cfg.botId) return null;
    return (await loadWidget()) ? cfg.botId : null;
  }

  /** Login Widget popup'i (tugma bosilganda, sinxron ochiladi) */
  async loginWidget(botId: number) {
    const user = await widgetAuth(botId);
    if (!user) return;
    this.set({ busy: true, error: null });
    const r = await call("auth/widget", { user, device: currentDevice() });
    this.set({ busy: false });
    if (!r.ok) return this.set({ error: errText(r.error) });
    await this.finish(r.token, r.me, !!(r as { created?: boolean }).created);
  }

  /** Bot orqali kirish: kod olinadi, havola ochiladi, tasdiq kutiladi. */
  async startBotLogin(open = true) {
    this.set({ busy: true, error: null });
    const r = await call("auth/bot", { device: currentDevice() });
    this.set({ busy: false });
    if (!r.ok) return this.set({ error: errText(r.error) });
    write(LOGIN_KEY, {
      code: r.code,
      secret: r.secret,
      link: r.link,
      expires: r.expires,
    } satisfies PendingLogin);
    this.set({ pending: { link: r.link, expires: r.expires } });
    if (open) openExternal(r.link);
    this.schedulePoll();
  }

  /** Tasdiqni hoziroq so'rash (qaytib kelganda yoki "TEKSHIRISH" tugmasi) */
  pollNow() {
    return this.poll();
  }

  cancelBotLogin() {
    write(LOGIN_KEY, null);
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    this.set({ pending: null });
  }

  private schedulePoll(ms = POLL_MS) {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => void this.poll(), ms);
  }

  private async poll() {
    if (this.polling) return;
    const p = read<PendingLogin>(LOGIN_KEY);
    if (!p) return this.set({ pending: null });
    if (Date.now() > p.expires) {
      this.cancelBotLogin();
      return this.set({ error: ERROR_TEXT.expired });
    }
    // fonda (Telegram ochiq) so'ramaymiz — qaytganda visibilitychange darhol so'raydi
    if (typeof document !== "undefined" && document.visibilityState === "hidden")
      return this.schedulePoll();
    this.polling = true;
    const r = await call("auth/poll", { code: p.code, secret: p.secret });
    this.polling = false;
    if (!read<PendingLogin>(LOGIN_KEY)) return; // shu orada bekor qilindi
    if (!r.ok) {
      if (r.error === "net" || r.error === "rate") return this.schedulePoll(POLL_MS * 2);
      this.cancelBotLogin();
      return this.set({ error: errText(r.error, "field" in r ? r.field : undefined) });
    }
    if (r.status === "wait") return this.schedulePoll();
    this.cancelBotLogin();
    await this.finish(r.token, r.me, !!(r as { created?: boolean }).created);
  }

  private async finish(token: string, me: Me, created: boolean) {
    this.token = token;
    write(ACCOUNT_KEY, { token, me } satisfies Cached);
    this.set({
      me,
      error: null,
      notice: created ? `Xush kelibsiz, ${me.nick}!` : `Kirdingiz: ${me.nick}`,
    });
    for (const h of this.loginHooks) {
      try {
        await h({ created });
      } catch (e) {
        console.error(e);
      }
    }
  }

  /** Server bilan solishtirish: sessiya bekor bo'lsa — mehmon rejimi (progress qurilmada qoladi) */
  async refreshMe() {
    if (!this.token) return;
    const r = await call("me", { token: this.token });
    if (r.ok) return this.setMe(r.me);
    if (r.error === "auth") {
      await this.dropSession();
      this.set({ notice: "Sessiya tugadi — Telegram bilan qayta kiring" });
    }
  }

  /** Profil o'zgardi (taxallus, avatar, daraja) */
  setMe(me: Me) {
    if (!this.token) return;
    write(ACCOUNT_KEY, { token: this.token, me } satisfies Cached);
    this.set({ me });
  }

  /** Chiqish: avval saqlanmagan progress bulutga, keyin sessiya o'chiriladi. Progress qurilmada qoladi. */
  async logout() {
    const token = this.token;
    if (!token) return;
    this.set({ busy: true });
    for (const h of this.beforeLogoutHooks) {
      try {
        await h();
      } catch (e) {
        console.error(e);
      }
    }
    void call("auth/logout", { token });
    await this.dropSession();
    this.set({ busy: false, notice: "Akkauntdan chiqdingiz — mehmon sifatida davom etasiz" });
  }

  /** Sessiyani qurilmadan o'chirish (chiqish yoki server allaqachon rad etgan) */
  async dropSession() {
    this.token = null;
    write(ACCOUNT_KEY, null);
    this.set({ me: null });
    for (const h of this.endHooks) h();
  }

  takeNotice() {
    const n = this.state.notice;
    if (n) this.set({ notice: null });
    return n;
  }

  clearError() {
    if (this.state.error) this.set({ error: null });
  }
}

export const account = new AccountManager();
