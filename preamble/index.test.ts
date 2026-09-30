import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Character } from "../catalog/types.ts";
import type { SavedChoice } from "../store.ts";
import { loadCharacterPreamble } from "./config.ts";
import { registerPreamble } from "./index.ts";
import { replacePreambleInMessages } from "./prompt.ts";
import { savePreambleEnabled } from "../store.ts";

vi.mock("./config.ts", () => ({ loadCharacterPreamble: vi.fn(id => ({ path: `${id}/PREAMBLE.md`, preamble: `${id} 人格` })) }));
vi.mock("../store.ts", () => ({
  choicePath: () => "/temporary/genshin-companion.json",
  savePreambleEnabled: vi.fn((enabled, previous) => ({ ...previous, preambleEnabled: enabled })),
}));
afterEach(() => vi.clearAllMocks());

type EventHandler = (event: any, ctx: ExtensionContext) => any;

function setup(enabled = false) {
  const events = new Map<string, EventHandler[]>();
  const commands = new Map<string, (args: string, ctx: ExtensionContext) => Promise<void>>();
  const api = {
    on: (name: string, handler: EventHandler) => {
      events.set(name, [...events.get(name) ?? [], handler]);
      return () => {};
    },
    registerCommand: (name: string, options: { handler: (args: string, ctx: ExtensionContext) => Promise<void> }) => commands.set(name, options.handler),
  } as unknown as ExtensionAPI;
  const notify = vi.fn();
  const ctx = { hasUI: true, ui: { notify } } as unknown as ExtensionContext;
  let saved: SavedChoice = { characterId: "vesna", artworkByCharacter: { vesna: "front-blush" }, preambleEnabled: enabled };
  let selected = "vesna";
  const active = registerPreamble(api, () => ({ id: selected, name: selected } as Character), () => saved, value => { saved = value; });
  const emit = (name: string, event: object = {}) => {
    for (const handler of events.get(name) ?? []) handler(event, ctx);
  };
  const prompt = (messages: AgentMessage[], options: object = {}) => {
    emit("before_agent_start", { systemPromptOptions: options });
    let current = messages;
    for (const handler of events.get("context_with_system") ?? []) {
      current = handler({ messages: current }, ctx)?.messages ?? current;
    }
    return current;
  };
  const command = (args: string) => commands.get("genshin-preamble")!(args, ctx);
  const messages = (): AgentMessage[] => [{ role: "system", content: "", sections: { preamble: "默认", skills: "Skills" }, timestamp: 0 }];
  return { api, active, emit, command, prompt, messages, notify, get saved() { return saved; }, select: (id: string) => { selected = id; } };
}

describe("人格开关与会话快照", () => {
  it("默认关闭；开启后等待重载，关闭后当前会话继续注入", async () => {
    const test = setup();
    const original = test.messages();
    expect(test.prompt(original)).toBe(original);
    expect(loadCharacterPreamble).not.toHaveBeenCalled();
    await test.command("true");
    expect(test.saved.preambleEnabled).toBe(true);
    expect(test.active()).toBe(false);
    expect(test.prompt(original)).toBe(original);
    test.emit("session_start", { reason: "reload" });
    expect(test.active()).toBe(true);
    expect(test.prompt(original)[0]).toMatchObject({ sections: { preamble: "vesna 人格", skills: "Skills" } });
    await test.command("false");
    expect(test.saved.preambleEnabled).toBe(false);
    expect(test.prompt(original)[0]).toMatchObject({ sections: { preamble: "vesna 人格" } });
    test.emit("session_start", { reason: "new" });
    expect(test.prompt(original)).toBe(original);
    expect(test.notify).toHaveBeenCalledWith(expect.stringContaining("/reload"), "info");
  });

  it("角色选择在下一会话更新人格，画作切换沿用人格，重复加载刷新资源", async () => {
    const test = setup(true);
    const messages = test.messages();
    expect(test.prompt(messages)[0]).toMatchObject({ sections: { preamble: "vesna 人格" } });
    test.select("example");
    expect(test.prompt(messages)[0]).toMatchObject({ sections: { preamble: "vesna 人格" } });
    test.emit("session_start", { reason: "new" });
    expect(test.prompt(messages)[0]).toMatchObject({ sections: { preamble: "example 人格" } });
    vi.mocked(loadCharacterPreamble).mockReturnValueOnce({ path: "example/PREAMBLE.md", preamble: "资源新版本" });
    test.emit("session_start", { reason: "reload" });
    expect(test.prompt(messages)[0]).toMatchObject({ sections: { preamble: "资源新版本" } });
    expect(test.saved.artworkByCharacter).toEqual({ vesna: "front-blush" });
    await test.command("");
    expect(test.notify).toHaveBeenCalledWith(expect.stringContaining("本会话：example"), "info");
  });

  it("已有系统人格按会话开关处理，完整覆盖优先", () => {
    const test = setup(true);
    const messages = test.messages();
    const existingMessages = replacePreambleInMessages(messages, "已有系统人格");
    expect(test.prompt(existingMessages)[0]).toMatchObject({ sections: { preamble: "vesna 人格" } });
    expect(test.prompt(existingMessages, { customPrompt: "完整覆盖" })).toBe(existingMessages);
    expect(test.prompt(existingMessages, { forceSystemPrompt: "强制覆盖" })).toBe(existingMessages);
    expect(test.notify).toHaveBeenCalledTimes(1);
    expect(test.prompt(existingMessages, { forceSystemPrompt: "" })).toBe(existingMessages);
    const disabled = setup(false);
    expect(disabled.prompt(existingMessages)).toBe(existingMessages);
  });

  it("缺失人格报告一次并保留已有 PREAMBLE；无效参数和写入失败保留状态", async () => {
    vi.mocked(loadCharacterPreamble).mockReturnValueOnce({ path: "vesna/PREAMBLE.md", error: "ENOENT" });
    const test = setup(true);
    const messages = test.messages();
    expect(test.prompt(messages)).toBe(messages);
    expect(test.prompt(messages)).toBe(messages);
    expect(test.notify).toHaveBeenCalledTimes(1);
    await test.command("maybe");
    expect(savePreambleEnabled).not.toHaveBeenCalled();
    vi.mocked(savePreambleEnabled).mockImplementationOnce(() => { throw new Error("denied"); });
    await test.command("false");
    expect(test.saved.preambleEnabled).toBe(true);
    expect(test.notify).toHaveBeenCalledWith(expect.stringContaining("保存"), "warning");
  });
});
