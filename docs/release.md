# AgentBro Release Runbook

## One-time Setup

Generate a Tauri updater key pair on a trusted machine:

```bash
cargo tauri signer generate -w ~/.tauri/agentbro.key
```

Copy the public key into `src-tauri/tauri.conf.json` at `plugins.updater.pubkey`.

Store these GitHub Actions secrets:

- `TAURI_SIGNING_PRIVATE_KEY`: contents of `~/.tauri/agentbro.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: password used when generating the key, if any

For unsigned preview releases, only the Tauri signing secret is required. For stable releases, also store:

- `CERTIFICATE_P12`: base64-encoded Apple Developer ID Application certificate
- `CERTIFICATE_PASSWORD`: certificate password
- `CODESIGN_IDENTITY`: Developer ID Application identity
- `APPLE_ID`: Apple ID for notarization
- `APPLE_PASSWORD`: app-specific password
- `APPLE_TEAM_ID`: Apple team id

Optional for stable releases:

- `HOMEBREW_TAP_TOKEN`: token that can push to the Homebrew tap repository. If omitted, the signed and notarized DMG release still ships, and the workflow skips the Homebrew cask update.
- `AGENTBRO_TELEMETRY_SLS_HOST`, `AGENTBRO_TELEMETRY_SLS_PROJECT`, `AGENTBRO_TELEMETRY_SLS_LOGSTORE`: Alibaba Cloud SLS WebTracking target for anonymous usage telemetry. Set all three together, or leave all three empty to ship telemetry-disabled builds.

Do not commit the private key or Apple certificate.

## Preflight

Run:

```bash
pnpm release:check
pnpm test:run
pnpm lint
pnpm build
```

`pnpm release:check` validates:

- `package.json`, Cargo, Cargo.lock, and Tauri versions match.
- Product identity is `AgentBro` / `agentbro` / `com.agentbro.desktop`.
- Release files do not contain stale `AgentBro` names.
- Tauri updater artifacts are enabled.
- Preview CI releases have updater signing secrets.
- Stable CI releases have updater, code-signing, and notarization secrets. Homebrew updates run only when the Homebrew token is present. Anonymous telemetry is compiled in only when the full SLS target is present.

## Unsigned Preview Release

Use this while you do not have an Apple Developer account:

```bash
pnpm release:check
git commit -am "chore: release v0.1.0-preview.1"
git tag v0.1.0-preview.1
git push origin main --tags
```

Preview releases:

- Are marked as GitHub prereleases.
- Build unsigned and unnotarized macOS DMGs.
- Still include Tauri updater signatures.
- Do not update the Homebrew tap.
- May require users to right-click the app and choose Open on first launch.

## Stable Release

Prepare a version commit:

```bash
pnpm release:check
git commit -am "chore: release v0.1.1"
git tag v0.1.1
git push origin main --tags
```

The `Release` workflow builds a universal macOS release and uploads:

- `AgentBro_<version>_universal.dmg`
- `AgentBro.app.tar.gz`
- `AgentBro.app.tar.gz.sig`
- `latest.json`
- `checksums.txt`

When `HOMEBREW_TAP_TOKEN` is configured, the workflow also updates the Homebrew cask in the tap repository.

Users can then install from the first-party tap:

```bash
brew tap shirenchuang/tap
brew install --cask agentbro
```

Create the public tap repository before enabling the token:

```bash
brew tap-new shirenchuang/tap
gh repo create shirenchuang/homebrew-tap --public --source "$(brew --repository shirenchuang/tap)" --push
```

## Website Download

Use `https://www.agentbro.net` as the public homepage and download entry.

For the first release, the app updater can keep reading `latest.json` from GitHub Releases. The website only needs to point users to the latest DMG, for example:

- Stable download: `https://github.com/shirenchuang/agentbro/releases/latest`
- Latest DMG download: `https://github.com/shirenchuang/agentbro/releases/latest/download/AgentBro_latest_universal.dmg`
- Versioned DMG download after a tagged release: `https://github.com/shirenchuang/agentbro/releases/download/v<VERSION>/AgentBro_<VERSION>_universal.dmg`

Only move the Tauri updater endpoint in `src-tauri/tauri.conf.json` to `www.agentbro.net` after the website or CDN reliably serves:

- `latest.json`
- `AgentBro.app.tar.gz`
- `AgentBro.app.tar.gz.sig`

The update archive URL inside `latest.json` must match the hosted archive location exactly.

## Manual QA

Before announcing a release:

- Install the DMG on a clean macOS machine.
- Confirm Gatekeeper accepts the app.
- Confirm `~/.agentbro/bin/agentbro-bridge` is installed after hook setup.
- Confirm `https://www.agentbro.net` points to the new DMG or GitHub release.
- Confirm Homebrew installs the same version.
- Confirm anonymous usage stats are enabled by default and can be disabled in Settings.
- Confirm an older app version updates through the Tauri updater.
