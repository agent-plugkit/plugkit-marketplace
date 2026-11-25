#!/usr/bin/env python3
"""musepool 风格库工具：只用 Python 标准库，检索与解析完全在本地进行。

  python3 scripts/muse.py list templates|seeds|fonts|precedents [--scene S] [--category C]
  python3 scripts/muse.py search [--scene S] [--seeds] 关键词...
  python3 scripts/muse.py show <template|seed|precedent id 或字体名>
  python3 scripts/muse.py resolve <template id|路径> --scene S [--variant V] [--out style.md]
  python3 scripts/muse.py compose --id ID --name 名称 --family F --seeds a,b,c [--out 路径]
  python3 scripts/muse.py fit <template> --scene S (--chars N | --em W) (--span K | --vertical) [--tracking EM] [--padding L,R] [--border L,R] [--sub-length PX] [--breakpoint B]
  python3 scripts/muse.py specimen <template id|路径> [--variant V] --out specimen.html
  python3 scripts/muse.py check [路径...] [--links]
  python3 scripts/muse.py frontmatter <路径>          # 以 JSON 打印 frontmatter，供调试

字段与命名约定见 references/schema.md。
"""
from __future__ import annotations

import argparse
import itertools
import json
import math
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
THIRD_PARTY = SKILL / "references" / "third-party-notices.md"
SPECIMEN = SKILL / "assets" / "specimen.html"

CATEGORIES = (
    "color", "typography", "grid", "spacing", "shape", "depth", "texture",
    "imagery", "iconography", "motion", "data-encoding", "device", "technique",
)
REQUIRED_CATEGORIES = ("color", "typography", "grid", "spacing")
SCENES = ("graphic", "web", "slides", "diagram", "data")
STATUSES = ("draft", "verified")
SOURCES = ("library", "user", "composed")
MODALITIES = ("web", "design-system", "print")
REQUIRED_TOKENS = {
    "color": ("paper", "ink", "accent"),
    "typography": ("font-display", "font-text", "font-cjk", "size-body"),
}
LEVELS = {"body": 4.5, "large": 3.0}
# 同时有这两个变体的 Template 在 web 场景跟随系统深浅色切换。
SCHEME_VARIANTS = ("light", "dark")


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
        self.precedents = {}
        for path in sorted(PRECEDENTS.glob("*.md")):
            meta, body = frontmatter(path)
            meta["_body"], meta["_path"] = body, path
            self.precedents[meta.get("id")] = meta

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


# 机检：Seed 和 Template 用 checks 声明可量的版式规则，inspect_page.mjs 按声明测量。
# 每种规则：必填的角色参数、可选的角色参数、阈值参数（token 名或数字）、整数参数、可选的颜色 token、可选的布尔开关。
CHECK_SCENES = ("graphic", "web", "slides")
CHECK_KINDS = {
    "seams": {"roles": ("group", "item"), "thresholds": ("max",)},
    "dominant": {"roles": ("group", "item", "main"), "optional_roles": ("exclude",), "thresholds": ("min",)},
    "fill": {"roles": ("text", "box"), "thresholds": ("min",)},
    "covers": {"roles": ("item", "over"), "ints": ("count",), "colors": ("avoid",)},
    "axis": {"roles": ("item",), "optional_roles": ("field",), "thresholds": ("tolerance",)},
    "max-size": {"roles": ("item", "than")},
    "area": {"roles": ("item", "of"), "thresholds": ("min", "max")},
    "scale": {"roles": ("group", "item", "than"), "thresholds": ("min",), "flags": ("optional",)},
}
CHECK_TEXT = {
    "seams": "每面 `{group}` 里相邻两块 `{item}` 的间隙不超过 `{max}`",
    "dominant": "每面 `{group}` 里 `{main}` 的面积至少是其余最大一块 `{item}` 的 `{min}` 倍{exclude}",
    "fill": "`{text}` 的字宽至少是所在 `{box}` 内宽的 `{min}`；在海报、演示文稿的每一页和网页的第一个视口上判定，网页的其他宽度只报数值",
    "covers": "每张 `{item}` 压住 {count} 块 `{over}`{avoid}",
    "axis": "每个 `{item}` 的每一行，中点离中轴不超过版面宽度的 `{tolerance}`{field}",
    "max-size": "`{item}` 的字号不大于 `{than}`",
    "area": "每块 `{item}` 落在所在 `{of}` 里的面积，占 `{of}` 的 `{min}` 到 `{max}`",
    "scale": "每个 `{group}` 里 `{item}` 的字号至少是同组最大的 `{than}` 的 `{min}` 倍；组里没有 `{than}` 时不比较{optional}",
}


