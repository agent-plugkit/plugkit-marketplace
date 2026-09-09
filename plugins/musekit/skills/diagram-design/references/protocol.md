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

## 自动端点分散

`diagram-config.portDistribution` 可选 `"center"` 或 `"spread"`，缺省为 `center`，协议与保存状态仍为 v1。新制作起点显式设置 `spread`；重新封装旧 HTML 不自动补写该字段。旧图需要改变连线布局时，作者明确加入该设置。

`spread` 只分散未声明端口的正交端点。同侧端点按对端中心位置排序，稳定连线 ID 处理并列，不依赖关系数组顺序。显式端口作为固定占位，带有效手工折点的连线、直线、自循环和时序消息保持原规则。角部留白为 12 CSS px，目标间距为 12 px，最小间距为 6 px；空间不足时保留确定的原端点并报告提示，不覆盖固定位置。移除有效手工折点后可重新参加自动分散。

计算结果只存在于运行时；编辑器显示实际端口值，手动调整成为既有端口覆写。`getGeometry().edges` 追加有效 `fromPort` / `toPort`，时序仍由 actor 与 row 决定。

## 阅读名称与关系

普通节点和 actor 可选 `data-diagram-title="简短名称"`；不标记时依次使用节点标题、完整文本、ID。它只服务阅读名称，不替换文案，不改变来源含义。搜索同时匹配 ID、名称和文本。分组与消息行不混入节点结果，重名节点用 ID 区分。

阅读面板只读取声明的直接关系；按入边、出边、无箭头关联、自循环展示，重复消息按原声明分别保留。缺少标签显示“未标注关系”，不推断调用、因果或传递影响。阅读状态仅在内存中，保存、PNG、URL、浏览器存储和布局历史均不记录它。

## 诊断与报告

`getGeometry().issues` 保留 `type`、`id`、`message`，追加：

- `code`：稳定规则代码，如 `geometry/label-line`。
- `severity`：`error` 或 `warning`。
- `relatedIds`：关联对象或连线的稳定 ID。
- `evidence`：未缩放 CSS 像素下的问题 `region`、关联区域或实测 `distance` / `length` 与阈值。
- `supportedFixes`：可用修复方向的稳定标识，例如 `move-label`、`edit-ports`、`edit-bends`、`reset-route`、`resize-node`。它们是建议，不是自动修改命令；具体对象不具备的控制项不能作为建议。

现有碰撞、越界、内容溢出、走线受阻等仍为错误。新增提示：

| 代码 | 判定 |
| --- | --- |
| `geometry/shared-route` | 不同关系沿同一直线连续重合至少 24 px；合并共线片段，排除共享端点附近的 14 px 短段。 |
| `geometry/border-run` | 与可见矩形分组边框平行，间距小于 4 px，连续长度至少 24 px；垂直跨边界不报告。 |
| `geometry/label-clearance` | 标签与非所属连线间距小于 4 px；已有标签覆盖连线错误时不重复提示。 |
| `geometry/port-crowding` | 自动端点无法满足 6 px 最小间距。 |

规则阈值统一维护于运行代码，首版不提供逐图忽略或阈值覆写。纯 SVG 分组以直接子级 `rect[data-diagram-frame]` 的可见描边为矩形外框；HTML 分组只检查可见的边框侧。

浏览器检查报告 `schemaVersion: 2` 保留原字段，增加 `policy`、`errorCount`、`warningCount`、HTML 与内嵌运行资源的 `sha256` / `bytes`，PNG 也携带摘要。`policy` 为 `errors-only` 或 `strict`；`passed` 只证明该策略下列出的程序检查。`visualReview` 和 `semanticReview` 固定为 `not-performed`，人工核对另行记录。交付报告另含冻结输入的摘要及交付批次信息。
