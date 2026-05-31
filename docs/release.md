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
- `OSS_ACCESS_KEY_ID`, `OSS_ACCESS_KEY_SECRET`: Aliyun RAM credentials for mirroring release artifacts to OSS (China download mirror). If omitted, the GitHub release still ships, the OSS mirror step is skipped, and the Homebrew cask falls back to the GitHub DMG URL. See "Aliyun OSS mirror" below.
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

The tap repository must have an initial commit (a `main` branch) before the first release runs. The `update-homebrew` job clones the tap and runs a bare `git push`, which fails against a completely empty repository (no default branch). If the repo is empty, seed it once:

```bash
gh api --method PUT /repos/shirenchuang/homebrew-tap/contents/README.md \
  -f message="chore: initialize tap" \
  -f content="$(printf '# homebrew-tap\n' | base64)"
```

Symptom of a missing seed or missing token: the `update-homebrew` job finishes in ~3s and logs `HOMEBREW_TAP_TOKEN is not set; skipping` (token missing) or fails at the push step (empty repo). The DMG release still ships in both cases, so the failure is silent until someone tries `brew install --cask agentbro`. After fixing, re-run just that job with `gh run rerun <run-id> --job <job-id>` to publish the cask without cutting a new release.

## Aliyun OSS mirror (China download)

GitHub Releases are slow/unreliable from mainland China, so stable releases are mirrored to an Aliyun OSS bucket served over its default domain (no ICP filing needed, no custom domain, no CDN). Object layout under the bucket:

```
aidc123/agentbro/
  latest.json                                          # overwritten; archive URLs point at OSS
  AgentBro.app.tar.gz                                  # overwritten; updater archive
  AgentBro.app.tar.gz.sig                              # overwritten; archive signature
  AgentBro_latest_universal.dmg                        # overwritten; website "download latest"
  releases/v<version>/AgentBro_<version>_universal.dmg # versioned; Homebrew cask url + permalink
```

How it works:

- The `Mirror release to Aliyun OSS` step in `build-universal` runs after the GitHub release, only for stable tags and only when `OSS_ACCESS_KEY_ID`/`OSS_ACCESS_KEY_SECRET` are set.
- `latest.json` is GitHub-flavored by `build.sh`; the step derives an OSS variant with `sed`, rewriting the archive URL prefix from GitHub to OSS. The updater signature is over the archive bytes only, so URL rewriting keeps it valid — `build.sh` and `scripts/create-updater-manifest.mjs` are untouched.
- `src-tauri/tauri.conf.json` lists two updater endpoints, OSS first then GitHub, so China hits OSS and falls back to GitHub.
- The Homebrew cask `url` points at the OSS versioned path when OSS secrets are present, otherwise at GitHub.

Required GitHub secrets: `OSS_ACCESS_KEY_ID`, `OSS_ACCESS_KEY_SECRET`. Bucket/region/prefix are non-secret and set as job env in `release.yml` (`OSS_BUCKET=aidc123`, `OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com`, `OSS_PREFIX=agentbro`).

Create a RAM sub-account with least privilege — a custom policy allowing only object writes under this prefix:

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["oss:PutObject"],
      "Resource": ["acs:oss:*:*:aidc123/agentbro/*"]
    }
  ]
}
```

The `agentbro/` prefix must be publicly readable (the bucket already serves existing objects with HTTP 200). Before the first stable release with OSS enabled, confirm both secrets are set; otherwise the mirror is skipped and the cask falls back to GitHub (a `release:check` warning flags this). After fixing, re-run the `build-universal` job to publish the mirror without cutting a new release, then verify:

```bash
curl -I https://aidc123.oss-cn-hangzhou.aliyuncs.com/agentbro/latest.json
curl -I https://aidc123.oss-cn-hangzhou.aliyuncs.com/agentbro/AgentBro_latest_universal.dmg
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
