# 交付位置

所有产物放在文章旁边，不修改原始 Markdown。

```text
{文章目录}/article-illustration/
  outline.md
  template.md          只在用户给了参考或品牌规范时
  style.{scene}.md
  {原名}.illustrated.md
  images/NN-{scene}-{slug}.png
  sources/NN-{scene}-{slug}.mmd
  sources/NN-{scene}-{slug}.html
  sources/NN-{scene}-{slug}.prompt.md
  sources/NN-{scene}-{slug}.*
  notes.md
```

`scene` 使用 `diagram`、`graphic` 或 `data`，与 musepool 的场景一致：`diagram-design` 的图用 `diagram`，`graphic-design` 的用 `graphic`，`data-figure` 的用 `data`。每个用到的场景一份 `style.{scene}.md`，来自大纲的视觉方向；用户让某个场景改用别的风格时，这一份按那个图位写的风格解析。编号从 01 起，按大纲顺序。只保留实际产生的来源：Mermaid 存 `.mmd`，可编辑图解存 `.html`，生图存 `.prompt.md`。场景 Skill 留下的其余工作文件（检查报告、`facts.txt`、数据文件、绘图代码）也放进 `sources/`，用同一个 `NN-{scene}-{slug}` 开头。各图的交付说明合成一份 `notes.md`：栏位决定、未验证适配的推导、实际字体、假定的显示宽度和评审看了什么。

## 大纲

`outline.md` 先写全篇视觉方向，再逐个图位：

```markdown
# 配图方案

视觉方向：Template 和变体，例如 neo-swiss / cobalt；用户参考整理成的写 `template.md`
图题：随正文看 | 会被单独传播

## 01
- 种类：题图 | 示意插画 | 关系图 | 数据图
- 位置：标题之后；或第二节「收集」段落后；或替换某个 Mermaid 围栏
- 目的：让读者先知道文章在讲什么
- 场景：graphic-design、diagram-design 或 data-figure
- 风格：只在用户选了与视觉方向不同的风格时写
- 必须保留的标签：只有关系图需要
- 来源原句：仅散文抽出的关系需要
- 状态：planned | done | failed
- 失败原因：
```

状态只用 planned、done、failed。失败时写下原因，不插入坏图。

## 副本

`{原名}.illustrated.md` 从原文复制。

- Mermaid 围栏替换为指向 `images/NN-{scene}-{slug}.png` 的图片，说明使用文章的语言，围栏原文另存 `.mmd`。
- 新增的图插在对应段落之后；数据图插在它所用的表格之后，表格保留。
- 说明使用文章的语言。
- 图里放不放图题，看大纲的「图题」一行，全篇统一：
  - 随正文看（技术分享、文档）：图里不另加图题或栏目名，文章上下文就是图题。
  - 会被单独传播（宣传、娱乐，图常被截出来转发）：图里带图题，必要时带出处，单独看也能懂。图题只复述原文的事实和说法。
  - 数据图的结论句仍按 `data-figure` 自己的规则。
- 作者原有图片保持原路径。

正文图导出宽度 1080px，高度随内容，不裁成 16:9。用户明确要求公众号封面时，比例用 2.35:1。

## 重入

目录已存在时，先读大纲和图片，只问一次：补充还没有的图、只重做失败项，或全部重做。得到回答前不覆盖。问的时候写明每个选项会做哪几个图位。

- 补充：做 planned 的图位。按现行图位规则还该有、旧大纲里没有的图位，也在这时提出。
- 只重做失败项：只做 failed 的图位，保留 done 的文件。
- 全部重做：前提是用户明确选了它。

done 的图位不动；打开发现图不对（空白、尺寸不对）时告诉用户，不自己改状态。新提出的图位照 SKILL.md「写方案并确认」一步写进大纲，等确认后再做；只是继续旧大纲里已有的图位，不用再确认。大纲和副本里要做的那几个图位照常更新。

早先的目录可能是旧格式，照下面读。旧文件不改名、不迁移：

- 只有一份 `style.md`：读它 frontmatter 里的 `template` 和 `variant`，作为全篇方向。它就是 frontmatter 里 `scene` 那个场景的 style 文件，其余场景缺哪份就补解析哪份 `style.{scene}.md`。
- 没有任何 style 文件，大纲的视觉方向写的是用户参考：在重入问题里一并问用户，这份参考是否还在、要不要沿用；得到回答后按 SKILL.md「确定视觉方向」一步整理成 `template.md`。
- 大纲没有「图题」一行：按「随正文看」处理，问重入问题时一并告诉用户。
- 文件名里的 `scientific`：就是数据图。已有文件和副本里的路径保持原名，新做的图用 `data`。
- 图位带「路径」一行：done 的图位不动。planned 或 failed 的图位写着「尝试生图」时，改由 `diagram-design` 做可编辑图解，问重入问题时一并告诉用户。

## 以后的排版插件

公众号排版不由本 Skill 产出。以后的 `article-layout` 若存在，应优先读取 `{原名}.illustrated.md`，并把 HTML 写到文章旁边的 `article-layout/`。本 Skill 不创建该目录。
