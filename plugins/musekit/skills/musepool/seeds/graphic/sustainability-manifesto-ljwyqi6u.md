---
id: LjwyQI6U
scenario: graphic
scenario_name: 平面
category: sustainability manifesto
modality: web
view_type: landing
core_dimensions:
- layout
- typography
- motion
scores:
  anti_slop_value: 0.92
  code_value: 0.7
  density: 0.85
  motion_intensity: 0.45
  novelty: 0.75
  visual_value: 0.88
tags:
  color:
  - monochrome-bw
  - high-contrast
  - light-bg
  domain:
  - campaign
  - corporate
  - product-showcase
  - sports
  - education
  - sustainability
  - circular-design
  imagery:
  - photo-led
  - macro
  - product-render
  - custom-photo
  layout:
  - asymmetric-grid
  - horizontal-scroll
  - fixed-header
  - full-bleed
  material:
  - no-material
  motion:
  - infinite-loop
  - snap-scroll
  - hover-reveal
  style:
  - swiss-style
  - minimal
  - technical
  - editorial
  tech:
  - react
  - gatsby
  - other-tech
  typography:
  - sans-serif
  - geometric-sans
  - all-caps
  - oversized-type
  - tight-tracking
dimensions_with_reference: []
---

> 借鉴范围：可借鉴字体、图像、色彩和视觉焦点；根据内容与交付尺寸重新构图。原参考中的交互可转化为静态节奏。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

A sustainability manifesto site for a consumer brand's environmental initiative. The narrative flows from a bold, all-caps visionary hero statement through a definition section that pins circular design down in a single plain-language sentence, to a horizontal-scrolling principles gallery covering material selection, recyclability, waste reduction and related tenets. The voice is technical yet optimistic, positioning design as a tool for planetary impact.

# Tech Stack

Gatsby static site with React and styled-components for CSS-in-JS. Custom Helvetica Neue font loaded via @font-face. No external animation libraries—motion handled via CSS transforms and React state.

# Layout

Strict Swiss grid system with visible 1px black borders dividing sections. Hero uses CSS Grid with areas: title (full-width), three spacer columns, subtitle (left), and rotating emblem (right). Definition section splits into left label column and right content column. Principles section employs horizontal scroll container with snap-scroll behavior. Cards in the horizontal scroll alternate vertical offset—odd items translate up 0.6rem, even items down 0.6rem—creating a rhythmic stagger.

# Typography

Helvetica Neue (400 weight) throughout. Hero titles scale fluidly: 2.181rem base → 2.803rem at 1024px → 3.602rem at 1900px → 5.948rem at 2100px. All-caps treatment for headlines. Body text uses 1.321rem with 1.4 line-height. Section labels are uppercase with tight tracking. A distinctive technique: headlines have a CSS-generated underline via `linear-gradient(to bottom, #000000 1px, transparent -1px)` creating horizontal rules between text lines.

# Color

Monochrome palette: pure white (#ffffff) backgrounds, pure black (#000000) text and borders. No accent colors—visual interest comes from photography and layout.

# Imagery

High-contrast macro photography of shoe materials and components against pure black backgrounds. Subjects include: Knitted fabric textures, cushioning units, laces, synthetic leather swatches. One standout image shows Earth seen from space. Images use 120% padding-top aspect ratio containers with `background-size: cover`. The black backgrounds create seamless integration with the monochrome UI.

# Components

Cards in the principles section have a signature structure: three-digit numbered index (001, 002, …), square image container, and uppercase label below. Each card features 8 draggable corner dots (7px circles with 1px black border) positioned absolutely at corners and midpoints—suggesting design-tool handles or selection states. Video play button is a custom SVG: white circle outline with white triangle fill, centered via translate3d.

# Motion

A rotating radial emblem in the hero—a petal-like SVG mark that spins continuously. Horizontal scroll section uses `scroll-snap-type: x mandatory` with `scroll-snap-align: start` for card snapping. Cards have alternating vertical offsets (±0.6rem) creating a wave pattern as you scroll. No parallax or entrance animations—motion is functional, not decorative.

# Algorithms

Standard implementation, no special design.

# Material

Standard implementation, no special design.

# Craft

Visible grid borders (1px solid #000000) are a deliberate aesthetic choice, making the layout structure explicit. Corner handle dots on cards reinforce the design-tool metaphor. Navigation is fixed with z-index: 700. Responsive breakpoints at 576px, 768px, 1024px, 1440px, 1900px, and 2100px—unusually granular, supporting ultra-wide displays.

# Coherence

The visible Swiss grid is the organizing idea: 1px black borders, gradient-drawn rules under the headlines and corner handle dots on the cards all expose structure, framing circular design as something engineered and inspectable. A single neo-grotesk at one regular weight, set in all caps for headlines and section labels, and a strict black-and-white palette leave the macro material photography, set on black, as the only texture. Motion stays functional—the continuously rotating emblem, snap-scrolling principle cards and their alternating stagger—so the page reads as a technical yet optimistic manifesto rather than a campaign spectacle.
