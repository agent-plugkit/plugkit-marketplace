---
id: haYCh1wI
scenario: information
scenario_name: 信息表达
category: fashion archive
modality: web
view_type: gallery
core_dimensions:
- layout
- typography
- color
scores:
  anti_slop_value: 0.9
  code_value: 0.7
  density: 0.9
  motion_intensity: 0.4
  novelty: 0.8
  visual_value: 0.85
tags:
  color:
  - blue-dominant
  - high-contrast
  - accent-blue
  - white-dominant
  domain:
  - fashion
  - portfolio
  - ecommerce
  imagery:
  - photo-led
  - custom-photo
  - thumbnail-grid
  layout:
  - full-bleed
  - text-led
  - image-led
  - sticky-sections
  material:
  - no-material
  motion:
  - hover-reveal
  - scroll-triggered
  - page-transition
  - smooth-scroll
  style:
  - brutalist
  - editorial
  - bold
  - minimal
  tech:
  - vanilla-js
  - gsap
  - shopify
  typography:
  - sans-serif
  - oversized-type
  - tight-tracking
  - custom-font
  - fluid-type
dimensions_with_reference: []
---

> 借鉴范围：可借鉴信息层级、标注、阅读顺序或解释方法；事实、数据和科学结论必须来自当前任务的原始资料。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

A Swiss menswear fashion label archive site presenting collections, campaigns, press coverage, research, and products. The narrative structure is a dense, scannable index — each entry displays metadata (content type, location, collaborators, year) in a tabular format alongside oversized titles and horizontal image strips. The site functions as both a portfolio and an e-commerce platform, with Shopify integration for product sales.

# Tech Stack

Kirby CMS (PHP) with custom frontend. Swup for page transitions. Shopify Buy SDK for e-commerce. Flickity for carousels. Plyr for video. GSAP/TweenLite for animations. Custom font "SBM" embedded as base64 WOFF data URI.

# Layout

Brutalist editorial layout with extreme information density. Fixed header with flexbox navigation. Main content is a vertical list where each row contains: left-aligned metadata table (6.9rem fixed width) + massive title + horizontal image strip. Sticky filter bar below header. Fluid viewport-based typography scales from 0.7vw (1901px+) to 1.1vw (1600px) to 14px (mobile). Negative space is minimal; content bleeds to edges.

# Typography

Primary font: SBM (custom sans-serif, embedded as data URI). Body size: 0.753rem with 1rem line-height. Massive display type for titles: 6.0241rem (desktop), scaling to 3.01205rem (mobile). Tight line-height (5rem for desktop titles, 2.5rem mobile). All caps used in UI elements. Bracket syntax `[content]` for metadata values. Checkbox-style navigation indicators `[✔]` with accent color.

# Color

Electric blue accent: `#1100FF` (CSS variable `--accent-color`). Pure black text `#000` on white background. Header background is the accent blue; active tab inverts to white background with black text. Images load with blue mask overlay that fades on reveal. Selection background is semi-transparent accent blue.

# Imagery

Horizontal image strips within each list item, implemented as flexbox rows. Images lazy-loaded with `LazyLoad` component. Each image wrapped in container with blue mask overlay (`background: var(--accent-color)`) that fades on scroll into view. Thumbnails are 200px height with varying widths. Product images are 1418x1418px square format. Mix of campaign photography, catwalk shots, product renders, and press clippings.

# Components

**Navigation**: Flexbox header with equal-width tabs. Active state uses `border-radius: 0 1rem 0 0` (rounded top-right corner only) with background inversion. Mobile hamburger menu triggers full-screen overlay with `backdrop-filter: invert(1)`.

**List Items**: Each entry is an anchor containing a metadata table (title/content rows) and a title section with image strip. Hover on title changes color to accent blue.

**Metadata Table**: Flexbox rows with 6.9rem basis for labels. Content values wrapped in brackets `[value]` with accent color text and black brackets.

**Cart**: Shopify Buy SDK integration with slide-in panel from right, full height, accent blue background.

# Motion

Page transitions via Swup (slide/fade effects). Lazy-loaded images fade in with 100ms opacity transition after blue mask reveal. Image masks have subtle transition effect. Slider navigation uses custom cursor — hovering over prev/next buttons shows text label that follows cursor position. Cart panel slides in with 250ms cubic-bezier(0.165, 0.84, 0.44, 1) easing. Sticky filter bar maintains position on scroll.

# Algorithms

Standard implementation, no special design.

# Material

Standard implementation, no special design.

# Craft

Custom checkbox navigation pattern using `[✔]` character that toggles opacity on active state. Bracket syntax as visual design element throughout. Rounded corner on active tabs only (top-right), creating distinctive "tab folder" aesthetic. Empty collaborators shown as `∅` symbol. External links show origin on hover via `data-origin` attribute and `\002197` (↗) arrow.
