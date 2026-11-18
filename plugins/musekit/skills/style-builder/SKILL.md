---
name: style-builder
description: 给 Musekit 新增一套可长期复用的风格 Template：从一个方向或风格名从零创建，或从已有的网站、代码库、设计系统、一组作品里提取。产物存进用户项目的 musekit/<id>/，或过完全部关卡进官方风格库。用于「新建一套风格」「把这个项目的风格提出来」「把我们的品牌整理成以后都能用的风格」。只为这一次制作带上品牌规范时，由 musepool 当场处理。
---

# Style Builder

产出一套 Template，以及它需要的 Seed 和样张。字段按 musepool 的[字段约定](../musepool/references/schema.md)写。命令里的 `muse.py` 指 `<插件根>/skills/musepool/scripts/muse.py`，插件根是本文件往上两级。

## 先定终点

| 终点 | 给谁 | 产物放在哪 | 状态 |
| --- | --- | --- | --- |
| 用户 Template | 要在自己项目里反复使用的用户 | 用户项目的 `musekit/<id>/` | `source: user`、`status: draft` |
| 库内 Template | 在官方仓库里维护风格库的人 | 插件的 `skills/musepool/library/` | `source: library`，过完全部关卡后改为 `verified` |

不在官方仓库里工作时，终点就是用户 Template。项目提取的产物只有同时满足三条才能进官方风格库：来源的许可清楚、作为 Precedent 登记、过完维护者的全部关卡。私有项目和商业品牌一律只做用户 Template。

用户风格目录的结构固定：

```text
musekit/<id>/
  template.md                 # 用户 Template
  seeds/<类别>/<seed-id>.md   # 用户 Seed，只在值与库内 Seed 不一致时才写
  <id>.png                    # 样张
```

Template 用相对自己的路径引用用户 Seed，例如 `color: seeds/color/<seed-id>.md`；值一致的类别直接写库内 Seed 的 id。制作时把 Template 的路径交给 musepool，例如 `muse.py resolve musekit/<id>/template.md --scene web --out <作品目录>/style.md`。用户 Template 不进 `muse.py search`，制作时点名或给出路径。

## 两个入口

用户只有一个方向或风格名时走**从零创建**；用户给了网站、代码库、设计系统或一组作品时走**项目提取**。两个入口的前两步不同，之后都走「落成」和「样张」，维护者再走维护者关卡。

每个确认点都停下来，等用户确认后再往下走；用户要求直接做时也一样，因为确认的内容只有用户能决定。

### 从零创建

1. **定方向（确认点）。** 先看库里已有什么：`muse.py list templates`，必要时 `show <id>`。再调研这个方向：它的来源（流派、设计史、成熟的设计系统）、代表作品和公认的文法。给 2–3 个候选，每个写明：
   - 一句话的精神：这套风格要解决什么阅读问题；
   - 2–3 个真实作品作为范例候选，写明作品名、出处，以及借它的什么；
   - 与最接近的库内 Template 的区别，要落在网格、尺度、对齐、留白这些文法上，不能只是换了颜色或字体。

   完成标准：用户选定一个方向，`id`、中文名和英文名已经定下。
2. **写精神与文法（确认点）。** 先出文字稿：`## 精神`、`## 文法`（网格、对齐、层级、留白、色彩、装置、图像，以及选中、出错、完成等状态）和 `## 常见误用`，以及一条判断方法：去掉颜色和阴影之后，靠什么认出这套风格。这一步不出样张、不选 Seed、不写 token。文法没立住就出图，风格只能靠配色和装饰撑着；如果判断方法只能写出颜色或装饰，回到第 1 步。完成标准：用户确认文字稿。

接着走「落成」。

### 项目提取

