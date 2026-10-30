/**
 * Windows dasturi (Tauri) bilan bog'lanish. Tauri API'si `window.__TAURI__` orqali olinadi
 * (src-tauri/tauri.conf.json: withGlobalTauri) — npm paketisiz, boshqa build'larga ta'sir qilmaydi.
 */
import { IS_DESKTOP } from "./platform";

interface TauriUpdate {
  version: string;
  downloadAndInstall(): Promise<void>;
}

interface TauriGlobal {
  window?: {
    getCurrentWindow(): {
      isFullscreen(): Promise<boolean>;
      setFullscreen(v: boolean): Promise<void>;
    };
  };
  opener?: { openUrl(url: string): Promise<void> };
  updater?: { check(): Promise<TauriUpdate | null> };
  process?: { relaunch(): Promise<void> };
}

function tauri(): TauriGlobal | undefined {
  return IS_DESKTOP ? (window as Window & { __TAURI__?: TauriGlobal }).__TAURI__ : undefined;
}

/** F11 — to'liq ekran (Windows dasturida). */
export function installDesktop() {
  if (!IS_DESKTOP) return;
  window.addEventListener("keydown", (e) => {
    if (e.key !== "F11") return;
    e.preventDefault();
    const w = tauri()?.window?.getCurrentWindow();
    if (w) void w.isFullscreen().then((f) => w.setFullscreen(!f));
  });
}

/** Havolani tashqi brauzerda ochish (dasturda — tizim brauzeri, saytda — yangi oyna). */
export function openExternal(url: string) {
  const opener = tauri()?.opener;
  if (opener) void opener.openUrl(url);
  else window.open(url, "_blank", "noopener");
}

/** Dasturda o'z-o'zini yangilash bormi (Tauri updater ulangan) */
export function canSelfUpdate(): boolean {
  return !!tauri()?.updater;
}

/**
 * Yangi versiyani yuklab, o'rnatib, dasturni qayta ochadi. Saqlanishlar AppData'da — o'chmaydi.
 * false — yangilanish topilmadi (masalan, updater imzosiz build).
 */
export async function selfUpdate(): Promise<boolean> {
  const t = tauri();
  const update = await t?.updater?.check();
  if (!update) return false;
  await update.downloadAndInstall();
  await t?.process?.relaunch();
  return true;
}
