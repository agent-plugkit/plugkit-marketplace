---
id: veil-blur
category: depth
nature: value
name: 贴在照片上的纱
status: draft
scenes: [graphic, web]
affinity: [veiled-frame]
conflicts: [hard-shadow, frosted-glass]
tokens:
  veil-filter:
    value: "blur(24px) saturate(1.1)"
    role: 纱面唯一的模糊值
  shadow:
    value: none
    role: 纱面不投影
---

# 贴在照片上的纱

## 要点

- 纱面和照片在同一平面：不投影，不加描边和顶边高光，边缘就是一条干净的直线。
- 纱面下的照片仍然看得出形状和明暗，只是被虚化、提亮或压暗；模糊不够时文字会和照片打架，不要低于 16px。
- 深度只有两层：照片和纱面。纱面里不再套纱面或卡片，分组靠留白。
- 不支持模糊或用户要求减少透明度时，纱面退为 `paper` 不透明面，位置和文字不变。
- 网页入场动画只动纱面的 opacity 与 transform，不动 filter。

## 适用与边界

海报是静态位图，纱面要在导出前由浏览器渲染出来；导出后放大检查纱面边缘是否干净。模糊对大面积纱面在低端手机上耗电，网页里同一屏只有一块纱面。
