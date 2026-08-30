---
id: C4aZtWoH
scenario: infographic
scenario_name: 信息图
category: art school exhibition
modality: web
view_type: portfolio
core_dimensions:
- typography
- motion
- layout
scores:
  anti_slop_value: 0.9
  code_value: 0.7
  density: 0.7
  motion_intensity: 0.5
  novelty: 0.8
  visual_value: 0.85
tags:
  color:
  - monochrome-bw
  - high-contrast
  - black-dominant
  - white-dominant
  domain:
  - art
  - education
  - portfolio
  imagery:
  - photo-led
  - custom-photo
  - monochrome-img
  - portrait
  layout:
  - full-bleed
  - centered
  - hero-centered
  - asymmetric-grid
  material:
  - no-material
  motion:
  - scroll-triggered
  - hover-reveal
  - entrance-animation
  - ambient-animation
  style:
  - minimal
  - editorial
  - experimental
  - monochrome-style
  tech:
  - nextjs
  - react
  - vanilla-js
  typography:
  - sans-serif
  - serif
  - dual-font
  - custom-font
  - oversized-type
  - type-driven
dimensions_with_reference: []
---

> 场景适配:适用于信息图、数据报告、仪表盘。重点关注信息密度、数字层级、图表组件与阅读动线。

# Narrative

An MFA photography program graduation exhibition site. The narrative centers on the concept of looking back with clarity — a play on the year and the clarity of hindsight. The hero presents the program name as an eye exam chart, with letters descending in size row by row: the institution abbreviation → program name → degree year → exhibition title. A horizontal header lists all 10 graduating photographers as navigation. The page flows through a "Questions for photographers" section with philosophical inquiries in varied alignments, followed by acknowledgments and colophon. The metaphor of vision, clarity, and perspective unifies the content.

# Tech Stack

Next.js with static site generation (SSG). Styled-components for CSS-in-JS. Custom webpack configuration. No external UI framework — all components custom-built.

# Layout

Full-viewport hero with eye-chart typography centered vertically. Header row with photographer names spans full width, each name linked to individual portfolio pages. Eye chart uses flexbox rows with justified letter spacing. Questions section uses asymmetric text placement — alternating left/center/right alignment with varying widths (22vw to 50vw). About section uses two-column grid for acknowledgments. Generous whitespace throughout.

# Typography

Dual font system: **Optician Sans** (display) for the eye chart — a font designed to mimic Snellen eye chart letterforms with uniform stroke weight and distinctive geometric cuts; **Sang Bleu Versailles** (text) in Regular and Medium weights, both roman and italic, for body text and navigation. Eye chart font sizes descend dramatically: institution letters at ~468px, program at ~284px, discipline at ~160px, degree year at ~85px, exhibition title at ~46px. Italic styling used for section labels like "[About]" and "[Questions for photographers]".

# Color

Strict monochrome palette: `#000000` text on `#ffffff` background. No accent colors. Links inherit black with underline on hover. Border colors use rgba(0,0,0,0) for invisible borders that show on interaction.

# Imagery

Black and white photography from the MFA candidates — documentary, portrait, and conceptual work. Images appear as floating overlays on the eye chart (positioned absolutely, display:none by default, revealed via JS on hover). Individual portfolio pages show full image galleries. Photography style: mostly monochrome, intimate, experimental.

# Components

Header names are text links with hover state. Eye chart letters are individual flex items with calculated font sizes. "Questions" are paragraph blocks with inline width and alignment styles. Two-column acknowledgment lists. External links open in new tabs. Minimal button treatment — text links only.

# Motion

Loading screen animates "LOADING" letters with blur filter keyframes (0px → 5px → 0px). Eye chart images fade in/out on name hover. Smooth scroll behavior for anchor links. Scroll-triggered opacity changes on the eye chart container (blur filter transitions from 0px as user scrolles). See references/motion.md for animation specifics.

# Algorithms

Eye chart letter sizing follows a logarithmic descent pattern approximating Snellen chart proportions. Image positioning on hover uses randomized placement within viewport bounds with collision detection. Shuffle algorithm randomizes image display order.

# Material

Standard implementation, no special design.

# Craft

Custom cursor behavior on interactive elements. Border-bottom transitions for link underlines. Focus states maintained for accessibility. No visible scroll styling. Clean favicon as PNG.

# Coherence

The eye chart metaphor binds the entire experience — from the typography choice (Optician Sans) to the descending letter hierarchy to the exhibition title. The monochrome palette keeps focus on the photography and the conceptual framework of vision and clarity. The questions section's scattered alignment mirrors the uncertainty and exploration inherent in photographic practice.
