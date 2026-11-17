---
id: 50nz9co2
category: newspaper-style web front page
modality: web
view_type: newspaper
source_url: https://github.com/wolfgang42/paper-hn
source_revision: 60cee16c7388eaddfd0f27aec860f51b38670f52
source_license: MIT
visual_assets_included: false
core_dimensions:
- layout
- typography
scores:
  anti_slop_value: 0.7
  code_value: 0.6
  density: 0.6
  motion_intensity: 0.0
  novelty: 0.5
  visual_value: 0.6
tags:
  domain:
  - newspaper
  - news-aggregator
  imagery:
  - grayscale-image
  layout:
  - masonry
  - masthead
  - ruled-sections
  style:
  - print-inspired
  - minimal
  typography:
  - serif
  - justified
  - scale-by-rank
dimensions_with_reference: []
---

> 借鉴范围：只借方法；原作品的文案、刊名、真实新闻和照片不进入新作品。下文记录参考本身的方法，其参数、布局和技术栈不自动成为当前任务要求。

# Narrative

A small static page generator that renders the Hacker News front page as a print-style newspaper. It sets a centered title over a one-line strip with an issue number and a date, then places the stories as blocks of text with an optional picture, ordered by rank, with the first few given more width and larger headlines. Each story is closed by a thin horizontal rule. The project shows how little CSS is needed to make a web page read as a newspaper.

# Layout

The page opens with a header: a large centered title, then a strip across the full width with a thin rule above and below it. The strip holds two items pushed to opposite ends, an issue-style number on the left and the date and time on the right.

Below the header the stories flow in a masonry layout of equal-width blocks, 25em wide, placed in as many columns as the window allows and centered as a group. The first three stories are given a wider block (54em maximum), so the leading stories take more than one column of width, and the rest follow in the standard width. Each story block ends with a thin black bottom rule and bottom padding, so stories are separated by rules, not by gaps. Under 58em of width the side margins drop to zero and the blocks fill the window. A final block with a one-pixel border carries the credits line.

# Typography

All text is a serif face. The title is set at 300% of the base size, centered. A story headline is at the default heading size, except that the first three are set at 220% and the tenth and later at 120%, so size falls with rank. Body paragraphs are justified with automatic hyphenation and long words allowed to break. A short sans-serif keyword and the story number close each paragraph; the domain name is set in a monospace face as a lead-in. Links carry no underline by default and inherit the text color.

# Imagery

Story images are scaled to the block width, shown in grayscale, and centered above the headline. Pictures on the first three stories keep their color; the others turn to color only on hover.
