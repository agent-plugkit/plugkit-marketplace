---
id: mC1nkP2t
scenario: poster
scenario_name: 海报
category: one/two-ink editorial print system
modality: design-system
view_type: visual-system
source_url: https://github.com/yanliudesign/mono-color-skill
source_revision: 1c974047b176ede1d4c1398a5ef9ce5f231bc18f
source_license: MIT
visual_assets_included: false
core_dimensions:
- color
- layout
- typography
- craft
scores:
  anti_slop_value: 0.98
  code_value: 0.8
  density: 0.55
  motion_intensity: 0.0
  novelty: 0.92
  visual_value: 0.95
tags:
  color:
  - one-ink
  - duotone
  - limited-palette
  - neutral-substrate
  - single-accent
  domain:
  - editorial
  - poster
  - zine
  - packaging
  - social
  imagery:
  - photo-led
  - halftone-img
  - mechanically-reproduced
  - cropped-img
  layout:
  - asymmetric-grid
  - active-negative-space
  - type-image-collision
  - editorial-grid
  material:
  - paper
  - risograph
  - halftone
  - photocopy
  - ink-texture
  motion:
  - no-motion
  style:
  - editorial
  - print-led
  - contemporary
  - tactile
  - bold
  tech:
  - image-generation
  - canvas
  - svg
  - css
  typography:
  - serif
  - sans-serif
  - monospace
  - dual-font
  - oversized-type
  - type-driven
dimensions_with_reference:
- color
- layout
- imagery
- craft
---

> 场景适配:适用于海报、zine/出版物封面、邀请函、票券、包装贴纸与社媒封面。重点借用「纸张 + 印版」色彩逻辑、主动负空间、字图碰撞和机械复制工艺;不要把它误读成自动复古或普通的单色滤镜。

# Narrative

A reusable one- and two-ink editorial print system for posters, zines, covers, packaging, and social graphics. It combines adaptive neutral paper, assigned ink plates, mechanically reproduced imagery, asymmetric type-image tension, one decisive focal event, and a quieter release zone. The visual language is contemporary by default: limited ink and halftone describe how the image is made, not an obligation to imitate aged ephemera. Each artifact is rebuilt around one subject, exact supplied words, and the intended carrier rather than tracing a reference composition.

# Tech Stack

The source system is expressed as a machine-readable design catalog plus a deterministic recipe manifest. In an image-generation workflow, resolve the recipe before compiling the prompt. In code-rendered work, use CSS custom properties for paper and ink tokens, SVG masks or Canvas for plate separation and halftone screening, and `mix-blend-mode: multiply` only where two physical plates are meant to overlap. A plain CSS monochrome filter is not an equivalent implementation because it does not create separate ink coverage or exposed substrate.

No visual examples from the source project are bundled in this seed. System rules and implementation guidance are adapted from the MIT-licensed source at the revision recorded in frontmatter; see `references/third-party-notices.md`.

# Layout

Start with the carrier. Vertical posters and covers usually use `3:4` or `2:3`; social covers may use `4:5`; record or playlist sleeves use `1:1`. Use 5%–9% page-width outer margins and an asymmetric 2–3 column editorial grid rather than centered template symmetry.

Choose one composition family before placing details: image field, isolated specimen with annotations, type-led declaration, ruled information poster, archival plate, editorial cover, repeated-object field, overprint collision, or editorial journal. Let one subject occupy roughly 45%–80% of the page, depending on the family. Keep roughly 20%–55% of the substrate visibly quiet; the exact amount follows the focal event instead of a universal quota.

Every frame has one `focal_event`: oversized type, an extreme crop, one giant object/detail, a concentrated overprint collision, or an abnormal scale relationship. Pair it with one `release_zone` made from open paper, a pale screen, sparse support type, a quiet alignment, or a low-detail fade. Secondary elements may extend the focal event but must not create a competing center. Avoid the safe split of a complete photograph on one side and a detached headline on the other.

# Typography

