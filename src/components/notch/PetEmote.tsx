import { useEffect, useRef, useState } from 'react'
import './PetEmote.css'

export type EmoteKind = '❓' | '💭' | '💥' | '✨' | null

interface PetEmoteProps {
  /** Current emote glyph. Set to a value to play; will auto-clear after `durationMs`. */
  emote: EmoteKind
  /** Where to anchor the bubble inside the PetSurface stage (CSS px). */
  anchorTop: number
  anchorLeft: number
  /** How long the pop-up stays visible. Default 500 ms. */
  durationMs?: number
  /** Notify caller when the auto-clear timer fires (so they can null `emote`). */
  onComplete?: () => void
}

/**
 * Lightweight overlay rendered above the pet sprite to communicate momentary
 * intent (?, !, ...). Pops in with a small bounce, holds, then fades out.
 */
export function PetEmote({
  emote,
  anchorTop,
  anchorLeft,
  durationMs = 500,
  onComplete,
}: PetEmoteProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit' | null>(null)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!emote) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Emote visibility mirrors the current emote prop.
      setPhase(null)
      return
    }
    setPhase('enter')
    const enterToHold = window.setTimeout(() => setPhase('hold'), 120)
    const holdToExit = window.setTimeout(() => setPhase('exit'), durationMs - 120)
    const finalize = window.setTimeout(() => {
      setPhase(null)
      onCompleteRef.current?.()
    }, durationMs)
    return () => {
      window.clearTimeout(enterToHold)
      window.clearTimeout(holdToExit)
      window.clearTimeout(finalize)
    }
  }, [emote, durationMs])

  if (!emote || !phase) return null

  return (
    <div
      className="pet-emote"
      data-phase={phase}
      style={{ top: anchorTop, left: anchorLeft }}
      aria-hidden
    >
      <span className="pet-emote__glyph">{emote}</span>
    </div>
  )
}
