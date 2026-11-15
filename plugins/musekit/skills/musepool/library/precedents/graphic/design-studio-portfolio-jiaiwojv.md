---
id: JiAIwOJv
scenario: graphic
scenario_name: 平面
category: design studio portfolio
modality: web
view_type: portfolio
core_dimensions:
- motion
- typography
- imagery
scores:
  anti_slop_value: 0.9
  code_value: 0.8
  density: 0.7
  motion_intensity: 0.9
  novelty: 0.8
  visual_value: 0.9
tags:
  color:
  - monochrome-bw
  - black-dominant
  - high-contrast
  domain:
  - studio
  - portfolio
  - art
  imagery:
  - photo-led
  - custom-photo
  - gallery
  layout:
  - full-bleed
  - full-screen
  - fixed-header
  material:
  - no-material
  motion:
  - scroll-driven
  - canvas-animation
  - entrance-animation
  - infinite-loop
  style:
  - minimal
  - editorial
  - bold
  - monochrome-style
  tech:
  - vue
  - vanilla-js
  - webgl
  typography:
  - serif
  - custom-font
  - type-driven
  - tight-tracking
dimensions_with_reference: []
---

> 借鉴范围：可借鉴字体、图像、色彩和视觉焦点；根据内容与交付尺寸重新构图。原参考中的交互可转化为静态节奏。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

A graphic design studio portfolio showcasing print and editorial work. The experience opens with a kinetic typographic instruction sequence—"UP! UP! SCROLL SCROLL DOWN! DOWN!"—set in diamond-shaped white panels against black. This establishes the scroll-driven interaction model before revealing the studio's project archive. The narrative flow: commanding attention through motion → demonstrating craft through project imagery → minimal footer contact. Three category filters (Image/Text/Type) allow browsing different project types.

# Tech Stack

Vue.js 2 SPA with custom WebGL rendering. Scroll hijacking via a 40000vh invisible scrollpane that drives canvas-based image sequencing. CSS custom properties for typography scale. No external animation libraries—custom requestAnimationFrame loop handling texture loading and geometry updates.

# Layout

Full-bleed canvas viewport (100vw × 100vh) with floating header overlay. Absolute positioning throughout—no document flow scrolling. The visual field is dominated by the central animated hero graphic, then transitions to full-screen project imagery on scroll. Header uses z-index: 100 to remain above canvas content. Max content width for text sections: 47rem.

# Typography

Primary font: **BradfordLLWeb** (Lineto, serif with common ligatures). Body: 1.3rem, line-height 1.2, letter-spacing 0.0em. Headings: h2 at 3rem, h3 at 2.2rem, both with line-height 1.1. Links and labels: uppercase, letter-spacing 0.08em. Font-variant-ligatures: common-ligatures enabled throughout. Italic style available via font-style: italic.

# Color

Strict monochrome system: `#000000` background, `#ffffff` text and UI. No accent colors—entire site operates in pure black and white. Images are displayed in full color or grayscale depending on project. Header has `.light` class applying white text for visibility over dark content.

# Imagery

Portfolio photography of print work—books, posters, signage, exhibition graphics, identity systems. Images displayed at 2048px max dimension, served in responsive srcsets. Projects include: architectural practice identity, arts organization branding, furniture catalog, exhibition design. Hero uses an animated GIF sequence showing the diamond typography pattern.

# Components

Minimal component system. Header: inline text with slash-separated category links. No buttons, no cards, no forms. Project blocks: simple image + caption structure. Loader: fixed full-screen black overlay with centered animated GIF (7rem width), fades via `.loaded-content` class toggling opacity.

# Motion

Signature scroll-driven canvas animation. A 40000vh invisible scrollpane captures scroll events; scroll position maps to image sequence progression and 3D camera movement. Custom render loop updates geometry and textures based on scrollTop. Initial state shows kinetic typography hero; scrolling triggers `.started-scrolling` class hiding the hero and revealing project imagery. Opacity transitions: 0.001 → 1 for content fade-in. See references/motion.md for implementation details.

# Algorithms

Standard implementation, no special design.

# Material

Standard implementation, no special design.

# Craft

Loading state management: `.loader` displays until assets ready, then `.loaded-content` fades in content and nav. Scroll initiation detection: `.started-scrolling` class applied on first scroll event, hiding `.first` hero element. Font loading: subset and complete BradfordLLWeb variants with WOFF2/WOFF fallbacks. Favicon suite: full Apple touch icon set, Android icons, MS tile.
