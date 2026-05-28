// Webhook message templates for DingTalk and Feishu

/// Event type for notification
#[derive(Debug, Clone, PartialEq)]
pub enum NotificationEvent {
    SessionStart,
    SessionStop,
    ToolUse { tool_name: String },
    Completion { summary: String },
    Error { message: String },
    WaitingApproval { tool_name: String },
    WaitingInput { question: String },
    PlanApproval { title: String },
    Custom { title: String, body: String },
}

pub fn event_key(event: &NotificationEvent) -> &'static str {
    match event {
        NotificationEvent::SessionStart => "session_start",
        NotificationEvent::SessionStop => "session_stop",
        NotificationEvent::ToolUse { .. } => "tool_use",
        NotificationEvent::Completion { .. } => "task_complete",
        NotificationEvent::Error { .. } => "error",
        NotificationEvent::WaitingApproval { .. } => "waiting_approval",
        NotificationEvent::WaitingInput { .. } => "waiting_input",
        NotificationEvent::PlanApproval { .. } => "plan_approval",
        NotificationEvent::Custom { .. } => "custom",
    }
}

/// Build DingTalk markdown message body
pub fn dingtalk_markdown(
    event: &NotificationEvent,
    source: &str,
    session_id: &str,
) -> serde_json::Value {
    let (title, text) = event_to_text(event, source, session_id);
    serde_json::json!({
        "msgtype": "markdown",
        "markdown": {
            "title": title,
            "text": text
        }
    })
}

/// Build Feishu interactive card message body
pub fn feishu_interactive(
    event: &NotificationEvent,
    source: &str,
    session_id: &str,
) -> serde_json::Value {
    let (title, body) = event_to_text(event, source, session_id);
    serde_json::json!({
        "msg_type": "interactive",
        "card": {
            "config": { "wide_screen_mode": false },
            "header": {
                "title": { "tag": "plain_text", "content": title },
                "template": event_color(event)
            },
            "elements": [
                {
                    "tag": "div",
                    "text": { "tag": "lark_md", "content": body }
                }
            ]
        }
    })
}

fn event_color(event: &NotificationEvent) -> &'static str {
    match event {
        NotificationEvent::Error { .. } => "red",
        NotificationEvent::Completion { .. } => "green",
        NotificationEvent::SessionStart => "blue",
        NotificationEvent::SessionStop => "grey",
        NotificationEvent::WaitingApproval { .. }
        | NotificationEvent::WaitingInput { .. }
        | NotificationEvent::PlanApproval { .. } => "orange",
        _ => "turquoise",
    }
}

fn event_to_text(event: &NotificationEvent, source: &str, session_id: &str) -> (String, String) {
    let short_id = if session_id.len() > 8 {
        &session_id[..8]
    } else {
        session_id
    };

    match event {
        NotificationEvent::SessionStart => (
            format!("[{}] Session started", source),
            format!("**[{}]** Session `{}` started", source, short_id),
        ),
        NotificationEvent::SessionStop => (
            format!("[{}] Session ended", source),
            format!("**[{}]** Session `{}` ended", source, short_id),
        ),
        NotificationEvent::ToolUse { tool_name } => (
            format!("[{}] Tool: {}", source, tool_name),
            format!(
                "**[{}]** Using tool `{}` in session `{}`",
                source, tool_name, short_id
            ),
        ),
        NotificationEvent::Completion { summary } => (
            format!("[{}] Task complete", source),
            format!("**[{}]** Task completed\n\n> {}", source, summary),
        ),
        NotificationEvent::Error { message } => (
            format!("[{}] Error", source),
            format!(
                "**[{}]** Error in session `{}`\n\n> {}",
                source, short_id, message
            ),
        ),
        NotificationEvent::WaitingApproval { tool_name } => (
            format!("[{}] Needs approval", source),
            format!(
                "**[{}]** Needs approval in session `{}`\n\n> {}",
                source, short_id, tool_name
            ),
        ),
        NotificationEvent::WaitingInput { question } => (
            format!("[{}] Needs input", source),
            format!(
                "**[{}]** Needs input in session `{}`\n\n> {}",
                source, short_id, question
            ),
        ),
        NotificationEvent::PlanApproval { title } => (
            format!("[{}] Plan approval", source),
            format!(
                "**[{}]** Plan approval needed in session `{}`\n\n> {}",
                source, short_id, title
            ),
        ),
        NotificationEvent::Custom { title, body } => (title.clone(), body.clone()),
    }
}
