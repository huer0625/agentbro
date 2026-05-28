# AgentBro v{{VERSION}}

AgentBro 是一个面向 AI Coding Agent 的 macOS 原生桌面工具。这次更新继续围绕开源首发版本打磨：让安装、更新、排障和核心功能理解都更顺畅。

## 主要更新

- 修复正式发布打包失败：确保 `Contents/Resources/agentbro-bridge` 带有可执行权限并完成 Developer ID 签名，避免 Apple notarization 拒绝 helper 可执行文件。
- 保留 v0.1.8/v0.1.9 的改进：CLI Agent 检测、Bridge 资源打包、Hook 安装体验、更新重启流程、隐私设置入口和项目内 release skill。

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
