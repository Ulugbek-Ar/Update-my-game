/**
 * Build turi (vite.config.ts belgilaydi):
 * - oddiy build (Lovable) — server funksiyalari bor;
 * - GitHub Pages (GH_PAGES=1) va Android ilova (`npm run build:app`) — statik, serversiz.
 */
export const HAS_SERVER = import.meta.env.VITE_STATIC !== "1";
/** Android ilova (Capacitor) ichida ishlaydigan build */
export const IS_APP = import.meta.env.VITE_APP === "1";
