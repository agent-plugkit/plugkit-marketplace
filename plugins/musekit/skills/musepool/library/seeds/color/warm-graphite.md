---
id: warm-graphite
category: color
nature: value
name: 暖石墨与墨色行动
status: draft
scenes: [graphic, web]
affinity: [frosted-grid]
conflicts: []
tokens:
  paper:
    value: "#f6f6f3"
    role: 底面（地），上面铺 10px 发丝方格
  ink:
    value: "#1b1c19"
    role: 正文与标题
  ink-muted:
    value: "#4e4f4a"
    role: 辅助说明、导读
  ink-subtle:
    value: "#5f605a"
    role: 只给 metadata、placeholder 和低强调图标；必要说明不用它
  accent:
    value: "#1d1e1b"
    role: 墨：唯一的行动色，同时承担选中与焦点；没有彩色强调
  on-accent:
    value: "#f7f7f3"
    role: 墨底按钮上的文字
  surface:
    value: "#ebebe6"
    role: 玻璃的不透明等效面；对比度在这里校验，也是不支持模糊时的回退面
  field:
    value: "#f6f6f2"
    role: 输入框的井
  glass:
    value: "rgba(228, 228, 222, 0.62)"
    role: 半透明玻璃面板
  glass-border:
    value: "rgba(28, 29, 26, 0.1)"
    role: 玻璃边缘的 hairline
  hairline:
    value: "rgba(28, 29, 26, 0.07)"
    role: 玻璃内分组行之间的细线
  field-border:
    value: "rgba(28, 29, 26, 0.5)"
    role: 输入框边界，对相邻面至少 3:1
  grid-line:
    value: "rgba(28, 29, 26, 0.045)"
    role: 底面发丝方格的线色
  error:
    value: "#a3392d"
    role: 破坏与失败，配文字或图标
  warning:
    value: "#855816"
    role: 风险与待注意，配文字或图标
  success:
    value: "#3d6a3b"
    role: 成功与正确，配文字或图标
  tone-slate:
    value: "#3f5277"
    role: 石板色相上可以排文字的墨（徽标、状态文字）
  tone-lavender:
    value: "#5a5085"
    role: 灰紫色相上可以排文字的墨
  tile-sage:
    value: "#8aa286"
    role: 方块填充：只给数据、阶段与像素场，不承载文字
  tile-lavender:
    value: "#a39cc4"
    role: 方块填充
  tile-slate:
    value: "#8597b5"
    role: 方块填充
  tile-ochre:
    value: "#bf9a6a"
    role: 方块填充；方块团的团心
  tile-clay:
    value: "#c9948b"
    role: 方块填充
  tile-ash:
    value: "#a9a8a1"
    role: 方块填充；方块团的外围用灰阶
variants:
  light:
    paper: "#f6f6f3"
  dark:
    paper: "#121311"
    ink: "#ecebe5"
    ink-muted: "#b3b4ad"
    ink-subtle: "#90918a"
    accent: "#e9e8e1"
    on-accent: "#161714"
    surface: "#1c1d1a"
    field: "#191a17"
    glass: "rgba(34, 35, 31, 0.64)"
    glass-border: "rgba(255, 255, 255, 0.08)"
    hairline: "rgba(255, 255, 255, 0.06)"
    field-border: "rgba(255, 255, 255, 0.36)"
    grid-line: "rgba(255, 255, 255, 0.04)"
    error: "#e48a7d"
    warning: "#d8b066"
    success: "#94ba8f"
    tone-slate: "#a3b4d6"
    tone-lavender: "#bab1e0"
    tile-sage: "#5f7a5b"
    tile-lavender: "#6f6894"
    tile-slate: "#5a6c8a"
    tile-ochre: "#8c6f45"
    tile-clay: "#8f5f57"
    tile-ash: "#55554f"
pairs:
  - [ink, paper, body]
  - [ink, surface, body]
  - [ink, field, body]
  - [ink-muted, paper, body]
  - [ink-muted, surface, body]
  - [ink-subtle, paper, body]
  - [ink-subtle, surface, body]
  - [on-accent, accent, body]
  - [error, surface, body]
  - [warning, surface, body]
  - [success, surface, body]
  - [tone-slate, surface, body]
  - [tone-lavender, surface, body]
---

# 暖石墨与墨色行动

## 要点

- 暖石墨中性色承担全部结构：底面 `paper`，玻璃 `glass`（不透明等效 `surface`），文字 `ink` / `ink-muted` / `ink-subtle` 三档。
- 墨（`accent`）是唯一的行动色，同时承担选中和焦点；一个任务区只有一个墨色主行动。色相从不承担「下一步」。
- 方块色 `tile-*` 只出现在数据、分类和方块团里，对纸面不足 3:1，不承载文字；需要在这些色相上排字时用 `tone-slate`、`tone-lavender`。
- 状态色 `error`、`warning`、`success` 只表达失败、待注意、成功，并且总与文字、图标或形态一起出现。
- 不用渐变底、渐变字、单一色相主题或不透明白卡片堆叠。
- 深色变体不是反色：同一语义层级换成炭黑底、近白墨，墨色按钮变成近白底、炭黑字。

## 适用与边界

两个变体：`light`（默认）与 `dark`。网页跟随系统深浅色切换，海报每件只取一个。这组颜色没有数据色板，不声明 `data` 场景。
