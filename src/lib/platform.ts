/**
 * Build turi (vite.config.ts va vite.portable.config.ts belgilaydi):
 * - oddiy build (Lovable) — server funksiyalari bor;
 * - GitHub Pages (GH_PAGES=1) va Android ilova (`npm run build:app`) — statik, serversiz;
 * - portativ HTML (`npm run build:portable`) va Windows dasturi (`npm run build:desktop`) —
 *   bitta HTML faylga yig'ilgan statik build.
 */
export const HAS_SERVER = import.meta.env.VITE_STATIC !== "1";
/** Android ilova (Capacitor) ichida ishlaydigan build */
export const IS_APP = import.meta.env.VITE_APP === "1";
/** Bitta HTML faylga yig'ilgan build (portativ HTML yoki Windows dasturi) */
export const IS_PORTABLE = import.meta.env.VITE_PORTABLE === "1";
/** Windows dasturi (Tauri) ichida ishlaydigan build */
export const IS_DESKTOP = import.meta.env.VITE_DESKTOP === "1";
