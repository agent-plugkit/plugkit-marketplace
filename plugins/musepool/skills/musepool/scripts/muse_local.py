#!/usr/bin/env python3
"""musepool 本地检索工具 —— 纯标准库,无需网络与任何依赖。

用法(在 skill 目录下运行,或用绝对路径):

  python3 scripts/muse_local.py list [--scenario frontend|poster|infographic|social|academic]
  python3 scripts/muse_local.py search "dark monochrome typography" [--scenario poster] [-n 5]
  python3 scripts/muse_local.py show <id|文件名>          # 打印完整 seed(含深度参考)

search 在 gist / category / tags / core_dimensions 及 seed 正文上做大小写不敏感的
关键词打分,所有词命中者排前,其次按命中词数与 novelty 排序。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SEEDS_DIR = Path(__file__).resolve().parent.parent / "seeds"
INDEX = SEEDS_DIR / "index.json"
SCENARIOS = ("frontend", "poster", "infographic", "social", "academic")


def load_index() -> list[dict]:
    if not INDEX.exists():
        sys.stderr.write(f"muse_local: 找不到索引 {INDEX}\n")
        sys.exit(2)
    return json.loads(INDEX.read_text())


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
        parts.append(path.read_text())
    return " ".join(parts).lower()


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
    key = args.target.lower()
    for e in entries:
        if e["id"].lower() == key or key in e["file"].lower():
            path = SEEDS_DIR / e["file"]
            sys.stdout.write(path.read_text())
            return 0
    sys.stderr.write(f"muse_local: 未找到 {args.target},先跑 list 或 search\n")
    return 2


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

    args = p.parse_args()
    return {"list": cmd_list, "search": cmd_search, "show": cmd_show}[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
