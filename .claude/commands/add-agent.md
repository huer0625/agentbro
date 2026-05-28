---
description: 引导新增一个 Agent 适配器。用法 /add-agent <agent-name>
argument-hint: <agent-name> [installation-kind]
allowed-tools: Read, Write, Edit, Bash, Grep
---

要新增的 Agent: **$ARGUMENTS**

按下面的步骤执行,每一步做完简短汇报再做下一步。**不要并行,不要跳步。**

## 1. 摸清需求

先问用户(用 AskUserQuestion):
- 该 Agent 的 CLI 命令名是什么(用于 `which` 检测)?
- Hook 配置格式是 JSON / YAML / TOML / 自定义?
- 配置文件相对路径(相对用户 home,比如 `.foo/config.toml`)?
- 希望支持哪些事件(SessionStart / ToolUse / Notification …)?

## 2. 读参考实现

并行读这三个文件,建立模板印象:
- `src-tauri/src/agents/traits.rs` —— trait 定义
- `src-tauri/src/agents/kimi.rs` —— 最简 TOML 实现 + 测试模板
- `src-tauri/src/agents/profiles.rs` —— 第 642 行起的 `kimi_profile()` 模板

## 3. 写适配器

在 `src-tauri/src/agents/<agent-name>.rs` 写新文件,模板基于 `kimi.rs`。**只有 `parse_event` 里的事件名映射** 和 **`is_installed` 检测** 是 Agent 特异的。

## 4. 注册

修改 `src-tauri/src/agents/mod.rs`:
- 顶部加 `pub mod <agent_name>;`
- `all_adapters()`(第 214 行附近) 加 `Box::new(<agent_name>::<Name>Adapter::new())`
- `impl_default_adapter!` 宏(第 255 行附近)加 `<agent_name>::<Name>Adapter`

修改 `src-tauri/src/agents/profiles.rs`:
- 加 `pub fn <name>_profile() -> AgentIntegrationProfile { ... }`
- 在 `profile_for_agent()` 的 match 里加 `"<name>" => Some(<name>_profile()),`

## 5. 写测试

在新文件底部加 `#[cfg(test)] mod tests`,至少覆盖:
- `SessionStart` 路由
- `PreToolUse` / `PostToolUse` 路由
- 一个失败/错误事件路由

## 6. 提示用户人工补的部分

输出一段清单告诉用户:
- 在 `src/components/notch/AgentIcon.tsx`(或对应映射处)补 icon
- 在 `src/i18n/locales/{en,zh,ja,ko,tr}.json` 五份文件都补展示名
- 在 `README.md` 和 `README.en.md` 的"支持的 Agent"表加一行

(这些涉及视觉素材和措辞,建议人工而非 AI 完成。)

## 7. 收尾

运行 `/check`。全绿后回报最终改动文件清单。
