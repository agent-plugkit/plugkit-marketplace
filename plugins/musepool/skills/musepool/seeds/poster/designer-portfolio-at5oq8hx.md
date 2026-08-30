---
id: AT5oq8hX
scenario: poster
scenario_name: 海报
category: designer portfolio
modality: web
view_type: portfolio
core_dimensions:
- typography
- layout
- motion
scores:
  anti_slop_value: 0.85
  code_value: 0.5
  density: 0.75
  motion_intensity: 0.7
  novelty: 0.65
  visual_value: 0.8
tags:
  color:
  - black-dominant
  - high-contrast
  - single-accent
  - accent-orange
  domain:
  - portfolio
  - agency
  - personal-brand
  imagery:
  - mixed-media
  - product-render
  - custom-photo
  layout:
  - full-bleed
  - horizontal-scroll
  - stacked
  material:
  - no-material
  motion:
  - marquee
  - infinite-loop
  - scroll-triggered
  style:
  - bold
  - brutalist
  - editorial
  - dark-led
  tech:
  - vanilla-js
  - webflow
  - other-tech
  typography:
  - display-serif
  - oversized-type
  - tight-tracking
  - all-caps
  - dual-font
  - custom-font
dimensions_with_reference: []
---

> 场景适配:适用于海报、活动视觉、封面。把种子当作「单屏构图 + 大字排印」的约束来源:标题层级、网格、色彩块面直接借用,动效维度可忽略或转化为静态层次。

# Narrative

A brand designer's portfolio presenting 13 years of work (2010-2023). The narrative flows: black hero with oversized title → horizontal scrolling work gallery → split intro with conversational headline → orange kinetic type section with client list. The tone is confident, playful, and craft-focused.

# Tech Stack

Framer Site (generator meta: "Framer"). Static SSR export with breakpoint system (1440px, 1200-1439px, <1199px). Self-hosted fonts via Framer CDN.

# Layout

Full-bleed sections with dramatic color blocking. Hero is centered, viewport-filling black. Work gallery uses horizontal overflow with repeating project strips. Intro section splits: left 40% oversized display type, right 60% body copy. Orange section stacks centered type with massive kinetic headlines. No container max-width constraints — content breathes to edges.

# Typography

Dual font system: **TT Trailers Black** (display, uppercase, tight line-height 0.9em) for all headlines; **Inter** (body, 18px, letter-spacing 0.3px) for paragraphs; **Azeret Mono** (meta, uppercase) for small labels. Hero headline scales 80px → 120px → 160px across breakpoints. Display type uses negative letter-spacing (-1.5px).

# Color

High-contrast palette: **#000000** (hero background), **#ededed** (hero text), **#efefef** (intro background), **#ff8e4d** (vibrant orange section), **#0099ff** (link accent), **#111111** (body text). Single accent approach — blue for interactive, orange for energy/CTA sections.

# Imagery

Project showcase uses mixed media: mobile app mockups (sports apps, running apps), brand identity systems (craft brewery badges), outdoor advertising mockups, UI screens. Images presented in horizontal scrolling strips at ~400px height. No image borders or shadows — flat presentation against colored backgrounds.

# Components

Minimal component system. Navigation is just a centered SVG logo mark. Links use underline-on-hover pattern with color shift to #0088ff. No buttons, cards, or forms. Work gallery relies on native horizontal scroll.

# Motion

Horizontal auto-scrolling marquee for work gallery (infinite loop, multiple project strips). Kinetic type treatment in orange section — oversized words animate/scroll into view. Smooth scroll behavior site-wide. See references/motion.md for timing parameters.

# Algorithms

Standard implementation, no special design.

# Material

Standard implementation, no special design.

# Craft

SVG logo rendered as data-uri for crispness. Font loading uses `font-display: swap`. Pixelated image rendering on SVG elements. Custom underline hover states with color transition.

# Coherence

The brutalist display typography against stark color fields creates immediate visual authority. The horizontal scrolling gallery breaks vertical monotony and signals "more to see." Orange section interrupts the monochrome rhythm with energetic warmth. The whole site feels like a confident designer showing work without decoration.
