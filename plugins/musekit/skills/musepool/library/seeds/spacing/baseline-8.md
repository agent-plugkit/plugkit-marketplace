---
id: baseline-8
category: spacing
nature: value
name: 基线节奏
status: draft
scenes: [graphic, web, slides, diagram, data]
affinity: [neo-swiss, swiss, editorial, minimal, japanese-ma, editorial-serif, mono-print, neo-brutalism]
conflicts: []
tokens:
  space-unit:
    value: 8px
  space-scale:
    value: [4, 8, 16, 24, 32, 48, 64, 96, 128, 192]
    role: 像素值；相邻组之间至少跳一级
---

# 基线节奏

## 要点

- 所有间距取自阶梯，不使用阶梯之外的值；组内间距与组间间距至少相差一级，让分组一眼可见。
- 大段留白取阶梯上端（96 以上），用来分开章节，而不是在每个元素之间平均分配。
- 跨栏的相邻文字块使用相同的行高，让它们共享基线。
- 章节之间更大的间隔以一屏高度（`canvas-height`）为单位，例如半屏或一屏，不必取自阶梯。

## 适用与边界

基于 8px 的阶梯适用于大多数媒介；海报等固定画布可按画布宽度等比放大整条阶梯，保持比例不变。
