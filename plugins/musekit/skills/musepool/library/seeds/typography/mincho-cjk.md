---
id: mincho-cjk
category: typography
nature: value
name: 宋体为主的疏朗排印
status: draft
scenes: [graphic, web, slides]
affinity: [japanese-ma, editorial-serif]
conflicts: []
tokens:
  font-display:
    value: Noto Serif SC
    role: 标题与展示字
  font-text:
    value: Noto Serif SC
    role: 正文
  font-cjk:
    value: Noto Serif SC
    role: 中文全部层级
  weight-display:
    value: 400
  weight-text:
    value: 400
  weight-strong:
    value: 600
  size-display:
    value: 88px
  size-headline:
    value: 40px
  size-title:
    value: 24px
  size-body:
    value: 17px
  size-meta:
    value: 13px
  leading-display:
    value: 1.3
  leading-display-cjk:
    value: 1.3
  leading-headline:
    value: 1.45
  leading-title:
    value: 1.6
  leading-body:
    value: 1.95
  tracking-display:
    value: "0.12em"
    role: 展示字拉开字距，让每个字单独被看见
  tracking-meta:
    value: "0.2em"
---

# 宋体为主的疏朗排印

## 要点

- 一套宋体（明朝体）贯穿全部层级。展示字用常规字重，靠尺寸和字距显得从容，而不是加粗。
- 展示字拉开字距（约 0.12em），正文行距放到接近 2，让每一行之间留出呼吸。
- 标题可以竖排（`writing-mode: vertical-rl`），尤其是只有几个字的标题和栏目名；竖排时数字用汉字或全角。
- 元数据和注释用小字号，加大字距，颜色退到淡墨。

## 适用与边界

长篇正文在屏幕上可以继续用宋体，但字号不要小于 16px。需要大量数据或界面控件时，控件文字改用无衬线字体回退，避免细笔画在小字号下发虚。
