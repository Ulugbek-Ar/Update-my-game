/**
 * Kichik piksel ikonkalar (teglar, artefaktlar): satrlar + belgilar palitrasi, kod bilan chiziladi.
 * "." — shaffof. Bir marta rasterlanib keshlanadi (kalit — id va rang).
 */
const cache = new Map<string, HTMLCanvasElement>();

export function renderPixelIcon(
  ctx: CanvasRenderingContext2D,
  key: string,
  rows: readonly string[],
  colors: Readonly<Record<string, string>>,
  x: number,
  y: number,
  scale = 1,
) {
  let canvas = cache.get(key);
  if (!canvas) {
    if (typeof document === "undefined") return;
    canvas = document.createElement("canvas");
    canvas.width = Math.max(...rows.map((r) => r.length));
    canvas.height = rows.length;
    const raster = canvas.getContext("2d");
    if (!raster) return;
    rows.forEach((row, py) =>
      [...row].forEach((ch, px) => {
        const col = colors[ch];
        if (ch === "." || !col) return;
        raster.fillStyle = col;
        raster.fillRect(px, py, 1, 1);
      }),
    );
    cache.set(key, canvas);
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, Math.round(x), Math.round(y), canvas.width * scale, canvas.height * scale);
  ctx.restore();
}

/** Ikonkadagi turli ranglar soni (5 rang qoidasi testi uchun) */
export function iconColorCount(rows: readonly string[]) {
  return new Set(rows.join("").replace(/\./g, "")).size;
}
