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
    role: 朱色：每屏只用在一种标记上，印章、一个关键词或表单的选中状态
  on-accent:
    value: "#F4F1EA"
    role: 朱色印章上的反白字
variants:
  shu:
    accent: "#B83A2E"
  ai:
    accent: "#2F4A7A"
data:
  categorical: ["#74726D", "#1E1D1A", "#B83A2E"]
  sequential: ["#DAD8D1", "#B4B1AC", "#898782", "#5A5854", "#2F2E2B"]
  diverging: ["#B83A2E", "#D6968C", "#E2DED6", "#898782", "#1E1D1A"]
  variants:
    ai:
      categorical: ["#74726D", "#1E1D1A", "#2F4A7A"]
      sequential: ["#DAD8D1", "#B4B1AC", "#898782", "#5A5854", "#2F2E2B"]
      diverging: ["#2F4A7A", "#929EB2", "#E2DED6", "#898782", "#1E1D1A"]
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

适合安静、内省、手工与文化类内容。数据图先考虑只画一个序列：淡墨画数据，朱色只标被强调的一项。数据色板不另引入彩色：分类依次是淡墨、墨、朱（藍变体是藍），最多 3 类，超出就合并为「其他」或分面；两个序列时只用两种墨，朱色仍留给被强调的一项。顺序色是墨的浓淡，发散色一端是朱（藍），另一端是墨。
