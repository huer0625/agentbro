import { describe, expect, it } from 'vitest'
import { selectActivePet } from '../stores/petStore'
import type { PetOption } from '../types/pet'
import type { AgentType, SessionState } from '../types/agent'

const ANIMS = { idle: { row: 0, frames: 1, fps: 1 } }
const STATE_MAP = { idle: 'idle' }

function makePet(id: string, agentTypes?: string[]): PetOption {
  return {
    id,
    displayName: id,
    provider: id.startsWith('codex:') ? 'codex' : 'user',
    builtin: id.startsWith('codex:'),
    spritesheetDataUrl: 'data:image/webp;base64,AAAA',
    frameSize: { width: 192, height: 208 },
    animations: ANIMS,
    stateMapping: STATE_MAP,
    agentTypes,
  }
}

function makeSession(agentType: AgentType, phase: SessionState['phase'] = 'processing'): SessionState {
  return {
    id: `s-${agentType}`,
    agentType,
    phase,
    project: '',
    terminal: '',
    startedAt: Date.now(),
    duration: 0,
    tokens: { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 },
    description: '',
    chatHistory: [],
    subagents: [],
    activeTools: [],
  }
}

describe('selectActivePet', () => {
  const dewey = makePet('codex:dewey', ['claude-code'])
  const codexPet = makePet('codex:codex', ['codex'])
  const fireball = makePet('codex:fireball', ['cursor'])
  const registry = [dewey, codexPet, fireball]

  it('returns null when registry is empty', () => {
    expect(selectActivePet([], null, [])).toBeNull()
    expect(selectActivePet([], 'codex:dewey', [])).toBeNull()
  })

  it('returns the locked pet when activePetId matches a registered pet', () => {
    expect(selectActivePet(registry, 'codex:fireball', [])?.id).toBe('codex:fireball')
  })

  it('falls through to auto when activePetId is unknown (e.g. uninstalled pet)', () => {
    const result = selectActivePet(registry, 'codex:ghost', [makeSession('claude-code')])
    expect(result?.id).toBe('codex:dewey')
  })

  it('auto mode picks pet by active session agentType', () => {
    expect(selectActivePet(registry, null, [makeSession('claude-code')])?.id).toBe('codex:dewey')
    expect(selectActivePet(registry, null, [makeSession('codex')])?.id).toBe('codex:codex')
    expect(selectActivePet(registry, null, [makeSession('cursor')])?.id).toBe('codex:fireball')
  })

  it('auto mode prefers active sessions over idle/done sessions', () => {
    const sessions = [
      makeSession('codex', 'done'),
      makeSession('claude-code', 'processing'),
    ]
    expect(selectActivePet(registry, null, sessions)?.id).toBe('codex:dewey')
  })

  it('auto mode falls back to registry[0] when no agentType matches', () => {
    const noMatchRegistry = [makePet('user:xyz')]
    const result = selectActivePet(noMatchRegistry, null, [makeSession('claude-code')])
    expect(result?.id).toBe('user:xyz')
  })

  it('auto mode falls back to registry[0] when there are no sessions', () => {
    expect(selectActivePet(registry, null, [])?.id).toBe('codex:dewey')
  })
})
