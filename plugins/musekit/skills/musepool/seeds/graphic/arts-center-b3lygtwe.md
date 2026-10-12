---
id: B3LYgTWe
scenario: graphic
scenario_name: 平面
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

> 借鉴范围：可借鉴字体、图像、色彩和视觉焦点；根据内容与交付尺寸重新构图。原参考中的交互可转化为静态节奏。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

An arts center homepage presenting upcoming events and artist programs. The narrative flows from a distinctive organic-shaped hero carousel through a thematic browsing tag bar to a dark, grounded footer. The site positions itself as an unconventional cultural institution through its deliberate avoidance of rectangular precision.

# Tech Stack

CMS custom theme. A carousel library for the hero slider and sidebar galleries. Custom JavaScript handles scroll direction detection (scroll-direction classes on the body) and navigation state. No CSS framework evident beyond minimal utility classes.

# Layout

Asymmetric two-column grid: main content (8/12 columns) sits beside a narrower sidebar (4/12). The hero carousel occupies the main column with generous vertical whitespace. Below, a horizontal thematic tag bar stretches full-width with organic blob-shaped buttons. Footer uses a three-column layout on dark background. All containers reject rectangular rigidity in favor of irregular, hand-drawn organic boundaries.

# Typography

Dual font system: a **light contemporary serif with sharp terminals** for display headlines and body text, paired with a **warm geometric sans with humanist proportions** (Medium and Bold weights) for UI elements and navigation. Feature headlines use oversized serif. Event titles use a mid-weight serif. Small sans-serif labels categorize content.

# Color

Warm cream background (#fcf7f1) dominates the page body, creating an earthy, archival atmosphere. Pure black (#000000) for primary text and UI chrome. Dark charcoal footer (#0a0a0a or similar) grounds the page. Accent colors appear in the carousel pagination dots (four-color system: black, dark gray, mustard yellow, light gray). Images retain natural color rather than being filtered.

# Imagery

Photography is masked inside organic blob shapes using SVG clip-paths with inner shadow filters. Each event type has a distinct blob style—communal events use wide horizontal blobs, open-studio style events use vertical portrait blobs. The masking creates a torn-paper, collage-like aesthetic. Photos depict candid documentation of art events, not staged stock imagery.

# Components

**Buttons:** Irregular organic shapes drawn as SVG background images behind the label. No rectangular buttons exist.

**Cards:** Event listings use layered SVG backgrounds with inner shadow effects to create depth and texture.

**Navigation:** Hamburger menu uses three-line icon morphing to close X. Top-right nav links are pill-shaped but irregular. The thematic tag bar holds about seven abstract theme words, each with its own custom SVG icon, offered as an alternative way to browse the program.

**Form inputs:** Text fields use organic outline SVG backgrounds instead of borders.

# Motion

Scroll direction detection toggles up/down classes on the body. Logo compresses on scroll down. Primary navigation slides in from left with full-screen overlay. Carousels use fade transitions rather than sliding. Subtle scroll-triggered state changes pin the sub-navigation.

# Algorithms

Standard implementation, no special design.

# Material

Inner shadow effects throughout create embossed, tactile quality. SVG filters apply `feGaussianBlur` with `feComposite` arithmetic operations for inner shadow depth. The effect simulates paper cutouts with dimensional depth.

# Craft

Custom scrollbar styling. Form inputs use organic SVG outlines rather than standard borders. Footer newsletter form floats on its own organic SVG background. Every interactive element rejects geometric precision for hand-drawn irregularity.

# Coherence

The organic blob aesthetic unifies all dimensions—from image masks to buttons to form inputs—creating a consistent tactile language that positions the institution as approachable, artistic, and deliberately non-corporate. The warm cream and black palette reinforces the archival, art-space atmosphere.

---

# Dimensional References(深度实现参考)


<!-- ref-dim: imagery -->

# Imagery Reference

## Organic Blob Masking System

Images are masked using SVG patterns with inner shadow filters to create torn-paper, collage-like aesthetics.

### How It Works

Each masked image is one SVG whose only visible shape is an irregular, hand-drawn closed path:

1. **Shape:** the blob outline is a single `<path>`; its `fill` points to a `<pattern>` instead of a color.
2. **Photo fill:** the `<pattern>` (`width="1" height="1"`, object-bounding-box units) contains an `<image>` scaled and offset so the photo covers the path's bounding box — the SVG equivalent of `object-fit: cover`.
3. **Inner shadow:** the path is wrapped in a group with an inner-shadow filter. The filter isolates the shape's alpha, blurs it (`feGaussianBlur`), subtracts the blurred alpha from the original with `feComposite operator="arithmetic"` (k2 = −1, k3 = 1) to keep only the inner rim, tints that rim black at partial opacity with `feColorMatrix`, and blends it back over the shape.

Give the filter a descriptive ID such as `inner-shadow` and reuse it for every mask of the same size class.

### Key Parameters

- **Filter type:** Inner shadow (no offset; the shadow is even around the rim)
- **Blur amount:** `stdDeviation="7.5"` for large masks, `stdDeviation="4"` for smaller
- **Shadow opacity:** 0.5 (alpha channel in color matrix)
- **Blend mode:** `multiply` for some variants, `normal` for others

### Style Variants

| Event Type | Aspect Ratio | Blob Character |
|------------|--------------|----------------|
| Wide event card | ~5:3 landscape (e.g. 1066x643 viewBox) | Horizontal, irregular edges |
| Tall event card | smaller frame (e.g. 330x196 viewBox) | Vertical, rounded corners |

### Structure

- A media container per event listing holds one or more mask layers.
- A modifier per event type selects the blob shape (wide or tall).
- A single-layer variant skips any parallax between layers.

## Reusable Move

`organic_blob_image_mask` — Apply SVG clip-path with inner shadow filter to create tactile, paper-cutout image presentation. Use `<pattern>` with `<image>` for photo fill inside irregular path shapes.

<!-- ref-dim: typography -->

# Typography Reference

## Font Families

### Display / Text Serif

- **Usage:** Display headlines, body text, feature titles
- **Weights:** Light (primary), Standard
- **Characteristics:** Contemporary serif with sharp terminals, editorial feel

### UI Sans-serif

- **Usage:** UI elements, navigation, buttons, labels
- **Weights:** Medium (primary), Bold
- **Characteristics:** Geometric sans with humanist proportions, clean but warm

## Type Scale

| Role | Font | Size | Usage |
|------|------|------|-------|
| Feature XL | Serif | ~48-64px | Hero headlines |
| Title L | Serif | ~32px | Event titles |
| Base | Serif | ~18px | Body text, nav links |
| Small | Sans | ~14px | Labels, categories, buttons |

## Implementation

```css
@font-face {
  font-family: 'Display Serif';
  src: url('display-serif-light.woff2') format('woff2');
  font-weight: 300;
  font-style: normal;
}

@font-face {
  font-family: 'UI Sans';
  src: url('ui-sans-medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
}
```

## Reusable Move

`dual_font_editorial_system` — Pair a distinctive light serif for display and body with a complementary geometric sans for UI elements. Creates hierarchy through font family contrast rather than weight alone.
