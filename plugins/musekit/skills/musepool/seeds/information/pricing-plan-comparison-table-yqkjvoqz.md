---
id: YqkjvOqz
scenario: information
scenario_name: 信息表达
category: pricing plan comparison table
modality: web
view_type: landing
core_dimensions:
- layout
- components
- typography
scores:
  anti_slop_value: 0.85
  code_value: 0.6
  density: 0.85
  motion_intensity: 0.1
  novelty: 0.55
  visual_value: 0.65
tags:
  color:
  - neutral
  - light-bg
  - single-accent
  - accent-blue
  domain:
  - saas
  - pricing
  - subscription
  - membership
  - ecommerce
  imagery:
  - no-imagery
  - icon-driven
  layout:
  - card-grid
  - sticky-sections
  - stacked
  - text-led
  - comparison-table
  material:
  - no-material
  motion:
  - hover-reveal
  style:
  - minimal
  - technical
  - flat
  - swiss-style
  tech:
  - css
  - vanilla-js
  typography:
  - sans-serif
  - single-font
  - grotesque
dimensions_with_reference:
- layout
- components
---

> 借鉴范围：可借鉴信息层级、标注、阅读顺序或解释方法；事实、数据和科学结论必须来自当前任务的原始资料。 下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

A generalized method for a pricing plan comparison table: the subscription tiers on a pricing page, a membership level chart, or a "which plan should I pick" review graphic. Two layers: audience cards saying who each tier is for, above a comparison table for checking features row by row.

Distilled from usability research on comparison tables and pricing pages and from audits of many subscription pricing pages. The cards answer the first question (which tier is meant for someone like me, what does it cost, why would I move up); the table answers the second-order questions (does this tier include the one feature I need, what are the limits). The recommended tier is argued for with a concrete reason, not only a badge. Content consistency comes first: every tier is described with the same attributes in the same order, so differences stand out. The two layers, the argued recommendation and the distinct cell types are what the sources share; the specific values below (palette, type sizes, breakpoints, durations) are working defaults chosen for this seed, not measurements of any one source.

# Tech Stack

Plain HTML table markup (`<table>`, `<thead>`, `<tbody>` per feature group, `<th scope="col">` for tiers and `<th scope="row">` for features) so screen readers announce the tier and feature for each cell; CSS `position: sticky` for the header row and group headings; a few lines of script for the feature-group disclosure and the phone layout's tier pickers. Plan data lives in one structured source (tiers × features with typed values) that renders both the cards and the table, so they cannot drift apart. For a static review graphic, the same structure is set at a fixed size and exported as an image.

# Layout

1. **Audience cards** (top): one card per tier, two to five in a row. Each card holds, in this order: tier name; a one-line audience written as a role or situation ("For freelancers sending a few invoices a month"); the price with its unit and billing basis ("$12 per user / month, billed annually"); the two or three main reasons to move up from the previous tier ("Everything in Starter, plus:"); a call-to-action button. The recommended card adds a badge and one sentence of reasoning ("Recommended for teams of 5–20: shared workspaces and admin controls start here"). If prices change with the billing period, a two-option switch sits above the cards and says in words what it changes.
2. **Comparison table** (below): tiers as columns, features as rows, a feature-label column of about 30% at the left. Up to five tiers fit as a static table; more tiers need a different pattern (a filter or a two-tier compare). The header row repeats tier name, price and a compact button, and sticks to the top of the viewport while the table scrolls. Features are grouped under short group headings (Core, Collaboration, Security, Support), ordered by importance; each group heading row sticks below the header row. Rows are separated by alternating stripes. The recommended column is tinted and outlined from the header through every feature row; group heading rows run across the full width in Group and mark where a new group starts.
3. **Feature disclosure**: the most important groups are open; the rest sit behind "Show all features" so the complete list is always available without overwhelming the first view.
4. **Footnotes** (under the table): billing basis, taxes, currency, fair-use limits, trial terms, and what "Unlimited" means.
5. **Phones** (below about 720px): the table becomes a two-tier comparison. Two pickers above the table choose which tiers fill the two value columns (default: the recommended tier and the one below it); the feature column stays. Group headings become collapsible sections.

# Typography

One sans family with tabular figures; a grotesque or neutral humanist sans works. Tier names 20–24px semibold; card prices 32–40px semibold with the unit and billing basis at 14–15px in Muted beside or below; table header price 18px; table body 15–16px at 1.4 line height; group headings 15px semibold; footnotes 13–14px. Feature labels are left-aligned short nouns ("Shared workspaces", "Audit log"), not sentences; a label that needs explaining gets a small info trigger that opens a one-sentence definition. Values are centered in their column, all columns the same way; numbers use tabular figures so limits line up across rows.

# Color

