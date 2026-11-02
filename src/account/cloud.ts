/**
 * Bulutli saqlanish (klient). Progress — localStorage'dagi "pixel-rpg-*" kalitlari (qurilmaga
 * xoslarisiz: boshqaruv, ovoz, sessiya — src/game/transfer.ts DEVICE_KEYS).
 *
 * Birinchi kirishda:
 *  - akkaunt bo'sh, qurilmada progress bor — "Mehmon progressini akkauntga o'tkazish" oynasi;
 *  - ikkalasida ham progress bor (va har xil) — qaysi birini saqlashni tanlash (ko'rib chiqish bilan);
 *    tanlanmagani zaxiraga tushadi (qurilmadagisi — Sozlamalar -> OLDINGI HOLATGA QAYTARISH);
 *  - qurilma bo'sh — bulutdagisi yuklanadi.
 */
import {
  backupProgress,
  collectProgress,
  crc32,
  packProgress,
  replaceProgress,
  summarize,
  unpackProgress,
  type ProgressSummary,
} from "@/game/transfer";
import { REALM_SAVE_KEY } from "@/game/realmLink";
import { GUEST_KEY } from "@/realm/net/config";
import { account, type AccountManager } from "./account";
import { ERROR_TEXT, call, currentDevice } from "./api";
import { FIELD_TEXT, type LimitField } from "./limits";
import { CLOUD_KEY, DEVICE_ID_KEY } from "./keys";
import type { CloudSave, ErrCode } from "./protocol";
import { XP_KEY, levelOf, xpFromRaw } from "./xp";

export type Keys = Record<string, string>;

/** Ko'rib chiqish kartasi: oltin, qahramonlar, yutuqlar, rekord, daraja */
export interface ProgressPreview extends ProgressSummary {
  level: number;
  /** olam (Abadiyat) saqlanishi bormi */
  realm: boolean;
  /** bulutdagi nusxa: oxirgi o'zgarish vaqti va qurilma */
  time?: number;
  device?: CloudSave["device"];
}

export interface CloudDecision {
  /** migrate — akkaunt bo'sh; choose — ikkalasida ham progress */
  kind: "migrate" | "choose";
  local: ProgressPreview;
  cloud: ProgressPreview | null;
}

/** Qurilmadagi sinxron holati (CLOUD_KEY) */
export interface CloudState {
  /** qaysi akkaunt bilan */
  acc: number;
  /** qurilmadagi progress shu bulut versiyasidan davom etadi */
  base: number;
  /** oxirgi sinxrondagi progress izi (o'zgarganini bilish uchun) */
  fp: string;
  /** birinchi saqlanmagan o'zgarish vaqti (0 — hammasi bulutda) */
  dirtyAt: number;
  /** oxirgi o'zgarish vaqti (ziddiyatda kim yangi) */
  changedAt: number;
  /** oxirgi muvaffaqiyatli sinxron */
  syncedAt: number;
}

/** off — kirilmagan; choose — tanlov kutilmoqda; pending — o'zgarish tez orada yuboriladi */
export type CloudStatus = "off" | "syncing" | "saved" | "pending" | "choose" | "offline" | "error";

export interface CloudView {
  status: CloudStatus;
  decision: CloudDecision | null;
  error: string | null;
  syncedAt: number;
}

export function fingerprint(keys: Keys) {
  return crc32(
    JSON.stringify(
      Object.keys(keys)
        .sort()
        .map((k) => [k, keys[k]]),
    ),
  );
}

export function preview(keys: Keys, save?: CloudSave): ProgressPreview {
  const s = summarize((k) => keys[k] ?? null);
  const p: ProgressPreview = {
    ...s,
    level: levelOf(xpFromRaw(keys[XP_KEY])),
    realm: !!keys[REALM_SAVE_KEY],
  };
  if (save) {
    p.time = save.time;
    p.device = save.device;
  }
  return p;
}

/** Saqlashga arziydigan progress bormi (faqat sozlama va hisoblagichlar — yo'q) */
export function meaningful(keys: Keys) {
  const p = preview(keys);
  return (
    p.gold > 0 ||
    p.achievements > 0 ||
    p.best > 0 ||
    p.heroes.length > 3 ||
    p.level > 1 ||
    xpFromRaw(keys[XP_KEY]) > 0 ||
    p.realm
  );
}

function loadState(): CloudState | null {
  try {
    const s = JSON.parse(localStorage.getItem(CLOUD_KEY) ?? "null") as CloudState | null;
    return s && typeof s.acc === "number" && typeof s.base === "number" ? s : null;
  } catch {
    return null;
  }
}

