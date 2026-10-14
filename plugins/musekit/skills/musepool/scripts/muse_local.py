#!/usr/bin/env python3
"""musepool 本地检索工具 —— 纯标准库,检索不联网。

用法(在 skill 目录下运行,或用绝对路径):

  python3 scripts/muse_local.py list [--scenario ui|graphic|information]
  python3 scripts/muse_local.py search "dark monochrome typography" [--scenario graphic] [-n 5]
  python3 scripts/muse_local.py show <id|文件名>          # 打印完整 seed(含深度参考)
  python3 scripts/muse_local.py status                   # 当前 seed 库的来源、版本与本机缓存
  python3 scripts/muse_local.py update [--version X.Y.Z] # 从 Muspro Seeds 的 GitHub Release 更新本机缓存
  python3 scripts/muse_local.py update --from <tar.gz> [--manifest <manifest.json>]   # 离线安装
  python3 scripts/muse_local.py update --rollback        # 切回上一版缓存,没有上一版时回到内置快照

seed 库按以下顺序查找,用到哪一份会在输出中注明来源与版本:
  1. 环境变量 MUSEPOOL_SEEDS_DIR 指向的目录(只用于自定义 seed 库;指向内置快照而本机缓存
     有更新版本时照常使用该目录,但在 stderr 与 status 中警告);
  2. 本机缓存 ${MUSEKIT_CACHE_DIR:-${XDG_CACHE_HOME:-~/.cache}/musekit}/seeds/:
     每次安装解压到新的 <版本>-<随机后缀>/ 目录,安装后不再改动;state.json 记录 current 与
     previous 及安装时的 contentHash,切换版本只原子替换这个文件;
     缓存损坏、内容与记录不符、schema 不兼容或版本旧于内置快照时跳过;
  3. 随 Skill 分发的内置快照 seeds/。
只有 update 会联网;安装必须有发布包对应的 manifest.json 并通过 sha256 与 contentHash 校验,
失败时不改动当前使用的 seed 库。update 与 rollback 持有缓存锁,同一时间只允许一个。

search 在 gist / category / tags / core_dimensions 及 seed 正文上做大小写不敏感的
关键词打分。英文查询词从词首匹配:bar 不命中 sidebar,animat 命中 animation。连字符和点连成的是
一个词:bar 不命中 three-bar,index 不命中 z-index,paper 不命中 paper.js(category、tags 与
core_dimensions 例外,其中的连字符当词间空格,tags 本是 slug)。正文不计前置元数据(category、
tags 与 core_dimensions 另由索引提供)、代码块、行内代码、HTML 注释与 CSS 片段。查询中的中文按
zh_terms.json 做最长匹配切词并展开为英文同义词(按整词匹配;不计章节标题这类每个 seed 都有的
模板文字,也不计 no-motion、sans-serif 这类否定写法),原文也匹配库内中文标题和摘要(scenarios.json)。
所有检索单元都命中、且至少一个命中在 gist、category、tags、core_dimensions 或中文标题摘要的结果是
可靠命中,标 ★ 排在最前。查询里有词表未识别的中文词时不标 ★。没有 ★ 时列出关键字段命中部分查询词的
条目(按命中词数、关键字段命中数、novelty 排序,注明命中与未命中的词),只在正文里提到的不列,
并提示换更具体的英文短语。
"""
from __future__ import annotations

import argparse
import contextlib
import gzip
import hashlib
import io
import json
import os
import re
import shutil
import socket
import sys
import tarfile
import tempfile
import urllib.error
import urllib.request
import zlib
from pathlib import Path