def check_rule_problems(rule) -> list[str]:
    """只查规则本身的形状；角色是否声明、token 是否存在由 Template 检查。"""
    if not isinstance(rule, dict):
        return ["每条规则必须是映射"]
    spec = CHECK_KINDS.get(rule.get("kind"))
    if not spec:
        return [f"未知的规则种类 {rule.get('kind')}（可用：{', '.join(CHECK_KINDS)}）"]
    known = {"kind", *spec.get("roles", ()), *spec.get("optional_roles", ()), *spec.get("thresholds", ()),
             *spec.get("ints", ()), *spec.get("colors", ()), *spec.get("flags", ())}
    problems = [f"{rule['kind']} 不认识参数 {key}" for key in rule if key not in known]
    for key in (*spec.get("roles", ()), *spec.get("thresholds", ()), *spec.get("ints", ())):
        if rule.get(key) in (None, ""):
            problems.append(f"{rule['kind']} 缺少参数 {key}")
    for key in spec.get("flags", ()):
        if key in rule and not isinstance(rule[key], bool):
            problems.append(f"{rule['kind']} 的 {key} 必须是 true 或 false")
    for key in spec.get("ints", ()):
        if key in rule and not isinstance(rule[key], int):
            problems.append(f"{rule['kind']} 的 {key} 必须是整数")
    for key in spec.get("thresholds", ()):
        if key in rule and not isinstance(rule[key], (int, float, str)):
            problems.append(f"{rule['kind']} 的 {key} 必须是 token 名或数字")
    return problems


def check_spec_problems(spec) -> list[str]:
    if not isinstance(spec, dict) or not isinstance(spec.get("roles"), dict) or not isinstance(spec.get("rules"), list):
        return ["checks 必须有 roles（角色到说明的映射）和 rules（规则列表）"]
    return [problem for rule in spec["rules"] for problem in check_rule_problems(rule)]


def scene_checks(lib: Library, template, scene: str):
    """合并 Template 各 Seed 的规则和 Template 自己为本场景写的规则。"""
    roles, rules = {}, []
    specs = [(lib.seed(ref, template) or {}).get("checks") for ref in (template.get("seeds") or {}).values()]
    specs.append((template.get("checks") or {}).get(scene))
    for spec in specs:
        if isinstance(spec, dict):
            roles.update(spec.get("roles") or {})
            rules += [rule for rule in spec.get("rules") or [] if isinstance(rule, dict)]
    return roles, rules


def check_section(roles, rules) -> list[str]:
    used = []
    for rule in rules:
        spec = CHECK_KINDS[rule["kind"]]
        for key in (*spec.get("roles", ()), *spec.get("optional_roles", ())):
            if rule.get(key) and rule[key] not in used:
                used.append(rule[key])
    out = ["## 机检", "",
           "跑检查脚本 `inspect_page.mjs` 时，它按下面的规则量版式，并把量到的数值写进摘要，不用再自己写测量代码。"
           "先给元素加 `data-mk` 标记；一个元素可以有多个角色，用空格分开，如 `data-mk=\"panel main\"`。", ""]
    out += [f"- `{role}`：{roles[role]}" for role in used]
    out += ["", "规则："]
    for rule in rules:
        extra = {
            "exclude": f"；`{rule['exclude']}` 不参与比较" if rule.get("exclude") else "",
            "avoid": f"，不压在底色为 `{rule['avoid']}` 的板上" if rule.get("avoid") else "",
            "field": f"；标了 `{rule['field']}` 的元素里以它的中线为轴，其余以画布或视口的中线为轴" if rule.get("field") else "",
            "optional": f"；整件作品没有 `{rule['than']}` 时这条不适用" if rule.get("optional") else "",
        }
        out.append("- " + CHECK_TEXT[rule["kind"]].format_map({**rule, **extra}) + "。")
    out += ["", "```json musekit-checks", json.dumps({"rules": rules}, ensure_ascii=False), "```", ""]
    return out


def follows_system(template) -> bool:
    options = (template.get("variants") or {}).get("options") or []
    return all(name in options for name in SCHEME_VARIANTS)


def template_tokens(lib: Library, template, scene: str | None, variant: str | None):
    """合并 Seed 的值，依次应用变体与场景覆盖值。返回 (值, 角色, 所属类别)。

    变体名来自颜色 Seed；其他 Seed 也可以按同一个变体名改写自己的 token，例如深色下的阴影。"""
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
        for seed_id in template["seeds"].values():
            values.update((lib.seed(seed_id, template).get("variants") or {}).get(variant) or {})
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


