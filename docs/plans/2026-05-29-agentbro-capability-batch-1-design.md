# AgentBro capability batch 1 design and status

## Scope

Batch 1 focuses on the highest-leverage workflow gaps found in the product capability review:

- Idle interaction protection: when the user has been away, blocking prompts should stay in the originating terminal instead of being promoted into the island as actionable cards.
- Remote SSH diagnostics: remote hosts should expose a probe report for OS, architecture, home path, core tools, agent CLIs, hook script presence, remote socket state, and installed AgentBro hooks.
- Session source groundwork: add Claude Desktop local-agent discovery and Codex app-server thread sync so AgentBro can see activity that does not arrive through hook files.
- Product polish that is low risk in AgentBro's current architecture: import OpenPeon/CESP sound packs, per-agent pet defaults, Codex app-server prompt response routing, first-run surface/analytics setup, and energy-aware background work.

## Architecture

The idle protection path extends the existing hook server interaction branches. Permission, question, and plan events still create a session shell, but if the setting is enabled and local user idle time exceeds the threshold, the hook connection returns without registering a pending UI response. That lets the original agent runtime continue its native terminal path instead of waiting on AgentBro.

Remote diagnostics stay inside the existing SSH installer module so they can reuse the current host model and SSH execution helper. The frontend Remote tab calls a new Tauri command, renders a compact report, and leaves hook install behavior unchanged.

Remote Codex state sync extends the same SSH path for a lightweight bridge: when a remote host is connected and Codex background sync is enabled, AgentBro periodically runs a read-only Python/sqlite3 probe against the newest remote `~/.codex/state_*.sqlite`, imports recently updated threads, and marks them with remote host metadata. This does not replace the hook tunnel; it fills the gap where remote Codex app-server activity updates sqlite state without emitting a hook.

Remote hook transport now prefers a daemon/attach topology. On connect, AgentBro uploads a portable `~/.agentbro/remote-agent.py`, starts it as a remote daemon listening on the configured remote hook socket plus a derived control socket, and launches an SSH attach command that streams daemon messages back to the local hook server. Blocking permission, question, and plan responses are proxied back through the same attach channel. If the daemon or attach startup fails, AgentBro stops the daemon and falls back to the previous `ssh -R` reverse tunnel path.

Claude Desktop discovery watches the local-agent metadata and audit JSONL folders under Claude's Application Support directory, then registers those sessions using the existing Claude Code session model with a Claude Desktop engine label.

Codex app-server support keeps a persistent stdio JSON-RPC bridge to `codex app-server`. The background task syncs `thread/list`, maps app-server approval and question requests into AgentBro pending interactions, and routes AgentBro responses back through the same bridge before falling back to terminal or hook response paths.

Energy handling lands as scoped AgentBro changes:

- Codex app-server thread refresh stays fast for active or attention sessions, slows to 60 seconds for idle-visible work, and slows to 5 minutes when quiet.
- The shared frontend energy policy applies the same active / idle-visible / quiet-background tiers to account-usage refresh, follow-focus polling, Monitor polling, and background update blocking.
- The notch uses a wake-gap detector to temporarily silence non-blocking wakeups after system sleep/resume, and pet sprite rendering drops to lower FPS tiers when the app is idle-visible or quiet-background.
- Background auto-update checks and downloads are skipped while sessions are processing, compacting, waiting for input or approval, or running tools/subagents/tasks. Manual update checks in Settings are still allowed.

First-run setup now opens Settings for fresh installs and requires a compact choice before analytics can run: choose island or pet surface mode, then explicitly opt in or out of anonymous daily usage stats. Existing config files that predate the consent fields still deserialize as already completed so upgrades are not interrupted.

## Verification

Rust coverage includes idle-time parsing, idle interaction routing, remote probe parsing, remote daemon command generation, SSH attach argument generation, remote Codex state JSON parsing, remote Codex session metadata upsert, Codex app-server pending permission/question mapping, pending-interaction preservation during thread sync, shared energy-mode classification, Codex app-server energy throttling, and legacy analytics consent config migration.

Frontend coverage includes pet default selection behavior, first-run setup completion, shared frontend energy policy classification, wake-gap detection, and animation FPS tiering. The settings pet-default UI was verified in the browser at desktop and mobile widths.

Latest verification:

- `cargo test --manifest-path src-tauri/Cargo.toml --lib`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `pnpm lint`
- `pnpm test:run`
- `pnpm build`
- `git diff --check`

## Remaining Gaps

- A packaged remote bridge binary would go further than AgentBro's portable Python daemon: it could ship architecture-specific release assets and push remote Codex sqlite updates through the daemon channel. AgentBro currently keeps remote Codex sqlite import as SSH polling and falls back to reverse tunnels when Python daemon startup fails.
