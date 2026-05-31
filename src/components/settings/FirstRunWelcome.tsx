import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfigStore } from '../../stores/configStore'
import { setAnalyticsEnabled as setAnalyticsEnabledBackend, setIslandSurfaceOptions } from '../../services/tauriApi'
import { Toggle } from './Toggle'

type SurfaceMode = 'island' | 'pet'

const surfaceOptions: Array<{ value: SurfaceMode; labelKey: string; mark: string }> = [
  { value: 'island', labelKey: 'settings.surfaceIsland', mark: 'I' },
  { value: 'pet', labelKey: 'settings.surfacePet', mark: 'P' },
]

export function FirstRunWelcome() {
  const { t } = useTranslation()
  const initialSurfaceMode = useConfigStore((s) => s.islandSurfaceMode)
  const initialPetScale = useConfigStore((s) => s.islandPetScale)
  const initialAnalyticsEnabled = useConfigStore((s) => s.analyticsEnabled)
  const updateConfig = useConfigStore((s) => s.updateConfig)
  const [surfaceMode, setSurfaceMode] = useState<SurfaceMode>(initialSurfaceMode)
  const [analyticsEnabled, setAnalyticsEnabled] = useState(initialAnalyticsEnabled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const complete = async () => {
    if (saving) return
    const previous = useConfigStore.getState()
    setSaving(true)
    setError(null)
    updateConfig('islandSurfaceMode', surfaceMode)
    updateConfig('islandPetWindowOrigin', null)
    updateConfig('islandPetWindowAnchor', null)
    updateConfig('analyticsEnabled', analyticsEnabled)
    updateConfig('analyticsConsentPromptCompleted', true)

    try {
      await setIslandSurfaceOptions({
        islandSurfaceMode: surfaceMode,
        islandPetScale: initialPetScale,
      })
      await setAnalyticsEnabledBackend(analyticsEnabled)
    } catch (err) {
      updateConfig('islandSurfaceMode', previous.islandSurfaceMode)
      updateConfig('islandPetWindowOrigin', previous.islandPetWindowOrigin)
      updateConfig('islandPetWindowAnchor', previous.islandPetWindowAnchor)
      updateConfig('analyticsEnabled', previous.analyticsEnabled)
      updateConfig('analyticsConsentPromptCompleted', previous.analyticsConsentPromptCompleted)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="first-run-overlay">
      <section
        className="first-run-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-run-title"
      >
        <div className="first-run-dialog__brand">
          <img src="/agentbro-app-icon.png" alt="" />
          <span>AgentBro</span>
        </div>
        <div className="first-run-dialog__header">
          <div className="first-run-dialog__eyebrow">{t('settings.welcomeEyebrow')}</div>
          <h1 id="first-run-title">{t('settings.welcomeTitle')}</h1>
          <p>{t('settings.welcomeSubtitle')}</p>
        </div>

        <div className="first-run-dialog__section">
          <div>
            <h2>{t('settings.welcomeSurface')}</h2>
            <p>{t('settings.welcomeSurfaceDesc')}</p>
          </div>
          <div className="first-run-surface" role="radiogroup" aria-label={t('settings.welcomeSurface')}>
            {surfaceOptions.map((option) => (
              <button
                key={option.value}
                className={`first-run-surface__option${surfaceMode === option.value ? ' first-run-surface__option--active' : ''}`}
                type="button"
                role="radio"
                aria-checked={surfaceMode === option.value}
                onClick={() => setSurfaceMode(option.value)}
              >
                <span className="first-run-surface__mark" aria-hidden="true">{option.mark}</span>
                <span>{t(option.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="first-run-analytics">
          <div className="first-run-analytics__copy">
            <h2>{t('settings.welcomeAnalytics')}</h2>
            <p>{t('settings.welcomeAnalyticsDesc')}</p>
          </div>
          <Toggle checked={analyticsEnabled} onChange={setAnalyticsEnabled} />
        </div>

        {error && (
          <div className="first-run-dialog__error" role="alert">
            {t('settings.welcomeError', { message: error })}
          </div>
        )}

        <div className="first-run-dialog__footer">
          <button
            className="first-run-dialog__button"
            type="button"
            disabled={saving}
            onClick={complete}
          >
            {saving ? t('settings.welcomeSaving') : t('settings.welcomeContinue')}
          </button>
        </div>
      </section>
    </div>
  )
}
