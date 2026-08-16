---
name: maintain
description: "Guide agents to maintain agent-plugkit marketplace plugins."
argument-hint: "<plugin-name-or-task>"
---

# maintain

Use this skill when creating or maintaining an `agent-plugkit` marketplace repository.

## Working Model

- Treat `plugin.yaml` as the source of truth for the Agent Plugins 1.0 portable package, Claude Code and Codex native artifacts, and all client marketplace indexes.
- Keep portable and client-specific layers distinct: Agent Plugins discovers only root `plugin.json`, immediate-child `skills/`, and optional root `mcp.json`; marketplace registration and installation belong to each client.
- Treat a plugin as the namespace and container. Add related skills or platform components under the existing plugin when they belong together.
- Prefer `agent-plugkit add <skill|mcp|hook|lsp> <plugin-name> <component-name>` when extending an existing plugin.
- Prefer `agent-plugkit init <plugin-name> --type <skill|mcp|hook|lsp>` when creating a new plugin.
- Prefer `agent-plugkit import-skill <source-dir> [plugin-name]` when the skill already exists on disk (for example `~/.claude/skills/<name>`) — it creates a new single-skill plugin and copies `SKILL.md` verbatim.

## Flow

1. Inspect the existing marketplace shape before editing.
2. Choose the plugin ID and component type.
3. Add or edit source files under `plugins/<plugin-name>/`.
4. Run:

   ```bash
   agent-plugkit build --all
   agent-plugkit index
   agent-plugkit validate --all
   ```

5. Before handing off a release candidate, run `agent-plugkit release-local` or the repository's release script and inspect the local directory/archive. This does not publish, push, register, or install anything remotely.
6. Once a ready Marketplace has an intended local or Git source, register it only when the user asks:

   ```bash
   agent-plugkit install-repo OWNER/REPO
   agent-plugkit install-repo OWNER/REPO --agent claude --agent codex
   agent-plugkit install-repo /path/to/marketplace --all
   ```

## Client Delivery

`install-repo` accepts an existing local Marketplace directory, `owner/repo`, or an HTTPS/SSH Git
URL. With no selection flags it provides a numbered TTY multi-select; automation must pass repeated
`--agent` values or `--all`. Sources containing C0/C1/DEL control characters, including controls
revealed by URL percent-decoding, are rejected before terminal output or client execution. It
processes these client adapters in a fixed order:

- Claude Code: native `claude plugin marketplace add <source>`.
- Codex: native `codex plugin marketplace add <source>`.
- GitHub Copilot: native `copilot plugin marketplace add <source>`.
- VS Code: atomically enable `chat.plugins.enabled` and deduplicate the source in the current user's
  `chat.plugins.marketplaces`; local directories become `file://` URIs. If safe deduplication would
  lose an existing JSONC comment, the configuration root is not an absolute user path, or the file
  is not lossless UTF-8, the file remains unchanged for manual cleanup. Reload the VS Code window
  after a completed update. Revision checks and an open-file guard reject or restore detectable
  conflicts, but this pure Node transaction is not filesystem compare-and-swap: an uncooperative
  new-inode replacement after the last observable check but before either candidate commit or
  guard-content recovery rename can be overwritten. Failure output asks the user to inspect the
  current file rather than claiming every failed transaction left the original untouched. Keep a
  local Marketplace outside the VS Code user configuration tree; overlapping or symlink-resolved
  paths fail before any settings write.
- Cursor: never write private state or call an undocumented command. Tell a Team/Enterprise
  administrator to use Dashboard → Plugins → Add Marketplace → Import from Repo.

Missing native CLIs and old versions remain explicit incomplete results; do not install them
automatically. Exit `0` means every selected target completed, `2` means a mixed result, `1` means
none completed or preflight failed, and `130` means interruption. Do not claim registration happened
merely because `build`, `index`, `validate`, or `release-local` passed; use the per-target
`install-repo` summary as the evidence.

Marketplace registration is not plugin installation. Run a client's plugin-install command only
under a separate explicit request.

## Contracts

- Do not edit generated root `plugin.json`/`mcp.json`, `.claude-plugin`, `.codex-plugin`, `.mcp.json`, `.lsp.json`, `hooks/hooks.json`, `.github/plugin/marketplace.json`, `.cursor-plugin/marketplace.json`, root `marketplace.json`, or other generated indexes by hand.
- Keep canonical plugin names to 2–64 lowercase letters, digits, or single hyphens; start and end with an alphanumeric character and never use consecutive `--`.
- Keep component paths relative to the plugin directory.
- Keep every portable Skill at `skills/<name>/SKILL.md`; its frontmatter `name` must match the immediate parent directory and its `description` must be present.
- Use legacy/explicit `stdio` MCP only with command fields, and `streamable-http`/`sse` only with URL/header fields. Do not silently convert an invalid transport.
- Treat MCP `env` and `headers` as visible package data; never put credentials or other secrets in generated plugin configuration.
- For multi-skill plugins, add child skills under the plugin instead of creating unrelated top-level plugin IDs.
- When adding MCP, hook, or LSP components, keep the component name stable because generated manifests use it as an identifier.
- `import-skill` never rewrites the copied `SKILL.md`. Fix a mismatched frontmatter name or description at the source, or edit the plugin after import.
- `install-repo` treats its source as read-only. It does not build, validate, repair, commit, push, publish, or install Marketplace contents.
