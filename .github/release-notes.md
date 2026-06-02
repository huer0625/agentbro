# AgentBro v{{VERSION}}

## English

This release improves agent hook reliability, CLI detection from macOS GUI launches, and pet/settings window behavior.

### Highlights

- **Find CLI tools from GUI-launched AgentBro** — AgentBro now checks the process PATH, login shell PATH, and common Homebrew, nvm, Volta, mise, and Cargo directories before reporting a CLI as missing. This helps tools such as OpenCode and Gemini work even when AgentBro is started from Finder or Dock.
- **Keep agent sessions after response completion** — Stop events from OpenCode, Gemini, Cursor, Kiro, Trae, Qoder, and other adapters now map to assistant response completion instead of ending and cleaning up the whole session.
- **Fix Gemini hook installation** — Gemini hooks now use the nested hook format expected by Gemini CLI.
- **Improve hook diagnostics** — Hook Doctor now checks Claude Code bare mode and Gemini folder trust, and Gemini hook install can add the current folder to trusted folders automatically.
- **Stabilize pet and settings windows** — Pet mode keeps its dragged position more reliably, settings windows center on the active monitor, and the quit action now lives in General Settings.

### Fixes

- **Proxy and config lookup from login shells** — Claude Code config lookup and marketplace proxy detection now reuse the same shell-aware environment lookup used for CLI detection.
- **Workflow guardrails for maintainers** — The project now includes an AgentBro PR merge skill and release skill updates so future PR merges preserve contributor attribution and release notes include first-time contributors.

### New Contributors

- Welcome @nicobeyond for their first contribution in #11.

### Install And Update

- Homebrew supports one-line installation: `brew tap shirenchuang/tap && brew install --cask agentbro`
- GitHub Releases and in-app auto update use the same release notes.
- Auto update artifacts include signed `AgentBro.app.tar.gz` and `latest.json`.

### Downloads

- Recommended download: `AgentBro_latest_universal.dmg`
- Versioned archive: `AgentBro_{{VERSION}}_universal.dmg`
- Auto update files: `AgentBro.app.tar.gz` and `latest.json`
- Mainland China mirror: `https://agentbro.oss-cn-hangzhou.aliyuncs.com/AgentBro_latest_universal.dmg`

### Notes

- This version primarily supports macOS.
- Windows support will come in a later phase.

## 中文

这个版本提升了 Agent hooks 可靠性、macOS 图形界面启动后的 CLI 检测，以及宠物/设置窗口行为。

### 亮点

- **从图形界面启动时也能找到 CLI 工具** —— AgentBro 现在会检查进程 PATH、login shell PATH，以及 Homebrew、nvm、Volta、mise、Cargo 等常见目录，再判断 CLI 是否缺失。这样从 Finder 或 Dock 启动 AgentBro 时，OpenCode、Gemini 等工具更容易正常工作。
- **保留 Agent 响应完成后的会话** —— OpenCode、Gemini、Cursor、Kiro、Trae、Qoder 等 adapter 的 Stop 事件现在会映射为助手响应完成，而不是结束并清理整个会话。
- **修复 Gemini hook 安装格式** —— Gemini hooks 现在使用 Gemini CLI 期望的嵌套格式。
- **增强 hook 诊断** —— Hook Doctor 新增 Claude Code bare mode 和 Gemini folder trust 检查；安装 Gemini hooks 时也可以自动把当前目录加入 trusted folders。
- **稳定宠物和设置窗口** —— 宠物模式更可靠地保留拖拽位置，设置窗口会在当前显示器居中，退出操作也移动到了通用设置里。

### 修复

- **从 login shell 读取代理和配置** —— Claude Code 配置目录读取、市场代理检测现在复用同一套 shell-aware 环境变量读取逻辑。
- **维护流程护栏** —— 项目新增 AgentBro PR merge skill，并更新 release skill，后续合并 PR 时会保留贡献者归因，发布说明也会检查首次贡献者。

### 新贡献者

- 欢迎 @nicobeyond 在 #11 中完成首次贡献。

### 安装与更新

- Homebrew 支持一行安装:`brew tap shirenchuang/tap && brew install --cask agentbro`
- GitHub Release 和应用内自动更新会使用同一份版本说明。
- 自动更新文件包含签名的 `AgentBro.app.tar.gz` 与 `latest.json`。

### 下载

- 推荐下载:`AgentBro_latest_universal.dmg`
- 版本归档:`AgentBro_{{VERSION}}_universal.dmg`
- 自动更新文件:`AgentBro.app.tar.gz` 与 `latest.json`
- 国内直链:`https://agentbro.oss-cn-hangzhou.aliyuncs.com/AgentBro_latest_universal.dmg`

### 说明

- 当前版本主要支持 macOS。
- Windows 支持会放在后续阶段推进。