Neutral surfaces, one blue accent for the recommended tier and actions. Ratios are WCAG 2.x contrast, truncated to two decimals; text needs 4.5:1, large text and non-text UI (borders, outlines, icons, focus rings) need 3:1.

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| Page | `#FFFFFF` | page, cards and plain table rows | — |
| Stripe | `#F4F6F8` | alternate feature rows | — |
| Group | `#E6EBF1` | feature-group heading rows, across all columns | — |
| Tint | `#EEF3FF` | recommended column on plain rows | — |
| Tint Stripe | `#E3EAFB` | recommended column on striped rows | — |
| Ink | `#1B1F24` | tier names, prices, feature labels, values and ✓ marks on Page, Stripe, Group, Tint and Tint Stripe | 16.56 / 15.28 / 13.81 / 14.90 / 13.74 |
| Muted | `#5B6470` | price units, billing basis, footnotes, "—" and "n/a" cells on Page, Stripe, Group, Tint and Tint Stripe | 5.99 / 5.53 / 5.00 / 5.39 / 4.97 |
| Accent | `#2952CC` | recommended column outline, focus ring, text links on Page, Stripe, Group, Tint and Tint Stripe | 6.61 / 6.10 / 5.52 / 5.95 / 5.49 |
| Accent fill | `#2952CC` fill, `#FFFFFF` label | recommended badge and primary buttons | label 6.61:1 on the fill |
| Rule | `#7A838F` | table outer border, header bottom rule, secondary-button and picker borders on Page, Stripe, Group, Tint and Tint Stripe | 3.83 / 3.54 / 3.20 / 3.45 / 3.18 |

Five-value ratios read Page / Stripe / Group / Tint / Tint Stripe. The recommended tier never depends on color alone: it has the badge, the written reason and the outline. "Included", "not included" and "not applicable" are separate symbols and words, never different shades of one mark.

If a brand color replaces Accent, choose it for brand fit and contrast together: its label on the fill needs 4.5:1, its outline and focus ring need 3:1 on all five surfaces, and the tints derived from it must keep Ink and Muted at 4.5:1. Any other color added downstream (a sale banner, a seasonal highlight) is checked the same way before it ships.

# Imagery

None beyond icons. The ✓ mark and the info trigger are the only icons; tier illustrations or mascots add nothing to a comparison and push the table down.

# Components

**Audience card**: described in Layout; all cards have the same height and the same internal order, so the eye can compare across them. Buttons align on one baseline at the bottom.

**Recommended badge**: Accent fill with a `#FFFFFF` label, "Recommended", placed above the tier name; the reason sentence sits inside the card, not in a tooltip.

**Value cells**, three kinds, used consistently:

- included: ✓ in Ink, with visually hidden text "Included";
- not included: "—" in Muted, with visually hidden text "Not included";
- a specific value: the limit or amount in words or numbers ("3 seats", "10 GB", "Unlimited", "Email, 2 business days"). Prefer a value over ✓ whenever the tiers differ by amount.

"n/a" in Muted marks a feature that does not apply to that tier (for example, seat management on a single-user tier) and is explained once in the footnotes, so it is not read as "not included".

**Feature label with definition**: label text plus an info trigger; the definition opens on hover and on focus, is reachable by keyboard and also available as a link to the documentation.

**Sticky header row**: tier name, price, compact button; on scroll it gains the Rule bottom border.

**Tier pickers** (phones): two select controls with Rule borders, labelled "Compare" and "with".

# Motion

Little. Group disclosure expands in about 150ms; definitions appear without delay on focus; the sticky header gains its rule without animation. `prefers-reduced-motion` turns the expansion into an instant change.

# Algorithms

**Row differences**: rows where every tier has the same value can be collapsed under "Same in all plans" or dimmed, so the reader's attention goes to the rows that differ. **Phone pairing**: the two pickers default to the recommended tier and its neighbour below; changing one never lets both pick the same tier. **Single source**: cards, table and footnotes render from one plan dataset; a feature missing from a tier must be stated as not included or not applicable, never left blank.

# Material

Flat. Cards use a 1px Rule border or the Page color on a Stripe background, no drop shadows. The table is a plain grid on white.

# Craft

Every tier is described with the same attributes in the same order, and every cell is filled. Prices show unit and billing basis next to the number, never only in the footnotes. The table header names stay visible at every scroll position. Feature names match the product's own vocabulary. Limits use the same unit in every column ("10 GB", not "10 GB" in one and "10,000 MB" in another). For a static "which plan should I pick" graphic, keep the same two layers: three to four audience lines at the top, a condensed table of the ten most decisive rows below, and the footnotes under it.

# Coherence

The two layers split the decision the way readers make it: first "which tier is meant for me", then "does it really include what I need". Consistent attributes, sticky headers and stripes keep the comparison honest and easy to track; the tint, outline and written reason make the recommendation visible without hiding the alternatives; distinct marks for included, not included and not applicable keep the table truthful at a glance.

# Dimensional References

## Table skeleton

```css
:root {
  --page: #ffffff;
  --stripe: #f4f6f8;
  --group: #e6ebf1;
  --tint: #eef3ff;
  --tint-stripe: #e3eafb;
  --ink: #1b1f24;
  --muted: #5b6470;
  --accent: #2952cc;
  --rule: #7a838f;
}

.plans thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--page);
  border-bottom: 1px solid var(--rule);
}
.plans .group-heading th {
  position: sticky;
  top: var(--header-row-height);
  z-index: 1;
  background: var(--group);
  text-align: left;
}
.plans tbody tr:not(.group-heading):nth-child(odd) { background: var(--stripe); }
.plans td { text-align: center; font-variant-numeric: tabular-nums; color: var(--ink); }
.plans td.is-absent { color: var(--muted); }

.plans .is-recommended { background: var(--tint); box-shadow: inset 2px 0 var(--accent), inset -2px 0 var(--accent); }
.plans tbody tr:not(.group-heading):nth-child(odd) .is-recommended { background: var(--tint-stripe); }
```

Each `<tbody>` starts with its group heading row, so the stripe selector skips that row and counts feature rows only. The recommended column's outline is drawn with inset shadows on every cell of that column (header and feature rows), so it runs unbroken down each group without needing a separate overlay element.
