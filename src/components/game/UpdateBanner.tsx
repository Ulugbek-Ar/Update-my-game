/**
 * Bosh menyuda "Yangi versiya chiqdi!" xabari — oflayn tarqatiladigan build'lar uchun
 * (portativ HTML, Windows dasturi, Android ilova; src/lib/update.ts). Internet bo'lmasa — hech
 * narsa ko'rinmaydi. Windows dasturida updater bo'lsa: YANGILASH — yuklab, o'rnatib, qayta ochadi
 * (saqlanishlar AppData'da qoladi); aks holda YUKLAB OLISH — Release yoki Telegram kanal.
 */
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GAME_VERSION } from "@/game/version";
import { canSelfUpdate, openExternal, selfUpdate } from "@/lib/desktop";
import { downloadUrl, fetchNewerVersion } from "@/lib/update";

/** Bir seansda bir marta tekshiriladi (menyu qayta ochilganda so'rov takrorlanmaydi) */
let latest: Promise<string | null> | null = null;

function checkOnce() {
  if (!latest) {
    latest =
      typeof navigator !== "undefined" && navigator.onLine === false
        ? Promise.resolve(null)
        : fetchNewerVersion(GAME_VERSION);
  }
  return latest;
}

export function UpdateBanner() {
  const [version, setVersion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void checkOnce().then((v) => {
      if (alive) setVersion(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!version) return null;

  const self = canSelfUpdate();
  const onClick = async () => {
    if (!self) return openExternal(downloadUrl());
    setBusy(true);
    try {
      if (!(await selfUpdate())) openExternal(downloadUrl());
    } catch {
      openExternal(downloadUrl());
    }
    setBusy(false);
  };

  // chap yuqori burchakda: sarlavha (o'rtada) va oy (o'ngda) yopilmasin
  return (
    <div
      role="status"
      className="absolute left-2 top-2 z-10 flex max-w-[30%] flex-col items-start gap-2 border-2 border-primary bg-card px-3 py-2 text-left text-[8px] sm:text-[10px] leading-relaxed text-foreground"
    >
      <span>Yangi versiya v{version} chiqdi!</span>
      <button
        onClick={() => void onClick()}
        disabled={busy}
        className={cn(buttonVariants({ variant: "pixel", size: "none" }), "px-3 py-1")}
      >
        {busy ? "YUKLANMOQDA..." : self ? "YANGILASH" : "YUKLAB OLISH"}
      </button>
    </div>
  );
}
