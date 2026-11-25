---
id: glyph-grotesk
category: typography
nature: value
name: 一个巨字与怪诞体小字
status: draft
scenes: [graphic, web]
affinity: [veiled-frame]
conflicts: []
tokens:
  font-display:
    value: Noto Sans SC
    role: 纱面上的巨字，只排一到三个汉字
  font-text:
    value: Inter
    role: 西文标题、正文、数字与操作
  font-cjk:
    value: Noto Sans SC
    role: 巨字以外的全部中文
  weight-display:
    value: 900
    role: 巨字用最粗的一档
  weight-text:
    value: 400
  weight-strong:
    value: 700
    role: 标题与署名
  size-display:
    value: 240px
    role: 巨字的参照字号；实际按纱面内宽推导
  size-figure:
    value: 72px
    role: 下组里唯一的关键数字（价格、日期或场次）
  size-title:
    value: 20px
    role: 上组的标题或署名，粗体
  size-body:
    value: 17px
    role: 短句与正文
  size-meta:
    value: 13px
    role: 只给声明和图注
  leading-display:
    value: 1
  leading-figure:
    value: 1
  leading-title:
    value: 1.25
  leading-body:
    value: 1.6
  leading-meta:
    value: 1.4
  tracking-figure:
    value: "-0.03em"
    role: 大号数字收紧，tabular numbers
  tracking-title:
    value: "-0.01em"
---

# 一个巨字与怪诞体小字

## 要点

- 每个画框只有一个巨字（或两三个字的极短词），用 `font-display`。它的字面宽度占满纱面的内宽，或占满纱面短边方向上的内宽，不另设中间字号。
- 巨字之外只有两档文字：`size-title` 粗体给标题或署名，`size-body` 常规体给短句和正文。下组可以有一个关键数字用 `size-figure`，它是唯一的例外，不能出现第二个。
- 巨字和中文小字同属 Noto Sans SC：巨字 900，小字 400 与 700，层级靠字号和字重的落差，不另换展示字体；西文小字用 Inter。
- 巨字至少是 `size-figure` 的两倍、`size-title` 的六倍；两者之间看不出层级时，缩小数字，不放大标题。
- 数字用 `font-text` 的 tabular numbers；货币符号、单位用 `size-title` 上标或贴在数字旁。
- 不用全大写加字距的小标签，不用等宽字体。

## 适用与边界

巨字由用户给出时照原样用；用户没给时它是你创作的内容，按底线里「由你创作」的规则处理。