BUNDLED_DIR = Path(__file__).resolve().parent.parent / "seeds"
ZH_TERMS_FILE = Path(__file__).resolve().parent / "zh_terms.json"
SCENARIOS = ("ui", "graphic", "information")
SUPPORTED_SCHEMA_MAJOR = 1
PACKAGE = "muspro-seeds"
RELEASE_BASE = "https://github.com/agent-plugkit/muspro-seeds"
VERSION_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")
INSTALL_RE = re.compile(r"^(\d+\.\d+\.\d+)-([a-z0-9_]{1,32})$")
HASH_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
TARBALL_RE = re.compile(r"^[A-Za-z0-9._-]+\.tar\.gz$")
SOURCE_LABELS = {"env": "MUSEPOOL_SEEDS_DIR", "cache": "本机缓存", "bundled": "内置快照"}
CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+")
SECTION_RE = re.compile(r"(?m)^# .*$")
# 不参与匹配的正文:Muspro Seeds 按分类写入的借鉴范围说明(与 scenario 取值等价)、代码块、
# 行内代码、HTML 注释,以及正文里的 CSS 片段(z-index: 100、display: grid;、cubic-bezier(...)、var(--x))。
SCOPE_NOTE_RE = re.compile(r"(?m)^> 借鉴范围[:：].*$")
# 代码块与注释块逐行识别,先出现的一方说了算(注释里的 ``` 不开围栏,代码里的 <!-- 不开注释):
# - 围栏用简单规则:一行去掉任意缩进、引用标记(>)和列表标记(- 、* 、+ 、1. 、1) )后以 ``` 或 ~~~ 开头,
#   就从这一行起排除,直到同样去掉这些前缀后只剩同字符、不短于开头的结束围栏的行,没有结束围栏时到文末。
#   反引号围栏的信息串里不能再有反引号(```a``` 是行内代码)。
#   已知限制:不跟踪引用块和列表项何时结束,也不按 CommonMark 把缩进 4 列以上的围栏行当缩进代码;
#   列表里没闭合的围栏会一直排除到文末。这些都是少见的 Markdown 写法,真实 seed 中出现 0 次。
# - 缩进代码块:比所在列表项的内容多缩进 4 列,且不接在段落行后面(段落的续行不算)。
# - 注释块:以 <!-- 开头的行,到含 --> 的行为止;--> 之后的文字照常参与匹配。
FENCE_PREFIX = r"(?:[ \t]*(?:>|(?:[-*+]|[0-9]{1,9}[.)])[ \t]))*[ \t]*"
FENCE_OPEN_RE = re.compile(rf"{FENCE_PREFIX}(?:(`{{3,}})(?!.*`)|(~{{3,}}))")
FENCE_LINE_RE = re.compile(rf"{FENCE_PREFIX}([`~]+)[ \t]*$")
LIST_ITEM_RE = re.compile(r"(?:[-*+]|[0-9]{1,9}[.)])(?:[ ]+|$)")
HEADING_RE = re.compile(r"#{1,6}(?:[ ]|$)")
# 段落内的行内代码与 HTML 注释:可以跨行,但不跨空行;行内代码两侧反引号串等长;两者谁先出现按谁处理。
INLINE_CODE_RE = re.compile(r"(?<!`)(`+)(?!`)(?:(?!\n[ \t]*\n).)+?(?<!`)\1(?!`)|<!--(?:(?!\n[ \t]*\n).)*?-->", re.S)
# CSS 声明只认常见的 CSS 属性名、自定义属性(--x)与浏览器前缀(-webkit-x):vector-based: geometric
# 这类带连字符的正文标签不算。font、color、content 这类单词属性名也常作正文标签(Font: a serif …),
# 只有紧贴冒号(display:none)或以分号结尾时才算声明,且取值是单个关键词(display: grid;)、带数字、
# 颜色、函数(transition: opacity 0.3s ease;),或是可取多个关键词的简写属性(border: solid red;、
# background: center center;);order 这类只取单值的属性 Order: tier name; 仍是正文。
# 以分号结尾的声明整条取值都删去,包括逗号、斜杠分隔的列表和字符串(font-family: 'ui sans', monospace;、
# grid-template-columns: minmax(0, 1fr) auto;);没有分号时只删到第一个关键词及其后的数字、颜色与函数,
# 以免吞掉 letter-spacing: 1px on input 这类正文说明。
# 声明以外只认常见 CSS 函数(cubic-bezier(...)、var(--x)、rgba(...)),正文里的 image(s) 不算。
CSS_PROPERTIES = """
    accent-color align-content align-items align-self animation-delay animation-direction animation-duration
    animation-fill-mode animation-iteration-count animation-name animation-timing-function aspect-ratio
    backdrop-filter backface-visibility background-attachment background-blend-mode background-clip
    background-color background-image background-origin background-position background-repeat background-size
    block-size border-block border-bottom border-bottom-left-radius border-bottom-right-radius border-collapse
    border-color border-image border-inline border-left border-radius border-right border-spacing border-style
    border-top border-top-left-radius border-top-right-radius border-width box-decoration-break box-shadow
    box-sizing caret-color clip-path color-scheme column-count column-gap column-rule column-width
    container-type counter-increment counter-reset flex-basis flex-direction flex-flow flex-grow flex-shrink
    flex-wrap font-display font-family font-feature-settings font-kerning font-optical-sizing font-size
    font-smoothing font-stretch font-style font-synthesis font-variant font-variant-caps font-variant-ligatures
    font-variant-numeric font-variation-settings font-weight grid-area grid-auto-columns grid-auto-flow
    grid-auto-rows grid-column grid-column-end grid-column-start grid-gap grid-row grid-row-end grid-row-start
    grid-template grid-template-areas grid-template-columns grid-template-rows hanging-punctuation
    image-rendering inline-size inset-block inset-inline justify-content justify-items justify-self
    letter-spacing line-break line-clamp line-height list-style list-style-type margin-block margin-bottom
    margin-inline margin-left margin-right margin-top mask-image max-block-size max-height max-inline-size
    max-width min-block-size min-height min-inline-size min-width mix-blend-mode object-fit object-position
    offset-path outline-color outline-offset outline-style outline-width overflow-anchor overflow-wrap
    overflow-x overflow-y overscroll-behavior padding-block padding-bottom padding-inline padding-left
    padding-right padding-top page-break-after page-break-before paint-order perspective-origin place-content
    place-items place-self pointer-events row-gap scroll-behavior scroll-margin scroll-margin-top scroll-padding
    scroll-padding-top scroll-snap-align scroll-snap-stop scroll-snap-type scrollbar-color scrollbar-gutter
    scrollbar-width shape-outside stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-width
    tab-size table-layout text-align text-align-last text-decoration text-decoration-color text-decoration-line
    text-decoration-style text-decoration-thickness text-emphasis text-indent text-justify text-orientation
    text-overflow text-rendering text-shadow text-size-adjust text-transform text-underline-offset
    text-underline-position text-wrap touch-action transform-origin transform-style transition-delay
    transition-duration transition-property transition-timing-function unicode-bidi user-select vertical-align
    view-transition-name white-space will-change word-break word-spacing word-wrap writing-mode z-index
""".split()
CSS_SHORT_PROPERTIES = """
    animation background border bottom clear color contain content cursor display fill filter flex float font
    gap height hyphens inset isolation left margin opacity order outline overflow padding perspective position
    quotes resize right rotate scale stroke top transform transition translate visibility width zoom
""".split()
# 取值可以是多个关键词的简写属性(border: solid red;、overflow: hidden auto;)。
CSS_MULTI_KEYWORD_PROPERTIES = """
    animation background border display flex font inset margin outline overflow padding transition
""".split()
CSS_FUNCTIONS = """
    attr calc clamp color-mix conic-gradient cubic-bezier drop-shadow env fit-content hsl hsla hue-rotate hwb
    lch linear-gradient matrix matrix3d max min minmax oklab oklch radial-gradient repeating-conic-gradient
    repeating-linear-gradient repeating-radial-gradient rgb rgba rotate rotate3d rotatex rotatey rotatez scale
    scale3d scalex scaley skew skewx skewy translate translate3d translatex translatey translatez url var
""".split()
CSS_ARGS = r"(?:[^()\n\u3400-\u9fff]|\([^()\n\u3400-\u9fff]*\))*"
CSS_FUNCTION = rf"-?[a-z][a-z0-9]*(?:-[a-z0-9]+)*\({CSS_ARGS}\)"
CSS_VALUE = rf"(?:{CSS_FUNCTION}|[#a-z0-9_.%-]+)(?:[ \t]+(?:{CSS_FUNCTION}|[-#.]?[0-9][a-z0-9_.%]*))*(?:[ \t]*!important)?"
CSS_TOKEN = rf"(?:{CSS_FUNCTION}|'[^'\n]*'|\"[^\"\n]*\"|[#a-z0-9_.%-]+)"
CSS_DECLARATION = rf"{CSS_TOKEN}(?:(?:[ \t]*[,/][ \t]*|[ \t]+){CSS_TOKEN})*(?:[ \t]*!important)?[ \t]*;"
CSS_NAMES = "|".join(sorted(CSS_PROPERTIES, key=len, reverse=True))
CSS_SHORT_NAMES = "|".join(sorted(CSS_SHORT_PROPERTIES, key=len, reverse=True))
CSS_MULTI_NAMES = "|".join(sorted(CSS_MULTI_KEYWORD_PROPERTIES, key=len, reverse=True))
CSS_KNOWN_FUNCTION = (rf"(?:-(?:webkit|moz|ms|o)-)?(?:{'|'.join(sorted(CSS_FUNCTIONS, key=len, reverse=True))})"
                      rf"\({CSS_ARGS}\)")
CSS_RE = re.compile(rf"(?<![a-z0-9_-])(?:(?:{CSS_NAMES}|--[a-z0-9-]+|-(?:webkit|moz|ms|o)-[a-z]+(?:-[a-z]+)*)"
                    rf"[ \t]*:[ \t]*(?:{CSS_DECLARATION}|{CSS_VALUE};?)"
                    rf"|(?:{CSS_NAMES}|{CSS_SHORT_NAMES}):(?=[#a-z0-9_.'\"-])(?:{CSS_DECLARATION}|{CSS_VALUE};?)"
                    rf"|(?:{CSS_SHORT_NAMES})[ \t]*:[ \t]*(?:[#a-z0-9_.%-]+(?:[ \t]*!important)?[ \t]*;"
                    rf"|(?=[^;\n]*[0-9#(]){CSS_DECLARATION})"
                    rf"|(?:{CSS_MULTI_NAMES})[ \t]*:[ \t]*{CSS_DECLARATION}"
                    rf"|{CSS_KNOWN_FUNCTION})")
# 连字符和点连成的是一个词:three-bar、z-index、paper.js 里的 bar、index、paper 都不算独立出现。
JOINED_BEFORE = r"(?<![a-z0-9][-.])"
JOINED_AFTER = r"(?![-.][a-z0-9])"
# 紧跟在这些否定词之后的英文同义词不算命中:no motion、zero radius、without animation;
# sans 只在 sans-serif / sans serif 里表示否定(sans typeface 仍是字体)。
NEGATED = r"(?<!\bno[\s-])(?<!\bnon[\s-])(?<!\bzero[\s-])(?<!\bwithout[\s-])(?<!\bsans[\s-](?=serif))"
STATE_FILE = "state.json"
STAGING_PREFIX = ".staging-"
# 发布包体积与条目上限,防止异常包耗尽内存或磁盘。
MAX_ARCHIVE_BYTES = 64 * 1024 * 1024
MAX_UNPACKED_BYTES = 256 * 1024 * 1024
MAX_MEMBERS = 10000
# 归档与索引中的路径只接受规范的 POSIX 相对路径;反斜杠、盘符冒号、控制字符和
# Windows 保留名在某些系统上会被解释成别的位置,一律拒绝。
UNSAFE_PATH_CHARS = re.compile(r'[\\:*?"<>|\x00-\x1f]')
WINDOWS_RESERVED = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}


