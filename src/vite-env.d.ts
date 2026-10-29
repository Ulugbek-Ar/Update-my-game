/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" — statik build (GitHub Pages yoki Android ilova): server funksiyalari yo'q */
  readonly VITE_STATIC?: string;
  /** "1" — Android ilova (Capacitor) build'i */
  readonly VITE_APP?: string;
}
