---
id: tTceao0M
scenario: graphic
scenario_name: 平面
category: brand studio portfolio
modality: web
view_type: portfolio
core_dimensions:
- layout
- typography
- motion
scores:
  anti_slop_value: 0.8
  code_value: 0.5
  density: 0.7
  motion_intensity: 0.6
  novelty: 0.6
  visual_value: 0.8
tags:
  color:
  - monochrome-warm
  - light-bg
  - black-dominant
  domain:
  - portfolio
  - agency
  - studio
  imagery:
  - photo-led
  - custom-photo
  - full-bleed-img
  layout:
  - full-screen
  - asymmetric-grid
  - single-column
  material:
  - no-material
  motion:
  - drag
  - carousel
  - scroll-triggered
  - custom-cursor
  - infinite-loop
  style:
  - editorial
  - minimal
  - soft
  tech:
  - webflow
  - jquery
  - vanilla-js
  typography:
  - sans-serif
  - geometric-sans
  - custom-font
  - oversized-type
  - tight-tracking
dimensions_with_reference: []
---

> 借鉴范围：可借鉴字体、图像、色彩和视觉焦点；根据内容与交付尺寸重新构图。原参考中的交互可转化为静态节奏。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

A brand studio portfolio presenting work through an immersive, editorial experience. The narrative opens with a full-viewport project showcase — a draggable horizontal carousel of case study imagery set against pure black. Below, an about section introduces the studio's philosophy through large, confident typography mixed with team portraits. Services are listed in a clean three-column grid, followed by a client roster. The page closes with atmospheric office photography, a contact prompt, and a structured footer. The overall arc moves from dramatic project immersion to grounded studio credibility.

# Tech Stack

Webflow-built site with custom JavaScript interactions. Splide.js powers the horizontal project carousel with drag-free navigation and auto-scroll. Vimeo SDK handles video embeds with intersection-based play/pause. jQuery present for DOM manipulation. Custom font loaded via @font-face.

# Layout

Full-viewport hero (100dvh) with centered carousel. Below: generous vertical rhythm with asymmetric image placement — team portraits offset to the right, office photography scattered in an intentional non-grid pattern. Content sections use a narrow central column for text (approximately 60-70% width) with images breaking out to full width or floating at various offsets. Footer uses a three-column grid.

# Typography

Primary typeface is MNKY Banana Grotesk — a geometric sans with distinctive character. Large editorial headlines (approximately 48-64px) use tight tracking. Body text is smaller (14-16px) with generous line-height. Mixed treatment: headlines combine the geometric sans with what appears to be a secondary serif or italic style for emphasis (e.g., "work" in "resonant work comes"). All-caps used for section labels and project headers. Paragraph-12 class indicates a 12px size for captions and metadata.

# Color

Warm cream/off-white background (#f5f3ef or similar warm neutral) with pure black (#000000) text. The hero section inverts this — pure black background with project imagery. No accent colors; the palette is strictly monochrome with warmth coming from the cream tone. Images provide the only color variation.

# Imagery

High-quality custom photography throughout: team portraits in natural office environment, candid workspace shots, styled shelf arrangements with design books, and large-format project case study images. Project imagery in the carousel shows brand work, conference presentations, and product designs. Photography style is documentary-meets-editorial — natural lighting, shallow depth of field, warm tones.

# Components

**Project carousel**: Full-height draggable slider with Splide.js. Shows one project image at a time with dynamic text overlay (project name, description, case study link). Custom cursor feedback on drag.

**Preloader**: Full-screen overlay with brand logo that fades out on load.

**Links**: Underlined text links for inline references (team names, email). No button components — actions are text-based.

**Services grid**: Three-column text list with category headers.

# Motion

Preloader fade-out sequence on page load. Horizontal carousel with momentum-based dragging and continuous auto-scroll (0.6 speed, increasing to 1 on mobile). Dynamic text updates when carousel slides change — project title, subtitle, description, and case study link all animate to new content. Custom cursor element that responds to mousedown/mouseup on the slider (resizes from 117×46px to 130×35px). Smooth scroll behavior for anchor links.

# Algorithms

Standard implementation, no special design.

# Material

Standard implementation, no special design.

# Craft

Preloader with logo fade sequence. Custom cursor interaction state on draggable carousel. Intersection Observer pauses Vimeo embeds when off-screen. MutationObserver watches for active slide class changes to update project metadata dynamically.

# Coherence

The monochrome palette and warm cream create a gallery-like atmosphere that lets the colorful project work dominate. The full-viewport hero immerses visitors immediately in the studio's output, while the editorial typography and asymmetric layout below establish craft credibility. Every element — from the custom typeface to the scattered photography — reinforces a design-forward positioning.
