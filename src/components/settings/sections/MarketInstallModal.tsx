import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassButton } from '../../shared'
import type { MarketJob } from '../../../stores/marketStore'
import './MarketInstallModal.css'

interface MarketInstallModalProps {
  job: MarketJob
  onClose: () => void
}

export function MarketInstallModal({ job, onClose }: MarketInstallModalProps) {
  const { t } = useTranslation()
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [job.logs.length])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && job.status !== 'running') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [job.status, onClose])

  useEffect(() => {
    if (job.status !== 'success') return
    const timer = window.setTimeout(() => onClose(), 1200)
    return () => window.clearTimeout(timer)
  }, [job.status, onClose])

  const title =
    job.kind === 'install-abpets'
      ? t('settings.market.jobInstallAbpetsTitle')
      : job.kind === 'install'
      ? t('settings.market.jobInstallTitle', { name: job.pet?.displayName ?? '' })
      : t('settings.market.jobUninstallTitle', { name: job.pet?.displayName ?? '' })

  const statusLabel =
    job.status === 'running'
      ? t('settings.market.jobRunning')
      : job.status === 'success'
      ? t('settings.market.jobSuccess')
      : t('settings.market.jobFailed')

  return (
    <div
      className="market-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="market-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && job.status !== 'running') onClose()
      }}
    >
      <div className="market-modal">
        <header className="market-modal__header">
          <div>
            <h3 id="market-modal-title" className="market-modal__title">{title}</h3>
            <div className={`market-modal__status market-modal__status--${job.status}`}>
              <span className="market-modal__status-dot" />
              <span>{statusLabel}</span>
              {job.exitCode !== null && job.status === 'failed' && (
                <span className="market-modal__exit">exit {job.exitCode}</span>
              )}
            </div>
          </div>
          <GlassButton
            variant="ghost"
            onClick={onClose}
            disabled={job.status === 'running'}
          >
            {t('settings.market.closeBtn')}
          </GlassButton>
        </header>

        <div className="market-modal__logs-label">{t('settings.market.logsTitle')}</div>
        <div className="market-modal__logs" ref={logRef}>
          {job.logs.length === 0 ? (
            <div className="market-modal__logs-empty">…</div>
          ) : (
            job.logs.map((entry, i) => (
              <div
                key={i}
                className={`market-modal__log-line market-modal__log-line--${entry.stream}`}
              >
                {entry.line || ' '}
              </div>
            ))
          )}
          {job.error && job.status === 'failed' && (
            <div className="market-modal__log-line market-modal__log-line--error">
              {job.error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
