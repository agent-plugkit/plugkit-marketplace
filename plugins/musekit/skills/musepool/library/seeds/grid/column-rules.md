---
id: column-rules
category: grid
nature: rule
name: 栏线分栏
status: draft
scenes: [graphic, web, data]
affinity: [broadsheet]
conflicts: [off-center-void, ma-interval, editorial-columns, panel-wall]
tokens:
  canvas-width:
    value: 1440px
    role: 参照画布宽度：网页是参照视口宽，平面是画布宽
  canvas-height:
    value: 900px
    role: 参照画布高度：网页是首屏高度，平面是画布高度
  columns:
    value: 6
  gutter:
    value: 24px
  margin:
    value: 48px
---

# 栏线分栏

## 要点

- 版心等分成 `columns` 栏，栏与栏之间在栏距正中画一条 `rule-width` 的墨色竖线，这条线就是栏线。栏线从一行稿件的顶端画到底端，遇到通栏横线时断开。
- 每条稿件是一个矩形块，跨 1 到若干栏，四边落在栏线和横线上。稿件之间用一条 `rule-width` 的横线分开，横线两侧各留一个栏距，不留成块的空白。
- 版面的分量自上而下递减：头条在上半版、左上为先；短讯和日程排在下半版或最右一栏。
- 稿件的正文在稿件所跨的栏里分栏续排（CSS `column-count` 等于跨栏数，`column-gap` 等于 `gutter`，`column-rule` 用栏线）；一栏排满再转下一栏，不让某一栏空出一大截。
- 版面要排满。内容少时减少栏数或让稿件跨更多栏，不留空栏，也不编造稿件。

## 适用与边界

窄屏退到 2 栏；放不下两栏（每栏少于约 8 个汉字）时退成 1 栏，栏线改成稿件之间的横线，其余规则不变。数据图在一个稿件块里，图框的宽度对齐稿件跨的栏。
