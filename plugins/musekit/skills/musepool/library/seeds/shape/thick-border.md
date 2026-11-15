---
id: thick-border
category: shape
nature: value
name: 粗边框
status: draft
scenes: [graphic, web, slides]
affinity: [neo-brutalism]
conflicts: []
tokens:
  radius:
    value: 8px
    role: 小圆角；也可以统一为 0
  rule-width:
    value: 3px
    role: 块面、按钮、输入框的边框
  rule-state:
    value: 3px
    role: 焦点框与出错字段
  rule-heavy:
    value: 6px
    role: 分区的粗分隔线
---

# 粗边框

## 要点

- 所有块面、按钮、输入框、图片都有 3px 黑色实线边框；边框是风格的骨架。
- 圆角要么统一的小圆角，要么全部直角，不混用；不用胶囊形按钮。
- 焦点框与边框同宽，用黑色外加一圈间隙，保证在色块上也清楚可见。

## 适用与边界

边框围起来的是内容单元，不要给每一行文字都加框。
