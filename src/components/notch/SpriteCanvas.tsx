import { useEffect, useRef, useState } from 'react'
import type { PetOption } from '../../types/pet'
import type { ThemeConfig } from '../../types/theme'
import type { Priority } from '../../types/priority'
import { priorityName } from '../../types/priority'

interface SpriteCanvasProps {
  pet?: PetOption | null
  theme?: ThemeConfig
  priority: Priority
  size: number
  /** Forces a specific animation row regardless of priority/idle state. Arrays are tried in order. */
  animationOverride?: string | readonly string[] | null
  /** Toggle the idle "personality" scheduler (blink/yawn/stretch). Default true. */
  enableIdleBehaviors?: boolean
  /**
   * Override how long the surface has been idle. If unset/0, the canvas tracks
   * its own idle-since timestamp from priority transitions.
   */
  idleSinceMs?: number
  /** Context window usage 0-100. When >75 slows FPS to show strain. */
  contextPressure?: number
  /** 5h token usage 0-100. When >75 and idle, reduces idle behavior frequency. */
  energyLevel?: number
}

/** Candidate one-shot animations the idle scheduler will pick from, in priority order. */
const IDLE_BEHAVIORS = ['blink', 'stretch', 'yawn', 'waving'] as const
const IDLE_TRIGGER_DELAY_MS = 8000
const IDLE_INTERVAL_MIN_MS = 4000
const IDLE_INTERVAL_MAX_MS = 7000
const SLEEP_THRESHOLD_MS = 120000
const SLEEP_FPS_FLOOR = 2

