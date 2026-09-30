import type { Theme } from "@earendil-works/pi-coding-agent";
import {
  Container, sliceByColumn, stripTerminalSequences, visibleWidth, wrapTextWithAnsi,
  type Component, type TUI,
} from "@earendil-works/pi-tui";
import type { Artwork } from "../catalog/types.ts";
import { StartupLayout } from "./layout.ts";

interface ExpandableComponent extends Component {
  setExpanded(expanded: boolean): void;
}

const TOP_LOGO = /^ ▀▀█  v(\S+)/;
const BOTTOM_LOGO = " █▀ █ ";
const LOGO_PREFIX_WIDTH = 6;

// decorateNativeHeader 保留 Pi 的原生帮助与展开行为，只替换前两行的 Logo 区域。
export function decorateNativeHeader(native: ExpandableComponent, theme: Theme): ExpandableComponent {
  return {
    render(width): string[] {
      if (width <= 0) return [];
      const source = native.render(Math.max(80, width + LOGO_PREFIX_WIDTH));
      const nativeVersion = readNativeVersion(source);
      if (!nativeVersion) return native.render(width);
      const trim = (line: string, columns: number): string =>
        sliceByColumn(line, columns, Math.max(0, visibleWidth(line) - columns)).trimEnd();
      const version = theme.fg("dim", `base on pi v${nativeVersion}`);
      const content = [version, trim(source[1]!, LOGO_PREFIX_WIDTH), ...source.slice(2).map(line => trim(line, 1))];
      return content.flatMap(line => wrapTextWithAnsi(line, width));
    },
    invalidate: () => native.invalidate(),
    setExpanded: expanded => native.setExpanded(expanded),
  };
}

function readNativeVersion(lines: string[]): string | undefined {
  if (lines.length < 2 || !stripTerminalSequences(lines[1]!).startsWith(BOTTOM_LOGO)) return undefined;
  return TOP_LOGO.exec(stripTerminalSequences(lines[0]!))?.[1];
}

function isExpandable(value: Component): value is ExpandableComponent {
  return "setExpanded" in value && typeof value.setExpanded === "function";
}

// installStartupBanner 在匹配 Pi 原生启动结构时复用资源组件，并注册可恢复的布局。
export function installStartupBanner(tui: TUI, theme: Theme, getArtwork: () => Artwork): Component & { dispose?: () => void; setExpanded?: (expanded: boolean) => void } {
  const document = tui.children[0];
  if (!(document instanceof Container)) return findNativeHeader(tui.children);
  const [header, resources, chat] = document.children;
  if (!(header instanceof Container) || !(resources instanceof Container) || !(chat instanceof Container)) {
    return findNativeHeader(tui.children);
  }
  const native = header.children.find(isExpandable);
  if (!native) {
    return header.children.find(child => child.render(80).length > 0) ?? findNativeHeader(tui.children);
  }
  if (!readNativeVersion(native.render(100))) return native;

  const decorated = decorateNativeHeader(native, theme);
  const layout = new StartupLayout(header, resources, theme, getArtwork);
  document.children.splice(0, 2, layout);
  return {
    render: width => decorated.render(width),
    invalidate: () => decorated.invalidate(),
    setExpanded: expanded => decorated.setExpanded(expanded),
    dispose: () => {
      const index = document.children.indexOf(layout);
      if (index >= 0) document.children.splice(index, 1, header, resources);
    },
  };
}

function findNativeHeader(components: Component[]): Component {
  for (const component of components) {
    if (component instanceof Container) {
      const nested = findNativeHeader(component.children);
      if (readNativeVersion(nested.render(100))) return nested;
    } else if (readNativeVersion(component.render(100))) {
      return component;
    }
  }
  return { render: () => [], invalidate: () => {} };
}
