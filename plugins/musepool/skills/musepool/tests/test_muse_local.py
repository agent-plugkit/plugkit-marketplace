from __future__ import annotations

import copy
import importlib.util
import json
import subprocess
import sys
import unittest
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
SCRIPT = SKILL_DIR / "scripts" / "muse_local.py"


class MuseLocalCliTests(unittest.TestCase):
    def run_cli(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(SCRIPT), *args],
            cwd=SKILL_DIR,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_existing_list_search_and_show_commands_remain_available(self) -> None:
        listed = self.run_cli("list", "--scenario", "poster")
        self.assertEqual(listed.returncode, 0, listed.stderr)
        self.assertIn("共 6 个种子", listed.stdout)

        searched = self.run_cli(
            "search", "monochrome grid", "--scenario", "poster", "-n", "3"
        )
        self.assertEqual(searched.returncode, 0, searched.stderr)
        self.assertIn("[poster]", searched.stdout)

        shown = self.run_cli("show", "Vy3KTWAC")
        self.assertEqual(shown.returncode, 0, shown.stderr)
        self.assertIn("id: Vy3KTWAC", shown.stdout)
        self.assertIn("# Narrative", shown.stdout)

    def test_editorial_print_seed_is_searchable_and_deep(self) -> None:
        searched = self.run_cli(
            "search",
            "risograph halftone active negative space",
            "--scenario",
            "poster",
            "-n",
            "3",
        )
        self.assertEqual(searched.returncode, 0, searched.stderr)
        self.assertIn("mC1nkP2t", searched.stdout)

        shown = self.run_cli("show", "mC1nkP2t")
        self.assertEqual(shown.returncode, 0, shown.stderr)
        self.assertIn("source_license: MIT", shown.stdout)
        self.assertIn("visual_assets_included: false", shown.stdout)
        self.assertIn("#2148B8", shown.stdout)
        self.assertIn("# Dimensional References", shown.stdout)

    def test_recipe_emits_a_machine_readable_composition_contract(self) -> None:
        result = self.run_cli(
            "recipe",
            "Vy3KTWAC",
            "weZM545X",
            "--brief",
            "为独立艺术书展设计一张中文竖版海报",
        )
        self.assertEqual(result.returncode, 0, result.stderr)

        recipe = json.loads(result.stdout)
        self.assertEqual(recipe["schema_version"], 1)
        self.assertEqual(recipe["brief"]["raw"], "为独立艺术书展设计一张中文竖版海报")
        self.assertEqual(
            [reference["id"] for reference in recipe["references"]],
            ["Vy3KTWAC", "weZM545X"],
        )
        self.assertIn("focal_event", recipe["synthesis"])
        self.assertIn("release_zone", recipe["synthesis"])
        self.assertIn("structural_changes", recipe["originality"])
        self.assertGreaterEqual(len(recipe["quality_gate"]), 8)

    def test_recipe_rejects_more_than_three_references(self) -> None:
        result = self.run_cli(
            "recipe", "Vy3KTWAC", "weZM545X", "rvYJrbZh", "x1BNQPTi"
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn("最多选择 3 个种子", result.stderr)

    def test_validate_checks_the_complete_seed_library(self) -> None:
        result = self.run_cli("validate")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("29 个种子", result.stdout)
        self.assertIn("5 个场景", result.stdout)
        self.assertIn("索引与正文一致", result.stdout)

    def test_validate_detects_index_metadata_drift(self) -> None:
        spec = importlib.util.spec_from_file_location("muse_local_under_test", SCRIPT)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        entries = copy.deepcopy(module.read_index())
        entries[0]["core_dimensions"] = ["layout"]
        errors = module.validate_library(entries)
        self.assertTrue(
            any("frontmatter core_dimensions 与索引不一致" in error for error in errors),
            errors,
        )


if __name__ == "__main__":
    unittest.main()
