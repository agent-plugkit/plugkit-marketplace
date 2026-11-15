---
id: paper-ink-signal
category: color
nature: value
name: 纸墨单强调
status: draft
scenes: [graphic, web, slides, diagram, data]
affinity: [neo-swiss, swiss, editorial]
conflicts: []
tokens:
  paper:
    value: "#F2F0EB"
    role: 纸面与背景
  ink:
    value: "#111111"
    role: 正文、标题与细线
  ink-muted:
    value: "#5A5A57"
    role: 元数据、图注与次要信息
  accent:
    value: "#E1251B"
    role: 唯一的强调：一块大色面，或一处关键信息
  on-accent:
    value: "#F2F0EB"
    role: 强调色面上的文字
variants:
  signal-red:
    accent: "#E1251B"
  cobalt:
    accent: "#2F62E8"
pairs:
  - [ink, paper, body]
  - [ink-muted, paper, body]
  - [accent, paper, large]
  - [ink, accent, large]
  - [paper, ink, body]
  - [on-accent, accent, large]
---

# 纸墨单强调

## 要点

- 纸、墨两色承担全部结构与正文；强调色只出现在一处：一整块色面，或一个必须先被看到的词或数字。
- 强调色同时与纸色、墨色满足大字对比，所以标题可以跨过色面与纸面的交界。色面上的文字只用大字号（不小于 24px，或 18.7px 粗体）；按钮、标签等小字不放在强调色上。
- 次要信息用 `ink-muted` 退后，不用第二种彩色区分层级；层级交给字号与位置。
- 两种变体只换强调色：信号红更热、更像活动与宣言；钴蓝更冷、更像机构与档案。克莱因蓝（#002FA7）与墨色的对比只有 1.8:1，标题无法跨过交界，所以没有收为变体。

## 适用与边界

适合需要秩序感和单一焦点的内容。数据图需要区分多个序列时，这组颜色不够用：保留纸墨作为底与轴，另配一组数据色板，强调色只留给被比较的那一项。
