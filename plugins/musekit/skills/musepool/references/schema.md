# 字段约定

Seed 和 Template 都是 Markdown 文件：frontmatter 放结构化字段，正文放规则与说明。frontmatter 使用 YAML 的一个子集：块映射、块列表、带引号或不带引号的标量，以及只含标量的行内列表 `[a, b]`。以 `#` 开头的值（例如颜色）必须加引号。`muse.py check` 会校验下面的全部约定。

场景只有五个：`graphic`（单页平面）、`web`（网站与界面）、`slides`（演示文稿）、`diagram`（关系图解）、`data`（数据图）。状态只有 `draft` 和 `verified`。

## Seed

文件位于 `library/seeds/<类别>/<id>.md`。

| 字段 | 说明 |
| --- | --- |
| `id` | 与文件名一致，小写短横线 |
| `category` | 13 个类别之一：`color`、`typography`、`grid`、`spacing`、`shape`、`depth`、`texture`、`imagery`、`iconography`、`motion`、`data-encoding`、`device`、`technique` |
| `nature` | `value`（给出可直接使用的值）或 `rule`（给出做法） |
| `name`、`status`、`scenes` | 中文名、状态、适用场景 |
| `affinity` | 与之相配的风格族，例如 `neo-swiss` |
| `conflicts` | 不能同时使用的 Seed id 或风格族 |
| `tokens` | 每个 token 是一个映射：`value` 必填，`role` 说明用途 |
| `tools` | 可选。这个 Seed 要用到的共享制作工具，是路径列表，路径相对插件根，例如 `[assets/halftone.js]`。文件必须在插件的 `assets/` 里。`resolve` 会在这个 Seed 的要点之后写明工具的位置 |

制作工具放在哪一层：

- 风格库只描述做法，不放可执行代码。
- 只有一个 Workflow 用的工具放在那个 Workflow 里，例如 diagram-design 的运行时。
- 两个以上 Workflow 共用的工具放在插件级的 `assets/`，由 Seed 用 `tools` 声明。
- 共享工具都是单文件，没有依赖，不访问网络，不需要构建；能在浏览器里直接运行，`file://` 下也能用。
- 制作时把工具复制进作品目录，成品不引用插件路径；要求单文件交付时可以把工具全文内联，所以工具文件里不能出现 `</script>` 字样。

类别专属字段：

- `color`：必须有 `paper`（背景）、`ink`（正文）、`accent`（强调）三个 token。`variants` 按变体名改写部分 token。`pairs` 列出需要满足对比度的配对 `[前景, 背景, body|large]`，`body` 要求 4.5:1，`large` 要求 3:1，每个变体都要满足。可选的 `data` 给数据图色板，三组都写：`categorical`（3–6 色，每色对纸面至少 3:1，任意两色 OKLab ΔE×100 至少 15，红色盲和绿色盲模拟下至少 8）、`sequential`（3–9 色，由浅到深，最深一色对纸面至少 3:1）、`diverging`（奇数个、至少 5 色，中点是中性色，两臂向两端逐级变深，两端对纸面至少 3:1）。声明了 `data` 场景的 Template，它的颜色 Seed 必须有 `data`。
- `typography`：必须有 `font-display`、`font-text`、`font-cjk`、`size-body`。字体值必须是注册表里的开源字体，`font-cjk` 必须覆盖汉字。可选的 `archetype` 记录风格原型字体（可以是版权字体，但必须已登记）。

正文必须有 `## 要点`：每条一个短句，说明怎样用、用多少。可以再加 `## 适用与边界`，写限制条件与缺少素材时的退路。两节都会原样进入 `style.md`。

token 名在一个 Template 内不能重复。通用名称：颜色用角色名（`paper`、`ink`、`ink-muted`、`accent`、`on-accent`）；字体用 `font-*`、`weight-*`、`size-*`（展示层级依次为 `display`、`headline`、`title`，文字层级为 `body`、`meta`）、`leading-*`、`tracking-*`（中文与西文不同时，加 `-cjk` 后缀给中文单独的值，如 `leading-display-cjk`）；网格用 `canvas-width`、`canvas-height`、`columns`、`gutter`、`margin`；间距用 `space-unit`、`space-scale`；形态用 `radius`、`rule-width`、`rule-state`、`rule-heavy`、`shadow`。颜色 token 导出为 `--color-<名>`，`space-scale` 导出为 `--space-1…n`，其余导出为 `--<名>`。数据色板只在场景 `data` 导出，依次为 `--data-cat-<n>`、`--data-seq-<n>`、`--data-div-<n>`。

## Template

文件位于 `library/templates/<id>.md`；用户或混搭的 Template 放在作品目录里，通过路径使用。

