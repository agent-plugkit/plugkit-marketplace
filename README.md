# Agent Plugkit Marketplace

The official plugin marketplace maintained by the Agent Plugkit organization.

## Musekit 设计工具箱

Musekit 将设计灵感与场景制作分开：

| Skill | 用途 |
| --- | --- |
| `musepool` | 探索 29 个本地设计种子，输出 Markdown seed 简报 |
| `ui-design` | 设计并实现前端界面，验证真实交互和响应式布局 |
| `graphic-design` | 制作海报、杂志封面和社媒图文等平面作品 |
| `diagram-design` | 从 Mermaid 或关系说明制作精美图解，共用测量与连线代码，成品内置离线布局编辑和 PNG 导出 |
| `scientific-figure` | 基于原始资料制作学术数据图和科学示意图 |
| `article-illustration` | 为一整篇文章编排配图，确认后交给图解、平面或学术图 Skill，并把 PNG 插入不改原文的副本 |

可以先探索灵感，也可以直接制作。四个场景 Skill 都能使用 seed、用户参考或已有设计系统，默认交付实际作品。`article-illustration` 只编排整篇文章，不替代单张图的场景 Skill，也不做公众号排版。种子分类为 `ui`、`graphic`、`information`，只帮助检索，不限定作品布局或技术栈。

例如：“用 Musepool 提炼一个有清楚色彩职责的方向，再制作社区观察记录界面。”同一个 seed 也可以交给其他场景使用，由制作 Skill 重新判断版面与表达。

完整示例包含[观察记录界面](plugins/musekit/skills/ui-design/references/examples.md)、[刊物封面](plugins/musekit/skills/graphic-design/references/examples.md)、[六种图解](plugins/musekit/skills/diagram-design/references/examples.md)和[学术数据图](plugins/musekit/skills/scientific-figure/references/examples.md)，各自附输入、选择理由与可编辑源文件。

Musekit `0.3.0` 的图解成品支持节点查找与直接关系定位，内置按错误和提示分组的布局诊断。点击“编辑布局”可调整模块、分组、连线与标签，按编号定位或删除折点；属性区与对象列表独立滚动，窄窗口使用底部双栏。保存新 HTML 后可离线继续编辑，使用者直接在桌面 Chrome 或 Edge 打开文件。[布局编辑说明](plugins/musekit/skills/diagram-design/references/editor.md)包含保存和 PNG 导出操作。

