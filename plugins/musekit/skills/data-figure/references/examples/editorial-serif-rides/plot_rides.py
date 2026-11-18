#!/usr/bin/env python3
"""文章配图：三座城市 2025 年每月共享单车骑行量（虚构示例数据），正文栏宽 680 px。

颜色、字体和字号取自 musepool 解析出的 style.md（editorial-serif · forest · 场景 data）。
版面按 96 dpi 以像素设计：figsize = px / 96，字号 pt = px × 0.75，线宽 pt = px × 0.75。
依赖 matplotlib 与 fontTools（matplotlib 自带依赖）；不用 pandas。

运行：python3 plot_rides.py [--style style.md] [--data rides.csv] [--out .] [--fonts <字体目录>]

字体：--fonts 指向放着 style.md「字体」一节所列字体文件（Source Serif 4、Noto Serif SC）的目录。
没给或缺字体时按 style.md 的字体栈取本机已有的衬线字体，最后回退到 matplotlib 自带的 DejaVu Serif，
并打印实际用到的字体，写进交付说明。
"""
import argparse
import csv
import json
import re
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib import font_manager  # noqa: E402
from matplotlib.lines import Line2D  # noqa: E402

HERE = Path(__file__).resolve().parent
DPI = 96
WIDTH_PX = 680
PNG_SCALE = 2  # 高清屏：680 px 显示宽度导出 1360 px

CITY_ORDER = ["临川", "白沙", "北渡"]  # 图例和线尾标注的顺序按图上自上而下的位置
FOCUS = "北渡"  # 图题指向的那一项，用 accent；其余用 ink-muted
MONTH_LABELS = [f"{m} 月" for m in range(1, 13)]  # 数字与汉字之间统一留空格，同导语

# 垂直版面（px，自上而下），间距取自 style.md 的 space-scale。
LAYOUT = {
    "top": 32,
    "title_to_rule": 16,
    "rule_to_lede": 16,
    "lede_to_facts": 8,
    "facts_to_plot": 48,
    "plot_height": 300,
    "plot_to_rule": 48,   # 含月份刻度的高度
    "rule_to_note": 16,
    "bottom": 32,
    "plot_left": 56,      # 纵轴刻度在坐标区左侧
    "plot_right": 72,     # 线尾的城市名在坐标区右侧
}


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


def px(value: str | float) -> float:
    return float(re.sub("px$", "", value)) if isinstance(value, str) else float(value)


def pt(value) -> float:
    """像素换算成 matplotlib 的磅（96 dpi 下 1 px = 0.75 pt）。"""
    return px(value) * 0.75


def setup_fonts(tokens: dict, font_dir: Path | None) -> list[str]:
    """按 style.md 字体栈确定实际使用的西文与中文字体，返回 font.family 列表。"""
    for font in sorted(font_dir.glob("*.[ot]tf")) if font_dir else []:
        font_manager.fontManager.addfont(str(font))
    names = {f.name for f in font_manager.fontManager.ttflist}
    # style.md 的 --font-text 栈：Source Serif 4, Noto Serif SC, Georgia, Times New Roman, ...
    latin = next((n for n in (tokens["font-text"], "Georgia", "Times New Roman") if n in names), "DejaVu Serif")
    cjk = next((n for n in (tokens["font-cjk"], "Source Han Serif SC") if n in names), None)
    if cjk is None:
        print(f"没有找到 {tokens['font-cjk']}：中文会回退到系统字体，用 --fonts 指向字体目录")
    return list(dict.fromkeys([latin, cjk or "DejaVu Serif", "DejaVu Serif"]))


def read_rides(path: Path) -> dict[str, list[float]]:
    series: dict[str, dict[int, float]] = {}
    with path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            year, month = row["month"].split("-")
            assert year == "2025", row
            series.setdefault(row["city"], {})[int(month)] = float(row["rides_10k"])
    for city, months in series.items():
        missing = sorted(set(range(1, 13)) - set(months))
        assert not missing, f"{city} 缺少月份 {missing}"  # 有缺失时不能无说明地连线
    return {city: [series[city][m] for m in range(1, 13)] for city in CITY_ORDER}