| 字段 | 说明 |
| --- | --- |
| `id`、`kind: template`、`name`、`name_en`、`family` | 标识；`family` 用于亲和与冲突判断 |
| `status`、`source` | 状态；来源为 `library`、`user` 或 `composed` |
| `scenes`、`mood` | 适用场景；用于检索的气质词 |
| `seeds` | 类别到 Seed id 的映射；`color`、`typography`、`grid`、`spacing` 必填 |
| `variants` | `default` 与 `options`，取值来自颜色 Seed 的变体 |
| `overrides` | 按场景覆盖 token 值，见下方「场景覆盖」 |
| `exemplars` | Precedent id 列表 |
| `examples` | 可选。场景到 Workflow 制作示例的映射，路径相对插件根，例如 `web: skills/web-design/references/examples/<名称>.md`；场景必须在 `scenes` 里，文件必须存在。`resolve` 只输出当前场景那一条 |

正文章节依次为：`## 精神`（必填，一段话说明这个风格要解决什么阅读问题）、`## 文法`（必填：网格、对齐、层级、留白、色彩、装置、图像，以及选中、出错、完成等状态）、`## 场景适配`（每个场景一个 `### <场景>` 小节，可缺）、`## 常见误用`、`## 范例`（每条写明 Precedent id、借什么、不借什么；`resolve` 会把这一节原样写进 `style.md`）。

库内 `verified` 的 Template 必须附同名样张 `<id>.png`。

### 场景覆盖

`overrides.<场景>` 下写 token 名和值，例如海报的字号与 `canvas-width`。只能覆盖已有的 token。

`overrides.<场景>.breakpoints.<名称>` 写一个断点：`max-width`（形如 `767px`）必填，其余键都是 token 覆盖值，规则 token（如 `ratio-adjacent`）也可以覆盖。`resolve` 会把断点写进 `style.md` 的 frontmatter，并生成对应的 `@media` 块。

几类值不是写死的，由脚本推导或检查：

- `column-width`：由 `canvas-width`、`columns`、`gutter`、`margin` 算出参照画布下的单栏宽度。
- 展示字号：随标题字数变化，不写成 token；`size-display` 只是参照值。适配要求标题跨满栏或竖排到某个长度时，用 `muse.py fit <template> --scene <场景> --chars <字数> (--span <栏数> | --vertical) [--tracking <em>] [--padding <px>] [--breakpoint <名称>]` 推导；它按全角汉字等宽计算，西文要在浏览器里实测。字距默认取 `tracking-display-cjk`，没有时取 `tracking-display`；`--tracking` 显式覆盖。
- 文字配对：`resolve` 根据颜色 Seed 的 `pairs` 生成「文字配对」表，列出每种文字色可以放在哪种背景上、可用多大字号。
- 间距：用了带 `space-scale` 的间距 Seed 时，每个场景和断点的 `margin`、`gutter` 都必须取自阶梯。
- 字重：Typography Seed 用到的字重必须出现在对应字体加载地址的 `wght@` 列表里（等宽字体只要求 `weight-text`）。
- 字号比例：Template 用了带 `ratio-adjacent`、`ratio-display` 的 Seed 时，`check` 会对每个场景和每个断点检查 display/headline、headline/title 不低于 `ratio-adjacent`，display/body 不低于 `ratio-display`。

## 用户 Template

用户提供品牌规范或参考时，Agent 按 Template 的形状写一份 `source: user` 的文件。对于库里已有的同类 Seed，只要值与用户规范一致就直接引用；不一致时，在作品目录里另写一份用户 Seed，并通过 `check <路径>` 校验。精神与文法从用户规范和参考中归纳；看不出来的地方写明「沿用库内某风格的文法」或询问用户，不凭空编造。

## 字体注册表

`library/fonts.yaml` 的 `fonts` 列表，每个字体一项：

| 字段 | open | commercial | system |
| --- | --- | --- | --- |
| `family`、`kind`、`scripts` | 必填 | 必填 | 必填 |
| `license` | 必填，如 `OFL-1.1` | `proprietary` | — |
| `official` | 必填，官方页面 | 可选 | — |
| `download` | 必填，官方下载地址 | — | — |
| `css` | 可选，网页加载地址 | — | — |
| `mirrors` | 可选，仅限官方维护或可追溯到原始发布包的分发 | — | — |
| `fallback` | 必填，回退栈 | — | — |
| `alternatives` | — | 必填：`family`（已登记的开源字体）与 `note`（差异说明） | — |

`scripts` 使用 `latin`、`greek`、`cyrillic`、`han-simplified`、`han-traditional`、`kana`、`hangul`。全部链接使用 https。`check` 只校验字段，`check --links` 联网确认链接可访问。
