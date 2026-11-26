---
id: wide-wordmark
category: typography
nature: value
name: 加宽字标与贴边小字
status: draft
scenes: [graphic, web]
affinity: [dark-stage]
conflicts: []
tokens:
  font-display:
    value: Archivo
    role: 西文字标，用加宽字形
  stretch-display:
    value: 125%
    role: 西文字标的字宽，写成 font-stretch
  weight-display:
    value: 500
    role: 西文字标的字重：宽而不重，字标后面的光透得出来
  weight-display-cjk:
    value: 700
    role: 中文字标的字重，用 font-cjk；汉字笔画密，700 的灰度和西文 500 相当
  font-text:
    value: Archivo
    role: 西文小字、数字和操作，用正常字宽
  font-cjk:
    value: Noto Sans SC
    role: 中文字标和全部中文小字
  weight-text:
    value: 400
  weight-strong:
    value: 600
    role: 贴边的短标签、名称和按钮
  size-display:
    value: 240px
    role: 只是样张里的参照字号；作品里的字标字号按要点里的公式推
  size-title:
    value: 22px
    role: 章节画框和平底段落的小标题，粗体
  size-edge:
    value: 14px
    role: 贴着画框四边的小字：名称、导航、短标签和说明
  size-body:
    value: 17px
    role: 平底段落的正文与表单
  size-meta:
    value: 13px
    role: 只给声明和图注
  leading-display:
    value: 0.9
  leading-title:
    value: 1.25
  leading-edge:
    value: 1.45
  leading-body:
    value: 1.65
  leading-meta:
    value: 1.4
  tracking-display:
    value: "-0.02em"
    role: 西文字标收紧；两三个汉字的字标改用正字距撑宽，见要点
  tracking-edge:
    value: "0.02em"
---

# 加宽字标与贴边小字

## 要点

- 每个画框只有一个字标。字标优先取作品名称里的词（中文取两三个字，如「河岸」；西文取一个词），社媒缩略里一眼就能认出是什么。名称里的词太长或太扁（西文超过约 12 个字母，或字高不到字宽的约五分之一），前景的起伏会让被压的比例忽大忽小时，才改用主题词，这时海报上边一行的名称用 `size-title` 粗体。西文用 `font-display` 加 `stretch-display`、`weight-display`；中文用 `font-cjk` 加 `weight-display-cjk`。字标是场景里的一样东西，不是标题栏，它和其余文字之间没有中间档。
- 字号先按画框宽度推，让整词的字面宽达到网格 Seed 的 `mark-fill`；再以画框高的约一半封顶，两条冲突时（超宽的矮屏）封顶优先，字面宽可以低于 `mark-fill`。先量整词的字面宽 w（以 em 计，含字距；两个汉字加 0.08em 字距约 2.08em），字号 = `mark-fill` × 画框宽 ÷ w，封顶 = 画框高 × 0.5 ÷ 字高（以 em 计，中文约 0.9）。海报直接算出一个值；网页写成 `min(X vw, Y svh)`，X = `mark-fill` × 100 ÷ w，Y = 50 ÷ 字高。`muse.py fit` 按跨满栏位算，不适用于字标。两三个汉字的词可以加正字距（0.04–0.1em）帮着撑宽。
- 字标是装饰层：元素加 `aria-hidden="true"` 和 `data-inspect-ignore`。作品的名称另以真实文字出现在画框上边一行（网页里是 `h1` 或品牌行），读屏和检查脚本读的都是它。字标被前景压住、两端出血，都不影响名称可读。
- 字标之外只有两档小字：`size-edge` 贴边（短标签用 `weight-strong`，说明用 `weight-text`），`size-title` 粗体给章节画框和平底段落的小标题；平底段落的正文用 `size-body`。按钮文字用 `size-edge` 粗体。
- 不用全大写加大字距的小标签，不用等宽字体。数字用 `font-text` 的 tabular numbers。

## 适用与边界

字标的词由用户给出时照原样用；用户没给时，从名称里取，取不出再用用户给的主题词，都没有时它是你创作的内容，按底线里「由你创作」的规则处理。不管字标取的是什么，完整名称都以真实文字写在上边一行。
