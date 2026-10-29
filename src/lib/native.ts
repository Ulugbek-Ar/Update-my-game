/**
 * Android ilova (Capacitor) bilan bog'lanish: "Orqaga" tugmasi, fonga o'tish, ilovadan chiqish.
 * Saytda (IS_APP = false) Capacitor yuklanmaydi; "Orqaga" ni brauzerda sinash uchun
 * `window.dispatchEvent(new Event("app:back"))` ishlatiladi.
 */
import { IS_APP } from "./platform";

/** Brauzerda "Orqaga" tugmasini sinash hodisasi */
export const BACK_EVENT = "app:back";

/** "Orqaga" bosilganda nima qilinadi (yuqoridan pastga birinchi mosi). */
export type BackAction =
  | "close-window" // ochiq oyna (do'kon, sozlamalar, chiqish so'rovi...) yopiladi
  | "game" // o'yinda pauza, pauzada — pauza oynasi yopiladi (davom etadi)
  | "realm" // olamda: dialog/panel yopiladi, aks holda pauza
  | "map" // xaritadan bosh menyuga
  | "exit-confirm"; // bosh menyuda "Chiqishni xohlaysizmi?"

export interface BackState {
  /** Bosh menyu ustida React oynasi ochiq */
  windowOpen: boolean;
  /** Dunyo o'yini ketmoqda */
  inGame: boolean;
  /** Abadiyat olami ochiq */
  inRealm: boolean;
  /** Sarguzasht xaritasi ochiq */
  inMap: boolean;
}

export function backAction(s: BackState): BackAction {
  if (s.windowOpen) return "close-window";
  if (s.inGame) return "game";
  if (s.inRealm) return "realm";
  if (s.inMap) return "map";
  return "exit-confirm";
}

type Off = () => void;

/** Telefonning "Orqaga" tugmasi. Tinglovchi bor ekan, Android o'zi ilovani yopmaydi. */
export function onBackButton(cb: () => void): Off {
  window.addEventListener(BACK_EVENT, cb);
  let off: Off | null = null;
  let alive = true;
  if (IS_APP)
    void import("@capacitor/app").then(async ({ App }) => {
      const h = await App.addListener("backButton", cb);
      if (alive) off = () => void h.remove();
      else void h.remove();
    });
  return () => {
    alive = false;
    window.removeEventListener(BACK_EVENT, cb);
    off?.();
  };
}

/** Ilova fonga o'tdi (active = false) yoki qaytdi (active = true). */
export function onAppActive(cb: (active: boolean) => void): Off {
  if (!IS_APP) return () => {};
  let off: Off | null = null;
  let alive = true;
  void import("@capacitor/app").then(async ({ App }) => {
    const h = await App.addListener("appStateChange", (s) => cb(s.isActive));
    if (alive) off = () => void h.remove();
    else void h.remove();
  });
  return () => {
    alive = false;
    off?.();
  };
}

/** Ilovadan chiqish (saytda — hech narsa). */
export function exitApp() {
  if (IS_APP) void import("@capacitor/app").then(({ App }) => App.exitApp());
}
