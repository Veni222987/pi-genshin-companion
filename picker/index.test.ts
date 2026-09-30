import { visibleWidth } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { loadCatalog } from "../catalog/index.ts";
import { CompanionPicker, searchCharacters } from "./index.ts";

const vesna = loadCatalog().characters[0]!;
const example = { ...vesna, id: "example", name: "示例角色", englishName: "Example" };
const theme = { getColorMode: () => "truecolor" } as Theme;

function picker(done = vi.fn()) {
  return { done, page: new CompanionPicker([vesna, example], { characterId: "vesna", artworkId: "front-blush" },
    { artworkByCharacter: { example: "tilted" }, preambleEnabled: false }, theme, done) };
}

describe("交互式同伴选择", () => {
  it("按英文名大小写无关搜索，使用方向键选择画作和角色并确认", () => {
    expect(searchCharacters([vesna, example], "VES")).toEqual([vesna]);
    expect(searchCharacters([vesna, example], "mpl")).toEqual([example]);
    const { page, done } = picker();
    page.handleInput("\x1b[D");
    expect(page.artwork?.id).toBe("tilted");
    page.handleInput("\x1b[C");
    expect(page.artwork?.id).toBe("front-blush");
    page.handleInput("\x1b[B");
    expect(page.character?.id).toBe("example");
    expect(page.artwork?.id).toBe("tilted");
    page.handleInput("\r");
    expect(done).toHaveBeenCalledWith({ characterId: "example", artworkId: "tilted" });
  });

  it("输入过滤、无匹配回退和取消不提交暂存选择", () => {
    const { page, done } = picker();
    for (const key of "vES") page.handleInput(key);
    expect(page.filtered).toEqual([vesna]);
    page.handleInput("z");
    expect(page.character).toBeUndefined();
    page.handleInput("\x7f");
    expect(page.character).toBe(vesna);
    page.handleInput("\x1b[D");
    page.handleInput("\x1b");
    expect(done).toHaveBeenCalledWith(undefined);
  });

  it("宽屏左右预览、窄屏上下预览，内容在列宽之内", () => {
    const { page } = picker();
    for (const width of [86, 72, 50, 20, 8]) {
      const rows = page.render(width);
      expect(rows.length).toBeLessThanOrEqual(27);
      expect(rows.every(row => visibleWidth(row) <= width)).toBe(true);
      if (width >= 20) expect(rows.join(" ")).toContain("正脸腮红版");
    }
    expect(page.render(86).join(" ")).toContain("Vesna");
  });
});
