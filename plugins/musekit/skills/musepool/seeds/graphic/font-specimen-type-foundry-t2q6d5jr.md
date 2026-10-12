---
id: t2Q6D5JR
scenario: graphic
scenario_name: 平面
category: font specimen / type foundry
modality: web
view_type: landing
core_dimensions:
- typography
- narrative
- motion
scores:
  anti_slop_value: 0.9
  code_value: 0.75
  density: 0.85
  motion_intensity: 0.6
  novelty: 0.8
  visual_value: 0.85
tags:
  color:
  - monochrome-bw
  - high-contrast
  - muted-color
  domain:
  - product-showcase
  - portfolio
  - art
  imagery:
  - svg-led
  - illustration-led
  - no-imagery
  layout:
  - single-column
  - centered
  - text-led
  material:
  - no-material
  - matte
  - other-material
  motion:
  - hover-reveal
  - entrance-animation
  - canvas-animation
  style:
  - retro
  - technical
  - minimal
  - experimental
  tech:
  - vanilla-js
  - vite
  - other-tech
  typography:
  - monospace
  - custom-font
  - all-caps
  - type-driven
dimensions_with_reference: []
---

> 借鉴范围：可借鉴字体、图像、色彩和视觉焦点；根据内容与交付尺寸重新构图。原参考中的交互可转化为静态节奏。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

A monospace pixel font specimen site presenting an open-source pixel monospace typeface — technical and lo-fi in character. The narrative unfolds as a space mission dossier: hero introduces the font with flight departure board aesthetics, followed by type samples in ASCII/terminal style, a detailed glyph browser with anatomical measurements, a fictional space mission report (complete with data tables and scientific analysis), and closes with an interactive 8-bit brick-breaker game demonstrating the font in game UI contexts.

# Tech Stack

Static HTML/CSS/JS site built with Vite. Custom pixel font loaded via @font-face (OTF and WOFF2). Interactive glyph browser and brick-breaker game implemented in vanilla JavaScript with canvas rendering. SVG illustrations for technical diagrams (a vintage spacecraft schematic, an early flight-computer block diagram, a network packet structure).

# Layout

Single-column scrolling layout with max-width containers. Hero section uses layered composition: floating SVG ephemera (planet, badge, paperclip, highlighter) positioned absolutely around a central ASCII flight board. Type samples displayed in bordered boxes with scan-line aesthetic. Glyph browser uses split layout: static specimen image left, interactive grid right. Mission report formatted as monospace document with ASCII table borders. Game canvas centered with comment-style caption above.

# Typography

Primary: the specimen's own **pixel monospace** (8x8 pixel grid, monospaced). Font renders at pixel-perfect sizes (no anti-aliasing). Hierarchy established through size contrast: massive all-caps pixel hero title with one letter swapped for a stylized variant glyph, body text at readable pixel scale, comments prefixed with "░" block character. ASCII art used for decorative elements (flight board borders, keyboard layout, packet diagram). All-caps treatment for headers and UI labels.

# Color

Palette: **#222222** (primary text/borders), **#C0C0C0** (secondary/muted), **#6C6C58** (diagram lines), **#FFFFFF** (background). High-contrast monochrome with warm gray undertones. No gradients — flat fills only. SVG diagrams use stroke-based rendering in muted olive-gray (#6C6C58). Hover states invert or highlight in pure black.

# Imagery

SVG-based technical illustrations: a vintage space capsule diagram with labeled components and dimension lines, an early flight-computer architecture block diagram, a network packet structure rendered as ASCII tables, keyboard layout diagram. Floating ephemera in hero: planet, brief, newspaper clipping, paperclip, badge, highlighter — all drawn in flat vector style matching the pixel aesthetic. No photography — entirely vector/typographic.

# Components

Menu links styled as terminal commands: a symbol prefix (prompt caret, heart, down arrow) followed by an all-caps link label for source, support and download. Glyph browser items are clickable tiles with tabindex, showing character + Unicode value on selection. ASCII table borders using box-drawing characters (┌─┐│). Blinking cursor effect on flight board rows (CSS animation). Comment blocks use "░" prefix character for meta commentary.

# Motion

CSS blink animation on flight status rows (0.8s interval). Smooth scroll behavior. Glyph browser: click updates specimen display with selected character, showing anatomy measurements (ascender, x-height, baseline, descender as font units). Canvas-based brick-breaker game with keyboard controls, ball physics, brick destruction, score display in pixel font. Audio elements present for game feedback.

# Algorithms

The game implements classic brick-breaker physics: ball velocity with wall/paddle/brick collision detection, paddle movement constrained to canvas bounds, brick grid generation with row/column iteration, score increment on brick hit. Glyph browser filters Unicode ranges (Basic Latin, etc.) into segment headers.

# Material

Flat digital aesthetic — no texture, no shadow, no depth. Pixel-perfect rendering with crisp edges. Scan-line implied through horizontal rules and bordered containers. Paper/document metaphor in hero section through floating stationery SVGs.

# Craft

Pixel font renders at exact multiples to prevent subpixel blur. The font's version number is displayed in superscript style. Responsive breakpoints hide complex diagrams on small screens. Footer credits in same monospace treatment with an open font license mention.

# Coherence

The space mission narrative unifies all elements: flight board → type samples → technical diagrams → mission report → 8-bit game. Every component reinforces the "lo-fi technical" positioning of the font — from ASCII art to scientific data tables to retro gaming.