Use one content-responsive display skeleton and one utility voice. Suitable display roles include literary serif for intimate material, cultural grotesk for music and contemporary culture, condensed civic type for public events, programmatic mono for dates and facts, rotated display for forceful covers, or type-as-object when the phrase itself is the image. Handwriting is optional and limited to one short human interjection.

Create clear tension through a 5×–12× scale jump between display and factual microtype, with no more than three type voices. The title may cross, cover, split around, or lock tightly to the dominant object, but exact supplied wording and readability remain authoritative. Chinese text requires a real CJK-capable face and must not be mechanically italicized; Latin display faces need an explicit Chinese fallback when scripts are mixed.

# Color

The substrate is part of the composition but not an ink plate. Choose one deliberately:

- Neutral White `#FAFAF7`: crisp culture, events, contemporary editorial and image-led work;
- Cool Gray `#E9E9E5`: architecture, technology, charcoal-led systems and restrained branding;
- Pale Beige `#F5F1E8`: tactile, food, travel, intimate or explicitly archival subjects.

Pure one-ink work may use Cobalt `#2148B8`, Royal Blue `#2058D4`, Botanical Green `#008A4B`, Mint Green `#5EB783`, Terracotta Orange `#C65F38`, Signal Red `#C83232`, Aubergine `#63365F`, or Charcoal `#30343A`. Density changes may make one ink look darker or paler without creating another color.

Controlled two-ink recipes include:

- Powder Blue `#9EB8D3` + Signal Red `#C83232`;
- Cobalt `#2148B8` + Terracotta `#C65F38`;
- Botanical Green `#008A4B` + Oxblood `#8F3434`;
- Charcoal `#30343A` + Signal Red `#C83232`;
- Electric Blue `#173AE3` + Carbon `#242321`;
- Mint Green `#5EB783` + Warm Charcoal `#302D2E`;
- Ultramarine `#263E99` + Safety Orange `#E55D2B`;
- Cyan `#159DDA` + Brick Red `#B64032`;
- Tangerine `#E46C2D` + Slate Blue `#4773A5`.

Assign a content role to every plate before composing. The dominant plate normally carries 70%–85% of printed coverage; the accent carries 15%–30% and is reserved for a specific job such as dates, annotations, selected objects, or one overlap event. The darker intersection produced by multiply/overprint is not a third ink. Do not add gradients, rainbow accents, or full-color photography.

# Imagery

Treat photography as material to reproduce, not as a full-color image under a tint. Convert it through clean plate separation, visible halftone dots, risograph grain, cyanotype-like exposure, newspaper screening, or photocopy breakup. Preserve identity and factual content: crop, isolate, enlarge, simplify, or screen the supplied subject without replacing it.

Let paper enter the image through clipped highlights, knockouts, irregular gaps, or a halftone fade. Dense areas can pool ink; sparse areas expose the substrate. With no source image, prefer 2–4 identifying anchors and a partial editorial crop over a complete stock-photo person or advertising pose. The subject must remain recognizable at thumbnail size.

# Components

The component set is intentionally small:

- one dominant object or image field;
- one display headline that interacts with that object;
- one factual metadata tier for dates, venue, issue, caption, or index data;
- one manual gesture family, such as a ruled strip, circled fact, registration mark, rotated label, or hand-drawn line;
- optional secondary annotations that follow the same grid and plate roles.

Do not introduce card grids, sticker collages, decorative blobs, fake sponsors, invented URLs, QR codes, or marketing CTAs. When the carrier needs functional information, keep it factual and subordinate.

# Motion

The base artifact is static; motion is not required to make it feel designed. For a web translation, animate only a relationship already present in the print grammar—for example, reveal a second plate, shift a crop, or move through a sequence of screened frames. Preserve the resolved grid, focal event, plate assignment, and exact text across retries and reduced-motion states. Random texture may vary inside a stable mask but must not move anchors or damage readability.

# Algorithms

Resolve a deterministic recipe before implementation:

