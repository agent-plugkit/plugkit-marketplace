---
id: two-plate
category: color
nature: value
name: 双色印版
status: draft
scenes: [graphic, web, slides]
affinity: [mono-print]
conflicts: []
tokens:
  paper:
    value: "#FAFAF7"
    role: 中性白纸面：纸不是印版，但它是构图的一部分
  ink:
    value: "#2148B8"
    role: 主印版：承担 70%–85% 的印刷面积，包括正文
  accent:
    value: "#C65F38"
    role: 副印版：只做一件事，例如日期、注释或一处叠印
  on-accent:
    value: "#FAFAF7"
    role: 副印版色块上的反白大字
variants:
  cobalt-terracotta:
    ink: "#2148B8"
    accent: "#C65F38"
  charcoal-red:
    ink: "#30343A"
    accent: "#C83232"
  oxblood-green:
    ink: "#8F3434"
    accent: "#008A4B"
  ultramarine-orange:
    ink: "#263E99"
    accent: "#E55D2B"
pairs:
  - [ink, paper, body]
  - [paper, ink, body]
  - [accent, paper, large]
  - [on-accent, accent, large]
---

# 双色印版

## 要点

- 只有两种油墨：主印版承担大部分画面和全部正文，副印版只做一件事；纸色露出来，是第三种「颜色」。
- 浓淡靠网点密度变化，而不是添加第三种颜色；两版叠印处变深是自然结果，不算第三种墨。
- 变体是四组经典的双色配方；也可以只用主印版做单色作品，此时副印版不出现。

## 适用与边界

不加渐变、彩虹色和全彩照片。选择这一方向时才引入印刷质感；需要大量彩色信息编码的数据图不适合。
