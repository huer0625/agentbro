# AgentBro v{{VERSION}}

AgentBro 是一个面向 AI Coding Agent 的 macOS 原生桌面工具。这次更新继续围绕开源首发版本打磨：让安装、更新、排障和核心功能理解都更顺畅。

## 主要更新

- 改进 CLI Agent 检测：统一查找可执行文件，并覆盖 Homebrew、npm、Bun、Cargo、nvm 等常见安装路径。
- 修复 Bridge 打包与安装：将 `agentbro-bridge` 作为应用资源打包，Hook 安装时会给出更清晰的缺失路径提示。
- 优化 Hook 安装体验：批量安装会跳过不可安装的 CLI，错误提示更易读。
- 改进更新流程：下载完成后再次点击安装会直接重启应用，避免重复下载。
- 调整隐私设置入口：匿名分析开关移动到关于页，方便和版本、诊断信息一起管理。
- 新增项目内 release skill：沉淀 AgentBro 发版流程、版本校验、Release notes 验证和 Homebrew 注意事项。

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
