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
关键词打分,所有词命中者排前,其次按命中词数与 novelty 排序。查询中的中文按 zh_terms.json
做最长匹配切词并展开为英文同义词(按整词匹配;不计字段名、章节标题这类每个 seed 都有的
模板文字,也不计 no-motion、sans-serif 这类否定写法),原文也匹配正文与库内中文标题和摘要
(scenarios.json);中文词命中中文标题摘要或 category/tags 的条目在同分时排前。
纯英文查询的匹配与排序不受影响。
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
FIELD_NAME_RE = re.compile(r"(?m)^([ \t]*)[A-Za-z_][A-Za-z0-9_]*:")
SECTION_RE = re.compile(r"(?m)^# .*$")
# 紧跟在这些否定词之后的英文同义词不算命中:no-motion、non-grid、zero radius、without animation;
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

    def describe(self) -> str:
        version = f"{PACKAGE} {self.version}" if self.version else "未标版本"
        where = "" if self.kind == "bundled" else f"({self.dir})"
        source = SOURCE_LABELS[self.kind] + ("(指向内置快照)" if self.kind == "env" and self.is_bundled_dir else "")
        return f"来源:{source} · {version}{where}"

    def display_path(self, entry: dict) -> str:
        return f"seeds/{entry['file']}" if self.kind == "bundled" else str(self.dir.joinpath(*entry["file"].split("/")))

    def text(self, entry: dict) -> str:
        return self.texts[entry["file"]]

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


def flat_tags(tags) -> str:
    if isinstance(tags, dict):
        return " ".join(str(v) for vs in tags.values() for v in (vs if isinstance(vs, list) else [vs]))
    if isinstance(tags, list):
        return " ".join(map(str, tags))
    return str(tags or "")


def descriptors(entry: dict) -> str:
    """category、tags 与 core_dimensions:标明 seed 主题的结构化字段。"""
    return " ".join([entry.get("category", ""), flat_tags(entry.get("tags")),
                     " ".join(entry.get("core_dimensions") or [])]).lower()


def without_template(text: str) -> str:
    """去掉每个 seed 都有的模板文字:前置元数据的字段名(motion:、motion_intensity: 等,取值保留)
    与正文的一级章节标题(# Motion、# Typography 等)。"""
    end = text.find("\n---", 3) if text.startswith("---") else -1
    if end > 0:
        text = FIELD_NAME_RE.sub(r"\1", text[:end]) + text[end:]
    return SECTION_RE.sub("", text)


def haystack(library: Library, entry: dict, template: bool = True) -> str:
    """template=False 用于中文词展开出的英文同义词:模板文字每个 seed 都有,不能算命中。"""
    text = library.text(entry)
    parts = [
        entry.get("gist", ""),
        entry.get("category", ""),
        flat_tags(entry.get("tags")),
        " ".join(entry.get("core_dimensions") or []),
        # 连同 seed 正文一起搜(布局/色彩/动效/工艺细节都在正文里)
        text if template else without_template(text),
    ]
    return " ".join(parts).lower()


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
    return pieces


def term_body(term: str) -> str:
    # 词内空格也匹配连字符。
    return r"[\s-]+".join(re.escape(part) for part in term.split())


def word_pattern(term: str) -> re.Pattern:
    # 展开出的英文词按整词匹配(可带复数),避免 plan 命中 explanation 这类子串误配。
    # 下划线连成的是字段名(motion_intensity),不算整词;否定写法(no-motion、sans-serif)见 NEGATED。
    return re.compile(rf"(?<![a-z0-9_]){NEGATED}{term_body(term)}(?:s|es)?(?![a-z0-9_])")


def denial_pattern(term: str) -> re.Pattern:
    # category/tags 里的 no-motion、non-grid:整理者明确标注没有这一项。
    return re.compile(rf"(?<![a-z0-9_])(?:no|non|without)[\s-]{term_body(term)}(?:s|es)?(?![a-z0-9_])")


class Unit:
    """查询里的一个检索单元:英文词按子串匹配(与原有行为一致);中文词另加英文同义词与中文标签。"""

    def __init__(self, text: str, synonyms: list[str] | None = None):
        self.text = text
        self.zh = synonyms is not None
        self.synonyms = synonyms or []
        self.patterns = [word_pattern(term) for term in self.synonyms]
        self.denials = [denial_pattern(term) for term in self.synonyms]

    def describes(self, fields: str) -> bool:
        return self.text in fields or any(p.search(fields) for p in self.patterns)

    def denied(self, fields: str) -> bool:
        """fields(descriptors)标明没有这一项(no-motion),也没有别的字段正面描述它。"""
        return any(p.search(fields) for p in self.denials) and not self.describes(fields)

    def hit(self, hay: str, terms_hay: str, labels: str, fields: str) -> bool:
        """hay 为完整检索文本;英文同义词只在去掉模板文字的 terms_hay 里找,被 fields 否定时
        正文里的零星提及(No entrance animations)不算命中。"""
        if self.text in hay or (self.zh and self.text in labels):
            return True
        return any(p.search(terms_hay) for p in self.patterns) and not self.denied(fields)


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
                    # 词表没有收录但库内原文或中文标签里出现过的词仍按原文匹配。
                    labels = library.zh_labels()
                    if any(piece in library.text(e) or piece in labels.get(e["id"].lower(), "") for e in library.entries):
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
        hay = haystack(library, e)
        terms_hay = haystack(library, e, template=False) if zh_units else hay
        fields = descriptors(e) if zh_units else ""
        text = labels.get(e["id"].lower(), "")
        hits = sum(1 for u in units if u.hit(hay, terms_hay, text, fields))
        if hits:
            # 同分时,中文词直接命中中文标题摘要、或其英文同义词命中 category/tags 的条目更贴题。
            # 纯英文查询这两项恒为 0,排序与原来相同。
            label_hits = sum(1 for u in zh_units if u.text in text)
            topic_hits = sum(1 for u in zh_units if u.describes(fields))
            scored.append((hits == len(units), hits, label_hits, topic_hits,
                           (e.get("scores") or {}).get("novelty", 0), e))
    scored.sort(key=lambda t: t[:5], reverse=True)
    print(library.describe())
    expanded = [f"{u.text} → {' / '.join(u.synonyms)}" for u in zh_units if u.synonyms]
    if expanded:
        print(f"中文词展开:{' · '.join(expanded)}")
    if unknown:
        sys.stderr.write(f"muse_local: 词表未收录「{'」「'.join(unknown)}」,库内也没有这些原文,已忽略;"
                         "可换个常见说法或直接用英文关键词\n")
    for full, hits, _, _, nov, e in scored[: args.n]:
        mark = "★" if full else " "
        print(f"{mark} [{e['scenario']}] {e['id']}  {label(e)}  (novelty {nov})")
        print(f"    {e.get('gist', '')[:150]}")
        print(f"    file: {library.display_path(e)}")
    if not scored:
        if not units and unknown:
            print("无命中。查询里的中文词都未能识别;换个常见说法(如 仪表盘 / 海报 / 配色)"
                  "或用英文关键词(如 palette / grid / dashboard / diagram)再试。")
        elif not units:
            print("无命中。查询只有“设计”“风格”“参考”这类泛称;写出具体的场景、媒介或风格"
                  "(如 餐厅官网 / 海报 / 深色仪表盘)再试。")
        else:
            print("无命中。换英文关键词(如 palette / grid / dashboard / diagram)再试。")
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
