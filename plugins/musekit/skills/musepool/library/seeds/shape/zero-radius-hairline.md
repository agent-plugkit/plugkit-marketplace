---
id: zero-radius-hairline
category: shape
nature: value
name: 零圆角细线
status: draft
scenes: [graphic, web, slides, diagram, data]
affinity: [neo-swiss, swiss, editorial, japanese-ma, editorial-serif, mono-print, broadsheet]
conflicts: [soft-rounded]
tokens:
  radius:
    value: 0
  rule-width:
    value: 1px
    role: 分隔线、表格线、边框
  rule-state:
    value: 2px
    role: 焦点框、出错字段和当前态的线宽
  rule-heavy:
    value: 6px
    role: 每个版面最多一条粗线，标记最重要的分界
  shadow:
    value: none
---

# 零圆角细线

## 要点

- 所有容器、按钮、图片保持直角；没有阴影，层次由位置和细线表达。
- 细线用墨色，是结构的一部分：分隔列表行、标出元数据栏、承托标题。
- 粗线是一次性的强调，一个版面最多一条。
- 焦点、出错与当前态统一用 `rule-state` 的线宽，并配文字说明，不只靠颜色。

## 适用与边界

界面中的焦点环仍然需要清楚可见：用 `rule-state` 宽的墨色描边，而不是去掉焦点样式。
