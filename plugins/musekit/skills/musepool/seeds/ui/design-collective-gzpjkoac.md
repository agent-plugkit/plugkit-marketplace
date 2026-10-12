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

A design collective site working on public-interest projects for young people. The narrative flows from a bold typographic hero through news announcements, project showcases, collaboration CTAs, journal entries, and methodology explanations. The tone is playful yet professional, framing play as a rigorous working method rather than a break from it.

# Tech Stack

Webflow-generated site with custom CSS design system. Uses CSS custom properties for tokens, a licensed geometric sans family (Medium 500, Black 900), and Webflow's native slider/background-video components.

# Layout

Full-bleed sections with consistent 4px margin gaps between them, creating a subtle segmented feel. Rounded corners on all sections (one shared radius utility) soften the layout. Flexible grid system with 4px gutters. Sections alternate between full viewport height (min-height: 100vh) and content-driven heights. Hero uses asymmetric two-column layout with oversized headline left, body text right.

# Typography

Primary font: a friendly geometric sans-serif with round bowls and a chunky, poster-like Black weight, used in weights 500 and 900. H1 at 8rem desktop (scales to 2.8rem mobile), weight 900, tight line-height (1em), negative letter-spacing (-1px). Body text at 1.5rem with -1px tracking. Eyebrow labels in smaller size (1rem) with uppercase styling. Underlined links with custom offset (0.05em) and thickness (0.1em).

# Color

Deep navy background (#021a50) with vibrant primary red (#f34020) as accent. Secondary palette: warm yellow (#f9da73), pale blush pink (#f6ccc7), pale lavender (#e6e6fa), periwinkle blue (#88a6ea), soft violet-blue (#8888dd). Text in main blue (#002f99) on light backgrounds, blush pink on dark. Selection highlight uses Selection Red (#E22C05), a deeper value of the primary red, with white text at 4.56:1; white on the primary red itself is only 3.77:1, so #f34020 stays for borders, focus outlines, active states and accents.

# Imagery

Photography-led content showing children in workshop settings, urban interventions, and collaborative activities. Images have rounded corners matching the card system. A light-grey square grid pattern image overlays the hero section. Video backgrounds in some sections. A grid of issue icons in the footer area maps projects to the social themes they address.

# Components

Pill-shaped buttons with 999999rem border-radius, 3px primary-red border, white fill. Cards with 3rem border-radius, gradient fills (yellow-to-pastel combinations). Form inputs with floating labels, 0.5rem radius, violet-blue borders that transition to primary red on focus. Custom radio/checkbox inputs with primary-red active states.

# Motion

Button hover uses inset box-shadow animation (0 to 100px over 0.3s) with cubic-bezier(0.165, 0.84, 0.44, 1) easing. Input borders transition to primary color on focus. Link underlines remove on hover. Smooth transitions on interactive elements at 0.3s duration.

# Algorithms

Standard implementation, no special design.

# Material

Subtle grid texture overlay on select sections. Gradient backgrounds on cards using 125deg angle (pale lavender to blush pink/yellow). No heavy shadows or glass effects—flat, clean surfaces.

# Craft

Consistent 4px spacing system throughout. Text selection color customized to Selection Red, the deeper brand primary. Focus outlines use primary red with 2px offset. Rounded corners applied universally (sections, cards, buttons, inputs). Underline link treatment with precise offset control.
