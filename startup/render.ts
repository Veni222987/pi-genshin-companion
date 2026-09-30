import { backgroundAnsi, foregroundAnsi, rgbColor, type TerminalColorMode } from "@earendil-works/pi-tui";
import type { Artwork } from "../catalog/types.ts";

const RESET = "\x1b[0m";

// renderSprite 在终端列宽内按最近邻像素缩放，并用半方块合并上下两行。
export function renderSprite(artwork: Artwork, width: number, mode: TerminalColorMode): string[] {
  const size = artwork.height;
  const target = Math.min(size, Math.max(0, Math.floor(width)));
  if (target === 0) return [];
  const colors = Object.fromEntries(Object.entries(artwork.palette).map(([key, [r, g, b]]) => [key, rgbColor(r, g, b)]));
  const pixels = Array.from({ length: target }, (_, y) =>
    Array.from({ length: target }, (_, x) =>
      artwork.pixels[Math.floor(y * size / target)]?.[Math.floor(x * artwork.width / target)] ?? ".",
    ),
  );
  const lines: string[] = [];
  for (let y = 0; y < target; y += 2) {
    let line = "";
    for (let x = 0; x < target; x++) {
      const top = pixels[y]?.[x] ?? ".";
      const bottom = pixels[y + 1]?.[x] ?? ".";
      if (top === "." && bottom === ".") {
        line += " ";
      } else if (top === bottom) {
        line += `${foregroundAnsi(colors[top]!, mode)}█${RESET}`;
      } else if (top === ".") {
        line += `${foregroundAnsi(colors[bottom]!, mode)}▄${RESET}`;
      } else if (bottom === ".") {
        line += `${foregroundAnsi(colors[top]!, mode)}▀${RESET}`;
      } else {
        line += `${foregroundAnsi(colors[top]!, mode)}${backgroundAnsi(colors[bottom]!, mode)}▀${RESET}`;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
