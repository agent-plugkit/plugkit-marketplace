---
id: drop-cap-and-folio
category: device
nature: rule
name: 短线、首字下沉与书眉
status: draft
scenes: [graphic, web, slides]
affinity: [editorial-serif]
conflicts: []
tokens:
  drop-cap-lines:
    value: 3
    role: 首字下沉占几行
  rule-short:
    value: 48px
    role: 轴上分组用的居中短线长度
---

# 短线、首字下沉与书眉

## 要点

- 轴上的各组之间用一条居中的短线分开，长度为 `rule-short`、粗细为 `rule-width`，也可以换成一个小装饰（如 *，用页面字体里有的字形）。标题组里不用通栏细线；通栏细线只出现在书眉下方、页脚上方，以及正文的章节之间。
- 一篇文章只在开头用一次首字下沉（占 `drop-cap-lines` 行），用强调色；中文首字下沉同样适用。
- 书眉放一行小字：主办方、刊名或栏目名，加真实的期号或日期、页码；其中的西文和数字用等宽字体，中文用正文字体。
- 署名、摄影、日期在标题组里居中放在标题下方，用淡墨小字；长文正文里的补充署名可以放旁注栏。
- 引文用大一号的斜体（中文用淡墨加大字号），配一条强调色的短竖线或引号。

## 适用与边界

期号、页码只标记真实存在的顺序；单页作品不编造期号。
