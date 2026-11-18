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
    role: 按钮与贴片的实心错位阴影
  shadow-hover:
    value: "8px 8px 0 0 #0A0A0A"
    role: 悬停时加长的阴影
  shadow-press:
    value: "2px 2px 0 0 #0A0A0A"
    role: 按下时的阴影：元素同时向右下移动 4px
---

# 硬阴影

## 要点

- 阴影是不模糊的黑色实心块，向右下错开，让按钮和贴片像贴纸一样浮起来。
- 交互时用阴影表达状态：悬停时加长到 `shadow-hover`，按下时缩短到 `shadow-press`，元素朝阴影方向移动同样的距离。
- 同一页里所有阴影方向和距离一致。

## 适用与边界

阴影只给按钮等可交互元素和压缝贴片。拼板墙里相接的板不带阴影，否则接缝会变成一排浮起的卡片；海报可以给整面墙的外缘加一道阴影。所有东西都有阴影时，就没有东西浮起来了。