def side_pair(raw, option: str) -> tuple[float, float]:
    parts = [part.strip() for part in str(raw).split(",")]
    if len(parts) not in (1, 2):
        raise MuseError(f"{option} 写一个值，或者 左,右 两个值")
    try:
        left, right = float(parts[0]), float(parts[-1])
    except ValueError:
        raise MuseError(f"{option} 不是数字：{raw}") from None
    if not all(math.isfinite(v) and v >= 0 for v in (left, right)):
        raise MuseError(f"{option} 必须是不小于 0 的数")
    return left, right


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
            gist = sections(entry["_body"], level=1).get("Narrative", "").replace("\n", " ")
            print(f"{entry['id']}  {entry['category']}  —  {gist[:90]}")


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
        # 同分时，已经写了本场景适配的风格排在前面：「直接做取第一名」不该取到要推导的那个。
        adapted = bool(args.scene and not args.seeds
                       and args.scene in sections(sections(item["_body"]).get("场景适配", ""), 3))
        results.append((score, adapted, verified, item, hits))
    results.sort(key=lambda row: row[:3], reverse=True)
    if not results:
        print("无命中：换用风格名、气质词或去掉场景限制再试。")
        if not args.seeds:
            moods = dict.fromkeys(str(mood) for item in pool
                                  if not args.scene or args.scene in item.get("scenes", [])
                                  for mood in item.get("mood", []))
            print(f"{args.scene + ' 场景' if args.scene else '库里'}可用的气质词：{'、'.join(moods)}")
        return
    for count, _, _, item, hits in results[: args.n]:
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
        print(lib.precedents[ref]["_path"].read_text(encoding="utf-8"), end="")
    elif ref in lib.fonts:
        print(json.dumps(lib.fonts[ref], ensure_ascii=False, indent=2))
    else:
        raise MuseError(f"找不到 {ref}：可以是 template、seed、precedent 的 id 或字体名")


def data_palette(color, variant):
    """颜色 Seed 在某个变体下的数据色板：变体在 data.variants 里有整组色板时用它，否则用默认色板。"""
    data = (color or {}).get("data")
    if not isinstance(data, dict):
        return data
    by_variant = data.get("variants")
    own = by_variant.get(variant) if isinstance(by_variant, dict) else None
    return own if isinstance(own, dict) else data


def data_note(data, values) -> str:
    """数据色板之后的用法说明：按 accent 对纸面够不够 3:1、是否也是分类色、有没有 ink-muted 来写。"""
    has_muted = "ink-muted" in values
    rest = "`ink-muted`" if has_muted else "`ink` 的浅色调（网点或透明度）"
    text_colors = "`ink` 与 `ink-muted`" if has_muted else "`ink`"
    accent = str(values.get("accent", "")).upper()
    shared = [i for i, color in enumerate(data["categorical"], 1) if color.upper() == accent]
    if accent and contrast(accent, values["paper"]) < 3:
        lead = (f"强调色 `accent` 对纸面不到 3:1：不在分类色里，也不能做线、点和文字，只能做带 `ink` 边框的填充；"
                f"只想突出一项时，用它填充那一项并加边框，其余用 {rest}。")
    elif shared:
        lead = (f"强调色 `accent` 也是分类色的第 {shared[0]} 色：只想突出一项时，用 `accent` 标那一项，其余用 {rest}；"
                "按分类色区分多个序列时，不再另用 `accent` 强调。")
    else:
        lead = f"强调色 `accent` 不在分类色里：只想突出一项时，用 `accent` 标那一项，其余用 {rest}。"
    return f"{lead}数值、刻度、标注和图例的文字用 {text_colors}，不用序列色。"


