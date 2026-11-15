---
id: asymmetric-modular
category: grid
nature: rule
name: 不对称模块网格
status: draft
scenes: [graphic, web, slides, diagram, data]
affinity: [neo-swiss, swiss, editorial]
conflicts: [centered-symmetric]
tokens:
  canvas-width:
    value: 1440px
    role: 参照画布宽度：网页是参照视口宽，平面是画布宽
  canvas-height:
    value: 900px
    role: 参照画布高度：网页是首屏高度，平面是画布高度
  columns:
    value: 12
  gutter:
    value: 24px
  margin:
    value: 64px
---

# 不对称模块网格

## 要点

- 所有元素的起止边落在栏线上；文字块的左边缘共享少数几条竖轴，最强的一条在左侧。
- 主体占 7–9 栏，辅助信息落在剩下的窄栏；不让主体居中，不做左右镜像。
- 跨栏的宽度差表达主次：最重要的内容跨得最宽，并非所有区块等宽。
- 留白是空着的网格单元，有明确的起止；不是把四周边距放大。
- 文字齐左不齐右；跨栏的相邻文字块尽量共享基线。

## 适用与边界

网格是组织工具，不要求把栏线画出来。只有当栏线本身帮助阅读（如分隔列表、元数据表）时才显示为细线。
