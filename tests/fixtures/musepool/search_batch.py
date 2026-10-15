"""Run many muse_local.py searches in one process and print each result as a compact string.

    python -I search_batch.py <muse_local.py> <library dir> <requests.json>

requests.json is a list of [query, scenario] pairs (scenario "" for no filter). The library is
selected through MUSEPOOL_SEEDS_DIR, so any revision of muse_local.py can be compared on the same
seeds. Output: a JSON list with one entry per request, the full result list (-n 1000) as
{"stars": [ids marked ★], "rest": [other listed ids], "unreliable": <count in the "没有找到可靠参考"
notice, or null>}.
"""
import argparse
import contextlib
import importlib.util
import io
import json
import os
import re
import sys
import tempfile

RESULT = re.compile(r"^([★ ]) \[[a-z]+\] (\S+) ", re.M)
UNRELIABLE = re.compile(r"^没有找到可靠参考[::](\d+) ", re.M)


def main() -> int:
    # Importing muse_local.py as a module must not leave __pycache__ next to it in the repository.
    sys.dont_write_bytecode = True
    script, library, requests = sys.argv[1:4]
    with tempfile.TemporaryDirectory() as cache:
        os.environ["MUSEPOOL_SEEDS_DIR"] = library
        os.environ["MUSEKIT_CACHE_DIR"] = cache
        os.environ["MUSEPOOL_NO_UPDATE_CHECK"] = "1"
        spec = importlib.util.spec_from_file_location("muse_local_under_test", script)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        opened = module.open_library()
        module.open_library = lambda: opened
        with open(requests, encoding="utf-8") as handle:
            pairs = json.load(handle)
        results = []
        for query, scenario in pairs:
            out = io.StringIO()
            args = argparse.Namespace(query=query, scenario=scenario or None, n=1000)
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
                module.cmd_search(args)
            text = out.getvalue()
            found = RESULT.findall(text)
            notice = UNRELIABLE.search(text)
            results.append({"stars": [i for mark, i in found if mark == "★"],
                            "rest": [i for mark, i in found if mark != "★"],
                            "unreliable": int(notice.group(1)) if notice else None})
    sys.stdout.reconfigure(encoding="utf-8")
    json.dump(results, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
