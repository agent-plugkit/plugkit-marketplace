---
id: pu9ToBED
scenario: ui
scenario_name: 界面
category: supply chain intelligence dashboard
modality: web
view_type: dashboard
core_dimensions:
- color
- layout
- components
scores:
  anti_slop_value: 0.9
  code_value: 0.8
  density: 0.95
  motion_intensity: 0.7
  novelty: 0.75
  visual_value: 0.85
tags:
  color:
  - dark-bg
  - blue-dominant
  - multi-accent
  - high-contrast
  domain:
  - dashboard
  - finance
  - saas
  imagery:
  - svg-led
  - data-viz
  - abstract-graphics
  - no-imagery
  layout:
  - dashboard-grid
  - sidebar
  - sticky-sections
  - card-grid
  material:
  - glass
  - glow
  - gradient-bg
  - soft-shadow
  motion:
  - ambient-animation
  - hover-reveal
  - infinite-loop
  - scroll-triggered
  style:
  - dark-led
  - technical
  - futuristic
  - minimal
  tech:
  - vanilla-js
  - scss
  - other-tech
  typography:
  - monospace
  - sans-serif
  - dual-font
  - tight-tracking
  - all-caps
dimensions_with_reference: []
---

> 借鉴范围：可借鉴交互、导航、组件组织或界面层级；根据当前用户任务、已有设计系统和技术栈重新实现。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

A supply chain intelligence dashboard for procurement professionals. The interface presents as a mission control center: live data feeds, geopolitical risk maps, commodity price tracking, and AI-assisted analysis. The narrative flows from top-level alerts (ticker banner) through strategic impact cards to a central interactive map, then down to detailed commodity charts and risk panels. The design language borrows from military/intelligence aesthetics—dark surfaces, glowing status indicators, and data-dense layouts—while maintaining the clarity of a financial terminal.

# Tech Stack

Vanilla HTML/CSS/JS single-page application. GL-based mapping library for interactive maps. Google Fonts (JetBrains Mono, Inter). CSS custom properties for theming with three modes: Intelligence (default cyan/amber), Tactical (green), and Light (office/daylight). No framework dependencies; custom-built component system.

# Layout

Three-column dashboard layout: left panel (280px) for layer controls and watchlists, center for the interactive map (fluid), right panel (380px) for alerts and actions. Fixed header with traffic-light indicators, live monitor badge, and ticker banner. Mission Control hero section spans full width with collapsible executive summary. Bottom section features horizontally-scrolling chart panels (2 visible, 1 peeking) and three-column info grid. Dense information architecture with 12px base grid and 1px hairline borders.

# Typography

Dual-font system: JetBrains Mono for all UI chrome, labels, data points, and monospace needs (300-700 weights); Inter for AI chat bubbles and longer reading content (400-800 weights). Heavy use of uppercase with wide letter-spacing (0.08em-0.22em) for labels and section headers. Type hierarchy established through size (9px-32px), weight, and tracking rather than color alone.

# Color

Dark intelligence palette: background `#050810`, panels `#0c1220`/`#111a2b`, borders `#1a2540`. Primary accent cyan `#22d3ee` for active/live states. Secondary accents: mint green `#34d399` (positive/safe), amber `#fbbf24` (warnings), red `#f87171` (critical). Color-coded semantic system: commodity tags cyan, energy amber, freight magenta, labor green. Three theme variants with full CSS variable swaps. Subtle radial gradients in background for depth.

# Imagery

SVG-based stylized world map with animated flow lines (stroke-dasharray animation) and pulsing location dots. No photographic imagery—visual language is entirely vector-based: geometric icons, status LEDs, radar-style animated logo. Third-party map tile integration with dark theme overrides. External weather service integration for overlay thumbnails.

# Components

**Status indicators**: Custom "radar-node" checkboxes replacing standard inputs—circular with glowing ring and center dot when active. **Alert cards**: Left-border accent system (3px) with color-coded severity. **Action pills**: Inline status badges with pulsing dot animation. **Ticker banner**: Marquee-style scrolling alerts with pause-on-hover. **AI chat interface**: AI assistant chat with gradient emblem, message bubbles with left accent border, and suggested action chips. **Mission Control gauge**: Large bordered badge with animated pulsing dot and level indicator bars.

# Motion

Continuous ambient animations: pulsing dots (1.4-1.6s ease-in-out), radar sweep rotation (4.2s linear infinite), ticker scroll (48s linear), map flow lines (30s dash offset). Entrance animations for AI chat messages (fade + translateY). Hover transitions on all interactive elements (0.15s ease). Collapsible sections with max-height and opacity transitions (0.42s cubic-bezier). Reduced-motion media query support throughout.

# Algorithms

Standard implementation, no special design.

# Material

Digital surface aesthetic: subtle noise/scanline overlay (repeating-linear-gradient at 3px intervals), glassmorphism on floating elements (backdrop-filter blur 6-10px), soft shadows with colored glow accents. No physical material simulation—purely digital texture.

# Craft

**Scrollbar**: Custom 6px thin scrollbar with themed colors. **Focus states**: Visible focus rings using box-shadow with primary color. **Loading states**: Skeleton placeholders with animated pulse. **Empty states**: Dashed border containers with contextual hints. **Cookie banner**: Fixed bottom-left with gradient top border and pulsing privacy indicator. **Pro feature blur**: Dynamic blur overlay with upgrade prompt for non-subscribers.

# Coherence

The design achieves its mission-control aesthetic through consistent application of the dark intelligence palette, monospace typography for data, and glowing accent colors for status. The three-column layout maintains information density without overwhelming, while the collapsible Mission Control section allows users to drill from high-level alerts to detailed commodity analysis. The AI assistant integration feels native rather than bolted-on, sharing the same visual language of glowing accents and glass panels.
