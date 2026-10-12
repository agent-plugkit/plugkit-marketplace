---
id: o0W3sQmk
scenario: ui
scenario_name: 界面
category: saas developer tools
modality: web
view_type: landing
core_dimensions:
- layout
- imagery
- components
scores:
  anti_slop_value: 0.9
  code_value: 0.6
  density: 0.7
  motion_intensity: 0.1
  novelty: 0.8
  visual_value: 0.8
tags:
  color:
  - warm-tone
  - light-bg
  - accent-orange
  domain:
  - saas
  - product-showcase
  - corporate
  imagery:
  - illustration-led
  - custom-photo
  - hand-drawn
  layout:
  - sidebar
  - fixed-header
  - centered
  material:
  - textured
  - glass
  - soft-shadow
  motion:
  - no-motion
  style:
  - playful
  - retro
  - organic
  tech:
  - gatsby
  - react
  - tailwind
  typography:
  - sans-serif
  - geometric-sans
  - custom-font
  - dual-font
dimensions_with_reference: []
---

> 借鉴范围：可借鉴交互、导航、组件组织或界面层级；根据当前用户任务、已有设计系统和技术栈重新实现。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

A developer tools platform landing page framed as a desktop OS environment. The entire experience mimics a classic desktop operating system: textured beige wallpaper, file icons in a left sidebar, window chrome around content, and desktop-style shortcuts on the right. The narrative positions the platform as an all-in-one product platform for engineers and AI agents, pitched in a confident, informal voice. The hero shows a window titled like a document file containing the main pitch, with a hand-drawn mascot illustration. Below, tabbed sections showcase different product capabilities (analytics, data, debugging, release) inside the same window metaphor. A playful cookie banner keeps the joking tone down to the consent prompt.

# Tech Stack

Static site generator with React. Tailwind CSS for styling. Custom font system using IBM Plex Sans Variable, Open Runde (Regular, Semibold, Bold, Medium), and a custom display font for the mascot branding. CSS custom properties for theming, switched by root-level data attributes for the interface skin and the wallpaper. A slider library for carousels. A node-graph library for node-based diagrams.

# Layout

Full-viewport desktop metaphor with fixed positioning. The app container fills the screen with `fixed inset-0 size-full flex flex-col`. Content lives inside a draggable/positionable window frame with title bar, traffic light buttons, and toolbar. Left sidebar holds file icons arranged vertically: the main document, a product overview folder, pricing, customer stories, a demo video, docs, contact and support entries, sign-up, and a toggle that drops the desktop metaphor for a conventional website view. Right sidebar contains desktop shortcuts for company-level pages (positioning, changelog, handbook, merch store, careers) ending in a trash can. The main window centers the content with generous padding. Tab navigation sits below the hero, switching content inside the same window frame.

# Typography

Primary body font: IBM Plex Sans Variable with fallbacks through system sans stack. Rounded geometric open-source font Open Runde for UI elements and buttons — available in Regular, Medium, Semibold, and Bold weights. Display/branding font: custom webfont for the logo and mascot-related text. The type system uses fluid sizing with Tailwind's typography scale. Headlines are bold and tight, body copy is readable with comfortable line-height (1.5). Italic styling used for emphasis on a single key word in the hero.

# Color

Light mode dominant with warm beige/cream textured background (`#f3f0e6` range from the wallpaper). Primary accent is a vibrant orange `#f54e00` used for CTAs and highlights. The same orange also underlines active tab states. Text is near-black `#0b0b0b` for high contrast. The textured wallpaper provides an earthy, organic backdrop with greens and browns. Window chrome uses translucent white with backdrop blur (75% opacity, `backdrop-blur`). Dark mode support indicated via the wallpaper data attribute and theme-scoped dark selectors.

# Imagery

Custom hand-drawn mascot illustration system: one recurring character, a small animal, drawn in a single consistent sketchy line-art style with warm, muted colors, so the mascot reads as the same character wherever it appears across the site.

# Components

**Window chrome**: Title bar with document icon, filename dropdown, window controls (minimize, maximize, close), and a word-processor-style toolbar (zoom, bold, italic, underline, font, alignment, link, comment, search, settings). Orange primary CTA (free sign-up) sits in the toolbar.

**File icons**: Left sidebar icons styled as classic desktop file thumbnails — documents with ruled lines, folders and docs with a red tab, a calculator for pricing, a video thumbnail labelled as a demo, an envelope for contact, a chat bubble for questions, a target for sign-up, and a switch icon for the website-mode toggle.

**Desktop shortcuts**: Right sidebar with icon+label pairs — mascot book, calendar with bell, building, shopping bag, computer, trash can — each a company-level page.

**Tab system**: Four tabs, each a short verb-led capability statement (understand usage, unify data, debug, test and roll out), with an orange underline for the active state.

**Buttons**: Primary orange filled button with rounded corners, secondary white outlined button, text links with icons (agent integration, demo video, contact).

**Cookie banner**: Bottom-right card with close button and joking, self-aware copy about cookies.

# Motion

Standard implementation, no special design. The frozen snapshot shows static state; motion likely includes tab switching content transitions and hover states on interactive elements.

# Algorithms

Standard implementation, no special design.

# Material

Textured wallpaper background — the beige/cream speckled texture theme resembling classic desktop OS wallpapers. Translucent glass effect on window chrome via `backdrop-blur`. Subtle noise texture in the wallpaper pattern.

# Craft

Custom cursor behavior with `cursor: grab/grabbing` on draggable areas. User-select disabled on transform components to prevent text selection during drag. The window frame uses realistic traffic light buttons (red, yellow, green circles). Icon designs are pixel-perfect with consistent stroke weights. Even legal surfaces such as the cookie banner carry the playful, self-deprecating microcopy.

# Coherence

The desktop OS metaphor unifies all dimensions — from the textured wallpaper (Material) to the window chrome (Components) to the file icon navigation (Layout). The mascot illustrations reinforce the brand personality across all sections, creating a cohesive "friendly developer tools" narrative. The warm beige color palette and rounded typography soften the technical nature of the product, making enterprise software feel approachable and playful.
