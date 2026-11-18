---
id: thick-border
category: shape
nature: value
name: 粗边框
status: draft
scenes: [graphic, web, slides]
affinity: [neo-brutalism]
conflicts: []
tokens:
  radius:
    value: 0px
    role: 全部直角：拼板墙的板要直接相接，圆角会在接缝处留下缺口
  rule-width:
    value: 3px
    role: 板、按钮、输入框的边框；相接的板共用一条
  rule-state:
    value: 4px
    role: 焦点框与出错字段，比边框更粗
  focus-offset:
    value: 4px
    role: 焦点框与元素边框之间的间隙
  rule-heavy:
    value: 6px
    role: 分区的粗分隔线
---

# 粗边框

## 要点

- 所有板、按钮、输入框、图片都有 `rule-width` 黑色实线边框；边框是风格的骨架。相接的两块板只画一条线，不叠成双线；网页上出血到视口边缘的那一侧不画边框。
- 全部直角，不用胶囊形按钮。
- 焦点框用 `rule-state` 黑线，与元素边框隔开 `focus-offset`，保证在色块上也清楚可见；出错字段的边框同样加粗到 `rule-state`。

## 适用与边界

边框围起来的是内容单元，不要给每一行文字都加框。分区的粗分隔线 `rule-heavy` 只用在两面墙之间。
