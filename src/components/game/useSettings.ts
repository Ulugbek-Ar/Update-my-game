import { useEffect, useState } from "react";
import { loadSettings, onSettingsChange, type Settings } from "@/game/settings";

/** Joriy sozlamalar: SOZLAMALAR oynasida o'zgarsa darhol yangilanadi. */
export function useSettings() {
  const [s, setS] = useState<Settings>(loadSettings);
  useEffect(() => onSettingsChange(setS), []);
  return s;
}
