/**
 * Oflayn tarqatiladigan build'lar (portativ HTML, Windows dasturi, Android ilova) uchun yangi
 * versiya tekshiruvi: GitHub Pages'dagi version.json har deploy'da yangilanadi
 * (.github/workflows/pages.yml). Internet bo'lmasa — jim, hech narsa ko'rsatilmaydi.
 */
import { IS_APP, IS_DESKTOP, IS_PORTABLE } from "./platform";

export const VERSION_URL = "https://ulugbek-ar.github.io/Update-my-game/version.json";
export const RELEASES_URL = "https://github.com/Ulugbek-Ar/Update-my-game/releases/latest";
export const TELEGRAM_URL = "https://t.me/piksel_qala";

/** Bu build o'zi yangilanmaydi — yangi versiya haqida xabar kerak */
export const NEEDS_UPDATE_CHECK = IS_PORTABLE || IS_DESKTOP || IS_APP;

function parts(v: string): number[] {
  return v
    .trim()
    .replace(/^v/i, "")
    .split(".")
    .map((p) => parseInt(p, 10) || 0);
}

/** a versiyasi b dan yangiroqmi (x.y.z) */
export function isNewer(a: string, b: string): boolean {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/** Yangi versiyani yuklab olish havolasi: Android — Telegram kanal (APK), kompyuter — Release */
export function downloadUrl(): string {
  return IS_APP ? TELEGRAM_URL : RELEASES_URL;
}

/** version.json'dan oxirgi versiya; joriydan yangi bo'lsa — uni, aks holda (yoki xatoda) null */
export async function fetchNewerVersion(
  current: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 8000,
): Promise<string | null> {
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : 0;
  try {
    const r = await fetchFn(`${VERSION_URL}?t=${Date.now()}`, {
      cache: "no-store",
      ...(ctl ? { signal: ctl.signal } : {}),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { version?: unknown };
    const v = typeof j.version === "string" ? j.version : "";
    return /^\d+\.\d+\.\d+$/.test(v) && isNewer(v, current) ? v : null;
  } catch {
    return null;
  } finally {
    if (t) clearTimeout(t);
  }
}
