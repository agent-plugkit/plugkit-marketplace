---
id: frosted-glass
category: depth
nature: value
name: 浮在网格上的磨砂玻璃
status: draft
scenes: [graphic, web]
affinity: [frosted-grid]
conflicts: [hard-shadow]
tokens:
  shadow:
    value: "0 1px 2px rgba(24, 24, 18, 0.03), 0 18px 48px -18px rgba(24, 24, 18, 0.2), 0 2px 64px rgba(24, 24, 18, 0.035)"
    role: 顶层玻璃面板（Float）
  shadow-low:
    value: "0 1px 2px rgba(24, 24, 18, 0.06)"
    role: 紧凑控件、分段指示器
  shadow-chrome:
    value: "0 1px 2px rgba(24, 24, 18, 0.04), 0 8px 20px -8px rgba(24, 24, 18, 0.12)"
    role: 导航条与右上角的工具方块
  shadow-high:
    value: "0 4px 10px rgba(24, 24, 18, 0.05), 0 28px 56px -20px rgba(24, 24, 18, 0.24)"
    role: 覆盖层、弹窗与可交互卡片的悬停
  highlight:
    value: "inset 0 1px 0 rgba(255, 255, 255, 0.66)"
    role: 所有玻璃与输入井的顶边高光
  glass-filter:
    value: "blur(16px) saturate(1.2)"
    role: 唯一的模糊值
variants:
  dark:
    shadow: "0 1px 2px rgba(0, 0, 0, 0.2), 0 16px 36px -16px rgba(0, 0, 0, 0.55)"
    shadow-chrome: "0 1px 2px rgba(0, 0, 0, 0.24), 0 8px 20px -8px rgba(0, 0, 0, 0.42)"
    shadow-high: "0 4px 10px rgba(0, 0, 0, 0.3), 0 28px 56px -20px rgba(0, 0, 0, 0.62)"
    highlight: "inset 0 1px 0 rgba(255, 255, 255, 0.06)"
---

# 浮在网格上的磨砂玻璃

## 要点

- 深度只有三层：网格底面与像素场、磨砂玻璃、玻璃之上的覆盖层。
- 玻璃 = `glass` 半透明底 + `glass-filter` + 0.5px `glass-border` + `shadow` + `highlight`；经过玻璃背后的方格和方块团被虚化成纹理，这是风格的签名。
- 玻璃里不再套玻璃：嵌套分组退化为 hairline 行或更亮的井，不再模糊。
- 阴影是暖中性色、始终向下偏移的柔和阴影；不用硬阴影、彩色阴影或发光。
- 不支持模糊或用户要求减少透明度时，玻璃退为 `surface` 不透明面，层级不变。
- 网页入场动画只动 opacity 与 transform，不动 filter，填充用 backwards，否则玻璃会失去磨砂。

## 适用与边界

深色变体的阴影更深、顶边高光更弱，写在 `variants.dark` 里，随 `dark` 变体一起切换；`shadow-low` 两种配色共用。海报是静态位图，磨砂要在导出前由浏览器渲染出来。
