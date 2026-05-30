import type { Monitor } from '@tauri-apps/api/window'

export type PetStageAnchor = { x: 'left' | 'right'; y: 'top' | 'bottom' }

export const PET_STAGE_WIDTH = 820
export const PET_STAGE_HEIGHT = 360
export const PET_SLOT_SIZE = 160
export const PET_ANCHOR_RIGHT = 132
export const PET_ANCHOR_BOTTOM = 44

export const DEFAULT_PET_STAGE_ANCHOR: PetStageAnchor = { x: 'right', y: 'bottom' }

/**
 * Decide which corner of the transparent pet window the sprite is anchored to,
 * based on which screen quadrant the window currently sits in.
 *
 * MUST stay in lockstep with Rust's `pet_stage_anchor_for_origin`, which uses
 * the FULL monitor center (`pos + size/2`). If JS used the work area instead
 * (which excludes the macOS menu bar / Dock), the two would disagree near the
 * screen midline and CSS would render the sprite in a different corner than
 * Rust positioned the window for — the sprite jumps on release and the session
 * panel flips up/down.
 */
export function petStageAnchorFromWindow(
  windowX: number,
  windowY: number,
  monitor: Monitor,
  scale: number,
): PetStageAnchor {
  const ratio = Math.max(1, monitor.scaleFactor || window.devicePixelRatio || 1)
  const petSize = PET_SLOT_SIZE * scale
  const defaultPetCenterX = windowX + (PET_STAGE_WIDTH - PET_ANCHOR_RIGHT - petSize / 2) * ratio
  const defaultPetCenterY = windowY + (PET_STAGE_HEIGHT - PET_ANCHOR_BOTTOM - petSize / 2) * ratio
  const midpointX = monitor.position.x + monitor.size.width / 2
  const midpointY = monitor.position.y + monitor.size.height / 2
  return {
    x: defaultPetCenterX < midpointX ? 'left' : 'right',
    y: defaultPetCenterY < midpointY ? 'top' : 'bottom',
  }
}
