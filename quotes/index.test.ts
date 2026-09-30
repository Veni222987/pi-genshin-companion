import type { TUI } from "@earendil-works/pi-tui";
import { foregroundAnsi, stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ELEMENT_COLORS } from "../catalog/elements.ts";
import type { Character } from "../catalog/types.ts";
import { formatQuote, nextQuoteIndex, QuotePlayer } from "./index.ts";

const vesna: Character = {
  id: "vesna", name: "薇斯纳", englishName: "Vesna", element: "anemo", defaultArtwork: "front-blush", artworks: [],
  quotes: [{ category: "问候", text: "早上好" }, { category: "问候", text: "晚上好" }],
};
const example: Character = { ...vesna, id: "example", name: "示例角色", element: "electro", quotes: [] };
afterEach(() => { vi.useRealTimers(); });

describe("语录轮播", () => {
  it("随机抽取并在多条候选之间切换", () => {
    expect(nextQuoteIndex(0)).toBe(-1);
    expect(nextQuoteIndex(1, 0)).toBe(0);
    expect(nextQuoteIndex(2, -1, () => 0)).toBe(0);
    expect(nextQuoteIndex(2, 0, () => 0)).toBe(1);
    expect(nextQuoteIndex(2, 1, () => 0)).toBe(0);
  });

  it("终端文字按列宽限制在两行并保留宽屏全文", () => {
    const quote = { category: "问候", text: "这是一段用于检查窄屏折行与省略的完整语录。" };
    const lines = formatQuote("薇斯纳", quote, 16);
    expect(lines).toHaveLength(2);
    expect(lines.every(line => visibleWidth(line) <= 16)).toBe(true);
    expect(lines[1]).toContain("…");
    expect(formatQuote("薇斯纳", quote, 100)).toEqual([`薇斯纳: ${quote.text}`]);
    expect(formatQuote("薇斯纳", undefined, 100)).toEqual(["薇斯纳: 暂无语录"]);
    expect(formatQuote("薇斯纳", quote, 0)).toEqual([]);
  });

  it("整条语录按元素着色，窄屏逐行复位并适配两种终端颜色模式", () => {
    const quote = { category: "同伴生命值低·其二", text: "别逞强，亲爱的朋友。" };
    const character: Character = { ...vesna, quotes: [quote] };
    const player = new QuotePlayer(character);
    for (const mode of ["truecolor", "256color"] as const) {
      const prefix = foregroundAnsi(ELEMENT_COLORS.anemo, mode);
      expect(player.render(80, mode)).toEqual([`${prefix}薇斯纳: 别逞强，亲爱的朋友。\x1b[0m`]);
      expect(player.render(80, mode)[0]).toMatch(mode === "truecolor" ? /\x1b\[38;2;/ : /\x1b\[38;5;/);
      const lines = player.render(12, mode);
      expect(lines).toHaveLength(2);
      expect(lines.every(line => line.startsWith(prefix) && line.endsWith("\x1b[0m") && visibleWidth(line) <= 12)).toBe(true);
      expect(stripTerminalSequences(lines.join(" "))).toContain("薇斯纳: ");
    }
    expect(player.render(0, "truecolor")).toEqual([]);
  });

  it("每分钟切换，换画作不重置角色语录，换角色立即刷新，停止后清理定时器", () => {
    vi.useFakeTimers();
    const requestRender = vi.fn();
    const player = new QuotePlayer(vesna, () => 0);
    const first = player.render(80, "truecolor").join(" ");
    player.start({ requestRender } as unknown as TUI);
    expect(vi.getTimerCount()).toBe(1);
    player.start({ requestRender } as unknown as TUI);
    expect(vi.getTimerCount()).toBe(1);
    player.setCharacter(vesna);
    expect(player.render(80, "truecolor").join(" ")).toBe(first);
    vi.advanceTimersByTime(59_999);
    expect(player.render(80, "truecolor").join(" ")).toBe(first);
    expect(requestRender).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    const second = player.render(80, "truecolor").join(" ");
    expect(second).not.toBe(first);
    expect(requestRender).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(player.render(80, "truecolor").join(" ")).toBe(first);
    expect(requestRender).toHaveBeenCalledTimes(2);
    player.setCharacter(example);
    const electro = foregroundAnsi(ELEMENT_COLORS.electro, "truecolor");
    expect(player.render(80, "truecolor")).toEqual([`${electro}示例角色: 暂无语录\x1b[0m`]);
    vi.advanceTimersByTime(60_000);
    expect(player.render(80, "truecolor")).toEqual([`${electro}示例角色: 暂无语录\x1b[0m`]);
    player.stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(requestRender).toHaveBeenCalledTimes(4);
  });
});
