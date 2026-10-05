# 交付位置

所有产物放在文章旁边，不修改原始 Markdown。

```text
{文章目录}/article-illustration/
  outline.md
  seed.md
  {原名}.illustrated.md
  images/NN-{scene}-{slug}.png
  sources/NN-{scene}-{slug}.mmd
  sources/NN-{scene}-{slug}.html
  sources/NN-{scene}-{slug}.prompt.md
```

`scene` 使用 `diagram`、`graphic` 或 `scientific`。编号从 01 起，按大纲顺序。只保留实际产生的来源：Mermaid 存 `.mmd`，可编辑图解存 `.html`，生图存 `.prompt.md`。

## 大纲

`outline.md` 先写全篇视觉方向，再逐个图位：

```markdown
# 配图方案

视觉方向：用户参考，或 seed.md

## 01
- 位置：第二节「收集」段落后；或替换某个 Mermaid 围栏
- 目的：说明三步是一条方向
- 场景：diagram-design
- 密度路径：尝试生图
- 必须保留的标签：收集、整理、展示
- 来源原句：仅散文抽出的关系需要
- 状态：planned | done | failed
- 失败原因：
```

状态只用 planned、done、failed。失败时写下原因，不插入坏图。

## 副本

`{原名}.illustrated.md` 从原文复制。

- Mermaid 围栏替换为指向 `images/NN-{scene}-{slug}.png` 的图片，说明使用文章的语言，围栏原文另存 `.mmd`。
- 新增的图插在对应段落之后。
- 说明使用文章的语言。
- 作者原有图片保持原路径。

正文图导出宽度 1080px，高度随内容，不裁成 16:9。用户明确要求公众号封面时，比例用 2.35:1。

## 重入

目录已存在时，先读大纲和图片，只问一次：补充还没有的图、只重做失败项，或全部重做。得到回答前不覆盖。补充不改已完成图位。只重做失败项时保留 done 的文件。全部重做前仍要用户明确选择。

## 以后的排版插件

公众号排版不由本 Skill 产出。以后的 `article-layout` 若存在，应优先读取 `{原名}.illustrated.md`，并把 HTML 写到文章旁边的 `article-layout/`。本 Skill 不创建该目录。
