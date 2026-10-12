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
  1. 环境变量 MUSEPOOL_SEEDS_DIR 指向的目录;
  2. 本机缓存 ${MUSEKIT_CACHE_DIR:-${XDG_CACHE_HOME:-~/.cache}/musekit}/seeds/:
     <版本>/ 是解压后的 seed 库,current 记录正在使用的版本,previous 记录上一版;
     缓存损坏、schema 不兼容或版本旧于内置快照时跳过;
  3. 随 Skill 分发的内置快照 seeds/。
只有 update 会联网;失败时不改动当前使用的 seed 库。

search 在 gist / category / tags / core_dimensions 及 seed 正文上做大小写不敏感的
关键词打分,所有词命中者排前,其次按命中词数与 novelty 排序。
"""
from __future__ import annotations

import argparse
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
from pathlib import Path, PurePosixPath

BUNDLED_DIR = Path(__file__).resolve().parent.parent / "seeds"
SCENARIOS = ("ui", "graphic", "information")
SUPPORTED_SCHEMA_MAJOR = 1
PACKAGE = "muspro-seeds"
RELEASE_BASE = "https://github.com/agent-plugkit/muspro-seeds"
VERSION_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")
SOURCE_LABELS = {"env": "MUSEPOOL_SEEDS_DIR", "cache": "本机缓存", "bundled": "内置快照"}


class LibraryError(Exception):
    pass


class UpdateError(Exception):
    pass


class Library:
    def __init__(self, directory: Path, kind: str, entries: list[dict], version: str | None, schema: str | None):
        self.dir = directory
        self.kind = kind
        self.entries = entries
        self.version = version
        self.schema = schema

    def describe(self) -> str:
        version = f"{PACKAGE} {self.version}" if self.version else "未标版本"
        where = "" if self.kind == "bundled" else f"({self.dir})"
        return f"来源:{SOURCE_LABELS[self.kind]} · {version}{where}"

    def display_path(self, entry: dict) -> str:
        return f"seeds/{entry['file']}" if self.kind == "bundled" else str(self.dir / entry["file"])


def parse_version(value) -> tuple[int, int, int] | None:
    match = VERSION_RE.match(str(value or ""))
    return tuple(int(part) for part in match.groups()) if match else None


def schema_major(value) -> int | None:
    match = re.match(r"^(\d+)\.", str(value or ""))
    return int(match.group(1)) if match else None


def load_library(directory: Path, kind: str) -> Library:
    """读取并检查一份 seed 库;任何问题都抛出 LibraryError。"""
    index = directory / "index.json"
    if not index.is_file():
        raise LibraryError(f"找不到索引 {index}")
    try:
        data = json.loads(index.read_text(encoding="utf-8"))
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
    for entry in entries:
        if not isinstance(entry, dict) or not all(isinstance(entry.get(key), str) for key in ("id", "file", "scenario")):
            raise LibraryError(f"索引条目缺少 id/file/scenario:{index}")
        relative = PurePosixPath(entry["file"])
        if relative.is_absolute() or ".." in relative.parts or not (directory / relative).is_file():
            raise LibraryError(f"索引引用的文件不存在:{entry['file']}")
    return Library(directory, kind, entries, version, schema)


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


def read_pointer(name: str) -> str | None:
    try:
        value = (seeds_cache() / name).read_text(encoding="utf-8").strip()
    except OSError:
        return None
    return value if parse_version(value) else None


def write_pointer(name: str, version: str) -> None:
    target = seeds_cache() / name
    handle, temporary = tempfile.mkstemp(dir=target.parent, prefix=f".{name}-")
    with os.fdopen(handle, "w", encoding="utf-8") as stream:
        stream.write(version + "\n")
    os.replace(temporary, target)


def remove_pointer(name: str) -> None:
    try:
        (seeds_cache() / name).unlink()
    except FileNotFoundError:
        pass


def bundled_library() -> Library:
    try:
        return load_library(BUNDLED_DIR, "bundled")
    except LibraryError as error:
        fail(f"内置快照不可用:{error}")


def cached_library(bundled: Library, notes: list[str]) -> Library | None:
    current = read_pointer("current")
    if not current:
        return None
    try:
        library = load_library(seeds_cache() / current, "cache")
    except LibraryError as error:
        notes.append(f"本机缓存 {current} 无法使用:{error};已回退内置快照。可运行 update 重新安装或 update --rollback")
        return None
    if library.version != current:
        notes.append(f"本机缓存目录 {current} 的索引版本为 {library.version};已回退内置快照")
        return None
    if (parse_version(library.version) or (0, 0, 0)) < (parse_version(bundled.version) or (0, 0, 0)):
        notes.append(f"本机缓存 {current} 旧于内置快照 {bundled.version},使用内置快照")
        return None
    return library


def resolve_library() -> tuple[Library, list[str]]:
    notes: list[str] = []
    override = os.environ.get("MUSEPOOL_SEEDS_DIR")
    if override:
        try:
            return load_library(Path(override).expanduser().resolve(), "env"), notes
        except LibraryError as error:
            fail(f"MUSEPOOL_SEEDS_DIR 不可用:{error}。修正该目录或取消这个环境变量")
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


def haystack(library: Library, entry: dict) -> str:
    parts = [
        entry.get("gist", ""),
        entry.get("category", ""),
        flat_tags(entry.get("tags")),
        " ".join(entry.get("core_dimensions") or []),
    ]
    # 连同 seed 正文一起搜(布局/色彩/动效/工艺细节都在正文里)
    path = library.dir / entry["file"]
    if path.exists():
        parts.append(path.read_text(encoding="utf-8"))
    return " ".join(parts).lower()


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
    words = [w for w in args.query.lower().split() if w]
    if not words:
        sys.stderr.write("muse_local: search 需要关键词\n")
        return 2
    library = open_library()
    entries = library.entries
    if args.scenario:
        entries = [e for e in entries if e["scenario"] == args.scenario]
    scored = []
    for e in entries:
        hay = haystack(library, e)
        hits = sum(1 for w in words if w in hay)
        if hits:
            scored.append((hits == len(words), hits, e.get("scores", {}).get("novelty", 0), e))
    scored.sort(key=lambda t: (t[0], t[1], t[2]), reverse=True)
    print(library.describe())
    for full, hits, nov, e in scored[: args.n]:
        mark = "★" if full else " "
        print(f"{mark} [{e['scenario']}] {e['id']}  {label(e)}  (novelty {nov})")
        print(f"    {e.get('gist', '')[:150]}")
        print(f"    file: {library.display_path(e)}")
    if not scored:
        print("无命中。换英文关键词(如 palette / grid / dashboard / diagram)再试。")
    return 0


def cmd_show(args) -> int:
    library = open_library()
    key = args.target.lower()
    for e in library.entries:
        if e["id"].lower() == key or key in e["file"].lower():
            sys.stderr.write(f"muse_local: {library.describe()}\n")
            sys.stdout.write((library.dir / e["file"]).read_text(encoding="utf-8"))
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
        installed = sorted((p.name for p in cache.iterdir() if p.is_dir() and parse_version(p.name)), key=parse_version)
    except OSError:
        installed = []
    print(f"本机缓存:{cache}")
    print(f"  已安装:{', '.join(installed) or '无'}  current:{read_pointer('current') or '无'}"
          f"  previous:{read_pointer('previous') or '无'}")
    for note in notes:
        print(f"注意:{note}")
    return 0


# ---------------------------------------------------------------------------
# update


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def content_hash(directory: Path) -> str:
    lines = []
    for path in sorted(p for p in directory.rglob("*") if p.is_file()):
        relative = path.relative_to(directory).as_posix()
        lines.append((relative, f"{sha256(path.read_bytes())}  {relative}\n"))
    lines.sort(key=lambda item: item[0])
    return "sha256:" + sha256("".join(line for _, line in lines).encode("utf-8"))


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
    tarball = manifest.get("tarball")
    if not isinstance(tarball, str) or "/" in tarball or "\\" in tarball or not tarball.endswith(".tar.gz"):
        raise UpdateError("manifest.json 的 tarball 字段无效")
    if not re.fullmatch(r"[0-9a-f]{64}", str(manifest.get("sha256", ""))):
        raise UpdateError("manifest.json 缺少 sha256")
    return manifest


def extract_archive(data: bytes, destination: Path) -> None:
    try:
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
            members = archive.getmembers()
            roots = {PurePosixPath(m.name).parts[0] for m in members if PurePosixPath(m.name).parts}
            if len(roots) != 1:
                raise UpdateError("压缩包应只包含一个顶层目录")
            for member in members:
                parts = PurePosixPath(member.name).parts
                if member.name.startswith("/") or ".." in parts:
                    raise UpdateError(f"压缩包含不安全路径:{member.name}")
                if member.isdir():
                    continue
                if not member.isfile():
                    raise UpdateError(f"压缩包含不支持的条目类型:{member.name}")
                if len(parts) < 2:
                    raise UpdateError(f"压缩包条目不在顶层目录内:{member.name}")
                target = destination.joinpath(*parts[1:])
                target.parent.mkdir(parents=True, exist_ok=True)
                source = archive.extractfile(member)
                target.write_bytes(source.read() if source else b"")
    except (tarfile.TarError, EOFError, zlib.error, gzip.BadGzipFile) as error:
        raise UpdateError(f"压缩包损坏或不是 tar.gz:{error}") from None


def install(data: bytes, manifest: dict | None, origin: str) -> int:
    if manifest and sha256(data) != manifest["sha256"]:
        raise UpdateError(f"sha256 校验失败:{origin} 与 manifest.json 不一致")
    cache = seeds_cache()
    cache.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(dir=cache, prefix=".staging-"))
    try:
        extract_archive(data, staging)
        try:
            library = load_library(staging, "cache")
        except LibraryError as error:
            raise UpdateError(f"压缩包内容无效:{error}") from None
        version = library.version
        if not parse_version(version):
            raise UpdateError(f"压缩包内索引的版本号无效:{version}")
        if manifest:
            if version != manifest["version"] or library.schema != manifest["schemaVersion"]:
                raise UpdateError("压缩包内索引的版本与 manifest.json 不一致")
            expected = manifest.get("contentHash")
            if expected and content_hash(staging) != expected:
                raise UpdateError("contentHash 校验失败:解压内容与 manifest.json 不一致")
        destination = cache / version
        retired = None
        if destination.exists():
            retired = cache / f".retired-{version}-{os.getpid()}"
            os.rename(destination, retired)
        os.rename(staging, destination)
        if retired:
            shutil.rmtree(retired, ignore_errors=True)
    finally:
        if staging.exists():
            shutil.rmtree(staging, ignore_errors=True)
    previous = read_pointer("current")
    if previous and previous != version:
        write_pointer("previous", previous)
    write_pointer("current", version)
    print(f"已安装 {PACKAGE} {version} → {destination}")
    bundled = bundled_library()
    if parse_version(version) < (parse_version(bundled.version) or (0, 0, 0)):
        print(f"注意:内置快照 {bundled.version} 更新,检索仍使用内置快照")
    else:
        print(f"当前使用:本机缓存 {version}")
    return 0


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "musekit-muse-local"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def update_online(version: str | None) -> int:
    base = (os.environ.get("MUSPRO_SEEDS_URL") or RELEASE_BASE).rstrip("/")
    if version and not parse_version(version):
        raise UpdateError(f"--version 需要 X.Y.Z 形式,收到 {version}")
    manifest_url = (f"{base}/releases/download/v{version}/manifest.json" if version
                    else f"{base}/releases/latest/download/manifest.json")
    try:
        manifest = check_manifest(json.loads(fetch(manifest_url).decode("utf-8")))
        current = read_pointer("current")
        if current == manifest["version"]:
            try:
                load_library(seeds_cache() / current, "cache")
                print(f"本机缓存已是 {PACKAGE} {current},无需更新")
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
    except ValueError:
        raise UpdateError(f"manifest.json 不是有效的 JSON:{manifest_url}") from None
    return install(data, manifest, manifest["tarball"])


def update_from(path: str, manifest_path: str | None) -> int:
    archive = Path(path).expanduser()
    try:
        data = archive.read_bytes()
    except OSError as error:
        raise UpdateError(f"无法读取 {archive}:{error.strerror or error}") from None
    candidate = Path(manifest_path).expanduser() if manifest_path else archive.with_name("manifest.json")
    manifest = None
    if candidate.is_file():
        try:
            manifest = check_manifest(json.loads(candidate.read_text(encoding="utf-8")))
        except ValueError:
            raise UpdateError(f"manifest.json 不是有效的 JSON:{candidate}") from None
        if not manifest_path and manifest["tarball"] != archive.name:
            manifest = None
    elif manifest_path:
        raise UpdateError(f"找不到 {candidate}")
    if manifest is None:
        print(f"注意:没有与 {archive.name} 对应的 manifest.json,跳过 sha256 校验,只检查内容与 schema")
    return install(data, manifest, archive.name)


def rollback() -> int:
    bundled = bundled_library()
    previous = read_pointer("previous")
    if previous:
        try:
            load_library(seeds_cache() / previous, "cache")
            write_pointer("current", previous)
            remove_pointer("previous")
            print(f"已切回本机缓存 {PACKAGE} {previous}")
            return 0
        except LibraryError as error:
            print(f"上一版缓存 {previous} 无法使用:{error}")
            remove_pointer("previous")
    remove_pointer("current")
    print(f"已回到内置快照 {PACKAGE} {bundled.version}")
    return 0


def cmd_update(args) -> int:
    if os.environ.get("MUSEPOOL_SEEDS_DIR"):
        print("注意:MUSEPOOL_SEEDS_DIR 已设置,检索会继续使用该目录,update 只改动本机缓存")
    try:
        if args.rollback:
            return rollback()
        if args.source:
            return update_from(args.source, args.manifest)
        return update_online(args.version)
    except UpdateError as error:
        fallback = "内置快照"
        try:
            fallback = resolve_library()[0].describe().replace("来源:", "", 1)
        except SystemExit:
            pass
        sys.stderr.write(f"muse_local: 更新失败:{error}\n未做任何更改,继续使用 {fallback}\n")
        return 1
    except OSError as error:
        sys.stderr.write(
            f"muse_local: 无法写入缓存目录 {seeds_cache()}({error.strerror or error})。"
            "可设置 MUSEKIT_CACHE_DIR 指向可写目录;内置快照仍可直接使用\n")
        return 1


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

    sub.add_parser("status", help="显示 seed 库来源、版本与本机缓存")

    u = sub.add_parser("update", help="更新本机 seed 缓存(联网或离线 tar)")
    mode = u.add_mutually_exclusive_group()
    mode.add_argument("--from", dest="source", metavar="TAR", help="从本地 tar.gz 安装,不联网")
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
