---
id: density-tiles
category: data-encoding
nature: rule
name: 密度方块
status: draft
scenes: [graphic, web]
affinity: [frosted-grid]
conflicts: []
---

# 密度方块

## 要点

- 数据的最小单位是一个网格方块：热力图格 22px、3px 圆角，五级为空 / `·` / `:` / `x` / `#`，填充从淡墨洗到实墨；值不只靠颜色，字形同时编码密度。
- 进度是一行等宽小格（默认 40 格、2px 间隙、1px 圆角），已填格用墨或状态色，未填为淡墨洗。
- 分类分布条是一行着色方块，类别依次用 `tile-slate`、`tile-ochre`、`tile-lavender`、`tile-sage`，最多四类，旁边用文字标签和等宽数字。
- 每个数据图形旁边都有文字或数字说明，不只给图形。

## 适用与边界

这些是小型数据图形，放在海报或落地页的玻璃面板里；需要正式图表时不在本风格的范围内（未声明 `data` 场景）。
