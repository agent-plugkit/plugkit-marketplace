---
id: E3ISF3qW
scenario: ui
scenario_name: 界面
category: restaurant / cafe website
modality: web
view_type: landing
core_dimensions:
- layout
- components
- typography
- color
scores:
  anti_slop_value: 0.85
  code_value: 0.55
  density: 0.6
  motion_intensity: 0.1
  novelty: 0.55
  visual_value: 0.8
tags:
  color:
  - warm-tone
  - light-bg
  - single-accent
  - earth-tone
  domain:
  - restaurant
  - cafe
  - hospitality
  - local-business
  - booking
  imagery:
  - photo-led
  - custom-photo
  - full-bleed-img
  layout:
  - fixed-header
  - sticky-sections
  - single-column
  - two-column
  material:
  - matte
  - paper
  motion:
  - smooth-scroll
  style:
  - artisan
  - editorial
  - contemporary
  - soft
  tech:
  - css
  - vanilla-js
  typography:
  - serif-headings
  - display-serif
  - sans-serif
  - dual-font
dimensions_with_reference:
- layout
- color
---

> 借鉴范围：可借鉴交互、导航、组件组织或界面层级；根据当前用户任务、已有设计系统和技术栈重新实现。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

A generalized method for a local restaurant or cafe website, distilled from usability research on restaurant and table reservation sites and from award-recognized restaurant sites. The page serves three visitor jobs in order: read the menu, make a booking, and plan the visit (hours, address, phone).

The voice is a host at the door: warm, specific and brief. One real photograph of the food or the room, the place's name and a single line of positioning set the character; everything after that is practical. The menu, the reservation entry and the visit details are never more than one click or one scroll away from any point on the page, and none of them is locked inside a PDF or an image. The method fits a single-location restaurant, cafe, bakery or bar; a group with several locations adds a location picker before the visit details and keeps the same order. The order of jobs, the text menu and the visible booking path are what the sources share; the specific values below (palette, type sizes, breakpoints, durations) are working defaults chosen for this seed, not measurements of any one source.

# Tech Stack

Framework-agnostic. Semantic HTML with the menu as real text: one heading per menu section, one list per section, one list item per dish, so the menu can be searched, translated, zoomed and read aloud. CSS custom properties hold the palette below; CSS grid lays out menu rows. The reservation itself is usually an embedded third-party booking widget or a link out to one: wrap its trigger and, where the widget allows, its date, time and party-size controls in the site's type and colors, and always keep a phone number beside it as the fallback. Opening hours, address and phone also go into structured data (schema.org `Restaurant` / `LocalBusiness`) so that maps and search listings show the same hours as the page. Static generation is enough; the only live data is availability inside the booking widget.

# Layout

A single column of full-width bands on warm paper. Content width up to about 1200px; menu descriptions keep a measure of 60–72 characters.

1. **Header (sticky)**: the place's name at left. On desktop the sections are visible text links (Menu, Reserve, Visit, About, plus Order when takeaway exists), not hidden behind a hamburger icon; the current section is marked with an underline and `aria-current`. "Reserve" is styled as the primary button and stays in view while the page scrolls. On phones the header shrinks to name, Reserve button and a menu toggle; a bottom bar with Menu / Reserve / Call / Directions is an equally valid pattern.
2. **Hero**: one large real photograph (a dish, the counter or the dining room) beside or above a text block on paper. The text block holds the name, a one-line positioning (cuisine, neighbourhood, what is particular about the place), the primary button "Reserve a table", a secondary "View menu" link, and a compact visit line: today's hours with an open/closed status, the address as a maps link and the phone as a `tel:` link. All of it fits in the first viewport on desktop and on phones (where the photograph shrinks to about 40% of the viewport height).
3. **Menu**: a section title, then a row of category anchors (whatever the real menu has: breakfast, small plates, mains, desserts, drinks) that sticks under the header while the menu scrolls; the active category is underlined. Dishes sit in rows, one column on phones and two columns from about 960px: dish name and price on the first line, the price right-aligned with dot leaders or open space between; description and dietary marks on the second line. Service times, allergen notes and when the menu last changed sit at the top of the section. If online ordering exists, an Order link sits in the menu heading and in each category, so an order can start from the menu and not only from the header.
4. **Reserve**: a short paragraph (how far ahead tables open, group-size limits, walk-in policy), the booking widget or its trigger, and the phone number as fallback.
5. **Visit (dark band)**: an hours table with days as rows and today's row labelled "Today", the address, transit and parking notes, accessibility notes, a static map image that opens a maps app, phone and email.
6. **About and gallery** (optional): a few photographs and a short story. It always comes after the menu, never before it.
7. **Footer**: name, address, hours summary, phone and social links, all as text.

