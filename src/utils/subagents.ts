import type { SessionState, SubagentInfo } from '../types/agent'
import { timestampToMs } from './sessionDisplay'

const FOLLOW_UP_HIDE_TOLERANCE_MS = 1000

function latestUserMessageAt(session: SessionState): number | undefined {
  const explicit = timestampToMs(session.lastUserMessageAt)
  const chatTimestamp = [...session.chatHistory]
    .reverse()
    .find((message) => message.role === 'user')?.timestamp
  const chat = timestampToMs(chatTimestamp)

  if (explicit == null) return chat
  if (chat == null) return explicit
  return Math.max(explicit, chat)
}

function subagentActivityAt(subagent: SubagentInfo): number | undefined {
  return timestampToMs(subagent.completedAt ?? subagent.startedAt)
    ?? timestampToMs(subagent.startedAt)
}

export function getSessionListSubagents(session: SessionState): SubagentInfo[] {
  if (session.subagents.length === 0) return []

  // Codex multi-agent sessions accumulate subagents across turns, and their
  // latest "user message" is usually a synthetic <subagent_notification>, so the
  // user-message boundary is unreliable. Anchor the current turn on the oldest
  // still-running subagent (the active spawn wave) instead.
  if (session.agentType === 'codex') {
    return getCodexListSubagents(session)
  }

  const userMessageAt = latestUserMessageAt(session)
  if (userMessageAt == null) return session.subagents

  return session.subagents.filter((subagent) => {
    if (subagent.status === 'running') return true

    const activityAt = subagentActivityAt(subagent)
    return activityAt == null || activityAt + FOLLOW_UP_HIDE_TOLERANCE_MS >= userMessageAt
  })
}

function getCodexListSubagents(session: SessionState): SubagentInfo[] {
  const runningStarts = session.subagents
    .filter((subagent) => subagent.status === 'running')
    .map((subagent) => timestampToMs(subagent.startedAt))
    .filter((value): value is number => value != null)

  // No active wave to anchor on — fall back to the user-message boundary.
  if (runningStarts.length === 0) {
    const userMessageAt = latestUserMessageAt(session)
    if (userMessageAt == null) return session.subagents
    return session.subagents.filter((subagent) => {
      const activityAt = subagentActivityAt(subagent)
      return activityAt == null || activityAt + FOLLOW_UP_HIDE_TOLERANCE_MS >= userMessageAt
    })
  }

  const waveStart = Math.min(...runningStarts)
  return session.subagents.filter((subagent) => {
    if (subagent.status === 'running') return true

    const startedAt = timestampToMs(subagent.startedAt)
    return startedAt == null || startedAt + FOLLOW_UP_HIDE_TOLERANCE_MS >= waveStart
  })
}
