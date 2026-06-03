# AgentBro v{{VERSION}}

## English

This release substantially expands OpenCode support and makes the in-app update panel easier to read during an update.

### Highlights

- **Expand OpenCode event coverage** - AgentBro now maps 17 OpenCode event types, including prompt submission, session errors, compaction, subagent lifecycle, shell execution, token usage, agent thoughts, tool failures, retries, and todo updates.
- **Keep OpenCode subagents grouped under the parent session** - Subagent tool calls and notifications are attributed back to the parent session, so the session list stays focused and conversation detail shows the full tool activity.
- **Improve OpenCode cleanup and reliability** - Completed OpenCode sessions now respect the configured idle timeout, plugin unload cleans up tracked sessions, and notification throttling/null handling is more robust.
- **Keep update status separate from release notes** - The download, ready-to-restart, and Homebrew status cards now sit outside the scrollable notes area so the changelog and contributor list remain readable.

### New Contributors

- Welcome @huer0625 for their first contribution in #12.

### Contributors

- @huer0625
- @shirenchuang

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

这个版本大幅扩展了 OpenCode 支持，并让应用内更新面板在更新过程中更容易阅读。

### 亮点

- **扩展 OpenCode 事件覆盖** - AgentBro 现在映射 17 类 OpenCode 事件，包括提示词提交、会话错误、上下文压缩、子代理生命周期、Shell 执行、Token 用量、Agent 思考、工具失败、重试和 todo 更新。
- **把 OpenCode 子代理归并到父会话** - 子代理的工具调用和通知会归属到父会话，避免会话列表被拆散，同时会话详情能看到完整工具活动。
- **提升 OpenCode 清理和可靠性** - 已完成的 OpenCode 会话现在遵循设置里的空闲超时；插件卸载会清理已追踪会话；通知节流和空值处理也更稳。
- **将更新状态与版本说明分离** - 下载进度、重启就绪和 Homebrew 状态卡片现在固定在滚动说明区域之外，更新日志和贡献者列表会保持可读。

### 新贡献者

- 欢迎 @huer0625 在 #12 中完成首次贡献。

### 贡献者

- @huer0625
- @shirenchuang

### 安装与更新

- Homebrew 支持一行安装: `brew tap shirenchuang/tap && brew install --cask agentbro`
- GitHub Release 和应用内自动更新会使用同一份版本说明。
- 自动更新文件包含签名的 `AgentBro.app.tar.gz` 与 `latest.json`。

### 下载

- 推荐下载: `AgentBro_latest_universal.dmg`
- 版本归档: `AgentBro_{{VERSION}}_universal.dmg`
- 自动更新文件: `AgentBro.app.tar.gz` 与 `latest.json`
- 国内直链: `https://agentbro.oss-cn-hangzhou.aliyuncs.com/AgentBro_latest_universal.dmg`

### 说明

- 当前版本主要支持 macOS。
- Windows 支持会放在后续阶段推进。
