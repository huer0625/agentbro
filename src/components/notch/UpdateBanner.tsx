import { useTranslation } from 'react-i18next'
import { openSettingsWindow } from '../../services/tauriApi'
import { useUpdateStore } from '../../stores/updateStore'
import './UpdateBanner.css'

interface UpdateBannerProps {
  version: string
}

// Proactive "new version" banner shown at the top of the expanded notch. The
// gear/pet dot is the passive signal; this is the active nudge. Dismissal is
// per-run (updateStore.dismissVersion), so the dot stays but the banner won't
// re-pop until a newer version or app restart.
export function UpdateBanner({ version }: UpdateBannerProps) {
  const { t } = useTranslation()
  const dismissVersion = useUpdateStore((s) => s.dismissVersion)

  const handleUpdate = () => {
    dismissVersion(version)
    openSettingsWindow().catch((error) => console.warn('[notch] openSettingsWindow:', error))
  }

  return (
    <div className="update-banner" role="status">
      <span className="update-banner__icon" aria-hidden="true">↑</span>
      <span className="update-banner__title">{t('notch.updateBannerTitle', { version })}</span>
      <button type="button" className="update-banner__action" onClick={handleUpdate}>
        {t('notch.updateNow')}
      </button>
      <button
        type="button"
        className="update-banner__close"
        aria-label={t('notch.updateDismiss')}
        onClick={() => dismissVersion(version)}
      >
        ×
      </button>
    </div>
  )
}
