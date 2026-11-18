# Musekit 盲测与辨识度对照

库内 Template 进库前要过 `style-builder` 的维护者关卡，其中盲测和辨识度对照在官方仓库里完成。这份说明和 `compare.mjs` 只放在仓库里，不随插件分发。

盲测由空白上下文的代理完成：它只读插件里的文档，按标准 Brief 制作，实测耗时并记录摩擦。目的是检验两件事：Skill 文档和风格文件能不能自己撑起作品；这套风格的文法能不能指导出不同于普通模板的作品。

盲测产物是证据，不提交。放在仓库外，或放在已经被 `.gitignore` 忽略的目录里。

## 制作代理的提示词

把 `<…>` 换成实际值后整段交给代理。请求原文取自 `plugins/musekit/skills/style-builder/references/briefs.md`，事实文件在同目录的 `briefs/` 里。

```text
你是一名第一次使用 Musekit 插件的制作者。按插件自己的说明完成下面的请求，不要向任何人提问，不清楚的地方自己判断并记录。

## 请求（用户原话）

<标准 Brief 的请求原文，<风格> 已换成新 Template 的名字和 id>

## 工作约束

- 插件在 `<仓库根>/plugins/musekit/`。从它的 `plugin.yaml` 和各 Skill 的 `SKILL.md` 开始读，按 Skill 写的流程走（Brief → 取风格 → 结构 → 制作 → 评审）。插件目录全程只读，不得修改。
- 产物全部写进 `<产物目录>`：`poster/`（poster.html、poster.png、style.md、facts.txt）和 `web/`（index.html、style.md、facts.txt），以及 `review/` 下的评审产物。facts.txt 用 `<事实文件路径>` 的内容。
- 只读插件目录和产物目录，不读仓库里的其他文件、测试和 git 历史。
- 需要 Playwright 的命令在仓库根目录运行。
- 开始和结束时用 `date` 记下时间，写进 process.md。
- 按本说明「摩擦记录格式」一节的格式，在产物目录根部写 `process.md`，第 6 节的必答项都要回答。<把下一节的格式全文贴在这里>
- 评审走完整档：Skill 说明里有子代理时，交给空白上下文的评审子代理，按 `references/critique.md` 的评审循环复查（最多两轮）。评审者只拿产物、Brief、style.md 和媒介清单，不读 process.md。
- 交付前在产物目录根部存这些截图（网页用插件的检查脚本或 Playwright 均可）：`web-full.png`（1440 宽整页）、`web-fold.png`（1440 × 900 首屏）、`web-768.png`、`web-375.png`（首屏）、`web-375-full.png`、`web-form-error.png`（空提交后的表单）、`web-form-done.png`（完成态），以及灰度整页 `web-full-gray.png`。
- 结束时用不超过 300 字报告：产物路径、耗时、评审轮数与主要修正、摩擦条数和最重要的 3 条。
```

只做一个场景时，删掉另一件作品的产物和截图要求。slides、diagram、data 的盲测把产物清单换成对应 Workflow 交付说明里列的文件。

## 摩擦记录格式

盲测代理按这个格式写 `process.md`。

```markdown
# 盲测记录

## 1. 读过的文件

列出读过的插件文件和用途；没读的也写一句（例如「没读 neo-brutalism 示例」）。

## 2. 跑过的命令

`muse.py`、检查脚本和渲染命令，原样贴出。开始与结束时间（`date` 实测）和耗时。

## 3. Brief 与关键决定

- Brief：读者与场合、阅读顺序、逐字准确的事实、素材、成功标准。
- 变体怎么选、为什么。
- 结构原型与栏位决定，几句话即可。
- 风格之外的值：style.md 里没有、自己补上的值（字号、间距、断点、CSS 变通），每条写来源或推导。

## 4. 摩擦

编号 F1、F2……每条三行：

- 出处：插件文件与行号，或 resolve 出的 style.md 的原句。
- 问题：哪两条规则冲突，或缺了哪个值、哪种情形。
- 我的处理：实际怎么做的，用了什么数值。

不是插件问题的（例如用户请求本身的歧义）单独列在最后，注明「不是插件问题」。

## 5. 评审循环

评审者拿到哪些文件、每轮发现（编号）、怎样修正、复查结论。

## 6. 必答

每一项都要回答，不能跳过：

1. **首屏以下去色后是否还认得出风格？** 看整页灰度截图（网页）或灰度图（海报），只看首屏以下的部分，写结论和截图路径。认不出时，写清首屏以下靠什么撑着、缺了什么。
2. **文法能否指导出不同于普通模板的作品？** 哪几条文法真正决定了版面，哪些地方只能自己推。
3. **哪一步最耗时？** 写步骤名和大致时间。
```

## 终审评审者的提示词

制作代理交付后，另起一个空白上下文的评审者复查网页，不让它看到 process.md：

```text
你是空白上下文的界面评审者。不要修改任何文件；截图和临时脚本写到 <临时目录>。

评审对象：<产物目录>/web/index.html。只读这些材料：
- Brief：<制作代理写下的 Brief 文件，或请求原文>
- 风格：同目录 style.md，以及 facts.txt
- 评审方法与底线：plugins/musekit/references/critique.md
- 媒介清单：plugins/musekit/skills/web-design/SKILL.md 第 5 步「评审」里「本媒介的清单」，以及 plugins/musekit/skills/web-design/references/methods.md
不要读 process.md 或产物目录以外的其他文件。

做法：
1. 在仓库根目录运行插件的检查脚本：node plugins/musekit/scripts/inspect_page.mjs <index.html> --out <临时目录> --facts <facts.txt>。
2. 自己走主任务：空提交看出错 → 补全提交 → 完成态，键盘也走一遍；看导航锚点跳转后的落点。
3. 按 Brief、style.md 的文法和本场景适配、critique.md 的底线和媒介清单逐条判断。

输出（600 字以内）：先给结论「有主要问题 / 没有主要问题」，再列主要问题（会让读者读错、做不成主任务、或明显违反 style.md 的规则，每条写出依据的规则原句和截图路径）和次要问题。不要提与规则无关的审美偏好。
```

## 辨识度对照

把盲测的海报和首页，与最接近的库内 Template 的同类作品放在一起，去色、去阴影后并排：

```bash
node docs/musekit/compare.mjs <输出目录> 新风格=<产物目录>/poster/poster.html@1080x1440 <对照风格>=<对照海报>@1080x1440 新风格首页=<产物目录>/web/index.html <对照风格>首页=<对照首页>
```

对照作品优先用那个 Template 随插件分发的制作示例（`skills/graphic-design/references/examples/`、`skills/web-design/references/examples/`）；没有示例时，用同一份标准 Brief 给它也做一次盲测。脚本输出每件作品的灰度截图和并排的 `compare.png`。

判断：只看灰度对照图，能不能一眼分开两种风格，各自靠什么认出（网格、尺度、对齐、留白、装置）。分不开时回到 `style-builder` 的「写精神与文法」。

## 交给用户验收

把样张、盲测的海报和首页（含灰度整页）、`compare.png`，以及摩擦里改过的风格条目一起交给用户目视。用户确认后，才把 Template 的 `status` 改为 `verified`。
