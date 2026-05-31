import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { open as openShell } from '@tauri-apps/plugin-shell'
import { ask as askDialog } from '@tauri-apps/plugin-dialog'
import { GlassButton, GlassCard, GlassInput } from '../../shared'
import { usePetStore } from '../../../stores/petStore'
import { useConfigStore } from '../../../stores/configStore'
import {
  findInstalledMarketPet,
  isMarketPetInstalled,
  useMarketStore,
  type MarketJob,
  type MarketPet,
} from '../../../stores/marketStore'
import { isTauri, setIslandSurfaceOptions } from '../../../services/tauriApi'
import './MarketSection.css'

type SortMode = 'popular' | 'latest'

const NODEJS_URL = 'https://nodejs.org/'
const SITE_URL = 'https://www.agentbro.net/pets'
const UPLOAD_PET_URL = SITE_URL

function openExternal(url: string) {
  if (isTauri()) {
    openShell(url).catch((err) => console.warn('[market] openShell failed:', err))
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

function PetThumbnail({ pet }: { pet: MarketPet }) {
  const frameW = pet.width > 0 ? pet.width / 8 : 192
  const frameH = pet.height > 0 ? pet.height / 9 : 208
  const target = 72
  const scale = target / frameH
  return (
    <div
      className="market-card__thumb"
      style={{
        width: `${frameW * scale}px`,
        height: `${frameH * scale}px`,
        backgroundImage: `url(${pet.spritesheetUrl})`,
        backgroundSize: `${pet.width * scale}px ${pet.height * scale}px`,
        backgroundPosition: '0 0',
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
      }}
      role="img"
      aria-label={pet.displayName}
    />
  )
}

interface PetCardProps {
  pet: MarketPet
  installed: boolean
  busy: boolean
  job: MarketJob | null
  onInstall: (pet: MarketPet) => void
  onUninstall: (pet: MarketPet) => void
  onUse: (pet: MarketPet) => void
  onOpenSite: (pet: MarketPet) => void
  t: ReturnType<typeof useTranslation>['t']
}

function PetCard({ pet, installed, busy, job, onInstall, onUninstall, onUse, onOpenSite, t }: PetCardProps) {
  const operationLabel = job?.kind === 'uninstall'
    ? t('settings.market.jobUninstallTitle', { name: pet.displayName })
    : t('settings.market.jobInstallTitle', { name: pet.displayName })
  const statusLabel = job?.status === 'success'
    ? t('settings.market.jobSuccess')
    : job?.status === 'failed'
    ? t('settings.market.jobFailed')
    : t('settings.market.jobRunning')

  return (
    <GlassCard className="market-card" hoverable={false}>
      <div className="market-card__top">
        <PetThumbnail pet={pet} />
        <div className="market-card__meta">
          <div className="market-card__title-row">
            <h3 className="market-card__name">{pet.displayName}</h3>
            {installed && <span className="market-card__installed-pill">{t('settings.market.installed')}</span>}
          </div>
          <div className="market-card__author">
            {t('settings.market.byAuthor', { name: pet.authorDisplayName || pet.authorHandle })}
          </div>
          <div className="market-card__stats">
            <span>{t('settings.market.downloads', { count: pet.downloadCount })}</span>
            {pet.kind && pet.kind !== 'other' && <span className="market-card__kind">{pet.kind}</span>}
          </div>
        </div>
      </div>
      {pet.description && <p className="market-card__desc">{pet.description}</p>}
      {pet.tags.length > 0 && (
        <div className="market-card__tags">
          {pet.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="market-card__tag">#{tag}</span>
          ))}
        </div>
      )}
      <div className="market-card__actions">
        {installed ? (
          <>
            <GlassButton
              variant="primary"
              disabled={busy}
              onClick={() => onUse(pet)}
            >
              {t('settings.market.useThis')}
            </GlassButton>
            <GlassButton
              variant="danger"
              disabled={busy}
              onClick={() => onUninstall(pet)}
            >
              {busy ? t('settings.market.uninstalling') : t('settings.market.uninstall')}
            </GlassButton>
          </>
        ) : (
          <GlassButton
            variant="primary"
            disabled={busy}
            onClick={() => onInstall(pet)}
          >
            {busy ? t('settings.market.installing') : t('settings.market.install')}
          </GlassButton>
        )}
        <GlassButton variant="ghost" onClick={() => onOpenSite(pet)}>
          {t('settings.market.viewOnSite')}
        </GlassButton>
      </div>
      {job && (
        <div
          className={`market-card__job market-card__job--${job.status}`}
          role="status"
          aria-live="polite"
        >
          <div className="market-card__job-row">
            <span className="market-card__job-label">{operationLabel}</span>
            <span className="market-card__job-status">{statusLabel}</span>
          </div>
          <div className="market-card__progress" aria-hidden="true">
            <span className="market-card__progress-bar" />
          </div>
          {job.status === 'failed' && job.error && (
            <div className="market-card__job-error">{job.error}</div>
          )}
        </div>
      )}
    </GlassCard>
  )
}

