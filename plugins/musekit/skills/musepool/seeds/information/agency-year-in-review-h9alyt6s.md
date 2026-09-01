---
id: H9aLYT6s
scenario: information
scenario_name: 信息表达
category: agency year-in-review
modality: web
view_type: landing
core_dimensions:
- color
- motion
- layout
scores:
  anti_slop_value: 0.8
  code_value: 0.6
  density: 0.7
  motion_intensity: 0.7
  novelty: 0.6
  visual_value: 0.8
tags:
  color:
  - blue-dominant
  - high-contrast
  - brand-color-led
  - dark-bg
  domain:
  - agency
  - portfolio
  - campaign
  imagery:
  - photo-led
  - custom-photo
  - thumbnail-grid
  - gallery
  layout:
  - full-bleed
  - centered
  - scrollytelling
  - single-column
  material:
  - no-material
  motion:
  - scroll-triggered
  - ambient-animation
  - marquee
  - entrance-animation
  - infinite-loop
  style:
  - bold
  - playful
  - dark-led
  tech:
  - webflow
  - gsap
  - jquery
  typography:
  - sans-serif
  - oversized-type
  - tight-tracking
  - high-contrast-type
dimensions_with_reference: []
---

> 借鉴范围：可借鉴信息层级、标注、阅读顺序或解释方法；事实、数据和科学结论必须来自当前任务的原始资料。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

A design studio's 2024 Year in Review landing page. The narrative flows from an impactful hero announcing "2024 in review" through client testimonial video, a scrolling marquee of praise words, team philosophy reveal with scroll-triggered text animation, project showcase gallery, and a bold CTA footer. The page celebrates the studio's journey while demonstrating their own design capabilities.

# Tech Stack

Webflow-generated site with GSAP + ScrollTrigger for scroll-driven animations. Custom video player library for embedded video. Custom CSS animations for snowflake effects and marquee. Fluid responsive scaling via viewport-based font sizing (1.1111vw clamp for 992-1440px).

# Layout

Full-bleed sections with generous vertical padding. Hero uses massive centered typography filling viewport width. Video section breaks the blue theme with full-width embedded player. Marquee creates horizontal rhythm across the full viewport width. Project gallery uses asymmetric masonry-style grid with varying card sizes. Footer CTA centers content with background image strip.

# Typography

Large display typography dominates: hero digits appear at approximately 20vw size. Bold weight (700) for headlines. Medium weight for body. The type system uses fluid sizing responsive to viewport width. Outline/stroke treatment on some display text. Tight line heights on large headings.

# Color

Dominant electric blue (#1458e4) fills the entire page background with white (#fff) text. Secondary accent is a bright cyan-blue (#0099FF) used for button borders. The blue creates immediate brand recognition and cohesive atmosphere. Video section temporarily breaks the blue with natural video colors. Project cards introduce varied colors from client work.

# Imagery

Project showcase features screenshot thumbnails of client websites and digital products - a portfolio gallery demonstrating range. Video background shows client testimonial footage. Logo strip displays client brand marks (School of Motion, LaunchLabs, dbt Labs, Euri, etc.) in monochrome treatment. No decorative stock imagery - all content serves the narrative.

# Components

Primary CTA button: white text on transparent background with right arrow icon, border-color #0099FF. Video player: custom video player implementation with play button overlay and poster frame. Marquee tags: pill-shaped containers with large text scrolling horizontally. Project cards: screenshot thumbnails with hover states. Footer: social icon links (Twitter/X, LinkedIn, Dribbble, Facebook).

# Motion

Hero digits animate in with translate3d transforms on page load. Continuous snowflake falling animation (CSS keyframes: snowflakes-fall 10s linear infinite, snowflakes-shake 3s ease-in-out infinite). Testimonial marquee scrolls horizontally via translate3d animation. Scroll-triggered word-by-word text reveal in team section (opacity 0.25 → 1). Video play button scales on hover. See references/motion.md for animation parameters.

# Algorithms

Standard implementation, no special design.

# Material

Standard implementation, no special design.

# Craft

Custom cursor behavior on interactive elements. Focus states use 0.125rem solid #4d65ff outline with 0.125rem offset. Smooth scrolling enabled. Snowflake animation uses 12 positioned elements with randomized delays (0-3s) and positions (10%-90% left). Border-radius 1.5rem on themed containers. Anti-aliasing applied globally (-webkit-font-smoothing: antialiased).

# Coherence

The electric blue monochromatic theme unifies all sections into a cohesive brand statement. The falling snowflakes reinforce the studio's wintry/seasonal branding metaphorically. Animation choices support the celebratory year-in-review narrative - playful snow, smooth reveals, continuous motion in the marquee. The page functions as both retrospective and portfolio demonstration.
