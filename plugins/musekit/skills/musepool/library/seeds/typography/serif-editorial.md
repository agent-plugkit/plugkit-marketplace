---
id: serif-editorial
category: typography
nature: value
name: 编辑衬线
status: draft
scenes: [graphic, web, slides, data]
affinity: [editorial-serif]
conflicts: []
archetype: Tiempos Text
tokens:
  font-display:
    value: Source Serif 4
    role: 西文标题与展示字
  font-text:
    value: Source Serif 4
    role: 西文正文；导语与引文用斜体
  font-cjk:
    value: Noto Serif SC
    role: 中文全部层级
  font-mono:
    value: IBM Plex Mono
    role: 日期、页码与元数据
  weight-display:
    value: 600
  weight-text:
    value: 400
  weight-strong:
    value: 600
  size-display:
    value: 104px
  size-headline:
    value: 52px
  size-title:
    value: 26px
  size-body:
    value: 19px
  size-meta:
    value: 13px
  leading-display:
    value: 1.0
  leading-display-cjk:
    value: 1.15
  leading-headline:
    value: 1.12
  leading-title:
    value: 1.3
  leading-body:
    value: 1.7
  tracking-display:
    value: "-0.015em"
  tracking-meta:
    value: "0.06em"
---

# 编辑衬线

## 要点

- 标题与正文都用衬线体，中文用宋体；层级靠字号、斜体和留白，而不是换字体家族。
- 导语（deck）用 `size-title` 的斜体；中文没有斜体，改用淡墨与 `leading-body` 的行距区分，并设 `font-synthesis: none`，不让浏览器把宋体硬倾斜。
- 正文字号比一般网页大一号（`size-body`），行距 1.7，适合长时间阅读。
- 日期、页码和栏目名用等宽小字，与衬线正文形成质感对比。

## 适用与边界

原型字体是 Tiempos Text（版权字体，见字体注册表的替代说明）。界面控件较多时，控件文字可以用系统无衬线回退，但页面的标题与正文保持衬线。
