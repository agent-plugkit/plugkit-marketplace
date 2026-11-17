# 深色只作为颜色变体，不进 schema

从项目里提取出的成对浅色 / 深色 token，落成同一个颜色 Seed 的 `light` 和 `dark` 两个变体。每次制作解析其中一个，style.md 不输出跟随系统切换的 `prefers-color-scheme` 两套值。用提取出的风格做海报、演示文稿、宣传页这类单一外观的作品时，变体已经够用；要支持「跟随系统深浅色的网页」，需要同时改 Seed 字段、`muse.py resolve` 和 web-design，这个需求还没有真实出现。等真有需要时再做。
