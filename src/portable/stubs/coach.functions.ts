// Portativ build'da server yo'q: AI maslahatchi yashirin (HAS_SERVER = false), chaqirilmaydi.
export async function getCombatTip(_opts: unknown): Promise<{ tip: string }> {
  throw new Error("AI maslahatchi portativ versiyada yo'q");
}
