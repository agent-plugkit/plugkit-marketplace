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

An artist portfolio presenting conceptual art projects through a typographic-first interface. The homepage displays 11 projects as a continuous stream of text — each project title in bold italic followed by a descriptive sentence in regular italic. The narrative flow is non-hierarchical: projects appear as equal entries in a running list, suggesting a practice-based research approach where each work is part of an ongoing exploration. A hidden image layer beneath the text reveals project visuals on hover, creating a dual-layer reading experience: text as primary navigation, imagery as contextual depth.

# Tech Stack

Vanilla jQuery-based site with custom JavaScript for interactions. Uses flowtype.js for fluid typography, sticky-kit for column sticking, and skrollr for scroll-driven transforms. Modernizr for feature detection, WURFL for device detection. No framework — hand-coded interactions.

# Layout

Single-column text stream occupying ~80% viewport width, offset by generous left margins (8rem desktop). The project list flows as continuous inline text with line-height 1.5em, creating a reading experience closer to a manifesto than a grid. Behind the text layer sits a fixed-position "research grid" — a scattered collage of polygon-masked images that respond to scroll position with translate3d transforms. The layout rejects conventional portfolio grids in favor of editorial density.

# Typography

Dual-font system: **PreissigText-BoldItalic** for project titles (1.06em size, 0 letter-spacing), **CelliniTF-Regular** for body text (19px base, 1.5em line-height), and **CelliniTF-Italic** for descriptions. A third display font, **PreissigOzdoby-Shape**, provides geometric icons (◆, ▲, ◆) via CSS-generated content before each project. The scale is dramatic: project list renders at 2.5em with 1.5em line-height, creating oversized, almost poster-like text. Custom underline treatment uses `box-shadow: inset 0 -8px 0 white, inset 0 -10px 0px black` — a double-line strikethrough that inverts on hover.

# Color

Strict monochrome: `#000` text on `#fff` background. No accent colors, no gradients. Hover states use `#E6E6E6` background fill. The visual interest comes entirely from typography and image masks, not color.

# Imagery

Project images are masked into irregular geometric polygons using SVG clipPath definitions (clipPolygon1-14). Each shape has unique polygon coordinates creating asymmetric, shard-like frames. Images are randomly selected from JSON arrays on each interaction, creating a non-static experience. The shapes are positioned with varying margins (50px-490px top, 120px-240px left) in a scattered, non-grid arrangement. Image ratios (landscape/portrait/square) are preserved via CSS classes.

# Components

**Navigation**: Minimal header with site name left, "Textes/About" links right, language toggle (en/fr), and a refresh GIF button (20px) that triggers image reshuffle.

**Project links**: Inline text blocks with transparent front layer (for hover detection) and visible underlined layer. Each project prefixed by a geometric icon from PreissigOzdoby-Shape font.

**Research grid**: Fixed full-screen layer (z-index: 30) containing 13 polygon-masked image containers (368px × 290px base, scaled 2x). Hidden by default, revealed on hover/scroll.

# Motion

**Hover reveal**: Mouse over project text triggers specific shape visibility with 3D transform positioning (`translate3d(0px, posY, 0px) scale(2)`). Shapes calculate vertical offset based on viewport position.

**Scroll-driven parallax**: The research-grid-wrapper translates vertically based on scroll progress (`pageT / pageH * wrapperHeight`), creating a slow-drifting collage effect behind the text.

**Image rotation**: Clicking refresh or hovering projects loads random images from JSON arrays — each interaction surfaces different research material.

**Fluid typography**: flowtype.js adjusts font-size between 15-20px based on viewport width (fontRatio: 90).

# Algorithms

Standard implementation, no special design.

# Material

Standard implementation, no special design.

# Craft

**French typographic refinement**: JavaScript applies orthographic corrections — non-breaking spaces before punctuation (\u00A0 before ?, !, :, »), thin spaces (\u202f) for guillemets, and proper apostrophes (\u2019). CSS uses `-webkit-font-smoothing: antialiased` and `text-rendering: optimizeLegibility` throughout.

**Responsive scaling**: Research grid scales via transform (0.7-1.0) based on viewport width breakpoints (479px, 1080px, 1220px, 1350px, 1450px, 1600px).

**Mobile fallback**: Touch devices disable hover interactions; grid remains hidden or accessible via click.

---

# Dimensional References(深度实现参考)


<!-- ref-dim: motion -->

# Motion Implementation

## Hover Reveal System

Two-layer project list architecture:

**Front layer** (invisible, interactive):
```css
ul.front.projects {
    z-index: 12;
    color: transparent;
    position: absolute;
}
```

**Visible layer** (underlined text):
```css
ul.projects {
    font-size: 2.5em;
    line-height: 1.5em;
    z-index: 0;
    position: relative;
}
```

Hover detection happens on transparent front layer; visual feedback (underline inversion, background fill) applies to visible layer via synchronized `.hover` class.

## Image Display on Hover

