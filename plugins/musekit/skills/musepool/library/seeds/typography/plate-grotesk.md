---
id: plate-grotesk
category: typography
nature: value
name: 印刷展示体与工具字
status: draft
scenes: [graphic, web, slides]
affinity: [mono-print]
conflicts: []
tokens:
  font-display:
    value: Archivo
    role: 展示字：一个随内容调整的骨架
  font-text:
    value: IBM Plex Sans
    role: 正文
  font-cjk:
    value: Noto Sans SC
    role: 中文全部层级
  font-mono:
    value: IBM Plex Mono
    role: 工具字：日期、事实、编号与图注
  weight-display:
    value: 800
  weight-text:
    value: 400
  weight-strong:
    value: 600
  size-display:
    value: 136px
  size-headline:
    value: 56px
  size-title:
    value: 26px
  size-body:
    value: 17px
  size-meta:
    value: 12px
  leading-display:
    value: 0.9
  leading-display-cjk:
    value: 1.05
  leading-headline:
    value: 1.0
  leading-title:
    value: 1.2
  leading-body:
    value: 1.5
  tracking-display:
    value: "-0.02em"
  tracking-meta:
    value: "0.08em"
---

# 印刷展示体与工具字

## 要点

- 最多三种字体声音：一个展示骨架、一个正文、一个等宽工具字；展示字至少是事实小字的 5 倍；超过 10 倍时，事实小字排成整齐的块。
- 标题可以压住、穿过或紧贴画面中的主要物体，但给定的文字必须完整、可读。
- 信息栏里的日期、地点、编号、图注用等宽工具字，全大写西文、小字号、加字距；含中文的标签不用等宽字，改用正文字体；海报和网页上它用 `size-body`，因为 12–15px 的中文在缩略图和手机上读不清。画面里另有一个副印版大号日期时，它按展示字处理，不受这条约束。等宽字体只排西文、数字和符号；含中文或长破折号「—」的值改用正文字体，因为中文落进等宽字体不再等宽，「—」在等宽字体里只占一格，看起来像短横。
- 中文不做机械倾斜；西文展示字后面必须接中文回退。

## 适用与边界

展示骨架可以按内容换成文学衬线（私密、叙事）或压缩字体（公共活动），但同一件作品只用一个。
