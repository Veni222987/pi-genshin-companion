# pi-genshin-companion

为 Pi 提供像素角色启动页、`/genshin-companion` 交互选择、编辑器下方的语录轮播与可开关的角色人格。

## 体验与加载

在项目目录运行：

```bash
pi -ne -e ./index.ts --approve
```

持久加载：在 Pi 用户目录的 `settings.json` 中配置包的绝对路径（或执行 `pi install /path/to/pi-genshin-companion`）。例如：

```json
{ "packages": ["/path/to/pi-genshin-companion"] }
```

`/genshin-companion` 打开居中角色列表及画作预览。输入英文名搜索；`↑↓` 选择角色，`←→` 切换画作，`Enter` 应用，`Esc` 保持当前状态。窄屏采用上下排列。首次显示薇斯纳的正脸腮红版；歪头版可手动选择。当前角色与各角色最近使用的画作保存在 Pi 用户目录的 `genshin-companion.json`，跨项目生效。

启动页使用 Pi 原生版本号、帮助、Context、Skills、Prompts、Extensions 及 `Ctrl+O` 展开功能；适配到 Pi 原生启动结构时，终端宽度至少 96 列采用左右排版，其余宽度采用上下排版。结构识别失败时显示原生启动页。

语录在独立的 `belowEditor` Widget 中显示，形式为 `薇斯纳: 别逞强，亲爱的朋友。`，整条文字使用角色的元素颜色。启动时随机抽取，每 60 秒切换，候选数至少为两条时每次切换至另一条。选择其他角色时立即抽取对应角色的语录。窄屏最多显示两行，并按列宽省略。

## 角色人格

`/genshin-preamble true` 保存全局开启状态，`/genshin-preamble false` 保存全局关闭状态；默认关闭。`/genshin-preamble` 显示已保存状态、本会话人格与命令用法。开关保存在 Pi 用户目录的 `genshin-companion.json`，在所有项目生效。执行 `/reload` 或开启新会话后，新状态及选中角色的人格才会应用到会话。选择角色时头像与语录即时更新；画作切换沿用当前会话人格。

开启时读取选中角色目录下的 `PREAMBLE.md`，替换请求中结构化系统消息已有的 `preamble` 区块；工具、Skills、规则、项目上下文及对话消息保持原样。角色资源缺失、空白或读取异常时提示一次，并保留当前系统角色文本。完整 `SYSTEM.md`、`--system-prompt` 与扩展强制系统提示词覆盖优先，覆盖生效时提示一次。

## 新增角色及语录

在 `characters/<角色ID>/` 添加 `character.json`，其中 `version` 为 `1`、`id` 与目录名一致、`englishName` 可搜索、`defaultArtwork` 指向画作 ID、`artworks` 列出画作 JSON 文件。画作 ID 与文件名一致，采用 40×40 像素、`.` 表示透明，`palette` 为单字符到 RGB 三色整数的映射。

```json
{
  "version": 1,
  "id": "example",
  "name": "示例角色",
  "englishName": "Example",
  "element": "anemo",
  "defaultArtwork": "smile",
  "artworks": ["smile.json", "winter.json"],
  "quotes": [{ "category": "问候", "text": "早上好！" }]
}
```

语录由角色文件的 `quotes` 数组管理，`category` 保存分类，界面显示角色名和 `text` 正文。`element` 必填，七元素 ID 为 `pyro`（火）、`hydro`（水）、`anemo`（风）、`electro`（雷）、`dendro`（草）、`cryo`（冰）、`geo`（岩）；颜色统一定义在 `catalog/elements.ts`，角色通过 ID 映射颜色。薇斯纳使用 `anemo`。薇斯纳当前收录了两张参考截图中正文占 1～2 行的语录。每个角色可在同一目录添加 `PREAMBLE.md`；使用 `preamble/TEMPLATE.md` 的八章结构编写角色的身份、人格、关系、语言、情绪、经历、共事方式与短对话示例。更新文件后重启 Pi 或执行 `/reload`，新角色、语录及人格资源即可生效。角色素材出现读取或格式问题时展示警告，并提供薇斯纳正脸默认画作作为起点。

## 开发验证

```bash
npm ci
npm run typecheck
npm test
npm pack --dry-run
```

Pi 版本基准由 `pi --version` 确认；包内开发依赖与本机 Pi API 一致，运行时 Pi 包通过 peer dependency 提供。

## 项目声明

本项目仅供娱乐，属于非商业项目。
