---
id: rvYJrbZh
scenario: ui
scenario_name: 界面
category: artist portfolio
modality: web
view_type: portfolio
core_dimensions:
- typography
- imagery
- motion
scores:
  anti_slop_value: 0.85
  code_value: 0.7
  density: 0.8
  motion_intensity: 0.6
  novelty: 0.75
  visual_value: 0.8
tags:
  color:
  - monochrome-bw
  - black-dominant
  - white-dominant
  domain:
  - portfolio
  - art
  - personal-brand
  imagery:
  - photo-led
  - masked-img
  - collage
  - custom-photo
  layout:
  - text-led
  - full-bleed
  - overlapping
  material:
  - no-material
  motion:
  - scroll-driven
  - hover-reveal
  - parallax
  style:
  - editorial
  - minimal
  - experimental
  tech:
  - jquery
  - vanilla-js
  - other-tech
  typography:
  - serif
  - display-serif
  - custom-font
  - dual-font
  - oversized-type
  - type-driven
dimensions_with_reference:
- motion
- typography
---

> 借鉴范围：可借鉴交互、导航、组件组织或界面层级；根据当前用户任务、已有设计系统和技术栈重新实现。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

An artist portfolio presenting conceptual art projects through a typographic-first interface. The homepage displays the full project list as a continuous stream of text — each project title in bold italic followed by a descriptive sentence in regular italic. The narrative flow is non-hierarchical: projects appear as equal entries in a running list, suggesting a practice-based research approach where each work is part of an ongoing exploration. A hidden image layer beneath the text reveals project visuals on hover, creating a dual-layer reading experience: text as primary navigation, imagery as contextual depth.

# Tech Stack

Vanilla jQuery-based site with custom JavaScript for interactions. Uses flowtype.js for fluid typography, sticky-kit for column sticking, and skrollr for scroll-driven transforms. Modernizr for feature detection and server-side device detection to separate touch from pointer devices. No framework — hand-coded interactions.

# Layout

Single-column text stream occupying ~80% viewport width, offset by generous left margins (8rem desktop). The project list flows as continuous inline text with line-height 1.5em, creating a reading experience closer to a manifesto than a grid. Behind the text layer sits a fixed-position collage layer — a scattered arrangement of polygon-masked images that respond to scroll position with translate3d transforms. The layout rejects conventional portfolio grids in favor of editorial density.

# Typography

Dual-font system: a **Czech-style bold italic display serif** — heavy, angular, slightly folkloric — for project titles (1.06em size, 0 letter-spacing), and a **classical book serif** (regular and italic cuts) for body text (19px base, 1.5em line-height) and descriptions. A third **geometric ornament font** (dingbat-style diamonds and triangles: ◆, ▲) provides icons via CSS-generated content before each project. The scale is dramatic: project list renders at 2.5em with 1.5em line-height, creating oversized, almost poster-like text. Custom underline treatment uses `box-shadow: inset 0 -8px 0 white, inset 0 -10px 0px black` — a double-line strikethrough that inverts on hover.

# Color

Strict monochrome: `#000` text on `#fff` background. No accent colors, no gradients. Hover states use `#E6E6E6` background fill. The visual interest comes entirely from typography and image masks, not color.

# Imagery

Project images are masked into irregular geometric polygons using a set of SVG clipPath definitions, one per frame. Each shape has unique polygon coordinates creating asymmetric, shard-like frames. Images are randomly selected from per-project image lists on each interaction, creating a non-static experience. The shapes are positioned with varying margins (50px-490px top, 120px-240px left) in a scattered, non-grid arrangement. Image ratios (landscape/portrait/square) are preserved via CSS classes.

# Components

**Navigation**: Minimal header with site name left, a texts/about link pair right, a bilingual language toggle, and a small animated refresh icon (20px) that triggers image reshuffle.

**Project links**: Inline text blocks with transparent front layer (for hover detection) and visible underlined layer. Each project prefixed by a geometric icon from the ornament font.

**Collage layer**: Fixed full-screen layer (z-index: 30) containing one polygon-masked image container per project (368px × 290px base, scaled 2x). Hidden by default, revealed on hover/scroll.

# Motion

**Hover reveal**: Mouse over project text triggers specific shape visibility with 3D transform positioning (`translate3d(0, y, 0) scale(2)`). Shapes calculate vertical offset based on viewport position.

