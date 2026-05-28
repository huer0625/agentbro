---
name: agentbro-release
description: Use when releasing AgentBro from this repository: merging dev/main, bumping versions, updating release notes, tagging, pushing, monitoring GitHub Actions, Homebrew cask publication, or fixing a bad release.
---

# AgentBro Release

Use this skill for AgentBro release work. Keep unrelated local changes out of commits.

## Safety Rules

- Start with `git status --short --branch`. If unrelated files are dirty, do not stage them.
- Never reuse or force-move an existing release tag. If a published release is wrong, make the next patch version.
- Do not edit signing keys, certificates, entitlements, or release secrets.
- Do not bump versions in feature PRs. Only bump for an actual release.
- If `gh` is not authenticated, use the public GitHub API with `curl` for read-only checks.

## Version Files

All four must match:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`

After editing the first three, update the lockfile with:

```bash
cargo update --manifest-path src-tauri/Cargo.toml -p agentbro
```

Run:

```bash
pnpm release:check
```

## Standard Release Flow

1. Fetch current remote state:

```bash
git fetch origin main dev --no-tags
```

2. If releasing from `dev`, merge it to `main` only after `dev` is pushed:

```bash
git checkout main
git pull --ff-only origin main
git merge --no-ff origin/dev -m "Merge branch 'dev' into main"
```

3. If `main` changed while working, pull it before creating the release commit. Stash only your own release edits if needed:

```bash
git stash push -u -m "release-work"
git pull --ff-only origin main
git stash pop
```

4. Update `.github/release-notes.md` for the actual release. The GitHub Release body and updater `latest.json` notes both come from this file.

5. Bump to the next patch version and run validation:

```bash
pnpm release:check
pnpm test:run
pnpm lint
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
```

Known acceptable warnings today:

- Vitest/jsdom may print `HTMLCanvasElement's getContext()` not implemented while tests pass.
- ESLint may report existing React hook dependency warnings.
- Vite may warn about chunk size or ineffective dynamic imports.
- `cargo check` may warn about `apps_claude_gemini` dead code.

6. Commit release-related changes separately when useful:

```bash
git add <changed-files>
git commit -m "fix: <release fix>"
git add package.json src-tauri/Cargo.lock src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore: release vX.Y.Z"
```

7. Confirm the tag does not exist:

```bash
git tag --list vX.Y.Z
git ls-remote --tags origin refs/tags/vX.Y.Z
```

8. Tag and push:

```bash
git tag vX.Y.Z
git push origin main vX.Y.Z
```

## Release Notes Gotcha

The release workflow must set the GitHub Release body explicitly. Do not rely only on `body_path`; previous releases uploaded assets but showed an empty GitHub Release body.

The workflow should:

- generate `dist/release-notes.md` from `.github/release-notes.md`
- export the generated notes to `$GITHUB_ENV`
- pass `body: ${{ env.RELEASE_NOTES }}` to `softprops/action-gh-release`

After the workflow starts, verify the Release run:

```bash
curl -fsSL "https://api.github.com/repos/shirenchuang/agentbro/actions/runs?per_page=10" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s); for (const r of j.workflow_runs.slice(0,10)) console.log([r.id,r.name,r.event,r.head_branch,r.head_sha?.slice(0,7),r.status,r.conclusion,r.html_url].join(' | '));})"
```

After the Release job completes, verify the published body:

```bash
curl -fsSL https://api.github.com/repos/shirenchuang/agentbro/releases/tags/vX.Y.Z \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const r=JSON.parse(s); console.log({tag:r.tag_name, bodyLength:r.body?.length ?? 0, url:r.html_url});})"
```

Also verify updater notes:

```bash
curl -fsSL https://github.com/shirenchuang/agentbro/releases/download/vX.Y.Z/latest.json \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s); console.log({version:j.version, notesLength:j.notes?.length ?? 0});})"
```

## Homebrew

The release workflow updates the Homebrew cask only when `HOMEBREW_TAP_TOKEN` is configured. User install command:

```bash
brew tap shirenchuang/tap && brew install --cask agentbro
```

If Homebrew update is skipped, the GitHub DMG release can still be valid.
