---
id: halftone-plate
category: texture
nature: rule
name: 网点与套印
status: draft
scenes: [graphic, web]
affinity: [mono-print]
conflicts: []
tools: [assets/halftone.js]
tokens:
  halftone-cell:
    value: 6px
    role: 网点格距：近看能看见网点，缩略图里主体仍可辨
  halftone-angle:
    value: 45deg
    role: 主印版的网屏角度
  halftone-angle-accent:
    value: 75deg
    role: 副印版的网屏角度；与主版相差 30°，避免龟纹
  ink-drift:
    value: 0.08
    role: 大面积墨色的浓淡起伏幅度，0.08 表示墨量在 ±8% 内起伏；可在 0.06–0.12 之间取值
  dry-break:
    value: 0.02
    role: 网点印版与剪影边缘缺失圆点的比例；可在 0.01–0.04 之间取值
  registration-offset:
    value: 4px
    role: 副印版相对主印版向右下的套印偏移，在 1080px 宽的画面上约相当于印刷品的 1–3mm
---

# 网点与套印

## 要点

- 图像转成单色网点：把明暗映射为固定格距（`halftone-cell`）上的圆点大小；主版网屏转 `halftone-angle`，副版转 `halftone-angle-accent`。副印版只渲染它被指定的那部分。
- 两版用正片叠底（multiply）合成在纸面上；叠印处自然变深。
- 质感只选内容需要的：大面积墨色有 `ink-drift` 的浓淡起伏，网点印版与剪影的边缘有 `dry-break` 的干笔断裂，两块大印版之间有 `registration-offset` 的套印偏移（小字从不偏移）。标题、正文等 DOM 文字保持干净，不做断裂。
- 网点用插件的网点模块画在画布上，网页用 CSS 的 `mix-blend-mode: multiply` 叠在纸色上，海报按同样顺序合成后导出；不做纸张褶皱、做旧边框和桌面摆拍。

## 适用与边界

当代作品默认干净的纸面和受控的网点，只保留很少的瑕疵。黄纸、棕褐色调和做旧道具不属于这个方向。
