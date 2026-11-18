---
id: compact-4-extended
category: spacing
nature: value
name: 紧凑 4 阶梯
status: draft
scenes: [graphic, web]
affinity: [frosted-grid]
conflicts: []
tokens:
  space-unit:
    value: 4px
  space-scale:
    value: [4, 8, 12, 16, 20, 24, 32, 48, 64, 96, 128]
    role: 像素值；24 及以下取自来源应用，32 以上沿用 baseline-8 的上端
  panel-padding:
    value: 20px
    role: 玻璃面板内距
---

# 紧凑 4 阶梯

## 要点

- 面板内的元素间距取 4–24：图标与文字 4–8，同组行 8–12，玻璃面板内距 `panel-padding`。
- 玻璃面板之间留 16–24，让底面的方格和像素场从缝里露出来；这道缝就是层次，不用阴影或分隔线代替。
- 32 以上只用在章节之间和画布边距，取阶梯上端；不平均撒在元素之间。
- 控件高度 28 / 32 / 40px（小 / 中 / 大）。

## 适用与边界

来源应用的阶梯只到 24px（4 / 8 / 12 / 16 / 20 / 24），够桌面应用用，不够海报与网页的边距和章节间隔；32 / 48 / 64 / 96 / 128 沿用库内 `baseline-8` 的上端。
