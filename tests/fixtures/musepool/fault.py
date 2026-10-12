"""Run muse_local.py with one injected fault: python3 -I fault.py <muse_local.py> <fault> <args...>

  rename-fails        promoting the verified install directory raises OSError
  crash-after-rename  the process dies right after promoting it, before state.json is written
  state-write-fails   atomically replacing state.json raises OSError
  hold-lock           another process holds the cache lock while the command runs
"""
import importlib.util
import os
import subprocess
import sys

# Importing muse_local must not leave __pycache__ inside the plugin.
sys.dont_write_bytecode = True
script, fault, *argv = sys.argv[1:]
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
spec = importlib.util.spec_from_file_location("muse_local", script)
muse = importlib.util.module_from_spec(spec)
spec.loader.exec_module(muse)
real_rename, real_replace = os.rename, os.replace


def rename_fails(src, dst):
    raise OSError(28, "No space left on device")


def crash_after_rename(src, dst):
    real_rename(src, dst)
    os._exit(9)


def state_write_fails(src, dst):
    if os.path.basename(dst) == muse.STATE_FILE:
        raise OSError(5, "Input/output error")
    return real_replace(src, dst)


if fault == "rename-fails":
    os.rename = rename_fails
elif fault == "crash-after-rename":
    os.rename = crash_after_rename
elif fault == "state-write-fails":
    os.replace = state_write_fails
elif fault == "hold-lock":
    with muse.cache_lock():
        result = subprocess.run([sys.executable, "-I", script, *argv], capture_output=True, encoding="utf-8")
    sys.stdout.write(result.stdout)
    sys.stderr.write(result.stderr)
    sys.exit(result.returncode)
else:
    sys.exit(f"unknown fault {fault}")
sys.argv = [script, *argv]
sys.exit(muse.main())
