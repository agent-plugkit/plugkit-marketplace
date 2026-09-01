---
id: vEj9F5om
scenario: ui
scenario_name: 界面
category: interactive audio experience
modality: web
view_type: app
core_dimensions:
- motion
- typography
- algorithms
scores:
  anti_slop_value: 0.9
  code_value: 0.8
  density: 0.3
  motion_intensity: 0.4
  novelty: 0.85
  visual_value: 0.75
tags:
  color:
  - monochrome-bw
  - dark-bg
  - black-dominant
  domain:
  - music
  - product-showcase
  - art
  imagery:
  - svg-led
  - type-only
  - no-imagery
  layout:
  - full-bleed
  - two-column
  - fixed-header
  material:
  - no-material
  motion:
  - hover-reveal
  - ambient-animation
  - entrance-animation
  style:
  - minimal
  - dark-led
  - experimental
  tech:
  - vue
  - nuxt
  - vanilla-js
  typography:
  - serif
  - display-serif
  - dual-font
  - custom-font
  - fluid-type
dimensions_with_reference: []
---

> 借鉴范围：可借鉴交互、导航、组件组织或界面层级；根据当前用户任务、已有设计系统和技术栈重新实现。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

An interactive audio-typing experience that transforms keystrokes into jazz piano melodies. The interface presents as a stark, immersive canvas where typing generates musical notes through a custom Web Audio engine. The narrative is singular and focused: the user types, and each keystroke triggers a corresponding jazz piano note, creating a personal musical composition. A vertical toolbar provides playback controls (play, record, audio effects), theme toggle, and info access. The experience prioritizes immediacy — no onboarding, just start typing.

# Tech Stack

Nuxt.js (Vue) SPA with custom Web Audio API-based audio engine. CSS custom properties for theming. No external UI component libraries — fully custom implementation. Audio assets loaded from remote server with MIDI-to-audio mapping for real-time playback.

# Layout

Full-bleed dark canvas with asymmetric two-zone layout. Main content area occupies ~90% width — a massive textarea filling 70vh with generous 2rem right margin. Vertical icon toolbar docked to right edge with 5-6 stacked navigation items (play, record, audio FX, share, theme toggle, info). No header, no footer, no navigation chrome. Content starts at var(--margin) from top. Absolute minimalism — the interface gets out of the way so the typing experience dominates.

# Typography

Dual font system: Canela (custom loaded serif, weight 400) for display text and placeholder — distinctive high-contrast serif with elegant stroke modulation. System sans-serif stack (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto) for UI chrome and body fallback. Large fluid type: 36px mobile, 56px desktop for textarea input. Letter-spacing: 1px on input. Tight line-height for dense text blocks. Modal content uses Cormorant Garamond (serif) at same 36/56px scale.

# Color

Dark-first palette with CSS custom property theming. Default theme: #121212 (near-black) background, #ffffff text, #3a3a3a secondary/muted. Inverted theme: #ffffff background, #000000 text, #d4d4d4 secondary. SVG icons use #404040 fill in default state, transitioning to var(--textColor) on interaction. No gradients, no accent colors — pure monochrome with subtle state transitions (color transitions take 1s, path fills 0.05-0.5s).

# Imagery

No photographic imagery. Visual interest comes from: (1) custom SVG iconography — play triangle, record circle, audio waveform, share arrow, sun/moon theme toggle, info circle; (2) animated logo states (three-bar animation sequence on load); (3) text-as-visual — the typed content itself becomes the visual output. Icons are geometric, minimal, single-weight strokes with fill="#404040" default.

# Components

**Textarea**: Borderless, resize-none, 70vh height, overflow-y auto. Custom scrollbar styling (implied by overflow behavior). No visible chrome — just text on dark.

**Icon buttons**: SVG-based, 80px hit areas, hover transitions (0.3s all properties). Secondary class applies muted color, hover reveals full brightness.

**Modals**: Fixed full-viewport overlays with var(--bgColor) background. Close button: 12px/18px icon with 90deg rotation on hover (0.6s transition). Sharp corners (border-radius: 0).

**Message overlay**: Centered flex container with rgba(0,0,0,0.7) scrim, var(--secondaryColor) background for message card.

# Motion

Subtle, purposeful motion reinforcing the audio-typing metaphor. Icon hover: 0.3s ease transition on all properties. Modal close: 0.6s rotation transform. SVG path fills: 0.05s ease-in-out for instant feedback. Theme toggle: 1s color transition on background and text. Loading sequence: three-bar logo animation with translateY transforms (-85px, 85px) staggered. No parallax, no scroll-triggered animations — motion is reactive to user input only.

# Algorithms

Real-time MIDI-to-audio mapping: each keystroke triggers a specific piano note through the custom audio engine. Audio samples mapped to keyboard positions with velocity sensitivity. Sequencer lookahead: 50ms, schedule ahead: 0.4s (0.3s on iOS). Process-based audio graph with fadeInAndPlay/fadeOutAndStop envelopes (2s fades).

# Material

Standard implementation, no special design.

# Craft

**Corner radius**: 0 everywhere — sharp, editorial aesthetic. **Focus**: outline: none on all inputs (deliberate choice for clean look). **Scrollbar**: Custom overflow handling with hidden x-axis. **Transitions**: CSS custom properties enable instant theme switching with 1s interpolation. **Iconography**: Custom SVG set with consistent 80px viewBox sizing. **Accessibility**: spellcheck="false", autocorrect="off", autocapitalize="off" on textarea for pure typing experience.

# Coherence

The design achieves remarkable coherence through radical subtraction. Every element serves the core interaction: typing as music-making. The dark canvas eliminates visual noise; the Canela serif adds personality without clutter; the vertical toolbar provides just enough control without breaking immersion. The monochrome palette and instant theme toggle demonstrate technical sophistication through restraint rather than complexity.
