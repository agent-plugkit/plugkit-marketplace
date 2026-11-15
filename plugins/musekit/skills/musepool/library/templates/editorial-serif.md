---
id: editorial-serif
kind: template
name: 编辑衬线
name_en: Editorial Serif
family: editorial-serif
status: draft
source: library
scenes: [graphic, web, slides, data]
mood: [文学, 阅读, 出版, 优雅, 人文, 温暖, 杂志, 书, 慢读, 文化, serif, editorial, magazine, literary]
seeds:
  color: ivory-burgundy
  typography: serif-editorial
  grid: editorial-columns
  spacing: baseline-8
  shape: zero-radius-hairline
  device: drop-cap-and-folio
  technique: pull-quote-rhythm
  imagery: captioned-photo
variants:
  default: burgundy
  options: [burgundy, forest]
overrides:
  graphic:
    canvas-width: 1080px
    canvas-height: 1440px
    margin: 72px
    gutter: 16px
    size-display: 136px
    size-headline: 56px
    size-title: 30px
    size-body: 22px
    size-meta: 15px
  web:
    breakpoints:
      mobile:
        max-width: 767px
        columns: 4
        gutter: 16px
        margin: 20px
        size-display: 48px
        size-headline: 32px
        size-title: 22px
        size-body: 18px
exemplars: [B3LYgTWe, rvYJrbZh, G26LBSOO]
---

# 编辑衬线

## 精神

像一本好杂志那样组织页面：标题有分量，正文好读，图像和图注各就其位。优雅来自比例、行距和衬线体的质感，而不是装饰。适合需要被认真阅读的内容：文化活动、出版物、研究报告、长篇叙事。

## 文法

- **网格**：12 栏，正文栏宽 6–7 栏并控制行长，旁边留一条窄栏放旁注、图注与署名；标题可以比正文更宽。
- **对齐**：标题与正文共享左边线；旁注与它对应的段落顶部对齐。
- **层级**：标题、导语、正文三级清楚；导语用斜体（中文用淡墨与更大行距）；字重只用常规与半粗。
- **留白**：段落之间用正常段距，章节之间用一条细线和栏目名，像翻页一样明确。
- **色彩**：象牙纸面与近黑墨色承担阅读；强调色出现在固定的编辑位置：栏目名、首字下沉、引文标记、链接。
- **装置**：首字下沉（每篇一次）、书眉式的页眉页码、署名行、引文。
- **图像**：带图注的摄影，完整或大胆裁切二选一。

## 场景适配

### graphic

海报、封面、社媒图。覆盖值按 1080 × 1440 的画布给出（`canvas-width`、`canvas-height`）。

- 版面像杂志封面：顶部一行书眉（刊名或活动名、期号或日期），标题占据上半部分并可以比正文宽，导语用斜体紧跟其后。
- 有摄影时，图像占画面一半以上，标题叠在图像安静的区域或放在图像下方；没有摄影时，标题与一段真实引文承担画面。
- 日期、地点、主办方排在底部的一行或两行等宽小字里，上方一条细线。
- 强调色只用在刊名、首字或一个关键词上。

### web

官网、出版物、文章页。参照视口 1440 × 900px，外边距 80px。

- 首屏：书眉式导航（站名在左，栏目链接在右，一行小字），标题跨 9–10 栏，下方斜体导语和署名行；关键日期与地点放在旁注栏。
- 正文页：正文栏 6–7 栏居左或略偏左，旁注栏在右；首字下沉一次；每隔几屏用引文或图像打断。
- 列表（日程、文章目录）用细线分隔的行：标题衬线体，日期与分类等宽小字。
- 主操作用墨底纸字按钮或强调色文字链接加下划线，不用圆角胶囊。
- 窄屏退为 4 栏：旁注移到对应段落之后，正文字号保持 18px 以上（`mobile` 断点给出）。

## 常见误用

只把字体换成衬线体、其余仍是卡片网格和圆角按钮，不是编辑风格；正文行长过宽、行距过紧会让「优雅」变成难读；处处用强调色、到处首字下沉会显得廉价。判断方法：去掉颜色后，仍应能看出清楚的标题、导语、正文三级和像杂志一样的栏位。

## 范例

- `B3LYgTWe` 艺术中心：暖奶油底色上的衬线大标题，8/4 栏的不对称主栏与侧栏。看它怎样用衬线体同时承担标题与正文。
- `rvYJrbZh` 艺术家作品集：粗斜体标题加正文的连续文字流，像在读一份宣言。看它怎样只靠排印建立层级。
- `G26LBSOO` 研究报告：Didone 衬线展示字、编号章节和整块的强调色。看它怎样把编辑排版用于研究内容。
