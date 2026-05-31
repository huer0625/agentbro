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
 * MUST stay in lockstep with Rust's center-based pet anchor calculation. If JS
 * used the work area instead (which excludes the macOS menu bar / Dock), the two
 * would disagree near the screen midline and the sprite could jump on release.
 */
export function petStageAnchorFromWindow(
  windowX: number,
  windowY: number,
  monitor: Monitor,
  scale: number,
  currentAnchor: PetStageAnchor = DEFAULT_PET_STAGE_ANCHOR,
): PetStageAnchor {
  const ratio = Math.max(1, monitor.scaleFactor || window.devicePixelRatio || 1)
  const petSize = PET_SLOT_SIZE * scale
  const petLeft = currentAnchor.x === 'left'
    ? PET_ANCHOR_RIGHT
    : PET_STAGE_WIDTH - PET_ANCHOR_RIGHT - petSize
  const petTop = currentAnchor.y === 'top'
    ? PET_ANCHOR_BOTTOM
    : PET_STAGE_HEIGHT - PET_ANCHOR_BOTTOM - petSize
  const petCenterX = windowX + (petLeft + petSize / 2) * ratio
  const petCenterY = windowY + (petTop + petSize / 2) * ratio
  const midpointX = monitor.position.x + monitor.size.width / 2
  const midpointY = monitor.position.y + monitor.size.height / 2
  return {
    x: petCenterX < midpointX ? 'left' : 'right',
    y: petCenterY < midpointY ? 'top' : 'bottom',
  }
}
