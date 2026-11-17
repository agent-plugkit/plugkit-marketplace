---
id: two-plate
category: color
nature: value
name: 双色印版
status: draft
scenes: [graphic, web, slides, data]
affinity: [mono-print]
conflicts: []
tokens:
  paper:
    value: "#FAFAF7"
    role: 中性白纸面：纸不是印版，但它是构图的一部分
  ink:
    value: "#2148B8"
    role: 主印版：承担 70%–85% 的印刷面积，包括正文
  accent:
    value: "#C65F38"
    role: 副印版：每个画面只做一件事，例如大号日期、一处大字注释或一次叠印；只用于大字和大面积
  on-accent:
    value: "#FAFAF7"
    role: 副印版色块上的反白大字
variants:
  cobalt-terracotta:
    ink: "#2148B8"
    accent: "#C65F38"
  charcoal-red:
    ink: "#30343A"
    accent: "#C83232"
  oxblood-green:
    ink: "#8F3434"
    accent: "#008A4B"
  ultramarine-orange:
    ink: "#263E99"
    accent: "#E55D2B"
data:
  categorical: ["#2148B8", "#788FD1", "#C65F38"]
  sequential: ["#D9DFEE", "#AEBCE1", "#8398D4", "#516FC6", "#2148B8"]
  diverging: ["#C65F38", "#E0AC98", "#DBD5D7", "#8EA1D8", "#2148B8"]
  variants:
    charcoal-red:
      categorical: ["#30343A", "#818386", "#C83232"]
      sequential: ["#DCDCDB", "#B3B5B5", "#8B8D8F", "#5C6064", "#30343A"]
      diverging: ["#C83232", "#E19694", "#DDCFCB", "#959798", "#30343A"]
    oxblood-green:
      categorical: ["#8F3434", "#001C0F", "#008A4B"]
      sequential: ["#EADCDA", "#D5B5B3", "#BF8D8C", "#A7605F", "#8F3434"]
      diverging: ["#008A4B", "#7DC2A1", "#D3D8CE", "#C49796", "#8F3434"]
    ultramarine-orange:
      categorical: ["#263E99", "#7B89BF", "#E55D2B"]
      sequential: ["#DADEE9", "#B0B8D6", "#8593C3", "#5567AE", "#263E99"]
      diverging: ["#E55D2B", "#F0AC91", "#DFD4D4", "#909CC8", "#263E99"]
pairs:
  - [ink, paper, body]
  - [paper, ink, body]
  - [accent, paper, large]
  - [on-accent, accent, large]
---

# 双色印版

## 要点

- 只有两种油墨：主印版承担 70%–85% 的印刷面积（有墨的面积，不算露出的纸）和全部小字；副印版约占 15%–30%，以文字为主的网页段落墨量很少，不算这个比例，也可以不用副印版；在每个画面（海报一页、网页一段）只承担一个角色：大号日期、一处大字注释或一次叠印，以大面积网点、色块或大字出现。副印版放在纸上只能用于大字，小字一律用主印版。纸色露出来，是第三种「颜色」。
- 浓淡靠网点密度变化，而不是添加第三种颜色；两版叠印处变深是自然结果，不算第三种墨。
- 变体是四组经典的双色配方；也可以只用主印版做单色作品，此时副印版不出现。

## 适用与边界

不加渐变、彩虹色和全彩照片。选择这一方向时才引入印刷质感。数据图只用两版墨，每个变体有自己的数据色板。分类最多 3 类：前两类都在主印版上，实色和 60% 网点（oxblood-green 的网点在绿色盲下与绿色撞色，改用两版叠印），所以两个序列的图仍是单色，副印版留给结论那一项；第三类才用副印版，这时不再另用副印版强调。超出 3 类就合并为「其他」或分面，或者在同一种墨上加纹样并直接标注。顺序色是主印版的网点由浅到深，发散色两端是两版墨，中点是两版各 10% 网点的叠印。
