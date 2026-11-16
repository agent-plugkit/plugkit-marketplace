---
id: halftone-plate
category: texture
nature: rule
name: 网点与套印
status: draft
scenes: [graphic, web]
affinity: [mono-print]
conflicts: []
tokens:
  halftone-cell:
    value: 6px
    role: 网点格距：近看能看见网点，缩略图里主体仍可辨
  registration-offset:
    value: 4px
    role: 两块大面积印版之间的套印偏移，在 1080px 宽的画面上约相当于印刷品的 1–3mm
---

# 网点与套印

## 要点

- 图像转成单色网点：把明暗映射为固定格距（`halftone-cell`）上的圆点大小；副印版只渲染它被指定的那部分。
- 两版用正片叠底（multiply）合成在纸面上；叠印处自然变深。
- 质感只选内容需要的：大面积墨色有 6%–12% 的浓淡起伏，大字与剪影边缘有 1%–4% 的干笔断裂，两块大印版之间有 `registration-offset` 的套印偏移（小字从不偏移）。
- 网页里用 CSS 的 `mix-blend-mode: multiply` 与圆点图案（或预先处理好的图像）实现；不做纸张褶皱、做旧边框和桌面摆拍。

## 适用与边界

当代作品默认干净的纸面和受控的网点，只保留很少的瑕疵。黄纸、棕褐色调和做旧道具不属于这个方向。
