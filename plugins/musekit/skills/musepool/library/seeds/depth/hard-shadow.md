---
id: hard-shadow
category: depth
nature: value
name: 硬阴影
status: draft
scenes: [graphic, web, slides]
affinity: [neo-brutalism]
conflicts: []
tokens:
  shadow:
    value: "6px 6px 0 0 #0A0A0A"
    role: 块面与按钮的实心错位阴影
  shadow-press:
    value: "2px 2px 0 0 #0A0A0A"
    role: 按下时的阴影：块面同时向右下移动 4px
---

# 硬阴影

## 要点

- 阴影是不模糊的黑色实心块，向右下错开，让块面像贴纸一样浮起来。
- 交互时用阴影表达按压：按下时阴影变短，块面朝阴影方向移动同样的距离。
- 同一页里所有阴影方向和距离一致。

## 适用与边界

阴影只给可交互的元素和最重要的卡片；所有东西都有阴影时，就没有东西浮起来了。
