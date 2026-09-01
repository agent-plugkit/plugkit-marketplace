# Agent Plugkit Marketplace

The official plugin marketplace maintained by the Agent Plugkit organization.

## Musekit 设计工具箱

Musekit 将设计灵感与场景制作分开：

| Skill | 用途 |
| --- | --- |
| `musepool` | 探索 29 个本地设计种子，输出 Markdown seed 简报 |
| `ui-design` | 设计并实现前端界面，验证真实交互和响应式布局 |
| `graphic-design` | 制作海报、杂志封面和社媒图文等平面作品 |
| `diagram-design` | 从 Mermaid 或关系说明制作精美图解，以自定义 HTML/CSS/SVG 完成排版并从浏览器导出图片 |
| `scientific-figure` | 基于原始资料制作学术数据图和科学示意图 |

可以先探索灵感，也可以直接制作。四个制作 Skill 都能使用 seed、用户参考或已有设计系统，默认交付实际作品。种子分类为 `ui`、`graphic`、`information`，只帮助检索，不限定作品布局或技术栈。

例如：“用 Musepool 提炼一个有清楚色彩职责的方向，再制作社区观察记录界面。”同一个 seed 也可以交给其他场景使用，由制作 Skill 重新判断版面与表达。

完整示例包含[观察记录界面](plugins/musekit/skills/ui-design/references/examples.md)、[刊物封面](plugins/musekit/skills/graphic-design/references/examples.md)、[四种图解](plugins/musekit/skills/diagram-design/references/examples.md)和[学术数据图](plugins/musekit/skills/scientific-figure/references/examples.md)，各自附输入、选择理由与可编辑源文件。

### 从旧设计插件迁移

Musekit `0.1.0` 整体替换 `musepool`、`design-compile` 和 `mermaid-render` 三个插件。安装新插件后使用上面的 Skill 名称；旧的已安装副本不会由仓库变更自动迁移，请在所用客户端移除或停用旧副本，避免重复触发。

`musepool-export` 已合并到 `musepool` 的 Markdown seed 简报；旧 JSON reference bundle、编译 manifest 和 `design-compile` 状态契约不再提供。已有材料可提取为普通设计参考，不需要转换器。`render` 的图解制作入口改为 `diagram-design`，整图生图仍可由用户明确选择。

本地检索继续提供 `list/search/show`，`--scenario` 改用 `ui`、`graphic`、`information`；旧分类参数与旧插件路径不提供兼容别名。29 个 seed 的 ID、来源与详细参考保留，`show <id>` 仍可定位同一参考。

## Register

```bash
npx agent-plugkit install-repo agent-plugkit/plugkit-marketplace --all
```

Registration makes this marketplace available to selected clients. Plugin installation remains a
separate client action.

## Contents

Canonical plugin declarations live in `plugins/*/plugin.yaml`. Portable manifests, client-native
manifests, marketplace indexes, and `plugins/CATALOG.md` are generated from those declarations and
must not be edited by hand.

## Development

```bash
npm ci
npm run check
npm run release:local
```

`npm run check` regenerates all plugin artifacts and indexes, validates the complete marketplace,
and checks that the public repository contains no internal planning or machine-local material.

## License

MIT
