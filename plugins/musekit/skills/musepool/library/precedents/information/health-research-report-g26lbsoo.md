---
id: G26LBSOO
scenario: information
scenario_name: 信息表达
category: health research report
modality: web
view_type: landing
core_dimensions:
- typography
- color
- imagery
scores:
  anti_slop_value: 0.8
  code_value: 0.4
  density: 0.6
  motion_intensity: 0.3
  novelty: 0.7
  visual_value: 0.8
tags:
  color:
  - light-bg
  - single-accent
  - accent-green
  - pastel
  domain:
  - health
  - education
  - product-showcase
  imagery:
  - 3d-render
  - abstract-graphics
  - custom-photo
  layout:
  - single-column
  - asymmetric-grid
  - full-bleed
  material:
  - glass
  - glossy
  - holographic
  motion:
  - scroll-triggered
  - entrance-animation
  - hover-reveal
  - smooth-scroll
  style:
  - editorial
  - futuristic
  - minimal
  - soft
  tech:
  - vanilla-js
  - webflow
  - gsap
  typography:
  - serif
  - sans-serif
  - dual-font
  - display-serif
  - oversized-type
dimensions_with_reference: []
---

> 借鉴范围：可借鉴信息层级、标注、阅读顺序或解释方法；事实、数据和科学结论必须来自当前任务的原始资料。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

A research report landing page for a women's health data initiative. The narrative flows from an editorial hero with a 3D iridescent hand sculpture and provocative headline, through numbered research sections (01-05), to a demo day CTA and data evaluation interactive section. The closing reinforces the mission with a lime-green statement block. The tone is scientific yet approachable, positioning the organization as a bridge between raw data and actionable health insights.

# Tech Stack

Framer-generated site with inline CSS-in-JS styling. Google Tag Manager for analytics. No external CSS framework visible; styles applied via generated class names (css- prefix). Fonts loaded via @font-face with woff2 subsets.

# Layout

Asymmetric editorial layout with generous whitespace. Hero uses split composition: 3D imagery floats right while headline anchors left. Numbered sections (01-05) create vertical rhythm with consistent left-aligned labels. Full-bleed lime green blocks interrupt the white canvas for CTAs and key statements. Grid alternates between single-column text and two-column data comparisons. Sticky navigation bar with minimal horizontal arrangement.

# Typography

Dual-font system: Antic Didone (serif display) for headlines and section numbers, paired with Instrument Sans and Roboto (sans-serif) for body text. Headlines use tight leading with dramatic size contrast—hero text is oversized with word-breaks for rhythm. Section numbers (01, 02...) rendered in Didone at large scale, positioned as graphic elements. Body text maintains readable measure with moderate line-height.

# Color

Neutral base (#ffffff background, #181616 near-black text) with a signature lime green accent (#e9ff96) used for CTAs, highlight blocks, and interactive states. The lime appears in full-bleed sections, button fills, and toggle backgrounds. Text on lime blocks reverses to dark. 3D imagery introduces iridescent pastels (holographic blues, pinks, purples) that complement the lime without competing.

# Imagery

3D rendered sculptures dominate: iridescent glass-like hand and arm forms with holographic surface reflections, appearing against pale neutral backgrounds. A surreal landscape image features a vertical mirror monolith in a pastel-colored coastal scene with pink vegetation. Imagery style is AI-generated or highly stylized 3D, with ethereal, futuristic qualities. All images have soft lighting and pastel iridescence.

# Components

Primary CTA buttons use the lime green (#e9ff96) fill with dark text, pill or slightly rounded shape. Secondary buttons are outline style. Toggle/switch component for "Open Access" vs "Closed Access" selection uses lime green for active state. Cards are minimal with thin borders or shadow only when necessary. Navigation is text-based with underline hover states.

# Motion

Scroll-triggered fade-in animations for content sections. Elements animate with opacity transitions (0 to 1) and subtle transform translations. Framer-generated animation classes handle entrance timing. No parallax detected. Hover states on interactive elements use standard CSS transitions.

# Algorithms

Standard implementation, no special design.

# Material

Glass-like material in 3D renders with iridescent surface shaders. Digital aesthetic—clean, smooth, reflective. No physical textures applied to UI elements; flat color blocks only.

# Craft

Corner radius on buttons and containers is subtle (likely 4-8px). Focus states not visible in static capture. Scrollbar styling follows browser default. Loading states not captured. SVG logo implementation uses CSS variable for fill color (`var(--fill-0, #181616)`), enabling theme adaptability.

# Coherence

The lime green accent acts as a unifying thread, appearing in CTAs, highlight sections, and interactive states. The iridescent 3D imagery reinforces the "data as something tangible yet ethereal" concept. Editorial typography with Didone serifs lends credibility to the health research positioning while the modern sans-serif body maintains accessibility.