export function SpriteCanvas({
  pet,
  theme,
  priority,
  size,
  animationOverride,
  enableIdleBehaviors = true,
  idleSinceMs,
  contextPressure = 0,
  energyLevel = 0,
}: SpriteCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef(0)
  const lastTimeRef = useRef(0)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [idleBehavior, setIdleBehavior] = useState<string | null>(null)

  const trackedIdleMs = useTrackedIdleMs(priority)
  const effectiveIdleSinceMs = idleSinceMs && idleSinceMs > 0 ? idleSinceMs : trackedIdleMs
  const activePet = pet ?? themeToPet(theme)

  const pName = priorityName(priority)
  const isIdle = pName === 'idle'
  const isSleeping = isIdle && effectiveIdleSinceMs > SLEEP_THRESHOLD_MS
  const baseAnimName = activePet ? (activePet.stateMapping[pName] ?? 'idle') : 'idle'

  const activeAnimName = pickActiveAnimName({ animationOverride, idleBehavior, baseAnimName, pet: activePet })
  const anim = activePet?.animations[activeAnimName] ?? activePet?.animations['idle']
  const baseFps = anim?.fps ?? 6
  const vitalsFpsFactor = computeVitalsFpsFactor(contextPressure, energyLevel, isIdle)
  const fps = isSleeping && activeAnimName === baseAnimName
    ? Math.max(SLEEP_FPS_FLOOR, baseFps / 2)
    : Math.max(SLEEP_FPS_FLOOR, baseFps * vitalsFpsFactor)

  // Spritesheet preload
  useEffect(() => {
    if (!activePet?.spritesheetDataUrl) {
      imageRef.current = null
      return
    }
    const img = new Image()
    img.src = activePet.spritesheetDataUrl
    img.onload = () => {
      imageRef.current = img
    }
    return () => {
      imageRef.current = null
    }
  }, [activePet?.spritesheetDataUrl])

  // Animation render loop
  useEffect(() => {
    if (!anim || !activePet) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    frameRef.current = 0
    lastTimeRef.current = 0

    const interval = 1000 / Math.max(1, fps)
    const isOneShot = idleBehavior !== null && activeAnimName === idleBehavior
    let animId = 0

    const render = (time: number) => {
      if (time - lastTimeRef.current < interval) {
        animId = requestAnimationFrame(render)
        return
      }
      lastTimeRef.current = time

      const img = imageRef.current
      if (img) {
        const { width, height } = activePet.frameSize
        const frame = frameRef.current % anim.frames
        ctx.clearRect(0, 0, size, size)
        ctx.drawImage(img, frame * width, anim.row * height, width, height, 0, 0, size, size)
        frameRef.current = frame + 1

        if (isOneShot && frameRef.current >= anim.frames) {
          setIdleBehavior(null)
          return
        }
      }
      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [anim, activePet, size, fps, activeAnimName, idleBehavior])

  // Idle behavior scheduler — picks a random one-shot animation when idle.
  useEffect(() => {
    if (!enableIdleBehaviors || !isIdle || isSleeping || animationOverride) {
      if (idleBehavior !== null) {
        const timer = window.setTimeout(() => setIdleBehavior(null), 0)
        return () => window.clearTimeout(timer)
      }
      return
    }
    if (idleBehavior !== null) return
    if (effectiveIdleSinceMs < IDLE_TRIGGER_DELAY_MS) return

    const available = IDLE_BEHAVIORS.filter((name) => activePet?.animations[name])
    if (available.length === 0) return

    const energyMultiplier = energyLevel > 90 ? 3 : energyLevel > 75 ? 2 : energyLevel > 50 ? 1.3 : 1
    const delay = (IDLE_INTERVAL_MIN_MS + Math.random() * (IDLE_INTERVAL_MAX_MS - IDLE_INTERVAL_MIN_MS)) * energyMultiplier
    const timer = window.setTimeout(() => {
      const pick = available[Math.floor(Math.random() * available.length)]
      setIdleBehavior(pick)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [
    enableIdleBehaviors,
    isIdle,
    isSleeping,
    effectiveIdleSinceMs,
    animationOverride,
    idleBehavior,
    energyLevel,
    activePet,
  ])

  if (!activePet) return null

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      aria-hidden
    />
  )
}

function themeToPet(theme: ThemeConfig | undefined): PetOption | null {
  if (!theme?.character) return null
  const spriteSheet = theme.character.spriteSheetDataUrl ?? theme.character.spriteSheet
  if (!spriteSheet) return null
  return {
    id: theme.name,
    displayName: theme.displayName ?? theme.name,
    description: theme.description,
    provider: theme.provider ?? 'agentbro',
    builtin: theme.author === 'builtin',
    spritesheetDataUrl: spriteSheet,
    frameSize: theme.character.frameSize,
    animations: theme.character.animations,
    stateMapping: theme.stateMapping ?? {},
  }
}

function pickActiveAnimName({
  animationOverride,
  idleBehavior,
  baseAnimName,
  pet,
}: {
  animationOverride: string | readonly string[] | null | undefined
  idleBehavior: string | null
  baseAnimName: string
  pet: PetOption | null
}): string {
  const overrides = Array.isArray(animationOverride)
    ? animationOverride
    : animationOverride
      ? [animationOverride]
      : []
  const matchedOverride = overrides.find((name) => pet?.animations[name])
  if (matchedOverride) return matchedOverride
  if (idleBehavior && pet?.animations[idleBehavior]) return idleBehavior
  return baseAnimName
}

/**
 * Tracks how long the surface has been in `idle` priority. Resets to 0 the
 * moment priority changes away from idle. Updates at 1 Hz while idle.
 */
function useTrackedIdleMs(priority: Priority): number {
  const startRef = useRef<number | null>(null)
  const [idleMs, setIdleMs] = useState(0)
  const isIdle = priorityName(priority) === 'idle'

  useEffect(() => {
    if (!isIdle) {
      startRef.current = null
      const timer = window.setTimeout(() => setIdleMs(0), 0)
      return () => window.clearTimeout(timer)
    }
    startRef.current = Date.now()
    const resetTimer = window.setTimeout(() => setIdleMs(0), 0)
    const id = window.setInterval(() => {
      const start = startRef.current
      if (start === null) return
      setIdleMs(Date.now() - start)
    }, 1000)
    return () => {
      window.clearTimeout(resetTimer)
      window.clearInterval(id)
    }
  }, [isIdle])

  return idleMs
}

function computeVitalsFpsFactor(contextPressure: number, energyLevel: number, isIdle: boolean): number {
  let factor = 1
  if (contextPressure > 75) {
    factor *= 1 - (Math.min(contextPressure, 100) - 75) / 62.5
  }
  if (isIdle && energyLevel > 75) {
    factor *= 1 - (Math.min(energyLevel, 100) - 75) / 83
  }
  return Math.max(0.6, factor)
}
