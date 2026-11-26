---
id: veil-tones
category: color
nature: value
name: 纱面与一种墨
status: draft
scenes: [graphic, web]
affinity: [veiled-frame]
conflicts: []
tokens:
  paper:
    value: "#E9EAE8"
    role: 平底段落的底色，也是纱面不透明时的颜色；中性偏冷，不用米色
  ink:
    value: "#111111"
    role: 唯一的墨：巨字、标题、正文和操作都用它
  ink-muted:
    value: "#4A4B4A"
    role: 只在平底段落里给次要说明；不上纱面
  accent:
    value: "#111111"
    role: 没有彩色强调；行动色就是墨
  on-accent:
    value: "#E9EAE8"
    role: 墨底按钮上的文字
  veil:
    value: "rgba(233, 234, 232, 0.55)"
    role: 半透明纱面，配合 veil-filter 使用
  veil-hover:
    value: "rgba(233, 234, 232, 0.7)"
    role: 可点的纱面悬停时
  veil-floor:
    value: "#808080"
    role: 最暗的照片垫在纱面下时的等效色，只用来校验对比度
  rule:
    value: "rgba(17, 17, 17, 0.18)"
    role: 平底段落里分组的细线
variants:
  bright:
    paper: "#E9EAE8"
  dusk:
    paper: "#1C1D1E"
    ink: "#F2F2F0"
    ink-muted: "#B4B5B3"
    accent: "#F2F2F0"
    on-accent: "#1C1D1E"
    veil: "rgba(28, 29, 30, 0.65)"
    veil-hover: "rgba(28, 29, 30, 0.78)"
    veil-floor: "#6B6C6D"
    rule: "rgba(242, 242, 240, 0.2)"
pairs:
  - [ink, paper, body]
  - [ink-muted, paper, body]
  - [ink, veil-floor, body]
  - [on-accent, accent, body]
---

# 纱面与一种墨

## 要点

- 颜色只来自照片；版面上只有一种墨，没有彩色强调。选中、出错和完成靠墨的形态（实底、下划线、符号和文字）区分。
- 纱面的亮暗跟着文字落的那块安静处：安静处亮（天空、墙面）用 `bright`，暗用 `dusk`。同一页、同一组作品只用一个变体；照片明暗不一时，暗照片上的 `bright` 纱面会显成中灰，`veil-floor` 已按这种最坏情况校验过。
- 纱面 = `veil` 半透明底 + `veil-filter`。`veil` 要薄到能看出底下照片的明暗，又不能低于 token 里的不透明度（`bright` 0.55，`dusk` 0.65）：最暗或最亮的照片垫在下面时，墨色对 `veil-floor` 仍有 4.5:1。
- 纱面上的字只用 `ink`，虚构示例的声明也一样；`ink-muted` 在最坏的照片上不够清楚，只用在平底段落。
- 平底段落的底色就是 `paper`，等于纱面不透明的样子，让长文和表单读起来像纱面的延续。

## 适用与边界

`bright` 和 `dusk` 是按照片选的两种纱面，不是跟随系统的浅色和深色：照片不会随系统设置变化，所以网页不跟随系统切换。照片整体又亮又杂、找不到能压纱面的安静区时，换一张照片，不靠加深纱面硬撑。
