import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { SystemMessage, Tool } from "@earendil-works/pi-ai";
import { getCurrentSystemMessage, getCurrentSystemPrompt, getCurrentTools } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { hasFullSystemPromptOverride, replacePreambleInMessages } from "./prompt.ts";

function tool(name: string): Tool {
  return { name, description: name, parameters: { type: "object", properties: {} } } as Tool;
}

function system(overrides: Partial<SystemMessage> = {}): SystemMessage {
  return {
    role: "system", content: "", timestamp: 0,
    sections: { preamble: "原角色", tools: "工具", rules: "规则", skills: "Skills", project_context: "项目", cwd: "目录" },
    toolsAdded: [tool("read"), tool("write")], ...overrides,
  };
}

describe("系统角色区块", () => {
  it("只更新 PREAMBLE，保留动态工具、Skill、项目上下文和原始消息", () => {
    const messages: AgentMessage[] = [
      system(),
      { role: "user", content: "你好", timestamp: 1 },
      system({ timestamp: 2, sections: { tools: "工具增量", rules: "新的规则" }, toolsAdded: [tool("web_search")], toolsRemoved: [{ name: "write" }] }),
    ];
    const copy = structuredClone(messages);
    const changed = replacePreambleInMessages(messages, "薇斯纳");
    expect(messages).toEqual(copy);
    expect(getCurrentSystemMessage(changed)).toEqual({ ...getCurrentSystemMessage(messages), sections: { ...getCurrentSystemMessage(messages)?.sections, preamble: "薇斯纳" } });
    expect(getCurrentTools(changed)).toEqual(getCurrentTools(messages));
    expect(getCurrentSystemPrompt(changed)).toContain("规则");
    expect(getCurrentSystemPrompt(changed)).toContain("Skills");
    expect(changed[1]).toBe(messages[1]);
    expect(changed[2]).toBe(messages[2]);
  });

  it("每个已有角色区块均替换，覆盖后续系统消息和压缩检查点；重复处理幂等", () => {
    const messages: AgentMessage[] = [
      system(),
      system({ timestamp: 2, sections: { preamble: "后续角色", skills: "后续技能" } }),
    ];
    const updated = replacePreambleInMessages(messages, "薇斯纳");
    expect(updated.map(message => message.role === "system" && message.sections?.preamble)).toEqual(["薇斯纳", "薇斯纳"]);
    expect(replacePreambleInMessages(updated, "薇斯纳")).toBe(updated);
    const checkpoint: AgentMessage[] = [system({ sections: { preamble: "压缩前人格", project_context: "项目" } })];
    expect(replacePreambleInMessages(checkpoint, "薇斯纳")[0]).toMatchObject({ sections: { preamble: "薇斯纳", project_context: "项目" } });
  });

  it("结构化区块缺失时维持消息，完整系统提示词覆盖时可识别", () => {
    const messages: AgentMessage[] = [system({ sections: { rules: "规则" } })];
    expect(replacePreambleInMessages(messages, "薇斯纳")).toBe(messages);
    expect(hasFullSystemPromptOverride({})).toBe(false);
    expect(hasFullSystemPromptOverride({ customPrompt: "SYSTEM.md" })).toBe(true);
    expect(hasFullSystemPromptOverride({ forceSystemPrompt: "扩展覆盖" })).toBe(true);
    expect(hasFullSystemPromptOverride({ forceSystemPrompt: "" })).toBe(true);
  });
});
