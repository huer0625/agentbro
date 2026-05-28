import { useState, useEffect, useCallback, useRef } from 'react'
import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater'
import { getCurrentAppVersion, isTauri } from '../services/tauriApi'
import { useConfigStore } from '../stores/configStore'

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'up-to-date'

const RELEASE_API_URL = 'https://api.github.com/repos/shirenchuang/agentbro/releases/latest'
const LATEST_DMG_URL = 'https://github.com/shirenchuang/agentbro/releases/latest/download/AgentBro_latest_universal.dmg'

interface UpdateState {
  status: UpdateStatus
  version: string | null
  notes: string | null
  date: string | null
  error: string | null
  manualDownloadUrl: string | null
  downloadProgress: {
    downloaded: number
    total: number | null
    percent: number | null
  } | null
}

export function useUpdater() {
  const updateRef = useRef<Update | null>(null)
  const manualDownloadUrlRef = useRef<string | null>(null)
  const autoCheckUpdate = useConfigStore((s) => s.autoCheckUpdate)
  const autoInstallUpdate = useConfigStore((s) => s.autoInstallUpdate)
  const autoInstallTriggeredRef = useRef(false)
  const [state, setState] = useState<UpdateState>({
    status: 'idle',
    version: null,
    notes: null,
    date: null,
    error: null,
    manualDownloadUrl: null,
    downloadProgress: null,
  })

  const checkForUpdate = useCallback(async () => {
    if (!isTauri()) return

    setState(prev => ({ ...prev, status: 'checking', error: null }))

    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check({
        headers: { 'X-Update-Channel': 'stable' },
      })

      if (update) {
        updateRef.current = update
        manualDownloadUrlRef.current = null
        setState({
          status: 'available',
          version: update.version,
          notes: update.body ?? null,
          date: update.date ?? null,
          error: null,
          manualDownloadUrl: null,
          downloadProgress: null,
        })
      } else {
        updateRef.current = null
        manualDownloadUrlRef.current = null
        setState({ status: 'up-to-date', version: null, notes: null, date: null, error: null, manualDownloadUrl: null, downloadProgress: null })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[updater] check failed:', message)

      try {
        const fallback = await checkGitHubLatestRelease()
        if (fallback.available) {
          updateRef.current = null
          manualDownloadUrlRef.current = fallback.downloadUrl
          setState({
            status: 'available',
            version: fallback.version,
            notes: fallback.notes,
            date: fallback.date,
            error: null,
            manualDownloadUrl: fallback.downloadUrl,
            downloadProgress: null,
          })
          return
        }

        updateRef.current = null
        manualDownloadUrlRef.current = null
        setState({ status: 'up-to-date', version: null, notes: null, date: null, error: null, manualDownloadUrl: null, downloadProgress: null })
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        console.error('[updater] fallback check failed:', fallbackMessage)
        setState({ status: 'error', version: null, notes: null, date: null, error: null, manualDownloadUrl: null, downloadProgress: null })
      }
    }
  }, [])

  const installUpdate = useCallback(async () => {
    const update = updateRef.current
    if (!update) {
      const manualDownloadUrl = manualDownloadUrlRef.current
      if (!manualDownloadUrl) return
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(manualDownloadUrl)
      return
    }

    let downloaded = 0
    let total: number | null = null
    const onDownloadEvent = (event: DownloadEvent) => {
      if (event.event === 'Started') {
        downloaded = 0
        total = event.data.contentLength ?? null
      } else if (event.event === 'Progress') {
        downloaded += event.data.chunkLength
      } else if (event.event === 'Finished') {
        downloaded = total ?? downloaded
      }

      const percent = total && total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null
      setState(prev => ({
        ...prev,
        status: 'downloading',
        downloadProgress: { downloaded, total, percent },
      }))
    }

    setState(prev => ({
      ...prev,
      status: 'downloading',
      error: null,
      downloadProgress: { downloaded: 0, total: null, percent: null },
    }))
    try {
      await update.downloadAndInstall(onDownloadEvent)
      setState(prev => ({ ...prev, status: 'ready', downloadProgress: { downloaded, total, percent: 100 } }))
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[updater] install failed:', message)
      setState(prev => ({ ...prev, status: 'available', error: message, downloadProgress: null }))
    }
  }, [])

  const dismissUpdate = useCallback(() => {
    updateRef.current = null
    manualDownloadUrlRef.current = null
    setState({ status: 'idle', version: null, notes: null, date: null, error: null, manualDownloadUrl: null, downloadProgress: null })
  }, [])

  useEffect(() => {
    if (!isTauri()) return
    if (!autoCheckUpdate) return

    const timer = setTimeout(() => {
      checkForUpdate()
    }, 5000)

    return () => clearTimeout(timer)
  }, [checkForUpdate, autoCheckUpdate])

  useEffect(() => {
    if (state.status !== 'available') return
    if (!autoInstallUpdate) return
    if (autoInstallTriggeredRef.current) return
    if (!updateRef.current) return
    autoInstallTriggeredRef.current = true
    installUpdate()
  }, [state.status, autoInstallUpdate, installUpdate])

  return { ...state, checkForUpdate, installUpdate, dismissUpdate }
}

interface GitHubRelease {
  tag_name: string
  body: string | null
  published_at: string | null
  assets: Array<{
    name: string
    browser_download_url: string
  }>
}

async function checkGitHubLatestRelease(): Promise<{
  available: boolean
  version: string | null
  notes: string | null
  date: string | null
  downloadUrl: string | null
}> {
  const response = await fetch(RELEASE_API_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub release API returned ${response.status}`)
  }

  const release = await response.json() as GitHubRelease
  const latestVersion = release.tag_name.replace(/^v/, '')
  const currentVersion = await getCurrentAppVersion()
  const downloadAsset = release.assets.find((asset) => asset.name === 'AgentBro_latest_universal.dmg')
    ?? release.assets.find((asset) => asset.name.endsWith('_universal.dmg'))

  return {
    available: compareVersions(latestVersion, currentVersion) > 0,
    version: latestVersion,
    notes: release.body,
    date: release.published_at,
    downloadUrl: downloadAsset?.browser_download_url ?? LATEST_DMG_URL,
  }
}

function compareVersions(left: string, right: string): number {
  const leftParts = normalizeVersion(left)
  const rightParts = normalizeVersion(right)
  const length = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0
    const rightPart = rightParts[index] ?? 0
    if (leftPart !== rightPart) return leftPart > rightPart ? 1 : -1
  }

  return 0
}

function normalizeVersion(version: string): number[] {
  return version
    .replace(/^v/, '')
    .split('-')[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0))
}
