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
- 展示字拉开字距（约 0.12em），正文行距放到接近 2，让每一行之间留出呼吸。正文和导语不加字距。
- 标题可以竖排（`writing-mode: vertical-rl`），尤其是只有几个字的标题和栏目名；竖排时数字保留原样，两位数字用 `text-combine-upright` 横排在一格里，较长的日期整体改为横排，不把阿拉伯数字改写成汉字。
- 元数据和注释用小字号，加大字距，颜色退到淡墨。

## 适用与边界

长篇正文在屏幕上可以继续用宋体，但字号不要小于 16px。界面控件的文字同样用宋体，字号不小于 16px；数据密集、必须更小时改用系统无衬线（`system-ui`），并写进交付说明。
