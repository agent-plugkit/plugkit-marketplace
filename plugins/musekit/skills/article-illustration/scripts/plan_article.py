#!/usr/bin/env python3
"""从一篇 Markdown 里抽出 Mermaid 围栏，并给出结构信号和建议路径。

只读源文件，不改原文，也不判断散文里要不要新增图。建议路径对应已确认的密度规则：

- 出现分支、回路、精确数字，或标签不是少量短词时，建议 structured（可编辑图解）
- 否则建议 try-image（尝试生图）

「少量短词」在这里读成：标签 1 到 6 个，每个不超过 8 个字符，且不含空白或句读。
确认大纲时仍可改这条建议。

用法：

  python3 scripts/plan_article.py path/to/article.md
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

MAX_LABELS = 6
MAX_LABEL_CHARS = 8
FENCE = re.compile(r"^```([^\n`]*)\n(.*?)^```[ \t]*$", re.M | re.S)
NODE = re.compile(
    r"([A-Za-z_][\w-]*)(?:\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\}|\[\"([^\"]*)\"\])?"
)
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
            arrow = ARROW.match(line, position)
            if arrow:
                position = arrow.end()
                label_match = EDGE_LABEL.match(line, position)
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
        "edgeCount": len(edges),
        "maxOutDegree": max(outgoing.values(), default=0),
        "hasBranch": max(outgoing.values(), default=0) > 1,
        "hasLoop": _has_cycle(edges),
        "hasPreciseNumber": _has_digit([*labels.values(), *edge_labels]),
        "hasGroup": has_group,
    }


def _sequence_signals(code: str) -> dict:
    labels: list[str] = []
    has_branch = False
    has_loop = False
    for raw in code.splitlines():
        line = re.sub(r"%%.*", "", raw).strip()
        if not line or line.startswith("sequenceDiagram"):
            continue
        control = CONTROL.match(line)
        if control:
            word = control.group(1).lower()
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
        "edgeCount": sum(1 for raw in code.splitlines() if SEQUENCE_MESSAGE.match(raw.strip())),
        "maxOutDegree": 0,
        "hasBranch": has_branch,
        "hasLoop": has_loop,
        "hasPreciseNumber": _has_digit(unique),
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


def _short_words(labels: list[str]) -> bool:
    if not 1 <= len(labels) <= MAX_LABELS:
        return False
    return all(
        0 < len(label.strip()) <= MAX_LABEL_CHARS and not re.search(r"\s|[，。,.、；;：:]", label)
        for label in labels
    )


def suggest(signals: dict) -> str:
    dense = (
        signals["hasBranch"]
        or signals["hasLoop"]
        or signals["hasPreciseNumber"]
        or signals["hasGroup"]
        or not _short_words(signals["labels"])
    )
    return "structured" if dense else "try-image"


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
            "suggestedPath": suggest(signals),
        })
    return {"fences": fences}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="抽出 Markdown 中的 Mermaid 并建议密度路径")
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
