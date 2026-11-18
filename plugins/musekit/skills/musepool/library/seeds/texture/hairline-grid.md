---
id: hairline-grid
category: texture
nature: value
name: 发丝方格底面
status: draft
scenes: [graphic, web]
affinity: [frosted-grid]
conflicts: []
tokens:
  grid-size:
    value: 10px
    role: 方格单元，也是像素场和数据方块的单位
---

# 发丝方格底面

## 要点

- 底面铺满 `grid-size` 的发丝方格，线色 `grid-line`（浅色约 4.5% 墨，深色约 4% 白）：`linear-gradient` 横竖各一层，叠在 `paper` 上。
- 方格上零散有几段静止短划，像方块团漂过留下的痕迹；数量少，不成图案。
- 方格只出现在底面，不进入按钮、输入框或文字背景；玻璃面板会把它虚化。
