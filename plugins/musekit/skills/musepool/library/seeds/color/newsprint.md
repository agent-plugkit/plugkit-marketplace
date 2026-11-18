---
id: newsprint
category: color
nature: value
name: 报白与报红
status: draft
scenes: [graphic, web, data]
affinity: [broadsheet]
conflicts: []
tokens:
  paper:
    value: "#F7F6F2"
    role: 版面纸色：冷白偏一点暖，不做黄纸
  ink:
    value: "#141413"
    role: 标题、正文、栏线与横线
  ink-muted:
    value: "#57544F"
    role: 引题、图注、报眉和署名
  accent:
    value: "#B8121B"
    role: 报红：每版只用一处，刊名或一个「要闻」标记
  on-accent:
    value: "#F7F6F2"
    role: 报红底上的反白字
variants:
  red:
    accent: "#B8121B"
  blue:
    accent: "#1D4A8A"
data:
  categorical: ["#141413", "#B8121B", "#7A7772"]
  sequential: ["#D9D7D1", "#B3B0A9", "#8A8781", "#5F5C57", "#2E2C29"]
  diverging: ["#B8121B", "#DC8A84", "#E4E1DA", "#8A8781", "#141413"]
  variants:
    blue:
      categorical: ["#141413", "#1D4A8A", "#7A7772"]
      sequential: ["#D9D7D1", "#B3B0A9", "#8A8781", "#5F5C57", "#2E2C29"]
      diverging: ["#1D4A8A", "#8DA2C4", "#E4E1DA", "#8A8781", "#141413"]
pairs:
  - [ink, paper, body]
  - [ink-muted, paper, body]
  - [accent, paper, body]
  - [on-accent, accent, body]
  - [paper, ink, body]
---

# 报白与报红

## 要点

- 纸与墨承担全部结构：标题、正文、栏线、横线都是墨色，层次靠字号档位和淡墨（引题、图注、报眉）。
- 报红在整件作品里只用一处：刊名，或者一个「要闻」标记，二选一。标题、链接和按钮都用墨色，不用报红。
- 纸色是冷白偏一点暖，不做黄纸、不做旧、不加纸纹。
- 两个变体：报红用于活动、公告与社区内容；蓝（blue）更冷静，用于机构、研究和周报。

## 适用与边界

数据图像报上的图表框：纸墨为底，分类最多 3 类，依次是墨、报红（蓝变体是蓝）、淡墨；超出就合并成「其他」或分面。只有一个序列时用墨，报红只标被讨论的那一项。顺序色是墨的浓淡，发散色一端是报红（或蓝），另一端是墨。
