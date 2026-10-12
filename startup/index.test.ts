import { Container, Text, stripTerminalSequences, visibleWidth, type TUI } from "@earendil-works/pi-tui";
import type { Theme, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { SPRITE_PIXELS } from "./sprite.ts";
import { renderSprite as renderArtwork } from "./render.ts";
import { installStartupBanner as installBanner } from "./adapter.ts";
import { registerStartupBanner as registerBanner } from "./index.ts";
import { loadCatalog } from "../catalog/index.ts";

const vesna = loadCatalog().characters.find(character => character.id === "vesna")!;
const front = vesna.artworks.find(art => art.id === "front-blush")!;
const renderSprite = (width: number, mode: "truecolor" | "256color") => renderArtwork(front, width, mode);
const installStartupBanner = (tui: TUI, uiTheme: Theme) => installBanner(tui, uiTheme, () => front);
const registerStartupBanner = (pi: ExtensionAPI) => registerBanner(pi, () => front);

const FIXTURE_VERSION = "0.99.1";

const theme = {
  getColorMode: () => "truecolor",
  fg: (_color: string, text: string) => `\x1b[33m${text}\x1b[0m`,
} as Theme;

function startup(version = FIXTURE_VERSION) {
  const state = { expanded: false };
  const native = {
    render: (width: number) => new Text(
      ` ▀▀█  v${version}\n █▀ █ ${state.expanded ? "Ctrl+O expand tools" : "Ctrl+O more"}\nPi can explain its own features`,
      0, 0,
    ).render(width),
    invalidate: vi.fn(),
    setExpanded: (expanded: boolean) => { state.expanded = expanded; },
  };
  const header = new Container();
  header.addChild(native);
  const resources = new Container();
  for (const name of ["Context", "Skills", "Prompts", "Extensions"]) {
    resources.addChild(new Text(`[${name}]\n  project`, 0, 0));
  }
  const chat = new Container();
  chat.addChild(new Text("消息区域", 0, 0));
  const document = new Container();
  document.addChild(header);
  document.addChild(resources);
  document.addChild(chat);
  const tui = { children: [document] } as unknown as TUI;
  return { state, native, header, resources, chat, document, tui };
}

function text(lines: string[]): string {
  return lines.map(stripTerminalSequences).join("\n");
}

describe("像素小人启动页", () => {
  it("素材具有透明像素，头像上下半块绘制适配 truecolor 与 256 色", () => {
    expect(SPRITE_PIXELS).toHaveLength(40);
    expect(SPRITE_PIXELS.every(row => row.length === 40)).toBe(true);
    expect(SPRITE_PIXELS[0]).toContain(".");
    expect(SPRITE_PIXELS[29]?.[14]).toBe("u");
    expect(SPRITE_PIXELS[30]?.[25]).toBe("r");
    expect(SPRITE_PIXELS[32]?.[20]).toBe("t");
    for (const mode of ["truecolor", "256color"] as const) {
      const lines = renderSprite(40, mode);
      expect(lines).toHaveLength(20);
      expect(lines.some(line => /[▀▄█]/u.test(line))).toBe(true);
      expect(lines.every(line => visibleWidth(line) <= 40)).toBe(true);
      expect(lines.join("")).toMatch(mode === "truecolor" ? /\x1b\[38;2;/ : /\x1b\[38;5;/);
    }
    expect(renderSprite(0, "truecolor")).toEqual([]);
    expect(renderSprite(19, "truecolor")).toHaveLength(10);
    expect(renderSprite(100, "truecolor")).toHaveLength(20);
  });

  it("宽屏左侧人物右侧显示原生帮助与四类资源，刷新和 Ctrl+O 状态保持同步", () => {
    const { document, tui, header, resources, chat, native, state } = startup();
    const banner = installStartupBanner(tui, theme);
    header.children[0] = banner;
    expect(document.children).toHaveLength(2);
    expect(document.children[1]).toBe(chat);
    expect(document.render(120).every(line => visibleWidth(line) <= 120)).toBe(true);
    const initial = text(document.render(120));
    expect(initial).toContain(`base on pi v${FIXTURE_VERSION}`);
    expect(initial).toContain("Ctrl+O more");
    for (const label of ["Context", "Skills", "Prompts", "Extensions"]) expect(initial).toContain(`[${label}]`);
    expect(initial).toContain("消息区域");
    expect(initial).not.toContain(`▀▀█  v${FIXTURE_VERSION}`);
    banner.setExpanded?.(true);
    expect(state.expanded).toBe(true);
    expect(text(document.render(120))).toContain("Ctrl+O expand tools");
    resources.clear();
    resources.addChild(new Text("[Skills]\n  新资源", 0, 0));
    expect(text(document.render(120))).toContain("新资源");
    banner.invalidate?.();
    expect(native.invalidate).toHaveBeenCalled();
    banner.dispose?.();
    header.children[0] = native;
    expect(document.children).toEqual([header, resources, chat]);
    expect(text(document.render(120))).toContain(`▀▀█  v${FIXTURE_VERSION}`);
  });

  it("窄屏顺序排列，头像随宽度缩放且文本维持终端宽度", () => {
    const { document, tui, header } = startup();
    const banner = installStartupBanner(tui, theme);
    header.children[0] = banner;
    for (const width of [95, 40, 19]) {
      const lines = document.render(width);
      expect(lines.every(line => visibleWidth(line) <= width)).toBe(true);
      const body = text(lines);
      expect(body).toContain(`base on pi v${FIXTURE_VERSION}`);
      expect(body).toContain("[Extensions]");
      expect(body.indexOf("base on pi")).toBeLessThan(body.indexOf("[Context]"));
    }
  });

  it("主题颜色变化后重绘版本提示与人物颜色", () => {
    let colorMode: "truecolor" | "256color" = "truecolor";
    const changingTheme = {
      getColorMode: () => colorMode,
      fg: (_color: string, value: string) => `\x1b[34m${value}\x1b[0m`,
    } as Theme;
    const { document, tui, header } = startup();
    const banner = installStartupBanner(tui, changingTheme);
    header.children[0] = banner;
    expect(document.render(120).join("")).toMatch(/\x1b\[38;2;/);
    colorMode = "256color";
    document.invalidate();
    expect(document.render(120).join("")).toMatch(/\x1b\[38;5;/);
    expect(text(document.render(120))).toContain(`base on pi v${FIXTURE_VERSION}`);
  });

  it("版本文字直接读取当前原生启动页，适配后续 Pi 版本", () => {
    for (const version of ["0.100.2", "1.2.3-rc.1"]) {
      const { document, tui, header } = startup(version);
      const banner = installStartupBanner(tui, theme);
      header.children[0] = banner;
      expect(banner.dispose).toBeTypeOf("function");
      expect(text(document.render(120))).toContain(`base on pi v${version}`);
      expect(text(document.render(120))).not.toContain(`base on pi v${FIXTURE_VERSION}`);
    }
  });

  it("原生启动树结构变化时保留能定位到的原生组件", () => {
    const { document, tui, native } = startup();
    const wrapper = new Container();
    wrapper.addChild(document);
    tui.children[0] = wrapper;
    expect(installStartupBanner(tui, theme)).toBe(native);
    expect(document.children).toHaveLength(3);
  });

  it("Logo 特征不匹配时保留原生顶部及原生资源容器", () => {
    const { document, tui, header, native, resources } = startup();
    native.render = width => new Text("原生启动信息", 0, 0).render(width);
    const banner = installStartupBanner(tui, theme);
    expect(banner).toBe(native);
    expect(document.children[0]).toBe(header);
    expect(document.children[1]).toBe(resources);
  });

  it("切换画作后原生顶部复用同一布局并渲染另一张头像", () => {
    const { document, tui, header } = startup();
    const art = vesna.artworks.find(item => item.id === "tilted")!;
    let current = front;
    const banner = installBanner(tui, theme, () => current);
    header.children[0] = banner;
    const first = document.render(120).join("\n");
    current = art;
    banner.invalidate();
    const second = document.render(120).join("\n");
    expect(second).not.toBe(first);
    expect(text(document.render(120))).toContain("base on pi v0.99.1");
  });

  it("TUI 生命周期重复启动保持幂等，结束时恢复原生顶部布局", () => {
    const handlers = new Map<string, (event: unknown, ctx: unknown) => void>();
    registerStartupBanner({ on: (event: string, handler: unknown) => {
      handlers.set(event, handler as (event: unknown, ctx: unknown) => void);
      return () => {};
    } } as unknown as ExtensionAPI);
    const { tui, document, header, resources } = startup();
    const setHeader = vi.fn((factory?: (tui: TUI, theme: Theme) => ReturnType<typeof installStartupBanner>) => {
      if (!factory) {
        const active = header.children[0] as ReturnType<typeof installStartupBanner>;
        active.dispose?.();
        return;
      }
      header.children[0] = factory(tui, theme);
    });
    const ctx = { mode: "tui", ui: { setHeader } };
    handlers.get("session_start")!({}, { mode: "rpc", ui: { setHeader } });
    handlers.get("session_start")!({}, ctx);
    handlers.get("session_start")!({}, ctx);
    expect(setHeader).toHaveBeenCalledTimes(1);
    handlers.get("session_shutdown")!({}, ctx);
    expect(setHeader).toHaveBeenCalledTimes(2);
    expect(document.children[0]).toBe(header);
    expect(document.children[1]).toBe(resources);
    handlers.get("session_start")!({}, ctx);
    expect(setHeader).toHaveBeenCalledTimes(3);
  });
});
