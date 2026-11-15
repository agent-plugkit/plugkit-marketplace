---
id: lC4BpOAk
scenario: ui
scenario_name: 界面
category: personal portfolio
modality: web
view_type: landing
core_dimensions:
- color
- typography
- components
scores:
  anti_slop_value: 0.7
  code_value: 0.5
  density: 0.6
  motion_intensity: 0.3
  novelty: 0.5
  visual_value: 0.6
tags:
  color:
  - dark-bg
  - monochrome-cool
  - single-accent
  domain:
  - portfolio
  - personal-brand
  - agency
  imagery:
  - product-render
  - thumbnail-grid
  - custom-photo
  layout:
  - centered
  - single-column
  - floating
  material:
  - glass
  - blur
  - shadow-led
  motion:
  - scroll-triggered
  - hover-reveal
  - carousel
  style:
  - minimal
  - dark-led
  - technical
  tech:
  - nextjs
  - tailwind
  - react
  typography:
  - monospace
  - type-driven
  - high-contrast-type
dimensions_with_reference: []
---

> 借鉴范围：可借鉴交互、导航、组件组织或界面层级；根据当前用户任务、已有设计系统和技术栈重新实现。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

Personal portfolio of a product designer with engineering background. Single-page narrative flows from hero introduction through work showcase carousel to service description, client logos, writing links, and contact. The story emphasizes technical fluency — "engineer's brain to product design" — targeting founders and technical teams who need build-ready interfaces.

# Tech Stack

Next.js with Tailwind CSS. Swiper.js for horizontal portfolio carousel. React Tooltip for icon labels. Dark mode support via `dark:` Tailwind variants.

# Layout

Centered single-column layout with `max-w-[688px]` content well. Generous vertical rhythm with `gap-8 sm:gap-12` between sections. Fixed floating navigation bar at bottom center (`fixed left-1/2 -translate-x-1/2 bottom-6`). Horizontal overflow carousel for portfolio work with gradient fade at edges (`bg-gradient-to-b from-brand-dark/0 to-brand-dark`).

# Typography

Monospace font family throughout — IBM Plex Mono or similar grotesque monospace. Large intro text at `text-xl sm:text-2xl`. Section headings use inline-block white background highlight (`bg-white text-brand-dark dark:text-brand-light`) creating a marker-style emphasis. Body text at `text-lg sm:text-xl` in the intro quote box. Tight line-height with `leading-relaxed` on section content.

# Color

Deep navy background (`bg-brand-dark` / `dark:bg-brand-light` — approximately `#0a0a1a` or similar deep blue-black). Pure white text at 75% opacity default, 100% for emphasis. White background blocks for highlighted text and section headings. Dark mode inverts to white page background with navy text. Accent colors come from portfolio screenshots rather than UI chrome.

# Imagery

Portfolio carousel displays UI screenshots at 640×480px with `shadow-xl` elevation. Screenshots show dev tools, design systems, and productivity apps. Small circular profile photo (128px) with `pointer-events-none`. Client logos rendered as inline SVGs (Stack Overflow, Canva, DEV.to, X-Team).

# Components

**Floating nav**: Pill-shaped container (`rounded-full`) with `backdrop-blur-xl` glassmorphism, `shadow-2xl`, semi-transparent background (`bg-black/50` dark / `dark:bg-white/75` light). Two pill clusters: primary CTA "Book a call" and secondary social links.

**Quote box**: Bordered container (`border border-brand-subtle`) with decorative 8px corner squares (`size-2 border border-brand-subtle`) positioned absolutely at four corners, creating a technical/drafting aesthetic.

**Highlighted headings**: Section titles wrapped in `bg-white` inline blocks with `text-brand-dark` / `dark:text-brand-light`, creating high-contrast labels against the dark page.

**Carousel**: Swiper.js horizontal scroll with `max-w-[688px]` slides, `shadow-xl` images, and descriptive captions at 60% opacity white.

# Motion

Scroll-triggered fade-in animations on sections (`intro-fadeout` class with opacity/blur/transform transitions). Carousel supports touch/drag navigation with momentum. Navigation pills have subtle hover transitions (`hover:bg-white/10`, `dark:hover:bg-brand-light/10`).

# Algorithms

Standard implementation, no special design.

# Material

Glassmorphism on floating navigation via `backdrop-blur-xl`. Subtle ring shadow (`ring-black/5`) on nav pills. Heavy drop shadows (`shadow-2xl`, `shadow-xl`) on interactive elements and portfolio images.

# Craft

Corner bracket decorations on quote box — four 8px squares with borders positioned at corners, referencing technical drawing conventions. Tooltip labels on social icons. Responsive breakpoint at `sm:` (640px) for typography scale and layout adjustments.
