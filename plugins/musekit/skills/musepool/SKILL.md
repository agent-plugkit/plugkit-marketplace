---
name: musepool
description: 搜索、比较本地设计参考并提炼 Markdown seed 简报。用于寻找灵感、探索视觉方向、比较参考或把设计灵感交给其他 Agent；覆盖界面、平面和信息表达，不负责制作最终作品。
---

# Musepool

从真实的设计先例中找到值得借鉴的细节，把它们解释成当前任务可用的灵感。库内有 29 个 seed，包含布局、字体、颜色、图像、交互与工艺的具体记录；部分附代码级参考。检索完全在本地进行。

## 查找参考

下面示例以本 Skill 目录为工作目录。从其他目录调用时使用脚本的实际路径；脚本会自行定位 seed 库：

```bash
python3 scripts/muse_local.py list --scenario ui
python3 scripts/muse_local.py list --scenario graphic
python3 scripts/muse_local.py search "number density hierarchy"
python3 scripts/muse_local.py search "annotation" --scenario information
python3 scripts/muse_local.py show mC1nkP2t
```

| 分类 | 主要借鉴问题 |
| --- | --- |
| `ui` 界面 | 导航、交互、组件组织、响应式层级 |
| `graphic` 平面 | 字图关系、视觉焦点、色彩、材质；包含海报、封面和社媒图 |
| `information` 信息表达 | 信息密度、标注、阅读顺序、解释方法 |

分类是检索入口。一个 seed 可以为不同制作 Skill 提供不同维度的启发，无需先用尽某一分类。[场景指南](references/scenarios.md)列出全部参考与适用边界。

## 广搜 → 取深 → 提炼

1. 从目标、受众、内容和已有约束判断最需要解决的设计问题。已有品牌或用户指定的方向是前提，不为使用种子而推翻它。
2. 先看候选摘要，再深读通常 1–3 个最有价值的参考。可按问题、风格或用户指定线索搜索；命中少时换词或跨分类搜索。
3. 用 `show` 阅读正文和相关的 `Dimensional References`。保留真正有价值的工艺细节，例如字重关系、颜色职责、阅读节奏或交互反馈，解释它为何适合任务。
4. 按[seed 简报示例](../../references/seed-brief.md)输出自包含的 Markdown：来源、借什么、如何适配，以及哪些部分需要下游重新设计。交接方不必读取库内文件才能理解。

没有匹配参考时说明缺口，不拼凑弱匹配，也不把自己新想出的做法写成检索结果。用户已有参考时可直接交给制作 Skill；不要求把它先收录进本地库。

## 参考的分寸

- seed 记录的是原参考的方法。具体色值、字体和代码帮助理解工艺，是否采用取决于当前场景；布局和技术栈由制作层重新决定。原文中的约束快照或 JSON 示例也只是参考细节，不是 Musekit 的交接格式或执行契约。
- 分清参考中的视觉形式与事实内容。照片中的身份、页面文案、指标、科学结论和品牌不能作为当前作品的内容来源。
- 将条件写在建议旁边。例如“双色印刷时每块印版各司其职”，而不是要求所有界面和数据图都只用两种颜色。
- 可以组合多个参考的不同长处；遇到用户明确要求冲突时把取舍讲清楚，普通设计选择由制作 Skill 判断，不做数字优先级或锁定状态计算。

## 交付与接续

交付 seed 简报即可。用户同时要求成品时，继续由对应 Skill 制作：`ui-design`、`graphic-design`、`diagram-design` 或 `scientific-figure`。纯灵感请求不扩展成制作任务。

保留参考的真实名称或来源，避免大段粘贴原文。只有原始记录提供了作者、URL 或许可时才填写这些信息。第三方说明见[来源与许可](references/third-party-notices.md)。
