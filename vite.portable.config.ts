// Portativ HTML (`npm run build:portable`) va Windows dasturi (`npm run build:desktop`) uchun
// alohida build: TanStack Start'siz, faqat o'yin sahifasi (src/portable/main.tsx), bitta IIFE
// skript + bitta CSS — scripts/build-portable.mjs ularni bitta HTML faylga joylaydi.
// O'yin manbalari va statik flaglar build:app bilan bir xil (VITE_STATIC=1, serversiz).
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const src = fileURLToPath(new URL("./src", import.meta.url));
const desktop = process.env["VITE_DESKTOP"] === "1";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      // server funksiyalari portativ build'da yo'q (AI maslahatchi yashirin)
      { find: "@/lib/coach.functions", replacement: `${src}/portable/stubs/coach.functions.ts` },
      {
        find: "@/lib/version.functions",
        replacement: `${src}/portable/stubs/version.functions.ts`,
      },
      { find: "@", replacement: src },
    ],
  },
  define: {
    "import.meta.env.VITE_STATIC": JSON.stringify("1"),
    "import.meta.env.VITE_PORTABLE": JSON.stringify("1"),
    "import.meta.env.VITE_DESKTOP": JSON.stringify(desktop ? "1" : ""),
    "import.meta.env.VITE_APP": JSON.stringify(""),
    "import.meta.env.VITE_SERVER_URL": JSON.stringify(process.env["VITE_SERVER_URL"] ?? ""),
  },
  publicDir: false,
  build: {
    outDir: desktop ? "dist/desktop-build" : "dist/portable-build",
    emptyOutDir: true,
    // eski brauzerlar: Chrome/Edge 80+, Firefox 78+ (polifillar: src/portable/polyfills.ts)
    target: ["chrome80", "edge80", "firefox78", "safari13"],
    cssCodeSplit: false,
    // shriftlar CSS ichiga data: URI bo'lib kiradi — tashqi so'rov yo'q
    assetsInlineLimit: 100_000_000,
    modulePreload: false,
    chunkSizeWarningLimit: 4000,
    rolldownOptions: {
      input: `${src}/portable/main.tsx`,
      // dinamik importlar (Capacitor) bundle ichiga kiradi — preload yordamchisidagi
      // import.meta ishlatilmaydi
      onLog(level, log, handler) {
        if (log.code === "EMPTY_IMPORT_META") return;
        handler(level, log);
      },
      output: {
        format: "iife",
        codeSplitting: false,
        entryFileNames: "game.js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});
