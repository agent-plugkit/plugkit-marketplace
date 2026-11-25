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
checks:
  roles:
    glyph: 纱面上的巨字
    title: 纱面上组的标题或署名（size-title 粗体）
    figure: 纱面下组的关键数字（size-figure）；没有就不标
  rules:
    - kind: scale
      group: veil
      item: glyph
      than: title
      min: 6
    - kind: scale
      group: veil
      item: glyph
      than: figure
      min: 2
      optional: true
---

# 一个巨字与怪诞体小字

## 要点

- 每个画框只有一个巨字（或两三个字的极短词），用 `font-display`。字号由纱面内宽推出：字号 = 纱面内宽 ÷ 字数，再按浏览器实测的墨迹宽微调，让整词的字面宽等于内宽。纱面出血到画框边，不用 `muse.py fit`（它按版心扣掉外边距）。这个公式用于竖条和角块。横带里巨字和其余文字左右分开，字号不按内宽推，按高度推：横带最高是 `veil-max` 乘画框高，巨字取 `size-display` 和「这个高度减去上下 `veil-padding` 和上组其余行」的较小值。高屏上巨字就是 `size-display`，矮屏上自动变小，横带面积不超过 `veil-max`。
- 网页上纱面宽度随视口变化：字体加载后，用 canvas 量一次墨迹宽和左右、上下留白与字号之比，写成 CSS 变量；纱面设 `container-type: inline-size`，巨字字号写成 `calc(100cqw / var(--ink))`，右侧留白用负 `margin-right` 抵消。这样改视口时不必用脚本重排。
- 巨字按墨迹对齐 `veil-padding`，不按 em 框：Noto Sans SC 900 各字左侧和顶部的留白不同（「日」左侧约 0.14em），用 canvas `measureText` 的 `actualBoundingBoxLeft` 和 `actualBoundingBoxAscent` 量出后，用负外边距对齐。
- 巨字之外只有两档文字：`size-title` 粗体给标题、署名和列表里的条目名，`size-body` 常规体给短句、正文、表单标签和出错说明；按钮文字用 `size-body` 粗体，算组件内的取值，不另成一档。下组可以有一个关键数字用 `size-figure`，它是唯一的例外，不能出现第二个。
- 巨字和中文小字同属 Noto Sans SC：巨字 900，小字 400 与 700，层级靠字号和字重的落差，不另换展示字体；西文小字用 Inter。
- 推出字号后再检查倍数：巨字至少是 `size-title` 的六倍；画框里有关键数字时，还要至少是 `size-figure` 的两倍。不够时按这个顺序处理：把巨字减到一个字、加宽纱面、去掉关键数字；不降低倍数要求，也不放大标题。
- 数字用 `font-text` 的 tabular numbers；货币符号、单位用 `size-title` 上标或贴在数字旁。
- 不用全大写加字距的小标签，不用等宽字体。

## 适用与边界

巨字由用户给出时照原样用；用户没给时它是你创作的内容，按底线里「由你创作」的规则处理。
