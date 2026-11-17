---
name: musepool
description: 设计风格与灵感库：按场景检索已验证的风格 Template，比较候选、组合 Seed，或把用户品牌整理成同形风格。用于「有什么风格适合…」「找灵感」「这个品牌怎么延展」。不制作成品。
---

# Musepool

风格库有三层：

- **Seed**：按设计元素分类的可复用单元，例如配色、字体、网格、间距、手法。值型 Seed 给出可以直接使用的值，规则型 Seed 给出做法。
- **Template**：一套组合好的风格，例如新瑞士国际主义。它由 Seed 组合而成，并写明风格的精神、文法、各场景的适配和常见误用。
- **Precedent**：真实作品的拆解记录，作为 Template 的范例。

本 Skill 的产出是一份按场景解析好的 `style.md`，交给制作 Workflow 使用。命令都在本 Skill 目录下运行，从别处调用时使用脚本的实际路径：

```bash
python3 scripts/muse.py search --scene graphic 理性 秩序
python3 scripts/muse.py show neo-swiss
python3 scripts/muse.py resolve neo-swiss --scene web --variant cobalt --out <作品目录>/style.md
python3 scripts/muse.py list seeds --category color
python3 scripts/muse.py fit neo-swiss --scene graphic --chars 5 --span 12
```

## 从请求到 style.md

1. **定下查询。** 明确场景（`graphic`、`web`、`slides`、`diagram`、`data`）、内容气质和硬约束（品牌色、指定字体、既有设计系统）。由 Workflow 调用时，这些来自它的 Brief。完成标准：能写出一条带 `--scene` 的检索。
2. **按风格来源分支。**
   - 用户给了品牌规范、设计系统或参考图：按[字段约定](references/schema.md)当场写一份只为这次制作用的 `source: user` 的 Template，放在作品目录里，`check <路径>` 通过后进入第 4 步。用户说以后还要反复用，或要从整个网站、代码库、设计系统里提取时，交给 `style-builder`，它把风格存进用户项目的 `musekit/<id>/`。字体对照注册表处理：用户指定的版权字体，先问对方是否持有授权；持有就使用，开源替代作为回退；没有就换成注册表里的开源替代，并在 Template 里写明替换和差异。
   - 用户点名了自己项目里的风格（用户风格目录 `musekit/<id>/` 里的 `template.md`）：直接读这个文件，确认它声明了本场景和所需的变体，`check <路径>` 通过后进入第 4 步，`resolve` 时传这个路径。
   - 用户点名了库里的风格：用 `show` 确认后进入第 4 步。由 Workflow 调用时，Workflow 先写完 Brief 再来解析：变体和场景约束从 Brief 里来。
   - 其余情况进入第 3 步。
3. **检索并让用户选择。** 运行 `search --scene <场景> <气质词>`。检索词用气质词（理性、安静、好玩），不用内容词（报告、实验）：内容词只会命中正文里的偶然出现。同分时，已写本场景适配的风格排在前面。给出 2–3 个候选，每个附一句适配理由、样张路径、状态，以及本场景适配是否已写。等用户选定；请求里说了「直接做」就取第一名，并说明选了哪个、为什么，以及它与请求气质不贴合的地方。无命中时，输出会列出本场景可用的气质词，从中挑与 Brief 最接近的再检索。只有 1 个合适的候选时，给出它和理由，同样等用户确认。没有合适的风格时，如实说明缺口：用户在场时，问对方是用最接近的风格还是混搭；用户要求直接做时，用最接近的风格，并在交付里写明不贴合之处。经用户同意，可以用 `compose` 组合 Seed 成混搭 Template：有冲突的组合会被拒绝，缺少亲和声明的 Seed 要写明采用理由，生成后补写精神、文法与常见误用。完成标准：确定一个 Template 和它的变体。
4. **解析。** 运行 `resolve <template> --scene <场景> [--variant <变体>] --out <作品目录>/style.md`，交给 Workflow。完成标准：文件已写出，状态和适配情况在文件中可见。

纯灵感请求停在第 3 步：展示候选和样张，不进入制作。

## 分寸

- Template 的状态如实传达：`draft` 尚未经过人工确认；只有 `verified` 才能称为验证过的风格。
- Precedent 只提供方法。原作品的文案、数据、品牌、照片和身份不进入新作品。
- 库内只登记用户能合法获得的字体；可用值只指向开源字体，版权字体只作为风格原型和替代说明出现。

## 维护风格库

新增一套 Template 走 `style-builder` 的维护者关卡。修改已有的 Seed、Template 或字体时按[字段约定](references/schema.md)编写，`check` 必须通过；改动字体注册表后运行 `check --links`。在仓库中用 `npm run build:specimens` 重新渲染样张；改了已验收的风格，要等用户目视确认后才保留 `verified`。

第三方来源与许可见[来源与许可](references/third-party-notices.md)。
