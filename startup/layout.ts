import type { Theme } from "@earendil-works/pi-coding-agent";
import { type Component, type Container, visibleWidth } from "@earendil-works/pi-tui";
import type { Artwork } from "../catalog/types.ts";
import { renderSprite } from "./render.ts";

const SPRITE_WIDTH = 40;
const COLUMN_GAP = 3;
const SIDE_BY_SIDE_WIDTH = 96;

// StartupLayout 将原生顶部帮助与资源容器排在人物右侧，窄屏时按原顺序纵向展示。
export class StartupLayout implements Component {
  constructor(
    private readonly header: Container,
    private readonly resources: Container,
    private readonly theme: Theme,
    private readonly getArtwork: () => Artwork,
  ) {}

  invalidate(): void {
    this.header.invalidate();
    this.resources.invalidate();
  }

  render(width: number): string[] {
    if (width <= 0) return [];
    if (width < SIDE_BY_SIDE_WIDTH) {
      return [
        ...renderSprite(this.getArtwork(), width, this.theme.getColorMode()),
        ...this.header.render(width),
        ...this.resources.render(width),
      ];
    }

    const left = renderSprite(this.getArtwork(), SPRITE_WIDTH, this.theme.getColorMode());
    const rightWidth = width - SPRITE_WIDTH - COLUMN_GAP;
    const right = [...this.header.render(rightWidth), ...this.resources.render(rightWidth)];
    return Array.from({ length: Math.max(left.length, right.length) }, (_, index) => {
      const portrait = left[index] ?? "";
      const text = right[index] ?? "";
      return `${portrait}${" ".repeat(SPRITE_WIDTH - visibleWidth(portrait) + COLUMN_GAP)}${text}`;
    });
  }
}
