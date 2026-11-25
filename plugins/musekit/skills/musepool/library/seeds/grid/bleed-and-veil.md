---
id: bleed-and-veil
category: grid
nature: rule
name: 出血照片与一块锚定的纱面
status: draft
scenes: [graphic, web]
affinity: [veiled-frame]
conflicts: []
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
    role: 平底段落的外边距；照片和纱面都出血，不受它约束
  veil-padding:
    value: 48px
    role: 纱面内距，文字从这里起排
  veil-min:
    value: 0.2
    role: 纱面占画框面积的下限
  veil-max:
    value: 0.45
    role: 纱面占画框面积的上限
---

# 出血照片与一块锚定的纱面

## 要点

- 照片满幅出血，是画框的底；不裁成小图框，不留白边。
- 每个画框只有一块纱面，面积在 `veil-min` 和 `veil-max` 之间。纱面至少一条边出血到画框边缘，其余边落在栏线上；不做四边都不碰画框的悬浮面。
- 纱面的形状是矩形，位置跟着照片的安静区：竖条（跨 3–5 栏，出血到上下两边）、横带（跨满宽，出血到左右两边）、角块（出血到相邻两边）、半幅。这些是举例，不是封闭清单。
- 纱面不压主体的脸和运动的拖影；照片的主体落在裸露区。
- 纱面里的文字分两组：上组钉在纱面的起始端，下组钉在末端，中间留空。横带时两组分在左右两端。

## 适用与边界

画框是一件作品的一个画面：一张海报、一张卡片、网页的首屏或一章的开头。长正文和表单不进画框，排在其后的平底段落里，正文栏 6–7 栏、外边距 `margin`。窄屏上竖条放不下巨字时，改成贴着下边的横带。
