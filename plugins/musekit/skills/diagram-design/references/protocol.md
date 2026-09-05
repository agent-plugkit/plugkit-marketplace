# 图解 HTML 接入协议 v1

一个文件对应一个轴对齐的 HTML 画布。原始文案和样式保留在 DOM/CSS；JSON 只拥有关系与布局。提供任意 HTML 自动识别不在本协议范围内。

## 标记

| 标记 | 用途 |
| --- | --- |
| `data-diagram` | 唯一 HTML 画布容器，声明初始 CSS 宽高 |
| `data-diagram-region="header"` | 页眉，最多一个；可选 |
| `data-diagram-region="body"` | 唯一主体，包含节点、分组、行与标签 |
| `data-diagram-region="footer"` | 页脚，最多一个；可选 |
| `data-diagram-node="A"` | 普通模块或注释，稳定 ID |
| `data-diagram-group="area"` | 容纳子节点、注释和其他分组的真实 DOM 父容器 |
| `data-diagram-row="row1"` | 时序消息的行；声明初始 y，至少 1px 高 |
| `data-diagram-actor` | 与 node 标记同用，参与者只允许横向移动 |
| `data-diagram-label="edge1"` | 对应连线的完整标签容器，一个连线最多一个 |
| `data-diagram-locked` | 锁定标记对象的位置与尺寸；随所属分组移动 |
| `data-diagram-surface` | 混合画布中的 SVG，坐标与画布 CSS 像素一一对应 |
| `data-diagram-background` | 随可增长 SVG 画布调整宽高的背景 rect |
| `data-diagram-frame` / `data-diagram-content` | SVG 节点中的外框与完整内容；外框为 rect 时可调整尺寸 |

对象与连线 ID 全局唯一，以字母开头，后接字母、数字、下划线、点或横线。不要让同一元素兼任节点、分组、标签或行。分组的标题、说明与子节点必须真正位于组内；需要单独移动的注释也标为节点。普通节点不要嵌套普通节点，需要嵌套时使用 group。

HTML 模块的根元素拥有背景、边框、内边距与文本。运行时在外面增加定位外壳，并冻结初始排版；拖动后的尺寸或位置不再由 Grid/Flex 重排。节点外框大小和文字大小独立。HTML 的查看缩放由编辑器统一管理，不在节点上另加缩放；SVG 支持嵌套平移与轴向缩放。可编辑对象不支持旋转、倾斜、透视或非轴对齐变换。

纯 SVG 节点示意：

```html
<g data-diagram-node="A">
  <rect data-diagram-frame x="80" y="240" width="260" height="130" fill="#fff" />
  <g data-diagram-content>
    <text x="100" y="280">接收请求</text>
    <text x="100" y="312"><tspan x="100">较长的说明先在源码中分行</tspan></text>
  </g>
</g>
```

SVG 不自动重新断行；运行代码测量所有内容并限制外框最小尺寸。无 rect 外框的对象可移动，不能通过拉伸改变形状；复杂装饰应锁定或留在分组内。

## 关系与初始选项

```html
<script type="application/json" id="diagram-config">
{
  "version": 1,
  "name": "artwork",
  "gap": 24,
  "fixedSize": false,
  "rowGap": 28,
  "edges": [
    {
      "id": "edge1", "from": "A", "to": "B",
      "kind": "orthogonal", "color": "#334155", "width": 2,
      "fromPort": {"side": "right", "at": 0.5},
      "toPort": {"side": "left", "at": 0.5}
    }
  ]
}
</script>
```

`kind` 默认为 `orthogonal`，还支持 `straight`、`loop`、`sequence`。端口比例为 0–1；省略端口时根据相对位置选边。自循环使用相同端点和不同端口。`dash` 可声明 SVG 虚线，例如 `"6 5"`；`arrow: false` 用于不带箭头的注释关联线。直线不绕障碍，受阻时报告；正交线尝试寻找通路，失败后保留提示供人工调整。只有正交线或回路确需固定中间点时才提供 `points`；默认交给自动走线。直线与时序消息不使用中间点，也不显示折点控件。手工点导致相邻线段折返重叠时报告 `backtrack`，不静默丢弃固定点；“恢复自动走线”清除包括作者预设在内的固定点。

时序连线的 `from` / `to` 指向 actor，并添加 `row: "row1"`。`from === to` 表示自调用。生命线与端点由 actor 的实际中心计算；请求、返回、顺序与分支归属由作者声明，编辑器不会改业务关系。将分支消息行放进对应 group，行距受前后消息和标签实测高度约束；分组移动也不能使消息互相越过。

## 保存状态

编辑器生成 `script#diagram-state[type="application/json"]`，作者通常无需手写：

```json
{
  "version": 1,
  "initialized": true,
  "bodyOffset": 24,
  "nodes": {"A": {"dx": 16, "dy": 8, "w": 280, "h": 150}},
  "edges": {"edge1": {"label": {"dx": 12, "dy": -8}, "points": [{"x": 410, "y": 350}]}}
}
```

位移以原始构图为基准，单位为未缩放的画布 CSS 像素。节点尺寸是外框尺寸；分组扩大容纳空间，不缩放子节点。`points` 是手工固定的中间点，不包含两个端点，y 不包含 `bodyOffset`。节点移动后端点继续跟随，手工点保留；移动同时包含两端的分组时，中间点一起移动。标签偏移相对自动位置，仍绑定原连线。端口覆写放在该连线状态的 `fromPort` / `toPort` 中。

保存使用初始 DOM 与当前状态重建文件，清除编辑界面、选择框和诊断覆盖层；重复保存重开不会累计运行时 transform。不读取或写入 localStorage、IndexedDB、网络或原始 `.mmd`。

## 制作和验证接口

封装后的页面提供 `window.museDiagram.ready`、`getState()` 和 `getGeometry()`，用于经授权的浏览器检查；`getGeometry()` 返回画布坐标下的节点、端点、标签边界与问题列表。`data-diagram-ready="true"` 表示初始化完成，`data-diagram-error` 给出初始化错误。几何无提示仍需实际查看与语义核对。

维护运行代码时修改 `src/`，从仓库运行 `npm run build:diagram` 更新 bundle 与示例。作者只运行 [prepare_diagram.py](../scripts/prepare_diagram.py)，不需要自行构建运行资源。
