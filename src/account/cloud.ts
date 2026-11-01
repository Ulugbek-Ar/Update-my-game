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
import { account, type AccountManager } from "./account";
import { call, currentDevice } from "./api";
import { CLOUD_KEY, DEVICE_ID_KEY } from "./keys";
import type { CloudSave } from "./protocol";
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

export type CloudStatus = "off" | "syncing" | "saved" | "pending" | "offline" | "error";

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

export class CloudSync {
  constructor(protected acc: AccountManager = account) {
    acc.onLogin(() => this.afterLogin());
    acc.onSessionEnd(() => this.stop());
  }

  view: CloudView = { status: "off", decision: null, error: null, syncedAt: 0 };
  /** menyu: bulutdagi progressni hozir qo'llash mumkinmi (o'yin/olam ketmayapti) */
  canApply: () => boolean = () => true;
  /** progress almashtirildi — menyu holati qayta o'qilsin */
  onApplied: () => void = () => {};
  private subs = new Set<() => void>();
  private cloudSave: CloudSave | null = null;

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

  /** Kirgandan keyin: bulut va qurilmadagi progress solishtiriladi */
  async afterLogin() {
    const me = this.acc.state.me;
    const token = this.acc.sessionToken;
    if (!me || !token) return;
    this.setView({ status: "syncing", error: null });
    const r = await call("save/get", { token });
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
    this.setView({ decision, status: "pending" });
  }

  /**
   * Tanlov oynasidan: local — qurilmadagisi akkauntga; cloud — bulutdagisi qurilmaga;
   * fresh — akkaunt yangidan (qurilmadagisi zaxiraga). Tanlanmagani zaxiralanadi.
   */
  async resolve(choice: "local" | "cloud" | "fresh") {
    const me = this.acc.state.me;
    const d = this.view.decision;
    if (!me || !d) return;
    this.setView({ decision: null });
    const base = this.cloudSave?.version ?? 0;
    if (choice === "local") return this.pushLocal(base, me.id, true);
    // qurilmadagi progress zaxiraga: Sozlamalar -> Progressni ko'chirish -> OLDINGI HOLATGA QAYTARISH
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
    saveState({
      acc,
      base: save.version,
      fp: fingerprint(collectProgress()),
      dirtyAt: 0,
      changedAt: save.time,
      syncedAt: now,
    });
    this.cloudSave = null;
    this.setView({ status: "saved", syncedAt: now, error: null });
    this.onApplied();
  }

  /** Qurilmadagi progressni bulutga (force — ziddiyatni tekshirmasdan, tanlovdan keyin) */
  protected async pushLocal(base: number, acc: number, force: boolean) {
    const token = this.acc.sessionToken;
    if (!token) return;
    const local = collectProgress();
    const now = Date.now();
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
    this.cloudSave = null;
    this.setView({ status: "saved", syncedAt: now, error: null });
  }

  /** Shu qurilmada shu akkaunt bilan oldin ham sinxronlangan */
  protected reconcile(cloud: CloudSave | null, st: CloudState) {
    const local = collectProgress();
    const dirty = fingerprint(local) !== st.fp;
    if (!cloud) return this.pushLocal(0, st.acc, true);
    if (cloud.version === st.base) {
      if (dirty) return this.pushLocal(st.base, st.acc, false);
      return this.setView({ status: "saved", syncedAt: st.syncedAt });
    }
    if (!dirty) return this.apply(cloud, st.acc);
    // ikkalasi ham o'zgargan: keyinroq o'zgargani qoladi (server ham shu qoida bilan)
    if (st.changedAt > cloud.time) return this.pushLocal(st.base, st.acc, false);
    return this.apply(cloud, st.acc);
  }

  /** Chiqishda: sinxron holati qoladi (qayta kirsa — davom etadi), oyna yopiladi */
  stop() {
    this.cloudSave = null;
    this.setView({ status: "off", decision: null, error: null });
  }
}

export const cloud = new CloudSync();
