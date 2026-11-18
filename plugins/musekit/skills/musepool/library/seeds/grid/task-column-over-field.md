---
id: task-column-over-field
category: grid
nature: rule
name: 场上居中的任务列
status: draft
scenes: [graphic, web]
affinity: [frosted-grid]
conflicts: []
tokens:
  canvas-width:
    value: 1440px
    role: 画布宽：网页是参照视口宽，海报由场景覆盖给出
  canvas-height:
    value: 900px
    role: 画布高：网页是参照视口高，海报由场景覆盖给出
  columns:
    value: 12
  gutter:
    value: 24px
  margin:
    value: 96px
  content-span:
    value: 8
    role: 任务列跨的栏数，居中；两侧各剩 2 栏加外边距，留给像素场
---

# 场上居中的任务列

## 要点

- 整个画面是一张 10px 发丝方格的底面；内容排在居中的一条任务列里，跨中间 `content-span` 栏，两侧边距不放信息，留给方块团。
- 任务列内部按 12 栏的中间 8 栏再分：主任务区可以跨满 8 栏，主次两区按 5 + 3 或 6 + 2 分，侧区放导读、计量或下一步。
- 标题、日期和第一块玻璃面板的左缘在同一条竖线上（任务列的左边线）；导航条居中悬浮在顶部，不压进任务列的左轴。
- 扩大任务列的宽度必须带来真实的信息关系（例如两份需要逐行对照的内容），否则保持 8 栏。

## 适用与边界

来源是桌面应用：默认任务流宽 720px，总览类页面 1040px，最宽的双栏页面 1120px，页面水平内距 24px，没有栏网格。这里把它换算到 1440 参照宽：12 栏、栏间距 24px、外边距 96px，中间 8 栏约 824px，落在项目 720–1040px 之间；栏数与外边距是为营销场景推导的，不是来源原值。