```javascript
displayPic = function(_this, posY) {
    var picToDisplay = $(_this).index();
    var offsetPos = 420 - ($(window).height() - (($(_this).offset().top + $(_this).height()) - $(window).scrollTop()));
    
    $('.shape').eq(picToDisplay).addClass('toped');
    
    if ($(_this).offset().top - $(window).scrollTop() < 390) {
        if (offsetPos > 0) {
            posY = posY + 100 - offsetPos;
        } else {
            posY = posY + 100;
        }
    } else {
        posY = posY - $(_this).height() - 300;
    }
    
    loadShapeImage($('.shape').eq(picToDisplay).find('img'));
    var shapeOffset = $('.shape').eq(picToDisplay).offset().top;
    $('.shape').css('visibility', 'hidden');
    $('.shape').eq(picToDisplay).css('transform', 'translate3d(' + (0) + 'px,' + (posY - shapeOffset) + 'px,0px) scale(2)');
    $('.shape').eq(picToDisplay).css('visibility', 'visible');
};
```

## Scroll-Driven Parallax

```javascript
$(window).bind('scroll', function() {
    if (!($('#research-grid').hasClass('hidden'))) {
        var pageH = $('body').height() - $(this).height() + heightCorr;
        var pageT = $(window).scrollTop() - $('body').position().top;
        var scrollR = pageT / pageH * ($('#research-grid-wrapper').height() - $(this).height());
        $('#research-grid-wrapper').css('transform', 'translate3d(0px,' + (-scrollR) + 'px,0px) scale(' + 1 + ')');
    }
});
```

Maps scroll progress to vertical translation of the entire image collage.

## Responsive Scale

```javascript
$(window).bind('resize', function() {
    winWidth = $(window).width();
    if (winWidth <= 479) { gridScale = 0.7; }
    else if (winWidth <= 1080) { gridScale = 0.65; heightCorr = 200; }
    else if (winWidth <= 1220) { gridScale = 0.75; heightCorr = 150; }
    else if (winWidth <= 1350) { gridScale = 0.8; heightCorr = 120; }
    else if (winWidth <= 1450) { gridScale = 0.87; heightCorr = -10; }
    else if (winWidth <= 1500) { gridScale = 0.95; heightCorr = -15; }
    else if (winWidth >= 1600) { gridScale = 1; heightCorr = -30; }
    
    $('#research-grid').css('transform', 'translate3d(0px,0px,0px) scale(' + gridScale + ')');
});
```

## Mobile Disable

```javascript
if (!(WURFL.is_mobile)) {
    $('.projects.front li').each(function(i) {
        $(this).mouseover(function() { /* ... */ });
        $(this).mouseout(function() { /* ... */ });
    });
}
```

Hover interactions disabled on mobile devices.

<!-- ref-dim: typography -->

# Typography Implementation

## Font Families

Three custom fonts loaded via @font-face:

**PreissigText-BoldItalic** (project titles)
- File: `PreissigText-BoldItalic_gdi.woff`
- Unicode range: U+0020-2665
- Applied via `.bluu` class: `font-family:'PreissigText-BoldItalic'; letter-spacing: 0px; font-size:1.06em;`

**PreissigOzdoby-Shape** (geometric icons)
- File: `PreissigOzdoby.woff`
- Unicode range: U+0020-00E4
- Applied via `.icon:before` pseudo-element with CSS-generated content

**CelliniTF-Regular / CelliniTF-Bold / CelliniTF-Italic** (body text)
- Files: `CelliniTF-Regular_gdi.woff`, `CelliniTF-Bold_gdi.woff`, `CelliniTF-Italic.woff`
- Unicode range: U+0020-2212
- Base: `font-family:'CelliniTF-Regular'` on html element
- Bold: `font-family:'CelliniTF-Bold'` via `.bold` class
- Italic: `font-family:'CelliniTF-Italic'` via `em` tag or `.italic` class

## Custom Underline Technique

```css
.underline {
    box-shadow: inset 0 -8px 0 white, inset 0 -10px 0px black;
}
```

Creates a double-line effect: white inset (8px) masks the background, black inset (10px) draws the line. On hover, inverts to match `#E6E6E6` background.

## Icon System

Geometric markers before each project via CSS generated content:

```css
.projects li:nth-child(1) .icon:before { content: "D"; }
.projects li:nth-child(2) .icon:before { content: "A"; }
.projects li:nth-child(3) .icon:before { content: "F"; }
/* etc. — maps to PreissigOzdoby-Shape font glyphs */
```

## Fluid Typography

flowtype.js configuration:
```javascript
$('body').flowtype({
    minFont: 15,
    maxFont: 20,
    fontRatio: 90
});
```

## French Typographic Corrections

JavaScript regex replacements for proper French spacing:
- Non-breaking space (`\u00A0`) before: aux, au, à, un, une, la, le, les, de, du, des, se, ses, sa, ce, ces, et
- Thin space (`\u202f`) before: ?, !, :, »
- Thin space after: «
- Proper apostrophe: `\u2019` replaces `\'`
