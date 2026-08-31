#!/usr/bin/env python3
"""musepool 本地检索与配方工具 —— Python 3.9+ 纯标准库,无需网络与任何依赖。

用法(在 skill 目录下运行,或用绝对路径):

  python3 scripts/muse_local.py list [--scenario frontend|poster|infographic|social|academic]
  python3 scripts/muse_local.py search "dark monochrome typography" [--scenario poster] [-n 5]
  python3 scripts/muse_local.py show <id|文件名>          # 打印完整 seed(含深度参考)
  python3 scripts/muse_local.py recipe <id> [<id> ...] [--brief "..."]
  python3 scripts/muse_local.py validate

search 在 gist / category / tags / core_dimensions 及 seed 正文上做大小写不敏感的
关键词打分,所有词命中者排前,其次按命中词数与 novelty 排序。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path, PurePosixPath
from typing import Optional

SEEDS_DIR = Path(__file__).resolve().parent.parent / "seeds"
INDEX = SEEDS_DIR / "index.json"
SCENARIOS = ("frontend", "poster", "infographic", "social", "academic")
CORE_DIMENSIONS = {
    "algorithms",
    "color",
    "components",
    "craft",
    "imagery",
    "layout",
    "motion",
    "narrative",
    "typography",
}
SCORE_FIELDS = {
    "anti_slop_value",
    "code_value",
    "density",
    "motion_intensity",
    "novelty",
    "visual_value",
}
REQUIRED_SECTIONS = (
    "Narrative",
    "Tech Stack",
    "Layout",
    "Typography",
    "Color",
    "Imagery",
    "Components",
    "Motion",
    "Algorithms",
    "Material",
    "Craft",
)


def read_index() -> list[dict]:
    if not INDEX.exists():
        raise RuntimeError(f"找不到索引 {INDEX}")
    try:
        data = json.loads(INDEX.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"无法读取索引 {INDEX}: {exc}") from exc
    if not isinstance(data, list):
        raise RuntimeError("索引顶层必须是数组")
    return data


def load_index() -> list[dict]:
    try:
        return read_index()
    except RuntimeError as exc:
        sys.stderr.write(f"muse_local: {exc}\n")
        sys.exit(2)


def flat_tags(tags) -> str:
    if isinstance(tags, dict):
        return " ".join(str(v) for vs in tags.values() for v in (vs if isinstance(vs, list) else [vs]))
    if isinstance(tags, list):
        return " ".join(map(str, tags))
    return str(tags or "")


def haystack(entry: dict) -> str:
    parts = [
        entry.get("gist", ""),
        entry.get("category", ""),
        flat_tags(entry.get("tags")),
        " ".join(entry.get("core_dimensions") or []),
    ]
    # 连同 seed 正文一起搜(布局/色彩/动效/工艺细节都在正文里)
    path = SEEDS_DIR / entry["file"]
    if path.exists():
        parts.append(path.read_text(encoding="utf-8"))
    return " ".join(parts).lower()


def resolve_entry(entries: list[dict], target: str) -> dict:
    key = target.casefold()
    exact = [
        entry
        for entry in entries
        if str(entry.get("id", "")).casefold() == key
        or Path(str(entry.get("file", ""))).stem.casefold() == key
    ]
    if len(exact) == 1:
        return exact[0]

    fuzzy = [
        entry
        for entry in entries
        if key in str(entry.get("id", "")).casefold()
        or key in str(entry.get("file", "")).casefold()
    ]
    if len(fuzzy) == 1:
        return fuzzy[0]
    if not fuzzy:
        raise LookupError(f"未找到 {target},先跑 list 或 search")
    matches = ", ".join(str(entry.get("id", "?")) for entry in fuzzy)
    raise LookupError(f"{target} 匹配到多个种子: {matches};请使用完整 id")


def cmd_list(args) -> int:
    entries = load_index()
    if args.scenario:
        entries = [e for e in entries if e["scenario"] == args.scenario]
    for e in entries:
        print(f"[{e['scenario']}] {e['id']}  {e['category']}  —  {e['gist'][:110]}")
        print(f"    file: seeds/{e['file']}")
    print(f"\n共 {len(entries)} 个种子")
    return 0


def cmd_search(args) -> int:
    words = [w for w in args.query.lower().split() if w]
    if not words:
        sys.stderr.write("muse_local: search 需要关键词\n")
        return 2
    entries = load_index()
    if args.scenario:
        entries = [e for e in entries if e["scenario"] == args.scenario]
    scored = []
    for e in entries:
        hay = haystack(e)
        hits = sum(1 for w in words if w in hay)
        if hits:
            scored.append((hits == len(words), hits, e.get("scores", {}).get("novelty", 0), e))
    scored.sort(key=lambda t: (t[0], t[1], t[2]), reverse=True)
    for full, hits, nov, e in scored[: args.n]:
        mark = "★" if full else " "
        print(f"{mark} [{e['scenario']}] {e['id']}  {e['category']}  (novelty {nov})")
        print(f"    {e['gist'][:150]}")
        print(f"    file: seeds/{e['file']}")
    if not scored:
        print("无命中。换英文关键词(如 palette / grid / dashboard / diagram)再试。")
    return 0


def cmd_show(args) -> int:
    entries = load_index()
    try:
        entry = resolve_entry(entries, args.target)
    except LookupError as exc:
        sys.stderr.write(f"muse_local: {exc}\n")
        return 2
    path = SEEDS_DIR / entry["file"]
    sys.stdout.write(path.read_text(encoding="utf-8"))
    return 0


def recipe_quality_gate() -> list[dict]:
    checks = (
        ("references_inspected", "已用 show 读完每个参照的正文与深度参考"),
        ("reference_roles", "每个参照只承担已声明的维度,没有互相冲突"),
        ("single_focal_event", "每个关键画面只有一个第一眼可识别的焦点事件"),
        ("release_zone", "焦点之外保留一个明显更安静的释放区"),
        ("palette_provenance", "主色、文字色与强调色均能追溯到参照或同体系推导"),
        ("type_content_coverage", "字体能覆盖实际语言与字符,层级在目标尺寸可读"),
        ("implementation_fidelity", "布局、材质、动效与技术没有为省工而降级"),
        ("content_fidelity", "用户给定文字、数据、人物与对象没有被改写或替换"),
        ("originality", "保留系统语法但未复制独特构图、文案、标识或装饰组合"),
        ("artifact_inspection", "已在真实尺寸和缩略视图检查最终产物"),
        ("surface_quality", "界面类产物已检查关键状态、响应式、键盘焦点与可访问性"),
    )
    return [
        {"id": check_id, "question": question, "status": None, "evidence": None}
        for check_id, question in checks
    ]


def cmd_recipe(args) -> int:
    if len(args.targets) > 3:
        sys.stderr.write("muse_local: recipe 最多选择 3 个种子\n")
        return 2

    entries = load_index()
    references = []
    seen = set()
    for target in args.targets:
        try:
            entry = resolve_entry(entries, target)
        except LookupError as exc:
            sys.stderr.write(f"muse_local: {exc}\n")
            return 2
        normalized_id = entry["id"].casefold()
        if normalized_id in seen:
            sys.stderr.write(f"muse_local: recipe 重复选择了 {entry['id']}\n")
            return 2
        seen.add(normalized_id)
        references.append(
            {
                "id": entry["id"],
                "file": f"seeds/{entry['file']}",
                "scenario": entry["scenario"],
                "category": entry["category"],
                "available_dimensions": entry.get("core_dimensions", []),
                "assigned_dimensions": [],
                "wow": None,
                "borrowed_constraints": [],
                "deliberate_departures": [],
            }
        )

    recipe = {
        "schema_version": 1,
        "brief": {
            "raw": args.brief,
            "goal": None,
            "audience": None,
            "carrier": None,
            "size_or_ratio": None,
            "exact_content": [],
            "assets": [],
            "must_keep": [],
            "must_avoid": [],
        },
        "references": references,
        "synthesis": {
            "concept": None,
            "focal_event": None,
            "release_zone": None,
            "layout": {
                "structure": None,
                "density": None,
                "responsive_behavior": None,
            },
            "typography": {
                "display_role": None,
                "utility_role": None,
                "content_language_coverage": None,
            },
            "color": {
                "source_tokens": [],
                "role_assignments": {},
                "derived_tokens": [],
            },
            "imagery": None,
            "motion": None,
            "craft": None,
            "implementation_requirements": [],
        },
        "originality": {
            "structural_changes": [],
            "reference_specific_elements_excluded": [],
        },
        "quality_gate": recipe_quality_gate(),
    }
    print(json.dumps(recipe, ensure_ascii=False, indent=2))
    return 0


def frontmatter_scalar(frontmatter: str, key: str) -> Optional[str]:
    match = re.search(rf"^{re.escape(key)}:\s*(.*?)\s*$", frontmatter, re.MULTILINE)
    if not match:
        return None
    return match.group(1).strip().strip("\"'")


def frontmatter_block(frontmatter: str, key: str) -> list[str]:
    lines = frontmatter.splitlines()
    try:
        start = lines.index(f"{key}:") + 1
    except ValueError:
        return []
    block = []
    for line in lines[start:]:
        if re.match(r"^[A-Za-z_][A-Za-z0-9_]*:", line):
            break
        block.append(line)
    return block


def frontmatter_list(frontmatter: str, key: str) -> list[str]:
    values = []
    for line in frontmatter_block(frontmatter, key):
        stripped = line.strip()
        if stripped.startswith("- "):
            values.append(stripped[2:].strip().strip("\"'"))
    return values


def frontmatter_scores(frontmatter: str) -> dict[str, object]:
    scores: dict[str, object] = {}
    for line in frontmatter_block(frontmatter, "scores"):
        stripped = line.strip()
        if ":" not in stripped:
            continue
        name, raw_value = stripped.split(":", 1)
        try:
            scores[name] = float(raw_value.strip())
        except ValueError:
            scores[name] = raw_value.strip()
    return scores


def frontmatter_tags(frontmatter: str) -> dict[str, list[str]]:
    tags: dict[str, list[str]] = {}
    current_group: Optional[str] = None
    for line in frontmatter_block(frontmatter, "tags"):
        stripped = line.strip()
        if stripped.endswith(":") and not stripped.startswith("-"):
            current_group = stripped[:-1]
            tags[current_group] = []
        elif stripped.startswith("- ") and current_group:
            tags[current_group].append(stripped[2:].strip().strip("\"'"))
    return tags


def section_text(content: str, section: str) -> Optional[str]:
    match = re.search(
        rf"^# {re.escape(section)}\s*$\n+(.*?)(?=^# |\Z)",
        content,
        re.MULTILINE | re.DOTALL,
    )
    if not match:
        return None
    return " ".join(match.group(1).split())


def validate_library(entries: list[dict]) -> list[str]:
    errors: list[str] = []
    seen_ids: dict[str, int] = {}
    seen_files: dict[str, int] = {}
    indexed_files: set[str] = set()

    for position, entry in enumerate(entries, start=1):
        label = f"index[{position}]"
        if not isinstance(entry, dict):
            errors.append(f"{label}: 条目必须是对象")
            continue

        for field in ("id", "file", "scenario", "category", "gist"):
            if not isinstance(entry.get(field), str) or not entry[field].strip():
                errors.append(f"{label}: {field} 必须是非空字符串")

        entry_id = entry.get("id")
        file_value = entry.get("file")
        scenario = entry.get("scenario")
        if not isinstance(entry_id, str) or not isinstance(file_value, str):
            continue

        normalized_id = entry_id.casefold()
        normalized_file = file_value.casefold()
        if normalized_id in seen_ids:
            errors.append(
                f"{label}: id {entry_id} 与 index[{seen_ids[normalized_id]}] 重复"
            )
        else:
            seen_ids[normalized_id] = position
        if normalized_file in seen_files:
            errors.append(
                f"{label}: file {file_value} 与 index[{seen_files[normalized_file]}] 重复"
            )
        else:
            seen_files[normalized_file] = position

        relative = PurePosixPath(file_value)
        if relative.is_absolute() or ".." in relative.parts:
            errors.append(f"{label}: file 必须是 seeds/ 内的安全相对路径: {file_value}")
            continue
        if relative.suffix != ".md":
            errors.append(f"{label}: seed 文件必须使用 .md: {file_value}")
        if scenario not in SCENARIOS:
            errors.append(f"{label}: 未知场景 {scenario!r}")
        elif not relative.parts or relative.parts[0] != scenario:
            errors.append(f"{label}: file 目录与 scenario 不一致: {file_value}")

        indexed_files.add(relative.as_posix())
        path = SEEDS_DIR.joinpath(*relative.parts)
        try:
            path.resolve().relative_to(SEEDS_DIR.resolve())
        except (OSError, RuntimeError, ValueError):
            errors.append(f"{label}: seed 路径越出 seeds/: {file_value}")
            continue
        if not path.is_file():
            errors.append(f"{label}: 找不到 seed 文件 {file_value}")
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exc:
            errors.append(f"{label}: 无法读取 {file_value}: {exc}")
            continue

        if not content.startswith("---\n") or "\n---\n" not in content[4:]:
            errors.append(f"{label}: {file_value} 缺少完整 YAML frontmatter")
            frontmatter = ""
        else:
            frontmatter = content[4:].split("\n---\n", 1)[0]
        for key, expected in (
            ("id", entry_id),
            ("scenario", scenario),
            ("category", entry.get("category")),
        ):
            actual = frontmatter_scalar(frontmatter, key)
            if actual != expected:
                errors.append(
                    f"{label}: {file_value} frontmatter {key}={actual!r},索引为 {expected!r}"
                )

        dimensions = entry.get("core_dimensions")
        if not isinstance(dimensions, list) or not dimensions:
            errors.append(f"{label}: core_dimensions 必须是非空数组")
        elif any(
            not isinstance(dimension, str) or dimension not in CORE_DIMENSIONS
            for dimension in dimensions
        ):
            errors.append(f"{label}: core_dimensions 含未知值 {dimensions!r}")
        elif frontmatter and frontmatter_list(frontmatter, "core_dimensions") != dimensions:
            errors.append(
                f"{label}: {file_value} frontmatter core_dimensions 与索引不一致"
            )

        scores = entry.get("scores")
        if not isinstance(scores, dict):
            errors.append(f"{label}: scores 必须是对象")
        else:
            missing_scores = sorted(SCORE_FIELDS - set(scores))
            if missing_scores:
                errors.append(f"{label}: scores 缺少 {', '.join(missing_scores)}")
            for score_name, score in scores.items():
                if not isinstance(score, (int, float)) or isinstance(score, bool):
                    errors.append(f"{label}: score {score_name} 必须是数字")
                elif not 0 <= score <= 1:
                    errors.append(f"{label}: score {score_name} 必须在 0..1")
            if frontmatter and frontmatter_scores(frontmatter) != scores:
                errors.append(f"{label}: {file_value} frontmatter scores 与索引不一致")

        tags = entry.get("tags")
        if not isinstance(tags, dict) or not tags:
            errors.append(f"{label}: tags 必须是非空对象")
        else:
            for tag_group, values in tags.items():
                if not isinstance(values, list) or not values or any(
                    not isinstance(value, str) or not value for value in values
                ):
                    errors.append(f"{label}: tags.{tag_group} 必须是字符串数组")
            if frontmatter and frontmatter_tags(frontmatter) != tags:
                errors.append(f"{label}: {file_value} frontmatter tags 与索引不一致")

        gist = entry.get("gist")
        narrative = section_text(content, "Narrative")
        if isinstance(gist, str) and narrative is not None and not narrative.startswith(gist):
            errors.append(f"{label}: {file_value} Narrative 与索引 gist 不一致")

        for section in REQUIRED_SECTIONS:
            if not re.search(rf"^# {re.escape(section)}\s*$", content, re.MULTILINE):
                errors.append(f"{label}: {file_value} 缺少 # {section}")

    disk_files = {
        path.relative_to(SEEDS_DIR).as_posix()
        for path in SEEDS_DIR.rglob("*.md")
        if path.is_file()
    }
    for file_value in sorted(indexed_files - disk_files):
        errors.append(f"索引引用但磁盘不存在: {file_value}")
    for file_value in sorted(disk_files - indexed_files):
        errors.append(f"磁盘存在但未进入索引: {file_value}")
    return errors


def cmd_validate(_args) -> int:
    try:
        entries = read_index()
    except RuntimeError as exc:
        sys.stderr.write(f"muse_local: {exc}\n")
        return 1

    errors = validate_library(entries)
    if errors:
        for error in errors:
            sys.stderr.write(f"muse_local: {error}\n")
        sys.stderr.write(f"muse_local: 校验失败,共 {len(errors)} 个问题\n")
        return 1

    scenario_count = len({entry["scenario"] for entry in entries})
    print(
        f"musepool: {len(entries)} 个种子 / {scenario_count} 个场景,索引与正文一致"
    )
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="musepool 本地检索")
    sub = p.add_subparsers(dest="command", required=True)

    l = sub.add_parser("list", help="列出种子(浅摘要)")
    l.add_argument("--scenario", choices=SCENARIOS)

    s = sub.add_parser("search", help="关键词检索")
    s.add_argument("query")
    s.add_argument("--scenario", choices=SCENARIOS)
    s.add_argument("-n", type=int, default=5, help="返回条数(默认 5)")

    w = sub.add_parser("show", help="打印完整 seed")
    w.add_argument("target", help="id 或文件名片段")

    r = sub.add_parser("recipe", help="从 1–3 个种子生成机器可读的合成配方草案")
    r.add_argument("targets", nargs="+", help="1–3 个 seed id 或文件名片段")
    r.add_argument("--brief", help="保留原始设计需求,不自动改写")

    sub.add_parser("validate", help="校验索引、seed 元数据、正文结构与文件集合")

    args = p.parse_args()
    return {
        "list": cmd_list,
        "search": cmd_search,
        "show": cmd_show,
        "recipe": cmd_recipe,
        "validate": cmd_validate,
    }[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