class LibraryError(Exception):
    pass


class UpdateError(Exception):
    pass


class Library:
    def __init__(self, directory: Path, kind: str, entries: list[dict], texts: dict[str, str],
                 version: str | None, schema: str | None):
        self.dir = directory
        self.kind = kind
        self.entries = entries
        self.texts = texts
        self.version = version
        self.schema = schema
        self.is_bundled_dir = kind == "bundled"
        self._labels: dict[str, str] | None = None
        self._bodies: dict[str, str] = {}
        self._docs: dict[tuple[str, str], Doc] = {}

    def describe(self) -> str:
        version = f"{PACKAGE} {self.version}" if self.version else "未标版本"
        where = "" if self.kind == "bundled" else f"({self.dir})"
        source = SOURCE_LABELS[self.kind] + ("(指向内置快照)" if self.kind == "env" and self.is_bundled_dir else "")
        return f"来源:{source} · {version}{where}"

    def display_path(self, entry: dict) -> str:
        return f"seeds/{entry['file']}" if self.kind == "bundled" else str(self.dir.joinpath(*entry["file"].split("/")))

    def text(self, entry: dict) -> str:
        return self.texts[entry["file"]]

    def body(self, entry: dict) -> str:
        """参与检索的正文:去掉前置元数据、借鉴范围说明、代码与 CSS 片段后的小写文本。"""
        if entry["file"] not in self._bodies:
            text = SCOPE_NOTE_RE.sub(" ", without_frontmatter(self.text(entry)))
            self._bodies[entry["file"]] = without_code(text)
        return self._bodies[entry["file"]]

    def doc(self, entry: dict, labels: str = "") -> "Doc":
        key = (entry["file"], labels)
        if key not in self._docs:
            self._docs[key] = Doc(self, entry, labels)
        return self._docs[key]

    def zh_labels(self) -> dict[str, str]:
        """各 seed 的中文标题与摘要(scenarios.json,及索引条目里可选的 labels.zh-CN),按小写 id 索引。

        只用于中文检索;文件缺失或格式不对时当作没有中文标签。"""
        if self._labels is None:
            labels: dict[str, list[str]] = {}
            path = self.dir / "scenarios.json"
            try:
                data = json.loads(path.read_bytes().decode("utf-8")) if inside(self.dir, path) else None
            except (OSError, ValueError):
                data = None
            groups = data.get("scenarios") if isinstance(data, dict) else None
            for group in groups if isinstance(groups, list) else []:
                seeds = group.get("seeds") if isinstance(group, dict) else None
                for seed in seeds if isinstance(seeds, list) else []:
                    if isinstance(seed, dict) and isinstance(seed.get("id"), str):
                        labels.setdefault(seed["id"].lower(), []).extend(
                            value for value in (seed.get("title"), seed.get("summary")) if isinstance(value, str))
            for entry in self.entries:
                extra = entry.get("labels")
                if isinstance(extra, dict) and extra.get("zh-CN") is not None:
                    labels.setdefault(entry["id"].lower(), []).append(flat_tags(extra["zh-CN"]))
            self._labels = {key: " ".join(values).lower() for key, values in labels.items()}
        return self._labels


def parse_version(value) -> tuple[int, int, int] | None:
    match = VERSION_RE.match(str(value or ""))
    return tuple(int(part) for part in match.groups()) if match else None


def schema_major(value) -> int | None:
    match = re.match(r"^(\d+)\.", str(value or ""))
    return int(match.group(1)) if match else None


def safe_parts(name) -> tuple[str, ...] | None:
    """把归档或索引里的路径拆成安全的组成部分;不规范时返回 None。"""
    if not isinstance(name, str) or not name or name.startswith("/") or UNSAFE_PATH_CHARS.search(name):
        return None
    parts = name[:-1].split("/") if name.endswith("/") else name.split("/")
    for part in parts:
        if part in ("", ".", "..") or part.endswith((" ", ".")):
            return None
        if part.split(".")[0].upper() in WINDOWS_RESERVED:
            return None
    return tuple(parts)


def inside(root: Path, path: Path) -> bool:
    root_text, path_text = os.path.realpath(root), os.path.realpath(path)
    try:
        return os.path.commonpath([root_text, path_text]) == root_text
    except ValueError:  # Windows 上位于不同盘符
        return False


def is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def entry_problem(entry) -> str | None:
    """检查命令实际用到的索引字段,返回第一个问题。"""
    if not isinstance(entry, dict):
        return "条目不是对象"
    for key in ("id", "file", "scenario", "category"):
        if not isinstance(entry.get(key), str) or not entry[key]:
            return f"缺少 {key}"
    if entry["scenario"] not in SCENARIOS:
        return f"scenario {entry['scenario']} 不是 {'/'.join(SCENARIOS)} 之一"
    if "gist" in entry and not isinstance(entry["gist"], str):
        return "gist 不是字符串"
    dimensions = entry.get("core_dimensions")
    if dimensions is not None and not (isinstance(dimensions, list) and all(isinstance(d, str) for d in dimensions)):
        return "core_dimensions 不是字符串列表"
    scores = entry.get("scores")
    if scores is not None and not (isinstance(scores, dict) and is_number(scores.get("novelty", 0))):
        return "scores.novelty 不是数字"
    if not isinstance(entry.get("tags"), (dict, list, str, type(None))):
        return "tags 格式无法识别"
    return None


def content_hash(directory: Path) -> str:
    # 与 Muspro Seeds 相同:对排序后的 "<sha256>  <相对路径>\n" 清单再取 sha256。
    lines = []
    for path in directory.rglob("*"):
        if path.is_file():
            relative = path.relative_to(directory).as_posix()
            lines.append((relative, f"{sha256(path.read_bytes())}  {relative}\n"))
    lines.sort(key=lambda item: item[0])
    return "sha256:" + sha256("".join(line for _, line in lines).encode("utf-8"))


def load_library(directory: Path, kind: str, expected_hash: str | None = None) -> Library:
    """读取并检查一份 seed 库,连同全部 seed 正文;任何问题都抛出 LibraryError。"""
    index = directory / "index.json"
    try:
        data = json.loads(index.read_bytes().decode("utf-8"))
    except FileNotFoundError:
        raise LibraryError(f"找不到索引 {index}") from None
    except (OSError, ValueError) as error:
        raise LibraryError(f"索引无法读取:{index}({error})") from None
    if isinstance(data, list) and kind == "env":
        entries, version, schema = data, None, None
    elif isinstance(data, dict) and isinstance(data.get("seeds"), list):
        entries, version, schema = data["seeds"], data.get("version"), data.get("schemaVersion")
        if schema_major(schema) != SUPPORTED_SCHEMA_MAJOR:
            raise LibraryError(
                f"schemaVersion {schema} 与本 Musekit 支持的 {SUPPORTED_SCHEMA_MAJOR}.x 不兼容,请升级 Musekit")
    else:
        raise LibraryError(f"索引格式无法识别:{index}")
    texts: dict[str, str] = {}
    seen: set[str] = set()
    for entry in entries:
        problem = entry_problem(entry)
        if problem:
            raise LibraryError(f"索引条目无效({problem}):{index}")
        if entry["id"].lower() in seen:
            raise LibraryError(f"索引中 id 重复:{entry['id']}")
        seen.add(entry["id"].lower())
        parts = safe_parts(entry["file"])
        path = directory.joinpath(*parts) if parts else None
        if not path or not inside(directory, path):
            raise LibraryError(f"索引引用了不安全的路径:{entry['file']}")
        try:
            texts[entry["file"]] = path.read_bytes().decode("utf-8")
        except FileNotFoundError:
            raise LibraryError(f"索引引用的文件不存在:{entry['file']}") from None
        except (OSError, ValueError) as error:
            raise LibraryError(f"seed 无法读取:{entry['file']}({error})") from None
    if expected_hash:
        try:
            actual = content_hash(directory)
        except OSError as error:
            raise LibraryError(f"无法校验内容:{error}") from None
        if actual != expected_hash:
            raise LibraryError("内容与安装时记录的 contentHash 不一致,文件可能被改动或损坏")
    return Library(directory, kind, entries, texts, version, schema)


