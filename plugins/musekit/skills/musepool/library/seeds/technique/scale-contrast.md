---
id: scale-contrast
category: technique
nature: rule
name: 尺度反差
status: draft
scenes: [graphic, web, slides]
affinity: [neo-swiss, swiss, neo-brutalism]
conflicts: []
tokens:
  ratio-adjacent:
    value: 2
    role: 展示层级（display → headline → title）中相邻两级的最小字号比
  ratio-display:
    value: 5
    role: 展示字与正文的最小字号比
---

# 尺度反差

## 要点

- 层级首先由字号差建立：展示层级（display、headline、title）相邻两级至少差一倍，展示字至少是正文的五倍。正文与元数据之间靠字体和颜色区分，不受这个比例约束。窄屏可以放宽这两个比例，但展示字仍要明显大于其他所有文字。
- 一个版面只有一个最大的东西；它可以大到触及栏界甚至被画布裁掉一部分，但核心字形必须可辨。「一个版面」指海报的一页、演示文稿的一页，或网页的一屏（`canvas-height`）。
- 大与小之间保持明显的空白，让反差被看见；小字聚成整齐的块，不散落在大字周围。

## 适用与边界

界面中的重复条目（列表、表格）保持稳定的小字号，反差只用在页面主题与章节入口。
