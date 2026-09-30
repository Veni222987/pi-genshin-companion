import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import type { Artwork } from "../catalog/types.ts";
import { installStartupBanner } from "./adapter.ts";

// registerStartupBanner 在 TUI 启动时注册头像与原生资源布局，并返回当前布局的刷新入口。
export function registerStartupBanner(pi: ExtensionAPI, getArtwork: () => Artwork): () => void {
  let active = false;
  let tui: TUI | undefined;
  let component: Component | undefined;
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui" || active) return;
    ctx.ui.setHeader((currentTui, theme) => {
      const installed = installStartupBanner(currentTui, theme, getArtwork);
      if (!installed.dispose) return installed;
      active = true;
      tui = currentTui;
      component = installed;
      return {
        render: width => installed.render(width),
        invalidate: () => installed.invalidate(),
        setExpanded: (expanded: boolean) => installed.setExpanded?.(expanded),
        dispose: () => {
          installed.dispose?.();
          active = false;
          tui = undefined;
          component = undefined;
        },
      };
    });
  });
  pi.on("session_shutdown", (_event, ctx) => {
    if (active && ctx.mode === "tui") ctx.ui.setHeader(undefined);
  });
  return () => { component?.invalidate(); tui?.requestRender(); };
}
