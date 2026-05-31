# AgentBro v{{VERSION}}

## English

AgentBro is a native macOS desktop tool for AI coding agents. This release improves terminal focus, overlay controls, pet marketplace state, and TRAE CN SOLO detection.

### Highlights

- **Better terminal jump behavior** — AgentBro now supports Wave terminal focus and keeps notification dismissal in sync after jumping back to the host terminal or IDE.
- **TRAE CN SOLO support** — TRAE CN detection now recognizes the SOLO app bundle, app path, config root, and native focus target.
- **Safer overlay replies** — Sessions that cannot receive direct messages now show a clear locked composer hint instead of an input that cannot deliver the reply.
- **Cleaner permission prompts** — Common read-only tool approval prompts use a more compact layout while prompts with diffs still keep the larger review surface.
- **Pet market polish** — Installed market pets are matched more reliably, install/uninstall jobs now stay attached to their pet cards, and the market adds a direct upload entry point.
- **Island and chat refinements** — Local images render in notch chat, hover/focus behavior is steadier, and the settings window has more room for dense panels.

### Install And Update

- Homebrew supports one-line installation: `brew tap shirenchuang/tap && brew install --cask agentbro`
- GitHub Releases and in-app auto update use the same release notes.
- Auto update artifacts continue to include signed `AgentBro.app.tar.gz` and `latest.json`.

### Downloads

- Recommended download: `AgentBro_latest_universal.dmg`
- Versioned archive: `AgentBro_{{VERSION}}_universal.dmg`
- Auto update files: `AgentBro.app.tar.gz` and `latest.json`
- Mainland China mirror: `https://agentbro.oss-cn-hangzhou.aliyuncs.com/AgentBro_latest_universal.dmg`

### Notes

- This version primarily supports macOS.
- Windows support will come in a later phase.

## 中文

AgentBro 是一个面向 AI Coding Agent 的 macOS 原生桌面工具。这次发布改进了终端聚焦、覆盖层控制、宠物市场状态和 TRAE CN SOLO 识别。

### 主要更新

- **终端跳转更稳** —— AgentBro 现在支持 Wave 终端聚焦,并在跳回终端或 IDE 后同步收起对应通知。
- **支持 TRAE CN SOLO** —— TRAE CN 识别现在覆盖 SOLO 应用 bundle、应用路径、配置目录和原生聚焦目标。
- **覆盖层回复更安全** —— 对暂时无法直发消息的会话,现在会显示明确的输入锁定提示,不再展示无法送达的输入框。
- **权限提示更紧凑** —— 常见只读工具的权限请求会使用更紧凑的布局;带 diff 的请求仍保留更完整的审阅空间。
- **宠物市场打磨** —— 市场宠物的已安装状态匹配更可靠,安装/卸载进度直接显示在对应卡片上,并新增上传入口。
- **灵动岛和聊天细节** —— Notch 聊天支持本地图片渲染,悬停和焦点行为更稳定,设置窗口也为密集面板提供了更宽空间。

### 安装与更新

- Homebrew 支持一行安装:`brew tap shirenchuang/tap && brew install --cask agentbro`
- GitHub Release 和应用内自动更新会使用同一份版本说明。
- 自动更新文件继续包含签名的 `AgentBro.app.tar.gz` 与 `latest.json`。

### 下载

- 推荐下载:`AgentBro_latest_universal.dmg`
- 版本归档:`AgentBro_{{VERSION}}_universal.dmg`
- 自动更新文件:`AgentBro.app.tar.gz` 与 `latest.json`
- 国内直链:`https://agentbro.oss-cn-hangzhou.aliyuncs.com/AgentBro_latest_universal.dmg`

### 说明

- 当前版本主要支持 macOS。
- Windows 支持会放在后续阶段推进。
