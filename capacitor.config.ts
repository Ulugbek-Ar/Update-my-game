import type { CapacitorConfig } from "@capacitor/cli";

// Android ilova: o'yin `npm run build:app` natijasidan (dist/client) ilova ichiga joylanadi
// va oflayn ishlaydi — saytdan yuklanmaydi (server.url yo'q).
const config: CapacitorConfig = {
  appId: "com.ulugbek.pikselqala",
  appName: "Piksel Qal'a",
  webDir: "dist/client",
  // Saqlanishlar (localStorage) shu manzilga bog'langan: https://localhost.
  // Ilova yangilanganda yo'qolmasligi uchun sxema va hostni HECH QACHON o'zgartirmang.
  server: { androidScheme: "https", hostname: "localhost" },
  backgroundColor: "#1f1730",
  android: {
    // ilova ichidagi saytni Chrome DevTools'da ochish faqat debug build'da
    webContentsDebuggingEnabled: false,
    allowMixedContent: false,
  },
  plugins: {
    // to'liq ekran (immersive) MainActivity'da; kesik (notch) joylari CSS env(safe-area-inset-*) bilan
    SystemBars: { insetsHandling: "native", initialViewportFitValueHint: "cover" },
  },
};

export default config;
