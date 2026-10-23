---
id: FpA0MHDV
scenario: ui
scenario_name: 界面
category: music artist portfolio
modality: web
view_type: app
core_dimensions:
- layout
- motion
- color
scores:
  anti_slop_value: 0.9
  code_value: 0.7
  density: 0.6
  motion_intensity: 0.5
  novelty: 0.85
  visual_value: 0.75
tags:
  color:
  - monochrome-bw
  - light-bg
  - accent-red
  domain:
  - music
  - personal-brand
  - portfolio
  imagery:
  - svg-led
  - icon-driven
  - no-imagery
  layout:
  - single-column
  - fixed-header
  - full-screen
  - mobile-first
  material:
  - no-material
  - soft-shadow
  - matte
  motion:
  - page-transition
  - smooth-scroll
  - entrance-animation
  style:
  - minimal
  - playful
  - experimental
  tech:
  - vanilla-js
  - jquery
  - gsap
  typography:
  - sans-serif
  - system-font
  - single-font
dimensions_with_reference: []
---

> 借鉴范围：可借鉴交互、导航、组件组织或界面层级；根据当前用户任务、已有设计系统和技术栈重新实现。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

A music artist's personal website designed as a functional parody of a mainstream smartphone's native recent-calls log. The entire site presents as a smartphone interface where each call entry maps to different content: music videos open a video-platform-style player overlay, merchandise links to a shop, agent contact opens email, social links open external profiles. The narrative flow is a single scrollable list with interactive rows that trigger app-like transitions.

# Tech Stack

Vanilla HTML/CSS/JS with jQuery for DOM manipulation. GSAP TweenMax for slide transitions between "apps". JSON-driven content configuration for call entries. No framework, hand-crafted.

# Layout

Full-viewport mobile-first layout. Single-column list with fixed header (70px height, `#f0f0f0` background). Each call row is 64px height with 35px left indent for content. Hairline borders using 1px gradient technique (`#c8c8c8` to transparent). Absolute positioning for iconography and timestamps. Secondary views (video player, countdown) slide in from right using `left: 100vw` to `left: 0vw` animation.

# Typography

System font stack: `-apple-system, BlinkMacSystemFont, helvetica`. The recent-calls header title at 38px with 700 weight. Call names at 1.15em (≈18.4px) with 500 weight. Type labels and timestamps at 100 weight in Label Gray `#76757B` (4.56:1 on white). Missed calls in Missed Red `#EA0C1D` (4.59:1 on white), a deeper value of the native system red `#ff3232`.

# Color

Pure native-phone palette: white (`#ffffff`) background, light gray header (`#f0f0f0`); native medium gray (`#8a898f`, 3.46:1 on white) for icons and other marks, with the darker Label Gray (`#76757B`, 4.56:1) for text; system red (`#ff3232`, 3.64:1) for non-text missed-call marks such as a dot or badge, with Missed Red (`#EA0C1D`, 4.59:1) for missed-call text; system blue for info icons (`#007AFF` in SVG). Video app uses dark chrome (`#222222` header, `#141414` background for countdown). No custom brand colors—entirely mimics the native mobile system colors.

# Imagery

SVG iconography mimicking the native phone app: outgoing call arrow, video-call camera icon, info "i" in circle. Icons are simple line-art SVG filled with the medium gray `#8a898f` (3.46:1 on white). The native light grays `#cdcdcd` and `#ccc` (about 1.6:1) are too faint for icons that carry meaning; keep them for disabled or purely decorative glyphs only. No photography or illustrations—pure UI chrome.

# Components

Call row component: 64px fixed height, left-aligned icon (20% height, 11px from left), name and type stacked vertically (35px left indent), timestamp right-aligned (50px from right), info icon at far right (15px from right, 35% height). Hairline separator using CSS gradient background. Hover/tap reveals link target. Back button in sub-views uses inverted arrow + the parent app's name, as in native navigation.

# Motion

App-style slide transitions using GSAP TweenMax. Duration 0.2s with `Power1.easeInOut` easing. Video and countdown apps slide in from right (`left: 100vw` to `left: 0vw`) while main phone view slides left (`left: 0vw` to `left: -100vw`). Reverse animation on back navigation.

# Algorithms

Standard implementation, no special design.

# Material

Hairline borders using gradient technique: `linear-gradient(to bottom, #c8c8c8 0%, #c8c8c8 51%, transparent 51%)` with `background-size: 100% 1px`—creates crisp 1px line that works across DPIs. Semi-transparent body background `rgba(255, 255, 255, 0.7)` for subtle layering.

# Craft

Scrollbar hidden via `::-webkit-scrollbar { display: none; }`. Touch scrolling enabled with `-webkit-overflow-scrolling: touch`. Info icon uses the native system blue (`#007AFF`). Emoji used in some call names for visual personality. Missed call count in parentheses following the native convention.

# Coherence

The design succeeds through absolute commitment to the native phone metaphor—every pixel, color, and interaction pattern mirrors the system call log. The joke/personality emerges from the content (playful caller names, emoji flourishes) while the container remains perfectly serious system UI. The GSAP transitions complete the app illusion by matching native mobile navigation physics.
