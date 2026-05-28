import { useTranslation } from 'react-i18next'
import { useConfigStore } from '../../../stores/configStore'
import { SettingSection } from '../SettingSection'
import { SettingGroup } from '../SettingGroup'
import { SettingRow } from '../SettingRow'
import { Toggle } from '../Toggle'
import { Dropdown } from '../Dropdown'
import { setAnalyticsEnabled, setLaunchAtLogin } from '../../../services/tauriApi'

export function GeneralSection() {
  const { t, i18n } = useTranslation()
  const config = useConfigStore()

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'zh', label: '中文' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
    { value: 'tr', label: 'Türkçe' },
  ]

  return (
    <SettingSection title={t('settings.general')} description={t('settings.generalDesc')}>
      <SettingGroup>
        <SettingRow label={t('settings.language')} description={t('settings.languageDesc')}>
          <Dropdown
            value={(() => {
              const lang = i18n.language
              if (lang.startsWith('zh')) return 'zh'
              if (lang.startsWith('ja')) return 'ja'
              if (lang.startsWith('ko')) return 'ko'
              if (lang.startsWith('tr')) return 'tr'
              return 'en'
            })()}
            options={languageOptions}
            onChange={(v) => {
              i18n.changeLanguage(v)
              config.updateConfig('language', v as 'en' | 'zh' | 'ja' | 'ko' | 'tr')
            }}
            minWidth={120}
          />
        </SettingRow>
        <SettingRow label={t('settings.launchAtLogin')} description={t('settings.launchAtLoginDesc')}>
          <Toggle checked={config.launchAtLogin} onChange={(v) => {
            const previous = config.launchAtLogin
            config.updateConfig('launchAtLogin', v)
            setLaunchAtLogin(v).catch((error) => {
              console.error('[settings] setLaunchAtLogin:', error)
              config.updateConfig('launchAtLogin', previous)
            })
          }} />
        </SettingRow>
        <SettingRow label={t('settings.anonymousAnalytics')} description={t('settings.anonymousAnalyticsDesc')}>
          <Toggle checked={config.analyticsEnabled} onChange={(v) => {
            const previousEnabled = config.analyticsEnabled
            const previousCompleted = config.analyticsConsentPromptCompleted
            config.updateConfig('analyticsEnabled', v)
            config.updateConfig('analyticsConsentPromptCompleted', true)
            setAnalyticsEnabled(v).catch((error) => {
              console.error('[settings] setAnalyticsEnabled:', error)
              config.updateConfig('analyticsEnabled', previousEnabled)
              config.updateConfig('analyticsConsentPromptCompleted', previousCompleted)
            })
          }} />
        </SettingRow>
      </SettingGroup>
    </SettingSection>
  )
}