1. subject, intent, exact text and image role;
2. faithful reproduction or abstract symbol extraction;
3. carrier and ratio;
4. substrate, one/two-ink mode, exact palette and plate roles;
5. composition family and visible paper range;
6. visual tension, one focal event and one release zone;
7. image reproduction process and type hierarchy;
8. one deliberate disruption;
9. a stable imperfection seed derived from subject, exact text, palette and layout.

For identical resolved inputs, keep the recipe stable. Contemporary work uses zero to two restrained imperfections; explicitly tactile, rough or archival work may use two to three. Randomness belongs in ink density and edge behavior, not in composition, facts, spelling, or identity.

# Material

Paper stays visible and the page remains flat—no desk mockup, frame, cast shadow or cinematic depth. Select only effects supported by the subject and carrier:

- uneven ink density: approximately 6%–12% variation on large plate areas;
- dry-edge breakup: approximately 1%–4% along large type or silhouettes;
- halftone density drift: approximately 5%–10% inside screened imagery;
- registration drift: approximately 1–3 mm between two large plates, never on microtype;
- one broken gesture: approximately 4%–12% interruption in an underline, loop or rule.

Limited inks do not imply yellow paper, sepia, distressed borders or nostalgic props. Contemporary work defaults to clean substrate, controlled screening and minimal imperfection.

# Craft

Inspect both full size and thumbnail size. Confirm the exact ink count, explicit plate roles, recognizable subject, one dominant focal event, a quieter release zone, and a readable type hierarchy. Check that exposed paper is a real compositional shape rather than unused margin, and that any manual gesture belongs to one family.

If exact text renders incorrectly, separate image generation from typography and overlay the type in a layout tool. Never accept garbled wording, invent branding to fill space, or claim fidelity when a source composition was traced. Change at least four structural variables from any supplied reference: subject/crop, grid, title location, line breaks, type pairing, ratio, metadata treatment, component topology, or disruption device.

# Coherence

The system stays coherent because every decision answers the same physical model: paper receives one or two assigned plates. The restricted palette pushes visual interest into scale, crop, density, type-image collision and material reproduction. One decisive event gives the page energy; the release zone lets that event breathe. Contemporary restraint remains the default, while tactile aging appears only when the content asks for it.

# Dimensional References

## Plate Separation Scaffold

```css
:root {
  --paper: #fafaf7;
  --ink-primary: #2148b8;
  --ink-accent: #c65f38;
}

.print-page {
  background: var(--paper);
  isolation: isolate;
}

.plate {
  position: absolute;
  inset: 0;
  mix-blend-mode: multiply;
}

.plate--primary { color: var(--ink-primary); }
.plate--accent  { color: var(--ink-accent); }
```

Use separate masks for the two plates. Do not place a full-color image below them; the substrate should show wherever both masks are empty.

## Halftone Pipeline

For Canvas or an offline image process:

1. normalize the source luminance while protecting identity-critical edges;
2. sample it on a fixed screen grid;
3. map each cell's darkness to dot radius or a binary threshold;
4. render the primary plate from the first mask;
5. render the accent only from its assigned semantic mask;
6. composite both over the substrate with multiply behavior;
7. inspect at target size so dots are visible up close but the subject reads at thumbnail scale.

Keep the grid origin and imperfection seed stable across retries. Registration drift moves only a large plate mask, not the page grid or factual text.

## Recipe Snapshot

```json
{
  "carrier": "3:4 editorial cover",
  "substrate": "Neutral White #FAFAF7",
  "mode": "controlled two-ink",
  "inks": ["Cobalt #2148B8", "Terracotta #C65F38"],
  "plate_roles": ["screened subject and headline", "date and one overlap event"],
  "focal_event": "extreme crop crossed by the headline",
  "release_zone": "quiet upper-right paper field",
  "image_treatment": "medium halftone with clipped highlights",
  "imperfections": ["uneven ink density", "1 mm registration drift"]
}
```

## Reusable Move

`one_plate_one_job` — Give every ink plate a named content responsibility, then build one focal event where image and type collide. Release the remaining page through exposed substrate and sparse factual type. This move transfers to posters, covers, packaging and social crops without copying a source arrangement.
