/** Rol belgilari: kod bilan chizilgan 7x7 piksel ikonka (TANK — qal'a minorasi, JANGCHI — qilich, SEHRGAR — yulduz, UZOQDAN — o'q). */
import { ROLE_INFO, type Role } from "./hero";

export const ROLE_ICONS: Record<Role, readonly string[]> = {
  tank: ["X.X.X.X", "XXXXXXX", ".XXXXX.", ".XX.XX.", ".XXXXX.", ".XXXXX.", "XXXXXXX"],
  warrior: ["......X", ".....X.", "....X..", "X..X...", ".XX....", ".XX....", "X..X..."],
  caster: ["...X...", "...X...", "XXXXXXX", ".XXXXX.", "..XXX..", ".XX.XX.", "X.....X"],
  ranged: ["...XXXX", ".....XX", "....X.X", "...X..X", "..X....", "XX.....", "XX....."],
};

/** Rol belgisini (x, y — chap-yuqori) qora kontur bilan chizadi. */
export function drawRoleIcon(
  c: CanvasRenderingContext2D,
  role: Role,
  x: number,
  y: number,
  color = ROLE_INFO[role].color,
) {
  const rows = ROLE_ICONS[role];
  c.fillStyle = "#000000";
  rows.forEach((row, py) =>
    [...row].forEach((ch, px) => {
      if (ch === "X") c.fillRect(Math.round(x) + px - 1, Math.round(y) + py - 1, 3, 3);
    }),
  );
  c.fillStyle = color;
  rows.forEach((row, py) =>
    [...row].forEach((ch, px) => {
      if (ch === "X") c.fillRect(Math.round(x) + px, Math.round(y) + py, 1, 1);
    }),
  );
}