def fail(message: str):
    sys.stderr.write(f"muse_local: {message}\n")
    raise SystemExit(2)


def cache_root() -> Path:
    if os.environ.get("MUSEKIT_CACHE_DIR"):
        return Path(os.environ["MUSEKIT_CACHE_DIR"]).expanduser()
    base = os.environ.get("XDG_CACHE_HOME") or str(Path.home() / ".cache")
    return Path(base).expanduser() / "musekit"


def seeds_cache() -> Path:
    return cache_root() / "seeds"


# ---------------------------------------------------------------------------
# 缓存状态:state.json = {"current": 安装记录 | null, "previous": 安装记录 | null}
# 安装记录 = {"dir", "version", "schemaVersion", "contentHash"}


def valid_record(record) -> bool:
    if not isinstance(record, dict):
        return False
    match = INSTALL_RE.match(str(record.get("dir", "")))
    return bool(match and match.group(1) == record.get("version") and HASH_RE.match(str(record.get("contentHash", "")))
                and isinstance(record.get("schemaVersion"), str))


def read_state() -> tuple[dict, str | None]:
    """返回 (状态, 提示);文件缺失视为空状态,损坏时返回空状态并说明。"""
    path = seeds_cache() / STATE_FILE
    try:
        data = json.loads(path.read_bytes().decode("utf-8"))
    except (FileNotFoundError, NotADirectoryError):
        return {"current": None, "previous": None}, None
    except (OSError, ValueError) as error:
        return {"current": None, "previous": None}, f"本机缓存状态 {path} 无法读取({error}),已忽略本机缓存"
    if not isinstance(data, dict):
        return {"current": None, "previous": None}, f"本机缓存状态 {path} 格式无法识别,已忽略本机缓存"
    state, broken = {}, []
    for key in ("current", "previous"):
        record = data.get(key)
        if record is not None and not valid_record(record):
            broken.append(key)
            record = None
        state[key] = record
    note = f"本机缓存状态 {path} 的 {'/'.join(broken)} 记录无效,已忽略" if broken else None
    return state, note


def write_state(state: dict) -> None:
    cache = seeds_cache()
    handle, temporary = tempfile.mkstemp(dir=cache, prefix=".state-", suffix=".tmp")
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            json.dump(state, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, cache / STATE_FILE)
    except BaseException:
        with contextlib.suppress(OSError):
            os.unlink(temporary)
        raise


def load_cached(record: dict) -> Library:
    library = load_library(seeds_cache() / record["dir"], "cache", record["contentHash"])
    if library.version != record["version"]:
        raise LibraryError(f"索引版本 {library.version} 与安装记录 {record['version']} 不一致")
    return library


@contextlib.contextmanager
def cache_lock():
    """update 与 rollback 的互斥锁;进程退出时由系统释放,不会残留。"""
    cache = seeds_cache()
    cache.mkdir(parents=True, exist_ok=True)
    stream = open(cache / ".lock", "a+b")
    locked = False
    try:
        try:
            if os.name == "nt":
                import msvcrt
                stream.seek(0)
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            locked = True
        except OSError:
            raise UpdateError("另一个 update 或 rollback 正在修改本机缓存,等它结束后重试") from None
        yield
    finally:
        if locked and os.name == "nt":
            import msvcrt
            with contextlib.suppress(OSError):
                stream.seek(0)
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
        stream.close()


def collect_garbage(state: dict) -> None:
    """持锁时清理不再被 state.json 引用的安装目录,以及中断留下的临时文件。"""
    keep = {record["dir"] for record in (state.get("current"), state.get("previous")) if record}
    cache = seeds_cache()
    try:
        children = list(cache.iterdir())
    except OSError:
        return
    for child in children:
        name = child.name
        if name.startswith(".state-") and name.endswith(".tmp"):
            with contextlib.suppress(OSError):
                child.unlink()
        elif (INSTALL_RE.match(name) and name not in keep) or name.startswith(STAGING_PREFIX):
            shutil.rmtree(child, ignore_errors=True)


def bundled_library() -> Library:
    try:
        return load_library(BUNDLED_DIR, "bundled")
    except LibraryError as error:
        fail(f"内置快照不可用:{error}")


def cached_library(bundled: Library, notes: list[str]) -> Library | None:
    state, note = read_state()
    if note:
        notes.append(note)
    record = state["current"]
    if not record:
        return None
    try:
        library = load_cached(record)
    except LibraryError as error:
        notes.append(f"本机缓存 {record['version']} 无法使用:{error};已回退内置快照。"
                     "可运行 update 重新安装或 update --rollback")
        return None
    if (parse_version(library.version) or (0, 0, 0)) < (parse_version(bundled.version) or (0, 0, 0)):
        notes.append(f"本机缓存 {record['version']} 旧于内置快照 {bundled.version},使用内置快照")
        return None
    return library


def same_dir(path: Path, other: Path) -> bool:
    try:
        return os.path.samefile(path, other)
    except OSError:
        return False


def override_dir(override: str) -> Path:
    """MUSEPOOL_SEEDS_DIR 展开 ~ 后的绝对路径;~ 指向不存在的用户、符号链接成环等无法解析时抛 LibraryError。"""
    try:
        return Path(override).expanduser().resolve()
    except (OSError, RuntimeError, ValueError) as error:
        raise LibraryError(f"路径无法解析:{override}({error})") from None


def override_points_to_bundled() -> bool:
    """只给 update 的提示用;路径无法解析时按普通自定义目录提示,不妨碍更新缓存。"""
    override = os.environ.get("MUSEPOOL_SEEDS_DIR")
    if not override:
        return False
    try:
        return same_dir(override_dir(override), BUNDLED_DIR)
    except LibraryError:
        return False


def resolve_library() -> tuple[Library, list[str]]:
    notes: list[str] = []
    override = os.environ.get("MUSEPOOL_SEEDS_DIR")
    if override:
        try:
            library = load_library(override_dir(override), "env")
        except LibraryError as error:
            fail(f"MUSEPOOL_SEEDS_DIR 不可用:{error}。修正该目录或取消这个环境变量")
        # 显式设置的变量照常生效;但它指向内置快照时多半是误用,本机缓存里有更新版本就明确提醒。
        if same_dir(library.dir, BUNDLED_DIR):
            library.is_bundled_dir = True
            cached = cached_library(library, [])
            if cached and parse_version(cached.version) > (parse_version(library.version) or (0, 0, 0)):
                notes.append(
                    f"警告:MUSEPOOL_SEEDS_DIR 指向 Skill 内置快照,正在使用内置快照 {PACKAGE} {library.version};"
                    f"本机缓存有更新的 {cached.version} 未被使用。MUSEPOOL_SEEDS_DIR 只用于自定义 seed 库,"
                    "取消这个变量后直接运行即可按查找顺序使用本机缓存")
        return library, notes
    bundled = bundled_library()
    return cached_library(bundled, notes) or bundled, notes


