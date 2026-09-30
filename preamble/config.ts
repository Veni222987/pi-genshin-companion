import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHARACTERS_DIR = fileURLToPath(new URL("../characters/", import.meta.url));
const CHARACTER_ID = /^[a-z][a-z0-9-]*$/;

export interface PreambleResource {
  path: string;
  preamble?: string;
  error?: string;
}

// loadCharacterPreamble 从角色目录读取可直接注入的静态角色文本。
export function loadCharacterPreamble(characterId: string, directory = CHARACTERS_DIR): PreambleResource {
  if (!CHARACTER_ID.test(characterId)) return { path: directory, error: "角色 ID 无效" };
  const file = path.join(directory, characterId, "PREAMBLE.md");
  try {
    const preamble = readFileSync(file, "utf8").trim();
    return preamble ? { path: file, preamble } : { path: file, error: "角色文本为空" };
  } catch (error) {
    return { path: file, error: error instanceof Error ? error.message : String(error) };
  }
}
