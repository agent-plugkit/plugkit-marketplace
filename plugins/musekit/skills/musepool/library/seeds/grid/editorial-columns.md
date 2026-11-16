---
id: editorial-columns
category: grid
nature: rule
name: 中轴与编辑栏
status: draft
scenes: [graphic, web, slides, data]
affinity: [editorial-serif, editorial]
conflicts: [ma-interval, index-and-rule, sticker-label]
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
    value: 32px
  margin:
    value: 96px
  axis-tolerance:
    value: 0.02
    role: 轴上每一行的中点离所在版面中轴的最大偏差，按版面宽度计
---

# 中轴与编辑栏

## 要点

- 标题组排在一条中轴上：栏目或刊名、标题、导语、署名或关键事实逐行居中，每行中点离中轴不超过 `axis-tolerance`。中轴是整个版面的中线；对开构图（一半文字、一半满幅图像）时，是文字半区的中线。
- 版面像一张扉页，有天头和页脚：标题组在上部，版权行（日期 · 地点 · 主办）压在页脚，同样居中在轴上；两者之间是安静的空白，或一张居中的图像。
- 正文、列表、日程、表单一律齐左，正文栏本身在版面里居中摆放。居中只给标题组、版权行和少数单独的短行（主操作、引文、栏目名）。
- 正文栏宽控制在每行 60–70 个西文字符或 28–36 个汉字，通常占 6–7 栏；旁注、图注放在正文栏外侧的窄栏，与对应段落顶部对齐。
- 图像要么跨满正文栏，要么出血到版面边缘（对开构图的一半也算出血），不做中间宽度。

## 适用与边界

居中只给短行：每一组不超过三行，超过三行的文字不居中。需要并排比较的内容（日程、价格）可以打破正文栏宽，但仍对齐到栏线上。海报和首屏不排正文段落，只有标题组和版权行。
