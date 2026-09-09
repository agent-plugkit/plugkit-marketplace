#!/usr/bin/env python3
"""Validate annotated HTML and embed the bundled offline diagram runtime."""
import argparse
import json
import math
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

START = '<!-- musekit-runtime:start -->'
END = '<!-- musekit-runtime:end -->'


class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.objects = {}
        self.labels = []
        self.regions = []
        self.roots = 0
        self.config = ''
        self.state = ''
        self.read_config = False
        self.read_state = False
        self.read_style = False
        self.styles = []
        self.errors = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        roles = [k for k in ('data-diagram-node', 'data-diagram-group', 'data-diagram-row', 'data-diagram-label') if k in a]
        if len(roles) > 1:
            self.errors.append('同一元素只能声明一种图解对象角色')
        if a.get('style'):
            self.styles.append(a['style'])
        if tag == 'style':
            self.read_style = True
        if a.get('id'):
            if a['id'] in self.ids:
                self.errors.append('重复 HTML id: ' + a['id'])
            self.ids.add(a['id'])
        for key in ('data-diagram-node', 'data-diagram-group', 'data-diagram-row'):
            if key in a:
                identity = a[key]
                if not identity or not re.fullmatch(r'[A-Za-z][\w.-]*', identity):
                    self.errors.append('对象标识需以字母开头，仅含字母、数字、下划线、点或横线')
                if identity in self.objects:
                    self.errors.append('重复对象标识: ' + identity)
                self.objects[identity] = key
        if 'data-diagram' in a:
            self.roots += 1
        if 'data-diagram-region' in a:
            self.regions.append(a['data-diagram-region'])
        if 'data-diagram-label' in a:
            self.labels.append(a['data-diagram-label'])
        if tag == 'script' and a.get('id') == 'diagram-config':
            self.read_config = True
        if tag == 'script' and a.get('id') == 'diagram-state':
            self.read_state = True
        if self.read_config or self.read_state:
            if a.get('type') != 'application/json':
                self.errors.append('图解配置与状态必须使用 application/json')
        if tag in ('script', 'img', 'link', 'image', 'use', 'iframe', 'source', 'video', 'audio'):
            resource = a.get('src') or a.get('href') or a.get('xlink:href') or ''
            if resource and not resource.startswith(('data:', '#')):
                self.errors.append('请先内嵌资源: ' + resource)

    def handle_endtag(self, tag):
        if tag == 'script':
            self.read_config = False
            self.read_state = False
        if tag == 'style':
            self.read_style = False

    def handle_data(self, data):
        if self.read_config:
            self.config += data
        if self.read_state:
            self.state += data
        if self.read_style:
            self.styles.append(data)


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def valid_port(port):
    return (isinstance(port, dict) and port.get('side') in ('left', 'right', 'top', 'bottom')
            and finite(port.get('at', .5)) and 0 <= port.get('at', .5) <= 1)


def valid_points(points):
    return isinstance(points, list) and all(
        isinstance(point, dict) and finite(point.get('x')) and finite(point.get('y'))
        for point in points)


