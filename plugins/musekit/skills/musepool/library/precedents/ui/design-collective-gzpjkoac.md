---
id: GzPJkoac
scenario: ui
scenario_name: 界面
category: design collective
modality: web
view_type: landing
core_dimensions:
- color
- typography
- layout
scores:
  anti_slop_value: 0.7
  code_value: 0.5
  density: 0.7
  motion_intensity: 0.3
  novelty: 0.6
  visual_value: 0.7
tags:
  color:
  - multi-accent
  - dark-bg
  - accent-red
  - accent-yellow
  - blue-dominant
  domain:
  - studio
  - portfolio
  - agency
  imagery:
  - photo-led
  - custom-photo
  - gallery
  - full-bleed-img
  layout:
  - full-bleed
  - sticky-sections
  - card-grid
  material:
  - gradient-bg
  - soft-shadow
  - textured
  - matte
  motion:
  - hover-reveal
  - hover-scale
  - smooth-scroll
  - entrance-animation
  style:
  - playful
  - bold
  - editorial
  tech:
  - webflow
  - vanilla-js
  - jquery
  typography:
  - sans-serif
  - geometric-sans
  - oversized-type
  - tight-tracking
  - custom-font
dimensions_with_reference: []
---

> 借鉴范围：可借鉴交互、导航、组件组织或界面层级；根据当前用户任务、已有设计系统和技术栈重新实现。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

A designer collective site focused on creating positive changes for children and teenagers. The narrative flows from a bold typographic hero through news announcements, project showcases, collaboration CTAs, journal entries, and methodology explanations. The tone is playful yet professional, emphasizing "serious play" as a core philosophy.

# Tech Stack

Webflow-generated site with custom CSS design system. Uses CSS custom properties for tokens, Gerbera font family (Medium 500, Black 900), and Webflow's native slider/background-video components.

# Layout

Full-bleed sections with consistent 4px margin gaps between them, creating a subtle segmented feel. Rounded corners on all sections (u-radius class) soften the layout. Flexible grid system with 4px gutters. Sections alternate between full viewport height (min-height: 100vh) and content-driven heights. Hero uses asymmetric two-column layout with oversized headline left, body text right.

# Typography

Primary font: Gerbera (custom geometric sans-serif) in weights 500 and 900. H1 at 8rem desktop (scales to 2.8rem mobile), weight 900, tight line-height (1em), negative letter-spacing (-1px). Body text at 1.5rem with -1px tracking. Eyebrow labels in smaller size (1rem) with uppercase styling. Underlined links with custom offset (0.05em) and thickness (0.1em).

# Color

Deep navy background (#021a50) with vibrant primary red (#f34020) as accent. Secondary palette: yolk yellow (#f9da73), off-white (#f6ccc7), light gray (#e6e6fa), pandan green (#88a6ea), mid-gray (#8888dd). Text in main blue (#002f99) on light backgrounds, off-white on dark. Selection highlight uses primary red with white text.

# Imagery

Photography-led content showing children in workshop settings, urban interventions, and collaborative activities. Images have rounded corners matching the card system. Background grid pattern (bg-grids-16x0-light-grey.png) overlays hero section. Video backgrounds in some sections. SDGs (Sustainable Development Goals) icon grid in footer area.

# Components

Pill-shaped buttons with 999999rem border-radius, 3px primary-red border, white fill. Cards with 3rem border-radius, gradient fills (yolk-to-pastel combinations). Form inputs with floating labels, 0.5rem radius, mid-gray borders that transition to primary red on focus. Custom radio/checkbox inputs with primary-red active states.

# Motion

Button hover uses inset box-shadow animation (0 to 100px over 0.3s) with cubic-bezier(0.165, 0.84, 0.44, 1) easing. Input borders transition to primary color on focus. Link underlines remove on hover. Smooth transitions on interactive elements at 0.3s duration.

# Algorithms

Standard implementation, no special design.

# Material

Subtle grid texture overlay on select sections. Gradient backgrounds on cards using 125deg angle (light-gray to off-white/yolk). No heavy shadows or glass effects—flat, clean surfaces.

# Craft

Consistent 4px spacing system throughout. Text selection color customized to brand primary. Focus outlines use primary red with 2px offset. Rounded corners applied universally (sections, cards, buttons, inputs). Underline link treatment with precise offset control.
