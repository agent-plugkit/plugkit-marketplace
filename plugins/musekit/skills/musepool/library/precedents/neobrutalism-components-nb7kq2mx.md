---
id: nb7kq2mx
category: neobrutalism component library
modality: design-system
view_type: component-library
source_url: https://github.com/ekmas/neobrutalism-components
source_revision: f3c4d42973819ab5cf18697d08d6bd46f384d335
source_license: MIT
visual_assets_included: false
core_dimensions:
- color
- typography
- craft
scores:
  anti_slop_value: 0.6
  code_value: 0.8
  density: 0.5
  motion_intensity: 0.3
  novelty: 0.5
  visual_value: 0.6
tags:
  color:
  - multi-accent
  - saturated
  - black-outline
  domain:
  - developer-tools
  - design-system
  imagery:
  - no-imagery
  - svg-led
  layout:
  - centered
  - card-grid
  material:
  - no-material
  motion:
  - marquee
  - hover-reveal
  style:
  - bold
  - playful
  - brutalist
  tech:
  - react
  - tailwind
  - shadcn-ui
  typography:
  - sans-serif
  - grotesque
dimensions_with_reference: []
---

> 借鉴范围：只借组件层的状态与条带做法；它的页面是居中首屏加卡片网格，版式不作为参考。下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

An open-source collection of neobrutalism-styled React components built on shadcn/ui, presented on a documentation site with a centered landing hero, scattered star shapes and a single call to action. Its purpose is to give developers a ready vocabulary for the style at the component level: buttons, cards, inputs, menus, charts and a marquee band.

# Tech Stack

React components on shadcn/ui and Base UI, styled with Tailwind CSS v4. Style values live in CSS custom properties in one global stylesheet and are exposed as Tailwind theme tokens, so a palette or shadow offset changes in one place. No visual assets from the source project are bundled here; method notes are adapted from the MIT-licensed source at the revision recorded in frontmatter. See `references/third-party-notices.md`.

# Layout

The library does not prescribe page layout. The documentation site is a centered hero followed by component previews; cards in examples sit in ordinary gapped grids.

# Typography

A single geometric sans (DM Sans by default) with two weights: 700 for headings, 500 for base text. Hierarchy comes from size and weight rather than from a separate display face.

# Color

One main accent (a saturated blue by default, swappable), black borders and foreground, and a light secondary background. Shadows and borders share the border color, so the outline and the offset shadow read as one black drawing.

# Components

- Every container and control has a 2px solid black border and a 5px radius.
- The default shadow is a hard 4px × 4px offset with no blur, in the border color.
- Default buttons move by the shadow offset on hover and drop the shadow, so the button appears pressed into its own shadow; a `reverse` variant starts flat and gains the shadow on hover; a `noShadow` variant exists for dense contexts.
- The marquee is a full-width band with top and bottom borders only, bleeding past the side edges, with large repeated text items scrolling horizontally.

# Motion

Motion is limited to the marquee scroll and the press-into-shadow hover translation. Both are short, linear and mechanical rather than springy.

# Craft

The value of the library is consistency: one border width, one shadow offset and one radius across every component, all driven by tokens.
