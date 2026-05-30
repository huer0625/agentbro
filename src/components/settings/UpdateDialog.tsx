import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { HOMEBREW_UPDATE_COMMAND } from '../../hooks/useUpdater'
import type { UpdateInstallChannel, UpdateStatus } from '../../hooks/useUpdater'

interface UpdateDialogProps {
  version: string
  notes: string | null
  date: string | null
  status: UpdateStatus
  installChannel: UpdateInstallChannel
  manualDownloadUrl?: string | null
  downloadProgress?: {
    downloaded: number
    total: number | null
    percent: number | null
  } | null
  restartPending?: boolean
  restartBlockedByActivity?: boolean
  blockingSessionCount?: number
  onInstall: () => void
  onDismiss: () => void
}

export function UpdateDialog({
  version,
  notes,
  date,
  status,
  installChannel,
  manualDownloadUrl,
  downloadProgress,
  restartPending = false,
  restartBlockedByActivity = false,
  blockingSessionCount = 0,
  onInstall,
  onDismiss,
}: UpdateDialogProps) {
  const { t, i18n } = useTranslation()
  const isDownloading = status === 'downloading'
  const isReady = status === 'ready'
  const isHomebrew = installChannel === 'homebrew'
  const isManualDownload = Boolean(manualDownloadUrl) && !isReady
  const progressPercent = downloadProgress?.percent ?? null
  const progressLabel = formatProgress(downloadProgress)
  const localizedNotes = useMemo(
    () => selectLocalizedReleaseNotes(notes, i18n.language),
    [i18n.language, notes],
  )

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
          {localizedNotes ? (
            <ReactMarkdown
              className="update-dialog__markdown"
              remarkPlugins={[remarkGfm]}
            >
              {localizedNotes}
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
              {restartBlockedByActivity
                ? t('update.restartWhenIdleHint', { count: blockingSessionCount, defaultValue: 'The update is ready. AgentBro will restart automatically after active sessions become idle.' })
                : restartPending
                  ? t('update.restartSoonHint', { defaultValue: 'The update is ready. AgentBro will restart automatically after a short idle window.' })
                  : t('update.restartHint')}
            </div>
          )}

          {isHomebrew && (
            <div className="update-dialog__ready">
              {t('update.homebrewHint')}
              <code className="update-dialog__command">{HOMEBREW_UPDATE_COMMAND}</code>
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
            {isDownloading ? t('update.downloading') : isReady ? t('update.restart') : isHomebrew ? t('update.copyCommand') : isManualDownload ? t('update.downloadLatest') : t('update.install')}
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

type ReleaseNotesLanguage = 'en' | 'zh'

function selectLocalizedReleaseNotes(notes: string | null, language: string | undefined): string | null {
  if (!notes) return null

  const sections = parseLocalizedReleaseNoteSections(notes)
  if (!sections) return notes

  const targetLanguage: ReleaseNotesLanguage = language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  return sections[targetLanguage] ?? sections.en ?? sections.zh ?? notes
}

function parseLocalizedReleaseNoteSections(notes: string): Partial<Record<ReleaseNotesLanguage, string>> | null {
  const sectionHeadingPattern = /^##\s*(English|中文|Chinese|简体中文)\s*$/gim
  const matches = Array.from(notes.matchAll(sectionHeadingPattern))
  if (matches.length === 0) return null

  const sections: Partial<Record<ReleaseNotesLanguage, string>> = {}

  matches.forEach((match, index) => {
    const label = match[1]?.toLowerCase()
    const language: ReleaseNotesLanguage = label === 'english' ? 'en' : 'zh'
    const start = match.index + match[0].length
    const end = matches[index + 1]?.index ?? notes.length
    const content = notes.slice(start, end).trim()
    if (content) sections[language] = content
  })

  return sections.en || sections.zh ? sections : null
}
