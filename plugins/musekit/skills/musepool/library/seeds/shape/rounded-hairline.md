---
id: rounded-hairline
category: shape
nature: value
name: 网格上的圆角矩形
status: draft
scenes: [graphic, web]
affinity: [frosted-grid]
conflicts: [zero-radius-hairline, thick-border]
tokens:
  radius:
    value: 14px
    role: 顶层玻璃面板（代表值）
  radius-sm:
    value: 6px
    role: 按钮、输入框、tooltip
  radius-md:
    value: 10px
    role: 导航条、分段轨道、二级分组
  radius-xl:
    value: 18px
    role: 弹窗
  rule-width:
    value: 0.5px
    role: Retina hairline：玻璃边、分组行、字段边界
  rule-state:
    value: 1.5px
    role: 焦点与出错时的墨色 ring
---

# 网格上的圆角矩形

## 要点

- 圆角只有四档：6（按钮、字段）/ 10（导航条、分组）/ 14（顶层玻璃）/ 18（弹窗）；不在作品里另造圆角。
- 网格语汇里的方块更方：数据方块 2–3px，键帽 4px，chip 5px。
- 完整圆形只给状态圆点，不用于按钮、chip 或进度条。
- 边界默认 0.5px hairline；焦点和出错用 `rule-state` 的墨色 ring，并配文字。

## 适用与边界

海报按 1 倍导出时 0.5px 会被栅格化成很淡的线，改用 1px；印刷或 2 倍导出时保持 0.5px。
