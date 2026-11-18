---
id: news-serif
category: typography
nature: value
name: 报刊宋体
status: draft
scenes: [graphic, web, data]
affinity: [broadsheet]
conflicts: []
tokens:
  font-display:
    value: Noto Serif SC
    role: 主题：粗宋，中西文都用它
  font-text:
    value: Source Serif 4
    role: 西文正文；中文正文落到 font-cjk 的宋体
  font-cjk:
    value: Noto Serif SC
    role: 中文正文与标题
  font-label:
    value: Noto Sans SC
    role: 引题、副题、栏目名、报眉、图注和表单标签：黑体
  font-mono:
    value: IBM Plex Mono
    role: 期号、时间表里的数字
  weight-display:
    value: 700
  weight-text:
    value: 400
  weight-strong:
    value: 600
  size-masthead:
    value: 64px
    role: 报头里的刊名，不超过头条主题
  size-display:
    value: 88px
  size-headline:
    value: 48px
  size-title:
    value: 28px
  size-body:
    value: 17px
  size-meta:
    value: 13px
  leading-display:
    value: 1.1
  leading-display-cjk:
    value: 1.15
  leading-headline:
    value: 1.2
  leading-title:
    value: 1.3
  leading-body:
    value: 1.7
  tracking-display:
    value: "0"
  tracking-meta:
    value: "0.04em"
---

# 报刊宋体

## 要点

- 主题（每条稿件的大标题）用粗宋 `font-display` 与 `weight-display`；正文用常规宋体，西文落到 `font-text`。
- 引题、副题、栏目名、报眉和图注用黑体 `font-label`，比主题小一档以上；黑体与宋体的对比是标题组的层次之一。
- 字重只用两档：标题粗、正文常规。`weight-strong` 只给正文里的小标题和表格表头。
- 正文两端对齐，中文段首缩进两字（`text-indent: 2em`），行距 `leading-body`。时间、期号这类纯数字可以用 `font-mono` 按位对齐；含中文的值用正文字体。

## 适用与边界

每行少于 10 个汉字的窄栏里，两端对齐会被避头尾的标点和长西文单词撑出大空隙：这样的栏里正文改为齐左，10 个汉字及以上保持两端对齐；西文段落另开 `hyphens: auto` 并设 `lang`。宋体在 12px 以下发虚，`size-meta` 只给期号、图片署名和网页上的示例声明这类短标注。