def open_library() -> Library:
    library, notes = resolve_library()
    for note in notes:
        sys.stderr.write(f"muse_local: {note}\n")
    return library


def flat_tags(tags, sep: str = " ") -> str:
    if isinstance(tags, dict):
        return sep.join(str(v) for vs in tags.values() for v in (vs if isinstance(vs, list) else [vs]))
    if isinstance(tags, list):
        return sep.join(map(str, tags))
    return str(tags or "")


def descriptors(entry: dict, sep: str = " ") -> str:
    """category、tags 与 core_dimensions:标明 seed 主题的结构化字段。"""
    return sep.join([entry.get("category", ""), flat_tags(entry.get("tags"), sep),
                     sep.join(entry.get("core_dimensions") or [])]).lower()


def without_frontmatter(text: str) -> str:
    """去掉前置元数据:id、scenario、modality、view_type、scores 等取值不描述设计内容,
    category 与 tags 由索引字段提供。"""
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end > 0:
            newline = text.find("\n", end + 1)
            return "" if newline < 0 else text[newline:]
    return text


def without_blocks(text: str) -> str:
    """把围栏代码块(含开头与结束围栏)、缩进代码块和 HTML 注释块换成空行。"""
    lines: list[str] = []
    fence, comment, paragraph = "", False, False
    items: list[int] = []  # 外层到内层各列表项的内容缩进
    for line in text.split("\n"):
        if fence:
            close = FENCE_LINE_RE.match(line)
            if close and close.group(1).startswith(fence) and not close.group(1).strip(fence[0]):
                fence = ""
            lines.append("")
            continue
        if comment:
            end = line.find("-->")
            if end < 0:
                lines.append("")
                continue
            comment, line = False, line[end + 3:]
            lines.append(line)
            paragraph = bool(line.strip())
            continue
        expanded = line.expandtabs(4)
        content = expanded.lstrip(" ")
        if not content:
            lines.append(line)
            paragraph = False
            continue
        indent = len(expanded) - len(content)
        item = LIST_ITEM_RE.match(content)
        if item or not paragraph:
            while items and indent < items[-1]:
                items.pop()
        base = items[-1] if items else 0
        match = FENCE_OPEN_RE.match(expanded)
        if indent >= base + 4 and not match:
            # 段落的续行照常保留;否则是缩进代码块
            lines.append(line if paragraph else "")
            continue
        if item and indent < base + 4:
            marker = item.group().rstrip()
            spaces = len(item.group()) - len(marker)
            items.append(indent + len(marker) + (spaces if 1 <= spaces <= 4 else 1))
        if match:
            fence = match.group(1) or match.group(2)
            lines.append("")
            paragraph = False
            continue
        if content.startswith("<!--") and "-->" not in content[4:]:
            comment = True
            lines.append("")
            continue
        lines.append(line)
        paragraph = not (HEADING_RE.match(content) or content.startswith("<!--"))
    return "\n".join(lines)


def without_code(text: str) -> str:
    """去掉代码块、行内代码、HTML 注释与 CSS 片段;统一换行符,返回小写文本。"""
    text = without_blocks(text.replace("\r\n", "\n").replace("\r", "\n"))
    return CSS_RE.sub(" ", INLINE_CODE_RE.sub(" ", text).lower())


class Doc:
    """一个 seed 的检索文本。prose 为 gist 与正文,连字符和点连成的词不拆开;fields 为 category、
    tags 与 core_dimensions,其中 tags 是 slug,连字符即词间空格(words 为把连字符换成空格的 fields)。"""

    def __init__(self, library: "Library", entry: dict, labels: str):
        self.gist = without_code(entry.get("gist", ""))
        body = library.body(entry)
        self.prose = f"{self.gist}\n{body}"
        # 中文词展开出的英文同义词不计章节标题(# Motion 等),这类模板文字每个 seed 都有。
        self.plain = f"{self.gist}\n{SECTION_RE.sub('', body)}"
        self.fields = descriptors(entry)
        # 每个取值占一行,查询词里的连字符换成空格后不会跨两个标签(multi-accent blue-dominant 里没有 accent-blue)。
        self.words = descriptors(entry, "\n").replace("-", " ")
        self.labels = labels


# ---------------------------------------------------------------------------
# 中文检索:seed 正文是英文,中文查询按词表展开成英文同义词后再匹配。


def load_zh_terms() -> tuple[dict[str, list[str]], set[str]]:
    """读取 zh_terms.json:terms 为中文词 → 英文同义词,ignore 为切词时跳过的虚词。"""
    try:
        data = json.loads(ZH_TERMS_FILE.read_bytes().decode("utf-8"))
        terms = {str(key): [str(value).lower() for value in values] for key, values in data["terms"].items()
                 if isinstance(values, list)}
        ignore = {str(word) for word in data.get("ignore", [])}
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        sys.stderr.write(f"muse_local: 中文检索词表 {ZH_TERMS_FILE.name} 无法读取({error}),中文词只按原文匹配\n")
        return {}, set()
    return terms, ignore


def segment(run: str, terms: dict[str, list[str]], ignore: set[str]) -> list[tuple[str, str]]:
    """按词表做正向最长匹配,返回 (片段, "term" | "ignore" | "unknown");连续未收录的字合成一个片段。"""
    longest = max((len(word) for word in (*terms, *ignore)), default=1)
    pieces: list[tuple[str, str]] = []
    pending, i = "", 0
    while i < len(run):
        for size in range(min(longest, len(run) - i), 0, -1):
            word = run[i:i + size]
            if word in terms or word in ignore:
                break
        else:
            pending += run[i]
            i += 1
            continue
        if pending:
            pieces.append((pending, "unknown"))
            pending = ""
        pieces.append((word, "term" if word in terms else "ignore"))
        i += size
    if pending:
        pieces.append((pending, "unknown"))
    # 整段都由单字虚词拼成(地图 = 地 + 图)时多半是词表没有收录的词,不当虚词跳过。
    if len(run) > 1 and all(kind == "ignore" and len(piece) == 1 for piece, kind in pieces):
        return [(run, "unknown")]
    return pieces


def term_body(term: str) -> str:
    # 词内空格也匹配连字符。
    return r"[\s-]+".join(re.escape(part) for part in term.split())


def word_pattern(term: str, joined: bool = False) -> re.Pattern:
    # 展开出的英文词按整词匹配(可带复数),避免 plan 命中 explanation 这类子串误配。
    # 下划线连成的是字段名(motion_intensity),不算整词;否定写法(no-motion、sans-serif)见 NEGATED。
    # joined=True 用于正文:连字符和点也连成一个词(three-bar 里没有 bar)。
    before, after = (JOINED_BEFORE, JOINED_AFTER) if joined else ("", "")
    return re.compile(rf"(?<![a-z0-9_]){before}{NEGATED}{term_body(term)}(?:s|es)?(?![a-z0-9_]){after}")


def english_pattern(token: str) -> re.Pattern:
    # 英文查询词在正文里从词首匹配(bar 不命中 sidebar、scrollbar),词尾不限(animat 命中 animation);
    # 连字符和点连成的词不拆开。
    before = rf"(?<![a-z0-9_]){JOINED_BEFORE}" if token[:1].isalnum() else ""
    after = JOINED_AFTER if token[-1:].isalnum() else ""
    return re.compile(before + re.escape(token) + after)


def field_pattern(token: str) -> re.Pattern:
    # fields 里的连字符是词间空格(tags 是 slug),查询词里的连字符同样按空格匹配;同样从词首匹配。
    text = token.replace("-", " ")
    before = r"(?<![a-z0-9_])" if text[:1].isalnum() else ""
    return re.compile(before + re.escape(text))


