---
id: swwKiFDe
scenario: frontend
scenario_name: 前端开发
category: education product
modality: web
view_type: landing
core_dimensions:
- layout
- typography
- algorithms
scores:
  anti_slop_value: 0.9
  code_value: 0.95
  density: 0.7
  motion_intensity: 0.2
  novelty: 0.8
  visual_value: 0.75
tags:
  color:
  - monochrome-bw
  - high-contrast
  - black-dominant
  domain:
  - education
  - product-showcase
  - docs
  imagery:
  - svg-led
  - icon-driven
  - custom-photo
  layout:
  - sidebar
  - two-column
  - card-grid
  - horizontal-scroll
  material:
  - no-material
  motion:
  - smooth-scroll
  - no-motion
  - hover-reveal
  style:
  - bold
  - minimal
  - technical
  tech:
  - vanilla-js
  - scss
  - other-tech
  typography:
  - sans-serif
  - dual-font
  - condensed
  - tight-tracking
  - display-serif
dimensions_with_reference: []
---

> 场景适配:适用于网站、Web App、落地页、交互体验。重点关注布局结构、动效编排与字体系统的实现方式。

# Narrative

A CSS layout education product homepage. The narrative flows from hero (book cover + value proposition) → access recovery → social proof (company logos + testimonials) → methodology explanation → layout pattern catalog → author bios → purchase/checkout. The page sells a systematic approach to CSS layout through algorithmic, intrinsic design patterns.

# Tech Stack

Vanilla JS with custom web components (stack-l, sidebar-l, switcher-l, cluster-l, grid-l, center-l, reel-l, box-l). CSS Houdini paint worklet for image cross pattern. CSS custom properties for spacing scale and theming. No framework dependencies.

# Layout

Asymmetric two-column sidebar layout for hero (book cover left, content right). Content regions max-width 70rem with inline padding. Companies section features a distinctive diagonal stripe border (linear-gradient 45deg checkerboard) on the left edge. Layout pattern catalog uses auto-fit grid with min 15ch columns. Testimonials in horizontal scroll reel. Authors in switcher-l that stacks on narrow viewports. Checkout panel full-width with centered content.

# Typography

Dual font system: Barlow Condensed (weight 700) for display headings and CTAs — bold, condensed, impactful; Helvetica Neue/Arial stack for body text. Georgia for testimonial quotes (italic, serif contrast). Fluid type scale using clamp() from s-5 to s5. Headings use tight line-height (0.8 * ratio). Max-width constraints: h1 28ch, h2 42ch, paragraphs 60ch.

# Color

High-contrast monochrome palette: `#050505` (dark), `#fafafa` (light), `#404040` (darkish), `#e6e6e6` (lightish), `grey` (mid). No accent colors — pure black and white throughout. Images desaturated via CSS filter: `saturate(0%) contrast(200%) brightness(140%)` with 1px border.

# Imagery

SVG line-art icons for each layout pattern (The Stack, The Box, The Center, The Cluster, etc.) — minimal stroke-based diagrams showing layout behavior. Book cover SVG with bold typography and "3rd edition" starburst. Company logos in monochrome SVG. Author photos with high-contrast grayscale treatment. "Read for free" diagonal badges on specific layout cards.

# Components

Primary CTA: black background, white text, Barlow Condensed font, padding 0.5em 1.5em 0.7em. Form inputs: standard browser styling with sidebar-l layout for email+button. Testimonial cards: sidebar layout with 5rem avatar, serif italic quote. Layout pattern cards: centered stack with SVG icon, heading, optional diagonal "read for free" badge.

# Motion

Smooth scroll for anchor links (prefers-reduced-motion respected). Reel-l component enables horizontal scrolling with overflow. ShrinkGrow component for progressive disclosure. No entrance animations or parallax — motion serves function, not decoration.

# Algorithms

Intrinsic layout algorithms via custom elements: Switcher switches between horizontal and vertical based on container width; Sidebar maintains side-by-side until threshold; Stack applies consistent vertical rhythm; Grid auto-fits columns based on min-width. All layouts use CSS flexbox/grid with container query-like behavior via flex-basis calculations.

# Material

Standard implementation, no special design.

# Craft

Custom focus outline: `var(--border-thin) solid var(--color-mid)` with offset. Book cover image has thick outline inset using `outline-offset: calc(var(--border-thick) * -1)`. Images scaled 101% to prevent subpixel gaps. Houdini paint worklet for generative image cross pattern.
