import { useSyncExternalStore } from "react";
import { getLang, onLangChange, type Lang } from "./index";

/** Komponent til o'zgarganda qayta chiziladi (t() ni ishlatadigan yuqori komponentlarda) */
export function useLang(): Lang {
  return useSyncExternalStore(onLangChange, getLang, () => "uz" as const);
}