def denial_pattern(term: str) -> re.Pattern:
    # category/tags 里的 no-motion、non-grid:整理者明确标注没有这一项。
    return re.compile(rf"(?<![a-z0-9_])(?:no|non|without)[\s-]{term_body(term)}(?:s|es)?(?![a-z0-9_])")


class Unit:
    """查询里的一个检索单元:英文词从词首匹配,fields 里连字符当空格,正文里不拆连字符和点连成的词;
    中文词另加英文同义词(整词)与中文标题摘要。"""

    def __init__(self, text: str, synonyms: list[str] | None = None):
        self.text = text
        self.zh = synonyms is not None
        self.synonyms = synonyms or []
        self.english = None if self.zh else english_pattern(text)
        self.field = None if self.zh else field_pattern(text)
        self.patterns = [word_pattern(term) for term in self.synonyms]
        self.prose_patterns = [word_pattern(term, joined=True) for term in self.synonyms]
        self.denials = [denial_pattern(term) for term in self.synonyms]

    def describes(self, fields: str) -> bool:
        return self.text in fields or any(p.search(fields) for p in self.patterns)

    def denied(self, fields: str) -> bool:
        """fields(descriptors)标明没有这一项(no-motion),也没有别的字段正面描述它。"""
        return any(p.search(fields) for p in self.denials) and not self.describes(fields)

    def hit(self, doc: Doc) -> bool:
        """被 fields 否定时,正文里的零星提及(No entrance animations)不算命中。"""
        if not self.zh:
            return bool(self.field.search(doc.words) or self.english.search(doc.prose))
        if self.text in doc.prose or self.text in doc.labels:
            return True
        return ((any(p.search(doc.fields) for p in self.patterns) or any(p.search(doc.plain) for p in self.prose_patterns))
                and not self.denied(doc.fields))

    def key_hit(self, doc: Doc) -> bool:
        """命中在 gist、category、tags、core_dimensions 或中文标题摘要:正文里的偶然提及不够可靠。"""
        if not self.zh:
            return bool(self.field.search(doc.words) or self.english.search(doc.gist))
        if self.text in doc.labels:
            return True
        return ((any(p.search(doc.fields) for p in self.patterns) or any(p.search(doc.gist) for p in self.prose_patterns))
                and not self.denied(doc.fields))


def parse_query(query: str, library: Library) -> tuple[list[Unit], list[str]]:
    """把查询拆成检索单元;返回 (单元, 未识别的中文片段)。"""
    units: list[Unit] = []
    unknown: list[str] = []
    terms: dict[str, list[str]] | None = None
    for token in query.lower().split():
        if not CJK_RE.search(token):
            units.append(Unit(token))
            continue
        if terms is None:
            terms, ignore = load_zh_terms()
        position = 0
        for match in [*CJK_RE.finditer(token), None]:
            # 中英混写时,中文片段之间的英文按原有方式匹配,首尾标点去掉。
            latin = re.sub(r"^\W+|\W+$", "", token[position:match.start() if match else len(token)])
            if latin:
                units.append(Unit(latin))
            if not match:
                break
            position = match.end()
            for piece, kind in segment(match.group(), terms, ignore):
                if kind == "term":
                    units.append(Unit(piece, terms[piece]))
                elif kind == "unknown":
                    # 词表没有收录但库内正文或中文标签里出现过的词仍按原文匹配。
                    labels = library.zh_labels()
                    if any(piece in library.body(e) or piece in labels.get(e["id"].lower(), "") for e in library.entries):
                        units.append(Unit(piece, []))
                    else:
                        unknown.append(piece)
    return units, unknown


def label(entry: dict) -> str:
    return f"{entry['category']}(已弃用)" if entry.get("deprecated") else entry["category"]


def cmd_list(args) -> int:
    library = open_library()
    entries = library.entries
    if args.scenario:
        entries = [e for e in entries if e["scenario"] == args.scenario]
    print(library.describe())
    for e in entries:
        print(f"[{e['scenario']}] {e['id']}  {label(e)}  —  {e.get('gist', '')[:110]}")
        print(f"    file: {library.display_path(e)}")
    print(f"\n共 {len(entries)} 个种子")
    return 0


def cmd_search(args) -> int:
    if not args.query.split():
        sys.stderr.write("muse_local: search 需要关键词\n")
        return 2
    library = open_library()
    units, unknown = parse_query(args.query, library)
    entries = library.entries
    if args.scenario:
        entries = [e for e in entries if e["scenario"] == args.scenario]
    zh_units = [u for u in units if u.zh]
    labels = library.zh_labels() if zh_units else {}
    scored = []
    for e in entries:
        doc = library.doc(e, labels.get(e["id"].lower(), ""))
        matched = [u for u in units if u.hit(doc)]
        if matched:
            key_hits = sum(1 for u in matched if u.key_hit(doc))
            # 可靠命中:全部单元都命中,且至少一个命中在 gist、category、tags、core_dimensions 或中文标题摘要;
            # 查询里有词表未识别的中文词时,没有检索到的部分可能正是要点,不标 ★。
            reliable = not unknown and len(matched) == len(units) and key_hits > 0
            # 同分时,中文词直接命中中文标题摘要、或其英文同义词命中 category/tags 的条目更贴题。
            label_hits = sum(1 for u in zh_units if u.text in doc.labels)
            topic_hits = sum(1 for u in zh_units if u.describes(doc.fields))
            scored.append((reliable, len(matched) == len(units), len(matched), label_hits, topic_hits,
                           (e.get("scores") or {}).get("novelty", 0), e, matched, key_hits))
    scored.sort(key=lambda t: t[:6], reverse=True)
    print(library.describe())
    expanded = [f"{u.text} → {' / '.join(u.synonyms)}" for u in zh_units if u.synonyms]
    if expanded:
        print(f"中文词展开:{' · '.join(expanded)}")
    if unknown:
        sys.stderr.write(f"muse_local: 词表未收录「{'」「'.join(unknown)}」,库内也没有这些原文;结果不标 ★,"
                         "把查询翻译成带上下文的英文短语再搜\n")
    if scored and scored[0][0]:
        weak = False
        for reliable, _, _, _, _, nov, e, _, _ in scored[: args.n]:
            if not reliable and not weak:
                weak = True
                print("以下未标 ★ 的只命中部分查询词或只出现在正文里,不是可靠参考:")
            print(f"{'★' if reliable else ' '} [{e['scenario']}] {e['id']}  {label(e)}  (novelty {nov})")
            print(f"    {e.get('gist', '')[:150]}")
            print(f"    file: {library.display_path(e)}")
        return 0
    # 没有 ★ 时列出关键字段命中部分查询词的条目,按命中词数、关键字段命中数、novelty 排序;
    # 只在正文里提到查询词的照旧不列。
    partial = sorted((t for t in scored if t[8]), key=lambda t: (t[2], t[8], t[5]), reverse=True)
    if partial:
        if unknown:
            print(f"查询里的「{'」「'.join(unknown)}」未能识别,结果不标 ★。以下是在分类、标签、维度或摘要上"
                  "命中部分查询词的条目,看分类和摘要判断是否贴题:")
        else:
            print("没有 seed 同时命中全部查询词,结果不标 ★。以下是在分类、标签、维度或摘要上命中部分查询词的条目,"
                  "看分类和摘要判断是否贴题:")
        for _, _, _, _, _, nov, e, matched, _ in partial[: args.n]:
            missing = [u.text for u in units if u not in matched] + unknown
            print(f"  [{e['scenario']}] {e['id']}  {label(e)}  (novelty {nov})")
            print(f"    命中:{'、'.join(u.text for u in matched)}  未命中:{'、'.join(missing)}")
            print(f"    {e.get('gist', '')[:150]}")
            print(f"    file: {library.display_path(e)}")
        if len(scored) > len(partial):
            print(f"另有 {len(scored) - len(partial)} 个 seed 只在正文里提到查询词,不列出。")
    elif scored:
        print(f"没有找到可靠参考:{len(scored)} 个 seed 只在正文里零星提到查询词,不列为结果。")
    elif not units and unknown:
        print("没有找到可靠参考:查询里的中文词都未能识别(也可换个常见说法,如 仪表盘 / 海报 / 配色)。")
    elif not units:
        print("没有找到可靠参考:查询只有“设计”“风格”“参考”这类泛称,先写出具体的场景、媒介或风格。")
    else:
        print("没有找到可靠参考:没有 seed 提到这些查询词。")
    if unknown:
        print("把未识别的中文词连同场景翻译成英文短语再搜(如 酒吧官网 → \"cocktail bar website\")。")
    print("换成带场景的具体英文短语再试(如 \"cocktail bar website\" 而不是 \"bar\"),可多试几组说法;"
          "没命中的词可换上位词再搜(如 hospitality、restaurant)。部分命中只有分类或摘要确实贴题时才作为相邻参考,"
          "并向用户说明;仍然没有就如实说明没有可靠参考。")
    return 0


