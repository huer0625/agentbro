import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { open } from '@tauri-apps/plugin-shell'
import { quitApp, exportDiagnostics, getCurrentAppVersion } from '../../../services/tauriApi'
import type { UpdateStatus } from '../../../hooks/useUpdater'
import { SettingSection } from '../SettingSection'
import { SettingGroup } from '../SettingGroup'
import { SettingRow } from '../SettingRow'
import { GlassButton } from '../../shared'

interface AboutSectionProps {
  updateStatus?: UpdateStatus
  updateVersion?: string | null
  updateError?: string | null
  onCheckForUpdate?: () => void
}

function AboutLinkIcon({ type }: { type: 'website' | 'github' | 'releases' | 'community' }) {
  if (type === 'website') {
    return (
      <svg aria-hidden="true" className="about-link-icon" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M3.6 9h16.8M3.6 15h16.8M12 3c2.1 2.35 3.15 5.35 3.15 9S14.1 18.65 12 21M12 3C9.9 5.35 8.85 8.35 8.85 12S9.9 18.65 12 21" />
      </svg>
    )
  }

  if (type === 'github') {
    return (
      <svg aria-hidden="true" className="about-link-icon" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.61-3.37-1.18-3.37-1.18-.45-1.15-1.1-1.46-1.1-1.46-.9-.62.07-.61.07-.61 1 .07 1.53 1.04 1.53 1.04.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.55 9.55 0 0 1 12 6.02c.85 0 1.7.11 2.5.34 1.9-1.29 2.74-1.02 2.74-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86v2.76c0 .26.18.58.69.48A10 10 0 0 0 12 2Z" />
      </svg>
    )
  }

  if (type === 'community') {
    return (
      <svg aria-hidden="true" className="about-link-icon" fill="none" viewBox="0 0 24 24">
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2h9A3.5 3.5 0 0 1 20 5.5v7A3.5 3.5 0 0 1 16.5 16H12l-4.5 4v-4A3.5 3.5 0 0 1 4 12.5v-7Z" />
        <path d="M8 8h.01M12 8h.01M16 8h.01" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" className="about-link-icon" fill="none" viewBox="0 0 24 24">
      <path d="M20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5" />
      <path d="M12 4v10" />
      <path d="m7 9 5 5 5-5" />
    </svg>
  )
}

export function AboutSection({ updateStatus, updateVersion, updateError, onCheckForUpdate }: AboutSectionProps) {
  const { t } = useTranslation()
  const [diagStatus, setDiagStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const [communityOpen, setCommunityOpen] = useState(false)
  const [appVersion, setAppVersion] = useState<string>('...')

  useEffect(() => {
    let cancelled = false
    getCurrentAppVersion()
      .then((version) => {
        if (!cancelled) setAppVersion(version)
      })
      .catch(() => {
        if (!cancelled) setAppVersion('dev')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const openExternalLink = (url: string) => {
    open(url).catch((err) => console.warn('[AboutSection] open link:', err))
  }

  const handleExportDiagnostics = async () => {
    setDiagStatus('copying')
    try {
      const json = await exportDiagnostics()
      await navigator.clipboard.writeText(json)
      setDiagStatus('copied')
      setTimeout(() => setDiagStatus('idle'), 2000)
    } catch {
      setDiagStatus('error')
      setTimeout(() => setDiagStatus('idle'), 2000)
    }
  }

  const updateDescription = (() => {
    switch (updateStatus) {
      case 'checking': return t('settings.updateChecking', { defaultValue: '正在检查更新...' })
      case 'available': return t('settings.updateAvailable', { version: updateVersion, defaultValue: `发现新版本 ${updateVersion}` })
      case 'downloading': return t('settings.updateDownloading', { version: updateVersion, defaultValue: `正在下载 ${updateVersion}...` })
      case 'ready': return t('settings.updateReady', { version: updateVersion, defaultValue: `新版本 ${updateVersion} 已就绪，重启后生效` })
      case 'error': return updateError ?? t('settings.updateCheckFailed', { defaultValue: '无法连接更新服务，请稍后重试，或通过“发布版本”手动下载最新版。' })
      case 'up-to-date': return t('settings.latestVersion')
      default: return t('settings.latestVersion')
    }
  })()

  return (
    <SettingSection title={t('settings.aboutTitle')}>
      <div className="about-header">
        <img className="about-header__icon" src="/agentbro-logo.png" alt="" aria-hidden="true" />
        <div className="about-header__name">AgentBro</div>
        <div className="about-header__slogan">{t('notch.slogan')}</div>
        <div className="about-header__version">Version {appVersion}</div>
      </div>

      <SettingGroup label={t('settings.logoMeaning', { defaultValue: 'Logo Meaning' })}>
        <div className="about-logo-meaning">
          <img src="/agentbro-logo.png" alt="" aria-hidden="true" />
          <div>
            <strong>{t('settings.logoMeaningTitle', { defaultValue: 'A handshake between people and agents' })}</strong>
            <span>{t('settings.logoMeaningDesc', { defaultValue: 'The center handshake represents collaboration between humans and AI agents. The outer A/B shape comes from AgentBro and resembles two connected agent nodes.' })}</span>
          </div>
        </div>
      </SettingGroup>

      <SettingGroup>
        <SettingRow label={t('settings.checkForUpdates')} description={updateDescription}>
          <GlassButton
            variant="secondary"
            onClick={() => onCheckForUpdate?.()}
            disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
          >
            {updateStatus === 'checking' || updateStatus === 'downloading' ? '...' : t('settings.checkNow')}
          </GlassButton>
        </SettingRow>
        <SettingRow label={t('settings.exportDiagnostics')} description={t('settings.exportDiagnosticsDesc')}>
          <GlassButton
            variant="secondary"
            onClick={handleExportDiagnostics}
            disabled={diagStatus === 'copying'}
          >
            {diagStatus === 'copied' ? 'Copied!' : diagStatus === 'error' ? 'Failed' : t('settings.export')}
          </GlassButton>
        </SettingRow>
      </SettingGroup>

      <SettingGroup label={t('settings.links', { defaultValue: 'Links' })}>
        <div className="about-link-actions">
          <GlassButton className="about-link-button" variant="secondary" onClick={() => openExternalLink('https://www.agentbro.net')}>
            <AboutLinkIcon type="website" />
            {t('settings.website', { defaultValue: 'Website' })}
          </GlassButton>
          <GlassButton className="about-link-button" variant="secondary" onClick={() => openExternalLink('https://github.com/shirenchuang/agentbro')}>
            <AboutLinkIcon type="github" />
            {t('settings.github', { defaultValue: 'GitHub' })}
          </GlassButton>
          <GlassButton className="about-link-button" variant="secondary" onClick={() => openExternalLink('https://github.com/shirenchuang/agentbro/releases')}>
            <AboutLinkIcon type="releases" />
            {t('settings.releases', { defaultValue: 'Releases' })}
          </GlassButton>
          <GlassButton className="about-link-button" variant="secondary" onClick={() => setCommunityOpen((open) => !open)}>
            <AboutLinkIcon type="community" />
            {t('settings.community', { defaultValue: 'AgentBro Community' })}
          </GlassButton>
        </div>
        {communityOpen && (
          <div className="about-community-card">
            <img src="/agentbro-wechat-qr.jpg" alt={t('settings.communityQrAlt', { defaultValue: 'AgentBro community WeChat QR code' })} />
            <div>
              <strong>{t('settings.communityTitle', { defaultValue: 'Join the AgentBro community' })}</strong>
              <span>{t('settings.communityDesc', { defaultValue: 'Scan the QR code to add WeChat, then mention AgentBro community.' })}</span>
            </div>
          </div>
        )}
      </SettingGroup>

      <SettingGroup label={t('settings.credits')}>
        <div className="credits-list" style={{ padding: 'var(--space-sm) 0' }}>
          <div>{t('settings.builtWith')}</div>
          <div>{t('settings.designSystem')}</div>
          <div style={{ marginTop: 'var(--space-sm)', color: '#aeaeb2' }}>
            {t('settings.copyright')}
          </div>
        </div>
      </SettingGroup>

      <SettingGroup>
        <div style={{ padding: 'var(--space-sm) 0' }}>
          <GlassButton variant="danger" onClick={() => quitApp()}>
            {t('settings.quitApp')}
          </GlassButton>
        </div>
      </SettingGroup>
    </SettingSection>
  )
}
