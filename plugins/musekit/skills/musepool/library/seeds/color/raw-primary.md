---
id: raw-primary
category: color
nature: value
name: 奶油底与原色撞色
status: draft
scenes: [graphic, web, slides, data]
affinity: [neo-brutalism]
conflicts: []
tokens:
  paper:
    value: "#FFF8E7"
    role: 奶油色底
  ink:
    value: "#0A0A0A"
    role: 文字、粗边框与硬阴影
  ink-muted:
    value: "#3D3B36"
    role: 次要文字
  accent:
    value: "#FFD23F"
    role: 主色块：主操作、主板、标题底色
  accent-2:
    value: "#FF7AB6"
    role: 第二色块：标签与分类
  accent-3:
    value: "#3EC5F0"
    role: 第三色块：状态与辅助的小板
  on-accent:
    value: "#0A0A0A"
    role: 色块上的文字
variants:
  yellow:
    accent: "#FFD23F"
  pink:
    accent: "#FF7AB6"
    accent-2: "#FFD23F"
  lime:
    accent: "#B8F25C"
data:
  categorical: ["#1F4FE0", "#E8461E", "#0E8F4F", "#B0389E"]
  sequential: ["#CFE0FF", "#94B4FF", "#5784FF", "#2456E8", "#0A2FA8"]
  diverging: ["#1F4FE0", "#8FA4E4", "#E6E0D2", "#D898C2", "#B0389E"]
pairs:
  - [ink, paper, body]
  - [ink-muted, paper, body]
  - [on-accent, accent, body]
  - [ink, accent-2, body]
  - [ink, accent-3, body]
  - [paper, ink, body]
---

# 奶油底与原色撞色

## 要点

- 色块是主角：鲜明的原色平涂在奶油色底上，每块都有黑色粗边框；文字永远是黑色，放在色块里。
- 色块按角色分工：`accent` 给主操作和主板，`accent-2` 给标签，`accent-3` 给状态；一页里三种以内。
- 彩色永远不做文字色：黄、粉、青放在奶油底上几乎没有对比。

## 适用与边界

适合活动、创意工具、年轻品牌和需要直接、有力、带点挑衅的场合。不适合需要安静和信任感的内容（医疗、金融说明）。数据图的序列不用黄、粉、青三个色块：它们在奶油底上不到 3:1，柱子、线和点都会发虚。改用数据色板里的四个深原色（蓝、橙红、绿、品红），柱和块照样加黑边框；最多 4 类，超出就合并为「其他」或分面。橙红与绿在色盲下只勉强分得开，每个序列还要配直接标注或图案。三个色块仍然可以做图表所在的板和标题底。