function saveState(s: CloudState | null) {
  try {
    if (s) localStorage.setItem(CLOUD_KEY, JSON.stringify(s));
    else localStorage.removeItem(CLOUD_KEY);
  } catch {
    /* saqlash imkonsiz */
  }
}

/** Shu qurilmaning raqami (zaxiralarda "boshqa qurilma" belgisi) */
export function deviceId() {
  try {
    const old = localStorage.getItem(DEVICE_ID_KEY);
    if (old && /^[a-z0-9]{8,24}$/.test(old)) return old;
    const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) =>
      (b % 36).toString(36),
    ).join("");
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return "nodevice";
  }
}

/** O'zgarishni tekshirish oralig'i */
const WATCH_MS = 3000;
/** Muhim o'zgarish (oltin, rekord, yutuq...) — shuncha vaqtda bulutga */
export const SAVE_DELAY = 10_000;
/** Faqat olam saqlanishi (joy, inventar) o'zgargan — daqiqada bir (bepul tarif yozuvlarini tejash) */
export const REALM_DELAY = 60_000;
/** keepalive so'rovi (ilova yopilayotganda) brauzerda 64 KB gacha */
const KEEPALIVE_MAX = 60_000;
/** Bular o'zgarsa ham "muhim" emas (olam joyi, mehmon raqami) */
const MINOR_KEYS: ReadonlySet<string> = new Set([REALM_SAVE_KEY, GUEST_KEY]);

const crcMap = (keys: Keys) => new Map(Object.entries(keys).map(([k, v]) => [k, crc32(v)]));

export class CloudSync {
  view: CloudView = { status: "off", decision: null, error: null, syncedAt: 0 };
  /** menyu: bulutdagi progressni hozir qo'llash mumkinmi (o'yin/olam ketmayapti) */
  canApply: () => boolean = () => true;
  /** progress almashtirildi — menyu holati qayta o'qilsin */
  onApplied: () => void = () => {};
  private subs = new Set<() => void>();
  /** tanlov oynasidagi bulut nusxasi */
  private cloudSave: CloudSave | null = null;
  /** o'yin paytida kelgan yangiroq bulut nusxasi — menyuga qaytganda qo'llanadi */
  private pendingApply: CloudSave | null = null;
  private busy = false;
  private started = false;
  /** oxirgi sinxrondagi har kalit izi: nima o'zgarganini bilish uchun */
  private crc = new Map<string, string>();
  private lastFp = "";
  private important = false;
  private retryAt = 0;
  private fails = 0;

  constructor(protected acc: AccountManager = account) {
    acc.onLogin(() => this.afterLogin());
    acc.beforeLogout(async () => {
      if (this.active() && this.isDirty()) await this.push();
    });
    acc.onSessionEnd(() => this.stop());
  }

  subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  };

  getView = () => this.view;

  protected setView(patch: Partial<CloudView>) {
    this.view = { ...this.view, ...patch };
    for (const f of this.subs) f();
  }

  get state() {
    return loadState();
  }

  /** Ilova ochilganda bir marta: kuzatish, internet qaytsa — sinxron, yopilganda — saqlash */
  start() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    window.setInterval(() => void this.tick(), WATCH_MS);
    window.addEventListener("online", () => {
      this.retryAt = 0;
      void this.pull();
    });
    window.addEventListener("pagehide", () => this.flush());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.flush();
      else if (this.canApply()) void this.pull();
    });
    if (this.acc.loggedIn) void this.pull();
  }

  /** Shu qurilmadagi sinxron holati (kirgan akkauntniki bo'lsa) */
  private active(): CloudState | null {
    const me = this.acc.state.me;
    if (!me || !this.acc.sessionToken || this.view.decision) return null;
    const st = loadState();
    return st && st.acc === me.id ? st : null;
  }

  /** Bulutga yuborilmagan o'zgarish bormi */
  isDirty() {
    const st = loadState();
    return !!st && fingerprint(collectProgress()) !== st.fp;
  }

  private isImportant(keys: Keys) {
    if (!this.crc.size) return true;
    for (const k of new Set([...Object.keys(keys), ...this.crc.keys()]))
      if (
        !MINOR_KEYS.has(k) &&
        (keys[k] === undefined ? "" : crc32(keys[k])) !== (this.crc.get(k) ?? "")
      )
        return true;
    return false;
  }

  /** Har 3 soniyada: o'zgarish bormi, yuborish vaqti keldimi (debounce: 10 s / olam — 60 s) */
  tick(now = Date.now()): Promise<void> | undefined {
    const st = this.active();
    if (!st || this.busy) return;
    if (this.pendingApply) {
      if (this.canApply()) this.applyNewer(this.pendingApply);
      return;
    }
    const keys = collectProgress();
    const fp = fingerprint(keys);
    if (fp === st.fp) {
      if (st.dirtyAt) saveState({ ...st, dirtyAt: 0 });
      if (this.view.status === "pending") this.setView({ status: "saved" });
      return;
    }
    let changed = false;
    if (!st.dirtyAt) {
      st.dirtyAt = now;
      changed = true;
    }
    if (fp !== this.lastFp) {
      this.lastFp = fp;
      st.changedAt = now;
      changed = true;
      if (!this.important) this.important = this.isImportant(keys);
    }
    if (changed) saveState(st);
    if (this.view.status === "saved") this.setView({ status: "pending" });
    if (now < this.retryAt) return;
    if (now - st.dirtyAt >= (this.important ? SAVE_DELAY : REALM_DELAY)) return this.push();
    return undefined;
  }

  /** Ilova fonga o'tdi yoki yopilmoqda: saqlanmagan o'zgarish darhol (keepalive) */
  flush() {
    if (this.active() && this.isDirty()) void this.push(true);
  }

  /** O'yin yoki olamdan menyuga qaytildi: kutib turgan bulut nusxasi yoki yangisini tekshirish */
  resume() {
    if (this.pendingApply && this.canApply()) return this.applyNewer(this.pendingApply);
    void this.pull();
  }

  /** Profil: "HOZIR SAQLASH" */
  syncNow() {
    this.retryAt = 0;
    return this.isDirty() ? this.push() : this.pull();
  }

  /** Qurilmadagi progressni bulutga (base — oxirgi ko'rilgan versiya; ziddiyatni server hal qiladi) */
  async push(keepalive = false) {
    const st = this.active();
    const token = this.acc.sessionToken;
    if (!st || !token || this.busy) return;
    const keys = collectProgress();
    const fp = fingerprint(keys);
    const body = {
      token,
      base: st.base,
      time: st.changedAt || Date.now(),
      device: currentDevice(),
      dev: deviceId(),
      data: packProgress(keys),
    };
    const ka = keepalive && JSON.stringify(body).length < KEEPALIVE_MAX;
    this.busy = true;
    if (!keepalive) this.setView({ status: "syncing" });
    const r = await call("save/put", body, ka ? { keepalive: true } : undefined);
    this.busy = false;
    const now = Date.now();
    const cur = loadState();
    if (!cur) return;
    if (r.ok) {
      const still = fingerprint(collectProgress()) !== fp;
      saveState({ ...cur, base: r.version, fp, dirtyAt: still ? now : 0, syncedAt: now });
      this.crc = crcMap(keys);
      this.important = still && this.important;
      this.fails = 0;
      this.retryAt = 0;
      return this.setView({ status: still ? "pending" : "saved", syncedAt: now, error: null });
    }
    if (r.error === "conflict" && "save" in r && r.save) return this.gotNewer(r.save);
    if (r.error === "auth") return this.sessionLost();
    if (r.error === "invalid" || r.error === "big") {
      // takror-takror yubormaymiz: progress o'zgarsa ham 5 daqiqadan keyin
      this.retryAt = now + 5 * 60_000;
      const field = "field" in r && r.field ? FIELD_TEXT[r.field as LimitField] : null;
      return this.setView({
        status: "error",
        error:
          r.error === "big"
            ? "Bulutga saqlanmadi: saqlanish juda katta"
            : `Bulutga saqlanmadi: imkonsiz qiymat${field ? ` (${field})` : ""}`,
      });
    }
    this.fails++;
    this.retryAt = now + Math.min(300_000, 5_000 * 2 ** this.fails);
    this.setView({
      status: r.error === "net" ? "offline" : "error",
      error: r.error === "net" ? null : ERROR_TEXT[r.error],
    });
  }

  /** Bulutda yangiroq nusxa bormi (ilova ochilganda, menyuga qaytganda, internet qaytganda) */
  async pull() {
    const me = this.acc.state.me;
    const token = this.acc.sessionToken;
    if (!me || !token || this.busy || this.view.decision) return;
    const st = this.active();
    // bu qurilmada boshqa (yoki hech qaysi) akkaunt bilan sinxron bo'lmagan — kirishdagidek
    if (!st) return this.afterLogin();
    this.busy = true;
    this.setView({ status: "syncing" });
    const r = await call("save/get", { token, have: st.base });
    this.busy = false;
    if (!r.ok) {
      if (r.error === "auth") return this.sessionLost();
      return this.setView({ status: r.error === "net" ? "offline" : "error" });
    }
    if (r.same || !r.save) {
      // bulut bo'sh (masalan, zaxiradan qaytarilmagan yangi akkaunt) — qurilmadagisi yuboriladi
      if (!r.same && st.base > 0) saveState({ ...st, base: 0, fp: "" });
      if (!r.same || this.isDirty()) return this.push();
      return this.setView({ status: "saved", syncedAt: Date.now(), error: null });
    }
    // ikkalasi ham o'zgargan — server vaqt bo'yicha hal qiladi (rad etsa — bulutdagisi keladi)
    if (this.isDirty()) return this.push();
    this.gotNewer(r.save);
  }

  /** Bulutda yangiroq nusxa: menyuda — darhol, o'yin/olam ketayotganda — menyuga qaytganda */
  private gotNewer(save: CloudSave) {
    if (!this.canApply()) {
      this.pendingApply = save;
      return this.setView({ status: "pending" });
    }
    this.applyNewer(save);
  }

  private applyNewer(save: CloudSave) {
    this.pendingApply = null;
    const me = this.acc.state.me;
    if (!me) return;
    this.apply(save, me.id);
    this.acc.notify("Boshqa qurilmadagi yangiroq progress yuklandi");
  }

  private async sessionLost() {
    await this.acc.dropSession();
    this.acc.notify("Sessiya tugadi — Telegram bilan qayta kiring");
  }

  /** Kirgandan keyin: bulut va qurilmadagi progress solishtiriladi */
  async afterLogin() {
    const me = this.acc.state.me;
    const token = this.acc.sessionToken;
    if (!me || !token || this.busy) return;
    this.busy = true;
    this.setView({ status: "syncing", error: null });
    const r = await call("save/get", { token });
    this.busy = false;
    if (!r.ok) return this.setView({ status: r.error === "net" ? "offline" : "error" });
    const cloud = r.save;
    const local = collectProgress();
    const st = loadState();
    // shu qurilmada shu akkaunt avval ham bo'lgan — oddiy sinxron
    if (st && st.acc === me.id) return this.reconcile(cloud, st);
    if (!cloud) {
      if (meaningful(local))
        return this.ask({ kind: "migrate", local: preview(local), cloud: null });
      return this.pushLocal(0, me.id, true);
    }
    const data = unpackProgress(cloud.data);
    if (!meaningful(local) || fingerprint(data) === fingerprint(local))
      return this.apply(cloud, me.id);
    this.cloudSave = cloud;
    this.ask({
      kind: "choose",
      local: preview(local),
      cloud: preview(data, cloud),
    });
  }

  private ask(decision: CloudDecision) {
    this.setView({ decision, status: "choose" });
  }

  /**
   * Tanlov oynasidan: local — qurilmadagisi akkauntga; cloud — bulutdagisi qurilmaga;
   * fresh — akkaunt yangidan (qurilmadagisi zaxiraga). Tanlanmagani zaxiralanadi
   * (qurilmadagisi — Sozlamalar -> OLDINGI HOLATGA QAYTARISH, bulutdagisi — serverda).
   */
  async resolve(choice: "local" | "cloud" | "fresh") {
    const me = this.acc.state.me;
    const d = this.view.decision;
    if (!me || !d) return;
    this.setView({ decision: null });
    const base = this.cloudSave?.version ?? 0;
    if (choice === "local") return this.pushLocal(base, me.id, true);
    backupProgress();
    if (choice === "cloud" && this.cloudSave) return this.apply(this.cloudSave, me.id);
    replaceProgress({});
    this.onApplied();
    return this.pushLocal(base, me.id, true);
  }

  /** Bulutdagi progressni qurilmaga yozish */
  protected apply(save: CloudSave, acc: number) {
    replaceProgress(unpackProgress(save.data));
    const now = Date.now();
    const keys = collectProgress();
    const fp = fingerprint(keys);
    saveState({ acc, base: save.version, fp, dirtyAt: 0, changedAt: save.time, syncedAt: now });
    this.crc = crcMap(keys);
    this.lastFp = fp;
    this.important = false;
    this.cloudSave = null;
    this.setView({ status: "saved", syncedAt: now, error: null });
    this.onApplied();
  }

  /** Tanlovdan keyin qurilmadagisi bulutga (force — ziddiyat tekshirilmaydi) */
  protected async pushLocal(base: number, acc: number, force: boolean) {
    const token = this.acc.sessionToken;
    if (!token) return;
    const local = collectProgress();
    const now = Date.now();
    this.busy = true;
    this.setView({ status: "syncing" });
    const r = await call("save/put", {
      token,
      base,
      time: now,
      device: currentDevice(),
      dev: deviceId(),
      data: packProgress(local),
      ...(force ? { force: true } : {}),
    });
    this.busy = false;
    if (!r.ok) {
      // keyinroq qayta urinadi (base o'zgarmaydi, o'zgarish "saqlanmagan")
      saveState({ acc, base, fp: "", dirtyAt: now, changedAt: now, syncedAt: 0 });
      return this.setView({ status: r.error === "net" ? "offline" : "error" });
    }
    saveState({
      acc,
      base: r.version,
      fp: fingerprint(local),
      dirtyAt: 0,
      changedAt: now,
      syncedAt: now,
    });
    this.crc = crcMap(local);
    this.cloudSave = null;
    this.setView({ status: "saved", syncedAt: now, error: null });
  }

  /** Shu qurilmada shu akkaunt bilan oldin ham sinxronlangan */
  protected reconcile(cloud: CloudSave | null, st: CloudState) {
    if (!cloud) {
      saveState({ ...st, base: 0, fp: "" });
      return this.push();
    }
    if (cloud.version === st.base && !this.isDirty())
      return this.setView({ status: "saved", syncedAt: st.syncedAt });
    // qurilmada o'zgarish bor — server vaqt bo'yicha hal qiladi; aks holda bulutdagisi
    if (this.isDirty()) return this.push();
    this.apply(cloud, st.acc);
  }

  /**
   * Server o'zi progressni o'zgartiradigan so'rov (muallif paneli, sovg'a olish): avval
   * qurilmadagi o'zgarish bulutga yoziladi, so'ng so'rov joriy versiya (base) bilan yuboriladi va
   * javobdagi yangi nusxa qurilmaga qo'llanadi. Ziddiyatda bulutdagisi yuklanib, bir marta qayta
   * uriniladi. Faqat menyuda (o'yin/olam ketmayotganda).
   */
  async mutate<R extends { ok: true; save: CloudSave }>(
    send: (base: number) => Promise<R | { ok: false; error: ErrCode; save?: CloudSave }>,
  ): Promise<R | { ok: false; error: ErrCode }> {
    const me = this.acc.state.me;
    if (!me || !this.acc.sessionToken) return { ok: false, error: "auth" };
    if (!this.canApply()) return { ok: false, error: "bad" };
    for (let i = 0; i < 50 && this.busy; i++) await new Promise((f) => setTimeout(f, 100));
    if (this.busy) return { ok: false, error: "rate" };
    if (this.isDirty()) await this.push();
    if (this.isDirty()) return { ok: false, error: "net" };
    for (let attempt = 0; attempt < 2; attempt++) {
      const st = this.active();
      if (!st) return { ok: false, error: "auth" };
      this.busy = true;
      const r = await send(st.base);
      this.busy = false;
      if (r.ok) {
        this.apply(r.save, me.id);
        return r;
      }
      if (r.error === "conflict" && r.save) {
        this.apply(r.save, me.id);
        continue;
      }
      if (r.error === "auth") void this.sessionLost();
      return r;
    }
    return { ok: false, error: "conflict" };
  }

  /** Zaxiralar ro'yxati (profil) */
  async backups() {
    const token = this.acc.sessionToken;
    if (!token) return null;
    const r = await call("save/backups", { token });
    return r.ok ? r.backups : null;
  }

  /** Zaxiradan tiklash: bulutda ham, shu qurilmada ham (faqat menyuda) */
  async restore(slot: number) {
    const token = this.acc.sessionToken;
    const me = this.acc.state.me;
    if (!token || !me || !this.canApply()) return false;
    const r = await call("save/restore", { token, slot });
    if (!r.ok) return false;
    this.apply(r.save, me.id);
    return true;
  }

  /** Chiqishda: sinxron holati qoladi (qayta kirsa — davom etadi), oyna yopiladi */
  stop() {
    this.cloudSave = null;
    this.pendingApply = null;
    this.setView({ status: "off", decision: null, error: null });
  }
}

export const cloud = new CloudSync();
