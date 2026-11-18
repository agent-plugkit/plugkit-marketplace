---
id: keycap-and-halo
category: device
nature: rule
name: 键帽、等宽标签与地色光晕
status: draft
scenes: [graphic, web]
affinity: [frosted-grid]
conflicts: []
---

# 键帽、等宽标签与地色光晕

## 要点

- 按键和短代码写成等宽键帽：10px 等宽字、4px 圆角、hairline 边，后接一句说明，例如 `esc 关闭`。作品里没有按键时不用键帽。
- 标签与状态用等宽 chip：hairline 边、更亮的井底、5px 圆角、最小高 20px；颜色来自状态色调（`tone-*` 文字配 8% 底、16% 边）。
- 导航是一条居中悬浮的玻璃条（10px 圆角、2px 内距），选中项是一块淡墨底：6px 圆角（`radius-sm`），底色是 `accent` 的 8% 透明；悬停用 4%，和选中分开；计数徽标是墨底等宽小字。
- 直接压在方格或像素场上的小字（标题、副标题、导读）带一圈 `paper` 色光晕：`text-shadow: 0 0 1px, 0 0 4px, 0 0 10px` 都取 `paper`。玻璃上的文字不加光晕。
