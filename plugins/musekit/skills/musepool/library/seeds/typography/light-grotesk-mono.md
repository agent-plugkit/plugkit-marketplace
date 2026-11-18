---
id: light-grotesk-mono
category: typography
nature: value
name: 轻声标题与仪器读数
status: draft
scenes: [graphic, web]
affinity: [frosted-grid]
conflicts: []
tokens:
  font-display:
    value: Inter
    role: 西文标题与大号数字；替代来源应用的 Manrope Variable
  font-text:
    value: Inter
    role: 西文正文与界面文字；替代 Manrope Variable
  font-cjk:
    value: Noto Sans SC
    role: 中文全部层级；替代 PingFang SC，PingFang SC 留在回退栈里
  font-mono:
    value: IBM Plex Mono
    role: 一切计量：数量、日期、时长、编号、按键；替代 SF Mono
  weight-display:
    value: 400
    role: 标题与大号数字。来源原值 300，注册表加载不到，取最接近的 400
  weight-text:
    value: 400
    role: 正文
  weight-strong:
    value: 500
    role: 小标题、按钮与标签；全套最重就是 500
  size-display:
    value: 96px
    role: 参照值：每个画面唯一的大标题，实际字号用 fit 按字数推导
  size-figure:
    value: 64px
    role: 大号计数与百分比，与标题同一细声线
  size-headline:
    value: 32px
    role: 次级大字
  size-title:
    value: 20px
    role: 区块、面板与对象标题
  size-body:
    value: 16px
    role: 正文
  size-label:
    value: 14px
    role: 按钮、导航与小控件
  size-meta:
    value: 12px
    role: 等宽计量小字
  leading-display:
    value: 1.1
  leading-display-cjk:
    value: 1.08
    role: 中文标题行距，沿用 grotesk-cjk
  leading-headline:
    value: 1.2
  leading-title:
    value: 1.3
  leading-body:
    value: 1.55
  leading-meta:
    value: 1.4
  tracking-display:
    value: "-0.03em"
    role: 西文标题收紧
  tracking-display-cjk:
    value: 0em
    role: 中文标题不收紧，沿用 grotesk-cjk
  tracking-figure:
    value: "-0.035em"
    role: 大号数字，tabular numbers
  tracking-headline:
    value: "-0.02em"
  tracking-title:
    value: "-0.005em"
  tracking-meta:
    value: "0.01em"
    role: 等宽小字，tabular numbers
---

# 轻声标题与仪器读数

## 要点

- 一个大号、轻字重的标题给画面一个安静的声音；其余文字都小，层级靠字号和字重差，不靠颜色、全大写或加宽字距。
- 字重只有 400 和 500 两档，最重 500。没有 semibold、bold；需要强调时放大字号或留白。
- 凡是计量（数量、日期、时长、编号、按键）一律用 `font-mono` 和 tabular numbers；正文和说明不用等宽。次要的计量用 `size-meta`；读者此行就是来找的计量（首屏的日期地点、日程的时间）是主信息，用 `size-body`，海报上也至少用 `size-body`。等宽字体只排西文、数字和符号，含中文的计量值改用正文字体。
- 大号数字用 `size-figure`、`weight-display`、`tracking-figure`，与标题同一声线。
- 正文行长不超过约 65–75 个拉丁字符。

## 适用与边界

来源应用原用的字体是 Manrope Variable（OFL-1.1，未登记进 Musekit 字体注册表）、PingFang SC 和 SF Mono；后两者是 Apple 系统字体，用户没有授权。这里换成注册表里的 Inter、Noto Sans SC 和 IBM Plex Mono。差异：Inter 比 Manrope 更中性、字形不那么圆宽；注册表只加载 400 起的字重，项目标题的 300 细字（中文由 PingFang 的细体渲染）落成 400 后明显变重，「轻声」主要靠大字号与大量留白维持。PingFang SC 仍在 Noto Sans SC 的回退栈里：用户说明它在苹果设备上可以免费使用，网页上它只在 Noto Sans SC 加载失败时出现；导出海报不依赖它。
