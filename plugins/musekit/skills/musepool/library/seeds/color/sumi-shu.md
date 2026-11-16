---
id: sumi-shu
category: color
nature: value
name: 墨与朱
status: draft
scenes: [graphic, web, slides, diagram, data]
affinity: [japanese-ma, editorial-serif]
conflicts: []
tokens:
  paper:
    value: "#F4F1EA"
    role: 和纸般的暖白底
  ink:
    value: "#1E1D1A"
    role: 墨色：正文与标题
  ink-muted:
    value: "#6B665D"
    role: 淡墨：注释、元数据与竖排小字
  accent:
    value: "#B83A2E"
    role: 朱色：每屏只用在一种标记上，印章、一个关键词或交互的当前与选中状态
  on-accent:
    value: "#F4F1EA"
    role: 朱色印章上的反白字
variants:
  shu:
    accent: "#B83A2E"
  ai:
    accent: "#2F4A7A"
pairs:
  - [ink, paper, body]
  - [ink-muted, paper, body]
  - [accent, paper, body]
  - [on-accent, accent, body]
  - [paper, ink, body]
---

# 墨与朱

## 要点

- 纸与墨占据几乎全部画面；朱色每屏只用在一种标记上，面积小而准确，像一枚印章或一处圈点。
- 层次靠墨的浓淡（`ink` 与 `ink-muted`）建立，不引入第二种彩色。
- 两个变体：朱色温暖、有节庆与手作感；藍（ai）更冷静，适合机构与学术内容。

## 适用与边界

适合安静、内省、手工与文化类内容。数据图需要多个序列时，用墨的浓淡分层，再把朱色留给被强调的一项。
