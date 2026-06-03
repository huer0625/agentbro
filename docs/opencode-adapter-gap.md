# OpenCode 适配器功能补全方案

> 状态: 待实施 | 影响范围: `src-tauri/src/agents/opencode.rs` + `src-tauri/src/agents/profiles.rs` | 预计增量: ~320 行

## 1. 背景

AgentBro 是一个 macOS Tauri 桌面应用，通过适配器模式为 24 个 AI 编程工具提供 Dynamic Island 风格的事件监控浮层。其中 Claude Code 适配器（~1400 行）是最完善的参考实现，OpenCode 适配器（~238 行）存在大量功能缺失。

OpenCode（[opencode](https://github.com/stackblitz-labs/opencode)）拥有丰富的内部 V2 事件总线（40+ 种事件类型），其插件系统通过 `event-v2-bridge.ts` 可将这些事件桥接给第三方插件。当前 AgentBro 的 OpenCode 适配器仅利用了其中 7 类事件，大量可用信号被丢弃。

本方案基于 OpenCode 源码（`/Users/apple/workspace/kaiyuan/opencode`）和 AgentBro 源码（`/Volumes/data/workspace/kaiyuan/agentbro`）的双向调研，列出所有可实现的补全项及具体实施路径。

---

## 2. 现状对比

### 2.1 代码量与功能差距

| 维度 | Claude Code 适配器 | OpenCode 适配器 | 差距 |
|------|:---:|:---:|---|
| 适配器代码行数 | ~1400 | ~238 | 6x |
| 支持事件种类 | 20 | 7 | 差 13 种 |
| `tool_target` 提取 | ✅ | ❌ 恒为 `None` | 核心功能缺失 |
| 子代理可见性 | ✅ | ❌ | — |
| Token 用量统计 | ✅ | ❌ | — |
| Shell 生命周期 | ✅ | ❌ | — |
| AI 思考内容展示 | ✅ | ❌ | — |
| 错误通知 | ✅ | ❌ | — |
| 上下文压缩提示 | ✅ | ❌ | — |
| Hook 完整性验证 | ✅ `verify_hooks()` | ❌ | 无安装校验 |
| 启动自动安装 | ✅ | ❌ | — |

### 2.2 已支持事件（7 种）

当前 OpenCode 适配器通过 `parse_event` 处理的 7 种 `hook_event_name`：

| 事件名 | OpenCode 原始事件源 | 映射到的 AgentEvent | 现有缺陷 |
|--------|-------------------|---------------------|---------|
| `SessionStart` | `session.created` | `AgentEvent::SessionStart` | — |
| `SessionEnd` | `session.deleted` / `session.updated (archived)` | `AgentEvent::SessionEnd` | — |
| `PreToolUse` | `message.part.updated` (tool state = `running`/`pending`) | `AgentEvent::ToolUse { status: "running" }` | `tool_target` 恒为 `None` |
| `PostToolUse` | `message.part.updated` (tool state = `completed`/`error`) | `AgentEvent::ToolUse { status: "success" }` | 不区分 completed 和 error；`tool_target` 恒为 `None` |
| `PermissionRequest` | `permission.asked` / `question.asked` | `AgentEvent::PermissionRequest` | — |
| `UserPromptSubmit` | `message.part.updated` (user text) | 掉入 `_ => Processing` | **丢失 prompt 内容** |
| `Stop` | `session.status` (idle) | 错误映射为 `AgentEvent::SessionEnd` | **应映射为 `AssistantResponseComplete`** |

### 2.3 已知适配器侧缺陷（插件已在发送，适配器未正确处理）

#### 缺陷 1：UserPromptSubmit 丢失 prompt 内容

**现象**：OpenCode 插件在检测到 user text part 时，发送：

```json
{
  "hook_event_name": "UserPromptSubmit",
  "prompt": "请帮我修复这个 bug",
  "session_id": "opencode-xxx",
  "cwd": "/path/to/project"
}
```

适配器 `parse_event` 的 `match event` 中没有 `"UserPromptSubmit"` 分支，落入通配 `_ => Processing`，prompt 内容完全丢失，在 Dynamic Island 中仅显示无意义的 "Event: UserPromptSubmit"。

**影响**：用户看不到自己发送的 prompt 预览，失去了最直观的会话反馈。

#### 缺陷 2：Stop 映射为 SessionEnd（语义错误）

**现象**：OpenCode 插件在检测到会话进入 idle 状态时，发送：

```json
{
  "hook_event_name": "Stop",
  "session_id": "opencode-xxx",
  "last_assistant_message": "已修复 login 页面的样式问题",
  "session_title": "Fix login page style"
}
```

适配器当前代码：

```rust
"SessionEnd" | "Stop" => Ok(AgentEvent::SessionEnd { session_id }),
```

这导致 `last_assistant_message` 和 `session_title` 被忽略，且事件语义从"AI 完成了一次响应"被错误解释为"会话结束"。

**正确行为**：`Stop` 应映射为 `AgentEvent::AssistantResponseComplete { session_id, text }`，其中 `text` 含标题（如有）和最后一条 assistant 消息的摘要。

#### 缺陷 3：tool_target 恒为 None

**现象**：OpenCode 插件通过 `message.part.updated` 的 `properties.part.state.input` 传递工具输入 JSON 对象（含 `command`、`file_path`、`pattern`、`description`、`query` 等字段）。适配器正确保存了 `tool_input` 字符串，但未从中提取摘要信息填充 `tool_target`。

Claude Code 适配器的 `extract_tool_target()` 函数按工具名匹配：

| 工具名 | 提取字段 | 预览格式 |
|--------|---------|---------|
| `Read` / `Edit` / `Write` / `Glob` / `Grep` | `file_path` 或 `path` | 文件路径 |
| `Bash` / `shell` | `command` | 截取前 50 字符的命令 |
| `TaskCreate` / `TaskUpdate` / `TaskList` | `subject` 或 `name` | 任务描述 |
| `WebSearch` | `query` | 截取前 50 字符的搜索词 |

> OpenCode 的工具名略有不同（如 `delegate`、`task`），需单独适配。

#### 缺陷 4：PostToolUse 不区分 completed 和 error

**现象**：插件在 `state` 为 `"completed"` 和 `"error"` 时均发送 `hook_event_name: "PostToolUse"`，但未传递 `tool_state` 字段。适配器将其统一标记为 `status: "success"`，用户无法区分工具执行成功与失败。

**修复方向**：插件模板增加 `tool_state` 字段，适配器根据其值设置 status。

---

## 3. OpenCode 插件系统能力分析

### 3.1 可拦截的 V2 事件总线（共 40+ 种）

OpenCode 通过内部 `event-v2-bridge.ts` 将 V2 流事件桥接到 Bus 总线。所有注册了 `event` hook 的插件都能收到以下事件。这些事件以 `{ type, properties }` 格式发送给插件。

#### 3.1.1 Session 生命周期

| 事件 `type` | `properties` 关键字段 | 可映射的 AgentBro 事件 |
|------------|----------------------|----------------------|
| `session.created` | `info: Session { id, parentID, directory, title }` | `SessionStart`；若 `parentID !== null` 则为子代理创建 |
| `session.updated` | `info: Session` | 标题更新；若 `time.archived` → `SessionEnd` |
| `session.deleted` | `info: Session` | `SessionEnd` |
| `session.error` | `error` (含 `ProviderAuthError` 等) | `Error` |
| `session.compacted` | `sessionID` | `Notification("Context compacted")` |
| `session.diff` | `diff: FileDiff[]` | 文件变更通知（当前不映射） |
| `session.status` | `sessionID`, `status: { type: "idle" / "retry" / "busy" }` | `idle` → `AssistantResponseComplete`；`retry` → `Notification` |

#### 3.1.2 子代理检测（通过 `parentID` 识别）

| 事件 `type` | 识别条件 | 可映射事件 |
|------------|---------|-----------|
| `session.created` | `info.parentID !== null` | 记录到 `sessionParentMap`，暂不发射 |
| `session.next.agent.switched` | sessionID 在 parentMap 中 | `SubagentStart`，含 agent 名称 |
| `session.status` (idle) | sessionID 在 parentMap 中 | `SubagentStop`，清理记录 |

**子代理追踪机制设计**：

1. 在 JS 插件模板中维护 `sessionParentMap: Map<string, string>`
2. 每一条 `session.created` 检查 `info.parentID`，若非 null 则写入 map
3. `session.next.agent.switched` 时，若 sessionID 在 map 中，发射 `SubagentStart`
4. `session.status` 且 `type === "idle"` 时，若 sessionID 在 map 中，发射 `SubagentStop` 并清理

#### 3.1.3 Token 用量

| 事件 `type` | `properties` 关键字段 | 可映射事件 |
|------------|----------------------|-----------|
| `session.next.step.ended` | `tokens: { input, output, reasoning, cache }`, `cost` | `TokenUsage` + `Notification`（含 token 统计文本） |
| `session.next.step.failed` | `error` | `Error` |
| `session.next.retried` | `attempt`, `error` | `Notification("Retrying...")` |

#### 3.1.4 Shell 执行

| 事件 `type` | `properties` 关键字段 | 可映射事件 |
|------------|----------------------|-----------|
| `session.next.shell.started` | `command`, `callID` | `ShellExecutionStart` |
| `session.next.shell.ended` | `output`, `callID` | `ShellExecutionEnd`（含 exitCode, stdout, stderr, duration） |

#### 3.1.5 工具执行

| 事件 `type` | `properties` 关键字段 | 可映射事件 |
|------------|----------------------|-----------|
| `session.next.tool.called` | `tool`, `input` | 工具调用（当前走 `message.part.updated` 处理，可补充） |
| `session.next.tool.success` | `structured`, `content` | 工具成功（补充路径） |
| `session.next.tool.failed` | `error` | `PostToolUseFailure` → `ToolUse { status: "error" }` |

#### 3.1.6 推理/思考

| 事件 `type` | `properties` 关键字段 | 可映射事件 |
|------------|----------------------|-----------|
| `session.next.reasoning.started` | `reasoningID`, `text` | `AgentThought` (开始思考) |
| `session.next.reasoning.ended` | `reasoningID`, `text` | `AgentThought` (思考内容摘要) |

#### 3.1.7 上下文压缩

| 事件 `type` | `properties` 关键字段 | 可映射事件 |
|------------|----------------------|-----------|
| `session.next.compaction.started` | `reason: "auto" / "manual"` | `Notification("Compacting context...")` |
| `session.next.compaction.ended` | `text` | `Notification("Context compacted")` |

#### 3.1.8 其他

| 事件 `type` | `properties` 关键字段 | 可映射事件 |
|------------|----------------------|-----------|
| `todo.updated` | `todos: Todo[]` | `Notification("Todo updated: N items")` |
| `message.part.updated` | `part: Part { tool, state }` | 当前已使用，需补充 tool_state 传递 |

### 3.2 其他可用 Hooks（非 event 类）

OpenCode 插件系统除 `event` hook 外，还提供以下 hook 类型，当前未使用，可作为未来扩展方向：

| Hook 类型 | 触发时机 | 潜在用途 |
|----------|---------|---------|
| `shell.env` | Shell 执行前 | **已使用**：注入 `AGENTBRO_BRIDGE` 等环境变量 |
| `permission.ask` | 权限询问前 | 与当前 `permission.asked` 事件配合，可实现双向拦截 |
| `tool.execute.before` | 工具执行前 | 工具拦截/审计 |
| `tool.execute.after` | 工具执行后 | 工具结果后处理 |
| `chat.message` | 消息发送/接收 | 消息内容拦截 |
| `experimental.session.compacting` | 压缩前 | 压缩行为自定义 |

---

## 4. 修复方案

### 4.1 整体优先级

| 优先级 | 范围 | 说明 |
|:---:|------|------|
| **P0** | 仅改 `opencode.rs` | 插件已在发送数据，适配器侧即可修复。零 JS 模板改动，风险极低 |
| **P1** | `profiles.rs` JS 模板 + `opencode.rs` | 插件模板新增事件映射，适配器新增解析分支。增量功能 |
| **P2** | `opencode.rs` + `profiles.rs` | 深度集成：hook 验证、启动自动安装 |

---

### 4.2 P0：适配器侧修复（仅改 opencode.rs，风险最低）

以下 4 项修复仅涉及 Rust 适配器代码，JS 插件模板无需任何改动。所有需要的数据插件已在发送。

#### P0-1：UserPromptSubmit 解析

**现状**：插件模板第 2294 行已发送 `hook_event_name: "UserPromptSubmit"` 及 `prompt` 字段。适配器无此 match arm。

**方案**：在 `parse_event` 的 `match event` 中新增分支，提取 `prompt` 首行前 80 字符作为 `description`。以 `Processing` 事件输出（因为 `AgentEvent` 无专用的 UserPromptSubmit 变体），这样可在 Dynamic Island 中展示用户输入预览。

```rust
"UserPromptSubmit" => {
    let prompt_text = raw
        .get("prompt")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let preview: String = prompt_text
        .lines()
        .next()
        .unwrap_or("")
        .chars()
        .take(80)
        .collect();
    Ok(AgentEvent::Processing {
        session_id,
        description: if preview.is_empty() {
            "User prompt submitted".to_string()
        } else {
            preview
        },
    })
}
```

#### P0-2：Stop 正确映射为 AssistantResponseComplete

**现状**：`Stop` 与 `SessionEnd` 被合并处理，`last_assistant_message` 和 `session_title` 被丢弃。

**方案**：拆分 `Stop` 为独立分支，组装摘要文本：

```rust
"Stop" => {
    let last_msg = raw
        .get("last_assistant_message")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let title = raw
        .get("session_title")
        .and_then(|v| v.as_str());
    let text = match (title, last_msg) {
        (Some(t), m) if !m.is_empty() => {
            format!("[{}] {}", t, truncate_text(m, 100))
        }
        (Some(t), _) => t.to_string(),
        (None, m) if !m.is_empty() => truncate_text(m, 120).to_string(),
        (None, _) => "Assistant response completed".to_string(),
    };
    Ok(AgentEvent::AssistantResponseComplete {
        session_id,
        text,
    })
}
"SessionEnd" => Ok(AgentEvent::SessionEnd { session_id }),
```

> `truncate_text` 为内部辅助函数，限制展示文本长度。

#### P0-3：实现 extract_tool_target()

**方案**：在 `opencode.rs` 中新增独立函数 `extract_tool_target()`，于 `PreToolUse` 和 `PostToolUse` 分支中调用。参考 Claude Code 适配器的实现，适配 OpenCode 工具名差异：

```rust
fn extract_tool_target(tool_name: &str, tool_input: &serde_json::Value) -> Option<String> {
    match tool_name {
        "Read" | "Edit" | "Write" => {
            tool_input.get("file_path")
                .or_else(|| tool_input.get("path"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        }
        "Bash" => {
            tool_input.get("command")
                .and_then(|v| v.as_str())
                .map(|s| truncate_display_text(s.trim(), 50))
        }
        "Glob" | "Grep" => {
            tool_input.get("pattern")
                .and_then(|v| v.as_str())
                .map(|s| truncate_display_text(s.trim(), 50))
        }
        "Task" | "task" => {
            tool_input.get("description")
                .or_else(|| tool_input.get("subagent_name"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        }
        "WebSearch" | "WebFetch" => {
            tool_input.get("query")
                .and_then(|v| v.as_str())
                .map(|s| truncate_display_text(s.trim(), 50))
        }
        "delegate" => {
            tool_input.get("prompt")
                .and_then(|v| v.as_str())
                .map(|s| truncate_display_text(s.trim(), 50))
        }
        _ => None,
    }
}
```

**注意**：`tool_input` 从 `raw.get("tool_input")` 获取的是 JSON 字符串，需先解析为 `serde_json::Value` 再传入。

#### P0-4：PostToolUse 区分 error 和 completed

**修改范围**：JS 插件模板（`profiles.rs`）+ `opencode.rs`。

**JS 模板改动**（行 2303）：在发送 `PostToolUse` 时增加 `tool_state` 字段：

```javascript
// 改动前
if (state === "completed" || state === "error") return makeBasePayload(sessionId, { ... });

// 改动后
if (state === "completed" || state === "error") return makeBasePayload(sessionId, {
    hook_event_name: "PostToolUse",
    cwd: session.cwd,
    tool_name: toolName,
    tool_input: isObject(toolInput) || Array.isArray(toolInput) ? toolInput : undefined,
    tool_state: state,
});
```

**适配器改动**（`PostToolUse` 分支）：

```rust
"PostToolUse" => {
    let parsed_input = raw.get("tool_input")
        .and_then(|v| if v.is_string() {
            serde_json::from_str(v.as_str().unwrap_or("{}")).ok()
        } else {
            Some(v.clone())
        });
    let tool_target = match parsed_input.as_ref() {
        Some(input) => extract_tool_target(tool_name, input),
        None => None,
    };
    let tool_state = raw.get("tool_state")
        .and_then(|v| v.as_str())
        .unwrap_or("success");
    Ok(AgentEvent::ToolUse {
        session_id,
        tool_name,
        tool_input: raw.get("tool_input").map(|v| v.to_string()).unwrap_or_default(),
        tool_target,
        status: if tool_state == "error" { "error" } else { "success" }.to_string(),
    })
}
```

---

### 4.3 P1：JS 模板扩展 + 适配器事件映射

以下 14 项新增事件均需在 JS 插件模板中添加事件映射逻辑，并在适配器中注册 `hook_event_name` 和 `OPENCODE_EVENTS`。

#### 4.3.1 JS 模板新增事件映射（在 `mapEvent` 函数中添加）

| # | OpenCode V2 事件 `type` | 新增 `hook_event_name` | 目标 `AgentEvent` |
|---|------------------------|----------------------|------------------|
| P1-1 | `session.error` | `Error` | `AgentEvent::Error` |
| P1-2 | `session.compacted` | `Notification` | `AgentEvent::Notification("Context compacted")` |
| P1-3 | `session.next.agent.switched`（子代理 session） | `SubagentStart` | `AgentEvent::SubagentStart` |
| P1-4 | `session.status` type=`idle`（子代理 session） | `SubagentStop` | `AgentEvent::SubagentStop` |
| P1-5 | `session.next.step.ended` | `StepEnded` | `TokenUsage` + `Notification`（含 token 统计字符串） |
| P1-6 | `session.next.step.failed` | `Error` | `AgentEvent::Error` |
| P1-7 | `session.next.shell.started` | `ShellExecutionStart` | `AgentEvent::ShellExecutionStart` |
| P1-8 | `session.next.shell.ended` | `ShellExecutionEnd` | `AgentEvent::ShellExecutionEnd` |
| P1-9 | `session.next.compaction.started` | `Notification` | `AgentEvent::Notification("Compacting context...")` |
| P1-10 | `session.next.compaction.ended` | `Notification` | `AgentEvent::Notification("Context compacted")` |
| P1-11 | `session.next.tool.failed` | `PostToolUseFailure` | `AgentEvent::ToolUse { status: "error" }` |
| P1-12 | `session.next.reasoning.ended` | `AgentThought` | `AgentEvent::AgentThought` |
| P1-13 | `session.next.retried` | `Notification` | `AgentEvent::Notification("Retrying...")` |
| P1-14 | `todo.updated` | `Notification` | `AgentEvent::Notification("Todo: N items")` |

**JS 模板实现示例**（以 `session.next.step.ended` 为例）：

```javascript
if (type === "session.next.step.ended" && isObject(properties.tokens) && stableString(properties.sessionID)) {
  const rawSessionID = stableString(properties.sessionID);
  const tokens = properties.tokens;
  const cost = properties.cost;
  const stats = `Tokens: ↑${tokens.input ?? "?"} ↓${tokens.output ?? "?"}${tokens.cache ? ` ⚡${tokens.cache}` : ""}${cost ? ` $${Number(cost).toFixed(4)}` : ""}`;
  return makeBasePayload(`opencode-${rawSessionID}`, {
    hook_event_name: "StepEnded",
    cwd: getSession(rawSessionID).cwd,
    tokens,
    cost,
    stats,
  });
}
```

#### 4.3.2 OPENCODE_EVENTS 注册扩展

在 `profiles.rs` 中扩展 `OPENCODE_EVENTS` 常量：

```rust
pub const OPENCODE_EVENTS: &[HookEventDescriptor] = &[
    plain_event("SessionStart"),
    plain_event("SessionEnd"),
    plain_event("UserPromptSubmit"),
    plain_event("PreToolUse"),
    plain_event("PostToolUse"),
    plain_event("PostToolUseFailure"),
    plain_event("PermissionRequest"),
    plain_event("Stop"),
    plain_event("Error"),
    plain_event("Notification"),
    plain_event("SubagentStart"),
    plain_event("SubagentStop"),
    plain_event("StepEnded"),
    plain_event("ShellExecutionStart"),
    plain_event("ShellExecutionEnd"),
    plain_event("AgentThought"),
    plain_event("TokenUsage"),
];
```

#### 4.3.3 opencode.rs parse_event 新增处理

为以上所有新增 `hook_event_name` 添加匹配分支：

| 新增事件名 | parse_event 处理逻辑 |
|-----------|--------------------|
| `Error` | 提取 `error.message` 或 `error` 字符串，映射 `AgentEvent::Error` |
| `Notification` | 提取 `message` 字段，映射 `AgentEvent::Notification`，可选 `status` |
| `SubagentStart` | 提取 `agent` 字段，映射 `AgentEvent::SubagentStart` |
| `SubagentStop` | 标记 `status: "completed"`，映射 `AgentEvent::SubagentStop` |
| `StepEnded` | 提取 `tokens` 和 `stats`，映射 `TokenUsage` + `Notification` |
| `ShellExecutionStart` | 提取 `command`，映射 `AgentEvent::ShellExecutionStart` |
| `ShellExecutionEnd` | 提取 `output`/`exitCode`，映射 `AgentEvent::ShellExecutionEnd` |
| `AgentThought` | 提取 `text` 字段，截取前 200 字符，映射 `AgentEvent::AgentThought` |
| `PostToolUseFailure` | 复用 `PostToolUse` 逻辑，status 设为 `"error"` |

> 详情见实施阶段的代码 diff。

---

### 4.4 P2：深度集成

#### P2-1：实现 verify_hooks()

在 OpenCode 适配器中新增 `verify_hooks()` 方法，参考 Claude Code 适配器的实现：

1. 检查 `~/.config/opencode/plugins/agentbro.js` 文件存在
2. 检查 `~/.config/opencode/opencode.json` 包含 `agentbro` 插件注册
3. 返回 `HookVerificationResult::Ok` / `NeedsReinstall` / `SettingsCorrupted`

```rust
pub fn verify_hooks(&self) -> HookVerificationResult {
    // 1. 检查插件文件存在
    let plugin_path = self.plugin_path();
    if !plugin_path.exists() {
        return HookVerificationResult::NeedsReinstall;
    }
    // 2. 检查 opencode.json 包含 agentbro 注册
    let config_path = dirs::home_dir()
        .unwrap_or_default()
        .join(".config/opencode/opencode.json");
    let config_content = match std::fs::read_to_string(&config_path) {
        Ok(c) => c,
        Err(_) => return HookVerificationResult::NeedsReinstall,
    };
    let config: serde_json::Value = match serde_json::from_str(&config_content) {
        Ok(v) => v,
        Err(_) => return HookVerificationResult::SettingsCorrupted,
    };
    let plugins = config.get("plugin")
        .and_then(|p| p.as_array())
        .map(|arr| arr.iter().any(|v| v.as_str().map(|s| s == "agentbro").unwrap_or(false)))
        .unwrap_or(false);
    if !plugins {
        return HookVerificationResult::NeedsReinstall;
    }
    HookVerificationResult::Ok
}
```

#### P2-2：启动自动安装

参考 Claude Code 适配器的 `update_hook_script_if_needed()`，在应用启动时自动检测并安装 OpenCode hooks，包括：

1. 自动生成/刷新 `~/.config/opencode/plugins/agentbro.js`
2. 自动注册到 `~/.config/opencode/opencode.json` 的 `plugin` 数组中

---

### 4.5 子代理跟踪完整机制

```
┌──────────────────────────────────────────────────────┐
│ JS 插件模板（mapEvent 函数内）                          │
│                                                      │
│ const sessionParentMap = new Map();                   │
│                                                      │
│ session.created:                                     │
│   if (info.parentID) {                               │
│     sessionParentMap.set(info.id, info.parentID);    │
│   }                                                  │
│                                                      │
│ session.next.agent.switched:                         │
│   if (sessionParentMap.has(sessionID)) {             │
│     emit SubagentStart { agent }                     │
│   }                                                  │
│                                                      │
│ session.status (idle):                               │
│   if (sessionParentMap.has(sessionID)) {             │
│     emit SubagentStop;                               │
│     sessionParentMap.delete(sessionID);              │
│   }                                                  │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│ opencode.rs (parse_event)                             │
│                                                      │
│ "SubagentStart" => AgentEvent::SubagentStart {       │
│   session_id, agent_id, name, description            │
│ }                                                    │
│                                                      │
│ "SubagentStop" => AgentEvent::SubagentStop {         │
│   session_id, agent_id, status: "completed"          │
│ }                                                    │
└──────────────────────────────────────────────────────┘
```

---

## 5. 实施计划

### 5.1 涉及文件与改动量

| 文件 | 改动类型 | P0 行数 | P1 行数 | P2 行数 | 合计 |
|------|---------|:---:|:---:|:---:|:---:|
| `src-tauri/src/agents/opencode.rs` | 重写 `parse_event` + 新增辅助函数 | +80 | +100 | +30 | **+210** |
| `src-tauri/src/agents/profiles.rs` | 扩展 JS 模板映射 + `OPENCODE_EVENTS` | +5 | +90 | +20 | **+115** |

### 5.2 实施顺序

```
阶段 1 (P0): opencode.rs 修复 — 1 个 PR
   ├─ P0-1: UserPromptSubmit 解析
   ├─ P0-2: Stop → AssistantResponseComplete
   ├─ P0-3: extract_tool_target() 实现
   └─ P0-4: PostToolUse error 区分

阶段 2 (P1): JS 模板 + 适配器扩展 — 1 个 PR
   ├─ P1-1 ~ P1-14: JS 模板新增事件映射
   ├─ OPENCODE_EVENTS 扩展
   └─ opencode.rs parse_event 新增分支

阶段 3 (P2): 深度集成 — 1 个 PR
   ├─ P2-1: verify_hooks()
   └─ P2-2: 启动自动安装
```

> P0 和 P1 可合为一个 PR 以简化 review；P2 独立 PR。

---

## 6. 改后对比

| 指标 | 修复前 | 修复后 | 增量 |
|------|:---:|:---:|------|
| 事件类型 | 7 种 | 17+ 种 | +10 种以上 |
| `tool_target` 提取 | ❌ | ✅ 6 类工具 | 覆盖所有常见工具 |
| 子代理可见性 | ❌ | ✅ | 完整追踪 |
| Token 用量统计 | ❌ | ✅ | input/output/cache/cost |
| Shell 生命周期 | ❌ | ✅ | start → end 完整链路 |
| AI 思考内容 | ❌ | ✅ | 截取前 200 字符 |
| 错误通知 | ❌ | ✅ | session 错误 + step 失败 |
| 上下文压缩提示 | ❌ | ✅ | started/ended 双向通知 |
| PostToolUse error 区分 | ❌ | ✅ | status 正确反映工具状态 |
| Hook 完整性验证 | ❌ | ✅ | verify_hooks() |
| 启动自动安装 | ❌ | ✅ | app 启动即装 |
| 适配器代码行数 | ~238 | ~450 | +~210 |

---

## 7. 验证方式

### 7.1 编译验证

```bash
# Rust 类型检查
cargo check --manifest-path src-tauri/Cargo.toml

# 完整构建
cargo build --manifest-path src-tauri/Cargo.toml

# 运行测试
cargo test --manifest-path src-tauri/Cargo.toml -- opencode

# Clippy 静态分析
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

### 7.2 功能验证 checklist

#### P0 验证

- [ ] OpenCode 会话中输入 "帮我写一个测试"，Dynamic Island 显示 UserPromptSubmit 预览
- [ ] OpenCode 完成 AI 响应后进入 idle，Dynamic Island 显示 AssistantResponseComplete 及消息摘要
- [ ] 调用 Read/Edit/Write/Bash/Glob/Grep/Task 等工具时，tool_target 正确显示文件路径或命令
- [ ] 工具执行失败时，Dynamic Island 显示 status="error"

#### P1 验证

- [ ] OpenCode 遇到 API 错误时，Dynamic Island 显示 Error 事件
- [ ] 上下文压缩时显示 "Compacting context..." 通知
- [ ] 使用 task 子代理时，Dynamic Island 显示 SubagentStart / SubagentStop
- [ ] 每次 step 结束时显示 token 用量通知
- [ ] 命令行执行时显示 ShellExecutionStart / ShellExecutionEnd
- [ ] AI 思考内容在 Dynamic Island 中展示

#### P2 验证

- [ ] 首次启动时自动创建 `~/.config/opencode/plugins/agentbro.js`
- [ ] `opencode.json` 中自动注册 agentbro 插件
- [ ] AgentBro 设置页面的 OpenCode 状态显示为 "Available"

---

## 8. 附录

### 8.1 工具名速查表（OpenCode vs Claude Code）

| Claude Code | OpenCode | target 字段 |
|-------------|---------|------------|
| `Read` | `Read` | `file_path` |
| `Edit` | `Edit` | `file_path` |
| `Write` | `Write` | `file_path` |
| `Bash` | `Bash` | `command` |
| `Glob` | `Glob` | `pattern` |
| `Grep` | `Grep` | `pattern` |
| `TaskCreate` | `Task` | `description` |
| `Task` | `task`（别名） | `description` / `subagent_name` |
| `WebSearch` | `WebSearch` | `query` |
| — | `WebFetch` | `query` |
| — | `delegate` | `prompt` |

### 8.2 V2 事件与 hook_event_name 完整映射表

| V2 事件 `type` | 触发时机 | `hook_event_name` | AgentEvent 变体 | 优先级 |
|---------------|---------|------------------|----------------|:---:|
| `session.created` | 会话创建 | `SessionStart` | `SessionStart` | 已实现 |
| `session.deleted` | 会话删除 | `SessionEnd` | `SessionEnd` | 已实现 |
| `session.updated` | 归档检测 | `SessionEnd` | `SessionEnd` | 已实现 |
| `session.status` (idle) | AI 完成响应 | `Stop` | `AssistantResponseComplete` | P0 |
| `message.part.updated` (user text) | 用户输入 | `UserPromptSubmit` | `Processing` | P0 |
| `message.part.updated` (tool running) | 工具开始执行 | `PreToolUse` | `ToolUse { running }` | 已实现 |
| `message.part.updated` (tool completed) | 工具成功 | `PostToolUse` | `ToolUse { success }` | P0（补 tool_target + tool_state） |
| `message.part.updated` (tool error) | 工具失败 | `PostToolUse` | `ToolUse { error }` | P0 |
| `permission.asked` | 权限请求 | `PermissionRequest` | `PermissionRequest` | 已实现 |
| `question.asked` | 问题询问 | `PermissionRequest` | `PermissionRequest` | 已实现 |
| `session.error` | 会话错误 | `Error` | `Error` | P1 |
| `session.compacted` | 压缩完成 | `Notification` | `Notification` | P1 |
| `session.next.agent.switched` | 子代理切换 | `SubagentStart` | `SubagentStart` | P1 |
| `session.status` (idle, 子代理) | 子代理完成 | `SubagentStop` | `SubagentStop` | P1 |
| `session.next.step.ended` | 步骤结束 | `StepEnded` | `TokenUsage` + `Notification` | P1 |
| `session.next.step.failed` | 步骤失败 | `Error` | `Error` | P1 |
| `session.next.shell.started` | Shell 开始 | `ShellExecutionStart` | `ShellExecutionStart` | P1 |
| `session.next.shell.ended` | Shell 结束 | `ShellExecutionEnd` | `ShellExecutionEnd` | P1 |
| `session.next.compaction.started` | 压缩开始 | `Notification` | `Notification` | P1 |
| `session.next.compaction.ended` | 压缩结束 | `Notification` | `Notification` | P1 |
| `session.next.tool.failed` | 工具失败 | `PostToolUseFailure` | `ToolUse { error }` | P1 |
| `session.next.reasoning.ended` | 推理结束 | `AgentThought` | `AgentThought` | P1 |
| `session.next.retried` | 重试 | `Notification` | `Notification` | P1 |
| `todo.updated` | 待办更新 | `Notification` | `Notification` | P1 |

### 8.3 关键文件路径

```
AgentBro:
  src-tauri/src/agents/opencode.rs        ← 适配器主逻辑
  src-tauri/src/agents/profiles.rs         ← JS 模板 + 事件注册
  src-tauri/src/agents/mod.rs              ← AgentEvent 枚举定义
  src-tauri/src/agents/claude_code.rs      ← 参考实现

OpenCode 用户配置:
  ~/.config/opencode/plugins/agentbro.js   ← 安装后的插件文件
  ~/.config/opencode/opencode.json         ← 插件注册配置
```
