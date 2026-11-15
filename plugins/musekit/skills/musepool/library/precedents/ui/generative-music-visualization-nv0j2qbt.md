---
id: Nv0J2QBT
scenario: ui
scenario_name: 界面
category: generative music visualization
modality: web
view_type: landing
core_dimensions:
- algorithms
- motion
- imagery
scores:
  anti_slop_value: 0.95
  code_value: 0.9
  density: 0.7
  motion_intensity: 0.8
  novelty: 0.9
  visual_value: 0.85
tags:
  color:
  - monochrome-bw
  - light-bg
  - neutral
  domain:
  - portfolio
  - studio
  - music
  imagery:
  - generative
  - svg-led
  - abstract-graphics
  layout:
  - full-screen
  - fixed-header
  - single-column
  material:
  - no-material
  motion:
  - canvas-animation
  - ambient-animation
  - infinite-loop
  style:
  - minimal
  - experimental
  - editorial
  tech:
  - nextjs
  - react
  - vanilla-js
  typography:
  - sans-serif
  - serif
  - dual-font
  - custom-font
dimensions_with_reference: []
---

> 借鉴范围：可借鉴交互、导航、组件组织或界面层级；根据当前用户任务、已有设计系统和技术栈重新实现。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

A programmatic design studio landing page presenting "Undulations in C, Op.1 No.1" — a never-ending generative musical composition. The narrative centers on a single canvas-based visualization: musical notation rendered along curved staff lines that form an infinity-symbol/lemniscate shape. The piece positions itself as both portfolio statement and interactive artwork, with the generative music serving as the primary content and the circular notation as its visual manifestation.

# Tech Stack

Next.js (React) with Paper.js for canvas-based vector graphics rendering. Emotion CSS-in-JS for scoped styling. The musical visualization runs on a custom Paper.js implementation generating SVG-like paths for staff lines and note glyphs in real-time.

# Layout

Full-viewport canvas as the sole visual layer, centered and fixed. Text elements float in fixed positions: header block top-left, "Play" control bottom-left, "Information" link bottom-right, copyright centered at bottom. The canvas dominates (≈90% viewport), with text acting as minimal UI chrome. No scrolling; single-screen experience.

# Typography

Three-font system:
- **Basel Grotesk** (485 weight): Primary sans-serif for UI labels, navigation, body text. Clean, neutral Swiss character.
- **Ogg Regular Italic**: Display serif for "presents" and "Undulations in C" — elegant, high-contrast transitional italic with dramatic stroke modulation.
- **Bravura**: Music notation font (SMuFL-compliant) for rendering actual note glyphs, clefs, and musical symbols on canvas.

Header text uses mixed styling: sans-serif for the studio name and "generative impromptu", italic serif for the title phrase. `mix-blend-mode: difference` applied to header and footer text for contrast against the black notation on light background.

# Color

Monochrome palette: `#f4f4f4` (warm off-white) background, pure black (`#000000`) for all notation and text. The musical staff and notes render in solid black against the warm gray-white canvas. Text UI elements use `mix-blend-mode: difference` to ensure visibility against varying canvas content. No accent colors — the visual interest comes entirely from the generative form, not chromatic variation.

# Imagery

No photographic imagery. The visual content is entirely programmatic: a continuously generated musical score rendered as vector paths on HTML5 canvas. The notation forms a Möbius-like continuous loop with treble and bass clefs at the crossover points. Staff lines curve and undulate; notes appear as black glyphs positioned along the curves. The algorithm generates new musical material indefinitely, creating a "never-ending" score that visualizes the playing music.

# Components

Minimal UI components:
- Fixed header block (top-left): studio name, tagline, piece title
- "Play" text button (bottom-left): initiates audio playback
- "Information" link (bottom-right): reveals modal/overlay with project details
- Centered copyright (bottom): small uppercase text

All UI is text-based, no buttons with borders or backgrounds. The canvas itself is the primary interactive element.

# Motion

The canvas visualization animates continuously: notes appear, move along the curved staff lines, and fade. The staff itself may have subtle undulation or the notation scrolls through the curved path. Audio playback triggers visual synchronization — notes highlight or animate as they sound. Reference file covers the Paper.js animation loop and audio-visual synchronization.

# Algorithms

The core visual form is algorithmically generated: a lemniscate (infinity symbol) path serves as the spine for curved staff lines. Musical notes are procedurally placed along these curves using mathematical path following. The composition itself is generative — algorithmic music generation drives the notation display. Reference file details the path mathematics and note placement algorithm.

# Material

Standard implementation, no special design.

# Craft

- `--padding: 8px` for consistent edge spacing
- `pointer-events: none` on canvas allows text selection through the visualization
- `mix-blend-mode: difference` on UI text ensures readability against black notation
- Bravura font subset loaded for efficient music glyph rendering
- Canvas `resize="true"` attribute enables Paper.js automatic canvas sizing
