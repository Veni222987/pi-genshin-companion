import { Key, decodeKittyPrintable, isKeyRelease, matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { renderSprite } from "../startup/render.ts";
import type { Artwork, Character, Selection } from "../catalog/types.ts";
import type { SavedChoice } from "../store.ts";
import type { Theme } from "@earendil-works/pi-coding-agent";

// searchCharacters 按英文名进行忽略大小写的子串匹配。
export function searchCharacters(characters: Character[], input: string): Character[] {
  const query = input.trim().toLowerCase();
  return characters.filter(character => character.englishName.toLowerCase().includes(query));
}

// CompanionPicker 呈现搜索角色、画作预览及确认操作。
export class CompanionPicker {
  private search = "";
  private selected = 0;
  private readonly artworkByCharacter: Record<string, string>;

  constructor(
    private readonly characters: Character[],
    current: Selection,
    saved: SavedChoice,
    private readonly theme: Theme,
    private readonly done: (selection: Selection | undefined) => void,
    private readonly maxHeight = 27,
  ) {
    this.artworkByCharacter = { ...saved.artworkByCharacter, [current.characterId]: current.artworkId };
    this.selected = Math.max(0, characters.findIndex(item => item.id === current.characterId));
  }

  get filtered(): Character[] { return searchCharacters(this.characters, this.search); }
  get character(): Character | undefined { return this.filtered[this.selected]; }
  get artwork(): Artwork | undefined {
    const character = this.character;
    return character?.artworks.find(art => art.id === this.artworkByCharacter[character.id]) ??
      character?.artworks.find(art => art.id === character.defaultArtwork);
  }

  handleInput(data: string): void {
    if (isKeyRelease(data)) return;
    if (matchesKey(data, Key.escape)) { this.done(undefined); return; }
    if (matchesKey(data, Key.enter)) {
      if (this.character && this.artwork) this.done({ characterId: this.character.id, artworkId: this.artwork.id });
      return;
    }
    if (matchesKey(data, Key.up)) this.selected = Math.max(0, this.selected - 1);
    else if (matchesKey(data, Key.down)) this.selected = Math.min(this.filtered.length - 1, this.selected + 1);
    else if (matchesKey(data, Key.left) || matchesKey(data, Key.right)) {
      const character = this.character;
      const artwork = this.artwork;
      if (!character || !artwork) return;
      const shift = matchesKey(data, Key.left) ? -1 : 1;
      const next = (character.artworks.findIndex(item => item.id === artwork.id) + shift + character.artworks.length) % character.artworks.length;
      this.artworkByCharacter[character.id] = character.artworks[next]!.id;
    } else if (matchesKey(data, Key.backspace) || matchesKey(data, Key.delete)) {
      this.search = this.search.slice(0, -1);
      this.selected = 0;
    } else {
      const printable = decodeKittyPrintable(data) ?? (/^[a-zA-Z]$/u.test(data) ? data : undefined);
      if (printable && /^[a-zA-Z]$/u.test(printable)) { this.search += printable; this.selected = 0; }
    }
  }

  render(width: number): string[] {
    const w = Math.min(86, Math.max(0, width));
    if (w < 8) return [truncateToWidth("选择同伴", w)];
    const interior = w - 4;
    const line = (content: string) => `│ ${truncateToWidth(content, interior, "…", true)} │`;
    const divider = `├${"─".repeat(w - 2)}┤`;
    const side = w >= 72;
    const maxRows = side ? Math.max(2, this.maxHeight - 7) : 3;
    const artWidth = side ? 40 : Math.min(interior, 40, Math.max(2, (this.maxHeight - 11) * 2));
    const preview = this.artwork ? renderSprite(this.artwork, artWidth, this.theme.getColorMode()) : [];
    const visible = this.filtered;
    const begin = Math.max(0, Math.min(this.selected - Math.floor(maxRows / 2), visible.length - maxRows));
    const choices = visible.slice(begin, begin + maxRows).map((item, index) =>
      `${index + begin === this.selected ? "›" : " "} ${item.name} ${item.englishName}`);
    if (choices.length === 0) choices.push("  无匹配角色");
    const lines = [
      `┌${"─".repeat(w - 2)}┐`, line("选择同伴 · Genshin Companion"),
      line(`搜索英文名：${this.search}▏`), divider,
    ];
    if (side) {
      const left = interior - 43;
      const body = Math.max(choices.length, Math.min(preview.length, maxRows));
      for (let i = 0; i < body; i++) {
        const pic = preview[i] ?? "";
        lines.push(line(`${truncateToWidth(choices[i] ?? "", left, "…", true)} │ ${pic}${" ".repeat(Math.max(0, 40 - visibleWidth(pic)))}`));
      }
    } else {
      lines.push(...choices.map(line));
      lines.push(divider);
      lines.push(...preview.map(row => line(row)));
    }
    const artwork = this.artwork;
    const character = this.character;
    if (side) {
      lines.push(divider, line(character && artwork
        ? `${artwork.name} ${character.artworks.indexOf(artwork) + 1}/${character.artworks.length} · ↑↓ 角色  ←→ 画作  Enter 应用  Esc 关闭`
        : "暂无画作 · Esc 关闭"), `└${"─".repeat(w - 2)}┘`);
    } else {
      lines.push(divider, line(character && artwork ? `${artwork.name}  ${character.artworks.indexOf(artwork) + 1} / ${character.artworks.length}` : "暂无画作"),
        line("↑↓ 角色  ←→ 画作  Enter 应用  Esc 关闭"), `└${"─".repeat(w - 2)}┘`);
    }
    return lines;
  }

  invalidate(): void {}
}
