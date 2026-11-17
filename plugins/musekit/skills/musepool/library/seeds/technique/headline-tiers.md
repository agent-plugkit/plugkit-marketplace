---
id: headline-tiers
category: technique
nature: rule
name: 标题分档
status: draft
scenes: [graphic, web, data]
affinity: [broadsheet]
conflicts: [scale-contrast]
tokens:
  ratio-adjacent:
    value: 1.6
    role: 展示层级（display → headline → title）中相邻两档的最小字号比
  ratio-display:
    value: 4
    role: 头条主题与正文的最小字号比
---

# 标题分档

## 要点

- 一版至少三档标题：头条用 `size-display`，跨 2 栏及以上的其余稿件用 `size-headline`，只占 1 栏的短讯用 `size-title`。档位与跨栏数绑定，同一档的标题用同一个字号。刊名不算一档，字号不超过头条。
- 头条只有一条。主题字号不用 `fit` 撑满栏宽，而是取本档字号，太长时在所跨的栏里断成两到三行。主题只有两三个字、填不满头条块的宽度时，不改写主题：把引题、副题或导语排在主题旁边，或者让头条少跨一栏，把多出的栏给数据框。
- 1 栏短讯的主题按 `size-title` 每行只放得下四五个字，标题要短；日期、地点这类长事实放在跨 2 栏以上的稿件或报眉里。
- 每条稿件的标题组由引题、主题、副题组成：引题在主题上方，交代背景；副题在主题下方，补充要点。引题、副题用 `font-label`，比主题小至少一档，淡墨；短讯只有主题。
- 标题组在自己的稿件块里齐左。头条的标题组可以在块内居中，但一版只能选一种做法。
- 层级只靠档位和跨栏宽度建立，不靠颜色；标题一律墨色。

## 适用与边界

内容只够两条稿件时，第三档由短讯或日程条目承担，仍然要看得出三档。窄屏可以把相邻两档的比例放宽到断点里的 `ratio-adjacent`，但头条仍要明显大于其他所有标题。
