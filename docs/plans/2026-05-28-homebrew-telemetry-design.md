# Homebrew and Anonymous Telemetry Design

Date: 2026-05-28

## Goals

- Publish AgentBro through a first-party Homebrew tap at `shirenchuang/homebrew-tap`.
- Add opt-in anonymous daily active device telemetry through Alibaba Cloud SLS.
- Keep AgentBro local-first: no prompts, responses, code, diffs, paths, hostnames, IP addresses, raw hook payloads, or secrets are uploaded.

## Homebrew

AgentBro keeps a seed cask in `homebrew/Casks/agentbro.rb`. Stable release automation updates the external tap cask at `Casks/agentbro.rb` with the released version, versioned DMG URL, and computed SHA256.

Users install with:

```bash
brew tap shirenchuang/tap
brew install --cask agentbro
```

The release workflow requires `HOMEBREW_TAP_TOKEN` with write access to `shirenchuang/homebrew-tap`. If the token is missing, GitHub Releases still publish, but Homebrew sync is skipped.

## Anonymous Daily Active Telemetry

Telemetry is implemented in the Rust backend so the app can persist a daily aggregate and retry uploads outside React view lifecycles. The frontend exposes consent and status only.

Telemetry is disabled unless both conditions are true:

- The release build includes a complete SLS target.
- The user has enabled anonymous analytics.

The SLS target is injected at release time:

- `AGENTBRO_TELEMETRY_SLS_HOST`
- `AGENTBRO_TELEMETRY_SLS_PROJECT`
- `AGENTBRO_TELEMETRY_SLS_LOGSTORE`

Topic and source are non-secret defaults:

- Topic: `product-telemetry`
- Source: `agentbro-macos`

## Event Contract

The only uploaded event is `daily_usage_snapshot`, at most once per local calendar day per device.

Allowed fields:

- `event`
- `schema_version`
- `app_version`
- `report_date`
- `active_device`
- `anonymous_device_id`
- `os`
- `arch`
- `language`
- `surface_mode`
- `install_channel`
- `first_seen`
- `app_launch_count`
- `session_count`
- `client_session_counts`
- `hook_install_counts`
- `hook_uninstall_counts`

Values are sanitized and truncated before upload. Unknown fields are dropped.

## Install and Uninstall Measurement

AgentBro can measure:

- First observed launch on a device, which is the practical anonymous install proxy.
- Coarse install channel when inferable, such as `homebrew`, `github_dmg`, or `unknown`.
- In-app integration install and uninstall actions, such as installing or removing Agent hooks.

AgentBro cannot reliably measure:

- A user deleting `AgentBro.app` from Finder.
- A user running `brew uninstall --cask agentbro`.
- A user removing the app without launching it again.

Those app uninstall events are outside the app process, so they are not part of this telemetry design.

## Privacy UX

Settings exposes an anonymous analytics toggle with short explanatory text and links to telemetry/privacy docs. Default behavior is no upload before consent.

Turning analytics off clears the queued telemetry aggregate and anonymous device ID.

## Verification

- Unit-test telemetry field allowlisting, daily de-duplication, consent gating, and SLS request rendering.
- Run `pnpm lint`, `pnpm test:run`, `pnpm build`, and `cargo check --manifest-path src-tauri/Cargo.toml`.
- Verify the release workflow still skips Homebrew and telemetry config cleanly when secrets are absent.
