# Agent Plugkit Marketplace

The official plugin marketplace maintained by the Agent Plugkit organization.

## Musekit 设计工具箱

Musekit 把「风格」和「场景制作」分成两层：

- **风格库**由 `musepool` 管理：Seed 是按设计元素分类的可复用单元（配色、字体、网格、间距、形态、手法等），Template 是由 Seed 组合而成的风格（目前有新瑞士国际主义、日式留白、编辑衬线、新粗野主义、单色编辑印刷 5 种，均为 draft），写明精神、文法、各场景适配与常见误用；29 个真实作品的拆解记录保留为范例。musepool 按场景检索或组合风格，并解析成一份 `style.md`。
- **场景工作流**负责制作：先写场景 Brief，再从 musepool 取 `style.md`，选结构原型、用风格文法排版，制作后按共享的评审循环检查。用户的品牌规范或既有设计系统会被整理成同形的风格。

| Skill | 用途 |
| --- | --- |
| `musepool` | 设计风格与灵感库：按场景检索 Template、组合 Seed、解析 `style.md` |
| `web-design` | 设计并实现网站、落地页与 Web App 界面，在浏览器评审 |
| `graphic-design` | 制作海报、封面和社媒图等单页平面作品 |
| `diagram-design` | 从 Mermaid 或关系说明制作精美图解，共用测量与连线代码，成品内置离线布局编辑和 PNG 导出 |
| `data-figure` | 把数据做成准确、好看的数据图，学术出版图另守统计与出版规范 |
| `article-illustration` | 为一整篇文章编排配图，确认后交给图解、平面或数据图 Skill，并把 PNG 插入不改原文的副本 |

`article-illustration` 只编排整篇文章，不替代单张图的场景 Skill，也不做公众号排版。字体只登记可合法获得的开源字体；版权字体作为风格原型登记，并给出开源替代。

完整示例包含[两种风格的官网首页](plugins/musekit/skills/web-design/references/examples.md)、[两种风格的活动海报](plugins/musekit/skills/graphic-design/references/examples.md)、[六种图解](plugins/musekit/skills/diagram-design/references/examples.md)和[学术数据图](plugins/musekit/skills/data-figure/references/examples.md)，各自附输入、选择理由与可编辑源文件；网页和海报示例还记录了评审发现与修正。

Musekit `0.3.0` 的图解成品支持节点查找与直接关系定位，内置按错误和提示分组的布局诊断。点击“编辑布局”可调整模块、分组、连线与标签，按编号定位或删除折点；属性区与对象列表独立滚动，窄窗口使用底部双栏。保存新 HTML 后可离线继续编辑，使用者直接在桌面 Chrome 或 Edge 打开文件。[布局编辑说明](plugins/musekit/skills/diagram-design/references/editor.md)包含保存和 PNG 导出操作。

制作端按[接入协议](plugins/musekit/skills/diagram-design/references/protocol.md)标记作品，再用随 Skill 分发的 Python 封装脚本内嵌运行资源。Musekit `0.5.0` 起，新模板默认让相对模块的连线成直线并分散其余端点，首次打开时整理构图：对齐直线关系，统一同类节点尺寸与链上间距，居中分叉与汇合；旧图缺省配置保持原行为；[验证后交付](plugins/musekit/skills/diagram-design/references/html.md#验证后交付)可先封装、检查并保存证据，通过后再替换成品，严格模式还会阻止带提示的交付。

### 从 0.x 迁移到 1.0

Musekit `1.0.0` 重做了风格层：`ui-design` 改名为 `web-design`；musepool 的 `muse_local.py` 与 `ui`/`graphic`/`information` 分类、Markdown seed 简报不再提供，改用 `scripts/muse.py` 的 `search/show/resolve/compose/check` 与 `style.md`。原 29 个 seed 作为范例保留在 `library/precedents/`，`muse.py show <id>` 仍可查看。不提供旧名称和旧命令的兼容别名。

### 从旧设计插件迁移

Musekit `0.1.0` 整体替换 `musepool`、`design-compile` 和 `mermaid-render` 三个插件。安装新插件后使用上面的 Skill 名称；旧的已安装副本不会由仓库变更自动迁移，请在所用客户端移除或停用旧副本，避免重复触发。

`musepool-export` 已合并到 `musepool` 的 Markdown seed 简报；旧 JSON reference bundle、编译 manifest 和 `design-compile` 状态契约不再提供。已有材料可提取为普通设计参考，不需要转换器。`render` 的图解制作入口改为 `diagram-design`。1.0 起图解不再提供整图生图，插画式表达交给 `graphic-design`。

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
| Package diagrams (`diagram-design`), search and resolve styles (`musepool`) | Python 3 |
| Export diagram PNGs and run the browser checks | Node.js 20+, Playwright in the working directory, and a Chromium browser |
| Other skills | The agent's own tools; a browser when the agent previews pages |

Install the PNG dependencies in the directory where the agent works:

```bash
[ -f package.json ] || npm init -y >/dev/null && npm install --no-save playwright && npx playwright install chromium
```

The `npm init -y` step only runs when the directory has no `package.json`: npm 9 refuses to install
there (`Tracker "idealTree" already exists`). An existing `package.json` is left unchanged.

On a fresh Linux machine, `npx playwright install --with-deps chromium` also installs the system
libraries Chromium needs (requires sudo). When these are missing, the diagram is still delivered as
HTML and the command prints the exact fix.

## Troubleshooting

### `PNG not exported: ... Playwright is not installed`

Run the printed fix in the working directory shown, then ask the agent to export again:
`[ -f package.json ] || npm init -y >/dev/null && npm install --no-save playwright && npx playwright install chromium`.

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
