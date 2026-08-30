---
id: B3LYgTWe
scenario: poster
scenario_name: 海报
category: arts center
modality: web
view_type: landing
core_dimensions:
- imagery
- components
- typography
scores:
  anti_slop_value: 0.9
  code_value: 0.6
  density: 0.7
  motion_intensity: 0.4
  novelty: 0.8
  visual_value: 0.8
tags:
  color:
  - warm-tone
  - light-bg
  - black-dominant
  - monochrome-warm
  domain:
  - art
  - museum
  - event
  imagery:
  - custom-photo
  - masked-img
  - mixed-media
  - photo-led
  layout:
  - two-column
  - asymmetric-grid
  - sidebar
  - full-bleed
  material:
  - paper
  - soft-shadow
  - textured
  - layered
  motion:
  - scroll-triggered
  - carousel
  - hover-reveal
  style:
  - organic
  - editorial
  - playful
  - artisan
  tech:
  - wordpress
  - jquery
  - vanilla-js
  typography:
  - serif
  - sans-serif
  - dual-font
  - display-serif
  - mixed-case
dimensions_with_reference:
- imagery
- typography
---

> 场景适配:适用于海报、活动视觉、封面。把种子当作「单屏构图 + 大字排印」的约束来源:标题层级、网格、色彩块面直接借用,动效维度可忽略或转化为静态层次。

# Narrative

An arts center homepage presenting upcoming events and artist programs. The narrative flows from a distinctive organic-shaped hero carousel through thematic "Wander" navigation tags to a dark, grounded footer. The site positions itself as an unconventional cultural institution through its deliberate avoidance of rectangular precision.

# Tech Stack

WordPress custom theme. Flickity carousel library for the hero slider and sidebar galleries. Custom JavaScript handles scroll direction detection (`scroll-direction-up/down` body classes) and navigation state. No CSS framework evident beyond minimal Bootstrap utilities.

# Layout

Asymmetric two-column grid: main content (8/12 columns) sits beside a narrower sidebar (4/12). The hero carousel occupies the main column with generous vertical whitespace. Below, a horizontal "Wander" tag bar stretches full-width with organic blob-shaped buttons. Footer uses a three-column layout on dark background. All containers reject rectangular rigidity in favor of irregular, hand-drawn organic boundaries.

# Typography

Dual font system: **GT Alpina** (serif) for display headlines and body text, paired with **Graebenbach** (sans-serif, Medium and Bold weights) for UI elements and navigation. Feature headlines use oversized serif (`type--feature-xl`). Event titles use a mid-weight serif (`type--title-l`). Small sans-serif labels (`type--s`) categorize content.

# Color

