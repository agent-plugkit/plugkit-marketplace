---
id: neo-brutalism
kind: template
name: 新粗野主义
name_en: Neo-Brutalism
family: neo-brutalism
status: draft
source: library
scenes: [graphic, web, slides]
mood: [直接, 有力, 好玩, 年轻, 叛逆, 热闹, 活力, 创意, 工具, bold, playful, brutal, loud]
seeds:
  color: raw-primary
  typography: heavy-grotesk
  grid: stacked-blocks
  spacing: baseline-8
  shape: thick-border
  depth: hard-shadow
  device: sticker-label
  technique: scale-contrast
  imagery: flat-cutout
variants:
  default: yellow
  options: [yellow, pink, lime]
overrides:
  graphic:
    canvas-width: 1080px
    canvas-height: 1440px
    margin: 48px
    gutter: 16px
    size-display: 200px
    size-headline: 88px
    size-title: 40px
    size-body: 24px
    size-meta: 16px
  web:
    breakpoints:
      mobile:
        max-width: 767px
        columns: 4
        gutter: 12px
        margin: 16px
        size-display: 60px
        size-headline: 36px
        size-title: 22px
        ratio-adjacent: 1.6
        ratio-display: 3
exemplars: [pibXRzsG, AT5oq8hX]
---

# 新粗野主义

## 精神

把界面的结构直接露出来：粗边框、硬阴影、平涂的原色块和超粗的字，像一面贴满卡片和贴纸的墙。它不讨好，直接告诉你重点在哪里、按哪里。适合活动、创意工具和年轻品牌；关系与顺序必须坚决清楚，夸张才不会变成混乱。

## 文法

- **网格**：12 栏上堆叠带粗边框的块面，间隙统一；密度可以高，但每块只讲一件事。一个版面只允许一处破格（轻微旋转或错位）。
- **对齐**：块面贴着栏线；块内文字齐左，留足内边距。
- **层级**：超粗展示字与常规正文形成强烈的尺度反差；最重要的块最大、颜色最亮、阴影最明显。
- **留白**：靠块与块之间的统一间隙和块内的内边距，而不是大片空白。
- **色彩**：奶油底上平涂原色块，文字永远是黑色；三种色块按角色分工，彩色不做文字色。
- **装置**：贴纸标签、粗线箭头、大号等宽编号。
- **图像**：平涂插画或带粗边框、色块背景的抠图照片。

## 场景适配

### graphic

海报、封面、社媒图。覆盖值按 1080 × 1440 的画布给出（`canvas-width`、`canvas-height`）。

- 标题本身就是一块砖：超粗、紧排，可以放在一块主色块里，块面带硬阴影；或直接压在奶油底上跨满栏宽。
- 日期、地点等信息放进几块小卡片，卡片带边框和阴影，用第二、三种色块区分。
- 用一张贴纸（旋转不超过 3°）标出最想让人记住的一件事，比如日期或「免费」。
- 一个版面里色块最多三种，阴影方向一致。

### web

官网、落地页、工具界面。参照视口 1440 × 900px，外边距 40px。

- 首屏：超粗标题加一句说明，主操作是带粗边框和硬阴影的主色块按钮；旁边可以放一张旋转的贴纸或一块插画。
- 内容区用卡片网格，每张卡片一个主题，用不同色块区分类型；卡片悬停时阴影加长，按下时缩短并位移。
- 导航是一排带边框的方形按钮或文字链接；当前页用主色块填充。
- 表单输入框用 3px 黑边框和奶油底，焦点时加主色块底和黑色焦点框；错误用文字说明加粗边框，不只靠颜色。
- 窄屏退为 4 栏：卡片单列堆叠，阴影距离不变，展示字按 `mobile` 断点缩小。

## 常见误用

只给普通卡片加粗黑框、随机涂上鲜艳颜色，并不是这种风格；所有元素都有阴影、都在旋转、都抢第一，页面就会变成噪音；把彩色当文字色会让内容读不清。判断方法：去掉颜色后，仍应能凭粗边框、硬阴影和超粗标题看出清楚的主次。

## 范例

- `pibXRzsG` 活动设计机构：粉、橙、绿整块撞色的分区和超粗紧排的标题。借它的色块撞色与标题力度，不借它的胶囊按钮。
- `AT5oq8hX` 品牌设计师作品集：黑底上的超大标题和橙色动态文字段落，标签为 brutalist。借它直接、不讨好的标题处理。
- 库中暂无同时具备粗边框与硬阴影的真实范例。
