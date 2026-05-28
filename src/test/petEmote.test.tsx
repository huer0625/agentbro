import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PetEmote } from '../components/notch/PetEmote'

describe('PetEmote', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when emote is null', () => {
    const { container } = render(<PetEmote emote={null} anchorTop={0} anchorLeft={0} />)
    expect(container.querySelector('.pet-emote')).toBeNull()
  })

  it('shows the glyph when emote is set', () => {
    render(<PetEmote emote="❓" anchorTop={10} anchorLeft={20} />)
    expect(screen.getByText('❓')).toBeInTheDocument()
  })

  it('runs through enter → hold → exit phases and clears', () => {
    const onComplete = vi.fn()
    const { container } = render(
      <PetEmote emote="💥" anchorTop={0} anchorLeft={0} durationMs={500} onComplete={onComplete} />,
    )
    expect(container.querySelector('.pet-emote')?.getAttribute('data-phase')).toBe('enter')

    act(() => {
      vi.advanceTimersByTime(120)
    })
    expect(container.querySelector('.pet-emote')?.getAttribute('data-phase')).toBe('hold')

    act(() => {
      vi.advanceTimersByTime(260)
    })
    expect(container.querySelector('.pet-emote')?.getAttribute('data-phase')).toBe('exit')

    act(() => {
      vi.advanceTimersByTime(120)
    })
    expect(container.querySelector('.pet-emote')).toBeNull()
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('positions itself at the given anchor', () => {
    const { container } = render(<PetEmote emote="✨" anchorTop={42} anchorLeft={88} />)
    const el = container.querySelector('.pet-emote') as HTMLElement
    expect(el.style.top).toBe('42px')
    expect(el.style.left).toBe('88px')
  })
})
