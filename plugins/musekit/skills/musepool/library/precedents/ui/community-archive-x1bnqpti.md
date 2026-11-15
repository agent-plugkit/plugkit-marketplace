---
id: x1BNQPTi
scenario: ui
scenario_name: 界面
category: community archive
modality: web
view_type: gallery
core_dimensions:
- layout
- typography
- color
scores:
  anti_slop_value: 0.8
  code_value: 0.5
  density: 0.7
  motion_intensity: 0.1
  novelty: 0.6
  visual_value: 0.7
tags:
  color:
  - monochrome-warm
  - black-dominant
  - warm-tone
  domain:
  - community
  - museum
  - art
  imagery:
  - photo-led
  - mixed-media
  - custom-photo
  layout:
  - masonry
  - full-bleed
  - asymmetric-grid
  material:
  - no-material
  motion:
  - no-motion
  - hover-reveal
  - smooth-scroll
  style:
  - minimal
  - editorial
  - muted
  tech:
  - vanilla-js
  - jquery
  - other-tech
  typography:
  - sans-serif
  - custom-font
  - tight-tracking
  - fluid-type
dimensions_with_reference: []
---

> 借鉴范围：可借鉴交互、导航、组件组织或界面层级；根据当前用户任务、已有设计系统和技术栈重新实现。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

A community archive site for a historic neighborhood, presenting crowd-sourced cultural artifacts in a browsable masonry gallery. The narrative opens with a bold manifesto-style header declaring the archive's purpose, followed by an endlessly scrolling collection of "treasures" — each item represents a piece of local history contributed by community members. The tone is documentary-meets-personal, emphasizing collective memory preservation.

# Tech Stack

Static site with custom CSS utility framework (similar to Tachyons), vanilla JS. Uses Flickity carousel library (evident from CSS). Masonry layout via JavaScript positioning (absolute positioning with calculated top/left values). Leaflet.js for map functionality (CSS present). No React/Vue framework detected.

# Layout

Irregular masonry grid (Pinterest-style) with variable item widths (s1-s12 classes). Items positioned absolutely with calculated percentages (8.33% grid increments). Generous padding (p2 = 2rem) throughout. Responsive breakpoints at 768px, 1024px, 1280px, 1300px, 1600px. Fluid base font sizing (1.88vw to 72.5% at largest breakpoint). Hero section uses full-width text block with embedded logo.

# Typography

Primary font: **Adesso** (custom font, loaded via @font-face from .ttf/.otf files). Bold weight (700) used for headlines. Fluid type scale: fs1 (2rem), fs2 (2.7rem), fs2-5 (4.2rem), fs3 (6.8rem). Tight line-height: lh1 (1.05), lh2 (1.18). Letter-spacing utility ls1 (-0.15em) for tight headings. Dotted underline style for inline links (border-bottom: .1em dotted #000).

# Color

Warm tan/cream background: `#f0dba8` (set inline on body). Pure black `#000` for text, borders, and UI elements. Pure white `#fff` for contrast elements. No other colors in palette — monochrome on warm ground. Hover states use `mix-blend-mode: multiply` with black background on pills.

# Imagery

Mixed photography — historical photos, scanned documents, object photography, portraits. Images use `background-image` with `background-size: cover` and `padding-top` aspect ratio technique (66%, 75%, 100%, 129% etc). Lazy loading via `b-lazy` class. Some items are text-only (no image). Sepia/warm tone treatment on many photos harmonizes with tan background.

# Components

**Pills**: Rounded tag buttons with 1.5px black border, `border-radius: .4em`, padding `.35em .45em .3em`. Categories include: Art/Culture, Food, Business, Spiritual, Political, Housing, Sports, Other, plus era tags (1900-1920, 1940-1960, etc).

**Cards**: No visible card container — items are minimal with image + title + tags. Block-level links wrap entire item.

**Banner**: Top notification bar with 1.5px black border, rounded corners (br12 = 1.2rem), centered text.

# Motion

Minimal motion. No scroll animations detected. Hover effects: pills invert to black background with white text using `mix-blend-mode: multiply`. Link underlines disappear on hover. Standard implementation for the rest.

# Algorithms

Standard implementation, no special design.

# Material

Standard implementation, no special design.

# Craft

**Border radius**: 1.2rem (br12) for large containers, .4em for pills. **Borders**: Consistent 1.5px solid black throughout. **Focus**: Not customized. **Scrollbar**: Not customized. The dotted underline on links (`.1em dotted #000`) is a distinctive craft detail.
