# AgentBro v{{VERSION}}

## English

This hotfix restores reliable notch placement and click-through behavior on external displays, especially Retina/high-DPI setups.

### Fixes

- **Fix notch placement on external displays** - Monitor matching now compares cursor and display bounds in the same logical coordinate space, so the notch can appear on the correct screen instead of falling back to the main display.
- **Restore collapsed click-through behavior** - The notch again toggles cursor-event ignoring dynamically: collapsed state lets clicks pass through, while hover and expanded states capture interaction.

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

这是一次热修复，恢复外接显示器上的灵动岛定位与点击穿透行为，尤其是 Retina / 高 DPI 屏幕场景。

### 修复

- **修复外接显示器上的灵动岛定位** - 显示器匹配现在会在同一套逻辑坐标空间中比较光标和屏幕边界，避免灵动岛错误回落到主屏。
- **恢复 collapsed 状态点击穿透** - 灵动岛重新动态切换 cursor-event ignore：collapsed 状态允许点击穿透，hover 和 expanded 状态捕获交互。

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