def validate(text):
    d = Document()
    d.feed(text)
    if d.roots != 1:
        d.errors.append('必须且只能有一个 data-diagram 画布')
    if d.regions.count('body') != 1:
        d.errors.append('必须且只能有一个主体区域')
    for region in ('header', 'footer'):
        if d.regions.count(region) > 1:
            d.errors.append('区域不能重复: ' + region)
    for css in d.styles:
        if re.search(r'@import\b', css, re.I):
            d.errors.append('请直接内嵌 CSS，不能使用 @import')
        for resource in re.findall(r'url\(\s*[\'"]?([^\'"\)]+)', css, re.I):
            if not resource.strip().startswith(('data:', '#')):
                d.errors.append('请先内嵌 CSS 资源: ' + resource)
    try:
        config = json.loads(d.config)
        if config.get('version') != 1 or not isinstance(config.get('edges'), list):
            raise ValueError('diagram-config 需要 version: 1 和 edges 数组')
        for key in ('gap', 'rowGap'):
            if key in config and (not finite(config[key]) or config[key] < 0):
                raise ValueError(key + ' 必须为非负有限数值')
        if config.get('portDistribution', 'center') not in ('center', 'spread'):
            raise ValueError('portDistribution 只支持 center 或 spread')
        ids = set()
        for edge in config['edges']:
            identity = edge.get('id')
            if not isinstance(identity, str) or not re.fullmatch(r'[A-Za-z][\w.-]*', identity):
                d.errors.append('连线缺少有效 id')
            if identity in ids:
                d.errors.append('重复连线: ' + str(identity))
            if identity in d.objects:
                d.errors.append('连线与对象不能使用同一标识: ' + str(identity))
            ids.add(identity)
            for key in ('from', 'to'):
                if edge.get(key) not in d.objects:
                    d.errors.append(f'{identity}: {key} 端点不存在')
            if edge.get('kind', 'orthogonal') not in ('orthogonal', 'straight', 'loop', 'sequence'):
                d.errors.append(f'{identity}: 不支持的连线类型')
            if edge.get('kind') == 'sequence' and d.objects.get(edge.get('row')) != 'data-diagram-row':
                d.errors.append(f'{identity}: 时序消息缺少行对象')
            for key in ('fromPort', 'toPort'):
                if key in edge:
                    port = edge[key]
                    if not valid_port(port):
                        d.errors.append(f'{identity}: 无效端口')
            if 'points' in edge and not valid_points(edge['points']):
                d.errors.append(f'{identity}: 无效折点坐标')
        if len(set(d.labels)) != len(d.labels):
            d.errors.append('同一连线只能有一个标签容器')
        for label in d.labels:
            if label not in ids:
                d.errors.append('标签引用不存在的连线: ' + label)
        if d.state:
            state = json.loads(d.state)
            if state.get('version') != 1:
                raise ValueError('diagram-state 需要 version: 1')
            if not finite(state.get('bodyOffset', 0)):
                raise ValueError('bodyOffset 必须为有限数值')
            for identity, node in state.get('nodes', {}).items():
                if identity not in d.objects:
                    raise ValueError('布局引用不存在的对象: ' + identity)
                for key in ('dx', 'dy', 'w', 'h'):
                    if key in node and (not finite(node[key]) or (key in ('w', 'h') and node[key] <= 0)):
                        raise ValueError(identity + ': 无效节点尺寸或位移')
            for identity, edge in state.get('edges', {}).items():
                if identity not in ids:
                    raise ValueError('布局引用不存在的连线: ' + identity)
                for key in ('fromPort', 'toPort'):
                    if key in edge and not valid_port(edge[key]):
                        raise ValueError(identity + ': 无效布局端口')
                if 'points' in edge and not valid_points(edge['points']):
                    raise ValueError(identity + ': 无效折点坐标')
                for value in edge.get('label', {}).values():
                    if not finite(value):
                        raise ValueError(identity + ': 无效标签偏移')
    except (ValueError, TypeError, KeyError, AttributeError) as error:
        d.errors.append('无效 diagram-config: ' + str(error))
    if d.errors:
        raise ValueError('\n'.join(d.errors))


def prepare(text):
    bare = re.sub(re.escape(START) + r'[\s\S]*?' + re.escape(END), '', text).rstrip()
    validate(bare)
    runtime = (Path(__file__).resolve().parent.parent / 'assets' / 'diagram-runtime.js').read_text()
    block = START + '\n<script>\n' + runtime.replace('</script', '<\\/script') + '\n</script>\n' + END
    if not re.search(r'</body\s*>', bare, re.I):
        raise ValueError('缺少 </body>')
    # A fixed insertion point makes repeated packaging byte-stable.
    return re.sub(r'\s*</body\s*>', lambda _: '\n' + block + '\n</body>', bare, count=1, flags=re.I) + '\n'


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('input', type=Path)
    p.add_argument('--output', type=Path, help='生成新 HTML；不指定时仅校验')
    p.add_argument('--check', action='store_true', help='验证已内嵌运行资源是否最新')
    args = p.parse_args()
    try:
        text = args.input.read_text()
        output = prepare(text)
        if args.check:
            pattern = re.escape(START) + r'[\s\S]*?' + re.escape(END)
            # Saving in the browser may move the state script after the runtime.
            # Resource freshness is independent of that harmless DOM serialization.
            blocks = re.findall(pattern, text)
            if blocks != re.findall(pattern, output):
                raise ValueError('内嵌运行资源不是当前版本，请重新封装')
        if args.output:
            args.output.write_text(output)
        print('图解接入校验通过' + ('；已生成 ' + str(args.output) if args.output else ''))
        return 0
    except (ValueError, OSError) as error:
        print('图解封装失败: ' + str(error), file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
