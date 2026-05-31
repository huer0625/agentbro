# AgentBro v{{VERSION}}

## English

AgentBro is a native macOS desktop tool for AI coding agents. This release adds in-app update notifications, a faster China download mirror, and self-healing hook installation.

### Highlights

- **In-app update notifications** — AgentBro now checks for new versions in the background and surfaces an update banner right in the island, with a dot on the collapsed bar and a richer update dialog. No more manually checking GitHub for releases.
- **China download mirror** — Releases are now mirrored to an Aliyun OSS bucket, so users in mainland China get fast, reliable downloads and auto-updates without GitHub timeouts. The updater tries the China mirror first and falls back to GitHub automatically.
- **Self-healing hooks** — If an external tool overwrites your agent settings and wipes AgentBro's hooks, they are now automatically restored, so the island keeps working without a manual reinstall.
- **Pet tuning** — The pet scale slider now goes down to 10%, for an even more compact desktop pet.

### Install And Update

- Homebrew supports one-line installation: `brew tap shirenchuang/tap && brew install --cask agentbro`
- GitHub Releases and in-app auto update use the same release notes.
- Auto update artifacts continue to include signed `AgentBro.app.tar.gz` and `latest.json`.

### Downloads

- Recommended download: `AgentBro_latest_universal.dmg`
- Versioned archive: `AgentBro_{{VERSION}}_universal.dmg`
- Auto update files: `AgentBro.app.tar.gz` and `latest.json`
- 🇨🇳 Mainland China mirror (faster): `https://agentbro.oss-cn-hangzhou.aliyuncs.com/AgentBro_latest_universal.dmg`

### Notes

- This version primarily supports macOS.
- Windows support will come in a later phase.

## 中文

AgentBro 是一个面向 AI Coding Agent 的 macOS 原生桌面工具。这次发布带来应用内更新提示、更快的国内下载镜像,以及可自愈的 Hook 安装。

### 主要更新

- **应用内更新提示** —— AgentBro 现在会在后台检查新版本,并直接在灵动岛里弹出更新横幅:折叠条上有小红点,更新弹窗也更完善。不用再手动去 GitHub 看有没有新版了。
- **国内下载镜像** —— 发布产物现在会镜像到阿里云 OSS,国内用户无需再忍受 GitHub 超时,下载和自动更新又快又稳。更新器会优先走国内镜像,异常时自动回落到 GitHub。
- **Hook 自愈** —— 如果外部工具覆盖了你的 Agent 配置、把 AgentBro 的 Hook 抹掉了,现在会自动恢复,灵动岛无需手动重装即可继续工作。
- **宠物微调** —— 宠物大小滑块下限降到 10%,桌面宠物可以更小巧。

### 安装与更新

- Homebrew 支持一行安装:`brew tap shirenchuang/tap && brew install --cask agentbro`
- GitHub Release 和应用内自动更新会使用同一份版本说明。
- 自动更新文件继续包含签名的 `AgentBro.app.tar.gz` 和 `latest.json`。

### 下载

- 推荐下载:`AgentBro_latest_universal.dmg`
- 版本归档:`AgentBro_{{VERSION}}_universal.dmg`
- 自动更新文件:`AgentBro.app.tar.gz` 与 `latest.json`
- 🇨🇳 国内直链(速度更快):`https://agentbro.oss-cn-hangzhou.aliyuncs.com/AgentBro_latest_universal.dmg`

### 说明

- 当前版本主要支持 macOS。
- Windows 支持会放在后续阶段推进。
