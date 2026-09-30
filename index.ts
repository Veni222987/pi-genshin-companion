import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Artwork, Character, Selection } from "./catalog/types.ts";
import { loadCatalog, resolveSelection } from "./catalog/index.ts";
import { CompanionPicker } from "./picker/index.ts";
import { registerPreamble } from "./preamble/index.ts";
import { registerQuotes } from "./quotes/index.ts";
import { choicePath, loadChoice, saveChoice } from "./store.ts";
import { registerStartupBanner } from "./startup/index.ts";

// registerCompanion 注册启动页、同伴选择、语录条与角色人格。
export default function registerCompanion(pi: ExtensionAPI): void {
  let catalog = loadCatalog();
  let saved = loadChoice();
  let selection = resolveSelection(catalog.characters, {
    characterId: saved.characterId, artworkId: saved.characterId ? saved.artworkByCharacter[saved.characterId] : undefined,
  });
  const character = (): Character => catalog.characters.find(item => item.id === selection.characterId) ?? catalog.characters[0]!;
  const artwork = (): Artwork => character().artworks.find(item => item.id === selection.artworkId) ?? character().artworks[0]!;

  pi.on("session_start", (_event, ctx) => {
    catalog = loadCatalog();
    saved = loadChoice();
    selection = resolveSelection(catalog.characters, {
      characterId: saved.characterId, artworkId: saved.characterId ? saved.artworkByCharacter[saved.characterId] : undefined,
    });
    if (catalog.warnings.length && ctx.hasUI) ctx.ui.notify(catalog.warnings.join("\n"), "warning");
  });
  const refreshHeader = registerStartupBanner(pi, artwork);
  const selectQuoteCharacter = registerQuotes(pi, character);
  const isPreambleActive = registerPreamble(pi, character, () => saved, value => { saved = value; });

  pi.registerCommand("genshin-companion", {
    description: "选择像素角色和画作，按英文名搜索",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        if (ctx.hasUI) ctx.ui.notify("请在交互式终端中选择同伴。", "info");
        return;
      }
      let width = 86;
      const result = await ctx.ui.custom<Selection | undefined>((tui, theme, _keys, done) => {
        width = Math.max(8, Math.min(86, tui.terminal.columns - 4));
        return new CompanionPicker(catalog.characters, selection, saved, theme, done, Math.min(27, tui.terminal.rows - 4));
      }, { overlay: true, overlayOptions: () => ({ anchor: "center", width, maxHeight: "90%" }) });
      if (!result) return;
      const previousId = selection.characterId;
      selection = resolveSelection(catalog.characters, result);
      try {
        saved = saveChoice(selection, saved);
      } catch (error) {
        ctx.ui.notify(`同伴已应用于当前会话，保存 ${choicePath()} 失败：${String(error)}`, "warning");
      }
      refreshHeader();
      if (selection.characterId !== previousId) selectQuoteCharacter(character());
      ctx.ui.notify(`${character().name} · ${artwork().name}${selection.characterId !== previousId && (saved.preambleEnabled || isPreambleActive()) ? "；角色人格将在 /reload 或新会话后更新" : ""}`, "info");
    },
  });
}
