# Musekit

设计风格库与按场景制作成品的工作流。风格库描述风格，工作流负责制作。

## 风格库

**Seed**：
按设计元素（配色、字体、网格、间距、手法等）分类的可复用单元。值型 Seed 给出可以直接用的值，规则型给出做法。
_Avoid_: 原子、token 包

**Template**：
由 Seed 组合成的一套风格，写明精神、文法、各场景适配和常见误用。行文里说「风格」时，指的就是 Template。
_Avoid_: temp、主题、皮肤、theme

**库内 Template**：
随插件分发、放在官方风格库里的 Template（`source: library`），只有它能升为 verified。
_Avoid_: 官方风格、内置主题

**用户 Template**：
按用户的品牌、项目或参考整理出的 Template（`source: user`），放在用户自己的项目或作品目录里，按路径使用，不进官方风格库。
_Avoid_: 自定义主题、私有风格

**混搭 Template**：
用 `compose` 把几个 Seed 临时组合成的 Template（`source: composed`）。
_Avoid_: 混合风格

**Precedent**：
一件真实作品的拆解记录，作为 Template 的范例，只提供方法。
_Avoid_: 参考作品、案例

## 新增 Template

**从零创建**：
用户只有一个方向或一个风格名，由 Agent 陪同调研、写文法、选或建 Seed，得到一套新的 Template。
_Avoid_: 原创风格、新建主题

**项目提取**：
从一个已有的网站、代码库、设计系统或一组作品里归纳出 Template。
_Avoid_: 逆向、抄风格、品牌导入

**提取报告**：
项目提取时落成 Template 之前的中间稿，把每个值分成取到的（附出处）、推断的（附依据）和缺口三类，经用户确认后才写 Template。
_Avoid_: 分析报告、审计

**用户风格目录**：
用户项目里存放一套用户 Template 的固定位置：`musekit/<id>/`，内含 Template、用户 Seed 和样张。
_Avoid_: 主题目录、本地风格库

**标准 Brief**：
每个场景一份固定的虚构内容和事实清单，新 Template 都用它试做，结果可以横向比较。
_Avoid_: 测试题、样例需求

**盲测**：
由只读 Skill 文档的空白上下文代理按标准 Brief 制作，实测耗时并记录摩擦，用来检验文档和风格是否自足。
_Avoid_: tracer、试跑

**辨识度对照**：
把作品去色、去阴影后，与最接近的库内 Template 的同类作品并排，看能否一眼分开。
_Avoid_: 去样式测试

## 制作

**场景**：
作品的媒介类别，共五个：`graphic`、`web`、`slides`、`diagram`、`data`。
_Avoid_: 媒介、类型

**跟随系统深浅色**：
风格同时有 `light` 和 `dark` 两个变体时，网页按系统设置在浅色和深色之间切换；`style.md` 的 frontmatter 写 `variant: auto`。
_Avoid_: 暗黑模式、主题切换、dark theme

**场景适配**：
Template 写给某一个场景的具体做法，优先于通用文法。
_Avoid_: 场景规则

**未验证适配**：
Template 声明了某个场景却没写它的场景适配时的解析结果，由工作流按文法推导，并在交付里写明推导了哪些决定。
_Avoid_: 默认适配

**style.md**：
musepool 把一个 Template 按某个场景解析出的文件，工作流只读它，不直接读风格库。
_Avoid_: 主题文件、样式表

**机检**：
Seed 或 Template 声明的、检查脚本能量化的版式规则（如字面宽、面积、压入比例、文字底下的亮度），解析进 `style.md` 的「机检」一节。作品按其中的角色给元素加 `data-mk`，`inspect_page.mjs` 量出数值写进摘要；没有列进机检的规则仍靠目视或自己量。
_Avoid_: 自动验收、lint

**Workflow**：
一个场景的制作流程，例如 graphic-design、web-design、data-figure。
_Avoid_: 制作 Skill、管线
