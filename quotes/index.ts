import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { foregroundAnsi, truncateToWidth, wrapTextWithAnsi, type TerminalColorMode, type TUI } from "@earendil-works/pi-tui";
import { ELEMENT_COLORS } from "../catalog/elements.ts";
import type { Character, Quote } from "../catalog/types.ts";

// nextQuoteIndex 为角色选择一条语录；存在多条时与上一条不同。
export function nextQuoteIndex(length: number, current = -1, random = Math.random): number {
  if (length <= 0) return -1;
  if (length === 1) return 0;
  if (current < 0 || current >= length) return Math.min(length - 1, Math.floor(random() * length));
  const offset = Math.min(length - 2, Math.floor(random() * (length - 1)));
  return offset >= current ? offset + 1 : offset;
}

// formatQuote 将角色名及语录限制在终端两行，按列宽处理窄屏。
export function formatQuote(name: string, quote: Quote | undefined, width: number): string[] {
  if (width <= 0) return [];
  const text = `${name}: ${quote?.text ?? "暂无语录"}`;
  const lines = wrapTextWithAnsi(text, width);
  if (lines.length <= 2) return lines;
  return [lines[0]!, truncateToWidth(lines[1]! + "…", width, "…")];
}

// QuotePlayer 维护单个编辑器下方 Widget 的角色语录和分钟轮播。
export class QuotePlayer {
  private character: Character;
  private index: number;
  private timer?: ReturnType<typeof setInterval>;
  private tui?: TUI;

  constructor(character: Character, private readonly random = Math.random) {
    this.character = character;
    this.index = nextQuoteIndex(character.quotes.length, -1, random);
  }

  render(width: number, mode: TerminalColorMode): string[] {
    const prefix = foregroundAnsi(ELEMENT_COLORS[this.character.element], mode);
    return formatQuote(this.character.name, this.character.quotes[this.index], width)
      .map(line => `${prefix}${line}\x1b[0m`);
  }

  setCharacter(character: Character): void {
    if (character.id === this.character.id) return;
    this.character = character;
    this.index = nextQuoteIndex(character.quotes.length, -1, this.random);
    this.tui?.requestRender();
  }

  advance(): void {
    this.index = nextQuoteIndex(this.character.quotes.length, this.index, this.random);
    this.tui?.requestRender();
  }

  start(tui: TUI): void {
    this.stop();
    this.tui = tui;
    this.timer = setInterval(() => this.advance(), 60_000);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.tui = undefined;
  }
}

// registerQuotes 在 TUI 中注册独立语录 Widget，并在会话结束时清理轮播。
export function registerQuotes(pi: ExtensionAPI, getCharacter: () => Character): (character: Character) => void {
  let player: QuotePlayer | undefined;
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;
    player?.stop();
    const currentPlayer = new QuotePlayer(getCharacter());
    player = currentPlayer;
    ctx.ui.setWidget("genshin-companion-quotes", (tui, theme) => {
      currentPlayer.start(tui);
      return { render: width => currentPlayer.render(width, theme.getColorMode()), invalidate() {}, dispose: () => currentPlayer.stop() };
    }, { placement: "belowEditor" });
  });
  pi.on("session_shutdown", (_event, ctx) => {
    player?.stop();
    player = undefined;
    if (ctx.mode === "tui") ctx.ui.setWidget("genshin-companion-quotes", undefined, { placement: "belowEditor" });
  });
  return character => player?.setCharacter(character);
}
