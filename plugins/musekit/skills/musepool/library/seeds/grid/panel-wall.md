---
id: panel-wall
category: grid
nature: rule
name: 拼板墙
status: draft
scenes: [graphic, web, slides]
affinity: [neo-brutalism]
conflicts: [off-center-void, ma-interval, zero-radius-hairline]
tokens:
  canvas-width:
    value: 1440px
    role: 参照画布宽度：网页是参照视口宽，平面是画布宽
  canvas-height:
    value: 900px
    role: 参照画布高度：网页是首屏高度，平面是画布高度
  columns:
    value: 12
  gutter:
    value: 24px
    role: 栏间隙：只用来定栏线；板与板之间不留间隙，接缝落在栏间隙的中线上
  margin:
    value: 48px
  panel-gap:
    value: 0px
    role: 相邻两块板的间隙：板与板直接相接，共用一条 rule-width 的线
  dominant-ratio:
    value: 2
    role: 一面墙里最大的板与第二大的板的最小面积比
  fill-ratio:
    value: 0.9
    role: 标题墨迹宽度占所在板内宽的最小比例
checks:
  roles:
    wall: 一面墙。整张海报算一面；网页的首屏和首屏以下的每一段各是一面
    panel: 墙里的每块板，列表板和表单板也标
    main: 每面墙的主板，同时标 panel；表单墙里是表单板
    list: 列表板，同时标 panel；不参与面积比较
    title: 顶满主板的标题，每面墙一个
  rules:
    - kind: seams
      group: wall
      item: panel
      max: rule-width
    - kind: dominant
      group: wall
      item: panel
      main: main
      exclude: list
      min: dominant-ratio
    - kind: fill
      text: title
      box: panel
      min: fill-ratio
---

# 拼板墙

## 要点

- 版面是一面用粗线分格的墙：板与板直接相接，间隙为 `panel-gap`，接缝只有一条 `rule-width` 的线，不是两条边框叠在一起。接缝可以由一侧板的边框画出，也可以让网格间隙等于 `rule-width`、从墨色墙底透出来。墙内的板一律直角，墙内不留任何空隙。
- 板的大小悬殊：每面墙里最大的板（主板）面积至少是第二大的板的 `dominant-ratio` 倍；不要把同样大小的板排成一排。列表板和表单板不参与这项比较：表单墙里表单板就是主板；列表墙里主板只和其他非列表的板比。
- 标题顶满它所在的板：标题墨迹宽度至少是板内宽的 `fill-ratio`。字号用 `muse.py fit --span <主板跨的栏数> --padding <左,右>`（从栏位外沿量到字块，边框算在内；板出血到画布或视口边时，从 margin 线量起） 推导；可以压过主板的一条接缝，越过的部分不超过四分之一个字宽，也不出画布或视口。
- 接缝落在栏间隙的中线上。板内文字离接缝至少 24px，靠画布或视口边缘的板以 `margin` 作内边距；板内文字不要求落在栏线上。
- 密集内容（日程、类别、名单）放进一块列表板，板内再用同样的粗线分成格子，整块列表板算作一块板。
- 一面墙有 3–6 块板；超过时拆成上下两面墙，中间用一条满宽条带或一段纸面隔开。

## 适用与边界

拼板墙不是卡片网格：如果板之间留了缝、每块各自带阴影或圆角，读者看到的就是一排卡片。主板里只放标题、一句说明和主操作（或最关键的一条事实），不要再嵌套小卡片。表单和数据表放在自己的板里，板内保持规整。
