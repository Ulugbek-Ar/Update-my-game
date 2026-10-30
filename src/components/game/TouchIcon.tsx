import type { TouchIcon as IconId } from "@/game/touchLayout";

/**
 * Sensor tugmalari ikonkalari — kod bilan chizilgan 8x8 piksel rasm (yozuv sig'maganda).
 * "#" — asosiy rang (currentColor), "+" — yorqin rang.
 */
const ICONS: Record<IconId, string[]> = {
  sword: [
    "......++",
    ".....+#+",
    "....+#+.",
    "#..+#+..",
    ".##.+...",
    "..##....",
    ".#.##...",
    "#...#...",
  ],
  orb: [
    "..####..",
    ".#++###.",
    "#++#####",
    "#+######",
    "########",
    "########",
    ".######.",
    "..####..",
  ],
  arrow: [
    "....####",
    "......##",
    ".....#.#",
    "....#..+",
    "...#....",
    "+.#.....",
    ".#......",
    "+.+.....",
  ],
  bullet: [
    "...+....",
    "..+++...",
    "..###...",
    "..###...",
    "..###...",
    "..###...",
    ".#####..",
    ".#####..",
  ],
  dash: [
    "........",
    "+++.....",
    "....####",
    ".++++###",
    "....####",
    "+++.....",
    "........",
    "........",
  ],
  teleport: [
    "...+....",
    "...#....",
    ".+.#.+..",
    "..###...",
    "+##+##+.",
    "..###...",
    ".+.#.+..",
    "...#....",
  ],
  jump: [
    "..+.....",
    ".++.....",
    "+######.",
    ".++...#.",
    "..+...#.",
    "......#.",
    "....###.",
    "........",
  ],
  slide: [
    "........",
    "........",
    "....##..",
    "....##..",
    "..####+.",
    ".+.###..",
    "+######.",
    "++++....",
  ],
  talk: [
    ".######.",
    "#......#",
    "#.+.+.+#",
    "#......#",
    ".######.",
    "..##....",
    ".#......",
    "........",
  ],
  book: [
    "........",
    "###.###.",
    "#+#.#+#.",
    "#+#.#+#.",
    "#+#.#+#.",
    "###.###.",
    "...#....",
    "........",
  ],
  map: [
    "........",
    "##.##.##",
    "#+##+.+#",
    "#.#+#+.#",
    "#+.#.#+#",
    "##.##.##",
    "........",
    "........",
  ],
};

export function TouchIconSvg({ id, size, glow }: { id: IconId; size: number; glow: string }) {
  const rows = ICONS[id];
  const main: string[] = [];
  const hi: string[] = [];
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === "#") main.push(`M${x} ${y}h1v1H${x}z`);
      else if (ch === "+") hi.push(`M${x} ${y}h1v1H${x}z`);
    }),
  );
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 8 8"
      width={size}
      height={size}
      shapeRendering="crispEdges"
    >
      <path d={main.join("")} fill="currentColor" />
      <path d={hi.join("")} fill={glow} />
    </svg>
  );
}
