# AgentBro v{{VERSION}}

## English

AgentBro is a native macOS desktop tool for AI coding agents. This release puts the spotlight on the **Pet Market** and ships reliability fixes for hook installation and multi-agent session display.

### Highlights

- **Pet Market** — Browse community-contributed pets and install them in one click, powered by the [`abpets`](https://www.npmjs.com/package/abpets) CLI (Node.js v18+). Open it from **Settings → Island → Pet Market**, or preview the full catalog at [www.agentbro.net/pets](https://www.agentbro.net/pets). Each agent can be assigned its own default pet.
- **Codex multi-agent sessions** — The subagent list now anchors on the active spawn wave, so completed subagents from earlier turns no longer linger in the hover list.
- **Hook installation reliability** — Fixed agentbro command detection so profiles with top-level event arrays are no longer wrongly reported as needing reinstall.
- **Less warning fatigue** — Hook Doctor no longer raises noisy warnings for optional terminal multiplexers, and reports an `info` status where appropriate.

### Install And Update

- Homebrew supports one-line installation: `brew tap shirenchuang/tap && brew install --cask agentbro`
- GitHub Releases and in-app auto update use the same release notes.
- Auto update artifacts continue to include signed `AgentBro.app.tar.gz` and `latest.json`.

### Downloads

- Recommended download: `AgentBro_latest_universal.dmg`
- Versioned archive: `AgentBro_{{VERSION}}_universal.dmg`
- Auto update files: `AgentBro.app.tar.gz` and `latest.json`

### Notes

- This version primarily supports macOS.
- Windows support will come in a later phase.

## 中文

AgentBro 是一个面向 AI Coding Agent 的 macOS 原生桌面工具。这次发布重点介绍 **宠物市场**,并带来 Hook 安装与多 Agent 会话显示的稳定性修复。

### 主要更新

- **宠物市场** —— 浏览社区贡献的宠物并一键安装,整个流程由 [`abpets`](https://www.npmjs.com/package/abpets) CLI 驱动(需 Node.js v18+)。在 **设置 → Island → 宠物市场** 即可打开,也可在网页预览全部宠物:[www.agentbro.net/pets](https://www.agentbro.net/pets)。每个 Agent 都可以单独设置默认宠物。
- **Codex 多 Agent 会话** —— 子 Agent 列表现在以当前活跃的 spawn 波次为锚点,早先轮次里已完成的子 Agent 不再残留在悬停列表中。
- **Hook 安装稳定性** —— 修复 agentbro 命令检测:顶层事件为数组的 profile 不再被误判为需要重新安装。
- **减少告警疲劳** —— Hook Doctor 不再为可选的终端复用器(terminal multiplexer)弹出嘈杂告警,并在合适处改为 `info` 状态提示。

### 安装与更新

- Homebrew 支持一行安装:`brew tap shirenchuang/tap && brew install --cask agentbro`
- GitHub Release 和应用内自动更新会使用同一份版本说明。
- 自动更新文件继续包含签名的 `AgentBro.app.tar.gz` 和 `latest.json`。

### 下载

- 推荐下载:`AgentBro_latest_universal.dmg`
- 版本归档:`AgentBro_{{VERSION}}_universal.dmg`
- 自动更新文件:`AgentBro.app.tar.gz` 与 `latest.json`

### 说明

- 当前版本主要支持 macOS。
- Windows 支持会放在后续阶段推进。
