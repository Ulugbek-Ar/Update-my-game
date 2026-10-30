import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, loadSettings, onSettingsChange, type Settings } from "@/game/settings";

/**
 * Joriy sozlamalar: SOZLAMALAR oynasida o'zgarsa darhol yangilanadi. Birinchi chizishda asl
 * qiymatlar (server bilan bir xil — hydration), saqlangani effektda o'qiladi.
 */
export function useSettings() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => {
    setS(loadSettings());
    return onSettingsChange(setS);
  }, []);
  return s;
}
