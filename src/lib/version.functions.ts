import { createServerFn } from "@tanstack/react-start";
import { GAME_VERSION } from "@/game/version";

// Returns the version of the currently deployed server build.
export const getLatestVersion = createServerFn({ method: "GET" }).handler(async () => {
  return { version: GAME_VERSION };
});
