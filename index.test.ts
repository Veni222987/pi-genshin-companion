import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { foregroundAnsi, type TUI } from "@earendil-works/pi-tui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ELEMENT_COLORS } from "./catalog/elements.ts";
import registerCompanion from "./index.ts";
import { saveChoice } from "./store.ts";

vi.mock("./store.ts", () => ({
  choicePath: () => "/temporary/genshin-companion.json",
  loadChoice: () => ({ artworkByCharacter: {}, preambleEnabled: false }),
  savePreambleEnabled: vi.fn((enabled, saved) => ({ ...saved, preambleEnabled: enabled })),
  saveChoice: vi.fn((selection, saved) => ({ characterId: selection.characterId, preambleEnabled: saved.preambleEnabled,
    artworkByCharacter: { ...saved.artworkByCharacter, [selection.characterId]: selection.artworkId } })),
}));

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe("独立包会话与命令", () => {
  it("重复启动注册语录，选择当前画作、取消和失败保存保持会话状态，结束清理定时器", async () => {
    vi.useFakeTimers();
    const events = new Map<string, Array<(event: unknown, ctx: ExtensionContext) => void>>();
    const commands = new Map<string, (args: string, ctx: ExtensionContext) => Promise<void>>();
    const api = {
      on: (name: string, handler: (event: unknown, ctx: ExtensionContext) => void) => {
        events.set(name, [...events.get(name) ?? [], handler]);
        return () => {};
      },
      registerCommand: (name: string, options: { handler: (args: string, ctx: ExtensionContext) => Promise<void> }) => commands.set(name, options.handler),
    } as unknown as ExtensionAPI;
    let activeWidget: { render(width: number): string[]; dispose(): void } | undefined;
    let colorMode: "truecolor" | "256color" = "truecolor";
    const theme = { getColorMode: () => colorMode } as Theme;
    const requestRender = vi.fn();
    const setWidget = vi.fn((_key: string, factory?: (tui: TUI, theme: Theme) => typeof activeWidget) => {
      activeWidget?.dispose();
      activeWidget = factory?.({ requestRender } as unknown as TUI, theme);
    });
    const custom = vi.fn().mockResolvedValueOnce({ characterId: "vesna", artworkId: "tilted" })
      .mockResolvedValueOnce(undefined).mockResolvedValueOnce({ characterId: "vesna", artworkId: "front-blush" });
    const setHeader = vi.fn();
    const notify = vi.fn();
    const ctx = { mode: "tui", hasUI: true, ui: { setWidget, setHeader, custom, notify } } as unknown as ExtensionContext;
    registerCompanion(api);
    const emit = (name: string) => { for (const handler of events.get(name) ?? []) handler({}, ctx); };
    emit("session_start");
    expect(setWidget).toHaveBeenCalledWith("genshin-companion-quotes", expect.any(Function), { placement: "belowEditor" });
    expect(vi.getTimerCount()).toBe(1);
    expect(activeWidget?.render(80)[0]).toMatch(/^\x1b\[38;2;/);
    expect(activeWidget?.render(80)[0]).toContain("薇斯纳: ");
    colorMode = "256color";
    expect(activeWidget?.render(80)[0]?.startsWith(foregroundAnsi(ELEMENT_COLORS.anemo, "256color"))).toBe(true);
    const previousWidget = activeWidget;
    emit("session_start");
    expect(vi.getTimerCount()).toBe(1);
    previousWidget?.dispose();
    expect(vi.getTimerCount()).toBe(1);
    const command = commands.get("genshin-companion")!;
    await command("", ctx);
    expect(saveChoice).toHaveBeenCalledWith({ characterId: "vesna", artworkId: "tilted" }, expect.any(Object));
    await command("", ctx);
    expect(saveChoice).toHaveBeenCalledTimes(1);
    vi.mocked(saveChoice).mockImplementationOnce(() => { throw new Error("denied"); });
    await command("", ctx);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("当前会话"), "warning");
    vi.advanceTimersByTime(60_000);
    expect(requestRender).toHaveBeenCalledTimes(1);
    emit("session_shutdown");
    expect(vi.getTimerCount()).toBe(0);
    expect(setWidget).toHaveBeenLastCalledWith("genshin-companion-quotes", undefined, { placement: "belowEditor" });
  });
});
