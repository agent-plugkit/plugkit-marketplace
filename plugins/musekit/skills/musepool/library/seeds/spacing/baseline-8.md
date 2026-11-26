---
id: baseline-8
category: spacing
nature: value
name: 基线节奏
status: draft
scenes: [graphic, web, slides, diagram, data]
affinity: [neo-swiss, swiss, editorial, minimal, japanese-ma, editorial-serif, mono-print, neo-brutalism, broadsheet, veiled-frame, dark-stage]
conflicts: []
tokens:
  space-unit:
    value: 8px
  space-scale:
    value: [4, 8, 16, 24, 32, 48, 64, 96, 128, 192]
    role: 像素值；相邻组之间至少跳一级；4 只用于组件内部
---

# 基线节奏

## 要点

- 元素之间、组之间的间距和 `margin`、`gutter` 都取自阶梯，不用阶梯之外的值；组内与组间至少相差一级，让分组一眼可见。4 只用于组件内部，例如图标与文字、标签的内边距。
- 大段留白取阶梯上端（96 以上），用来分开章节，而不是在每个元素之间平均分配。
- 固定画布上，区块的起点从内容区的起点（外边距、边框和内边距之内）量起，落在 8 的倍数上；网页的区块按内容撑高，不逐一核对起点，只要求间距取自阶梯。跨栏的相邻文字块使用相同的行高，让它们共享基线。行高本身不要求是 8 的倍数。
- 唯一的例外是章节之间的大间隔：按实际视口高度计，例如半屏到一屏；风格可以收窄这个范围。

## 适用与边界

基于 8px 的阶梯适用于大多数媒介。海报等固定画布同样取自阶梯，不等比放大；需要更大的间距时取阶梯上端。