def cmd_show(args) -> int:
    library = open_library()
    key = args.target.lower()
    for e in library.entries:
        if e["id"].lower() == key or key in e["file"].lower():
            sys.stderr.write(f"muse_local: {library.describe()}\n")
            sys.stdout.write(library.text(e))
            return 0
    sys.stderr.write(f"muse_local: 未找到 {args.target},先跑 list 或 search\n")
    return 2


def cmd_status(args) -> int:
    library, notes = resolve_library()
    bundled = bundled_library()
    print(library.describe())
    print(f"seed 数:{len(library.entries)}  schemaVersion:{library.schema or '未标'}")
    print(f"内置快照:{PACKAGE} {bundled.version}({BUNDLED_DIR})")
    cache = seeds_cache()
    try:
        installed = sorted({m.group(1) for m in (INSTALL_RE.match(p.name) for p in cache.iterdir() if p.is_dir()) if m},
                           key=parse_version)
    except OSError:
        installed = []
    state, _ = read_state()
    print(f"本机缓存:{cache}")
    print(f"  已安装:{', '.join(installed) or '无'}"
          f"  current:{state['current']['version'] if state['current'] else '无'}"
          f"  previous:{state['previous']['version'] if state['previous'] else '无'}")
    for note in notes:
        print(note if note.startswith("警告:") else f"注意:{note}")
    return 0


# ---------------------------------------------------------------------------
# update


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def check_manifest(manifest) -> dict:
    if not isinstance(manifest, dict):
        raise UpdateError("manifest.json 格式无法识别")
    if manifest.get("name") != PACKAGE:
        raise UpdateError(f"manifest.json 不是 {PACKAGE} 的发布清单")
    if not parse_version(manifest.get("version")):
        raise UpdateError(f"manifest.json 的版本号无效:{manifest.get('version')}")
    if schema_major(manifest.get("schemaVersion")) != SUPPORTED_SCHEMA_MAJOR:
        raise UpdateError(
            f"{PACKAGE} {manifest.get('version')} 的 schemaVersion {manifest.get('schemaVersion')} "
            f"与本 Musekit 支持的 {SUPPORTED_SCHEMA_MAJOR}.x 不兼容;请先升级 Musekit")
    if not TARBALL_RE.match(str(manifest.get("tarball", ""))):
        raise UpdateError("manifest.json 的 tarball 字段无效")
    if not re.fullmatch(r"[0-9a-f]{64}", str(manifest.get("sha256", ""))):
        raise UpdateError("manifest.json 缺少 sha256")
    if not HASH_RE.match(str(manifest.get("contentHash", ""))):
        raise UpdateError("manifest.json 缺少 contentHash")
    return manifest


def read_manifest(data: bytes, origin) -> dict:
    try:
        return check_manifest(json.loads(data.decode("utf-8")))
    except ValueError:
        raise UpdateError(f"manifest.json 不是有效的 JSON:{origin}") from None


def extract_archive(data: bytes, destination: Path) -> None:
    """先检查全部条目,再逐个写入;只接受顶层目录下的普通文件与目录。"""
    try:
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
            members = archive.getmembers()
            if len(members) > MAX_MEMBERS:
                raise UpdateError(f"压缩包条目过多(超过 {MAX_MEMBERS})")
            plan, files, directories, roots, total = [], set(), set(), set(), 0
            for member in members:
                parts = safe_parts(member.name)
                if not parts:
                    raise UpdateError(f"压缩包含不安全路径:{member.name}")
                roots.add(parts[0])
                if len(roots) > 1:
                    raise UpdateError("压缩包应只包含一个顶层目录")
                if member.isdir():
                    continue
                if not member.isfile():
                    raise UpdateError(f"压缩包含不支持的条目类型(只接受普通文件与目录):{member.name}")
                if len(parts) < 2:
                    raise UpdateError(f"压缩包条目不在顶层目录内:{member.name}")
                # 大小写不敏感的文件系统上只差大小写的路径会互相覆盖,同样视为重复。
                key = "/".join(parts[1:]).lower()
                if key in files:
                    raise UpdateError(f"压缩包含重复条目:{member.name}")
                files.add(key)
                directories.update("/".join(parts[1:i]).lower() for i in range(2, len(parts)))
                total += member.size
                if total > MAX_UNPACKED_BYTES:
                    raise UpdateError(f"压缩包解压后超过 {MAX_UNPACKED_BYTES // (1024 * 1024)} MiB")
                plan.append((member, parts[1:]))
            if not plan:
                raise UpdateError("压缩包是空的")
            if files & directories:
                raise UpdateError(f"压缩包中有路径既是文件又是目录:{sorted(files & directories)[0]}")
            for member, parts in plan:
                target = destination.joinpath(*parts)
                if not inside(destination, target):
                    raise UpdateError(f"压缩包含不安全路径:{member.name}")
                target.parent.mkdir(parents=True, exist_ok=True)
                source = archive.extractfile(member)
                with open(target, "xb") as stream:
                    stream.write(source.read() if source else b"")
    except (tarfile.TarError, EOFError, zlib.error, gzip.BadGzipFile) as error:
        raise UpdateError(f"压缩包损坏或不是 tar.gz:{error}") from None


