#!/usr/bin/env python3
"""musepool 风格库工具：只用 Python 标准库，检索与解析完全在本地进行。

  python3 scripts/muse.py list templates|seeds|fonts|precedents [--scene S] [--category C]
  python3 scripts/muse.py search [--scene S] [--seeds] 关键词...
  python3 scripts/muse.py show <template|seed|precedent id 或字体名>
  python3 scripts/muse.py resolve <template id|路径> --scene S [--variant V] [--out style.md]
  python3 scripts/muse.py compose --id ID --name 名称 --family F --seeds a,b,c [--out 路径]
  python3 scripts/muse.py fit <template> --scene S --chars N (--span K | --vertical) [--tracking EM] [--padding PX] [--breakpoint B]
  python3 scripts/muse.py specimen <template id|路径> [--variant V] --out specimen.html
  python3 scripts/muse.py check [路径...] [--links]
  python3 scripts/muse.py frontmatter <路径>          # 以 JSON 打印 frontmatter，供调试

字段与命名约定见 references/schema.md。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
PLUGIN = SKILL.parent.parent
LIBRARY = SKILL / "library"
SEEDS = LIBRARY / "seeds"
TEMPLATES = LIBRARY / "templates"
PRECEDENTS = LIBRARY / "precedents"
FONTS = LIBRARY / "fonts.yaml"
SPECIMEN = SKILL / "assets" / "specimen.html"

CATEGORIES = (
    "color", "typography", "grid", "spacing", "shape", "depth", "texture",
    "imagery", "iconography", "motion", "data-encoding", "device", "technique",
)
REQUIRED_CATEGORIES = ("color", "typography", "grid", "spacing")
SCENES = ("graphic", "web", "slides", "diagram", "data")
STATUSES = ("draft", "verified")
SOURCES = ("library", "user", "composed")
REQUIRED_TOKENS = {
    "color": ("paper", "ink", "accent"),
    "typography": ("font-display", "font-text", "font-cjk", "size-body"),
}
LEVELS = {"body": 4.5, "large": 3.0}


class MuseError(Exception):
    """用户可读的错误，退出码 2。"""


# ---------------------------------------------------------------- YAML 子集

def _scalar(text: str):
    text = text.strip()
    if text.startswith("[") and text.endswith("]"):
        inner = text[1:-1].strip()
        return [] if not inner else [_scalar(part) for part in _split_flow(inner)]
    if len(text) >= 2 and text[0] == text[-1] and text[0] in "\"'":
        return json.loads(text) if text[0] == '"' else text[1:-1].replace("''", "'")
    if text in ("null", "~", ""):
        return None
    if text in ("true", "false"):
        return text == "true"
    if re.fullmatch(r"-?\d+", text):
        return int(text)
    if re.fullmatch(r"-?\d+\.\d+", text):
        return float(text)
    if text == "{}":
        return {}
    if " #" in text:
        raise MuseError(f"含 # 的值要加引号：{text}")
    return text


def _split_flow(text: str) -> list[str]:
    parts, current, quote = [], "", ""
    for char in text:
        if quote:
            current += char
            if char == quote:
                quote = ""
        elif char in "\"'":
            quote = char
            current += char
        elif char == ",":
            parts.append(current)
            current = ""
        else:
            current += char
    parts.append(current)
    return [part.strip() for part in parts]


def _split_key(text: str):
    match = re.match(r"^([A-Za-z0-9_\-]+):(?:\s+(.*))?$", text)
    return (match.group(1), match.group(2) or "") if match else None


def load_yaml(text: str):
    """解析 Musepool 使用的 YAML 子集：块映射、块列表、标量与只含标量的行内列表。"""
    lines = []
    for raw in text.splitlines():
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "\t" in raw[: len(raw) - len(raw.lstrip())]:
            raise MuseError("YAML 缩进不能使用制表符")
        lines.append((len(raw) - len(raw.lstrip(" ")), stripped))
    if not lines:
        return {}
    value, index = _block(lines, 0, lines[0][0])
    if index != len(lines):
        raise MuseError(f"无法解析的 YAML 行：{lines[index][1]}")
    return value


def _block(lines, index, indent):
    if lines[index][1].startswith("- ") or lines[index][1] == "-":
        return _list(lines, index, indent)
    return _map(lines, index, indent)


def _map(lines, index, indent, result=None):
    result = {} if result is None else result
    while index < len(lines) and lines[index][0] == indent and not lines[index][1].startswith("-"):
        pair = _split_key(lines[index][1])
        if not pair:
            raise MuseError(f"无法解析的 YAML 行：{lines[index][1]}")
        key, rest = pair
        index += 1
        if rest:
            result[key] = _scalar(rest)
        elif index < len(lines) and (lines[index][0] > indent or (
                lines[index][0] == indent and lines[index][1].startswith("-"))):
            result[key], index = _block(lines, index, lines[index][0])
        else:
            result[key] = None
    return result, index


def _list(lines, index, indent):
    result = []
    while index < len(lines) and lines[index][0] == indent and lines[index][1].startswith("-"):
        item = lines[index][1][1:].strip()
        index += 1
        if not item:
            value, index = _block(lines, index, lines[index][0])
            result.append(value)
        elif _split_key(item) and not item.startswith(("[", '"', "'")):
            key, rest = _split_key(item)
            entry = {}
            child = indent + 2
            if rest:
                entry[key] = _scalar(rest)
            elif index < len(lines) and lines[index][0] > child:
                entry[key], index = _block(lines, index, lines[index][0])
            else:
                entry[key] = None
            if index < len(lines) and lines[index][0] == child:
                entry, index = _map(lines, index, child, entry)
            result.append(entry)
        else:
            result.append(_scalar(item))
    return result, index


def frontmatter(path: Path):
    text = path.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---(?:\n|$)", text, re.S)
    if not match:
        raise MuseError(f"{path.name} 缺少 frontmatter")
    return load_yaml(match.group(1)) or {}, text[match.end():]


def sections(body: str, level: int = 2) -> dict[str, str]:
    marker = "#" * level + " "
    found, current, buffer = {}, None, []
    for line in body.splitlines():
        if line.startswith(marker) and not line.startswith(marker + "#"):
            if current is not None:
                found[current] = "\n".join(buffer).strip()
            current, buffer = line[len(marker):].strip(), []
        elif current is not None:
            buffer.append(line)
    if current is not None:
        found[current] = "\n".join(buffer).strip()
    return found


# ---------------------------------------------------------------- 库

class Library:
    def __init__(self):
        self.seeds, self.seed_paths = {}, {}
        for path in sorted(SEEDS.glob("*/*.md")):
            meta, body = frontmatter(path)
            meta["_body"] = body
            self.seeds[meta.get("id")] = meta
            self.seed_paths[meta.get("id")] = path
        self.templates = {}
        for path in sorted(TEMPLATES.glob("*.md")):
            self.templates[path.stem] = self.load_template(path)
        self.fonts = {font["family"]: font for font in (load_yaml(FONTS.read_text(encoding="utf-8")) or {}).get("fonts", [])}
        self.precedents = {entry["id"]: entry for entry in json.loads((PRECEDENTS / "index.json").read_text(encoding="utf-8"))}

    @staticmethod
    def load_template(path: Path):
        meta, body = frontmatter(path)
        meta["_body"], meta["_path"] = body, path
        return meta

    def seed(self, ref, template=None):
        """Seed 引用可以是库内 id，也可以是相对 Template 文件的 .md 路径（用户 Seed）。"""
        if isinstance(ref, str) and ref.endswith(".md"):
            base = template["_path"].parent if template and template.get("_path") else Path.cwd()
            path = (base / ref).resolve()
            if not path.exists():
                return None
            meta, body = frontmatter(path)
            meta["_body"] = body
            return meta
        return self.seeds.get(ref)

    def template(self, ref: str):
        path = Path(ref)
        if path.suffix == ".md" and path.exists():
            return self.load_template(path.resolve())
        if ref in self.templates:
            return self.templates[ref]
        raise MuseError(f"找不到 template：{ref}（可用：{', '.join(self.templates) or '无'}）")


def seed_points(seed) -> str:
    return sections(seed["_body"]).get("要点", "")


def template_tokens(lib: Library, template, scene: str | None, variant: str | None):
    """合并 Seed 的值，依次应用颜色变体与场景覆盖值。返回 (值, 角色, 所属类别)。"""
    values, roles, owner = {}, {}, {}
    for category, seed_id in (template.get("seeds") or {}).items():
        seed = lib.seed(seed_id, template)
        if not seed:
            raise MuseError(f"template 引用了不存在的 seed：{seed_id}")
        for name, token in (seed.get("tokens") or {}).items():
            if name in values:
                raise MuseError(f"token {name} 同时来自 {owner[name]} 和 {category}")
            values[name] = token.get("value") if isinstance(token, dict) else token
            roles[name] = token.get("role", "") if isinstance(token, dict) else ""
            owner[name] = category
    variants = template.get("variants") or {}
    variant = variant or variants.get("default")
    if variant:
        if variant not in (variants.get("options") or []):
            raise MuseError(f"没有变体 {variant}（可用：{', '.join(variants.get('options') or [])}）")
        color = lib.seed(template["seeds"]["color"], template)
        values.update((color.get("variants") or {}).get(variant) or {})
    if scene:
        for name, value in ((template.get("overrides") or {}).get(scene) or {}).items():
            if name == "breakpoints":
                continue
            if name not in values:
                raise MuseError(f"场景覆盖值 {name} 不对应任何 token")
            values[name] = value
    derived = column_width(values)
    if derived is not None:
        values["column-width"] = f"{round(derived, 2):g}px"
        roles["column-width"] = "推导值：参照画布下单栏的宽度"
        owner["column-width"] = "grid"
    return values, roles, owner, variant


def scene_breakpoints(template, scene: str | None, values) -> dict[str, dict]:
    """返回 {断点名: {"max-width": ..., "tokens": {名: 值}}}，token 必须已存在于场景值中。"""
    found = {}
    raw = ((template.get("overrides") or {}).get(scene) or {}).get("breakpoints") or {} if scene else {}
    for name, entry in raw.items():
        entry = dict(entry or {})
        width = entry.pop("max-width", None)
        if not isinstance(width, str) or not re.fullmatch(r"\d+px", width):
            raise MuseError(f"断点 {name} 需要形如 767px 的 max-width")
        for token in entry:
            if token not in values or token == "column-width":
                raise MuseError(f"断点 {name} 的覆盖值 {token} 不对应任何 token")
        found[name] = {"max-width": width, "tokens": entry}
    return found


def px(value) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    match = re.fullmatch(r"(-?\d+(?:\.\d+)?)px", str(value))
    return float(match.group(1)) if match else None


def em(value) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    match = re.fullmatch(r"(-?\d+(?:\.\d+)?)(?:em)?", str(value))
    return float(match.group(1)) if match else None


def default_tracking(values) -> float:
    """fit 按全角汉字计算，所以优先取中文展示字距。"""
    for name in ("tracking-display-cjk", "tracking-display"):
        if name in values:
            value = em(values[name])
            if value is None:
                raise MuseError(f"{name} 必须以 em 为单位：{values[name]}")
            return value
    return 0.0


def column_width(values) -> float | None:
    canvas, margin, gutter = px(values.get("canvas-width")), px(values.get("margin")), px(values.get("gutter"))
    columns = values.get("columns")
    if None in (canvas, margin, gutter) or not isinstance(columns, int) or columns < 1:
        return None
    return (canvas - 2 * margin - (columns - 1) * gutter) / columns


def ratio_problems(values, label: str) -> list[str]:
    """按 scale-contrast 的比例检查展示层级；没有比例 token 时不检查。"""
    problems = []
    sizes = {name: px(values.get(f"size-{name}")) for name in ("display", "headline", "title", "body")}
    adjacent, display = values.get("ratio-adjacent"), values.get("ratio-display")
    if isinstance(adjacent, (int, float)):
        for big, small in (("display", "headline"), ("headline", "title")):
            if sizes[big] and sizes[small] and sizes[big] / sizes[small] < adjacent - 1e-9:
                problems.append(f"{label}：size-{big}/size-{small} = {sizes[big] / sizes[small]:.2f}，低于 ratio-adjacent {adjacent}")
    if isinstance(display, (int, float)) and sizes["display"] and sizes["body"]:
        if sizes["display"] / sizes["body"] < display - 1e-9:
            problems.append(f"{label}：size-display/size-body = {sizes['display'] / sizes['body']:.2f}，低于 ratio-display {display}")
    return problems


def spacing_problems(values, label: str) -> list[str]:
    scale = values.get("space-scale")
    if not isinstance(scale, list):
        return []
    problems = []
    for name in ("margin", "gutter"):
        size = px(values.get(name))
        if size is not None and size not in scale:
            problems.append(f"{label}：{name} {values.get(name)} 不在间距阶梯 {scale} 中")
    return problems


def text_pairs(lib: Library, template, values) -> list[tuple[str, str, float, str]]:
    color = lib.seed(template["seeds"]["color"], template)
    rows = []
    for fg, bg, level in color.get("pairs") or []:
        rows.append((fg, bg, contrast(values[fg], values[bg]), level))
    return rows


def font_stack(lib: Library, family: str, cjk: str | None) -> list[str]:
    stack = [family]
    if cjk and cjk != family:
        stack.append(cjk)
    for name in (lib.fonts.get(family) or {}).get("fallback", []) + (
            (lib.fonts.get(cjk) or {}).get("fallback", []) if cjk else []):
        if name not in stack:
            stack.append(name)
    generic = [name for name in stack if name in ("sans-serif", "serif", "monospace")]
    return [name for name in stack if name not in generic] + generic[:1]


def css_value(value) -> str:
    return "0" if value == 0 else str(value)


def css_variables(lib: Library, values, owner) -> list[str]:
    lines = []
    cjk = values.get("font-cjk")
    for name, value in values.items():
        if name.startswith("font-"):
            stack = font_stack(lib, value, None if name == "font-cjk" else cjk)
            rendered = ", ".join(item if item in ("sans-serif", "serif", "monospace") else f'"{item}"' for item in stack)
            lines.append(f"  --{name}: {rendered};")
        elif isinstance(value, list):
            for position, item in enumerate(value, 1):
                lines.append(f"  --{name.removesuffix('-scale')}-{position}: {item}px;")
        else:
            prefix = "color-" if owner.get(name) == "color" else ""
            lines.append(f"  --{prefix}{name}: {css_value(value)};")
    return lines


def used_fonts(lib: Library, values):
    families = []
    for name, value in values.items():
        if name.startswith("font-") and value not in families:
            families.append(value)
    return [lib.fonts[family] for family in families if family in lib.fonts]


# ---------------------------------------------------------------- 命令

def cmd_list(args, lib: Library):
    if args.what == "templates":
        for template in lib.templates.values():
            if args.scene and args.scene not in template.get("scenes", []):
                continue
            print(f"{template['id']}  {template['name']}  [{template['status']}]  场景：{', '.join(template.get('scenes', []))}")
    elif args.what == "seeds":
        for seed in lib.seeds.values():
            if args.category and seed["category"] != args.category:
                continue
            print(f"{seed['category']}/{seed['id']}  {seed['name']}  [{seed['nature']}, {seed['status']}]")
    elif args.what == "fonts":
        for font in lib.fonts.values():
            print(f"{font['family']}  [{font['kind']}]  {', '.join(font.get('scripts', []))}")
    else:
        for entry in lib.precedents.values():
            print(f"{entry['id']}  {entry['category']}  —  {entry['gist'][:90]}")


def cmd_search(args, lib: Library):
    words = [word.lower() for word in args.words]
    pool = lib.seeds.values() if args.seeds else lib.templates.values()
    results = []
    for item in pool:
        if args.scene and args.scene not in item.get("scenes", []):
            continue
        # 名称与气质词是策展人写下的定位，命中权重高于正文里的偶然出现。
        label = " ".join([item.get("name", ""), item.get("name_en", ""), item.get("family", ""),
                          " ".join(map(str, item.get("mood", []) + item.get("affinity", [])))]).lower()
        body = item["_body"].lower()
        hits = [word for word in words if word in label or word in body]
        if words and not hits:
            continue
        score = sum(3 if word in label else 1 for word in hits)
        verified = item.get("status") == "verified"
        results.append((score, verified, item, hits))
    results.sort(key=lambda row: (row[0], row[1]), reverse=True)
    if not results:
        print("无命中：换用风格名、气质词或去掉场景限制再试。")
        return
    for count, _, item, hits in results[: args.n]:
        label = f"{item['category']}/{item['id']}" if args.seeds else item["id"]
        line = f"{label}  {item['name']}  [{item.get('status')}]"
        if not args.seeds and args.scene:
            has = args.scene in sections(sections(item["_body"]).get("场景适配", ""), 3)
            line += f"  {args.scene} 适配：{'有' if has else '缺失，需推导'}"
        if not args.seeds:
            specimen = TEMPLATES / f"{item['id']}.png"
            line += f"  样张：{specimen.relative_to(SKILL) if specimen.exists() else '无'}"
        print(line)
        if hits:
            print(f"    命中：{', '.join(hits)}")


def cmd_show(args, lib: Library):
    ref = args.ref
    if ref in lib.templates:
        print(lib.templates[ref]["_path"].read_text(encoding="utf-8"), end="")
    elif ref in lib.seeds:
        print(lib.seed_paths[ref].read_text(encoding="utf-8"), end="")
    elif ref in lib.precedents:
        print((PRECEDENTS / lib.precedents[ref]["file"]).read_text(encoding="utf-8"), end="")
    elif ref in lib.fonts:
        print(json.dumps(lib.fonts[ref], ensure_ascii=False, indent=2))
    else:
        raise MuseError(f"找不到 {ref}：可以是 template、seed、precedent 的 id 或字体名")


def cmd_resolve(args, lib: Library):
    if args.scene not in SCENES:
        raise MuseError(f"未知场景 {args.scene}（可用：{', '.join(SCENES)}）")
    template = lib.template(args.template)
    if args.scene not in template.get("scenes", []):
        raise MuseError(f"{template['id']} 没有声明适用于 {args.scene}")
    values, roles, owner, variant = template_tokens(lib, template, args.scene, args.variant)
    parts = sections(template["_body"])
    adaptation = sections(parts.get("场景适配", ""), 3).get(args.scene)
    out = ["---", f"template: {template['id']}", f"name: {template['name']}",
           f"variant: {variant or 'none'}", f"scene: {args.scene}", f"status: {template['status']}",
           f"source: {template.get('source', 'library')}",
           f"adaptation: {'provided' if adaptation else 'missing'}", "tokens:"]
    for name, value in values.items():
        out.append(f"  {name}: {json.dumps(value, ensure_ascii=False)}")
    breakpoints = scene_breakpoints(template, args.scene, values)
    if breakpoints:
        out.append("breakpoints:")
        for name, entry in breakpoints.items():
            out += [f"  {name}:", f"    max-width: {entry['max-width']}"]
            out += [f"    {token}: {json.dumps(value, ensure_ascii=False)}" for token, value in entry["tokens"].items()]
    out += ["---", "", f"# 风格：{template['name']} · {args.scene}", "", "## 来源与状态", ""]
    out.append(f"- Template `{template['id']}`，来源 {template.get('source', 'library')}，状态 {template['status']}，变体 {variant or '无'}。")
    if template["status"] != "verified":
        out.append("- 这个风格尚未通过人工确认，交付时说明它是 draft。")
    css = ["```css", ":root {", *css_variables(lib, values, owner), "}"]
    for name, entry in breakpoints.items():
        if not entry["tokens"]:
            css.append(f"/* {name}：max-width {entry['max-width']}，只调整版面，没有 token 变化 */")
            continue
        css += [f"/* {name} */", f"@media (max-width: {entry['max-width']}) {{", "  :root {"]
        css += ["  " + line for line in css_variables(lib, entry["tokens"], owner)]
        css += ["  }", "}"]
    out += ["", "## Tokens", "", *css, "```", ""]
    out += ["| token | 角色 |", "| --- | --- |"]
    out += [f"| `{name}` | {role} |" for name, role in roles.items() if role]
    out += ["", "## 文字配对", "", "文字只能按下表放在对应背景上。大字指不小于 24px，或不小于 18.7px 的粗体。", "",
            "| 文字 | 背景 | 对比 | 可用字号 |", "| --- | --- | --- | --- |"]
    for fg, bg, ratio, level in text_pairs(lib, template, values):
        out.append(f"| `{fg}` | `{bg}` | {ratio:.2f}:1 | {'任意字号' if level == 'body' else '仅大字'} |")
    out += ["", "未列出的组合不要使用。", "", "## 字体", ""]
    for font in used_fonts(lib, values):
        links = f"网页加载 {font['css']}" if font.get("css") else "无网页加载地址，本地安装使用"
        out.append(f"- {font['family']}（{font.get('license', font['kind'])}）：{links}；下载 {font.get('download', '无')}。")
    out += ["", "## 文法", "", parts.get("文法", ""), "", "## 本场景适配", ""]
    out.append(adaptation or f"未验证适配：本风格没有为 {args.scene} 写过适配。由 Workflow 按上面的文法推导，并在交付时说明推导了哪些决定。")
    out += ["", "## Seed 要点", ""]
    for category, seed_id in template["seeds"].items():
        seed = lib.seed(seed_id, template)
        out += [f"### {seed['name']}（{category}）", "", seed_points(seed), ""]
        boundary = sections(seed["_body"]).get("适用与边界")
        if boundary:
            out += ["**适用与边界**：" + boundary.replace("\n", " "), ""]
    out += ["## 常见误用", "", parts.get("常见误用", "无。"), "", "## 范例", ""]
    if parts.get("范例"):
        out += [parts["范例"], ""]
    shown = [e for e in template.get("exemplars") or [] if e in lib.precedents]
    if shown:
        out.append("原始记录：" + "、".join(f"`muse.py show {e}`" for e in shown) + "。只借方法，不搬运内容、文案、品牌和图片。")
    example = (template.get("examples") or {}).get(args.scene)
    if example:
        out += ["", f"制作示例：插件内的 `{example}` 记录了这个风格在本场景的一次完整制作，包括 Brief、栏位决定、评审发现与修正。学判断过程，不照搬构图。"]
    text = "\n".join(out).rstrip() + "\n"
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
        print(f"已写入 {args.out}")
    else:
        print(text, end="")


def conflicts_between(a, b) -> bool:
    banned = set(a.get("conflicts") or [])
    return b["id"] in banned or bool(banned & set(b.get("affinity") or []))


def cmd_compose(args, lib: Library):
    chosen = []
    for seed_id in [item.strip() for item in args.seeds.split(",") if item.strip()]:
        if seed_id not in lib.seeds:
            raise MuseError(f"找不到 seed：{seed_id}")
        chosen.append(lib.seeds[seed_id])
    by_category = {}
    for seed in chosen:
        if seed["category"] in by_category:
            raise MuseError(f"{seed['category']} 类别出现了两个 seed：{by_category[seed['category']]['id']}、{seed['id']}")
        by_category[seed["category"]] = seed
    missing = [category for category in REQUIRED_CATEGORIES if category not in by_category]
    if missing:
        raise MuseError(f"缺少必需类别：{', '.join(missing)}")
    clashes = [f"{a['id']} × {b['id']}" for i, a in enumerate(chosen) for b in chosen[i + 1:]
               if conflicts_between(a, b) or conflicts_between(b, a)]
    if clashes:
        sys.stderr.write("musepool: 这些 seed 互相声明了冲突，不能组合：" + "；".join(clashes) + "\n")
        return 3
    for seed in chosen:
        if args.family not in (seed.get("affinity") or []):
            sys.stderr.write(f"警告：{seed['id']} 没有声明与 {args.family} 的亲和关系，组合前写明采用它的理由。\n")
    scenes = [scene for scene in SCENES if all(scene in seed.get("scenes", []) for seed in chosen)]
    color = by_category["color"]
    options = list((color.get("variants") or {}).keys())
    out = ["---", f"id: {args.id}", "kind: template", f"name: {args.name}", f"family: {args.family}",
           "status: draft", "source: composed", f"scenes: [{', '.join(scenes)}]", "mood: []", "seeds:"]
    out += [f"  {category}: {seed['id']}" for category, seed in by_category.items()]
    if options:
        out += ["variants:", f"  default: {options[0]}", f"  options: [{', '.join(options)}]"]
    out += ["exemplars: []", "---", "", f"# {args.name}", "", "## 精神", "",
            "（混搭：写一段话，说明这组 Seed 合起来要解决什么阅读问题。）", "", "## 文法", ""]
    for seed in chosen:
        out += [f"- **{seed['name']}**：", seed_points(seed), ""]
    out += ["## 场景适配", "", "## 常见误用", "", "（写出这组组合最容易退化成的样子。）", "", "## 范例", ""]
    text = "\n".join(out).rstrip() + "\n"
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
        print(f"已写入 {args.out}（draft，补写精神、文法与常见误用后再 resolve）")
    else:
        print(text, end="")
    return 0


def specimen_html(lib: Library, template, variant: str | None) -> str:
    values, roles, owner, variant = template_tokens(lib, template, None, variant)
    color = lib.seed(template["seeds"]["color"], template)
    pairs = []
    for fg, bg, level in color.get("pairs") or []:
        ratio = contrast(values[fg], values[bg])
        pairs.append({"fg": fg, "bg": bg, "level": level, "ratio": round(ratio, 2), "pass": ratio >= LEVELS[level]})
    data = {
        "id": template["id"], "name": template["name"], "name_en": template.get("name_en", ""),
        "status": template["status"], "variant": variant,
        "colors": [{"name": n, "value": v, "role": roles.get(n, "")} for n, v in values.items() if owner[n] == "color"],
        "type": [{"name": n, "value": v} for n, v in values.items() if n.startswith("size-")],
        "fonts": [{"family": f["family"], "license": f.get("license", f["kind"])} for f in used_fonts(lib, values)],
        "space": values.get("space-scale", []), "columns": values.get("columns", 12),
        "pairs": pairs,
        "rules": [{"name": seed["name"], "category": c, "points": seed_points(seed)}
                  for c, seed in ((c, lib.seed(s, template)) for c, s in template["seeds"].items())
                  if seed["nature"] == "rule"],
    }
    links = "\n".join(f'<link rel="stylesheet" href="{f["css"]}">' for f in used_fonts(lib, values) if f.get("css"))
    css = "\n".join(css_variables(lib, values, owner))
    page = SPECIMEN.read_text(encoding="utf-8")
    return (page.replace("__FONT_LINKS__", links).replace("__CSS_VARS__", css)
            .replace("__SPEC__", json.dumps(data, ensure_ascii=False).replace("</", "<\\/")))


def cmd_fit(args, lib: Library):
    template = lib.template(args.template)
    values = template_tokens(lib, template, args.scene, None)[0]
    if args.breakpoint:
        values = {**values, **scene_breakpoints(template, args.scene, values)[args.breakpoint]["tokens"]}
    columns, margin, gutter = values.get("columns"), px(values.get("margin")), px(values.get("gutter"))
    if not isinstance(columns, int) or margin is None or gutter is None:
        raise MuseError("需要 columns、margin、gutter 三个 token")
    if args.chars < 1:
        raise MuseError("--chars 必须大于 0")
    # 字块长度 = 字号 × (字数 + (字数 - 1) × 字距)，字距以 em 计。
    tracking = args.tracking if args.tracking is not None else default_tracking(values)
    units = args.chars + (args.chars - 1) * tracking
    note = f"字数 {args.chars}，字距 {tracking:g}em，内边距 {args.padding:g}px（按全角汉字等宽计算；西文需要在浏览器里实测宽度）"
    if args.vertical:
        height = px(values.get("canvas-height"))
        if height is None:
            raise MuseError("竖排需要 canvas-height token")
        length = height - 2 * margin - 2 * args.padding
        print(f"{note}，竖排")
        print(f"参照画布高 {height:g}px：可用长度 {length:g}px，展示字号 {length / units:.1f}px（参照值 {values.get('size-display')}）")
        print("竖排字块的长度通常取可用长度的一半到三分之二，按构图把结果乘以相应比例。")
        return
    if not 1 <= args.span <= columns:
        raise MuseError(f"--span 必须在 1 到 {columns} 之间")
    print(f"{note}，跨 {args.span}/{columns} 栏")
    canvas = px(values.get("canvas-width"))
    if canvas is not None and not args.breakpoint:
        width = args.span * column_width(values) + (args.span - 1) * gutter - 2 * args.padding
        print(f"参照画布 {canvas:g}px：可用宽度 {round(width, 1):g}px，展示字号 {width / units:.1f}px（参照值 {values.get('size-display')}）")
    viewport = f"min(100vw, {canvas:g}px)" if canvas is not None and not args.breakpoint else "100vw"
    if args.span == columns:
        span = f"{viewport} - {2 * margin:g}px"
    else:
        span = f"({viewport} - {2 * margin:g}px - {columns - 1} * {gutter:g}px) / {columns} * {args.span} + {args.span - 1} * {gutter:g}px"
    if args.padding:
        span = f"{span} - {2 * args.padding:g}px"
    print(f"流式表达式：calc(({span}) / {units:g})")
    print("适配要求跨满栏时以这个结果为准，它可以超过参照值；标题设为不换行；汉字墨迹比字身略窄，对齐强左轴时按浏览器实测的墨迹边界微调。")


def cmd_specimen(args, lib: Library):
    template = lib.template(args.template)
    Path(args.out).write_text(specimen_html(lib, template, args.variant), encoding="utf-8")
    print(f"已写入 {args.out}")


# ---------------------------------------------------------------- 检查

def luminance(hex_color: str) -> float:
    value = hex_color.lstrip("#")
    channels = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast(a: str, b: str) -> float:
    high, low = sorted((luminance(a), luminance(b)), reverse=True)
    return (high + 0.05) / (low + 0.05)


def check_fonts(lib: Library, errors: list[str]):
    for family, font in lib.fonts.items():
        kind = font.get("kind")
        where = f"fonts.yaml {family}"
        if kind not in ("open", "commercial", "system"):
            errors.append(f"{where}：kind 必须是 open、commercial 或 system")
            continue
        if not font.get("scripts"):
            errors.append(f"{where}：缺少 scripts")
        if kind == "open":
            for field in ("license", "official", "download", "fallback"):
                if not font.get(field):
                    errors.append(f"{where}：开源字体缺少 {field}")
        if kind == "commercial":
            alternatives = font.get("alternatives") or []
            if not alternatives:
                errors.append(f"{where}：版权字体必须给出开源替代")
            for alt in alternatives:
                target = lib.fonts.get(alt.get("family"))
                if not target or target.get("kind") != "open":
                    errors.append(f"{where}：替代 {alt.get('family')} 不是已登记的开源字体")
                if not alt.get("note"):
                    errors.append(f"{where}：替代 {alt.get('family')} 缺少差异说明")
        for url in font_urls(font):
            if not url.startswith("https://"):
                errors.append(f"{where}：链接必须使用 https：{url}")


def font_urls(font) -> list[str]:
    return [u for u in [font.get("official"), font.get("download"), font.get("css"), *(font.get("mirrors") or [])] if u]


def check_seed(lib: Library, seed, path: Path | None, errors: list[str]):
    where = f"seed {seed.get('id')}"
    for field in ("id", "category", "nature", "name", "status", "scenes"):
        if not seed.get(field):
            errors.append(f"{where}：缺少 {field}")
    category = seed.get("category")
    if category not in CATEGORIES:
        errors.append(f"{where}：未知类别 {category}")
    if seed.get("nature") not in ("value", "rule"):
        errors.append(f"{where}：nature 必须是 value 或 rule")
    if seed.get("status") not in STATUSES:
        errors.append(f"{where}：status 必须是 draft 或 verified")
    if any(scene not in SCENES for scene in seed.get("scenes") or []):
        errors.append(f"{where}：scenes 含未知场景")
    if path is not None and (path.parent.name != category or path.stem != seed.get("id")):
        errors.append(f"{where}：文件应位于 seeds/{category}/{seed.get('id')}.md")
    if "要点" not in sections(seed.get("_body", "")):
        errors.append(f"{where}：正文缺少「## 要点」")
    tokens = seed.get("tokens") or {}
    for name, token in tokens.items():
        if not isinstance(token, dict) or "value" not in token:
            errors.append(f"{where}：token {name} 缺少 value")
    for name in REQUIRED_TOKENS.get(category, ()):
        if name not in tokens:
            errors.append(f"{where}：{category} seed 必须定义 {name}")
    if category == "typography":
        for name, token in tokens.items():
            if not name.startswith("font-"):
                continue
            font = lib.fonts.get(token.get("value"))
            if not font:
                errors.append(f"{where}：{name} 使用了未登记的字体 {token.get('value')}")
            elif font.get("kind") != "open":
                errors.append(f"{where}：{name} 只能使用开源字体，{font['family']} 是 {font['kind']}")
        weights = {name: t.get("value") for name, t in tokens.items() if name.startswith("weight-") and isinstance(t, dict)}
        for name, token in tokens.items():
            if not name.startswith("font-") or not isinstance(token, dict):
                continue
            css = (lib.fonts.get(token.get("value")) or {}).get("css") or ""
            loaded = css_weights(css)
            if not loaded:
                continue
            needed = {
                "font-display": {weights.get("weight-display")},
                "font-text": {weights.get("weight-text"), weights.get("weight-strong")},
                "font-mono": {weights.get("weight-text")},
            }.get(name, set(weights.values()))
            missing = sorted(w for w in needed if isinstance(w, int) and w not in loaded)
            if missing:
                errors.append(f"{where}：{name}（{token.get('value')}）的加载地址缺少字重 {', '.join(map(str, missing))}")
        cjk = lib.fonts.get((tokens.get("font-cjk") or {}).get("value"))
        if cjk and not any(script.startswith("han") for script in cjk.get("scripts", [])):
            errors.append(f"{where}：font-cjk 不覆盖汉字")
        if seed.get("archetype") and seed["archetype"] not in lib.fonts:
            errors.append(f"{where}：原型字体 {seed['archetype']} 未登记")
    if category == "color":
        palettes = {"default": {n: t["value"] for n, t in tokens.items() if isinstance(t, dict)}}
        for variant, change in (seed.get("variants") or {}).items():
            unknown = [name for name in change if name not in tokens]
            if unknown:
                errors.append(f"{where}：变体 {variant} 改写了不存在的 token {', '.join(unknown)}")
            palettes[variant] = {**palettes["default"], **change}
        for variant, palette in palettes.items():
            for pair in seed.get("pairs") or []:
                fg, bg, level = pair
                if fg not in palette or bg not in palette or level not in LEVELS:
                    errors.append(f"{where}：对比配对 {pair} 无效")
                    continue
                ratio = contrast(palette[fg], palette[bg])
                if ratio < LEVELS[level]:
                    errors.append(f"{where}：{variant} 中 {fg}/{bg} 对比 {ratio:.2f} 低于 {level} 要求 {LEVELS[level]}")


def css_weights(css: str) -> set[int]:
    """读取 Google Fonts 地址里的字重，支持 wght@400;700、ital,wght@0,400;1,400 与 100..900 范围。"""
    match = re.search(r"wght@([\d;,.]+)", css)
    if not match:
        return set()
    weights = set()
    for part in match.group(1).split(";"):
        value = part.split(",")[-1]
        if ".." in value:
            low, high = (int(x) for x in value.split(".."))
            weights.update(range(low, high + 1, 100))
        elif value:
            weights.add(int(value))
    return weights


def check_template(lib: Library, template, errors: list[str]):
    where = f"template {template.get('id')}"
    for field in ("id", "name", "family", "status", "scenes", "seeds"):
        if not template.get(field):
            errors.append(f"{where}：缺少 {field}")
    if template.get("kind") != "template":
        errors.append(f"{where}：kind 必须是 template")
    if template.get("status") not in STATUSES:
        errors.append(f"{where}：status 必须是 draft 或 verified")
    if template.get("source", "library") not in SOURCES:
        errors.append(f"{where}：source 必须是 library、user 或 composed")
    seeds = template.get("seeds") or {}
    for category in REQUIRED_CATEGORIES:
        if category not in seeds:
            errors.append(f"{where}：缺少必需类别 {category}")
    for category, seed_id in seeds.items():
        seed = lib.seed(seed_id, template)
        if not seed:
            errors.append(f"{where}：引用了不存在的 seed {seed_id}")
        elif seed.get("category") != category:
            errors.append(f"{where}：{seed_id} 属于 {seed.get('category')}，不能放在 {category}")
    loaded = [seed for seed in (lib.seed(ref, template) for ref in seeds.values()) if seed]
    for i, a in enumerate(loaded):
        for b in loaded[i + 1:]:
            if conflicts_between(a, b) or conflicts_between(b, a):
                errors.append(f"{where}：{a['id']} 与 {b['id']} 互相冲突")
    if any(scene not in SCENES for scene in template.get("scenes") or []):
        errors.append(f"{where}：scenes 含未知场景")
    for scene in (template.get("overrides") or {}):
        if scene not in SCENES:
            errors.append(f"{where}：overrides 含未知场景 {scene}")
    parts = sections(template.get("_body", ""))
    for heading in ("精神", "文法"):
        if heading not in parts:
            errors.append(f"{where}：正文缺少「## {heading}」")
    for exemplar in template.get("exemplars") or []:
        if exemplar not in lib.precedents:
            errors.append(f"{where}：范例 {exemplar} 不存在")
    examples = template.get("examples") or {}
    if not isinstance(examples, dict):
        errors.append(f"{where}：examples 必须是场景到制作示例路径的映射")
        examples = {}
    for scene, path in examples.items():
        if scene not in (template.get("scenes") or []):
            errors.append(f"{where}：examples 的场景 {scene} 不在 scenes 里")
        target = (PLUGIN / str(path)).resolve()
        if PLUGIN.resolve() not in target.parents or target.suffix != ".md" or not target.is_file():
            errors.append(f"{where}：制作示例 {path} 不是插件内存在的 Markdown 文件")
    if all(lib.seed(seed_id, template) for seed_id in seeds.values()):
        try:
            variants = template.get("variants") or {}
            for variant in variants.get("options") or [None]:
                for scene in [None, *(template.get("overrides") or {})]:
                    values = template_tokens(lib, template, scene, variant)[0]
                    if variant == (variants.get("options") or [None])[0]:
                        errors += [f"{where}：{p}" for p in ratio_problems(values, scene or "基础值")]
                        errors += [f"{where}：{p}" for p in spacing_problems(values, scene or "基础值")]
                        for name, entry in scene_breakpoints(template, scene, values).items():
                            merged = {**values, **entry["tokens"]}
                            errors += [f"{where}：{p}" for p in ratio_problems(merged, f"{scene}/{name}")]
                            errors += [f"{where}：{p}" for p in spacing_problems(merged, f"{scene}/{name}")]
        except MuseError as error:
            errors.append(f"{where}：{error}")
    if template.get("status") == "verified" and template.get("source", "library") == "library":
        if not (TEMPLATES / f"{template['id']}.png").exists():
            errors.append(f"{where}：verified 的 template 必须附样张 {template['id']}.png")


def check_links(lib: Library) -> list[str]:
    failures = []
    for family, font in lib.fonts.items():
        for url in font_urls(font):
            request = urllib.request.Request(url, headers={"User-Agent": "musepool-check"})
            try:
                with urllib.request.urlopen(request, timeout=20) as response:
                    status = response.status
            except urllib.error.HTTPError as error:
                status = error.code
            except (urllib.error.URLError, TimeoutError) as error:
                failures.append(f"{family}：{url} 无法访问（{error}）")
                continue
            if status >= 400:
                failures.append(f"{family}：{url} 返回 {status}")
    return failures


def cmd_check(args, lib: Library):
    errors: list[str] = []
    if args.paths:
        for raw in args.paths:
            path = Path(raw).resolve()
            meta, body = frontmatter(path)
            meta["_body"], meta["_path"] = body, path
            if meta.get("kind") == "template":
                check_template(lib, meta, errors)
            else:
                check_seed(lib, meta, None, errors)
    else:
        check_fonts(lib, errors)
        for seed_id, seed in lib.seeds.items():
            check_seed(lib, seed, lib.seed_paths[seed_id], errors)
        for template in lib.templates.values():
            if template["_path"].stem != template.get("id"):
                errors.append(f"template {template.get('id')}：文件名应为 {template.get('id')}.md")
            check_template(lib, template, errors)
        for entry in lib.precedents.values():
            if not (PRECEDENTS / entry["file"]).exists():
                errors.append(f"precedent {entry['id']}：缺少文件 {entry['file']}")
    if args.links:
        errors += check_links(lib)
    if errors:
        print("检查未通过：")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    scope = f"{len(args.paths)} 个文件" if args.paths else (
        f"{len(lib.seeds)} 个 seed，{len(lib.templates)} 个 template，{len(lib.fonts)} 个字体")
    print(f"检查通过：{scope}{'，链接均可访问' if args.links else ''}。")
    return 0


def cmd_frontmatter(args, lib: Library):
    path = Path(args.path)
    data = load_yaml(path.read_text(encoding="utf-8")) if path.suffix in (".yaml", ".yml") else frontmatter(path)[0]
    print(json.dumps(data, ensure_ascii=False, indent=2))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="muse.py", description="Musepool 风格库：检索、组合、解析与检查。")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("list", help="列出 template、seed、字体或范例")
    p.add_argument("what", choices=("templates", "seeds", "fonts", "precedents"))
    p.add_argument("--scene", choices=SCENES)
    p.add_argument("--category", choices=CATEGORIES)
    p = sub.add_parser("search", help="按场景与关键词检索 template（或 --seeds 检索 seed）")
    p.add_argument("words", nargs="*")
    p.add_argument("--scene", choices=SCENES)
    p.add_argument("--seeds", action="store_true")
    p.add_argument("-n", type=int, default=5)
    p = sub.add_parser("show", help="查看完整内容")
    p.add_argument("ref")
    p = sub.add_parser("resolve", help="把 template 解析成某个场景的 style.md")
    p.add_argument("template")
    p.add_argument("--scene", required=True)
    p.add_argument("--variant")
    p.add_argument("--out")
    p = sub.add_parser("compose", help="把一组 seed 组合成 draft template")
    p.add_argument("--id", required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--family", required=True)
    p.add_argument("--seeds", required=True)
    p.add_argument("--out")
    p = sub.add_parser("fit", help="按标题字数推导展示字号")
    p.add_argument("template")
    p.add_argument("--scene", required=True, choices=SCENES)
    p.add_argument("--chars", type=int, required=True)
    p.add_argument("--span", type=int, default=0, help="横排时跨几栏")
    p.add_argument("--tracking", type=float, default=None,
                   help="字距，单位 em；默认取 tracking-display-cjk，没有时取 tracking-display")
    p.add_argument("--padding", type=float, default=0.0, help="字块所在容器的左右（竖排时为上下）内边距，单位 px")
    p.add_argument("--vertical", action="store_true", help="竖排：按画布高度推导")
    p.add_argument("--breakpoint")
    p = sub.add_parser("specimen", help="生成样张 HTML")
    p.add_argument("template")
    p.add_argument("--variant")
    p.add_argument("--out", required=True)
    p = sub.add_parser("check", help="机检字体、seed 与 template")
    p.add_argument("paths", nargs="*")
    p.add_argument("--links", action="store_true", help="联网检查字体链接")
    p = sub.add_parser("frontmatter", help="以 JSON 打印 frontmatter 或 YAML 文件")
    p.add_argument("path")
    args = parser.parse_args(argv)
    handlers = {
        "list": cmd_list, "search": cmd_search, "show": cmd_show, "resolve": cmd_resolve,
        "compose": cmd_compose, "fit": cmd_fit, "specimen": cmd_specimen, "check": cmd_check, "frontmatter": cmd_frontmatter,
    }
    try:
        return handlers[args.command](args, Library()) or 0
    except (MuseError, OSError, ValueError) as error:
        sys.stderr.write(f"musepool: {error}\n")
        return 2


if __name__ == "__main__":
    sys.exit(main())