**Scroll-driven parallax**: The collage wrapper translates vertically in proportion to scroll progress (scroll position ÷ scrollable height × the collage's overflow height), creating a slow-drifting collage effect behind the text.

**Image rotation**: Clicking refresh or hovering projects loads random images from per-project image lists — each interaction surfaces different research material.

**Fluid typography**: flowtype.js adjusts font-size between 15-20px based on viewport width.

# Algorithms

Standard implementation, no special design.

# Material

Standard implementation, no special design.

# Craft

**French typographic refinement**: JavaScript applies orthographic corrections — non-breaking spaces before high punctuation (\u00A0 before ?, !, :, »), thin spaces (\u202f) for guillemets, and proper apostrophes (\u2019). CSS uses `-webkit-font-smoothing: antialiased` and `text-rendering: optimizeLegibility` throughout.

**Responsive scaling**: The collage layer scales via transform (roughly 0.65-1.0) across a handful of viewport-width breakpoints from small mobile to wide desktop.

**Mobile fallback**: Touch devices disable hover interactions; the collage layer remains hidden or accessible via click.

---

# Dimensional References(深度实现参考)


<!-- ref-dim: motion -->

# Motion Implementation

## Hover Reveal System

Two-layer project list architecture: the same list is rendered twice and stacked.

- **Front layer** — absolutely positioned on top, text colored `transparent`. It only receives pointer events.
- **Visible layer** — the styled list underneath (2.5em, line-height 1.5em) that carries the underline and hover fill.

Hover detection happens on the transparent front layer; visual feedback (underline inversion, background fill) is mirrored onto the matching item of the visible layer by toggling a shared state class. Separating hit-testing from rendering keeps the hover target stable while the visible text restyles.

## Image Display on Hover

Each list item maps by index to one masked frame in the collage layer. On hover the frame is moved to sit near the hovered line, then shown on its own:

```javascript
// Minimal illustration; tune the offsets to your own layout.
function showPreview(index, anchorY) {
  const item = items[index];
  const frame = frames[index];
  const rect = item.getBoundingClientRect();
  // Below the line when it sits in the upper part of the viewport, above it otherwise.
  const y = rect.top < window.innerHeight / 2
    ? anchorY + GAP
    : anchorY - rect.height - frame.offsetHeight;
  loadImage(frame);
  frames.forEach((f) => (f.style.visibility = 'hidden'));
  frame.style.transform = `translate3d(0, ${y - frame.offsetTop}px, 0) scale(2)`;
  frame.style.visibility = 'visible';
}
```

The placement keeps the enlarged frame inside the viewport and away from the line being read.

## Scroll-Driven Parallax

The collage wrapper is taller than the viewport. On scroll, its translation is the scroll progress (0–1) multiplied by its overflow height (wrapper height − viewport height), applied as a negative `translate3d` on Y. The collage therefore reaches its bottom edge exactly when the page does, drifting more slowly than the text above it. A small per-breakpoint correction compensates for the scaled wrapper height.

## Responsive Scale

A breakpoint table maps viewport width to a uniform `scale()` on the collage layer (about 0.65 at tablet widths up to 1.0 on wide screens) together with the height correction used by the parallax. Recompute both on resize.

## Mobile Disable

Hover listeners are attached only on pointer devices (a device-detection flag, or today `matchMedia('(hover: hover)')`). Touch devices skip the reveal entirely.

<!-- ref-dim: typography -->

# Typography Implementation

## Font Families

Three custom fonts loaded via @font-face, each with a restricted Unicode range:

- **Bold italic display serif** (project titles) — applied through a title class with `letter-spacing: 0` and `font-size: 1.06em`.
- **Geometric ornament font** (icons) — applied only through an `::before` pseudo-element with CSS-generated content.
- **Classical book serif, regular / bold / italic** (body text) — the regular cut is the base family on `html`; bold and italic are separate families switched by utility classes and `em`.

Loading each cut as its own family (rather than relying on `font-weight`/`font-style` matching) avoids synthetic bold or italic.

## Custom Underline Technique

```css
.underline {
    box-shadow: inset 0 -8px 0 white, inset 0 -10px 0px black;
}
```

Creates a double-line effect: white inset (8px) masks the background, black inset (10px) draws the line. On hover, inverts to match `#E6E6E6` background.

## Icon System

Each project item gets a geometric marker via `::before { content: "<letter>" }`; the ornament font maps ordinary Latin letters to diamond and triangle glyphs, so the marker sequence is controlled from CSS with an `:nth-child()` rule per item.

## Fluid Typography

flowtype.js scales the root font size with viewport width between a 15px minimum and a 20px maximum. A modern equivalent is `font-size: clamp(15px, <vw-based value>, 20px)` on the root element.

## French Typographic Corrections

A text pass over the content applies French typographic rules:
- Non-breaking space (`\u00A0`) after short articles, prepositions and conjunctions, so they never end a line
- Thin space (`\u202f`) before high punctuation: ?, !, :, »
- Thin space after: «
- Proper apostrophe: `\u2019` replaces the straight quote
