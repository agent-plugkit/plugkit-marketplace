#!/usr/bin/env python3
"""从一篇 Markdown 里抽出 Mermaid 围栏，并给出结构信号。

只读源文件，不改原文，也不判断散文里要不要新增图。关系图都交给 diagram-design 做可编辑图解；
这里报出的标签、条件（边上的文字，时序图 alt / else / opt / loop 等后面的文字）、分支、回路、分组和数字，供写它的 Brief 核对清单时对照。

用法：

  python3 scripts/plan_article.py path/to/article.md
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

FENCE = re.compile(r"^```([^\n`]*)\n(.*?)^```[ \t]*$", re.M | re.S)
NODE = re.compile(
    r"([A-Za-z_][\w-]*)(?:\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\}|\[\"([^\"]*)\"\])?"
)
INLINE_ARROW = re.compile(r"(?:--|-\.|==)\s+([^\s>][^>]*?)\s+(?:-->|\.->|==>|---)")
ARROW = re.compile(r"-->|==>|-\.->|---")
EDGE_LABEL = re.compile(r"\|([^|]*)\|")
SEQUENCE_MESSAGE = re.compile(r"^(\S+?)\s*-+>>?\+?\s*(\S+?)\s*:\s*(.*)$")
PARTICIPANT = re.compile(r"^participant\s+(\S+)(?:\s+as\s+(.*))?$", re.I)
CONTROL = re.compile(r"^(alt|else|opt|par|and|loop|critical|break)\b", re.I)
SKIP_LINE = re.compile(
    r"^(flowchart|graph|sequenceDiagram|stateDiagram(?:-v2)?|direction|subgraph|end|classDef|class|style|linkStyle)\b",
    re.I,
)


def extract_fences(text: str) -> list[dict]:
    fences = []
    for match in FENCE.finditer(text):
        header = match.group(1).strip().lower().split()
        if not header or header[0] != "mermaid":
            continue
        code = match.group(2).strip("\n")
        if not code.strip():
            continue
        fences.append({
            "index": len(fences) + 1,
            "line": text[: match.start()].count("\n") + 1,
            "code": code,
        })
    return fences


def _kind(code: str) -> str:
    for line in code.splitlines():
        stripped = re.sub(r"%%.*", "", line).strip()
        if not stripped:
            continue
        if stripped.startswith("sequenceDiagram"):
            return "sequence"
        if stripped.startswith("stateDiagram"):
            return "state"
        return "flow"
    return "flow"


def _remember(labels: dict[str, str], node_id: str, explicit: str | None) -> None:
    if explicit is not None and explicit.strip():
        labels.setdefault(node_id, explicit.strip())
    else:
        labels.setdefault(node_id, node_id)


def _flow_signals(code: str) -> dict:
    labels: dict[str, str] = {}
    edges: list[tuple[str, str]] = []
    edge_labels: list[str] = []
    has_group = False
    for raw in code.splitlines():
        line = re.sub(r"%%.*", "", raw).strip()
        if not line or SKIP_LINE.match(line):
            if line.startswith("subgraph"):
                has_group = True
            continue
        position = 0
        previous: str | None = None
        while position < len(line):
            if line[position].isspace():
                position += 1
                continue
            inline = INLINE_ARROW.match(line, position)
            arrow = inline or ARROW.match(line, position)
            if arrow:
                position = arrow.end()
                if inline:
                    edge_labels.append(inline.group(1).strip())
                label_match = None if inline else EDGE_LABEL.match(line, position)
                if label_match:
                    edge_labels.append(label_match.group(1).strip())
                    position = label_match.end()
                while position < len(line) and line[position].isspace():
                    position += 1
                node = NODE.match(line, position)
                if previous and node:
                    target = node.group(1)
                    explicit = next((group for group in node.groups()[1:] if group is not None), None)
                    _remember(labels, target, explicit)
                    edges.append((previous, target))
                    previous = target
                    position = node.end()
                    continue
                break
            node = NODE.match(line, position)
            if node:
                node_id = node.group(1)
                explicit = next((group for group in node.groups()[1:] if group is not None), None)
                _remember(labels, node_id, explicit)
                previous = node_id
                position = node.end()
                continue
            position += 1
    outgoing: dict[str, int] = {}
    for source, _target in edges:
        outgoing[source] = outgoing.get(source, 0) + 1
    return {
        "labels": list(labels.values()),
        "conditions": list(dict.fromkeys(label for label in edge_labels if label)),
        "edgeCount": len(edges),
        "maxOutDegree": max(outgoing.values(), default=0),
        "hasBranch": max(outgoing.values(), default=0) > 1,
        "hasLoop": _has_cycle(edges),
        "hasPreciseNumber": _has_digit([*labels.values(), *edge_labels]),
        "hasGroup": has_group,
    }


def _sequence_signals(code: str) -> dict:
    labels: list[str] = []
    conditions: list[str] = []
    has_branch = False
    has_loop = False
    for raw in code.splitlines():
        line = re.sub(r"%%.*", "", raw).strip()
        if not line or line.startswith("sequenceDiagram"):
            continue
        control = CONTROL.match(line)
        if control:
            word = control.group(1).lower()
            text = line[control.end():].strip()
            if text:
                conditions.append(text)
            if word == "loop" or word == "critical":
                has_loop = True
            elif word != "break":
                has_branch = True
            continue
        participant = PARTICIPANT.match(line)
        if participant:
            labels.append((participant.group(2) or participant.group(1)).strip())
            continue
        message = SEQUENCE_MESSAGE.match(line)
        if message:
            labels.extend([message.group(1), message.group(2)])
            text = message.group(3).strip()
            if text:
                labels.append(text)
    unique = list(dict.fromkeys(labels))
    return {
        "labels": unique,
        "conditions": list(dict.fromkeys(conditions)),
        "edgeCount": sum(1 for raw in code.splitlines() if SEQUENCE_MESSAGE.match(raw.strip())),
        "maxOutDegree": 0,
        "hasBranch": has_branch,
        "hasLoop": has_loop,
        "hasPreciseNumber": _has_digit([*unique, *conditions]),
        "hasGroup": False,
    }


def _has_cycle(edges: list[tuple[str, str]]) -> bool:
    graph: dict[str, list[str]] = {}
    nodes: set[str] = set()
    for source, target in edges:
        graph.setdefault(source, []).append(target)
        nodes.update((source, target))
    color: dict[str, int] = {}

    def visit(node: str) -> bool:
        color[node] = 1
        for nxt in graph.get(node, []):
            state = color.get(nxt, 0)
            if state == 1 or (state == 0 and visit(nxt)):
                return True
        color[node] = 2
        return False

    return any(visit(node) for node in nodes if color.get(node, 0) == 0)


def _has_digit(values: list[str]) -> bool:
    return any(re.search(r"\d", value) for value in values)


def _meaningful(code: str) -> bool:
    for line in code.splitlines():
        stripped = re.sub(r"%%.*", "", line).strip()
        if stripped and not SKIP_LINE.match(stripped):
            return True
    return False


def analyze(text: str) -> dict:
    fences = []
    for fence in extract_fences(text):
        if not _meaningful(fence["code"]):
            continue
        kind = _kind(fence["code"])
        signals = _sequence_signals(fence["code"]) if kind == "sequence" else _flow_signals(fence["code"])
        fences.append({
            **fence,
            "index": len(fences) + 1,
            "kind": kind,
            "signals": signals,
        })
    return {"fences": fences}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="抽出 Markdown 中的 Mermaid 并报出结构信号")
    parser.add_argument("article", type=Path)
    args = parser.parse_args(argv)
    if not args.article.is_file():
        sys.stderr.write(f"plan_article: 找不到文章 {args.article}\n")
        return 2
    report = analyze(args.article.read_text(encoding="utf-8"))
    json.dump(report, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
