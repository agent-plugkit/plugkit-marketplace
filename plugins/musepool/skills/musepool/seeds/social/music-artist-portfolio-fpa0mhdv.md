---
id: FpA0MHDV
scenario: social
scenario_name: 社媒图文
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

> 场景适配:适用于社媒图文、分享卡片、品牌帖子。重点关注色彩块面、视觉钩子与叙事节奏;尺寸按平台裁切,构图原则不变。

# Narrative

A music artist's personal website designed as a functional parody of the iOS Phone app's "Recents" call log. The entire site presents as a smartphone interface where each call entry maps to different content: music videos open a YouTube-style player overlay, merchandise links to a shop, agent contact opens email, social links open external profiles. The narrative flow is a single scrollable list with interactive rows that trigger app-like transitions.

# Tech Stack

Vanilla HTML/CSS/JS with jQuery for DOM manipulation. GSAP TweenMax for slide transitions between "apps". JSON-driven content configuration for call entries. No framework, hand-crafted.

# Layout

Full-viewport mobile-first layout. Single-column list with fixed header (70px height, `#f0f0f0` background). Each call row is 64px height with 35px left indent for content. Hairline borders using 1px gradient technique (`#c8c8c8` to transparent). Absolute positioning for iconography and timestamps. Secondary views (video player, countdown) slide in from right using `left: 100vw` to `left: 0vw` animation.

# Typography

System font stack: `-apple-system, BlinkMacSystemFont, helvetica`. Header "Recents" at 38px with 700 weight. Call names at 1.15em (≈18.4px) with 500 weight. Type labels and timestamps at 100 weight in `#8a898f`. Missed calls in `#ff3232` (iOS system red).

# Color

Pure iOS palette: white (`#ffffff`) background, light gray header (`#f0f0f0`), medium gray text (`#8a898f`), iOS red for missed (`#ff3232`), iOS blue for info icons (`#007AFF` in SVG). Video app uses dark chrome (`#222222` header, `#141414` background for countdown). No custom brand colors—entirely mimics native iOS system colors.

# Imagery

SVG iconography mimicking iOS Phone app: outgoing call arrow, FaceTime video camera icon, info "i" in circle. Icons are simple line-art SVG with `#cdcdcd` or `#ccc` fills. No photography or illustrations—pure UI chrome.

# Components

Call row component: 64px fixed height, left-aligned icon (20% height, 11px from left), name and type stacked vertically (35px left indent), timestamp right-aligned (50px from right), info icon at far right (15px from right, 35% height). Hairline separator using CSS gradient background. Hover/tap reveals link target. Back button in sub-views uses inverted arrow + "Phone" text.

# Motion

App-style slide transitions using GSAP TweenMax. Duration 0.2s with `Power1.easeInOut` easing. Video and countdown apps slide in from right (`left: 100vw` to `left: 0vw`) while main phone view slides left (`left: 0vw` to `left: -100vw`). Reverse animation on back navigation. See references/motion.md for implementation.

# Algorithms

Standard implementation, no special design.

# Material

Hairline borders using gradient technique: `linear-gradient(to bottom, #c8c8c8 0%, #c8c8c8 51%, transparent 51%)` with `background-size: 100% 1px`—creates crisp 1px line that works across DPIs. Semi-transparent body background `rgba(255, 255, 255, 0.7)` for subtle layering.

# Craft

Scrollbar hidden via `::-webkit-scrollbar { display: none; }`. Touch scrolling enabled with `-webkit-overflow-scrolling: touch`. Info icon uses native iOS blue (`#007AFF`). Emoji used in call names (📦📦, 💀) for visual personality. Missed call count in parentheses following iOS convention.

# Coherence

The design succeeds through absolute commitment to the iOS metaphor—every pixel, color, and interaction pattern mirrors the native Phone app. The joke/personality emerges from the content (celebrity names as "callers", emoji flourishes) while the container remains perfectly serious system UI. The GSAP transitions complete the app illusion by matching iOS navigation physics.
