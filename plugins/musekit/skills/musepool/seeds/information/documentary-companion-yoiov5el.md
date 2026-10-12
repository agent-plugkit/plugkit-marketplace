---
id: Yoiov5EL
scenario: information
scenario_name: 信息表达
category: documentary companion
modality: web
view_type: landing
core_dimensions:
- layout
- typography
- motion
scores:
  anti_slop_value: 0.9
  code_value: 0.75
  density: 0.75
  motion_intensity: 0.6
  novelty: 0.8
  visual_value: 0.85
tags:
  color:
  - light-bg
  - black-dominant
  - multi-accent
  - neutral
  domain:
  - campaign
  - education
  - art
  imagery:
  - mixed-media
  - video-bg
  - custom-photo
  - gallery
  layout:
  - split-screen
  - two-column
  - scrollytelling
  - sticky-sections
  material:
  - no-material
  motion:
  - scroll-driven
  - cursor-tracking
  - hover-reveal
  - smooth-scroll
  style:
  - editorial
  - minimal
  - swiss-style
  tech:
  - nextjs
  - react
  - gsap
  - other-tech
  typography:
  - sans-serif
  - serif
  - dual-font
  - geometric-sans
  - all-caps
  - tight-tracking
dimensions_with_reference: []
---

> 借鉴范围：可借鉴信息层级、标注、阅读顺序或解释方法；事实、数据和科学结论必须来自当前任务的原始资料。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

Interactive companion website for a documentary film about surveillance, vision, and technology. The site presents an annotated archive of articles, quotes, links, and archival materials that inspired the film. Content is organized as a constellation of interconnected entries, each tied to specific timestamps in the film. Users can scrub through a timeline to explore references, read corresponding entries, discover related ideas, and trace paths of exploration. The narrative flow moves from a hero introduction through a grid of entry points into deep-dive annotation cards with sources and related links.

# Tech Stack

Next.js static site with TypeScript. Styled-jsx for component-scoped CSS. Plyr for video/audio playback. A hosted web-font service for font delivery. GSAP for timeline and scroll-driven interactions. JSON-driven content architecture with timeline data and annotation content loaded as data files.

# Layout

Split-screen layout: left 50% is an interactive canvas visualization (the "constellation"), right 50% is a scrollable content pane. The constellation side shows a network graph of nodes (+ symbols) connected by lines, representing the interconnected archive entries. Content side uses a vertical stack with generous whitespace. Cards have a ruled header with numbered labels, timecodes, and type badges. Fixed header with title and menu. Responsive: on smaller screens, the layout stacks with the constellation becoming a header element.

# Typography

Dual-font system: a clean, friendly geometric sans-serif with round bowls (weight 600) for headings, navigation, and UI elements; PT Serif for body text and long-form content. Type scale uses CSS custom properties. Heading 1: the geometric sans, all-caps, wide letter-spacing (0.2em). Heading 2: the geometric sans, sentence case. Body: PT Serif at 16px/1.6 line-height. Small caps used for source attributions. Timecodes use monospace numerals via `font-variant-numeric: tabular-nums`.

# Color

Neutral base with section-specific accents. Background: `#e5e5e5` (light warm gray). Text: `#000` (pure black). Section highlight colors assigned per thematic cluster: mustard yellow (`#CAA266`), sage green (`#AABB87`), cornflower blue (`#5D80D9`). Each section uses its highlight for borders, active states, and player chrome via CSS custom property `--section-highlight`. Mustard and sage reach only 1.87:1 and 1.63:1 on `#e5e5e5`, and cornflower reaches 3.00:1 on the page but only 2.72:1 on its own card tint, so the `--section-highlight` values are Mustard UI (`#9A7438`, 3.38:1), Sage UI (`#71814F`, 3.36:1) and Cornflower UI (`#4E70C8`, 3.72:1). The original `#CAA266`, `#AABB87` and `#5D80D9` only tint the cards. Cards have subtle background tints at 10% opacity (`--section-highlight-background`), which over the page give `#E2DED8` (mustard), `#DFE1DC` (sage) and `#D7DBE4` (cornflower). Each UI value also holds on its own card tint (3.17 / 3.21 / 3.38:1), so borders, active states and player controls may sit inside cards; black text on the tints stays above 15:1.

# Imagery

Mixed media: embedded video clips (19th-century chronophotography archives, body-worn camera footage), archival photographs, book covers, diagrams, and screenshots. Images presented in gallery grids or full-width within cards. Thumbnail grid on landing shows 6 entry points with numbered circles. Video player uses custom skin matching section highlight color.

# Components

**Annotation Cards**: Ruled header with number badge (circle), title, timecode pill (black background, white text), and type label. Card body contains media (video/image/gallery) and text sections. Source section with small-caps author name, title, and external link arrow icon. Related links section with linked titles and type badges.

**Timeline/Constellation**: Interactive SVG-based network visualization. Nodes are + symbols at varying scales. Active/hovered nodes enlarge. Connecting lines show relationships. Vertical color bar on left edge indicates section progress.

**Timecode Pills**: Rounded rectangles with black background, white monospace text showing timestamp (0:00:00 format).

**Navigation**: Minimal hamburger menu (top right), stream links with arrow icons, numbered instruction list with circled numerals.

# Motion

Scroll-driven interactions connect the constellation visualization to content cards. Hovering a node in the constellation highlights corresponding cards; scrolling cards updates constellation focus. Smooth transitions between states. Video player has standard controls with custom color theming. Page load: constellation fades in with nodes appearing sequentially. Cards enter with subtle fade-up. GSAP-powered timeline scrubbing with 1:1 mapping between scroll position and video time.

# Algorithms

Constellation layout uses force-directed graph algorithm for node positioning. Timeline data maps timestamp ranges to annotation IDs. Related entries form a bidirectional graph navigable from any card.

# Material

Standard implementation, no special design.

# Craft

Ruled lines (1px borders) separate card sections. Careful typographic detailing: hanging punctuation, where an opening quotation mark gets a negative left offset and the space before it a matching positive one, so a quote at the start of a line hangs into the margin and the text edge stays optically aligned; proper small caps for names. Timecode pills use tabular numerals to prevent jitter. Custom SVG icons for external links (circle with arrow). Plyr video player customized to match section accent colors via CSS variables.

# Coherence

The split-screen layout embodies the site's conceptual core: the left-side constellation visualizes the hidden, hard-to-measure network of ideas behind the film, while the right-side presents the readable, linear archive. The numbered annotation system creates a bridge between film viewing and deep reading. Color-coding by section helps users build mental maps of thematic territory.
