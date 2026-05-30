import { create } from 'zustand'
import {
  checkAbpetsAvailable,
  fetchMarketManifest,
  installAbpetsGlobally,
  installPetFromMarket,
  isTauri,
  pingMarketDownload,
  uninstallPetFromMarket,
  type AbpetsStatus,
} from '../services/tauriApi'
import { usePetStore } from './petStore'

const MARKET_API_BASE =
  (import.meta.env.VITE_AGENTBRO_API_BASE as string | undefined)?.replace(/\/$/, '') ||
  'https://api.agentbro.net'
const MANIFEST_TTL_MS = 5 * 60 * 1000
const MAX_LOG_LINES = 500

export interface MarketPet {
  slug: string
  fullSlug: string
  displayName: string
  description: string | null
  kind: string
  tags: string[]
  spritesheetUrl: string
  petJsonUrl: string
  zipUrl: string
  width: number
  height: number
  format: 'webp' | 'png'
  status: string
  downloadCount: number
  priceCents: number
  currency: string
  version: number
  createdAt: string
  updatedAt: string
  authorHandle: string
  authorDisplayName: string
  authorAvatarUrl: string | null
}

interface RawManifestPet {
  slug?: string
  fullSlug?: string
  displayName?: string
  description?: string | null
  kind?: string
  tags?: string[]
  spritesheetUrl?: string
  petJsonUrl?: string
  zipUrl?: string
  width?: number
  height?: number
  format?: string
  status?: string
  downloadCount?: number
  priceCents?: number
  currency?: string
  version?: number
  createdAt?: string
  updatedAt?: string
  authorHandle?: string
  authorDisplayName?: string
  authorAvatarUrl?: string | null
}

interface RawManifest {
  generatedAt?: string
  total?: number
  pets?: RawManifestPet[]
}

export type MarketJobKind = 'install' | 'uninstall' | 'install-abpets'
export type MarketJobStatus = 'running' | 'success' | 'failed'

export interface MarketLogLine {
  stream: 'stdout' | 'stderr'
  line: string
  ts: number
}

export interface MarketJob {
  id: string
  kind: MarketJobKind
  pet: MarketPet | null
  status: MarketJobStatus
  logs: MarketLogLine[]
  exitCode: number | null
  error: string | null
  startedAt: number
  endedAt: number | null
}

interface MarketStore {
  manifest: MarketPet[]
  manifestLoadedAt: number | null
  manifestLoading: boolean
  manifestError: string | null
  abpetsStatus: AbpetsStatus | null
  abpetsChecking: boolean
  jobs: Record<string, MarketJob>
  activeJobId: string | null

  loadManifest(force?: boolean): Promise<void>
  refreshAbpetsStatus(force?: boolean): Promise<void>
  startInstall(pet: MarketPet): Promise<string>
  startUninstall(pet: MarketPet): Promise<string>
  startInstallAbpets(): Promise<string>
  appendLog(jobId: string, stream: 'stdout' | 'stderr', line: string): void
  markDone(
    jobId: string,
    success: boolean,
    exitCode: number | null,
    error: string | null,
  ): void
  openJob(jobId: string): void
  closeActiveJob(): void
}

function normalizePet(raw: RawManifestPet): MarketPet | null {
  if (!raw.slug || !raw.fullSlug || !raw.displayName || !raw.spritesheetUrl) return null
  return {
    slug: raw.slug,
    fullSlug: raw.fullSlug,
    displayName: raw.displayName,
    description: raw.description ?? null,
    kind: raw.kind || 'other',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    spritesheetUrl: raw.spritesheetUrl,
    petJsonUrl: raw.petJsonUrl || '',
    zipUrl: raw.zipUrl || '',
    width: raw.width || 0,
    height: raw.height || 0,
    format: raw.format === 'png' ? 'png' : 'webp',
    status: raw.status || 'approved',
    downloadCount: raw.downloadCount ?? 0,
    priceCents: raw.priceCents ?? 0,
    currency: raw.currency || 'USD',
    version: raw.version ?? 1,
    createdAt: raw.createdAt || '',
    updatedAt: raw.updatedAt || '',
    authorHandle: raw.authorHandle || raw.fullSlug.split('/')[0] || '',
    authorDisplayName: raw.authorDisplayName || raw.authorHandle || '',
    authorAvatarUrl: raw.authorAvatarUrl ?? null,
  }
}

