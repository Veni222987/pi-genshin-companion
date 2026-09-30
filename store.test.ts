import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadChoice, saveChoice, savePreambleEnabled } from "./store.ts";

const paths: string[] = [];
afterEach(() => { for (const dir of paths.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("全局同伴选择", () => {
  it("原子保存角色与每个角色的画作并可跨实例读取", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "companion-choice-"));
    paths.push(dir);
    const file = path.join(dir, "nested", "genshin-companion.json");
    expect(loadChoice(file)).toEqual({ artworkByCharacter: {}, preambleEnabled: false });
    const first = saveChoice({ characterId: "vesna", artworkId: "tilted" }, loadChoice(file), file);
    const enabled = savePreambleEnabled(true, first, file);
    saveChoice({ characterId: "example", artworkId: "winter" }, enabled, file);
    expect(loadChoice(file)).toEqual({ characterId: "example", artworkByCharacter: { vesna: "tilted", example: "winter" }, preambleEnabled: true });
    expect(readdirSync(path.dirname(file))).toEqual(["genshin-companion.json"]);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(loadChoice(file));
  });

  it("损坏文件降级为空选择，写入失败时原文件保持原状", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "companion-choice-"));
    paths.push(dir);
    const file = path.join(dir, "choice.json");
    writeFileSync(file, "invalid");
    expect(loadChoice(file)).toEqual({ artworkByCharacter: {}, preambleEnabled: false });
    writeFileSync(file, '{"artworkByCharacter":{}}');
    const original = readFileSync(file, "utf8");
    expect(() => saveChoice({ characterId: "vesna", artworkId: "tilted" }, loadChoice(file), dir)).toThrow();
    expect(readFileSync(file, "utf8")).toBe(original);
    expect(() => savePreambleEnabled(true, loadChoice(file), dir)).toThrow();
    expect(readFileSync(file, "utf8")).toBe(original);
  });

  it("仅布尔 true 启用人格，旧配置按关闭读取", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "companion-choice-"));
    paths.push(dir);
    const file = path.join(dir, "choice.json");
    for (const raw of ['{"artworkByCharacter":{},"preambleEnabled":"true"}', '{"artworkByCharacter":{},"preambleEnabled":1}', '{"artworkByCharacter":{}}']) {
      writeFileSync(file, raw);
      expect(loadChoice(file).preambleEnabled).toBe(false);
    }
    writeFileSync(file, '{"artworkByCharacter":{},"preambleEnabled":true}');
    expect(savePreambleEnabled(false, loadChoice(file), file).preambleEnabled).toBe(false);
  });
});
