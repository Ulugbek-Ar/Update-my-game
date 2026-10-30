import { GAME_VERSION } from "@/game/version";

// Portativ build'da server yo'q: yangi versiya src/lib/update.ts orqali tekshiriladi.
export async function getLatestVersion() {
  return { version: GAME_VERSION };
}