# Typography

Two families. A warm serif display face (old-style or transitional, bracketed serifs, moderate stroke contrast) for the name, section titles and dish names; a humanist or neutral sans with tabular lining figures for navigation, descriptions, prices, hours and forms. Any open font pair with these traits works.

Scale (desktop, shrink with `clamp()` on phones): name 48–72px; section titles 32–40px; dish names 19–20px serif semibold; descriptions 15–16px sans at 1.5 line height; prices 16–17px sans with tabular figures so the price column aligns; category anchors and navigation 15–16px sans medium. Letter-spaced capitals are limited to short labels such as category anchors and "Today"; dish descriptions and notes stay in sentence case. Prices are written the same way throughout (same decimals, currency stated once at the top of the menu or on every price, not a mix).

# Color

Warm paper, deep brown-black ink and one food-toned accent. Ratios are WCAG 2.x contrast, truncated to two decimals; text needs 4.5:1, large text and non-text UI (borders, focus rings, underlines) need 3:1.

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| Paper | `#FBF7F0` | page background | — |
| Surface | `#F3EADD` | menu category panels, Reserve band, form panels | — |
| Ink | `#2A211C` | headings, dish names, body text and prices on Paper and Surface | 14.75:1 on Paper, 13.22:1 on Surface |
| Muted | `#6B5E54` | dish descriptions, dietary marks, captions, dot leaders on Paper and Surface | 5.86:1 on Paper, 5.25:1 on Surface |
| Accent | `#B4441F` | text links, active-section underline and focus ring on Paper and Surface | 5.19:1 on Paper, 4.65:1 on Surface |
| Accent button | `#B4441F` fill, `#FFFFFF` label | primary "Reserve a table" button | label 5.54:1 on the fill |
| Accent Deep | `#8E3416` fill, `#FFFFFF` label | hover and pressed state of the primary button | label 7.91:1 on the fill |
| Open | `#2F6B3A` | the "Open now" status text on Paper and Surface, always written out in words | 5.98:1 on Paper, 5.36:1 on Surface |
| Field Border | `#8A7A6D` | borders of inputs, selects and the date and party-size controls on Paper and Surface | 3.86:1 on Paper, 3.46:1 on Surface |

The Visit band and the footer reverse to Night, which is the Ink value `#2A211C` used as a background:

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| Night Text | `#FBF7F0` | text on the Night band, including today's row in the hours table and the open/closed status line | 14.75:1 on Night |
| Night Muted | `#CDBFB2` | secondary text on the Night band (notes, captions) | 8.77:1 on Night |
| Glow | `#E9A27F` | links, focus ring and Reserve button fill on the Night band; the button label there is Ink `#2A211C` | 7.45:1 on Night; label 7.45:1 on Glow |
| Night Button Hover | `#FBF7F0` fill, Ink `#2A211C` label | hover and pressed state of the Reserve button on the Night band | label 14.75:1 on the fill; fill 14.75:1 on Night |

Accent reaches only 2.84:1 on Night, so it is never used on the dark band; Glow takes its jobs there. Ink is the Night value itself and Open reaches only 2.46:1 on Night, so neither is used as text on the band: there, today's row and the status line are Night Text, and the words carry the status. Status is never shown by color alone: "Open now" and "Closed" are words, today's row in the hours table carries the word "Today", and the active category has an underline as well as its color.

Photography, illustration and any brand color the place already owns are chosen downstream. Choose them for appetite and atmosphere and for legibility together: text and controls never sit directly on a photograph but on Paper, Surface, Night or a solid panel, and any new text color is checked at 4.5:1 (3:1 for large text and for borders, icons and focus rings). If a brand color replaces Accent and falls below 4.5:1 on Paper or Surface, keep it for fills and large type and add a deeper value of the same hue for links and small text.

# Imagery

Real photographs of the actual dishes, the room and the people working in it, in natural or warm light, with one consistent crop ratio and color grade. The hero uses a single image, not a carousel. In the menu, photographs are optional and reserved for a few signature dishes; most rows are text only, which keeps the menu scannable. No stock imagery of generic food. Alt text names the dish or the space ("Wood-fired flatbread with greens", not "food photo"). Images below the first viewport load lazily; the hero image is sized for the device. The menu itself is never an image or a PDF; if a printable PDF exists it is an extra link labelled with its file size.

# Components