def cmd_resolve(args, lib: Library):
    if args.scene not in SCENES:
        raise MuseError(f"未知场景 {args.scene}（可用：{', '.join(SCENES)}）")
    template = lib.template(args.template)
    if args.scene not in template.get("scenes", []):
        raise MuseError(f"{template['id']} 没有声明适用于 {args.scene}")
    # web 不指定变体、风格又有浅色和深色两个变体时，跟随系统：:root 取浅色，深色块只写深色改写的值。
    auto = args.scene == "web" and not args.variant and follows_system(template)
    values, roles, owner, variant = template_tokens(lib, template, args.scene, "light" if auto else args.variant)
    dark_values = template_tokens(lib, template, args.scene, "dark")[0] if auto else {}
    dark = {name: value for name, value in dark_values.items() if values.get(name) != value}
    if auto:
        variant = "auto"
    parts = sections(template["_body"])
    adaptation = sections(parts.get("场景适配", ""), 3).get(args.scene)
    out = ["---", f"template: {template['id']}", f"name: {template['name']}",
           f"variant: {variant or 'none'}", f"scene: {args.scene}", f"status: {template['status']}",
           f"source: {template.get('source', 'library')}",
           f"adaptation: {'provided' if adaptation else 'missing'}", "tokens:"]
    for name, value in values.items():
        out.append(f"  {name}: {json.dumps(value, ensure_ascii=False)}")
    if dark:
        out.append("dark:")
        out += [f"  {name}: {json.dumps(value, ensure_ascii=False)}" for name, value in dark.items()]
    data = data_palette(lib.seed(template["seeds"]["color"], template), variant) if args.scene == "data" else None
    if data:
        out.append("data:")
        out += [f"  {kind}: {json.dumps(data[kind])}" for kind in DATA_KINDS]
    breakpoints = scene_breakpoints(template, args.scene, values)
    if breakpoints:
        out.append("breakpoints:")
        for name, entry in breakpoints.items():
            out += [f"  {name}:", f"    max-width: {entry['max-width']}"]
            out += [f"    {token}: {json.dumps(value, ensure_ascii=False)}" for token, value in entry["tokens"].items()]
    out += ["---", "", f"# 风格：{template['name']} · {args.scene}", "", "## 来源与状态", ""]
    shown_variant = "light / dark，跟随系统深浅色切换" if auto else variant or "无"
    out.append(f"- Template `{template['id']}`，来源 {template.get('source', 'library')}，状态 {template['status']}，变体 {shown_variant}。")
    if auto:
        out.append("- 跟随系统深浅色：`:root` 是浅色值，`@media (prefers-color-scheme: dark)` 块改写深色下变化的值（颜色、阴影等）。"
                   "页面的颜色与阴影都从变量取，不写死；只要一种外观时，用 `--variant light` 或 `--variant dark` 重新解析。")
    if template["status"] != "verified":
        out.append("- 这个风格尚未通过人工确认，交付时说明它是 draft。")
    css = ["```css", ":root {"]
    if auto:
        css.append("  color-scheme: light dark;")
    elif variant == "dark" and follows_system(template):
        css.append("  color-scheme: dark;")
    css += css_variables(lib, values, owner)
    if data:
        for kind, short in zip(DATA_KINDS, ("cat", "seq", "div")):
            css += [f"  --data-{short}-{i}: {color};" for i, color in enumerate(data[kind], 1)]
    css.append("}")
    if dark:
        # 写在断点之前：断点改写的值在窄屏上照样生效，和只取一个变体时一致。
        css += ["/* 深色：跟随系统 */", "@media (prefers-color-scheme: dark) {", "  :root {"]
        css += ["  " + line for line in css_variables(lib, dark, owner)]
        css += ["  }", "}"]
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
    out += ["", "## 文字配对", "", "文字只能按下表放在对应背景上。大字指不小于 24px，或不小于 18.7px 的粗体。", ""]
    # 跟随系统时，每组配对在浅色和深色下各列一个对比度。
    schemes = {"浅色对比": values, "深色对比": dark_values} if auto else {"对比": values}
    out += [f"| 文字 | 背景 | {' | '.join(schemes)} | 可用字号 |", "| --- | --- | " + "--- | " * len(schemes) + "--- |"]
    for fg, bg, level in lib.seed(template["seeds"]["color"], template).get("pairs") or []:
        ratios = " | ".join(f"{contrast(scheme[fg], scheme[bg]):.2f}:1" for scheme in schemes.values())
        out.append(f"| `{fg}` | `{bg}` | {ratios} | {'任意字号' if level == 'body' else '仅大字'} |")
    out += ["", "未列出的组合不要使用。", ""]
    if data:
        out += ["## 数据色板", "", "按数据要做的事选一组。颜色按顺序取用，不循环、不跳号；同一序列在各面板里用同一个颜色。", "",
                "| 用途 | 颜色 | 怎么用 |", "| --- | --- | --- |",
                f"| 分类 `categorical` | {'、'.join(data['categorical'])} | 区分序列身份。序列比颜色多时，把小项合并为「其他」或分面，不另造颜色；除颜色外再配直接标注、形状或线型 |",
                f"| 顺序 `sequential` | {'、'.join(data['sequential'])} | 表示多少，由浅到深 |",
                f"| 发散 `diverging` | {'、'.join(data['diverging'])} | 表示偏离基准的方向，中点对应基准值 |", "",
                data_note(data, values), ""]
    out += ["## 字体", ""]
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
        for tool in seed.get("tools") or []:
            out += [f"制作工具：插件内的 `{tool}`，用法写在文件开头。复制进作品目录使用，不要在成品里引用插件路径。", ""]
    if args.scene in CHECK_SCENES:
        check_roles, check_rules = scene_checks(lib, template, args.scene)
        if check_rules:
            out += check_section(check_roles, check_rules)
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
    if (args.chars is None) == (args.em is None):
        raise MuseError("--chars 和 --em 二选一：全是汉字时给字数，中西混排时给浏览器实测的整行宽度")
    if args.em is not None:
        if not (math.isfinite(args.em) and args.em > 0):
            raise MuseError("--em 必须大于 0")
        if args.tracking is not None:
            raise MuseError("--tracking 只用于 --chars；--em 的实测宽度已经含字距")
        units = args.em
    else:
        if args.chars < 1:
            raise MuseError("--chars 必须大于 0")
        # 字块长度 = 字号 × (字数 + (字数 - 1) × 字距)，字距以 em 计。
        tracking = args.tracking if args.tracking is not None else default_tracking(values)
        units = args.chars + (args.chars - 1) * tracking
    sides = ("上", "下") if args.vertical else ("左", "右")

    def side_note(label, pair):
        first, second = pair
        return f"{label} {first:g}px" if first == second else f"{label}{sides[0]} {first:g}px、{sides[1]} {second:g}px"

    padding, border = side_pair(args.padding, "--padding"), side_pair(args.border, "--border")
    insets = sum(padding) + sum(border)
    measure = (f"实测宽 {args.em:g}em" if args.em is not None
               else f"字数 {args.chars}，字距 {tracking:g}em")
    note = (f"{measure}，{side_note('内边距', padding)}"
            + (f"，{side_note('边框', border)}" if any(border) else "")
            + ("" if args.em is not None else "（按全角汉字等宽计算；中西混排时改用 --em）"))
    if args.sub_length is not None and not args.vertical:
        raise MuseError("--sub-length 只用于竖排（--vertical）")
    if args.vertical:
        height = px(values.get("canvas-height"))
        if height is None:
            raise MuseError("竖排需要 canvas-height token")
        sub = args.sub_length or 0
        if not (math.isfinite(sub) and sub >= 0):
            raise MuseError("--sub-length 必须是不小于 0 的数")
        length = height - 2 * margin - insets
        print(f"{note}，竖排" + (f"，同一列里其余文字 {sub:g}px" if sub else ""))
        print(f"参照画布高 {height:g}px：可用长度 {length:g}px，排满时展示字号 {(length - sub) / units:.1f}px（参照值 {values.get('size-display')}）")
        for name, share in (("一半", 1 / 2), ("三分之二", 2 / 3)):
            target = length * share
            size = f"展示字号 {(target - sub) / units:.1f}px" if target > sub else "放不下，同一列里其余文字已经超过这个长度"
            print(f"整列占可用长度的{name}（{target:g}px）：{size}")
        print("整列长度按墨迹量，包括同一列里接在标题后的小字；按构图在这两个字号之间取值。")
        return
    if not 1 <= args.span <= columns:
        raise MuseError(f"--span 必须在 1 到 {columns} 之间")
    print(f"{note}，跨 {args.span}/{columns} 栏")

    def span_width(viewport: float) -> float:
        if args.span == columns:
            return viewport - 2 * margin - insets
        return (viewport - 2 * margin - (columns - 1) * gutter) / columns * args.span + (args.span - 1) * gutter - insets

    canvas = px(values.get("canvas-width"))
    if canvas is not None and not args.breakpoint:
        width = span_width(canvas)
        print(f"参照画布 {canvas:g}px：可用宽度 {round(width, 1):g}px，展示字号 {width / units:.1f}px（参照值 {values.get('size-display')}）")
    # 100cqi 是根容器的内容宽度，不含滚动条；100vw 含滚动条，会让顶满的标题溢出。
    viewport = f"min(100cqi, {canvas:g}px)" if canvas is not None and not args.breakpoint else "100cqi"
    if args.span == columns:
        span = f"{viewport} - {2 * margin:g}px"
    else:
        span = f"({viewport} - {2 * margin:g}px - {columns - 1} * {gutter:g}px) / {columns} * {args.span} + {args.span - 1} * {gutter:g}px"
    if insets:
        span = f"{span} - {insets:g}px"
    print(f"流式表达式：calc(({span}) / {units:g})")
    print("表达式里的 100cqi 需要在标题的祖先上声明 container-type: inline-size；这个祖先要和视口同宽、没有左右内边距（通常是 body，并把 body 的 margin 设为 0），否则外边距会被扣两次。")
    if args.breakpoint:
        edge = px(scene_breakpoints(template, args.scene, values)[args.breakpoint]["max-width"])
        print(f"这个断点的流式字号在断点上沿 {edge:g}px 时为 {span_width(edge) / units:.1f}px，是它的最大值。"
              "它不应大于断点以上的版面在同一宽度的标题字号；大于时用 min(流式表达式, 那个字号) 封顶，避免窗口变窄时标题反而变大。")
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


