import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SPRITE_PALETTE, SPRITE_PIXELS } from "../startup/sprite.ts";
import { isElement } from "./elements.ts";
import type { Artwork, Catalog, Character, Quote, Selection } from "./types.ts";

const DEFAULT_DIR = fileURLToPath(new URL("../characters/", import.meta.url));
const ID = /^[a-z][a-z0-9-]*$/;
const ART_FILE = /^[a-z][a-z0-9-]*\.json$/;

const fallback: Character = {
  id: "vesna", name: "薇斯纳", englishName: "Vesna", element: "anemo", defaultArtwork: "front-blush",
  artworks: [{ id: "front-blush", name: "正脸腮红版", width: 40, height: 40, palette: SPRITE_PALETTE, pixels: [...SPRITE_PIXELS] }],
  quotes: [],
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseArtwork(value: unknown): Artwork {
  if (!record(value) || !ID.test(String(value.id)) || typeof value.name !== "string" ||
    !Number.isInteger(value.width) || !Number.isInteger(value.height) ||
    value.width !== 40 || value.height !== 40 || !record(value.palette) || !Array.isArray(value.pixels)) {
    throw new Error("画作字段或画布尺寸无效（要求 40×40）");
  }
  const palette: Artwork["palette"] = {};
  for (const [key, color] of Object.entries(value.palette)) {
    if (key.length !== 1 || key === "." || !Array.isArray(color) || color.length !== 3 ||
      !color.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) throw new Error("调色板颜色无效");
    palette[key] = color as [number, number, number];
  }
  if (value.pixels.length !== 40 || !value.pixels.every(row => typeof row === "string" && row.length === 40 &&
    [...row].every(pixel => pixel === "." || pixel in palette))) throw new Error("像素行宽或颜色映射无效");
  return { id: value.id as string, name: value.name, width: 40, height: 40, palette, pixels: value.pixels as string[] };
}

function parseCharacter(value: unknown, directory: string): Character {
  if (!record(value) || value.version !== 1 || !ID.test(String(value.id)) || value.id !== path.basename(directory) ||
    typeof value.name !== "string" || !value.name.trim() || typeof value.englishName !== "string" || !value.englishName.trim() ||
    !isElement(value.element) || typeof value.defaultArtwork !== "string" || !Array.isArray(value.artworks) || value.artworks.length === 0 ||
    !Array.isArray(value.quotes)) throw new Error("角色字段或版本无效");
  const artworks = value.artworks.map(file => {
    if (typeof file !== "string" || !ART_FILE.test(file)) throw new Error("画作文件名无效");
    const art = parseArtwork(JSON.parse(readFileSync(path.join(directory, file), "utf8")) as unknown);
    if (art.id !== file.slice(0, -5)) throw new Error("画作 ID 与文件名不一致");
    return art;
  });
  if (new Set(artworks.map(art => art.id)).size !== artworks.length ||
    !artworks.some(art => art.id === value.defaultArtwork)) throw new Error("默认画作或画作 ID 无效");
  const quotes: Quote[] = value.quotes.map(item => {
    if (!record(item) || typeof item.category !== "string" || !item.category.trim() ||
      typeof item.text !== "string" || !item.text.trim() || /[\r\n]/u.test(item.text)) throw new Error("语录字段无效");
    return { category: item.category, text: item.text };
  });
  return { id: value.id as string, name: value.name as string, englishName: value.englishName as string,
    element: value.element, defaultArtwork: value.defaultArtwork, artworks, quotes };
}

// loadCatalog 扫描包内角色目录，报告异常素材并提供薇斯纳默认画作作为安全起点。
export function loadCatalog(directory = DEFAULT_DIR): Catalog {
  const characters: Character[] = [];
  const warnings: string[] = [];
  let entries: string[] = [];
  try { entries = readdirSync(directory).sort(); } catch (error) { warnings.push(`读取角色目录失败：${String(error)}`); }
  for (const id of entries.filter(ID.test.bind(ID))) {
    try {
      characters.push(parseCharacter(JSON.parse(readFileSync(path.join(directory, id, "character.json"), "utf8")) as unknown, path.join(directory, id)));
    } catch (error) { warnings.push(`角色 ${id} 加载失败：${String(error)}`); }
  }
  if (!characters.some(character => character.id === "vesna")) characters.unshift(fallback);
  return { characters, warnings };
}

// resolveSelection 将已保存的选择定位到当前配置中的角色和画作。
export function resolveSelection(characters: Character[], selection?: Partial<Selection>): Selection {
  const character = characters.find(item => item.id === selection?.characterId) ?? characters.find(item => item.id === "vesna") ?? characters[0]!;
  const artwork = character.artworks.find(item => item.id === selection?.artworkId) ?? character.artworks.find(item => item.id === character.defaultArtwork) ?? character.artworks[0]!;
  return { characterId: character.id, artworkId: artwork.id };
}
