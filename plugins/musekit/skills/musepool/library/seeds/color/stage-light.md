---
id: stage-light
category: color
nature: value
name: 暗场与一种光色
status: draft
scenes: [graphic, web]
affinity: [dark-stage]
conflicts: []
tokens:
  paper:
    value: "#0D0C0B"
    role: 暗场的底色，也是平底段落、吸顶条和暗角渐变的颜色；近黑，不用纯黑
  ink:
    value: "#EFE9E1"
    role: 字标和所有文字；跟着光的冷暖，暖光时偏暖白
  ink-muted:
    value: "#9A938B"
    role: 只在平底段落里给次要说明；不上画框
  accent:
    value: "#F2924C"
    role: 光的颜色，整页唯一的强调色：底栏短标签、当前导航项、主操作、焦点，以及可点小字的悬停和表单选中项
  on-accent:
    value: "#0D0C0B"
    role: 光色底按钮上的文字
  edge-floor:
    value: "#383430"
    role: 画框边上小字底下允许的最亮色调（暗角压过之后），只用来校验对比度
  rule:
    value: "rgba(239, 233, 225, 0.16)"
    role: 吸顶条下缘和平底段落里分组的细线
variants:
  ember:
    paper: "#0D0C0B"
  moon:
    paper: "#0B0C0F"
    ink: "#E7EAEF"
    ink-muted: "#939AA4"
    accent: "#A9C4E6"
    on-accent: "#0B0C0F"
    edge-floor: "#33363C"
    rule: "rgba(231, 234, 239, 0.16)"
pairs:
  - [ink, paper, body]
  - [ink-muted, paper, body]
  - [accent, paper, body]
  - [ink, edge-floor, body]
  - [accent, edge-floor, body]
  - [on-accent, accent, body]
---

# 暗场与一种光色

## 要点

- 画面大部分是暗部，版面只有一种彩色：画面里那处光的颜色。`ember` 用于火、烛、灯这类暖光，`moon` 用于月光、冷的屏幕光这类冷光。照片往往在取风格之后才生成，所以写 Brief 时先定下场景和它的光源，按光选变体，再把这种光写进生图提示词，生成后核对；同一页、同一组作品只用一个变体。
- `accent` 用得很少：底栏的短标签、当前导航项、主操作按钮和焦点描边，以及可点小字悬停时的文字色和表单选中项的描边。大面积的光留给照片，不在版面上铺光色的面。
- 画框边上的小字只用 `ink` 和 `accent`，画框里的「示例」小标和虚构示例声明也用 `ink`。暗角压过之后，最亮的照片色调是 `edge-floor`，这两种颜色对它仍有 4.5:1；`ink-muted` 在这里不够清楚，只用在平底段落。检查脚本按「机检」把画框里的文字设成透明再截图，量每行文字底下最亮的约 5% 像素；亮于 `edge-floor` 时调整裁切，或把文字移到更暗处。
- 平底段落、吸顶条和暗角渐变都用 `paper`，让照片的暗部和版面的底连成一片。

## 适用与边界

`ember` 和 `moon` 是按光选的两种色温，都是深色，不是跟随系统的浅色和深色；网页不跟随系统深浅色切换。照片里有两种以上互相竞争的光色（暖灯加蓝色霓虹）时，换照片或把次要的光压暗，不在版面上同时用两种光色。
