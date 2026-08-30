---
id: Vy3KTWAC
scenario: poster
scenario_name: 海报
category: art book fair event
modality: web
view_type: landing
core_dimensions:
- typography
- color
- layout
scores:
  anti_slop_value: 0.8
  code_value: 0.5
  density: 0.7
  motion_intensity: 0.3
  novelty: 0.6
  visual_value: 0.7
tags:
  color:
  - earth-tone
  - monochrome-warm
  - single-accent
  - accent-green
  domain:
  - event
  - art
  - community
  imagery:
  - svg-led
  - no-imagery
  - icon-driven
  layout:
  - full-screen
  - hero-centered
  - card-grid
  - fixed-header
  material:
  - no-material
  motion:
  - page-transition
  - hover-reveal
  - smooth-scroll
  style:
  - swiss-style
  - minimal
  - editorial
  - bold
  tech:
  - vanilla-js
  - jquery
  - other-tech
  typography:
  - sans-serif
  - serif
  - dual-font
  - tight-tracking
  - all-caps
  - oversized-type
dimensions_with_reference: []
---

> 场景适配:适用于海报、活动视觉、封面。把种子当作「单屏构图 + 大字排印」的约束来源:标题层级、网格、色彩块面直接借用,动效维度可忽略或转化为静态层次。

# Narrative

An art book fair event site. The homepage presents a stark, poster-like interface: header with event title and dates, a four-quadrant navigation grid (Exhibitors, Program, Information, Contact), and venue details anchored at the bottom. The narrative is direct—announce the event, provide wayfinding, establish institutional tone through typography.

# Tech Stack

Static HTML with jQuery 3.4.1. SmoothState.js for PJAX page transitions (350ms fade). Custom CSS with CSS variables for color theming. No build framework—hand-coded.

# Layout

Full-viewport poster layout. Header floats title left, dates right. Main content uses absolute positioning: navigation grid sits centered (`top: 6.5vw`), venue info anchors to bottom (`position: absolute; bottom: 0`). Four-column navigation grid with `4vw` gutters. Grid items use viewport-relative sizing (`height: calc(100vh - 29vw)`). Mobile breaks to stacked two-column at 500px.

# Typography

Dual font system: **Bloom** (custom sans-serif) for all-caps UI text—headers, navigation, labels; **Times New Roman** for body content, descriptions, and event details. Bloom set at `4.7vw` with `-0.03em` letter-spacing for the event title. Navigation links at `3.5vw`. H2s use `0.04em` letter-spacing. Selection highlight in pink (`#FFC0CB`).

# Color

Restricted palette: olive green `#576221` for all text and borders; warm gray `#e3dbce` for background; pink `#FFC0CB` for text selection. No gradients, no shadows—flat color fields. Borders are solid 2px (1px on mobile) in the olive green.

# Imagery

No photographic imagery on homepage. Visual interest comes from SVG corner accents: L-shaped "crop" marks in olive green (`#576221`) positioned at each corner of navigation grid items. SVG is a 50×50px Illustrator export with two rectangles forming an L-shape, rotated 90° increments for each corner.

# Components

Navigation cards are the core component: positioned relative containers with four corner SVGs (`width: 10%`, absolutely positioned). Links centered with `line-height` matching container height for vertical centering. Hover state switches to italic (font-style). Submit buttons have 2px border, zero radius, transparent background—hover inverts to green background with gray text.

# Motion

SmoothState page transitions: 350ms fade-in on load, fade-out on exit. Exhibitor list uses `slideToggle` for accordion expand/collapse. List toggle buttons animate between `+` and `–`. All transitions use `ease-out` or `ease-in` timing. See references/motion.md for transition implementation.

# Algorithms

Standard implementation, no special design.

# Material

Standard implementation, no special design.

# Craft

Zero border-radius on all interactive elements. Tight viewport-relative padding (`0.6vw 1.5vw`). Negative margin micro-adjustments on title (`-0.3vw`) to align optical edges. Mobile/desktop visibility classes (`mobile-only`/`desktop-only`) swap content at 500px breakpoint.

# Coherence

The design treats the browser as a poster frame—everything locked to viewport edges, no scrolling on homepage. The corner-crop SVG motif reinforces "art book" editorial framing. Dual font system separates institutional voice (Bloom, all-caps) from readable content (Times). The olive/gray/pink triad feels archival yet contemporary.
