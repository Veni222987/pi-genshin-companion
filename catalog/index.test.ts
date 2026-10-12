import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ELEMENT_COLORS, isElement } from "./elements.ts";
import { loadCatalog, resolveSelection } from "./index.ts";

const temporary: string[] = [];
afterEach(() => { for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function catalogDirectory(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "companion-catalog-"));
  temporary.push(dir);
  return dir;
}

function installCharacter(dir: string, id: string): void {
  const source = path.join(import.meta.dirname, "../characters/vesna");
  const target = path.join(dir, id);
  mkdirSync(target);
  for (const artwork of ["tilted", "front-blush"]) {
    const data = JSON.parse(readFileSync(path.join(source, `${artwork}.json`), "utf8")) as Record<string, unknown>;
    writeFileSync(path.join(target, `${artwork}.json`), JSON.stringify(data));
  }
  const data = JSON.parse(readFileSync(path.join(source, "character.json"), "utf8")) as Record<string, unknown>;
  data.id = id;
  data.englishName = id === "example" ? "Example" : "Vesna";
  writeFileSync(path.join(target, "character.json"), JSON.stringify(data));
}

describe("角色目录与画作配置", () => {
  it("内置角色加载透明 40×40 画作和配置化语录", () => {
    const { characters, warnings } = loadCatalog();
    expect(warnings).toEqual([]);
    const vesna = characters.find(c => c.id === "vesna")!;
    expect(vesna.englishName).toBe("Vesna");
    expect(vesna.element).toBe("anemo");
    expect(vesna.defaultArtwork).toBe("front-blush");
    expect(vesna.artworks.map(art => art.id)).toEqual(["tilted", "front-blush"]);
    expect(vesna.artworks.every(art => art.pixels.length === 40 && art.pixels.every(row => row.length === 40))).toBe(true);
    expect(vesna.artworks.every(art => art.pixels[0]?.includes("."))).toBe(true);
    expect(vesna.quotes.length).toBeGreaterThan(30);
    expect(resolveSelection(characters, { characterId: "vesna", artworkId: "tilted" }).artworkId).toBe("tilted");
    expect(resolveSelection(characters, { characterId: "gone", artworkId: "gone" }).artworkId).toBe("front-blush");

    const keqing = characters.find(c => c.id === "keqing")!;
    expect(keqing.name).toBe("刻晴");
    expect(keqing.englishName).toBe("Keqing");
    expect(keqing.element).toBe("electro");
    expect(ELEMENT_COLORS[keqing.element]).toEqual(ELEMENT_COLORS.electro);
    expect(keqing.defaultArtwork).toBe("front");
    expect(keqing.artworks.map(art => art.id)).toEqual(["front"]);
    expect(keqing.artworks[0]?.pixels).toHaveLength(40);
    expect(keqing.artworks[0]?.pixels.every(row => row.length === 40)).toBe(true);
    expect(keqing.artworks[0]?.pixels[0]).toContain(".");
    expect(keqing.quotes).toHaveLength(83);
    expect(resolveSelection(characters, { characterId: "keqing", artworkId: "front" })).toEqual({ characterId: "keqing", artworkId: "front" });
  });

  it("自动发现第二角色，按配置读取多张画作", () => {
    const dir = catalogDirectory();
    installCharacter(dir, "vesna");
    installCharacter(dir, "example");
    const result = loadCatalog(dir);
    expect(result.warnings).toEqual([]);
    expect(result.characters.map(c => c.id)).toEqual(["example", "vesna"]);
    expect(resolveSelection(result.characters, { characterId: "example", artworkId: "tilted" })).toEqual({ characterId: "example", artworkId: "tilted" });
  });

  it("七元素颜色集中映射，角色元素随配置读取", () => {
    const ids = ["pyro", "hydro", "anemo", "electro", "dendro", "cryo", "geo"];
    expect(Object.keys(ELEMENT_COLORS)).toEqual(ids);
    for (const id of ids) expect(isElement(id)).toBe(true);
    expect(isElement("unknown")).toBe(false);
    expect(isElement("toString")).toBe(false);
    const dir = catalogDirectory();
    installCharacter(dir, "example");
    const file = path.join(dir, "example/character.json");
    const value = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    value.element = "electro";
    writeFileSync(file, JSON.stringify(value));
    expect(loadCatalog(dir).characters.find(c => c.id === "example")?.element).toBe("electro");
  });

  it("不合规像素行、缺失素材及格式版本返回警告与薇斯纳默认画作", () => {
    for (const change of ["pixels", "file", "version", "palette", "element", "missing-element"]) {
      const dir = catalogDirectory();
      installCharacter(dir, "vesna");
      const artFile = path.join(dir, "vesna/front-blush.json");
      const art = JSON.parse(readFileSync(artFile, "utf8")) as Record<string, unknown>;
      const configFile = path.join(dir, "vesna/character.json");
      const config = JSON.parse(readFileSync(configFile, "utf8")) as Record<string, unknown>;
      if (change === "pixels") art.pixels = ["."];
      if (change === "palette") art.palette = { z: [256, 0, 0] };
      if (change === "file") config.artworks = ["../secret.json"];
      if (change === "version") config.version = 2;
      if (change === "element") config.element = "unknown";
      if (change === "missing-element") delete config.element;
      writeFileSync(artFile, JSON.stringify(art));
      writeFileSync(configFile, JSON.stringify(config));
      const loaded = loadCatalog(dir);
      expect(loaded.warnings[0]).toContain("角色 vesna 加载失败");
      expect(loaded.characters[0]?.artworks[0]?.id).toBe("front-blush");
      expect(loaded.characters[0]?.element).toBe("anemo");
    }
  });

  it("空目录、不可访问目录和异常语录安全回退", () => {
    const dir = catalogDirectory();
    expect(loadCatalog(path.join(dir, "missing")).warnings).toHaveLength(1);
    expect(loadCatalog(dir).characters[0]?.id).toBe("vesna");
    installCharacter(dir, "example");
    const file = path.join(dir, "example/character.json");
    const value = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    value.quotes = [{ category: "问候", text: "多行\n语录" }];
    writeFileSync(file, JSON.stringify(value));
    const result = loadCatalog(dir);
    expect(result.warnings).toHaveLength(1);
    expect(result.characters).toHaveLength(1);
  });
});