Warm cream background (#fcf7f1) dominates the page body, creating an earthy, archival atmosphere. Pure black (#000000) for primary text and UI chrome. Dark charcoal footer (#0a0a0a or similar) grounds the page. Accent colors appear in the carousel pagination dots (four-color system: black, dark gray, mustard yellow, light gray). Images retain natural color rather than being filtered.

# Imagery

Photography is masked inside organic blob shapes using SVG clip-paths with inner shadow filters (`filter0_i_*`). Each event type has a distinct blob style—"public dinner" uses wide horizontal blobs, "open house" uses vertical portrait blobs. The masking creates a torn-paper, collage-like aesthetic. Photos depict candid documentation of art events, not staged stock imagery.

# Components

**Buttons:** Irregular organic shapes with SVG background images (`button--shaped`, `cb06c8ce5b8e68-newsletter-button-bg.svg`). No rectangular buttons exist.

**Cards:** Event listings use layered SVG backgrounds with inner shadow effects to create depth and texture.

**Navigation:** Hamburger menu uses three-line icon morphing to close X. Top-right nav links are pill-shaped but irregular. The "Wander" tag bar features seven thematic category buttons with custom SVG icons (ghosts, site, space, time, fog, power, borders).

**Form inputs:** Text fields use organic outline SVG backgrounds (`b2901e4098e152-input-bg.svg`).

# Motion

Scroll direction detection applies `scroll-direction-up` or `scroll-direction-down` classes to body. Logo compresses on scroll down (`logo-is-compressed`). Primary navigation slides in from left with full-screen overlay. Carousels use Flickity with fade transitions (`is-fade` class) rather than sliding. Subtle scroll-triggered state changes for navigation pinning (`subnav-is-pinned`).

# Algorithms

Standard implementation, no special design.

# Material

Inner shadow effects throughout create embossed, tactile quality. SVG filters apply `feGaussianBlur` with `feComposite` arithmetic operations for inner shadow depth. The effect simulates paper cutouts with dimensional depth.

# Craft

Custom scrollbar styling. Form inputs use organic SVG outlines rather than standard borders. Footer newsletter form floats on its own organic SVG background (`2b8ad7329f2e00-footer-form-bg.svg`). Every interactive element rejects geometric precision for hand-drawn irregularity.

# Coherence

The organic blob aesthetic unifies all dimensions—from image masks to buttons to form inputs—creating a consistent tactile language that positions the institution as approachable, artistic, and deliberately non-corporate. The warm cream and black palette reinforces the archival, art-space atmosphere.

---

# Dimensional References(深度实现参考)


<!-- ref-dim: imagery -->

# Imagery Reference

## Organic Blob Masking System

Images are masked using SVG patterns with inner shadow filters to create torn-paper, collage-like aesthetics.

### SVG Structure

```svg
<svg fill="none" viewBox="0 0 1066 643" xmlns="http://www.w3.org/2000/svg">
  <g filter="url(#filter0_i_130_9226)">
    <path d="M974.835 642.512..." fill="url(#pattern0)"/>
  </g>
  <defs>
    <filter id="filter0_i_130_9226" x="0" y="0" width="1066" height="643">
      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
      <feBlend in="SourceGraphic" in2="BackgroundImageFix" mode="normal" result="shape"/>
      <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
      <feOffset/>
      <feGaussianBlur stdDeviation="7.5"/>
      <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0"/>
      <feBlend in2="shape" mode="normal" result="effect1_innerShadow_130_9226"/>
    </filter>
    <pattern id="pattern0" width="1" height="1">
      <use transform="translate(0 -0.052) scale(0.0005 0.00083)" href="#image0"/>
    </pattern>
    <image id="image0" width="2000" height="1333" href="[photo-url]"/>
  </defs>
</svg>
```

### Key Parameters

- **Filter type:** Inner shadow (`filter0_i` naming convention)
- **Blur amount:** `stdDeviation="7.5"` for large masks, `stdDeviation="4"` for smaller
- **Shadow opacity:** 0.5 (alpha channel in color matrix)
- **Blend mode:** `multiply` for some variants, `normal` for others

### Style Variants

| Event Type | Aspect Ratio | Blob Character |
|------------|--------------|----------------|
| public-dinner | 1066x643 (wide) | Horizontal, irregular edges |
| open-house | 330x196 (portrait) | Vertical, rounded corners |

### CSS Classes

- `.event-listing--media-layers` — container
- `.style--public-dinner` / `.style--open-house` — style variants
- `.layer--1` — single layer (no parallax)

## Reusable Move

`organic_blob_image_mask` — Apply SVG clip-path with inner shadow filter to create tactile, paper-cutout image presentation. Use `<pattern>` with `<image>` for photo fill inside irregular path shapes.

<!-- ref-dim: typography -->

# Typography Reference

## Font Families

### GT Alpina (Serif)

- **File:** `ce31c5ddfba1fe-GT-Alpina-Standard-Light.woff2`
- **Usage:** Display headlines, body text, feature titles
- **Weights:** Light (primary), Standard
- **Characteristics:** Contemporary serif with sharp terminals, editorial feel

### Graebenbach (Sans-serif)

- **Files:** 
  - `501e160d13c1a3-Graebenbach-Medium.woff2`
  - `a67f04454674ee-Graebenbach-Bold.woff2`
- **Usage:** UI elements, navigation, buttons, labels
- **Weights:** Medium (primary), Bold
- **Characteristics:** Geometric sans with humanist proportions, clean but warm

## Type Scale

| Class | Font | Size | Usage |
|-------|------|------|-------|
| `type--feature-xl` | GT Alpina | ~48-64px | Hero headlines |
| `type--title-l` | GT Alpina | ~32px | Event titles |
| `type` | GT Alpina | ~18px | Body text, nav links |
| `type--s` | Graebenbach | ~14px | Labels, categories, buttons |

## Implementation

```css
@font-face {
  font-family: 'GT Alpina';
  src: url('ce31c5ddfba1fe-GT-Alpina-Standard-Light.woff2') format('woff2');
  font-weight: 300;
  font-style: normal;
}

@font-face {
  font-family: 'Graebenbach';
  src: url('501e160d13c1a3-Graebenbach-Medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
}
```

## Reusable Move

`dual_font_editorial_system` — Pair a distinctive serif (GT Alpina) for display and body with a complementary geometric sans (Graebenbach) for UI elements. Creates hierarchy through font family contrast rather than weight alone.
