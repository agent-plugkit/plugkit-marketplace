---
id: mDGmR1dE
scenario: graphic
scenario_name: 平面
category: product launch / release announcement social card
modality: design-system
view_type: visual-system
core_dimensions:
- layout
- typography
- imagery
- color
scores:
  anti_slop_value: 0.85
  code_value: 0.55
  density: 0.4
  motion_intensity: 0.0
  novelty: 0.6
  visual_value: 0.8
tags:
  color:
  - limited-palette
  - high-contrast
  - neutral
  - light-bg
  - dark-bg
  domain:
  - social
  - saas
  - product-showcase
  - product-launch
  - changelog
  imagery:
  - ui-screenshot
  - cropped-img
  - product-render
  layout:
  - split-screen
  - stacked
  - active-negative-space
  material:
  - no-material
  - soft-shadow
  motion:
  - no-motion
  style:
  - minimal
  - technical
  - contemporary
  - bold
  tech:
  - css
  - svg
  - image-generation
  typography:
  - grotesque
  - monospace
  - dual-font
  - sans-serif
dimensions_with_reference:
- layout
- color
---

> 借鉴范围：可借鉴字体、图像、色彩和视觉焦点；根据内容与交付尺寸重新构图。原参考中的交互可转化为静态节奏。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

A generalized template for product launch and release announcement social cards: the image on a launch post, a changelog update or a link preview (og image). One focal product view, a short plain headline, a mono metadata strip and one next step.

Distilled from launch-graphic guides and changelog card collections. The card has to work in two seconds while someone scrolls. It answers four questions in a fixed order: what changed (the product itself, shown), what it is called, when it is available, and what to do next. It is a template, not a one-off poster: each release swaps two or three fields (version, date, headline, screenshot crop) and keeps everything else, so a run of cards reads as one series. The same design is re-laid for each delivery size rather than cropped. The fixed order, the single focal view, the short headline and the labelled change list are what the sources share; the specific values below (palette, type sizes, margins, durations) are working defaults chosen for this seed, not measurements of any one source.

# Tech Stack

Any layout tool that exports PNG works. For a repeatable series, build the card as an HTML/CSS (or SVG) template with fixed artboard sizes and render it to an image with a headless browser or an og image rendering service; the fields come from the release notes (version, date, headline, up to three change lines) and one screenshot. When an image-generation model is used for a background or product render, keep all text out of the generated image and set it afterwards in the template, so the wording stays exact.

# Layout

Delivery sizes, each laid out on its own:

- **Link preview / landscape**, 1200×630 (Open Graph): split layout. Text column on the left about 42% of the width, focal view on the right about 58%, bleeding off the right or bottom edge.
- **Portrait feed post**, 1080×1350 (4:5): stacked. Meta strip and headline in the top third, focal view in the middle half, next step and product mark at the bottom.
- **Wide banner**, 1500×500: landscape split with only the meta strip and headline in the text column.
- **Changelog card** (portrait variant): meta strip, headline, then up to three change rows, each a colored tag plus a line of at most six words, then the focal view, then the footer.

Inside each size:

1. **Meta strip** (top of the text column): product name · version · date, in mono, e.g. `v2.4 · Available today`. Dates are written the way people say them ("Available today", "Oct 14"), not as ISO strings.
2. **Headline**: at most eight words, sentence case, saying what changed in plain words. No exclamation marks, no superlatives.
3. **Focal view**: a real interface crop showing the changed state, occupying 50–60% of the card. Crop tight to the change and show it at or above actual size; a whole application window shrunk to fit is unreadable at feed size.
4. **Footer**: one next step as text (a short URL path or "Update in Settings") and a small product mark. The mark comes after the sentence, never in the headline position.

Bleed and safe area are separate. The background and the Stage panel may run to or past the edge. Text, the product mark and the changed part of the screenshot stay inside the safe area: at least 6% of the short side from every edge (about 40px on 1200×630, 64px on 1080×1350), and out of the outer tenth of the long side (120px at each end on 1200×630, 135px on 1080×1350, 150px on 1500×500), because some surfaces crop previews toward a narrower ratio. Choose the safe area by delivery target: when the platform is unknown or may crop, use the long-side inset; only when the target is known to show the whole frame uncropped may the long side drop to the 6% margin. If a target is known to crop to a square, use a centered stacked layout instead of the split.

# Typography

Two voices. A neo-grotesque or grotesque sans, bold (700), for the headline and change lines; a monospace for the meta strip, version numbers and tags. Sizes on the 1200×630 artboard: headline 56–72px with line height 1.05–1.1 and slightly tight tracking (−1% to −2%); change lines 26–30px semibold; meta strip 22–24px mono; tag labels 20–22px mono semibold in capitals; footer 22px. Nothing below 20px, tag labels included, because previews are often shown at less than half their pixel size. On 1080×1350 scale everything by about 1.1. The headline sets in two lines at most; break lines by meaning, not by width.

# Color

Two neutral grounds, light and dark, with the product's own color supplied downstream. Ratios are WCAG 2.x contrast, truncated to two decimals; the card is an image, but its text is held to the text thresholds anyway (4.5:1, or 3:1 for headline-size type).

