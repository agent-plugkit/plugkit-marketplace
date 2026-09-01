---
id: tVghVsn2
scenario: ui
scenario_name: 界面
category: whiteboard tool
modality: web
view_type: app
core_dimensions:
- layout
- color
- craft
scores:
  anti_slop_value: 0.7
  code_value: 0.6
  density: 0.3
  motion_intensity: 0.1
  novelty: 0.5
  visual_value: 0.6
tags:
  color:
  - light-bg
  - multi-accent
  - blue-dominant
  - neutral
  domain:
  - product-showcase
  - community
  - saas
  imagery:
  - svg-led
  - no-imagery
  - icon-driven
  layout:
  - full-bleed
  - floating
  - centered
  - fixed-header
  material:
  - soft-shadow
  - matte
  - no-material
  motion:
  - no-motion
  - hover-reveal
  - smooth-scroll
  style:
  - minimal
  - technical
  - flat
  tech:
  - react
  - vanilla-js
  - scss
  typography:
  - sans-serif
  - system-font
  - mixed-case
  - multilingual-cjk
dimensions_with_reference: []
---

> 借鉴范围：可借鉴交互、导航、组件组织或界面层级；根据当前用户任务、已有设计系统和技术栈重新实现。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

An open-source whiteboard tool landing page that doubles as an interactive onboarding tutorial. The page presents a blank canvas interface with a centered brand introduction, while curved SVG arrows annotate the UI—pointing to the toolbar, menu, and theme switcher. The narrative flow is instructional: "here's what you can do" rather than "here's what we sell." The design prioritizes immediate utility over marketing fluff.

# Tech Stack

React-based SPA built on a whiteboard engine framework. CSS custom properties drive the theming system. System font stack with CJK fallbacks. SVG-based canvas rendering with layered element hosts (lower, element, upper, top). No external animation libraries—transitions are CSS-based.

# Layout

Full-bleed canvas interface (100vw × 100vh) with floating UI islands. The tutorial overlay uses absolute positioning: brand title centered both axes, three feature pointers positioned at top-left (60px, 100px), top-center (50% translated), and bottom-right (40px, 70px). Toolbar sits at top edge with centered alignment. Theme switcher anchored bottom-right. Negative space dominates—the canvas is intentionally empty to signal "start creating."

# Typography

System font stack: `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, PingFang SC, Noto Sans, Noto Sans CJK SC, Microsoft Yahei, Hiragino Sans GB, Arial, sans-serif`. Brand title at 72px with 2px letter-spacing, weight 400. Description at 18px italic. Tooltip text at 14px in `#888`. UI chrome uses 14px base with variable font sizing for canvas text (8px–78px range via data attributes).

# Color

Multi-theme system with CSS custom properties. Default theme: white canvas (`#fff`), primary accent `#6698ff` (soft blue), text `#333` for headings, `#888` for secondary text, `#666` for UI chrome. Gray scale from `#f5f5f5` (10) to `#121212` (100). Alternative themes: soft (`#f5f5f5` bg), retro (`#f9f8ed` bg), dark (`#141414` bg), starry (`#0d2537` bg). Island backgrounds are white with subtle shadow `0 0 16px #00000014`.

# Imagery

No photographic imagery. Visual interest comes from SVG arrow annotations—curved paths with quadratic bezier curves (`Q` commands) and marker-end arrowheads. Arrows use `#aaa` stroke at 1.5px width. The canvas itself is the visual: an infinite white space framed by minimal UI chrome.

# Components

Floating toolbar islands with rounded corners (`--border-radius-lg: .5rem`). Buttons are square (`2rem` default, `2.25rem` large) with transparent backgrounds that fill on hover. Tool icons use consistent 1rem sizing. Dropdown selects have pill-shaped borders (`border-radius-sm: .25rem`). The tutorial pointers combine SVG graphics with positioned text blocks—no standard component library patterns here.

# Motion

Minimal, functional motion. CSS transitions on `box-shadow` (0.5s ease-in-out) for island hover states. Button hover/active states use background-color shifts (`var(--color-surface-high)`). No entrance animations, no parallax, no scroll-triggered effects. The tutorial overlay is static—motion would distract from the tool's purpose.

# Algorithms

Standard implementation, no special design.

# Material

Soft shadow treatment: `--shadow-island: 0 0 16px #00000014` creates a lifted paper effect for floating toolbars. No glassmorphism, no noise textures. Borders are subtle (`#eeeeee` for islands) or absent. The canvas has no texture—pure flat fill.

# Craft

Pointer-events management: tutorial overlay uses `pointer-events: none` to allow clicking through to the canvas. Custom cursor states for different tools (default, crosshair, grab, ns/ew/nwse/nesw-resize). Scrollbar hiding via `scrollbar-width: none` and `::-webkit-scrollbar { display: none }`. Responsive breakpoint at 768px hides tutorial pointers on mobile.

# Coherence

The design achieves a "tool first, chrome second" philosophy. Every element serves the whiteboard experience: the tutorial arrows teach by pointing, the empty canvas invites action, the theme system respects user preference. The soft blue accent (`#6698ff`) is restrained—used only for interactive states, never for decoration. The result feels like a native app that happens to run in a browser.
