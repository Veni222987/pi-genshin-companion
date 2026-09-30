import type { ExtensionAPI, ExtensionContext, NormalizedBuildSystemPromptOptions } from "@earendil-works/pi-coding-agent";
import type { Character } from "../catalog/types.ts";
import { choicePath, savePreambleEnabled, type SavedChoice } from "../store.ts";
import { loadCharacterPreamble } from "./config.ts";
import { hasFullSystemPromptOverride, replacePreambleInMessages } from "./prompt.ts";

interface SessionPreamble {
  enabled: boolean;
  characterId: string;
  characterName: string;
  preamble?: string;
  error?: string;
  path?: string;
}

function notify(ctx: ExtensionContext, message: string, level: "info" | "warning"): void {
  if (ctx.hasUI) ctx.ui.notify(message, level);
  else process.stderr.write(`[genshin-companion] ${message}\n`);
}

// registerPreamble 注册全局人格开关及会话内的 PREAMBLE 区块替换。
export function registerPreamble(
  pi: ExtensionAPI,
  getCharacter: () => Character,
  getSaved: () => SavedChoice,
  setSaved: (saved: SavedChoice) => void,
): () => boolean {
  const snapshot = (): SessionPreamble => {
    const { id: characterId, name: characterName } = getCharacter();
    const enabled = getSaved().preambleEnabled;
    const resource = enabled ? loadCharacterPreamble(characterId) : undefined;
    return { enabled, characterId, characterName, ...resource };
  };
  let active = snapshot();
  let runOptions: NormalizedBuildSystemPromptOptions | undefined;
  const reported = new Set<string>();

  pi.on("session_start", () => {
    active = snapshot();
    runOptions = undefined;
    reported.clear();
  });

  const reportOnce = (ctx: ExtensionContext, key: string, message: string): void => {
    if (reported.has(key)) return;
    reported.add(key);
    notify(ctx, message, "warning");
  };

  pi.on("before_agent_start", (event, ctx) => {
    runOptions = event.systemPromptOptions;
    if (active.enabled && active.error) {
      reportOnce(ctx, "resource", `${active.characterName} 的人格资源 ${active.path} 读取异常：${active.error}；本会话保持现有系统角色文本。`);
    }
  });

  pi.on("context_with_system", (event, ctx) => {
    if (!active.enabled || !active.preamble) return;
    if (runOptions && hasFullSystemPromptOverride(runOptions)) {
      reportOnce(ctx, "override", "当前请求使用完整系统提示词覆盖；本轮保留该系统提示词。");
      return;
    }
    const messages = replacePreambleInMessages(event.messages, active.preamble);
    if (messages !== event.messages) return { messages };
  });

  pi.registerCommand("genshin-preamble", {
    description: "查看或设置角色人格注入，参数为 true/false（重载或新会话生效）",
    handler: async (args, ctx) => {
      const value = args.trim();
      if (value === "") {
        const current = active.enabled
          ? `${active.characterName}（${active.error ? "资源异常，保持现有系统角色文本" : "人格已加载"}）`
          : "关闭";
        notify(ctx, `已保存：${getSaved().preambleEnabled ? "开启" : "关闭"}；本会话：${current}。用法：/genshin-preamble true/false`, "info");
        return;
      }
      if (value !== "true" && value !== "false") {
        notify(ctx, "用法：/genshin-preamble true/false", "warning");
        return;
      }
      try {
        setSaved(savePreambleEnabled(value === "true", getSaved()));
        notify(ctx, `人格注入已保存为${value === "true" ? "开启" : "关闭"}；执行 /reload 或开启新会话后生效。`, "info");
      } catch (error) {
        notify(ctx, `保存 ${choicePath()} 失败：${String(error)}`, "warning");
      }
    },
  });

  return () => active.enabled;
}
