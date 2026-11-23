// Piksel Qal'a: index.js uchun turlar (kutubxona JS da yozilgan).
export interface FxMeta {
  name: string;
  size: [number, number];
  origin: [number, number];
  duration: number;
  loop?: boolean;
  options?: Record<string, unknown>;
}
export interface FxModule {
  meta: FxMeta;
}
export interface FxFrame {
  w: number;
  h: number;
  ox: number;
  oy: number;
  color: Uint32Array;
  light: Uint32Array;
}
export interface FxInstance {
  readonly t: number;
  update(dt: number): void;
  draw(frame: FxFrame, layer?: "back" | "front"): void;
  stop(): void;
  done(): boolean;
}
/** Effekt tanasi (o'lim effektlari uchun): niqob, piksel ranglari, chap-yuqori burchak (oyoq — 0,0) */
export interface FxActor {
  mask: { w: number; h: number; data: Uint8Array };
  pixels: (string | null)[];
  x: number;
  y: number;
}
export function createFx(mod: FxModule, o?: Record<string, unknown>): FxInstance;
export function createFrame(w: number, h: number, ox?: number, oy?: number): FxFrame;
export function clearFrame(f: FxFrame): FxFrame;
export function composite(
  f: FxFrame,
  out: Uint8ClampedArray,
  bg?: null | number | Uint32Array,
  lightK?: number,
): Uint8ClampedArray;
export type FxName =
  | "hitSpark"
  | "critHit"
  | "poof"
  | "disintegrate"
  | "soulRise"
  | "spawnPortal"
  | "collectBurst"
  | "sunburst"
  | "manaBurst"
  | "thunderclap"
  | "plasmaExplosion";
export const FX: Record<FxName, FxModule>;
