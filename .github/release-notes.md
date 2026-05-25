# AgentBro v0.1.4

AgentBro is a native macOS companion for coding agents. This release is focused on making the first public build easier to install, easier to update, and clearer to understand.

## Highlights

- Dynamic Island for agents: watch active sessions, tool calls, plans, pending questions, approvals, completion states, and errors from the menu bar.
- Fast interaction loop: approve or reject actions, answer pending questions, jump back to the right terminal/app, and continue the current agent flow without hunting through windows.
- Multi-agent monitoring: supports Claude Code, Codex, Gemini CLI, Cursor, Qoder, Qwen Code, GitHub Copilot, and other local or custom agent setups.
- SSH Remote: connect remote development machines and forward agent events back to the local AgentBro island.
- Skills Manager: scan local skill folders, preview metadata and source, manage skill packs, and sync skills across compatible agents.
- Settings and diagnostics: configure island layout, display behavior, shortcuts, notifications, sounds, usage display, links, diagnostics export, and community entry.

## Fixes In This Release

- Fixed the About page version so it now reads the real packaged app version instead of the old `0.1.0-alpha` placeholder.
- Improved update checking. AgentBro still uses the signed Tauri updater first, and now falls back to GitHub Releases if the updater endpoint cannot be reached in the current network environment.
- Added clear GitHub release notes so users can understand what the release contains before downloading.

## Download

- Recommended download: `AgentBro_latest_universal.dmg`
- Versioned download: `AgentBro_0.1.4_universal.dmg`
- Auto-update artifact: `AgentBro.app.tar.gz` plus `latest.json`

## Notes

- macOS is the supported platform for this release.
- Windows support is planned for a later stage.
