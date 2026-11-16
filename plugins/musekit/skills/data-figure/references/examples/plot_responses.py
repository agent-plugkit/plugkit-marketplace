#!/usr/bin/env python3
"""学术出版示例：全部原始点、均值和样本 SD，宽 160 mm。

颜色和字体取自 musepool 解析出的 style.md（场景 data），字号与线宽按出版规范。
依赖 matplotlib；不属于插件的检索运行依赖。

运行：python3 plot_responses.py <style.md> <输出目录> [--fonts <字体文件目录>]
"""
import argparse
import csv
import json
import statistics
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib import font_manager  # noqa: E402

WIDTH_MM, HEIGHT_MM = 160, 100
MM = 1 / 25.4
# 期刊图用白底：印在白纸上不多出一块 paper 色底。
BACKGROUND = "#FFFFFF"


def read_style(path: Path) -> dict:
    """读 style.md 的 frontmatter：tokens 与 data 两段，每行一个 JSON 值。"""
    lines = path.read_text(encoding="utf-8").split("---\n")[1].splitlines()
    style, section = {"tokens": {}, "data": {}}, None
    for line in lines:
        if not line.startswith(" "):
            section = line.rstrip(":") if line.rstrip(":") in style else None
        elif section and line.startswith("  ") and not line.startswith("    "):
            key, value = line.strip().split(": ", 1)
            style[section][key] = json.loads(value)
    return style


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("style", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("--fonts", type=Path, help="放 style.md 所列字体文件的目录")
    args = parser.parse_args()
    style = read_style(args.style)
    tokens, data = style["tokens"], style["data"]

    for font in sorted(args.fonts.glob("*.[ot]tf")) if args.fonts else []:
        font_manager.fontManager.addfont(str(font))
    plt.rcParams.update({
        "font.family": [tokens["font-text"], tokens["font-cjk"], "DejaVu Sans"],
        "font.size": 8,
        "axes.edgecolor": tokens["ink"],
        "axes.labelcolor": tokens["ink"],
        "axes.linewidth": 0.75,
        "xtick.color": tokens["ink-muted"],
        "ytick.color": tokens["ink-muted"],
        "xtick.labelcolor": tokens["ink-muted"],
        "ytick.labelcolor": tokens["ink-muted"],
        "svg.fonttype": "path",
        "pdf.fonttype": 42,
    })

    groups = {"A": [], "B": []}
    source = Path(__file__).with_name("responses.csv")
    with source.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            groups[row["condition"]].append(float(row["response_ms"]))

    fig, ax = plt.subplots(figsize=(WIDTH_MM * MM, HEIGHT_MM * MM), facecolor=BACKGROUND)
    ax.set_facecolor(BACKGROUND)
    markers = ("o", "s")
    # 横向偏移只分开同组观测，不编码新的变量。
    offsets = (-0.12, -0.04, 0.04, 0.12)
    for position, (key, values) in enumerate(groups.items(), start=1):
        color = data["categorical"][position - 1]
        ax.scatter([position + o for o in offsets], values, s=22, marker=markers[position - 1],
                   facecolor=color, edgecolor=BACKGROUND, linewidth=0.5, zorder=3)
        mean, sd = statistics.mean(values), statistics.stdev(values)
        ax.errorbar(position + 0.3, mean, yerr=sd, fmt="_", color=tokens["ink"],
                    markersize=10, elinewidth=0.75, capsize=3, capthick=0.75, zorder=2)
        # 均值和 SD 用同一舍入规则：都保留两位小数。
        ax.annotate(f"{mean:.2f} ± {sd:.2f}", (position + 0.38, mean), va="center",
                    fontsize=8, color=tokens["ink"])

    ax.set_xlim(0.5, 2.9)
    ax.set_xticks([1, 2], ["A", "B"])
    ax.set_ylim(0, 24)
    ax.set_yticks(range(0, 25, 5))
    ax.set_xlabel("Condition", fontsize=9)
    ax.set_ylabel("Response (ms)", fontsize=9)
    ax.spines[["top", "right"]].set_visible(False)
    ax.yaxis.grid(True, color=tokens["ink-muted"], alpha=0.3, linewidth=0.5)
    ax.set_axisbelow(True)
    fig.tight_layout(rect=(0, 0.05, 1, 1))
    # 图注与纵轴起在同一条竖线上。
    fig.text(ax.get_position().x0, 0.01, "n = 4 per condition; mean ± sample SD; synthetic teaching data",
             fontsize=7, color=tokens["ink-muted"])

    args.out.mkdir(parents=True, exist_ok=True)
    for suffix in ("svg", "pdf"):
        fig.savefig(args.out / f"responses.{suffix}", facecolor=BACKGROUND)
    fig.savefig(args.out / "responses.png", dpi=300, facecolor=BACKGROUND)
    print("\n".join(str(args.out / f"responses.{s}") for s in ("svg", "pdf", "png")))


if __name__ == "__main__":
    main()
