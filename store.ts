import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { Selection } from "./catalog/types.ts";

export interface SavedChoice {
  characterId?: string;
  artworkByCharacter: Record<string, string>;
  preambleEnabled: boolean;
}

function emptyChoice(): SavedChoice {
  return { artworkByCharacter: {}, preambleEnabled: false };
}

// choicePath 定位 Pi 用户目录中的同伴选择文件。
export function choicePath(): string {
  return path.join(getAgentDir(), "genshin-companion.json");
}

// loadChoice 从用户目录读取跨项目生效的同伴选择。
export function loadChoice(file = choicePath()): SavedChoice {
  try {
    const data: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (typeof data !== "object" || !data || Array.isArray(data)) return emptyChoice();
    const choice = data as Record<string, unknown>;
    const map = choice.artworkByCharacter;
    if (typeof map !== "object" || !map || Array.isArray(map)) return emptyChoice();
    return {
      characterId: typeof choice.characterId === "string" ? choice.characterId : undefined,
      artworkByCharacter: Object.fromEntries(Object.entries(map).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
      preambleEnabled: choice.preambleEnabled === true,
    };
  } catch { return emptyChoice(); }
}

// saveChoice 以原子替换保存当前角色及每个角色的最近画作。
export function saveChoice(selection: Selection, previous: SavedChoice, file = choicePath()): SavedChoice {
  const next: SavedChoice = { characterId: selection.characterId, preambleEnabled: previous.preambleEnabled,
    artworkByCharacter: { ...previous.artworkByCharacter, [selection.characterId]: selection.artworkId } };
  writeChoice(next, file);
  return next;
}

// savePreambleEnabled 保存全局人格开关，同时保留当前角色和各角色画作。
export function savePreambleEnabled(enabled: boolean, previous: SavedChoice, file = choicePath()): SavedChoice {
  const next: SavedChoice = { ...previous, preambleEnabled: enabled };
  writeChoice(next, file);
  return next;
}

function writeChoice(next: SavedChoice, file: string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, JSON.stringify(next, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
    renameSync(temp, file);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
}
