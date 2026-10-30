/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" — statik build (GitHub Pages yoki Android ilova): server funksiyalari yo'q */
  readonly VITE_STATIC?: string;
  /** "1" — Android ilova (Capacitor) build'i */
  readonly VITE_APP?: string;
  /** "1" — bitta HTML faylga yig'ilgan build (portativ HTML yoki Windows dasturi) */
  readonly VITE_PORTABLE?: string;
  /** "1" — Windows dasturi (Tauri) build'i */
  readonly VITE_DESKTOP?: string;
  /** Abadiyat olami multiplayer serveri (bo'lmasa — olam faqat oflayn) */
  readonly VITE_SERVER_URL?: string;
}
