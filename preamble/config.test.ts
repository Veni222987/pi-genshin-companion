import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadCharacterPreamble } from "./config.ts";

const directories: string[] = [];
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { force: true, recursive: true }); });

function fixture(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "genshin-persona-"));
  directories.push(dir);
  mkdirSync(path.join(dir, "example"));
  return dir;
}

describe("角色人格资源", () => {
  it("按角色 ID 加载独立文件，读取新的内容", () => {
    const dir = fixture();
    const file = path.join(dir, "example", "PREAMBLE.md");
    writeFileSync(file, " 你是新朋友。 \n");
    expect(loadCharacterPreamble("example", dir)).toEqual({ path: file, preamble: "你是新朋友。" });
    writeFileSync(file, "你是同行的朋友。");
    expect(loadCharacterPreamble("example", dir).preamble).toBe("你是同行的朋友。");
    expect(loadCharacterPreamble("vesna", dir).error).toBeDefined();
  });

  it("内置角色人格具备完整角色章节和实际内容", () => {
    for (const [id, name] of [["vesna", "薇斯纳"], ["keqing", "刻晴"]] as const) {
      const resource = loadCharacterPreamble(id);
      expect(resource.error).toBeUndefined();
      for (const title of ["身份与自我认知", "人格内核", "与用户的关系", "语言与表达节奏", "情绪与场景反应", "经历与生活细节", "与用户共事", "对话示例"]) {
        expect(resource.preamble).toContain(`## ${title}`);
      }
      expect(resource.preamble).toContain(name);
    }
  });

  it("缺失、空白、读取错误与非法角色 ID 均安全降级", () => {
    const dir = fixture();
    const file = path.join(dir, "example", "PREAMBLE.md");
    expect(loadCharacterPreamble("example", dir)).toMatchObject({ path: file, error: expect.any(String) });
    writeFileSync(file, " \n\t ");
    expect(loadCharacterPreamble("example", dir)).toEqual({ path: file, error: "角色文本为空" });
    rmSync(file);
    mkdirSync(file);
    expect(loadCharacterPreamble("example", dir).error).toBeDefined();
    expect(loadCharacterPreamble("../outside", dir)).toEqual({ path: dir, error: "角色 ID 无效" });
  });
});
