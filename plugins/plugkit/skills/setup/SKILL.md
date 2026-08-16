---
name: setup
description: "Guide agents to install, update, or uninstall the agent-plugkit CLI and bootstrap a marketplace repository."
argument-hint: "<install|update|uninstall>"
---

# setup

Use this skill for the lifecycle of the `agent-plugkit` CLI tool and its marketplace repository scaffold: getting it installed, keeping it current, or removing it. Once a repository is bootstrapped, switch to the `maintain` skill for day-to-day plugin work (adding components, build/index/validate/release).

## Install

1. Check whether `marketplace.yaml` already exists at the repo root. If it does, this repo is already bootstrapped — skip straight to `agent-plugkit validate --all` instead of re-initializing.
2. Add the CLI as a pinned dev dependency: `npm install --save-dev agent-plugkit`. For a one-off run without a persistent install, `npx agent-plugkit --help` works too.
3. If `marketplace.yaml` does not exist yet, scaffold the marketplace: `npx agent-plugkit init-repo [name] --organization "<org>"`. Leave `--no-plugkit` off unless the user explicitly does not want the official `plugkit` plugin in this repo.
4. Confirm the scaffold: `marketplace.yaml`, `plugins/plugkit/` (with both `setup` and `maintain` skills), and the `mp`/`validate:plugins`/`build:plugins`/`build:index` scripts in `package.json`.
5. Run `agent-plugkit build --all && agent-plugkit index && agent-plugkit validate --all` to confirm the fresh scaffold is healthy.

## Update

1. Check the current pinned version against latest: `npm view agent-plugkit version`.
2. `npm install --save-dev agent-plugkit@latest` (or a specific version if the user wants to pin one).
3. Re-run `agent-plugkit build --all && agent-plugkit index && agent-plugkit validate --all` to surface any schema or generated-artifact drift introduced by the new CLI version.
4. Updating the CLI does not rewrite files already scaffolded under `plugins/plugkit/` in this repo — `init-repo` never overwrites existing files. If the official `plugkit` skill content changed upstream and the user wants it, diff it manually before deciding whether to overwrite.
5. If the `plugkit` plugin is installed in an Agent Plugins-compatible or native Claude Code / Codex client, refresh it there too through that client's own update flow — the npm upgrade only updates the CLI binary, not an already-installed agent-side copy.

## Uninstall

1. `npm uninstall agent-plugkit` to remove the CLI dev dependency.
2. **Never delete `marketplace.yaml`, `plugins/`, or any generated manifests as part of this.** That is the user's real marketplace content, independent of the CLI tool. Only remove it if the user explicitly asks to tear down the marketplace itself, as a separate decision.
3. Optionally, if the user also wants the `plugkit` plugin removed from an agent client, do that through the client's own plugin-removal flow — uninstalling the npm package does not touch anything already installed there.

## Contracts

- This skill owns the CLI tool and repository bootstrap lifecycle only. Once a marketplace exists, route ongoing plugin work (adding skills/mcp/hooks/lsp, build, validate, release) to the `maintain` skill instead of duplicating it here.
- Never run `init-repo` against a directory that already has `marketplace.yaml` — it fails loudly by design; treat that as "already installed," not an error to route around.
- Do not hand-edit generated root `plugin.json`/`mcp.json`, `.claude-plugin`, `.codex-plugin`, `.mcp.json`, `.lsp.json`, `hooks/hooks.json`, or marketplace indexes.