1. **取值。** 按[项目提取](references/extraction.md)的顺序读：先读现成的设计文档和 token 文件，再读代码里的值，最后看运行起来的页面。项目全程只读。完成标准：三层来源都查过，没有的写明没有。
2. **写提取报告（确认点）。** 按[提取报告](references/extraction.md#提取报告)的格式写：开头拟定 `id`、名称和场景，取到的值附出处，推断的值附依据，缺口写明处理方式，再与库内 Seed 和字体注册表对照。完成标准：用户确认报告。

接着走「落成」。

### 落成

1. **选或写 Seed。** 逐个类别对照库内 Seed（`muse.py list seeds --category <类别>`）：值一致就引用 id；不一致时，用户终点在 `musekit/<id>/seeds/` 里写用户 Seed，维护者终点在风格库里写新 Seed（`status: draft`）。`color`、`typography`、`grid`、`spacing` 是必需类别。
   - **颜色**：`paper`、`ink`、`accent` 必填；`pairs` 里每一组在每个变体下都要过对比度。成对的浅色和深色 token 做成 `light` 和 `dark` 两个变体，`default` 取用户最常用的外观；阴影、高光这类颜色以外的深色值，写进对应 Seed 自己的 `variants.dark`。有了这两个变体，网页可以跟随系统深浅色切换，海报和演示文稿每次取其中一个（见 [ADR 0002](../../docs/adr/0002-dark-tokens-become-color-variants.md)）。
   - **字体**：字体值只能用注册表里的开源字体（`muse.py list fonts`）。用户指定版权字体时，先问对方有没有授权：有授权，Template 正文写明「有授权时用原字体」，token 仍填开源替代；没有授权，换成注册表登记的开源替代，并写明差异。用户终点不能改注册表：要用的开源字体没登记，或要用的字重不在它的加载地址里时，选注册表里最接近的字体和字重并写明差异；维护者终点可以把它登记进注册表，再跑 `muse.py check --links`。
   - **数据色板**：声明 `data` 场景时，颜色 Seed 必须带 `data` 色板（分类、顺序、发散三组，规则见字段约定的 `color` 一节）。色板从风格自己的用色出发，色数不够就如实写分类数的上限，不为凑数引入风格之外的颜色。做不出色板时不声明 `data`。
2. **写 Template。** 从零创建用第 2 步确认过的文字稿；项目提取按报告归纳，沿用的部分写明沿用了谁。`scenes` 只写有依据的场景；graphic 和 web 要写 `### graphic`、`### web` 场景适配，并在 `overrides` 里给出海报画布与字号、网页断点。覆盖只能改已有的 token，所以网格 Seed 要同时写 `canvas-width` 和 `canvas-height`（网页参照视口的宽和高），海报再覆盖成自己的画布。用户终点至少写好用户最常用的那个场景。`exemplars` 列 Precedent id，用户 Template 没有就写 `[]`。没写场景适配的已声明场景会解析为「未验证适配」。
3. **机检。** 用户终点运行 `muse.py check musekit/<id>/template.md`，用户 Seed 一并列在命令后面；维护者终点运行不带参数的 `muse.py check`，检查整个风格库。

完成标准：检查通过，`resolve` 每个已声明场景都能写出 `style.md`。

### 样张（确认点）

- **用户终点**：在用户项目里生成样张页，再用插件的检查脚本截整页（在能解析 Playwright 的目录里运行，缺少时它会打印安装命令）：

  ```bash
  python3 <插件根>/skills/musepool/scripts/muse.py specimen musekit/<id>/template.md --out musekit/<id>/<id>.html
  node <插件根>/scripts/inspect_page.mjs musekit/<id>/<id>.html --viewports 1440x900 --out <临时目录>
  ```

  把 `<临时目录>/web-1440x900-full.png` 存成 `musekit/<id>/<id>.png`，删掉 `<id>.html`。样张页是 1440 宽的固定页面，报告里窄视口的溢出不用管。
- **维护者终点**：在仓库里运行 `npm run build:specimens -- <id>`，样张写到 Template 旁边。

把样张给用户看。样张只展示 token 和规则型 Seed 的要点，看不出质感、阴影、图像这些签名元素，给用户看时要说明这一点，签名元素到关卡的试做里看。用户要改时，改的是文法回到「写精神与文法」或提取报告，改的是值回到「落成」。完成标准：用户看过样张，没有要改的地方。

## 关卡

### 用户 Template

1. `check` 通过。
2. 样张给用户看过。
3. 用[标准 Brief](references/briefs.md) 在用户最常用的场景试做一件：把请求交给那个场景的 Workflow，风格给出 Template 的路径。场景适配是推导出来的（来源里没有这个场景，例如从应用界面推出的海报）时，每个推导的场景也各试做一件。试做中发现风格文件说不清的地方，回去补 Template，再试一次。

完成标准：三项都满足。交付时写明 Template 的路径、样张、试做作品，推断的值和沿用的部分，替换掉的字体，以及没有声明或只是未验证适配的场景。

### 库内 Template

1. 不带参数的 `muse.py check` 通过，改过字体注册表时 `check --links` 也通过；样张 `<id>.png` 已经渲染。
2. **盲测**：graphic 和 web 两个场景都用[标准 Brief](references/briefs.md) 的河岸图书节做一次，即一张海报加一个首页。盲测由空白上下文的代理完成：它只读插件里的文档，不知道这套风格是怎么写出来的，实测耗时并记录摩擦。摩擦指向风格文件时，修好后重新盲测。
3. **辨识度对照**：把盲测的海报和首页去色、去阴影，与最接近的库内 Template 的同类作品并排。那个 Template 有制作示例时用示例，没有时用同一份标准 Brief 再做一次。并排后要能一眼分开；分不开时回到「写精神与文法」。
4. **用户目视验收**：把样张、盲测作品和对照图给用户看。用户确认后，才把 `status` 改为 `verified`。
5. slides、diagram、data 可以只声明、不写场景适配，以未验证适配进库；声明 `data` 前先有数据色板。
6. 范例：在 `exemplars` 里引用的真实作品要作为 Precedent 登记，开源来源同时在 `references/third-party-notices.md` 登记许可。项目提取的产物进库时，被提取的项目本身也要这样登记。

在官方仓库中维护时，盲测的提示词模板、摩擦记录格式和辨识度对照脚本另见仓库的 `docs/musekit/`。

完成标准：六项都满足，`status` 已由用户验收后改为 `verified`。
