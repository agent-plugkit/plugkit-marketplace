---
id: mono-print
kind: template
name: 单色编辑印刷
name_en: One-and-Two-Ink Editorial Print
family: mono-print
status: draft
source: library
scenes: [graphic, web, slides]
mood: [印刷, 质感, 独立出版, 文化, 手作, 复古而不旧, 张力, zine, print, risograph, halftone, duotone]
seeds:
  color: two-plate
  typography: plate-grotesk
  grid: print-asymmetric
  spacing: baseline-8
  shape: zero-radius-hairline
  texture: halftone-plate
  device: index-and-rule
  technique: scale-contrast
  imagery: halftone-photo
variants:
  default: cobalt-terracotta
  options: [cobalt-terracotta, charcoal-red, oxblood-green, ultramarine-orange]
overrides:
  graphic:
    canvas-width: 1080px
    canvas-height: 1440px
    margin: 64px
    gutter: 16px
    size-display: 200px
    size-headline: 80px
    size-title: 32px
    size-body: 22px
    size-meta: 15px
  web:
    breakpoints:
      tablet:
        max-width: 1100px
      mobile:
        max-width: 767px
        columns: 4
        gutter: 16px
        margin: 24px
        size-display: 56px
        size-headline: 32px
        size-title: 20px
        ratio-adjacent: 1.6
        ratio-display: 3
exemplars: [mC1nkP2t, C4aZtWoH]
---

# 单色编辑印刷

## 精神

像一张用两块印版印出来的海报或独立刊物：有限的油墨、看得见的纸、机械复制的图像，以及一个强烈的焦点事件和一块安静的释放区。限制本身就是表达。适合文化活动、独立出版、音乐与城市主题。

## 文法

- **网格**：2–3 栏的不对称编辑网格，外边距约为画面宽度的 5%–9%；先选构图家族，再排细节。
- **对齐**：标题与图像发生关系（压住、穿过、紧贴），事实小字对齐在一条安静的边线上。
- **层级**：一个焦点事件（超大文字、极端裁切、巨大局部或一次叠印碰撞），展示字至少是事实小字的 5 倍；放大到 10 倍以上时，事实小字要排成整齐的块，不能散落。
- **留白**：至少一块有形状的释放区（开放纸面或浅网点），与焦点形成对比。
- **色彩**：纸加两种油墨；主印版承担大部分面积和全部小字。副印版约占 15%–30%，只承担一个明确的角色（日期、注释或一次叠印），以大面积网点、色块或大字出现。
- **质感**：单色网点、正片叠底、少量浓淡起伏与套印偏移，只在内容需要时出现。
- **装置**：细规线、编号与等宽元数据栏，像一张信息海报。
- **图像**：单色网点或高反差剪影，大胆裁切。
- **状态**：表单像一张登记卡：等宽标签、细规线输入框；出错时规线加粗到 `rule-state`，下方写一行主印版说明；完成后用副印版大字盖一枚「已登记」。

## 场景适配

### graphic

海报、封面、zine、社媒图。覆盖值按 1080 × 1440 的画布给出（`canvas-width`、`canvas-height`）。

- 主印版铺出焦点：一张网点图像或一个超大的标题，占画面一半以上；副印版承担一个角色：大号日期、一处注释或与主图的一次叠印碰撞，以网点或大字出现。
- 标题与图像发生碰撞：压住物体的一部分或沿着它的边缘排布，文字始终完整可读。
- 事实信息（日期、地点、主办方）用等宽小字排成规线信息栏，放在释放区的一侧。
- 没有照片时，用程序生成的网点图形（与主题相关的物件剪影、几何形、声波）或文字宣言作为焦点；不用生成图冒充真实场景。
- 生成网点图像时，把图像生成与文字排版分开：先得到无字图像并做网点处理，再在独立的文字层排入准确的文字。

### web

活动网站、独立刊物、作品集。参照视口 1440 × 900px。

- 首屏是一张「印出来的海报」：网点图像或超大标题作为焦点，一块开放纸面作为释放区，事实信息用等宽规线栏。
- 网页的颜色仍然只有纸和两种墨；按钮用主印版实色加纸色文字，悬停时加下划线。副印版色块上只放大字。
- 列表与日程用细规线分隔的行，日期等宽；图像全部以网点或双色调呈现（CSS `mix-blend-mode: multiply`）。
- 首屏以下像一册 zine 的内页：每一段换一个构图家族（规线信息表、标本加注释、文字宣言、重复物件场），每段只有一个焦点事件和一块释放区。
- 1100px 以下：焦点图像缩到 7–8 栏，事实规线栏放在它的右侧或下方，保证首屏能看到日期和主操作。
- 窄屏退为 4 栏：焦点图像或标题跨满宽度，释放区缩小但保留，展示字按 `mobile` 断点缩小。

## 常见误用

只给普通照片加蓝色滤镜，不是双色印刷；加上黄纸、做旧边框、桌面摆拍，会把当代印刷变成怀旧道具；用了三种以上的颜色或渐变，会失去「印版」的约束。判断方法：去掉颜色后，仍应能看出唯一的焦点事件、一块有形状的释放区和清楚的事实栏。

## 范例

- `mC1nkP2t` 单色／双色编辑印刷系统：本风格的主要来源（MIT 许可），包括印版分工、配方、网点流程与构图家族。
- `C4aZtWoH` 摄影毕业展：单色高反差、像视力表一样递进的字号。看它怎样只用一种颜色建立强烈的尺度关系。