def fmt(value: float) -> str:
    return f"{value:g}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--style", type=Path, default=HERE / "style.md")
    parser.add_argument("--data", type=Path, default=HERE / "rides.csv")
    parser.add_argument("--out", type=Path, default=HERE)
    parser.add_argument("--fonts", type=Path, help="放 style.md 所列字体文件的目录")
    args = parser.parse_args()

    style = read_style(args.style)
    t = style["tokens"]
    paper, ink, muted, accent = t["paper"], t["ink"], t["ink-muted"], t["accent"]
    size_title, size_body, size_meta = px(t["size-title"]), px(t["size-body"]), px(t["size-meta"])
    rule = px(t["rule-width"])

    family = setup_fonts(t, args.fonts)
    plt.rcParams.update({
        "font.family": family,
        "font.size": pt(size_meta),
        "svg.fonttype": "none",  # 活文字，不嵌入字形；读者电脑按下面改写的字体栈取字
        "axes.unicode_minus": False,
    })
    for name in family[:2]:
        print("font:", name, "->", font_manager.findfont(font_manager.FontProperties(family=name)))

    rides = read_rides(args.data)
    focus = rides[FOCUS]
    lo, hi = min(focus), max(focus)
    lo_month, hi_month = focus.index(lo) + 1, focus.index(hi) + 1
    ratio = hi / lo
    others = {c: max(v) / min(v) for c, v in rides.items() if c != FOCUS}
    assert all(r < 2 for r in others.values())  # 图题「起落最大」：另两城峰谷之比都不到 2 倍
    # 导语第二行描述另两城的季节形状，月份由数据算出。
    linchuan, baisha = rides["临川"], rides["白沙"]
    lc_peak = linchuan.index(max(linchuan)) + 1
    bs_peaks = [m for m in range(2, 12) if baisha[m - 2] < baisha[m - 1] > baisha[m]]
    assert len(bs_peaks) == 2 and min(baisha[5:8]) < min(baisha[p - 1] for p in bs_peaks), bs_peaks

    # ---- 文字（图题与导语由我创作，数字由数据算出） ----
    title = f"{FOCUS}的骑行，随季节起落最大"
    lede = [
        f"{FOCUS} {hi_month} 月的骑行量约是 {lo_month} 月的 {ratio:.1f} 倍；",
        f"临川 {lc_peak} 月最高；白沙盛夏略有回落，{bs_peaks[0]} 月与 {bs_peaks[1]} 月各有一个高点。",
    ]
    facts = "2025 年 1 至 12 月 · 每月共享单车骑行量 · 单位：万次"
    note = "每城每月一个值。虚构示例数据。"

    # ---- 版面（px） ----
    L = LAYOUT
    lead_body = size_body * t["leading-body"]  # 中文导语：淡墨加大行距代替斜体
    y = L["top"]
    title_top = y
    y += size_title * t["leading-title"] + L["title_to_rule"]
    rule1_y = y
    y += L["rule_to_lede"]
    lede_top = y
    y += lead_body * len(lede) + L["lede_to_facts"]
    facts_top = y
    y += size_meta * 1.5 + L["facts_to_plot"]
    plot_top = y
    y += L["plot_height"]
    plot_bottom = y
    y += L["plot_to_rule"]
    rule2_y = y
    y += L["rule_to_note"]
    note_top = y
    y += size_meta * 1.5 + L["bottom"]
    height_px = round(y)

    W, H = WIDTH_PX, height_px
    fig = plt.figure(figsize=(W / DPI, H / DPI), dpi=DPI, facecolor=paper)

    def fy(top_px: float) -> float:  # 像素（自上而下）→ figure 坐标（自下而上）
        return 1 - top_px / H

    # 中轴标题组：按整张图的中线居中，不按坐标区。
    fig.text(0.5, fy(title_top), title, ha="center", va="top", color=ink,
             fontsize=pt(size_title), fontweight=t["weight-strong"], linespacing=t["leading-title"])
    short = px(t["rule-short"]) / W
    for ry in (rule1_y, rule2_y):
        fig.add_artist(Line2D([0.5 - short / 2, 0.5 + short / 2], [fy(ry)] * 2,
                              color=ink, linewidth=pt(rule), solid_capstyle="butt"))
    for i, line in enumerate(lede):
        fig.text(0.5, fy(lede_top + i * lead_body + (lead_body - size_body) / 2), line,
                 ha="center", va="top", color=muted, fontsize=pt(size_body))
    fig.text(0.5, fy(facts_top), facts, ha="center", va="top", color=muted, fontsize=pt(size_meta))
    fig.text(0.5, fy(note_top), note, ha="center", va="top", color=muted, fontsize=pt(size_meta))

    # ---- 图区：齐左，退后的网格，强调一条线 ----
    ax = fig.add_axes((L["plot_left"] / W, fy(plot_bottom),
                       (W - L["plot_left"] - L["plot_right"]) / W, L["plot_height"] / H))
    ax.set_facecolor(paper)
    months = list(range(1, 13))
    ax.set_xlim(0.6, 12.15)  # 右端紧贴 12 月，线尾标注落在网格线之外
    ax.set_ylim(0, 400)  # 从 0 起：「4.4 倍」在图上就是线高之比
    ax.set_yticks(range(0, 401, 100))
    ax.set_xticks(months, MONTH_LABELS)
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color(ink)
    ax.spines["bottom"].set_linewidth(pt(rule))
    ax.yaxis.grid(True, color=muted, alpha=0.35, linewidth=pt(rule))
    ax.set_axisbelow(True)
    ax.tick_params(axis="both", length=0, labelsize=pt(size_meta), labelcolor=muted, pad=pt(8))
    # 单位写在纵轴最上一格刻度的上方，与刻度文字的右缘对齐。
    ax.annotate("万次", xy=(0, 1), xycoords="axes fraction", xytext=(-pt(8), pt(12)),
                textcoords="offset points", ha="right", va="bottom", color=muted, fontsize=pt(size_meta))

    styles = {
        "临川": dict(color=muted, linewidth=pt(1.5), linestyle="-", marker="o", markersize=pt(4.5)),
        "白沙": dict(color=muted, linewidth=pt(1.5), linestyle=(0, (4, 2.5)), marker="o", markersize=pt(4.5)),
        "北渡": dict(color=accent, linewidth=pt(3), linestyle="-", marker="o", markersize=pt(7)),
    }
    for city in CITY_ORDER:
        s = styles[city]
        ax.plot(months, rides[city], zorder=4 if city == FOCUS else 3,
                markeredgecolor=paper, markeredgewidth=pt(1), clip_on=False, **s)
        # 线尾直接标注序列名；文字用 ink / ink-muted，不用序列色。
        ax.annotate(city, (12, rides[city][-1]), xytext=(pt(12), 0), textcoords="offset points",
                    ha="left", va="center", fontsize=pt(size_body),
                    color=ink if city == FOCUS else muted,
                    fontweight=t["weight-strong"] if city == FOCUS else t["weight-text"])

    # 只标结论需要的两个值：北渡的低谷与高峰。
    ax.annotate(fmt(lo), (lo_month, lo), xytext=(0, -pt(12)), textcoords="offset points",
                ha="center", va="top", fontsize=pt(size_body), color=ink)
    ax.annotate(fmt(hi), (hi_month, hi), xytext=(0, -pt(14)), textcoords="offset points",
                ha="center", va="top", fontsize=pt(size_body), color=ink)

    args.out.mkdir(parents=True, exist_ok=True)
    stem = args.out / "rides-by-month"
    fig.savefig(f"{stem}.svg", facecolor=paper)
    # SVG 是活文字：在实际用到的字体之后接上 style.md 的开源字体与通用 serif，
    # 读者电脑没有这些字体时仍落到衬线体，而不是系统默认的无衬线。
    svg = Path(f"{stem}.svg")
    used = ", ".join(f"'{n}'" for n in family)
    stack = ", ".join(f"'{n}'" for n in dict.fromkeys([*family[:2], t["font-text"], t["font-cjk"], "Source Han Serif SC"])) + ", serif"
    svg.write_text(svg.read_text(encoding="utf-8").replace(f"font-family: {used}", f"font-family: {stack}"), encoding="utf-8")
    fig.savefig(f"{stem}.png", dpi=DPI * PNG_SCALE, facecolor=paper)
    print(f"{stem}.svg\n{stem}.png  ({W * PNG_SCALE} x {H * PNG_SCALE} px; display {W} x {H})")
    print(f"{FOCUS}: min {fmt(lo)} ({lo_month} 月), max {fmt(hi)} ({hi_month} 月), ratio {ratio:.2f}")
    for c, r in others.items():
        print(f"{c}: max/min {r:.2f}")


if __name__ == "__main__":
    main()
