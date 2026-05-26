# AgentBro v{{VERSION}}

AgentBro 是一个面向 AI Coding Agent 的 macOS 原生桌面工具。这次更新继续围绕开源首发版本打磨：让安装、更新、排障和核心功能理解都更顺畅。

## 主要功能

- 灵动岛状态栏：在菜单栏附近实时查看 Agent 会话、工具调用、计划、待回答问题、权限审批、完成状态和错误状态。
- 快速交互：在弹窗里直接批准/拒绝操作、回复 Agent 的问题，并快速跳回对应终端或应用继续当前任务。
- 多 Agent 监控：支持 Claude Code、Codex、Gemini CLI、Cursor、Qoder、Qwen Code、GitHub Copilot，以及本地自定义 Agent 配置。
- SSH Remote：连接远程开发机器，把远端 Agent 事件转发到本地 AgentBro 灵动岛展示。
- Skills Manager：扫描本地 Skills 目录，预览元数据和源码，管理技能包，并在兼容 Agent 之间同步技能。
- 设置与诊断：支持灵动岛布局、显示行为、快捷键、通知、声音、用量展示、相关链接、诊断报告和交流群入口。

## 本次改进

- 关于页面会显示真实的打包版本，不再显示旧的 `0.1.0-alpha` 占位版本号。
- 检查更新优先使用签名的 Tauri updater；如果当前网络无法连接 updater，会降级到 GitHub Releases 检查最新版。
- 更新弹窗支持 Markdown 渲染、中文更新说明和下载进度展示。
- GitHub Release 会带上清晰的中文更新日志，方便用户下载前理解版本内容。

## 下载

- 推荐下载：`AgentBro_latest_universal.dmg`
- 版本归档：`AgentBro_{{VERSION}}_universal.dmg`
- 自动更新文件：`AgentBro.app.tar.gz` 与 `latest.json`

## 说明

- 当前版本主要支持 macOS。
- Windows 支持会放在后续阶段推进。
