import { defineConfig } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";
export default defineConfig({
  testDir: "tests/browser",
  outputDir: join(tmpdir(), "musekit-diagram-browser-results"),
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: "list",
  use: {
    browserName: "chromium",
    viewport: { width: 1600, height: 1200 },
    acceptDownloads: true,
  },
});
