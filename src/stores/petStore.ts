import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PetOption, PetMetadata } from '../types/pet'
import type { AgentType, SessionState } from '../types/agent'
import { discoverPets, setActivePetId as setActivePetIdRemote } from '../services/tauriApi'
import { useConfigStore } from './configStore'

/**
 * Default agent → codex pet auto-mapping for `activePetId === null` (auto mode).
 * If a session's agentType is not in the map, falls back to the first available pet.
 */
const DEFAULT_AGENT_PET_MAP: Record<string, string> = {
  'codex': 'codex:codex',
  'claude-code': 'codex:dewey',
  'gemini-cli': 'codex:seedy',
  'cursor': 'codex:fireball',
  'qoder': 'codex:rocky',
  'cline': 'codex:stacky',
}

interface PetStore {
  registry: PetOption[]
  activePetId: string | null            // null = auto
  loading: boolean
  error: string | null
  warnings: string[]
  loadRegistry: () => Promise<void>
  setActivePet: (petId: string | null) => Promise<void>
  hydrateFromConfig: (configActivePetId: string | null) => void
}

function decoratePet(meta: PetMetadata): PetOption {
  const matched = Object.entries(DEFAULT_AGENT_PET_MAP)
    .filter(([, petId]) => petId === meta.id)
    .map(([agentType]) => agentType)
  return { ...meta, agentTypes: matched.length > 0 ? matched : undefined }
}

export const usePetStore = create<PetStore>()(
  persist(
    (set, get) => ({
      registry: [],
      activePetId: null,
      loading: false,
      error: null,
      warnings: [],

      loadRegistry: async () => {
        if (get().loading) return
        set({ loading: true, error: null, warnings: [] })
        try {
          const result = await discoverPets()
          set({
            registry: result.pets.map(decoratePet),
            loading: false,
            warnings: result.warnings,
          })
          if (result.warnings.length > 0) {
            console.warn('[petStore] discovery warnings:', result.warnings)
          }
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      },

      setActivePet: async (petId) => {
        const next = petId && petId.length > 0 ? petId : null
        if (get().activePetId === next) return
        set({ activePetId: next })
        useConfigStore.getState().updateConfig('islandActivePetId', next)
        try {
          await setActivePetIdRemote(next)
        } catch (err) {
          console.warn('[petStore] setActivePetId failed:', err)
        }
      },

      hydrateFromConfig: (configActivePetId) => {
        const normalized = configActivePetId ?? null
        if (get().activePetId === normalized) return
        set({ activePetId: normalized })
      },
    }),
    {
      name: 'agentbro-pet',
      version: 1,
      partialize: (state) => ({ activePetId: state.activePetId }),
    },
  ),
)

// ── Selectors ────────────────────────────────────────────────────────────────

/**
 * Resolve the pet that should currently render. Pure function — pass in the
 * registry, the user's selection, and the relevant session list.
 *
 * - When `activePetId` is set and present in the registry, returns it (locked mode).
 * - When `null` (auto mode), looks at the highest-priority active session's
 *   agentType and returns the matching pet from `DEFAULT_AGENT_PET_MAP`.
 * - Falls back to the first registered pet, or `null` if the registry is empty.
 */
export function selectActivePet(
  registry: PetOption[],
  activePetId: string | null,
  sessions: SessionState[],
): PetOption | null {
  if (registry.length === 0) return null

  if (activePetId) {
    const locked = registry.find((p) => p.id === activePetId)
    if (locked) return locked
  }

  const top = pickTopActiveSession(sessions)
  if (top) {
    const targetId = DEFAULT_AGENT_PET_MAP[top.agentType]
    if (targetId) {
      const auto = registry.find((p) => p.id === targetId)
      if (auto) return auto
    }
    const matchByAgent = registry.find((p) => p.agentTypes?.includes(top.agentType))
    if (matchByAgent) return matchByAgent
  }

  return registry[0] ?? null
}

function pickTopActiveSession(sessions: SessionState[]): SessionState | null {
  if (sessions.length === 0) return null
  const active = sessions.find((s) => s.phase !== 'done' && s.phase !== 'idle')
  return active ?? sessions[0]
}

export function getAgentPetMap(): Readonly<Record<string, string>> {
  return DEFAULT_AGENT_PET_MAP
}

// Backwards compat for tests / non-store callers.
export type { AgentType }
