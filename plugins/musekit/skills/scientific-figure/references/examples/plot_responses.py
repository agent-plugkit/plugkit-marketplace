#!/usr/bin/env python3
"""独立制图示例：全部原始点、均值和样本 SD，宽 160 mm。

依赖 reportlab 与 pypdfium2；不属于插件的检索运行依赖。
运行：python3 plot_responses.py <输出目录>
"""
import argparse
import csv
import shutil
import statistics
from pathlib import Path
from xml.etree import ElementTree as ET

from reportlab.graphics import renderPDF, renderSVG
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics.shapes import Drawing, Group, Line, String
from reportlab.graphics.widgets.markers import makeMarker
from reportlab.lib import colors
from reportlab.lib.units import mm
import pypdfium2 as pdfium

WIDTH_MM, HEIGHT_MM = 160, 110
DPI = 300
BLUE = colors.HexColor("#2148b8")
WARM = colors.HexColor("#b45431")
INK = colors.HexColor("#26314b")
MUTED = colors.HexColor("#626e82")


def build_figure(data_path):
    groups = {"A": [], "B": []}
    with data_path.open(newline="", encoding="utf-8") as source:
        for row in csv.DictReader(source):
            groups[row["condition"]].append(float(row["response_ms"]))
    summary = {key: (statistics.mean(values), statistics.stdev(values))
               for key, values in groups.items()}

    drawing = Drawing(WIDTH_MM * mm, HEIGHT_MM * mm)
    drawing.add(String(58, 286, "Response by condition",
                       fontName="Helvetica-Bold", fontSize=12, fillColor=INK))

    chart = LinePlot()
    chart.x, chart.y, chart.width, chart.height = 60, 79, 355, 177
    chart.joinedLines = 0
    # 横向位置仅用于分开同组观测，不编码新的变量。
    offsets = (-0.12, -0.04, 0.04, 0.12)
    chart.data = [
        [(position + offset, value) for offset, value in zip(offsets, groups[key], strict=True)]
        for position, key in enumerate(groups, start=1)
    ]
    chart.xValueAxis.valueMin, chart.xValueAxis.valueMax = 0.4, 2.6
    chart.xValueAxis.valueSteps = [1, 2]
    chart.xValueAxis.labelTextFormat = lambda value: {1: "A", 2: "B"}[value]
    chart.yValueAxis.valueMin, chart.yValueAxis.valueMax = 0, 24
    chart.yValueAxis.valueSteps = [0, 5, 10, 15, 20]
    for axis in (chart.xValueAxis, chart.yValueAxis):
        axis.strokeColor = MUTED
        axis.strokeWidth = 0.6
        axis.labels.fontName = "Helvetica"
        axis.labels.fontSize = 9
        axis.labels.fillColor = INK
    chart.xValueAxis.labels.dy = -5
    chart.yValueAxis.labels.dx = -6
    for index, (color, marker) in enumerate([(BLUE, "FilledCircle"), (WARM, "FilledSquare")]):
        chart.lines[index].strokeColor = color
        chart.lines[index].symbol = makeMarker(marker, size=5, fillColor=color,
                                              strokeColor=color, strokeWidth=0.5)
    for value in (5, 10, 15, 20):
        y = chart.y + value / 24 * chart.height
        drawing.add(Line(chart.x, y, chart.x + chart.width, y,
                         strokeColor=colors.HexColor("#e5e8ed"), strokeWidth=0.45))
    drawing.add(chart)

    # 统计表达独立于 seed：中心横杠为均值，须线为均值 ± 样本 SD。
    for position, (key, color) in enumerate(zip(groups, (BLUE, WARM)), start=1):
        mean, sd = summary[key]
        x = chart.x + (position - 0.4) / 2.2 * chart.width
        y = chart.y + mean / 24 * chart.height
        low = chart.y + (mean - sd) / 24 * chart.height
        high = chart.y + (mean + sd) / 24 * chart.height
        drawing.add(Line(x, low, x, high, strokeColor=color, strokeWidth=1))
        for cap_y in (low, high):
            drawing.add(Line(x - 4, cap_y, x + 4, cap_y,
                             strokeColor=color, strokeWidth=1))
        drawing.add(Line(x - 8, y, x + 8, y, strokeColor=color, strokeWidth=1.8))
        drawing.add(String(x, high + 12, f"{mean:g} ± {sd:.2f}",
                           fontName="Helvetica", fontSize=9.5,
                           fillColor=color, textAnchor="middle"))

    drawing.add(String(237, 51, "Condition", fontName="Helvetica",
                       fontSize=9, fillColor=INK, textAnchor="middle"))
    label = String(0, 0, "Response (ms)", fontName="Helvetica", fontSize=9, fillColor=INK)
    rotated_label = Group(label)
    rotated_label.transform = (0, 1, -1, 0, 22, 135)
    drawing.add(rotated_label)
    drawing.add(String(60, 33, "Points: observations (n = 4 per condition).",
                       fontName="Helvetica", fontSize=8, fillColor=MUTED))
    drawing.add(String(60, 21, "Centre bar: mean; whiskers: sample SD. Synthetic teaching data.",
                       fontName="Helvetica", fontSize=8, fillColor=MUTED))
    return drawing, summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="保存 PNG、SVG、PDF 与原始数据的目录")
    output = parser.parse_args().output
    output.mkdir(parents=True, exist_ok=True)
    data_path = Path(__file__).with_name("responses.csv")
    drawing, summary = build_figure(data_path)
    pdf_path = output / "responses.pdf"
    renderPDF.drawToFile(drawing, str(pdf_path))

    # SVG 与 PDF 使用相同坐标；显式保留毫米尺寸，避免把 point 当作 CSS pixel。
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    svg = ET.fromstring(renderSVG.drawToString(drawing))
    svg.set("width", f"{WIDTH_MM}mm")
    svg.set("height", f"{HEIGHT_MM}mm")
    ET.ElementTree(svg).write(output / "responses.svg", encoding="utf-8", xml_declaration=True)

    with pdfium.PdfDocument(str(pdf_path)) as document:
        page = document[0]
        try:
            bitmap = page.render(scale=DPI / 72)
            try:
                bitmap.to_pil().save(output / "responses.png", dpi=(DPI, DPI))
            finally:
                bitmap.close()
        finally:
            page.close()
    destination = output / data_path.name
    if destination.resolve() != data_path.resolve():
        shutil.copyfile(data_path, destination)
    for key, (mean, sd) in summary.items():
        print(f"{key}: n=4, mean={mean:g} ms, sample SD={sd:.6f} ms")
    print(f"Exported {WIDTH_MM} × {HEIGHT_MM} mm; PNG {DPI} dpi: {output}")


if __name__ == "__main__":
    main()