DATA_KINDS = ("categorical", "sequential", "diverging")
# 色盲模拟：Machado、Oliveira、Fernandes 2009，严重度 1.0，作用在线性 RGB 上。
CVD = {
    "红色盲": ((0.152286, 1.052583, -0.204868), (0.114503, 0.786281, 0.099216), (-0.003882, -0.048116, 1.051998)),
    "绿色盲": ((0.367322, 0.860646, -0.227968), (0.280085, 0.672501, 0.047413), (-0.011820, 0.042940, 0.968881)),
}


def linear_rgb(hex_color: str) -> list[float]:
    value = hex_color.lstrip("#")
    channels = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]


def oklab(rgb) -> tuple[float, float, float]:
    r, g, b = (min(1.0, max(0.0, c)) for c in rgb)
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


def color_distance(a: str, b: str, matrix=None) -> float:
    """两色在 OKLab 中的距离 ×100；给出矩阵时先做色盲模拟。"""
    def lab(hex_color):
        rgb = linear_rgb(hex_color)
        if matrix:
            rgb = [sum(row[i] * rgb[i] for i in range(3)) for row in matrix]
        return oklab(rgb)
    return math.dist(lab(a), lab(b)) * 100


def data_problems(data, paper: str) -> list[str]:
    """数据色板的机检：分类色可辨、顺序色单调、发散色两臂对称且中点中性。"""
    if not isinstance(data, dict) or any(not isinstance(data.get(kind), list) for kind in DATA_KINDS):
        return ["数据色板必须有 categorical、sequential、diverging 三组颜色列表"]
    bad = [c for kind in DATA_KINDS for c in data[kind] if not re.fullmatch(r"#[0-9A-Fa-f]{6}", str(c))]
    if bad:
        return [f"数据色板含无效颜色 {', '.join(map(str, bad))}"]
    problems = []
    categorical, sequential, diverging = (data[kind] for kind in DATA_KINDS)
    if not 3 <= len(categorical) <= 6:
        problems.append("数据色板 categorical 需要 3–6 个颜色")
    for c in categorical:
        if contrast(c, paper) < 3:
            problems.append(f"数据色板 categorical 的 {c} 对纸面只有 {contrast(c, paper):.2f}:1，至少 3:1")
    # 分类色按顺序取用，n 个序列会让前 n 个颜色同框，所以任意两色都要分得开，不只相邻的。
    for a, b in itertools.combinations(categorical, 2):
        if color_distance(a, b) < 15:
            problems.append(f"数据色板 categorical 的 {a} 与 {b} 太接近（ΔE {color_distance(a, b):.1f}，至少 15）")
        for name, matrix in CVD.items():
            if color_distance(a, b, matrix) < 8:
                problems.append(f"数据色板 categorical 的 {a} 与 {b} 在色盲模拟下太接近（{name} ΔE {color_distance(a, b, matrix):.1f}，至少 8）")
    lightness = lambda c: oklab(linear_rgb(c))[0]
    if not 3 <= len(sequential) <= 9:
        problems.append("数据色板 sequential 需要 3–9 个颜色")
    if any(lightness(a) <= lightness(b) for a, b in zip(sequential, sequential[1:])):
        problems.append("数据色板 sequential 必须由浅到深排列")
    elif sequential and contrast(sequential[-1], paper) < 3:
        problems.append(f"数据色板 sequential 最深的 {sequential[-1]} 对纸面不到 3:1")
    if len(diverging) < 5 or len(diverging) % 2 == 0:
        problems.append("数据色板 diverging 必须是奇数个颜色，至少 5 个")
    else:
        half = len(diverging) // 2
        mid = diverging[half]
        _, a, b = oklab(linear_rgb(mid))
        if math.hypot(a, b) > 0.03:
            problems.append(f"数据色板 diverging 的中点必须是中性色，{mid} 带有色相")
        for arm in (diverging[half::-1], diverging[half:]):
            if any(lightness(x) <= lightness(y) for x, y in zip(arm, arm[1:])):
                problems.append("数据色板 diverging 从中点向两端必须逐级变深")
                break
        for end in (diverging[0], diverging[-1]):
            if contrast(end, paper) < 3:
                problems.append(f"数据色板 diverging 端点 {end} 对纸面不到 3:1")
    return problems


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
    tools = seed.get("tools") or []
    if not isinstance(tools, list):
        errors.append(f"{where}：tools 必须是插件 assets/ 内的路径列表")
        tools = []
    assets = (PLUGIN / "assets").resolve()
    for tool in tools:
        target = (PLUGIN / str(tool)).resolve()
        if assets not in target.parents or not target.is_file():
            errors.append(f"{where}：制作工具 {tool} 不是插件 assets/ 里存在的文件")
    if "checks" in seed:
        errors += [f"{where}：{problem}" for problem in check_spec_problems(seed["checks"])]
    tokens = seed.get("tokens") or {}
    for name, token in tokens.items():
        if not isinstance(token, dict) or "value" not in token:
            errors.append(f"{where}：token {name} 缺少 value")
    for name in REQUIRED_TOKENS.get(category, ()):
        if name not in tokens:
            errors.append(f"{where}：{category} seed 必须定义 {name}")
    variants = seed.get("variants") or {}
    if not (isinstance(variants, dict) and all(isinstance(change, dict) for change in variants.values())):
        errors.append(f"{where}：variants 必须是按变体名给出的 token 改写映射")
        variants = {}
    for variant, change in variants.items():
        unknown = [name for name in change if name not in tokens]
        if unknown:
            errors.append(f"{where}：变体 {variant} 改写了不存在的 token {', '.join(unknown)}")
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
        for variant, change in variants.items():
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
        if "data" in seed:
            by_variant = seed["data"].get("variants") if isinstance(seed["data"], dict) else None
            if by_variant is not None and not (isinstance(by_variant, dict) and all(isinstance(v, dict) for v in by_variant.values())):
                errors.append(f"{where}：data.variants 必须是按变体名给出的色板映射")
                by_variant = None
            stray = [name for name in by_variant or {} if name not in (seed.get("variants") or {})]
            if stray:
                errors.append(f"{where}：数据色板给了不存在的变体 {', '.join(stray)}")
            checked = set()
            for variant, palette in palettes.items():
                data = data_palette(seed, variant)
                if "paper" not in palette or (id(data), palette["paper"]) in checked:
                    continue
                checked.add((id(data), palette["paper"]))
                label = f"变体 {variant} 的" if data is not seed["data"] else ""
                errors += [f"{where}：{label}{problem}" for problem in data_problems(data, palette["paper"])]


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
    color = lib.seed(seeds.get("color"), template) if seeds.get("color") else None
    for category, seed_id in seeds.items():
        seed = lib.seed(seed_id, template)
        if not seed or category == "color" or not color or not isinstance(seed.get("variants"), dict):
            continue
        for name in seed["variants"]:
            if name not in (color.get("variants") or {}):
                errors.append(f"{where}：{seed['id']} 的变体 {name} 不是颜色 Seed {color['id']} 的变体")
    for name in ((template.get("variants") or {}).get("options") or []) if color else []:
        if name not in (color.get("variants") or {}):
            errors.append(f"{where}：变体 {name} 不是颜色 Seed {color['id']} 的变体")
    if follows_system(template):
        # 覆盖值排在变体之后，会盖掉深色值：深色下就用错了值。
        darkened = {name for seed in loaded if isinstance(seed.get("variants"), dict)
                    for name in (seed["variants"].get("dark") or {})}
        for scene, entry in (template.get("overrides") or {}).items():
            entry = entry if isinstance(entry, dict) else {}
            places = [(scene, entry), *((f"{scene}/{name}", point or {}) for name, point in (entry.get("breakpoints") or {}).items())]
            for label, tokens in places:
                for name in sorted(set(tokens) & darkened):
                    errors.append(f"{where}：{label} 的覆盖值 {name} 也被 dark 变体改写，深色下会被覆盖值盖掉；只留一处")
    if "data" in (template.get("scenes") or []) and color and "data" not in color:
        errors.append(f"{where}：声明了 data 场景，但颜色 Seed {color['id']} 没有数据色板")
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
    checks = template.get("checks") or {}
    if not isinstance(checks, dict):
        errors.append(f"{where}：checks 必须是场景到规则的映射")
        checks = {}
    for scene, spec in checks.items():
        if scene not in CHECK_SCENES or scene not in (template.get("scenes") or []):
            errors.append(f"{where}：checks 的场景 {scene} 必须是 {'、'.join(CHECK_SCENES)} 之一，并在 scenes 里")
        errors += [f"{where}：checks.{scene}：{problem}" for problem in check_spec_problems(spec)]
    if all(lib.seed(seed_id, template) for seed_id in seeds.values()):
        for scene in CHECK_SCENES:
            if scene not in (template.get("scenes") or []):
                continue
            roles, rules = scene_checks(lib, template, scene)
            names = template_tokens(lib, template, scene, None)[0]
            for rule in rules:
                spec = CHECK_KINDS.get(rule.get("kind"))
                if not spec:
                    continue
                for key in (*spec.get("roles", ()), *spec.get("optional_roles", ())):
                    if rule.get(key) and rule[key] not in roles:
                        errors.append(f"{where}：{scene} 的 {rule['kind']} 规则用了没有声明的角色 {rule[key]}")
                for key in (*spec.get("thresholds", ()), *spec.get("colors", ())):
                    value = rule.get(key)
                    if isinstance(value, str) and value not in names:
                        errors.append(f"{where}：{scene} 的 {rule['kind']} 规则引用了不存在的 token {value}")
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


