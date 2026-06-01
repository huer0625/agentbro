# AgentBro v{{VERSION}}

## English

This is a hotfix release for macOS install and launch reliability.

### Fixes

- **Fix "damaged app" after update or DMG install** — The release pipeline now notarizes and staples the `AgentBro.app` bundle before creating both the auto-update archive and the DMG. This keeps Gatekeeper validation working even when macOS cannot reach Apple's online notarization service.
- **Reduce WebKit launch crash risk** — The notch focus handoff now avoids a forceful native order-front path that could trigger a WebKit crash on some macOS versions.
- **Keep pet mode stable on external displays** — Pet windows re-apply their fullscreen Space layer only on display changes instead of on a timer, avoiding forced fronting while dragging or placing pets on an extended display.

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

这是一次 macOS 安装和启动可靠性热修复。

### 修复

- **修复更新后或 DMG 安装后提示应用已损坏** —— 发布流程现在会先对 `AgentBro.app` 本体完成公证并 staple，再生成自动更新包和 DMG。即使 macOS 无法访问 Apple 在线公证服务，Gatekeeper 也能离线验证应用。
- **降低 WebKit 启动崩溃风险** —— 灵动岛焦点切换不再使用过强的原生置前路径，避免在部分 macOS 版本上触发 WebKit 崩溃。
- **稳定扩展屏宠物模式** —— 宠物窗口只在显示器变化等离散时机重新应用全屏 Space 层级，不再用定时器反复置前，避免拖拽或放到扩展屏时被强行抢回前台。

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
