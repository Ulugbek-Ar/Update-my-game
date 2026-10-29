/** Hudud xaritasi: seed bilan generatsiya qilingan relyef + JSON'dagi qo'lda qo'yilgan joylar, chunk'larga bo'lingan. */
import type { Feature, RegionDef } from "./schema";
import { fbm, hash2 } from "./rng";
import { CHUNK, TILE_IDS } from "./tiles";

function inRect(tx: number, ty: number, a: readonly [number, number, number, number]) {
  return tx >= a[0] && ty >= a[1] && tx < a[0] + a[2] && ty < a[1] + a[3];
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax,
    dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** Xususiyat egallaydigan to'rtburchak (plitkalarda) — chunk bilan kesishmasa o'tkazib yuboriladi. */
function featureBox(f: Feature): [number, number, number, number] {
  switch (f.type) {
    case "rect":
    case "scatter":
      return [f.x, f.y, f.w, f.h];
    case "ellipse":
      return [
        Math.floor(f.x - f.rx),
        Math.floor(f.y - f.ry),
        Math.ceil(f.rx * 2) + 2,
        Math.ceil(f.ry * 2) + 2,
      ];
    case "path": {
      const xs = f.points.map((p) => p[0]),
        ys = f.points.map((p) => p[1]);
      const r = Math.ceil(f.width);
      const x = Math.min(...xs) - r,
        y = Math.min(...ys) - r;
      return [x, y, Math.max(...xs) + r - x + 1, Math.max(...ys) + r - y + 1];
    }
    case "stamp":
      return [f.x, f.y, Math.max(...f.rows.map((r) => r.length)), f.rows.length];
  }
}

function applyFeature(
  f: Feature,
  fi: number,
  seed: number,
  get: (tx: number, ty: number) => number,
  set: (tx: number, ty: number, t: number) => void,
  box: readonly [number, number, number, number],
) {
  const [bx, by, bw, bh] = featureBox(f);
  const x0 = Math.max(bx, box[0]),
    y0 = Math.max(by, box[1]);
  const x1 = Math.min(bx + bw, box[0] + box[2]),
    y1 = Math.min(by + bh, box[1] + box[3]);
  for (let ty = y0; ty < y1; ty++)
    for (let tx = x0; tx < x1; tx++) {
      switch (f.type) {
        case "rect": {
          const b = f.border;
          if (b && tx >= f.x + b && ty >= f.y + b && tx < f.x + f.w - b && ty < f.y + f.h - b)
            break;
          set(tx, ty, TILE_IDS[f.tile]);
          break;
        }
        case "ellipse": {
          const dx = (tx - f.x) / f.rx,
            dy = (ty - f.y) / f.ry;
          if (dx * dx + dy * dy <= 1) set(tx, ty, TILE_IDS[f.tile]);
          break;
        }
        case "path": {
          for (let i = 1; i < f.points.length; i++) {
            const a = f.points[i - 1]!,
              b = f.points[i]!;
            if (segDist(tx, ty, a[0], a[1], b[0], b[1]) <= f.width / 2) {
              set(tx, ty, TILE_IDS[f.tile]);
              break;
            }
          }
          break;
        }
        case "stamp": {
          const ch = f.rows[ty - f.y]?.[tx - f.x];
          const t = ch ? f.legend[ch] : undefined;
          if (t) set(tx, ty, TILE_IDS[t]);
          break;
        }
        case "scatter": {
          if (f.on && !f.on.some((n) => TILE_IDS[n] === get(tx, ty))) break;
          if (hash2(seed + 7919 * (fi + 1), tx, ty) < f.density) set(tx, ty, TILE_IDS[f.tile]);
          break;
        }
      }
    }
}

/**
 * Bitta chunk'ni noldan quradi (sof funksiya): asos plitka -> shovqin qatlamlari -> xususiyatlar.
 * Server ham aynan shu natijani oladi; kelajakda chunk'lar so'rov bo'yicha yuklanadi.
 */
export function buildChunk(region: RegionDef, cx: number, cy: number) {
  const data = new Uint8Array(CHUNK * CHUNK);
  const ox = cx * CHUNK,
    oy = cy * CHUNK;
  const box = [ox, oy, CHUNK, CHUNK] as const;
  const get = (tx: number, ty: number) => data[(ty - oy) * CHUNK + tx - ox] ?? 0;
  const set = (tx: number, ty: number, t: number) => {
    data[(ty - oy) * CHUNK + tx - ox] = t;
  };
  data.fill(TILE_IDS[region.terrain.base]);
  region.terrain.layers.forEach((l, li) => {
    for (let ty = oy; ty < oy + CHUNK; ty++)
      for (let tx = ox; tx < ox + CHUNK; tx++) {
        if (l.area && !inRect(tx, ty, l.area)) continue;
        if (l.on && !l.on.some((n) => TILE_IDS[n] === get(tx, ty))) continue;
        if (fbm(region.seed + 977 * (li + 1), tx * l.scale, ty * l.scale) > l.threshold)
          set(tx, ty, TILE_IDS[l.tile]);
      }
  });
  region.features.forEach((f, fi) => applyFeature(f, fi, region.seed, get, set, box));
  return data;
}

/** Hududning asosiy (o'zgarmas) plitkalari; chunk'lar birinchi so'ralganda quriladi. */
export class RealmMap {
  readonly w: number;
  readonly h: number;
  private chunks = new Map<number, Uint8Array>();

  constructor(public region: RegionDef) {
    this.w = region.chunks.w * CHUNK;
    this.h = region.chunks.h * CHUNK;
  }

  chunk(cx: number, cy: number) {
    const key = cy * 1024 + cx;
    let c = this.chunks.get(key);
    if (!c) {
      c = buildChunk(this.region, cx, cy);
      this.chunks.set(key, c);
    }
    return c;
  }

  /** Hududdan tashqari — qoya (o'tib bo'lmaydi). */
  base(tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return TILE_IDS.cliff;
    const c = this.chunk(Math.floor(tx / CHUNK), Math.floor(ty / CHUNK));
    return c[(ty % CHUNK) * CHUNK + (tx % CHUNK)] ?? TILE_IDS.cliff;
  }
}
