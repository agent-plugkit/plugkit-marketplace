---
id: rVQmfOqR
scenario: ui
scenario_name: 界面
category: agency landing
modality: web
view_type: landing
core_dimensions:
- motion
- typography
- imagery
scores:
  anti_slop_value: 0.7
  code_value: 0.5
  density: 0.7
  motion_intensity: 0.8
  novelty: 0.6
  visual_value: 0.7
tags:
  color:
  - dark-bg
  - accent-purple
  - multi-accent
  - gradient-led
  domain:
  - agency
  - saas
  - corporate
  imagery:
  - 3d-render
  - custom-photo
  - icon-driven
  layout:
  - full-bleed
  - centered
  - card-grid
  - hero-centered
  material:
  - gradient-bg
  - soft-shadow
  - glossy
  motion:
  - infinite-loop
  - marquee
  - hover-reveal
  - scroll-triggered
  - entrance-animation
  style:
  - dark-led
  - bold
  - playful
  tech:
  - webflow
  - jquery
  - vanilla-js
  typography:
  - sans-serif
  - display-serif
  - tight-tracking
  - custom-font
dimensions_with_reference: []
---

> 借鉴范围：可借鉴交互、导航、组件组织或界面层级；根据当前用户任务、已有设计系统和技术栈重新实现。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

A creative agency landing page targeting B2B marketing. The narrative flows from credibility (star rating + client logos) through value proposition ("Creative that wins") to process explanation (3-step how-it-works with animated widgets), service showcase (tabbed portfolio), social proof (infinite testimonial marquee), and conversion (newsletter + contact). The story emphasizes "in-house creative team without overheads" for enterprise clients.

# Tech Stack

Webflow-built site with custom CSS animations. Uses jQuery for interactions. Custom @font-face loading for Almarena Neue Display family. CSS keyframe animations for marquees. Tab system uses stacked grid technique for equal-height panes.

# Layout

Dark graphite background (#2F282F) with full-bleed sections. Hero centers content with max-width container. Three-step process uses asymmetric card grid with animated UI widgets floating beside text. Services section uses horizontal scrolling tab menu above full-width image showcase. Testimonials use infinite horizontal marquee. Footer uses 4-column grid.

# Typography

Primary font: **Almarena Neue Display** (Regular, Medium, SemiBold, Bold weights). Large display headings (approx 48-64px) with tight tracking. Body text uses lighter weight at comfortable line-height. Uppercase eyebrow labels with small circular dot indicator. Hierarchy: Display > Heading-2 > Body-standard > Caption.

# Color

Dark graphite background `#2F282F` dominates. Primary accent is violet/purple `#874FD4` used for buttons, icons, and interactive elements. Secondary accents: yellow `#FFEB85`, green, pink for avatar backgrounds. Text is white/off-white on dark. Gradient stops for hover states: `#368CFB`, `#5CAEFE`, `#FFEB85`.

# Imagery

3D-rendered emoji avatars (Memoji-style) are signature visual elements - used in star-rating component, testimonial cards, and process widgets. Portfolio showcase uses full-bleed project mockups. Client logos in grayscale for logo wall. Custom cursor pointer graphics with team role labels ("Designer", "Account Manager").

# Components

**Buttons**: Dual-text slide animation on hover (text wraps translate vertically). Primary uses violet fill, secondary uses transparent with border.

**Star Rating Eyebrow**: Avatar group (3 circular 3D emojis) + star SVG + "Trusted by" text - used as social proof header.

**Service Tabs**: Horizontal scrollable menu with pill-style active state. Content area shows full-bleed project image.

**Process Widgets**: Animated UI cards showing project brief interface, team selection, and file delivery - complete with custom cursor pointers.

**Testimonial Cards**: Logo + quote + avatar + name/title in dark cards, arranged in infinite marquee.

# Motion

Multiple marquee animations: header portfolio track (200s linear), logo wall (80s linear), testimonials (150s linear). All pause on hover. Tab transitions use opacity fade (300ms in, 100ms out). Buttons use text-slide transform. Navbar hides on scroll down, shows on scroll up (translateY transition). See references/motion.md for implementation details.

# Algorithms

Standard implementation, no special design.

# Material

Standard implementation, no special design.

# Craft

Gradient fade masks on marquee edges using `-webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent)`. Custom scrollbar hiding for tab menu (`-ms-overflow-style: none`, `scrollbar-width: none`). Line-clamp utility for text truncation. Reduced motion media query support for all animations.