制作端按[接入协议](plugins/musekit/skills/diagram-design/references/protocol.md)标记作品，再用随 Skill 分发的 Python 封装脚本内嵌运行资源。Musekit `0.5.0` 起，新模板默认让相对模块的连线成直线并分散其余端点，首次打开时整理构图：对齐直线关系，统一同类节点尺寸与链上间距，居中分叉与汇合；旧图缺省配置保持原行为；[验证后交付](plugins/musekit/skills/diagram-design/references/html.md#验证后交付)可先封装、检查并保存证据，通过后再替换成品，严格模式还会阻止带提示的交付。

### 从旧设计插件迁移

Musekit `0.1.0` 整体替换 `musepool`、`design-compile` 和 `mermaid-render` 三个插件。安装新插件后使用上面的 Skill 名称；旧的已安装副本不会由仓库变更自动迁移，请在所用客户端移除或停用旧副本，避免重复触发。

`musepool-export` 已合并到 `musepool` 的 Markdown seed 简报；旧 JSON reference bundle、编译 manifest 和 `design-compile` 状态契约不再提供。已有材料可提取为普通设计参考，不需要转换器。`render` 的图解制作入口改为 `diagram-design`，整图生图仍可由用户明确选择。

本地检索继续提供 `list/search/show`，`--scenario` 改用 `ui`、`graphic`、`information`；旧分类参数与旧插件路径不提供兼容别名。29 个 seed 的 ID、来源与详细参考保留，`show <id>` 仍可定位同一参考。

## Install

You need Node.js 20+ (for `npx`) and the agent's own CLI on `PATH`. One command registers this
marketplace and installs Musekit through that CLI:

### Claude Code

```bash
npx agent-plugkit install-repo agent-plugkit/plugkit-marketplace --agent claude --plugin musekit
```

This runs `claude plugin marketplace add agent-plugkit/plugkit-marketplace` followed by
`claude plugin install musekit@agent-plugkit`; you can run those two commands yourself instead.
Start a new Claude Code session afterwards so the skills are loaded.

### Codex

```bash
npx agent-plugkit install-repo agent-plugkit/plugkit-marketplace --agent codex --plugin musekit
```

This runs `codex plugin marketplace add agent-plugkit/plugkit-marketplace` followed by
`codex plugin add musekit@agent-plugkit`. Start a new Codex session afterwards. To export PNG
diagrams from inside Codex's default sandbox, see [Troubleshooting](#chromium-is-killed-inside-codex).

### Cursor

The marketplace ships `.cursor-plugin/marketplace.json`, but Cursor has no CLI for registering it.
A Cursor Team/Enterprise administrator imports it in the Dashboard: Plugins → Add Marketplace →
Import from Repo → `agent-plugkit/plugkit-marketplace`. `agent-plugkit` cannot automate this step.

### Other clients

`--agent grok`, `--agent copilot` and `--agent vscode` (or `--all`) register the marketplace; install
Musekit from that client afterwards. If an agent CLI is missing, the command reports `[缺少 CLI]`
with an install hint and exits non-zero.

### Try it

Ask the agent, from the directory where the result should be saved:

```text
用 Musekit 的 diagram-design，把这个流程做成一张图解，保存到当前目录：flowchart LR; A[写文章]-->B[配图]-->C[发布]
```

(“Use Musekit's diagram-design to turn this flow into a diagram and save it to the current
directory.”) The result is a self-contained `.html` with a built-in layout editor plus a `.png`.

## Runtime requirements

| Task | Needs |
| --- | --- |
| Open or edit a delivered diagram `.html` | A desktop Chrome or Edge; nothing to install |
| Package diagrams (`diagram-design`), search seeds (`musepool`) | Python 3 |
| Export diagram PNGs and run the browser checks | Node.js 20+, Playwright in the working directory, and a Chromium browser |
| Other skills | The agent's own tools; a browser when the agent previews pages |

Install the PNG dependencies in the directory where the agent works:

```bash
npm install --no-save playwright && npx playwright install chromium
```

On a fresh Linux machine, `npx playwright install --with-deps chromium` also installs the system
libraries Chromium needs (requires sudo). When these are missing, the diagram is still delivered as
HTML and the command prints the exact fix.

## Troubleshooting

### `PNG not exported: ... Playwright is not installed`

Run the printed fix in the working directory shown, then ask the agent to export again:
`npm install --no-save playwright && npx playwright install chromium`.

### `PNG not exported: ... its browser has not been downloaded`

Run `npx playwright install chromium`, or use an installed Google Chrome with `--browser chrome`.
If the export used `--browser chrome` or `--browser msedge`, the message names that browser instead:
install it with `npx playwright install chrome` (or `msedge`), or install Chromium and export again
with `--browser chromium`.

### `PNG not exported: ... missing libraries the browser needs to start`

Linux reported `Host system is missing dependencies to run browsers` or
`error while loading shared libraries`. Run `npx playwright install --with-deps chromium` (needs
sudo), then export again.

When the requested HTML already exists, the unverified HTML is written to the first free
`<name>.unverified.html`, `<name>.unverified-2.html`, … next to it; existing files are never
replaced.

### Chromium is killed inside Codex

Symptom: the browser exits immediately with `setsockopt: Operation not permitted` or
`shutdown: Operation not permitted` (`Target page, context or browser has been closed`, SIGTRAP).
Codex's default `workspace-write` sandbox turns off network access, and on Linux it does that with a
seccomp filter that also blocks the socket calls Chromium makes for its crash handler and process
IPC at startup. Browser flags cannot work around it. Allow network access in the sandbox instead:

```bash
codex -c sandbox_workspace_write.network_access=true
# non-interactive:
codex exec -s workspace-write -c sandbox_workspace_write.network_access=true "..."
```

or make it permanent in `~/.codex/config.toml`:

```toml
[sandbox_workspace_write]
network_access = true
```

This also lets other commands the agent runs reach the network. If you prefer to keep it off, keep
the delivered HTML and run the PNG export command yourself outside Codex. Verified with Codex CLI
0.162.1 on Linux.

## Contents

Canonical plugin declarations live in `plugins/*/plugin.yaml`. Portable manifests, client-native
manifests, marketplace indexes, and `plugins/CATALOG.md` are generated from those declarations and
must not be edited by hand.

## Development

```bash
npm ci
npx playwright install chromium
npm run check
npm run release:local
```

`npm run check` checks the bundled diagram runtime and examples, regenerates plugin manifests and
indexes, validates the marketplace, and runs geometry, packaging and browser tests. It also checks
that public content contains no internal planning or machine-local material. Browser evidence and
downloads go to the system temporary directory. After changing diagram runtime sources or example
artwork in `references/examples/source/`, run `npm run build:diagram` before the check. The
development dependencies above are only for this repository; what plugin users need is listed under
[Runtime requirements](#runtime-requirements).

## License

MIT
