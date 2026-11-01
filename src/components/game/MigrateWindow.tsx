/**
 * Birinchi kirishda progress tanlovi:
 *  - "MEHMON PROGRESSI": akkaunt bo'sh — qurilmadagi progressni akkauntga o'tkazish;
 *  - "QAYSI PROGRESS QOLSIN?": ikkalasida ham bor — ko'rib chiqib, birini tanlash
 *    (ikkinchisi zaxiraga tushadi).
 */
import { cloud, type CloudDecision, type ProgressPreview } from "@/account/cloud";
import { DEVICE_NAME } from "@/account/protocol";
import { HERO_LIST } from "@/game/hero";
import { HeroAvatar, Icon, LevelBadge, PixelWindow } from "./pixel";
import { btn, when } from "./pixelUi";

function PreviewCard({
  title,
  p,
  action,
  onPick,
  primary,
}: {
  title: string;
  p: ProgressPreview;
  action: string;
  onPick: () => void;
  primary?: boolean;
}) {
  return (
    <li className="flex flex-1 flex-col gap-2 border-2 border-border bg-[#1f1730] p-3">
      <span className="text-primary">{title}</span>
      <span className="grid grid-cols-2 gap-x-3 gap-y-1 text-foreground">
        <span className="inline-flex items-center gap-2">
          <LevelBadge level={p.level} />
          {p.level}-daraja
        </span>
        <span className="inline-flex items-center gap-2">
          <Icon id="coin" color="#ffcc33" />
          Oltin: {p.gold}
        </span>
        <span className="inline-flex items-center gap-2">
          <Icon id="trophy" color="#ffcc33" />
          Yutuqlar: {p.achievements}
        </span>
        <span>Rekord: {p.best}</span>
      </span>
      <span className="flex flex-wrap items-center gap-1" aria-label="Qahramonlar">
        {HERO_LIST.filter((h) => p.heroes.includes(h.id)).map((h) => (
          <HeroAvatar key={h.id} hero={h.id} size={20} />
        ))}
        <span className="ml-2 text-muted-foreground">{p.realm ? "Olam: bor" : "Olam: yo'q"}</span>
      </span>
      {p.time ? (
        <span className="text-muted-foreground">
          Oxirgi o'zgarish: {when(p.time)}
          {p.device ? ` · ${DEVICE_NAME[p.device]}` : ""}
        </span>
      ) : null}
      <button onClick={onPick} className={btn(primary ? "pixel" : "pixelOutline", "mt-auto")}>
        {action}
      </button>
    </li>
  );
}

export function MigrateWindow({
  decision,
  onLater,
}: {
  decision: CloudDecision;
  onLater: () => void;
}) {
  if (decision.kind === "migrate")
    return (
      <PixelWindow label="Mehmon progressi" title="MEHMON PROGRESSI" onClose={onLater} accent>
        <p className="text-foreground">
          Bu qurilmada mehmon sifatida o'ynagan progressingiz bor. Uni akkauntga o'tkazamizmi?
          Shunda u bulutda saqlanadi va boshqa qurilmalarda ham ochiladi.
        </p>
        <ul className="flex flex-col gap-3 sm:flex-row">
          <PreviewCard
            title="BU QURILMA (MEHMON)"
            p={decision.local}
            action="AKKAUNTGA O'TKAZISH"
            primary
            onPick={() => void cloud.resolve("local")}
          />
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => void cloud.resolve("fresh")} className={btn("pixelOutline")}>
            YANGIDAN BOSHLASH
          </button>
          <span className="text-muted-foreground">
            Yangidan boshlansa, qurilmadagi progress zaxiraga olinadi (Sozlamalar → OLDINGI HOLATGA
            QAYTARISH).
          </span>
        </div>
      </PixelWindow>
    );
  return (
    <PixelWindow
      label="Qaysi progress qolsin"
      title="QAYSI PROGRESS QOLSIN?"
      onClose={onLater}
      wide
      accent
    >
      <p className="text-foreground">
        Akkauntda ham, bu qurilmada ham progress bor. Qaysi birini saqlaymiz? Ikkinchisi yo'qolmaydi
        — zaxiraga olinadi.
      </p>
      <ul className="flex flex-col gap-3 sm:flex-row">
        <PreviewCard
          title="BU QURILMA"
          p={decision.local}
          action="SHUNI SAQLASH"
          onPick={() => void cloud.resolve("local")}
        />
        {decision.cloud && (
          <PreviewCard
            title="AKKAUNT (BULUT)"
            p={decision.cloud}
            action="SHUNI SAQLASH"
            primary
            onPick={() => void cloud.resolve("cloud")}
          />
        )}
      </ul>
      <button onClick={onLater} className={btn("pixelOutline", "self-start")}>
        KEYINROQ
      </button>
    </PixelWindow>
  );
}