def check_precedent(entry, used: set[str], errors: list[str]):
    pid = entry.get("id")
    where = f"precedent {pid}"
    for field in ("id", "category", "modality", "view_type"):
        if not entry.get(field):
            errors.append(f"{where}：缺少 {field}")
    if entry.get("modality") and entry["modality"] not in MODALITIES:
        errors.append(f"{where}：modality 应为 {'、'.join(MODALITIES[:-1])} 或 {MODALITIES[-1]}")
    if not (isinstance(pid, str) and re.fullmatch(r"[a-z0-9]{8}", pid)):
        errors.append(f"{where}：id 应为 8 位小写字母或数字")
    if not entry["_path"].name.endswith(f"-{pid}.md"):
        errors.append(f"{where}：文件名应为 <名称>-{pid}.md")
    if pid not in used and not entry.get("retained_for"):
        errors.append(f"{where}：没有 Template 引用，需要写 retained_for")
    body = entry["_body"]
    if bool(entry.get("dimensions_with_reference")) != ("# Dimensional References" in body):
        errors.append(f"{where}：dimensions_with_reference 与正文的「# Dimensional References」一节对不上")
    for ref in sorted(set(re.findall(r"references/[\w./-]*\w", body))):
        if not (SKILL / ref).exists():
            errors.append(f"{where}：正文引用了不存在的 {ref}")
    if entry.get("source_url"):
        for field in ("source_revision", "source_license"):
            if not entry.get(field):
                errors.append(f"{where}：有 source_url 时必须写 {field}")
        if entry["_path"].relative_to(SKILL).as_posix() not in THIRD_PARTY.read_text(encoding="utf-8"):
            errors.append(f"{where}：第三方来源没有登记在 references/third-party-notices.md")


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
        used = {e for template in lib.templates.values() for e in template.get("exemplars") or []}
        for entry in lib.precedents.values():
            check_precedent(entry, used, errors)
    if args.links:
        errors += check_links(lib)
    if errors:
        print("检查未通过：")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    scope = f"{len(args.paths)} 个文件" if args.paths else (
        f"{len(lib.seeds)} 个 seed，{len(lib.templates)} 个 template，{len(lib.precedents)} 个 precedent，{len(lib.fonts)} 个字体")
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
    p.add_argument("--chars", type=int, help="标题的汉字数（全是全角字时）")
    p.add_argument("--em", type=float,
                   help="中西混排时用：标题一行（竖排时一列）在浏览器里实测的长度，单位 em（字号 100px 时的长度 ÷ 100，含字距）")
    p.add_argument("--span", type=int, default=0, help="横排时跨几栏")
    p.add_argument("--tracking", type=float, default=None,
                   help="字距，单位 em；默认取 tracking-display-cjk，没有时取 tracking-display")
    p.add_argument("--padding", default="0",
                   help="字块到边框内侧的距离，单位 px；和 --border 相加就是字块到所跨栏位外沿的距离。两侧不同时写成 左,右（竖排时为 上,下）")
    p.add_argument("--border", default="0",
                   help="字块所在的板在所跨栏位内画的边框宽度，单位 px，写法同 --padding")
    p.add_argument("--sub-length", type=float, default=None,
                   help="竖排时同一列里其余文字（如小字副标题，连同它与标题之间的间隔）的长度，单位 px")
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
