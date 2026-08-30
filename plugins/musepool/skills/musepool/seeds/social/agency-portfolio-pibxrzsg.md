---
id: pibXRzsG
scenario: social
scenario_name: 社媒图文
category: agency portfolio
modality: web
view_type: landing
core_dimensions:
- color
- typography
- layout
scores:
  anti_slop_value: 0.8
  code_value: 0.3
  density: 0.7
  motion_intensity: 0.4
  novelty: 0.6
  visual_value: 0.7
tags:
  color:
  - multi-accent
  - saturated
  - accent-pink
  - accent-green
  - accent-orange
  domain:
  - agency
  - event
  - portfolio
  imagery:
  - no-imagery
  - type-only
  - svg-led
  layout:
  - full-bleed
  - single-column
  - centered
  - horizontal-scroll
  material:
  - no-material
  motion:
  - marquee
  - scroll-triggered
  - hover-reveal
  style:
  - bold
  - playful
  - colorful
  tech:
  - framer-motion
  - vanilla-js
  - other-tech
  typography:
  - sans-serif
  - grotesque
  - oversized-type
  - tight-tracking
  - all-caps
  - dual-font
dimensions_with_reference: []
---

> 场景适配:适用于社媒图文、分享卡片、品牌帖子。重点关注色彩块面、视觉钩子与叙事节奏;尺寸按平台裁切,构图原则不变。

# Narrative

An event design agency landing page positioning itself as a community-focused partner — a collaborator for brands seeking to bridge digital and real-world community building. The narrative flows from a bold typographic hero through client credibility (horizontal logo marquee), a manifesto section with massive orange color block, expandable service offerings, and a contact form. The tone is playful yet professional, using bright, unconventional colors to signal creative energy.

# Tech Stack

Built with a visual site builder. Uses a component system with custom CSS variables for the color tokens. Fonts loaded via CDN with unicode-range subsetting. Minimal custom JavaScript — relies on the built-in animation engine.

# Layout

Full-bleed vertical stack with distinct color-blocked sections. Hero is centered single-column with generous padding. Client logos run in a horizontal scrolling marquee. The manifesto section uses a massive orange viewport-height block with centered text. Services section uses full-width expandable rows on green background. Contact section returns to pink with a centered form. No sidebar; navigation is minimal header-only.

# Typography

Dual-font system: **ABC Monument Grotesk** (Black, Heavy, Regular, Thin weights) for display and UI, paired with **PP Editorial New Ultralight** for elegant accents and **Helvetica Neue LT Std 55 Roman** for body text. Inter loaded as system fallback. Hero headline uses extremely tight tracking with stacked lines. All-caps treatment for emphasis throughout.

# Color

Three-color blocking system: **#fe99d9** (hot pink) for hero and contact backgrounds, **#ff6502** (vibrant orange) for manifesto section, **#1f9540** (bright green) for services section. Black (#000) for text on light backgrounds, white (#fff) for text on dark/color backgrounds. Yellow accent bar for client section divider. High saturation, playful palette.

# Imagery

No photography — purely typographic and brand-driven. Client logos (SVG) in black monochrome. Logo mark is a custom SVG wordmark. Visual impact comes from color fields and type scale rather than imagery.

# Components

**Primary button**: Pill-shaped (border-radius: 999px), black fill, white text, green border (#1f9540) on hover/focus. **Form inputs**: Transparent background, white border (1px solid), white text with white placeholder, centered text alignment, no visible label. **Service rows**: Full-width horizontal bands with centered text, expandable on interaction.

# Motion

Horizontal marquee animation for client logos (continuous scroll). Scroll-triggered reveals for section transitions. Button hover states with border color transition. Service row expand/collapse animation. Smooth scroll behavior between sections. Spring-physics based transitions for interactive elements.

# Algorithms

Standard implementation, no special design.

# Material

Standard implementation, no special design.

# Craft

Sharp corner radius (0px) on inputs and containers except for pill buttons. Custom focus states with red outline (#ff0000) on form fields. SVG logo rendered with pixelated image-rendering for crisp edges. Consistent 1px borders on interactive elements.

# Coherence

The hot-pink-to-orange-to-green color progression creates an energetic, unconventional rhythm that reinforces the agency's positioning as creative community builders. The tight typographic system (ABC Monument Grotesk throughout) unifies the bold color blocks, while the consistent pill-button motif softens the aggressive geometry.
