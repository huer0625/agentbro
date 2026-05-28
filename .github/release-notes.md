# AgentBro v{{VERSION}}

AgentBro 是一个面向 AI Coding Agent 的 macOS 原生桌面工具。这次更新继续围绕开源首发版本打磨：让安装、更新、排障和核心功能理解都更顺畅。

## 主要更新

- 新增宠物灵动岛体验：支持宠物模式、宠物状态展示、活力/压力反馈和调试预览能力。
- 改进外接显示器定位：修复多显示器场景下灵动岛位置和窗口显示异常。
- 改进 Webhook 通知：支持多语言通知文案，并在审批类通知里展示更完整的上下文。
- 优化终端跳转：避免重复点击跳转按钮时触发并发跳转导致系统卡顿。
- 暂时隐藏设置里的“Agent 与技能”入口，避免未完成模块在正式版本中暴露。

## 安装与更新

- Homebrew 支持一行安装：`brew tap shirenchuang/tap && brew install --cask agentbro`
- GitHub Release 和应用内自动更新会使用同一份版本说明。
- 自动更新文件继续包含签名的 `AgentBro.app.tar.gz` 和 `latest.json`。

## 下载

- 推荐下载：`AgentBro_latest_universal.dmg`
- 版本归档：`AgentBro_{{VERSION}}_universal.dmg`
- 自动更新文件：`AgentBro.app.tar.gz` 与 `latest.json`

## 说明

- 当前版本主要支持 macOS。
- Windows 支持会放在后续阶段推进。