Light card:

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| Canvas | `#F4F2EE` | light card background | — |
| Ink | `#16181D` | headline, change lines, next step on Canvas | 15.88:1 on Canvas |
| Meta | `#5A5F69` | meta strip, version, date and footer text on Canvas | 5.73:1 on Canvas |
| Stage | `#E7E3DB` | panel behind the screenshot crop; carries no text | — |

Dark card:

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| Canvas Dark | `#14161B` | dark card background | — |
| Light Ink | `#F4F2EE` | headline, change lines, next step on Canvas Dark | 16.18:1 on Canvas Dark |
| Meta Dark | `#A9AFBA` | meta strip, version, date and footer text on Canvas Dark | 8.21:1 on Canvas Dark |
| Stage Dark | `#23262D` | panel behind the screenshot crop; carries no text | — |

Change tags, the same on both grounds, always a word on a colored fill:

| Tag | Fill | Label | Contrast |
| --- | --- | --- | --- |
| NEW | `#1F5FD1` | `#FFFFFF` | label 5.80:1 on the fill |
| IMPROVED | `#6A3FC2` | `#FFFFFF` | label 6.76:1 on the fill |
| FIXED | `#1D7A4C` | `#FFFFFF` | label 5.32:1 on the fill |

The tag's word carries the meaning and the fill is a second cue, so a reader who cannot tell the fills apart loses nothing. The screenshot sits on Stage with a soft shadow (`0 12px 32px #00000026`) and a 12–16px radius.

The brand color is supplied downstream. Use it where it adds recognition without hurting legibility: a large field, a highlight ring around the changed area of the screenshot, or the product mark. Balance the two: if it carries text it must reach 4.5:1 against its ground (3:1 for headline-size type), and a highlight ring must reach 3:1 against the pixels beside it; a brand color that fails stays a field or mark, and the text on the card stays Ink or Light Ink. Pick the light or dark card by which one the screenshot contrasts with, not by platform theme.

# Imagery

The product is the picture. Use a real screenshot of the shipped state, cropped to the change, with real (or realistic placeholder) data; enlarge rather than shrink. One focal view per card; two screenshots side by side compete. A thin highlight ring or a single arrow may point at the change; no stickers, confetti or 3D device mockups. Text belongs outside the screenshot, in the text column, never pasted over the interface.

# Components

The component set is small and fixed:

- meta strip (product name, version, date);
- headline;
- focal view on Stage;
- optional change rows (tag + short line), at most three;
- footer with one next step and a small product mark.

No buttons are drawn: the card is an image, and a fake button invites a tap that does nothing. The next step is written as text.

# Motion

Static by default. If a short video variant is needed, animate only the focal view (the before-to-after change, 2–4 seconds, looping) and keep text and layout fixed.

# Algorithms

Template fill per release: read the version, date, headline and change lines from the release notes; reject a headline over eight words or a change line over six words; render every delivery size from the same fields; check that each text field fits without shrinking below its minimum size and that no text, mark or changed area crosses the safe area chosen for that target. Keep the previous card for comparison so the series stays consistent.

# Material

Flat. The only depth is the soft shadow under the screenshot on Stage. No gradients behind text, no glass, no noise.

# Craft

Check the card at the size it is actually seen: about 500px wide for the landscape preview and 360px wide for the portrait post. At that size the headline must still read and the changed part of the screenshot must still be visible. Use the release's real version number and date; never invent metrics or quotes to fill space. Export PNG at 1× and 2× and keep the template source with the release.

# Coherence

One focal view, one headline and one next step keep the card readable in a scroll. The fixed order (product, name, date, next step), the mono meta strip and the word-labelled tags turn each card into an entry in a recognizable series, while the swap of only two or three fields keeps the series cheap to produce and consistent from release to release.

# Dimensional References

## Landscape template (1200×630)

```css
:root {
  --canvas: #f4f2ee;
  --ink: #16181d;   /* 15.88:1 on canvas */
  --meta: #5a5f69;  /* 5.73:1 on canvas */
  --stage: #e7e3db; /* no text */
  --safe: 40px;       /* 6% of the short side */
  --safe-long: 120px; /* outer tenth of the long side; 40px only if the target never crops */
}

.card {
  box-sizing: border-box; /* padding stays inside the 1200×630 artboard */
  width: 1200px;
  height: 630px;
  display: grid;
  grid-template-columns: 42fr 58fr;
  background: var(--canvas);
  padding: var(--safe) 0 var(--safe) var(--safe-long);
}
.card__text     { display: flex; flex-direction: column; gap: 24px; padding-right: 32px; }
.card__meta     { font: 600 22px/1.2 var(--font-mono); color: var(--meta); }
.card__headline { font: 700 64px/1.08 var(--font-sans); letter-spacing: -0.015em; color: var(--ink); }
.card__footer   { margin-top: auto; font: 500 22px/1.3 var(--font-sans); color: var(--ink); }
.card__stage    { background: var(--stage); border-radius: 16px 0 0 16px; overflow: hidden; }
```

The text column is a flex column so the footer settles at the bottom margin; the stage bleeds off the right edge, which tells the eye the product continues beyond the frame. Only the Stage bleeds: position the screenshot inside it so the changed area stays at least `--safe-long` from the right edge. `box-sizing: border-box` keeps the padding inside the artboard, so the exported image is exactly 1200×630 without relying on a global reset.
