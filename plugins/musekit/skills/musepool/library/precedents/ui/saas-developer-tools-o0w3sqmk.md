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

A developer tools platform landing page framed as a desktop OS environment. The entire experience mimics a classic Mac OS desktop: textured beige wallpaper (the beige garden theme), file icons in a left sidebar, window chrome around content, and desktop-style shortcuts on the right. The narrative presents the platform as "the new way to build products" — an all-in-one co-pilot for engineers and AI agents. The hero shows a window titled "home.mdx" containing the main pitch, with a mascot illustration featuring a small spiny mammal. Below, tabbed sections showcase different product capabilities (debugging, analytics, testing) inside the same window metaphor. A playful cookie banner appears with a political figure giving thumbs up.

# Tech Stack

Gatsby 4.25.9 static site generator with React. Tailwind CSS v3.4.17 for styling. Custom font system using IBM Plex Sans Variable, OpenRunde (Regular, Semibold, Bold, Medium), and a custom display font for the mascot branding. CSS custom properties for theming with `data-skin` and `data-wallpaper` attributes. Keen Slider for carousels. React Flow for node-based diagrams.

# Layout

Full-viewport desktop metaphor with fixed positioning. The `app-container` fills the screen with `fixed inset-0 size-full flex flex-col`. Content lives inside a draggable/positionable window frame with title bar, traffic light buttons, and toolbar. Left sidebar holds file icons arranged vertically (home.mdx, Product OS, Pricing, customers.mdx, demo.mov, Docs, Talk to a human, Ask a question, Sign up, Switch to website mode). Right sidebar contains desktop shortcuts (Why platform?, Changelog, Company handbook, Store, Work here, Trash). The main window centers the content with generous padding. Tab navigation sits below the hero, switching content inside the same window frame.

# Typography

Primary body font: IBM Plex Sans Variable with fallbacks through system sans stack. Custom rounded geometric font "OpenRunde" for UI elements and buttons — available in Regular, Medium, Semibold, and Bold weights. Display/branding font: custom webfont for the logo and mascot-related text. The type system uses fluid sizing with Tailwind's typography scale. Headlines are bold and tight, body copy is readable with comfortable line-height (1.5). Italic styling used for emphasis ("autonomously" in hero).

# Color

Light mode dominant with warm beige/cream textured background (`#f3f0e6` range from the wallpaper). Primary accent is a vibrant orange `#f54e00` used for CTAs and highlights. Secondary accents include red `#f54e00` for active tab states. Text is near-black `#0b0b0b` for high contrast. The textured wallpaper provides an earthy, organic backdrop with greens and browns. Window chrome uses translucent white with backdrop blur (`bg-accent/75 backdrop-blur`). Dark mode support indicated via `data-wallpaper` and `wallpaper-garden-theme:dark:` selectors.

# Imagery

Custom hand-drawn illustration system featuring a mascot character (a small spiny mammal) across multiple scenes: lounging at a desk with laptop, coffee, basketball hoop; gardening in keyboard-key-shaped beds; in a monster costume destroying a city with tech company logos; reading at a multi-monitor setup at night. Cookie banner includes a photo of a political figure giving two thumbs up. All illustrations have a consistent sketchy line-art style with warm, muted colors.

# Components

**Window chrome**: Title bar with document icon, filename dropdown ("home.mdx ▼"), window controls (minimize, maximize, close), and toolbar (Zoom, Bold, Italic, Underline, Font, alignment, link, comment, search, settings). Orange CTA button "Get started - free" in toolbar.

**File icons**: Left sidebar icons styled as macOS file thumbnails — home.mdx (document with lines), Product OS (folder with red tab), Pricing (calculator), customers.mdx (document), demo.mov (video thumbnail with "DEMO" label), Docs (document with red tab), Talk to a human (envelope), Ask a question (chat bubble), Sign up (target), Switch to website mode (switch icon).

**Desktop shortcuts**: Right sidebar with icon+label pairs — Why platform? (mascot book), Changelog (calendar with bell), Company handbook (building), Store (shopping bag), Work here (computer), Trash (trash can).

**Tab system**: Four tabs ("Understand product usage", "One place for product data", "Debug & fix issues" [active], "Test & roll out changes") with red underline for active state.

**Buttons**: Primary orange filled button with rounded corners, secondary white outlined button, text links with icons (MCP, Watch a demo, Talk to a human).

**Cookie banner**: Bottom-right card with close button, playful copy about cookies and a political figure reference.

# Motion

Standard implementation, no special design. The frozen snapshot shows static state; motion likely includes tab switching content transitions and hover states on interactive elements.

# Algorithms

Standard implementation, no special design.

# Material

Textured wallpaper background — the beige/cream speckled texture theme resembling classic Mac OS wallpapers. Translucent glass effect on window chrome via `backdrop-blur`. Subtle noise texture in the wallpaper pattern.

# Craft

Custom cursor behavior with `cursor: grab/grabbing` on draggable areas. User-select disabled on transform components to prevent text selection during drag. The window frame uses realistic macOS-style traffic light buttons (red, yellow, green circles). Icon designs are pixel-perfect with consistent stroke weights. The cookie banner's playful tone (referencing a political figure) shows personality in microcopy.

# Coherence

The desktop OS metaphor unifies all dimensions — from the textured wallpaper (Material) to the window chrome (Components) to the file icon navigation (Layout). The mascot illustrations reinforce the brand personality across all sections, creating a cohesive "friendly developer tools" narrative. The warm beige color palette and rounded typography (OpenRunde) soften the technical nature of the product, making enterprise software feel approachable and playful.