**Primary button**: "Reserve a table", Accent fill with a `#FFFFFF` label, 44–48px tall, 4–6px radius, Accent Deep on hover and press. The primary style belongs to one action only, booking. It may have more than one entry in view at once (the header button and the one in the hero or the Reserve band), and every entry opens the same booking panel; all other actions (View menu, Order, Directions) are text links. On the Night band the button uses Glow with an Ink label and turns Night Text on hover and press.

**Booking panel**: opened from any Reserve button as a dialog on desktop and a full-height sheet on phones. Three visible controls (date, time, party size) and, once a date is set, the available times as a grid of buttons. Unavailable times stay in place, disabled and labelled "Full", so the visitor sees the rhythm of the evening. A summary line before confirmation, a confirmation screen with the details, and the phone number at the bottom for larger groups or special requests.

**Hours block**: a two-column table (day, hours), today's row labelled "Today" and set in semibold (Ink on Paper or Surface; Night Text in the Visit band, which is Night), special or holiday hours listed above the regular week. The status line reads "Open now · closes 22:00" or "Closed · opens Tue 08:00"; on Paper and Surface "Open now" is set in Open and "Closed" in Ink, and on the Night band both are Night Text.

**Menu category bar**: horizontal text anchors that stick under the header; on phones the row scrolls sideways and the active anchor scrolls into view.

**Menu row**: dish name (serif), dot leader, price (tabular figures) on line one; description and dietary marks (Muted) on line two. Dietary marks are short letter codes (V, VG, GF) with a legend at the top of the menu and full words available to screen readers.

**Address card**: address as text, a "Directions" link, a static map image, transit and parking notes, phone as a `tel:` link.

# Motion

Minimal. Anchor links scroll smoothly unless `prefers-reduced-motion` is set; the booking panel fades and rises in 150–200ms; the active-category underline slides between anchors. No parallax on the menu and no auto-advancing carousel holding information the visitor needs.

# Algorithms

**Open/closed status**: computed from the hours table in the restaurant's own time zone, with special-hours entries overriding the regular week; the status line also names the next change ("closes 22:00", "opens Tue 08:00"). The page renders the hours table on the server, so it is correct without scripts, and the status line is added on the client.

**Active category**: an `IntersectionObserver` on the menu sections sets `aria-current` and the underline on the matching anchor.

# Material

Flat and matte, like a printed menu card. Paper may carry a very faint grain; panels are separated by the Surface color rather than by shadows. No glass, no gradients behind text.

# Craft

Dot leaders are drawn with CSS, not typed periods, so they stretch to any width; on narrow screens the dish name wraps while the price stays on the first line at the right. Prices align on tabular figures. Address, phone and email are tappable everywhere they appear. The menu shows when it was last updated, and the hours on the page match the hours in structured data. The header Reserve button and the hero Reserve button open the same panel with the same state.

# Coherence

Everything follows the visitor's three jobs. The layout orders them (menu, booking, visit), the sticky header keeps all three one tap away, and the components make each one concrete: a text menu, a booking panel that shows real availability, and an hours block that answers "is it open now?". Warm paper, serif dish names and real photographs carry the character of the place, while one accent marks only the path to booking.

# Dimensional References

## Menu row and tokens

```css
:root {
  --paper: #fbf7f0;
  --surface: #f3eadd;
  --ink: #2a211c;          /* text: 14.75:1 on paper */
  --muted: #6b5e54;        /* descriptions, leaders: 5.86:1 on paper */
  --accent: #b4441f;       /* links, underline, focus, button fill */
  --field-border: #8a7a6d; /* inputs: 3.86:1 on paper */
}

.menu-item {
  display: grid;
  grid-template-columns: auto 1fr auto; /* name, leader, price */
  column-gap: 0.5rem;
  align-items: baseline;
}
.menu-item__name  { font-family: var(--font-serif); font-weight: 600; color: var(--ink); }
.menu-item__lead  { border-bottom: 2px dotted var(--muted); transform: translateY(-0.3em); }
.menu-item__price { font-variant-numeric: tabular-nums lining-nums; color: var(--ink); }
.menu-item__desc  { grid-column: 1 / -1; color: var(--muted); max-width: 60ch; }

.category-bar {
  position: sticky;
  top: var(--header-height);
  background: var(--paper);
}
.category-bar a[aria-current="true"] {
  text-decoration: underline 2px var(--accent);
  text-underline-offset: 0.35em;
}
```

The leader is a dotted bottom border on the middle grid track, so it fills whatever space the name and price leave. The category bar sticks just below the header, whose height is stored in `--header-height`.