export function MarketSection() {
  const { t } = useTranslation()
  const tx = useTranslation()
  const {
    manifest,
    manifestLoading,
    manifestError,
    abpetsStatus,
    jobs,
    loadManifest,
    refreshAbpetsStatus,
    startInstall,
    startUninstall,
    startInstallAbpets,
  } = useMarketStore()
  const registry = usePetStore((s) => s.registry)
  const surfaceMode = useConfigStore((s) => s.islandSurfaceMode)
  const islandPetScale = useConfigStore((s) => s.islandPetScale)
  const updateConfig = useConfigStore((s) => s.updateConfig)
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('popular')

  const handleRefresh = () => {
    void loadManifest(true)
    void usePetStore.getState().loadRegistry()
  }

  const handleUse = async (pet: MarketPet) => {
    const targetId = findInstalledMarketPet(pet, registry)?.id ?? `agentbro:${pet.slug}`
    if (surfaceMode !== 'pet') {
      let confirmed = false
      if (isTauri()) {
        try {
          confirmed = await askDialog(t('settings.market.switchPrompt'), {
            title: t('settings.market.title'),
            kind: 'info',
            okLabel: t('settings.market.useThis'),
            cancelLabel: t('settings.market.closeBtn'),
          })
        } catch (err) {
          console.warn('[market] askDialog failed, falling back to confirm:', err)
          confirmed = window.confirm(t('settings.market.switchPrompt'))
        }
      } else {
        confirmed = window.confirm(t('settings.market.switchPrompt'))
      }
      if (!confirmed) return
      updateConfig('islandSurfaceMode', 'pet')
      try {
        await setIslandSurfaceOptions({ islandSurfaceMode: 'pet', islandPetScale })
      } catch (err) {
        console.error('[market] failed to persist surface mode:', err)
      }
    }
    void usePetStore.getState().setActivePet(targetId)
  }

  useEffect(() => {
    loadManifest()
    refreshAbpetsStatus()
    void usePetStore.getState().loadRegistry()
  }, [loadManifest, refreshAbpetsStatus])

  const petJobs = useMemo(() => {
    const latest = new Map<string, MarketJob>()
    for (const job of Object.values(jobs)) {
      if (!job.pet) continue
      const existing = latest.get(job.pet.slug)
      if (!existing || job.startedAt > existing.startedAt) {
        latest.set(job.pet.slug, job)
      }
    }
    return latest
  }, [jobs])

  const busySlugs = useMemo(() => {
    const set = new Set<string>()
    for (const [slug, job] of petJobs) {
      if (job.status === 'running') set.add(slug)
    }
    return set
  }, [petJobs])

  const filtered = useMemo(() => {
    const lowered = query.trim().toLowerCase()
    let list = manifest
    if (lowered) {
      list = list.filter((p) => {
        const haystack = [
          p.displayName,
          p.authorHandle,
          p.authorDisplayName,
          p.description ?? '',
          p.kind,
          ...p.tags,
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(lowered)
      })
    }
    const sorted = [...list]
    sorted.sort((a, b) => {
      const aInstalled = isMarketPetInstalled(a, registry)
      const bInstalled = isMarketPetInstalled(b, registry)
      if (aInstalled !== bInstalled) return aInstalled ? -1 : 1
      if (sortMode === 'popular') return b.downloadCount - a.downloadCount
      return (b.updatedAt || '').localeCompare(a.updatedAt || '')
    })
    return sorted
  }, [manifest, query, registry, sortMode])

  const nodeMissing = abpetsStatus !== null && !abpetsStatus.nodeAvailable
  const abpetsMissing = abpetsStatus !== null && abpetsStatus.nodeAvailable && !abpetsStatus.abpetsCallable
  const installingAbpets = Object.values(jobs).some(
    (j) => j.kind === 'install-abpets' && j.status === 'running',
  )

  return (
    <section className="market-section">
      <header className="market-section__header">
        <div>
          <h2 className="market-section__title">{t('settings.market.title')}</h2>
          <p className="market-section__desc">{t('settings.market.desc')}</p>
        </div>
        <div className="market-section__header-actions">
          <GlassButton variant="primary" onClick={() => openExternal(UPLOAD_PET_URL)}>
            {t('settings.market.uploadPet')}
          </GlassButton>
          <GlassButton variant="ghost" onClick={handleRefresh} disabled={manifestLoading}>
            {t('settings.market.refresh')}
          </GlassButton>
        </div>
      </header>

      {nodeMissing && (
        <div className="market-banner market-banner--warn">
          <div className="market-banner__body">
            <strong>{t('settings.market.nodeRequired')}</strong>
            <span>{t('settings.market.nodeRequiredDesc')}</span>
          </div>
          <GlassButton variant="primary" onClick={() => openExternal(NODEJS_URL)}>
            {t('settings.market.installNodeBtn')}
          </GlassButton>
        </div>
      )}
      {abpetsMissing && (
        <div className="market-banner market-banner--info">
          <div className="market-banner__body">
            <strong>{t('settings.market.abpetsRecommended')}</strong>
            <span>{t('settings.market.abpetsRecommendedDesc')}</span>
          </div>
          <GlassButton
            variant="primary"
            disabled={installingAbpets}
            onClick={() => startInstallAbpets()}
          >
            {t('settings.market.installAbpetsBtn')}
          </GlassButton>
        </div>
      )}

      <div className="market-section__toolbar">
        <GlassInput
          placeholder={t('settings.market.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="market-section__sort"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
        >
          <option value="popular">{t('settings.market.sortByPopular')}</option>
          <option value="latest">{t('settings.market.sortByLatest')}</option>
        </select>
      </div>

      {manifestLoading && manifest.length === 0 && (
        <div className="market-section__state">{t('settings.market.loading')}</div>
      )}
      {manifestError && (
        <div className="market-section__state market-section__state--error">
          {t('settings.market.loadFailed', { message: manifestError })}
          <GlassButton variant="secondary" onClick={handleRefresh}>
            {t('settings.market.retry')}
          </GlassButton>
        </div>
      )}
      {!manifestLoading && !manifestError && filtered.length === 0 && (
        <div className="market-section__state">{t('settings.market.empty')}</div>
      )}

      {filtered.length > 0 && (
        <div className="market-section__grid">
          {filtered.map((pet) => (
            <PetCard
              key={pet.fullSlug}
              pet={pet}
              installed={isMarketPetInstalled(pet, registry)}
              busy={busySlugs.has(pet.slug)}
              job={petJobs.get(pet.slug) ?? null}
              onInstall={(p) => startInstall(p)}
              onUninstall={(p) => startUninstall(p)}
              onUse={handleUse}
              onOpenSite={(p) =>
                openExternal(`${SITE_URL}/${encodeURIComponent(p.authorHandle)}/${encodeURIComponent(p.slug)}`)
              }
              t={tx.t}
            />
          ))}
        </div>
      )}
    </section>
  )
}
