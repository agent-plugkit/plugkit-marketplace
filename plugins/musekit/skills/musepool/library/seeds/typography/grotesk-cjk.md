---
id: grotesk-cjk
category: typography
nature: value
name: 怪诞体中西配对
status: draft
scenes: [graphic, web, slides, diagram, data]
affinity: [neo-swiss, swiss]
conflicts: []
archetype: Helvetica Neue
tokens:
  font-display:
    value: Inter
    role: 西文展示字与标题
  font-text:
    value: Inter
    role: 西文正文
  font-cjk:
    value: Noto Sans SC
    role: 中文全部层级
  font-mono:
    value: IBM Plex Mono
    role: 编号、日期、元数据与表格数字
  weight-display:
    value: 600
  weight-text:
    value: 400
  weight-strong:
    value: 600
  size-display:
    value: 120px
  size-headline:
    value: 56px
  size-title:
    value: 28px
  size-body:
    value: 17px
  size-meta:
    value: 13px
  leading-display:
    value: 0.92
    role: 西文展示字
  leading-display-cjk:
    value: 1.08
    role: 中文展示字；汉字占满字身，行距收得比西文松
  leading-headline:
    value: 1.08
  leading-title:
    value: 1.2
  leading-body:
    value: 1.55
  tracking-display:
    value: "-0.035em"
    role: 西文展示字的字距
  tracking-display-cjk:
    value: 0em
    role: 中文展示字的字距：保持 0
  tracking-meta:
    value: "0.04em"
---

# 怪诞体中西配对

## 要点

- 一个 grotesk 家族承担全部西文，字重最多两档（400 与 600）；层级靠字号与位置建立，不靠字重堆叠。
- 展示字收紧字距、压低行距，让标题成为一块有形状的字块；中文展示字字距保持 0，行距按 `leading-display-cjk` 放松，避免上下行笔画相撞。
- 编号、日期、价格等数字用等宽字体（`weight-text`），让纵向的元数据栏对齐。等宽字体只排西文、数字和符号；含中文或长破折号「—」的值改用正文字体，因为中文落进等宽字体不再等宽，「—」在等宽字体里只占一格，看起来像短横。
- 元数据可以全大写并略放字距；中文不做大小写与字距放大处理。

## 适用与边界

原型字体是 Helvetica Neue（版权字体，见字体注册表的替代说明）。Inter 为屏幕调校，展示字号下比 Helvetica 松，所以需要收紧字距。印刷导出可把中文换成思源黑体本地版本。
