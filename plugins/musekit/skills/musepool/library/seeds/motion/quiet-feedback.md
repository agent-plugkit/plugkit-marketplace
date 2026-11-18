---
id: quiet-feedback
category: motion
nature: value
name: 安静的反馈
status: draft
scenes: [web]
affinity: [frosted-grid]
conflicts: []
tokens:
  motion-state:
    value: "180ms cubic-bezier(0.22, 1, 0.36, 1)"
    role: 状态过渡
  motion-enter:
    value: "200ms cubic-bezier(0.2, 0.8, 0.2, 1)"
    role: 入场：opacity 0 与 6–10px 位移或 0.98 缩放，backwards 填充
  motion-field-frame:
    value: 66ms
    role: 像素场约 15 帧/秒
---

# 安静的反馈

## 要点

- 过渡只服务反馈、显隐和空间关系，用 `motion-state`；入场用 `motion-enter`，只动 opacity 与 transform。
- 像素场是唯一持续的运动：方块团缓慢漂移，推进一段再滑行，方块始终落在格上；不加别的循环动画或滚动视差。
- 列表行悬停只换底色，不位移、不弹跳。
- `prefers-reduced-motion` 时动画压到 1ms，像素场只画一帧静止画面；页面不可见时停止绘制。
