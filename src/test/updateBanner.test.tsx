import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpdateBanner } from '../components/notch/UpdateBanner'
import { useUpdateStore } from '../stores/updateStore'

const tauriMocks = vi.hoisted(() => ({
  openSettingsWindow: vi.fn(() => Promise.resolve()),
}))

vi.mock('../services/tauriApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/tauriApi')>()
  return { ...actual, openSettingsWindow: tauriMocks.openSettingsWindow }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; version?: string }) => {
      if (key === 'notch.updateBannerTitle') return `New version v${options?.version}`
      const translations: Record<string, string> = {
        'notch.updateNow': 'Update Now',
        'notch.updateDismiss': 'Dismiss',
      }
      return translations[key] ?? options?.defaultValue ?? key
    },
  }),
}))

describe('UpdateBanner', () => {
  afterEach(() => {
    vi.clearAllMocks()
    useUpdateStore.setState({ availableVersion: null, dismissedVersion: null })
  })

  it('renders the available version', () => {
    render(<UpdateBanner version="0.3.0" />)
    expect(screen.getByText('New version v0.3.0')).toBeInTheDocument()
  })

  it('"Update Now" opens settings and dismisses this version for the run', () => {
    useUpdateStore.setState({ availableVersion: '0.3.0', dismissedVersion: null })
    render(<UpdateBanner version="0.3.0" />)

    fireEvent.click(screen.getByRole('button', { name: 'Update Now' }))

    expect(tauriMocks.openSettingsWindow).toHaveBeenCalledTimes(1)
    expect(useUpdateStore.getState().dismissedVersion).toBe('0.3.0')
    // Availability is unchanged so the gear/pet dot stays lit.
    expect(useUpdateStore.getState().availableVersion).toBe('0.3.0')
  })

  it('close (×) dismisses for the run without opening settings', () => {
    useUpdateStore.setState({ availableVersion: '0.3.0', dismissedVersion: null })
    render(<UpdateBanner version="0.3.0" />)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(tauriMocks.openSettingsWindow).not.toHaveBeenCalled()
    expect(useUpdateStore.getState().dismissedVersion).toBe('0.3.0')
    expect(useUpdateStore.getState().availableVersion).toBe('0.3.0')
  })
})

describe('updateStore dismissal semantics', () => {
  afterEach(() => useUpdateStore.setState({ availableVersion: null, dismissedVersion: null }))

  it('banner-visible derivation hides after dismiss but re-shows for a newer version', () => {
    const visible = () => {
      const { availableVersion, dismissedVersion } = useUpdateStore.getState()
      return Boolean(availableVersion) && availableVersion !== dismissedVersion
    }

    useUpdateStore.getState().setAvailableVersion('0.3.0')
    expect(visible()).toBe(true)

    useUpdateStore.getState().dismissVersion('0.3.0')
    expect(visible()).toBe(false)

    // A newer version supersedes the dismissed one.
    useUpdateStore.getState().setAvailableVersion('0.4.0')
    expect(visible()).toBe(true)
  })
})
