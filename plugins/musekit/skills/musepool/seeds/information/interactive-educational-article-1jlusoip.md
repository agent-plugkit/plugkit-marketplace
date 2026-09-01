---
id: 1JlUSoIP
scenario: information
scenario_name: 信息表达
category: interactive educational article
modality: web
view_type: landing
core_dimensions:
- algorithms
- imagery
- color
scores:
  anti_slop_value: 0.95
  code_value: 0.95
  density: 0.8
  motion_intensity: 0.7
  novelty: 0.9
  visual_value: 0.85
tags:
  color:
  - light-bg
  - blue-dominant
  - accent-red
  - accent-blue
  - single-accent
  domain:
  - education
  - blog
  imagery:
  - generative
  - data-viz
  - svg-led
  layout:
  - single-column
  - full-bleed
  - centered
  material:
  - no-material
  - matte
  motion:
  - scroll-triggered
  - drag
  - hover-reveal
  style:
  - technical
  - editorial
  - minimal
  tech:
  - vanilla-js
  - webgl
  typography:
  - sans-serif
  - dual-font
  - serif-headings
dimensions_with_reference: []
---

> 借鉴范围：可借鉴信息层级、标注、阅读顺序或解释方法；事实、数据和科学结论必须来自当前任务的原始资料。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

An interactive physics explainer article about airfoils and the physics of flight. The narrative flows from intuitive observations (grass bending in wind) through microscopic particle behavior to macroscopic fluid dynamics. Each section builds on the previous with interactive Canvas demonstrations that let readers manipulate variables and observe outcomes. The content targets curious learners seeking deep intuition about aerodynamics, not just facts.

# Tech Stack

Vanilla JavaScript with custom WebGL/Canvas rendering. No frameworks. Custom physics simulation engine with Navier-Stokes-inspired fluid dynamics. Self-hosted fonts (IBM Plex Sans, Inter). Static HTML generation. High-DPI canvas scaling (devicePixelRatio capped at 2).

# Layout

Single-column article layout with max-width 44rem for text content. Full-width canvas containers (`.drawer_container.full_width`) break out of the text column to create visual breathing room. Canvas containers use aspect-ratio padding trick (`.ratio_50`, `.ratio_60`, `.ratio_100`) for responsive sizing without layout shift. Generous vertical spacing between sections (2.3em margin on drawers). Header banner spans full viewport width with deep blue background (#2052BB).

# Typography

Dual font system: Inter for headings (600 weight) and IBM Plex Sans for body text. Body text at 1.2em (19.2px base) with 1.6em line height. Headings in #535353 gray, body in #444. Links in #0181eb with 0.15s color transition on hover. Inline code uses Menlo/Monaco monospace with #eaeaea background and 0.4em border-radius. Post title at 2.4em with 0.4em top padding.

# Color

Light gray background (#F8F8F8) with darker text (#444). Signature deep blue banner (#2052BB). Semantic color coding throughout: positive pressure in red (#E5432E), negative pressure in blue (#3F90CD), velocity gradients in purple-to-yellow spectrum. Interactive elements use contextual colors—grass arrows in #424b37, leaf markers in #715728, airfoil cross-section in #dab017. Slider components use theme-matched colors per section.

# Imagery

No photographs. All visuals are real-time Canvas simulations: particle systems (12,000+ particles), vector fields with instanced arrow rendering, pressure contour maps with gradient fills, 3D surface plots for pressure landscapes. Simulations include: grass field with wind, falling leaves, air particle collisions, velocity vector fields, pressure visualization with draggable hotspots, airfoil flow patterns with streamlines.

# Components

Custom slider component with 40px circular knob (#777 background), 4px track height, left/right gutter distinction (right gutter at 0.2 opacity). Play/pause and restart buttons as 44px squares with sprite-sheet icons. Unit toggle switches (imperial/metric) with ↑↓ indicator badge. Segmented controls with 40px height, 10px border-radius, #ddd background with #F8F8F8 active state. Anchor links on headings reveal on hover.

# Motion

Canvas-based physics animations at 60fps. Scroll-driven activation: simulations pause when off-screen (intersection observer pattern). Time-speed sliders control animation rate. Smooth transitions on UI elements (0.15s opacity, 0.2s linear on canvas containers). Drag interactions on sliders with touch support (`touch-action: none`). Hover states on navigation and social icons.

# Algorithms

Custom fluid dynamics simulation implementing velocity field advection, pressure projection, and boundary conditions. Particle-based air simulation with Maxwell-Boltzmann velocity distribution. Finite difference method for flow simulation. Smooth step functions and vector interpolation for airfoil geometry. Surface normal calculation for 3D pressure landscape. Instanced rendering for vector arrows and particle systems.

# Material

Clean flat surfaces with subtle depth cues. Canvas containers have no border or shadow—content floats on light gray background. Slider knobs use solid fills with no shadow. Play buttons have slight transparency (rgba(0,0,0,0.05)) with rounded corners (6px). No glassmorphism, no heavy shadows, no textures.

# Craft

Imperial/metric unit switching via CSS class toggle (`.show_imperial`) with instant DOM update—no page reload. Click/tap word switching for device-appropriate labels (`.click_word` vs `.tap_word`). Heading anchor links with PNG icon (8x16px) hidden until hover. Canvas pixel ratio capped at 2x for performance. Draggable pressure hotspots with visual dashed-circle indicators. Restart buttons positioned absolute bottom-left of canvas containers.

# Coherence

The design system serves the educational mission: semantic colors reinforce physics concepts (red=high pressure, blue=low), interactive sliders invite experimentation, and the clean typographic hierarchy keeps focus on content. The full-width canvas breakouts create rhythm between reading and doing. Every visual choice supports clarity of explanation.
