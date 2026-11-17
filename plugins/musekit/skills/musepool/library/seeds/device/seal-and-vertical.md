---
id: seal-and-vertical
category: device
nature: rule
name: 印章与竖排
status: draft
scenes: [graphic, web, slides]
affinity: [japanese-ma]
conflicts: []
tokens:
  seal-size:
    value: 40px
    role: 印章式标记的边长
---

# 印章与竖排

## 要点

- 用一枚朱色小方印（边长 `seal-size`）标记一个关键信息：日期、主办方或栏目名，全画面最多一枚。
- 栏目名、署名和短标题可以竖排，从右向左阅读；竖排文字与横排正文之间留出整栏的空。
- 极细的线（`rule-width` 淡墨）只用于分开两组内容，不给内容区块围框；按钮和选中项的边框不在此列。

## 适用与边界

印章里的字必须真实（主办方简称、日期），不编造印文，也不重复标题；真实的短文本超过一个字时，在印章里竖排两到四字，找不到合适的真实短文本就不用印章。印内的字用 `size-meta`：两字排一列，三四字排两列；放不下时把印章放大到装得下（四边各留约十分之一的空），不缩小字。不把鸟居、樱花、和纸纹理这类符号当作装饰堆进画面。
