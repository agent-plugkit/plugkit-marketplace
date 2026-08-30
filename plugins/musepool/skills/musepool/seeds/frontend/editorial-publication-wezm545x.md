---
id: weZM545X
scenario: frontend
scenario_name: 前端开发
category: editorial publication
modality: web
view_type: landing
core_dimensions:
- typography
- algorithms
- layout
scores:
  anti_slop_value: 0.95
  code_value: 0.85
  density: 0.85
  motion_intensity: 0.6
  novelty: 0.9
  visual_value: 0.9
tags:
  color:
  - monochrome-bw
  - high-contrast
  - black-dominant
  domain:
  - art
  - fashion
  - blog
  imagery:
  - photo-led
  - custom-photo
  - full-bleed-img
  layout:
  - split-screen
  - asymmetric-grid
  - full-bleed
  - scrollytelling
  material:
  - no-material
  motion:
  - scroll-triggered
  - hover-reveal
  - smooth-scroll
  style:
  - experimental
  - brutalist
  - monochrome-style
  tech:
  - vanilla-js
  - gsap
  - webgl
  typography:
  - sans-serif
  - serif
  - monospace
  - custom-font
  - dual-font
  - experimental-type
dimensions_with_reference: []
---

> 场景适配:适用于网站、Web App、落地页、交互体验。重点关注布局结构、动效编排与字体系统的实现方式。

# Narrative

An arts/culture publication issue page presenting a curated collection of artist interviews and essays. The narrative structure is a vertical scroll through article cards, each featuring a featured artist. The editorial stance is avant-garde and experimental—each article is introduced with a split-screen composition: documentary photography on one side, expressive typography on the other. A recurring scrambled, multi-font header motif appears across all articles, unifying the issue thematically.

# Tech Stack

Vanilla JS with GSAP for animations. Custom Web Components (`article-card`, `font-mixer`, `chaos-text`) handle the modular architecture. CSS uses fluid viewport-based sizing (`html{font-size:.55vw}` scaling to `.8vw` at 1600px and `2.3vmin` mobile). No React/Vue framework—native DOM manipulation with custom element lifecycle.

# Layout

Split-screen asymmetric grid: each article card uses `grid-template-columns` with varying ratios (43%–60% text, remainder image). Text and image sides swap alignment positions across articles—some text-left/image-right, others reversed. Generous whitespace with fluid padding (`padding: 0px 14%` for article type). Images maintain aspect ratios via CSS custom properties (`--ratio`). Viewport-height-aware sizing system using CSS variables (`--viewport-height`, `--header-height`).

# Typography

Four-font system: **HelveticaNeue-Medium** (sans-serif body), **TimesNewRomanMTStd-Bold** (serif accents), **MagdaClean-Regular** (monospace/technical), **Display-Mix-Regular** (display/decorative). Font classes: `.ff-sans-serif`, `.ff-serif`, `.ff-mono`, `.ff-display`. Fluid responsive text via JavaScript (`responsive-text` class with calculated `font-size`). Tight line-heights: `.lh-tight{line-height:.85}`, `.lh-text{line-height:1.1}`. Uppercase treatment for headers and navigation.

# Color

Strict monochrome palette: pure black `#000` and pure white `#fff` dominate. Text in `#222` (near-black) for body. Selection inverted: `::selection{color:#fff;background:#000}`. No accent colors—the visual interest comes from typography and imagery, not hue variation.

# Imagery

Full-bleed documentary photography with mixed orientations (portrait and landscape). Custom responsive image component with lazy loading (`lazyautosizes lazyloaded`). Images have natural color grading—no duotone or filter effects applied in CSS. Photography subjects: artists, behind-the-scenes documentation, staged portraits. Placeholder system with aspect ratio preservation via `--ratio` CSS variable.

# Components

**Article cards**: `article-card` custom element with `data-layout="random"` and `data-type="article"`. Block-link pattern for click targets. **Font mixer**: `font-mixer` component scrambles individual letters across font families—each character wrapped in separate `<div>` with font-class assignment. **Chaos text**: `chaos-text` component generates procedural SVG masks using randomized circles, ellipses, and rectangles. Mask density controlled by `data-words` attribute. **Navigation**: Minimal header with SVG logo and uppercase text links using font-mixer for hover effects.

# Motion

Scroll-triggered animations via GSAP. Font mixer letters have micro-transforms on scroll (`transform: translate(X%, 0px)` with per-letter random values). Chaos text masks generate new random dot patterns. Smooth scroll behavior for anchor links (`scrollIntoView({behavior:'smooth'})`). Page transitions use `transition-blink` class. Responsive text recalculates on resize (via `ResizeObserver` pattern).

# Algorithms

Procedural SVG generation for text masking. The `chaos-text` component creates randomized dot patterns using configurable parameters: `amount:300`, `radius:10`, `radiusMax:30`, shapes include `circle`, `ellipse`, `rectangle`. Dot placement uses collision detection (`overlaps()` method) with `triesLimit:10000`. Random stroke widths `0–5px`. Mask applied via `mask-image: url("data:image/svg+xml;base64,...")`. See references/algorithms.md for implementation.

# Material

Standard implementation, no special design.

# Craft

Custom cursor behavior via `hideselect` class. Zero border-radius—sharp rectangular aesthetic throughout. No box shadows. Image placeholders use subtle blur-up pattern. Webfont loading with `font-display:swap`. Mobile viewport locked: `maximum-scale=1.0, user-scalable=0`.

# Coherence

The design system achieves coherence through constraint: four fonts, two colors, one layout pattern (split-screen), one generative technique (chaos masking). The recurring scrambled multi-font header acts as a rhythmic anchor across the vertical scroll. The monochrome palette forces attention to typographic texture and photographic content.
