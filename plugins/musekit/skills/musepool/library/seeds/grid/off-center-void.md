---
id: off-center-void
category: grid
nature: rule
name: 偏心留白网格
status: draft
scenes: [graphic, web, slides]
affinity: [japanese-ma]
conflicts: [panel-wall]
tokens:
  canvas-width:
    value: 1440px
    role: 参照画布宽度：网页是参照视口宽，平面是画布宽
  canvas-height:
    value: 900px
    role: 参照画布高度：网页是首屏高度，平面是画布高度
  columns:
    value: 12
  gutter:
    value: 24px
  margin:
    value: 128px
---

# 偏心留白网格

## 要点

- 海报和首屏的内容只占画面的一小部分（按墨迹与图像的外接矩形计，约三分之一以内），其余是有意保留的空。
- 焦点落在三分线附近，不居中，也不贴边；它和画面边缘、和次要元素之间的距离本身就是构图。
- 次要信息（日期、署名、注释）退到远离焦点的角落或边缘，用小字竖排或横排，与焦点形成对角的牵引。
- 外边距比一般版面宽得多（`margin`），让画面四周先空出来。

## 适用与边界

空不是缺内容：每块留白都要有明确的边界，并帮助读者看清唯一的焦点。信息必须全部呈现的场景（日程表、表单）照常排布，只在其上下保留更大的间隔。
