# AgentBro v{{VERSION}}

## English

This release improves Gemini and OpenCode hook handling, permission detail rendering, chat history recovery, and external-display notch hit testing.

### Highlights

- **Improve Gemini hook events and permission flow** - Gemini hook payloads now include matchers, map blocking permission requests more accurately, and extract prompt and response fields for richer session history.
- **Improve OpenCode tool details and session history** - OpenCode permission inputs, tool labels, pending permission reconciliation, and raw-event chat history fallback are more robust.
- **Add hook diagnostics and auto-repair coverage** - Hook Doctor now checks Claude Code bare mode and Gemini folder trust, and hook setup can repair Gemini trusted folder configuration.
- **Fix notch hit testing on external displays** - The notch window now relies on CSS pointer events and monitor-relative coordinates so hover and click behavior works better on secondary displays.

### New Contributors

- Welcome @nicobeyond for their contribution in #13.

### Contributors

- @nicobeyond
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

这个版本改进了 Gemini 与 OpenCode 的 Hook 处理、权限详情展示、会话历史恢复，以及外接显示器上的灵动岛命中检测。

### 亮点

- **改进 Gemini Hook 事件与权限流程** - Gemini Hook 载荷现在包含 matcher，阻塞式权限请求映射更准确，并会提取 prompt 和响应字段用于更完整的会话历史。
- **改进 OpenCode 工具详情与会话历史** - OpenCode 权限输入、工具标签、待处理权限同步，以及原始事件兜底会话历史更加稳健。
- **增加 Hook 诊断与自动修复覆盖** - Hook Doctor 现在会检查 Claude Code bare mode 和 Gemini 文件夹信任；Hook 安装流程也能修复 Gemini trusted folder 配置。
- **修复外接显示器上的灵动岛命中检测** - 灵动岛窗口现在依赖 CSS pointer events 与相对当前显示器的坐标计算，让副屏上的 hover 和点击行为更稳定。

### 新贡献者

- 欢迎 @nicobeyond 在 #13 中贡献改进。

### 贡献者

- @nicobeyond
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