def install(data: bytes, manifest: dict, origin: str) -> int:
    if len(data) > MAX_ARCHIVE_BYTES:
        raise UpdateError(f"{origin} 超过 {MAX_ARCHIVE_BYTES // (1024 * 1024)} MiB,不像 {PACKAGE} 的发布包")
    if sha256(data) != manifest["sha256"]:
        raise UpdateError(f"sha256 校验失败:{origin} 与 manifest.json 不一致")
    cache = seeds_cache()
    with cache_lock():
        staging = Path(tempfile.mkdtemp(dir=cache, prefix=STAGING_PREFIX))
        try:
            extract_archive(data, staging)
            try:
                library = load_library(staging, "cache")
            except LibraryError as error:
                raise UpdateError(f"压缩包内容无效:{error}") from None
            version = library.version
            if version != manifest["version"] or library.schema != manifest["schemaVersion"]:
                raise UpdateError("压缩包内索引的版本与 manifest.json 不一致")
            digest = content_hash(staging)
            if digest != manifest["contentHash"]:
                raise UpdateError("contentHash 校验失败:解压内容与 manifest.json 不一致")
            # 每次安装都用新目录名,已有目录(包括 current 指向的)不会被改名或覆盖。
            name = f"{version}-{staging.name[len(STAGING_PREFIX):].lower()}"
            destination = cache / name
            os.rename(staging, destination)
        except BaseException:
            shutil.rmtree(staging, ignore_errors=True)
            raise
        record = {"dir": name, "version": version, "schemaVersion": library.schema, "contentHash": digest}
        state, _ = read_state()
        current, previous = state["current"], state["previous"]
        if current and current["version"] != version:
            previous = current
        if previous and previous["version"] == version:
            previous = None
        new_state = {"current": record, "previous": previous}
        try:
            # 唯一的提交点:原子替换 state.json。失败时旧状态原样保留。
            write_state(new_state)
        except BaseException:
            shutil.rmtree(destination, ignore_errors=True)
            raise
        collect_garbage(new_state)
    print(f"已安装 {PACKAGE} {version} → {destination}")
    bundled = bundled_library()
    if parse_version(version) < (parse_version(bundled.version) or (0, 0, 0)):
        print(f"注意:内置快照 {bundled.version} 更新,检索仍使用内置快照")
    elif os.environ.get("MUSEPOOL_SEEDS_DIR"):
        print(f"本机缓存已是 {version};设置了 MUSEPOOL_SEEDS_DIR 时检索仍使用该目录")
    else:
        print(f"当前使用:本机缓存 {version}")
    return 0


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "musekit-muse-local"})
    with urllib.request.urlopen(request, timeout=30) as response:
        data = response.read(MAX_ARCHIVE_BYTES + 1)
    if len(data) > MAX_ARCHIVE_BYTES:
        raise UpdateError(f"{url} 超过 {MAX_ARCHIVE_BYTES // (1024 * 1024)} MiB,不像 {PACKAGE} 的发布资产")
    return data


def update_online(version: str | None) -> int:
    base = (os.environ.get("MUSPRO_SEEDS_URL") or RELEASE_BASE).rstrip("/")
    if version and not parse_version(version):
        raise UpdateError(f"--version 需要 X.Y.Z 形式,收到 {version}")
    manifest_url = (f"{base}/releases/download/v{version}/manifest.json" if version
                    else f"{base}/releases/latest/download/manifest.json")
    try:
        manifest = read_manifest(fetch(manifest_url), manifest_url)
        if version and manifest["version"] != version:
            raise UpdateError(f"{manifest_url} 描述的是 {manifest['version']},不是请求的 {version}")
        current = read_state()[0]["current"]
        if current and current["version"] == manifest["version"] and current["contentHash"] == manifest["contentHash"]:
            try:
                load_cached(current)
                print(f"本机缓存已是 {PACKAGE} {current['version']},无需更新")
                return 0
            except LibraryError:
                pass
        data = fetch(f"{base}/releases/download/v{manifest['version']}/{manifest['tarball']}")
    except urllib.error.HTTPError as error:
        raise UpdateError(f"下载失败:{error.url} 返回 HTTP {error.code}") from None
    except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError) as error:
        reason = getattr(error, "reason", error)
        raise UpdateError(
            f"无法连接 {base}({reason})。当前环境可能禁止联网,例如 Codex 默认的 workspace-write 沙箱;"
            "可在 Codex 配置中开启 sandbox_workspace_write.network_access,"
            "或在能联网的机器下载 Release 中的 manifest.json 与 tar.gz 后用 update --from 安装") from None
    return install(data, manifest, manifest["tarball"])


def update_from(path: str, manifest_path: str | None) -> int:
    archive = Path(path).expanduser()
    try:
        if archive.stat().st_size > MAX_ARCHIVE_BYTES:
            raise UpdateError(f"{archive.name} 超过 {MAX_ARCHIVE_BYTES // (1024 * 1024)} MiB,不像 {PACKAGE} 的发布包")
        data = archive.read_bytes()
    except OSError as error:
        raise UpdateError(f"无法读取 {archive}:{error.strerror or error}") from None
    candidate = Path(manifest_path).expanduser() if manifest_path else archive.with_name("manifest.json")
    try:
        manifest = read_manifest(candidate.read_bytes(), candidate)
    except OSError:
        raise UpdateError(
            f"找不到 {candidate}。离线安装需要与发布包一起下载的 manifest.json 来校验 sha256 与 contentHash;"
            "把它放在发布包同目录,或用 --manifest 指定") from None
    if not manifest_path and manifest["tarball"] != archive.name:
        raise UpdateError(
            f"{candidate} 描述的是 {manifest['tarball']},与 {archive.name} 不符;"
            "若发布包已改名,用 --manifest 明确指定对应的 manifest.json")
    return install(data, manifest, archive.name)


def rollback() -> int:
    bundled = bundled_library()
    with cache_lock():
        state, _ = read_state()
        previous = state["previous"]
        if previous:
            try:
                load_cached(previous)
                new_state = {"current": previous, "previous": None}
                write_state(new_state)
                collect_garbage(new_state)
                print(f"已切回本机缓存 {PACKAGE} {previous['version']}")
                return 0
            except LibraryError as error:
                print(f"上一版缓存 {previous['version']} 无法使用:{error}")
        new_state = {"current": None, "previous": None}
        write_state(new_state)
        collect_garbage(new_state)
    print(f"已回到内置快照 {PACKAGE} {bundled.version}")
    return 0


def describe_fallback() -> str:
    try:
        return resolve_library()[0].describe().replace("来源:", "", 1)
    except SystemExit:
        return "内置快照"


def cmd_update(args) -> int:
    if override_points_to_bundled():
        print("注意:MUSEPOOL_SEEDS_DIR 指向 Skill 内置快照,检索会继续使用内置快照而不是本机缓存;"
              "取消这个变量即可使用更新后的本机缓存")
    elif os.environ.get("MUSEPOOL_SEEDS_DIR"):
        print("注意:MUSEPOOL_SEEDS_DIR 已设置,检索会继续使用该目录,update 只改动本机缓存")
    try:
        if args.rollback:
            return rollback()
        if args.source:
            return update_from(args.source, args.manifest)
        return update_online(args.version)
    except UpdateError as error:
        sys.stderr.write(f"muse_local: 更新失败:{error}\n未做任何更改,继续使用 {describe_fallback()}\n")
        return 1
    except OSError as error:
        sys.stderr.write(
            f"muse_local: 无法写入缓存目录 {seeds_cache()}({error.strerror or error})。"
            "可设置 MUSEKIT_CACHE_DIR 指向可写目录;内置快照仍可直接使用\n"
            f"未做任何更改,继续使用 {describe_fallback()}\n")
        return 1


def main() -> int:
    # Agent 通过管道读取输出;Windows 上管道默认用本地代码页并把换行改成 CRLF,
    # 中文会报错或乱码,show 也不再与 seed 原文一致。
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure") and not stream.isatty():
            stream.reconfigure(encoding="utf-8", newline="\n")
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

    sub.add_parser("status", help="显示 seed 库来源、版本与本机缓存")

    u = sub.add_parser("update", help="更新本机 seed 缓存(联网或离线 tar)")
    mode = u.add_mutually_exclusive_group()
    mode.add_argument("--from", dest="source", metavar="TAR", help="从本地 tar.gz 安装,不联网;需要对应的 manifest.json")
    mode.add_argument("--rollback", action="store_true", help="切回上一版缓存;没有上一版时回到内置快照")
    mode.add_argument("--version", help="安装指定版本(默认最新版)")
    u.add_argument("--manifest", help="与 --from 搭配的 manifest.json;默认使用同目录的 manifest.json")

    args = p.parse_args()
    if args.command == "update" and args.manifest and not args.source:
        p.error("--manifest 只能与 --from 一起使用")
    commands = {"list": cmd_list, "search": cmd_search, "show": cmd_show, "status": cmd_status, "update": cmd_update}
    return commands[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