function generateJobId(): string {
  return `mkt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function clampLogs(logs: MarketLogLine[]): MarketLogLine[] {
  if (logs.length <= MAX_LOG_LINES) return logs
  return logs.slice(logs.length - MAX_LOG_LINES)
}

function fireAndForgetDownloadPing(handle: string, slug: string): void {
  if (isTauri()) {
    pingMarketDownload(handle, slug, MARKET_API_BASE).catch((err) => {
      console.warn('[marketStore] download ping failed:', err)
    })
    return
  }
  const url = `${MARKET_API_BASE}/api/pets/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}/download`
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'client' }),
  }).catch((err) => {
    console.warn('[marketStore] download ping failed:', err)
  })
}

export const useMarketStore = create<MarketStore>((set, get) => ({
  manifest: [],
  manifestLoadedAt: null,
  manifestLoading: false,
  manifestError: null,
  abpetsStatus: null,
  abpetsChecking: false,
  jobs: {},
  activeJobId: null,

  loadManifest: async (force = false) => {
    const state = get()
    if (state.manifestLoading) return
    if (
      !force &&
      state.manifestLoadedAt &&
      Date.now() - state.manifestLoadedAt < MANIFEST_TTL_MS &&
      state.manifest.length > 0
    ) {
      return
    }
    set({ manifestLoading: true, manifestError: null })
    try {
      let raw: RawManifest
      if (isTauri()) {
        const text = await fetchMarketManifest(MARKET_API_BASE)
        if (text === null) throw new Error('manifest fetch returned null')
        raw = JSON.parse(text) as RawManifest
      } else {
        const res = await fetch(`${MARKET_API_BASE}/api/manifest`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) {
          throw new Error(`manifest request failed: ${res.status} ${res.statusText}`)
        }
        raw = (await res.json()) as RawManifest
      }
      const pets = Array.isArray(raw.pets)
        ? raw.pets
            .map(normalizePet)
            .filter((p): p is MarketPet => p !== null && p.status === 'approved')
        : []
      set({
        manifest: pets,
        manifestLoadedAt: Date.now(),
        manifestLoading: false,
        manifestError: null,
      })
    } catch (err) {
      set({
        manifestLoading: false,
        manifestError: err instanceof Error ? err.message : String(err),
      })
    }
  },

  refreshAbpetsStatus: async (force = false) => {
    if (get().abpetsChecking) return
    set({ abpetsChecking: true })
    try {
      const status = await checkAbpetsAvailable(force)
      set({ abpetsStatus: status, abpetsChecking: false })
    } catch (err) {
      console.warn('[marketStore] checkAbpetsAvailable failed:', err)
      set({ abpetsChecking: false })
    }
  },

  startInstall: async (pet) => {
    const jobId = generateJobId()
    const job: MarketJob = {
      id: jobId,
      kind: 'install',
      pet,
      status: 'running',
      logs: [],
      exitCode: null,
      error: null,
      startedAt: Date.now(),
      endedAt: null,
    }
    set((s) => ({ jobs: { ...s.jobs, [jobId]: job }, activeJobId: jobId }))
    installPetFromMarket(jobId, pet.authorHandle, pet.slug).catch((err) => {
      get().markDone(
        jobId,
        false,
        null,
        err instanceof Error ? err.message : String(err),
      )
    })
    return jobId
  },

  startUninstall: async (pet) => {
    const jobId = generateJobId()
    const job: MarketJob = {
      id: jobId,
      kind: 'uninstall',
      pet,
      status: 'running',
      logs: [],
      exitCode: null,
      error: null,
      startedAt: Date.now(),
      endedAt: null,
    }
    set((s) => ({ jobs: { ...s.jobs, [jobId]: job }, activeJobId: jobId }))
    uninstallPetFromMarket(jobId, pet.slug).catch((err) => {
      get().markDone(
        jobId,
        false,
        null,
        err instanceof Error ? err.message : String(err),
      )
    })
    return jobId
  },

  startInstallAbpets: async () => {
    const jobId = generateJobId()
    const job: MarketJob = {
      id: jobId,
      kind: 'install-abpets',
      pet: null,
      status: 'running',
      logs: [],
      exitCode: null,
      error: null,
      startedAt: Date.now(),
      endedAt: null,
    }
    set((s) => ({ jobs: { ...s.jobs, [jobId]: job }, activeJobId: jobId }))
    installAbpetsGlobally(jobId).catch((err) => {
      get().markDone(
        jobId,
        false,
        null,
        err instanceof Error ? err.message : String(err),
      )
    })
    return jobId
  },

  appendLog: (jobId, stream, line) => {
    set((s) => {
      const job = s.jobs[jobId]
      if (!job) return s
      const updated: MarketJob = {
        ...job,
        logs: clampLogs([...job.logs, { stream, line, ts: Date.now() }]),
      }
      return { jobs: { ...s.jobs, [jobId]: updated } }
    })
  },

  markDone: (jobId, success, exitCode, error) => {
    const job = get().jobs[jobId]
    if (!job) return
    const updated: MarketJob = {
      ...job,
      status: success ? 'success' : 'failed',
      exitCode,
      error,
      endedAt: Date.now(),
    }
    set((s) => ({ jobs: { ...s.jobs, [jobId]: updated } }))

    if (success && job.kind === 'install' && job.pet) {
      fireAndForgetDownloadPing(job.pet.authorHandle, job.pet.slug)
    }
    if (success && (job.kind === 'install' || job.kind === 'uninstall')) {
      usePetStore.getState().loadRegistry()
    }
    if (success && job.kind === 'install-abpets') {
      get().refreshAbpetsStatus(true)
    }
  },

  openJob: (jobId) => {
    if (get().jobs[jobId]) set({ activeJobId: jobId })
  },

  closeActiveJob: () => set({ activeJobId: null }),
}))

// ── Selector: derive installed state from petStore ───────────────────────────

export function isMarketPetInstalled(slug: string, registryIds: string[]): boolean {
  const target = `agentbro:${slug}`
  return registryIds.includes(target)
}
