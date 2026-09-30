import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { BuildSystemPromptOptions } from "@earendil-works/pi-coding-agent";

// hasFullSystemPromptOverride 判断当前请求是否启用完整系统提示词覆盖。
export function hasFullSystemPromptOverride(
  options: Pick<BuildSystemPromptOptions, "customPrompt" | "forceSystemPrompt">,
): boolean {
  return Boolean(options.customPrompt) || options.forceSystemPrompt !== undefined;
}

// replacePreambleInMessages 仅更新已有结构化系统消息中的角色区块。
export function replacePreambleInMessages(messages: AgentMessage[], preamble: string): AgentMessage[] {
  let changed = false;
  const updated = messages.map(message => {
    if (message.role !== "system" || typeof message.sections?.preamble !== "string" || message.sections.preamble === preamble) {
      return message;
    }
    changed = true;
    return { ...message, sections: { ...message.sections, preamble } };
  });
  return changed ? updated : messages;
}
