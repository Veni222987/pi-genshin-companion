# Pi Genshin Companion

一个为 [Pi](https://github.com/earendil-works/pi) 添加像素角色同伴的扩展包。启动时展示角色画作，在编辑器下方轮播语录；你也可以随时切换画作，并选择是否让角色人格参与对话。

## 安装

使用 Pi 一键安装（默认对所有项目生效）：

```bash
pi install git:github.com/Veni222987/pi-genshin-companion
```

安装后启动 Pi；如果 Pi 已在运行，执行 `/reload` 加载扩展。可用 `pi list` 查看已安装的包，后续用 `pi update git:github.com/Veni222987/pi-genshin-companion` 更新。

## 使用方法

### 选择角色与画作

在 Pi 中输入 `/genshin-companion`，打开角色列表和画作预览：


| 操作               | 按键        |
| -------------------- | ------------- |
| 按英文名搜索角色   | 直接输入    |
| 选择角色           | `↑` / `↓` |
| 切换画作           | `←` / `→` |
| 应用选择           | `Enter`     |
| 取消并保持当前选择 | `Esc`       |

首次使用默认显示薇斯纳的正脸腮红版，也可切换到歪头版。角色和各角色最近使用的画作保存在 Pi 用户目录的 `genshin-companion.json`，跨项目生效；选择角色后，画作与语录立即更新。

### 开关角色人格

角色人格**默认关闭**。使用以下命令：


| 命令                      | 作用                       |
| --------------------------- | ---------------------------- |
| `/genshin-preamble true`  | 开启角色人格               |
| `/genshin-preamble false` | 关闭角色人格               |
| `/genshin-preamble`       | 查看已保存状态与本会话状态 |

开关全局保存。修改开关或切换角色后，执行 `/reload` 或开启新会话，才会在对话中应用对应人格；单独切换画作不改变本会话的人格。

开启后，扩展用角色的 `PREAMBLE.md` 替换系统消息中已有的角色人格区块，**不会将两份人格叠加**；工具、Skills、规则、项目上下文和对话消息保持原样。完整的 `SYSTEM.md`、`--system-prompt` 或扩展强制系统提示词覆盖优先。角色人格文件缺失或无效时，保留原有角色文本并给出提示。

## 界面效果

- **启动页**：在 Pi 原生启动信息旁展示像素画；终端较窄时改为上下排版，无法适配时保留原生启动页。
- **语录轮播**：编辑器下方显示当前角色的元素色语录，启动时随机抽取，每 60 秒切换；窄屏最多显示两行。
- **角色选择器**：居中预览角色和画作，窄屏改为上下布局。

## 添加角色

在 `characters/<角色ID>/` 中添加 `character.json` 和画作 JSON 文件。角色 ID 需与目录名一致；`englishName` 用于搜索，`defaultArtwork` 指向默认画作，`artworks` 列出画作文件，`quotes` 管理语录。

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

画作 ID 应与文件名一致，画作尺寸为 40×40 像素，`.` 表示透明，`palette` 将单字符映射到 RGB 三色整数。`element` 支持 `pyro`、`hydro`、`anemo`、`electro`、`dendro`、`cryo`、`geo`；对应颜色定义在 `catalog/elements.ts`。

要提供对话人格，可在同一目录添加 `PREAMBLE.md`，参照 `preamble/TEMPLATE.md` 编写。修改角色素材后，重启 Pi 或执行 `/reload`；加载失败时扩展会提示，并使用薇斯纳的默认画作作为起点。

## 开发验证

```bash
npm ci
npm run typecheck
npm test
npm pack --dry-run
```

## 项目声明

本项目仅供娱乐，非商业项目。
