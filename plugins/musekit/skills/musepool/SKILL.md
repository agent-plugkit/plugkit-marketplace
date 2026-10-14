---
name: musepool
description: 搜索、比较本地设计参考并提炼 Markdown seed 简报。用于寻找灵感、探索视觉方向、比较参考或把设计灵感交给其他 Agent；覆盖界面、平面和信息表达，不负责制作最终作品。
---

# Musepool

从真实的设计先例中找到值得借鉴的细节，把它们解释成当前任务可用的灵感。seed 库来自独立维护的 [Muspro Seeds](https://github.com/agent-plugkit/muspro-seeds)，记录布局、字体、颜色、图像、交互与工艺的具体做法；部分附代码级参考。检索完全在本地进行。

## 查找参考

下面示例以本 Skill 目录为工作目录。从其他目录调用时使用脚本的实际路径；脚本会自行定位 seed 库：

```bash
python3 scripts/muse_local.py list --scenario ui
python3 scripts/muse_local.py list --scenario graphic
python3 scripts/muse_local.py search "dense dashboard"
python3 scripts/muse_local.py search "data visualization" --scenario information
python3 scripts/muse_local.py search "深色仪表盘"
python3 scripts/muse_local.py show mC1nkP2t
python3 scripts/muse_local.py status
```

Skill 内置一份锁定版本的 seed 快照，离线即可检索；`list`、`search` 首行注明当前来源与版本，`show` 把它写到 stderr。查找顺序为环境变量 `MUSEPOOL_SEEDS_DIR` 指向的目录、本机缓存、内置快照；正常直接运行脚本，由它按这个顺序选库。`MUSEPOOL_SEEDS_DIR` 只用于指向自定义 seed 库，不要把它设成本 Skill 的 `seeds/` 来“只用本地库”：本机缓存本来就在本地，这样设反而会跳过缓存里更新的版本，脚本会就此警告。用户想获取新 seed 时运行 `update`：它从 Muspro Seeds 的 GitHub Release 下载并校验，失败时不改动当前库。禁网环境把 Release 中的 tar.gz 与 `manifest.json` 一起下载到同一目录，再用 `update --from <tar.gz>` 安装；缺少对应 manifest 时拒绝安装。`update --rollback` 切回上一版缓存。普通检索不需要先更新。

seed 正文是英文，检索以英文为主。搜索前先把用户场景改写成带上下文的英文短语，例如酒吧官网写 "cocktail bar website" 而不是 "bar"；可以换几组说法分别搜索。所有词都命中、且至少一个命中在摘要、分类、标签或维度上的结果标 ★ 并排在最前，其后未标 ★ 的弱匹配不是可靠参考；没有任何可靠命中时不列出条目，脚本会提示“没有找到可靠参考”。

中文查询会按 `scripts/zh_terms.json` 把常见的场景、媒介、风格和维度词展开为英文检索词，并同时匹配库内的中文标题与摘要；有词表展开时，输出第二行列出展开结果。词表只是方便，只保留常用、歧义较少的词，不保证消歧；多义词（酒吧、菜单、目录等）不展开，提示未收录时改用英文短语。

| 分类 | 主要借鉴问题 |
| --- | --- |
| `ui` 界面 | 导航、交互、组件组织、响应式层级 |
| `graphic` 平面 | 字图关系、视觉焦点、色彩、材质；包含海报、封面和社媒图 |
| `information` 信息表达 | 信息密度、标注、阅读顺序、解释方法 |

分类是检索入口。一个 seed 可以为不同制作 Skill 提供不同维度的启发，无需先用尽某一分类。[场景指南](references/scenarios.md)列出内置快照中的参考与适用边界。

## 广搜 → 取深 → 提炼

1. 从目标、受众、内容和已有约束判断最需要解决的设计问题。已有品牌或用户指定的方向是前提，不为使用种子而推翻它。
2. 先看前几个候选的摘要，自行判断是否真的对题，再深读通常 1–3 个最有价值的参考。★ 只说明检索词命中可靠，不保证词义相符；可按问题、风格或用户指定线索搜索，命中少时换词或跨分类搜索。
3. 用 `show` 阅读正文和相关的 `Dimensional References`。保留真正有价值的工艺细节，例如字重关系、颜色职责、阅读节奏或交互反馈，解释它为何适合任务。
4. 按[seed 简报示例](../../references/seed-brief.md)输出自包含的 Markdown：来源、借什么、如何适配，以及哪些部分需要下游重新设计。交接方不必读取库内文件才能理解。

换过几组说法仍没有可靠参考时如实说明缺口，不拼凑弱匹配，也不把自己新想出的做法写成检索结果。用户已有参考时可直接交给制作 Skill；不要求把它先收录进本地库。

## 参考的分寸

- seed 记录的是原参考的方法。具体色值、字体和代码帮助理解工艺，是否采用取决于当前场景；布局和技术栈由制作层重新决定。原文中的约束快照或 JSON 示例也只是参考细节，不是 Musekit 的交接格式或执行契约。
- 分清参考中的视觉形式与事实内容。照片中的身份、页面文案、指标、科学结论和品牌不能作为当前作品的内容来源。
- 将条件写在建议旁边。例如“双色印刷时每块印版各司其职”，而不是要求所有界面和数据图都只用两种颜色。
- 可以组合多个参考的不同长处；遇到用户明确要求冲突时把取舍讲清楚，普通设计选择由制作 Skill 判断，不做数字优先级或锁定状态计算。

## 交付与接续

交付 seed 简报即可。用户同时要求成品时，继续由对应 Skill 制作：`ui-design`、`graphic-design`、`diagram-design` 或 `scientific-figure`。整篇文章的配图编排交给 `article-illustration`。纯灵感请求不扩展成制作任务。

保留参考的真实名称或来源，避免大段粘贴原文。只有原始记录提供了作者、URL 或许可时才填写这些信息。第三方说明见[来源与许可](references/third-party-notices.md)。
