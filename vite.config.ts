// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// GH_PAGES=1 — GitHub Pages uchun statik (SPA) build: serversiz, /Update-my-game/ ostida.
// APP_BUILD=1 (`npm run build:app`) — Android ilova (Capacitor) uchun statik build: serversiz, / ostida.
const ghPages = process.env["GH_PAGES"] === "1";
const appBuild = process.env["APP_BUILD"] === "1";
const base = appBuild ? "/" : "/Update-my-game/";

// Statik build'larda server talab qiladigan tugmalar yashiriladi (src/lib/platform.ts).
// VITE_* o'zgaruvchilar process.env'dan import.meta.env'ga o'tadi.
if (ghPages || appBuild) process.env["VITE_STATIC"] = "1";
if (appBuild) process.env["VITE_APP"] = "1";

export default defineConfig(
  ghPages || appBuild
    ? {
        nitro: false,
        vite: { base },
        tanstackStart: {
          server: { entry: "server" },
          spa: { enabled: true, prerender: { outputPath: "/index.html" } },
          router: { basepath: base },
        },
      }
    : {
        tanstackStart: {
          // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
          // nitro/vite builds from this
          server: { entry: "server" },
        },
      },
);
