import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { UpdateStatus } from '../../hooks/useUpdater'

interface UpdateDialogProps {
  version: string
  notes: string | null
  date: string | null
  status: UpdateStatus
  manualDownloadUrl?: string | null
  downloadProgress?: {
    downloaded: number
    total: number | null
    percent: number | null
  } | null
  onInstall: () => void
  onDismiss: () => void
}

export function UpdateDialog({ version, notes, date, status, manualDownloadUrl, downloadProgress, onInstall, onDismiss }: UpdateDialogProps) {
  const { t } = useTranslation()
  const isDownloading = status === 'downloading'
  const isReady = status === 'ready'
  const isManualDownload = Boolean(manualDownloadUrl) && !isReady
  const progressPercent = downloadProgress?.percent ?? null
  const progressLabel = formatProgress(downloadProgress)

  return (
    <div className="update-dialog-overlay" onClick={onDismiss}>
      <div className="update-dialog" onClick={e => e.stopPropagation()}>
        <div className="update-dialog__header">
          <div>
            <div className="update-dialog__eyebrow">AgentBro</div>
            <div className="update-dialog__title">
              {isReady ? t('update.readyTitle') : t('update.availableTitle')}
            </div>
          </div>
          <button className="update-dialog__close" onClick={onDismiss} disabled={isDownloading} aria-label={t('update.later')}>
            ×
          </button>
        </div>

        <div className="update-dialog__meta">
          <strong>v{version}</strong>
          {date && <span>{new Date(date).toLocaleDateString()}</span>}
        </div>

        <div className="update-dialog__body">
          {notes ? (
            <ReactMarkdown
              className="update-dialog__markdown"
              remarkPlugins={[remarkGfm]}
            >
              {notes}
            </ReactMarkdown>
          ) : (
            <div className="update-dialog__empty">
              {t('update.noNotes', { defaultValue: '本次更新暂无详细说明。' })}
            </div>
          )}

          {isDownloading && (
            <div className="update-dialog__progress">
              <div className="update-dialog__progress-row">
                <span>{t('update.downloading')}</span>
                <span>{progressLabel}</span>
              </div>
              <div className="update-dialog__progress-track">
                <div
                  className="update-dialog__progress-bar"
                  style={{ width: progressPercent === null ? '36%' : `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {isReady && (
            <div className="update-dialog__ready">
              {t('update.restartHint')}
            </div>
          )}
        </div>

        <div className="update-dialog__footer">
          <button className="update-dialog__button" onClick={onDismiss} disabled={isDownloading}>
            {t('update.later')}
          </button>
          <button
            className="update-dialog__button update-dialog__button--primary"
            onClick={onInstall}
            disabled={isDownloading}
          >
            {isDownloading ? t('update.downloading') : isReady ? t('update.restart') : isManualDownload ? t('update.downloadLatest') : t('update.install')}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatProgress(progress: UpdateDialogProps['downloadProgress']) {
  if (!progress) return ''
  if (progress.percent !== null) return `${progress.percent}%`
  if (progress.downloaded > 0) return formatBytes(progress.downloaded)
  return '...'
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
