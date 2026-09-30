import { rgbColor } from "@earendil-works/pi-tui";

// ELEMENT_COLORS 统一定义七元素在终端中的代表色。
export const ELEMENT_COLORS = {
  pyro: rgbColor(220, 103, 65),
  hydro: rgbColor(78, 137, 210),
  anemo: rgbColor(75, 178, 151),
  electro: rgbColor(151, 118, 198),
  dendro: rgbColor(119, 156, 72),
  cryo: rgbColor(104, 167, 192),
  geo: rgbColor(190, 146, 57),
} as const;

export type Element = keyof typeof ELEMENT_COLORS;

// isElement 判断角色配置中的元素是否属于七元素。
export function isElement(value: unknown): value is Element {
  return typeof value === "string" && Object.hasOwn(ELEMENT_COLORS, value);
}
