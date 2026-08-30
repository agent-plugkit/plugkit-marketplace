---
id: upXsOXv8
scenario: academic
scenario_name: 学术插图
category: health ecommerce
modality: web
view_type: landing
core_dimensions:
- color
- typography
- imagery
scores:
  anti_slop_value: 0.8
  code_value: 0.6
  density: 0.7
  motion_intensity: 0.5
  novelty: 0.6
  visual_value: 0.8
tags:
  color:
  - monochrome-cool
  - dark-bg
  - muted-color
  - earth-tone
  domain:
  - health
  - ecommerce
  - product-showcase
  imagery:
  - video-bg
  - product-render
  - custom-photo
  - 3d-render
  layout:
  - full-bleed
  - asymmetric-grid
  - hero-centered
  - card-grid
  material:
  - soft-shadow
  - matte
  - no-material
  - textured
  motion:
  - scroll-triggered
  - parallax
  - hover-scale
  - entrance-animation
  style:
  - editorial
  - minimal
  - luxury
  tech:
  - nextjs
  - react
  - swiper
  - framer-motion
  typography:
  - sans-serif
  - custom-font
  - tight-tracking
  - fluid-type
dimensions_with_reference: []
---

> 场景适配:适用于学术插图、论文图表、科学可视化。重点关注标注精度、图示约定(尺寸线/括号/引线)与语义化配色。

# Narrative

A microbiome science company landing page with elevated production values. The narrative flows from immersive hero video through product education to social proof and scientific credibility. Opening with a full-bleed video hero establishing the "Whole body health starts in the gut" thesis, followed by a product carousel (flagship probiotic, daily multivitamin, energy supplement, sleep supplement), then educational content about probiotic science, a "You are more than human" microbiome explainer with 3D head visualization, member testimonials carousel, stories from scientists/innovators grid, and closing with the R&D division section and newsletter signup footer.

# Tech Stack

Next.js (Turbopack build) with React 19. Swiper.js for carousels (vertical hero slider, product carousel, testimonial slider). Framer Motion for animations (page transitions, scroll reveals, hover states). Mux Player for video delivery. Custom SeedSans typeface family. Styled Components for CSS-in-JS.

# Layout

Full-bleed immersive hero with vertical slider occupying 100vh. Asymmetric editorial layouts below—text often left-aligned with generous right whitespace, or split-screen compositions. Product section uses 4-column grid with equal-height cards. Science sections employ overlapping layers: text blocks float over video backgrounds with partial transparency. Footer uses asymmetric 2-column with newsletter prominent left, navigation columns right. Consistent generous padding (80-120px section spacing).

# Typography

Custom SeedSans family (Light, Regular, Medium, with Italic variants for each). Large display headlines use Light weight at 48-64px with tight leading. Body text in Regular at 16-18px. Trademark symbols (™, ®) use superscript styling with 75% font-size and negative top positioning. All-caps eyebrow text for section labels using wide tracking. Editorial-style headlines often break across lines mid-phrase for rhythmic pacing.

# Color

Deep forest green dominant: `#1c3a13` (primary brand, buttons, footer background). Off-white/cream text: `#f6f6f4` on dark backgrounds. Pure white `#ffffff` for cards and light sections. Light sage accent: `#d2d8d0` for borders and subtle backgrounds. Dark text on light: `#1c3a13` or near-black. Color strategy is monochrome-green with white/cream contrast—no competing accent colors, maintaining scientific/medical credibility.

# Imagery

High-production video backgrounds in hero (microbiome animations, nature footage). Product photography with soft shadow on neutral backgrounds. 3D rendered capsule visualizations showing dual-layer technology. Scientific illustrations—human head profile with microbiome overlay. Lifestyle photography with film grain aesthetic for member stories. UGC-style testimonials with natural lighting. All imagery shares muted, desaturated quality matching the forest green palette.

# Components

Primary buttons: pill-shaped (full rounded), forest green fill with white text, 48px height, hover scale transform. Product cards: white background, centered product image, pill-shaped "Shop Now" CTA, price below. Accordion/expanders: border-bottom divider, plus/minus icon toggle, large title with body content reveal. Video player: custom Mux integration with poster images. Cookie banner: white background, green buttons matching brand palette.

# Motion

Hero vertical slider with parallax (data-swiper-parallax="5%") on text content. Scroll-triggered fade-up reveals using Framer Motion (y: 20px to 0, opacity 0 to 1, duration 0.5s with 0.25s delay). Product carousel with smooth horizontal swipe. Video backgrounds autoplay with subtle zoom/pan. Button hovers: scale(1.02) with easeOut transition. Page load: staggered children animations with 1s delay between elements. Scroll direction detection for nav show/hide.

# Algorithms

Standard implementation, no special design.

# Material

Subtle noise texture overlays on video backgrounds. Soft shadows on product cards (0px 1px 3px rgba(0,0,0,0.25)). No glassmorphism—maintains clean scientific aesthetic. Border treatments use 1px solid rgba(255,255,255,0.2) on dark sections for subtle separation.

# Craft

Custom cursor treatment on interactive elements. Trademark symbol formatting with precise vertical alignment (top: -0.25em). Focus states use 2px solid black outline with 2px offset. Loading states for video with poster fallback images. Newsletter input with inline submit button, rounded corners matching button system.

# Coherence

The forest green palette, custom SeedSans typography, and scientific imagery work together to establish microbiome credibility. The editorial layout rhythm—alternating between immersive full-bleed and contained asymmetric grids—maintains visual interest while guiding users through education to conversion. Motion is restrained and purposeful, supporting the premium health brand positioning without distraction.
