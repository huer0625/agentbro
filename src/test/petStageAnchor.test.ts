import { describe, expect, it } from 'vitest'
import { petStageAnchorFromWindow } from '../components/notch/petStageAnchor'
import type { Monitor } from '@tauri-apps/api/window'

// Regression for the pet "floats on release" + session-list "up/down" jitter.
//
// Rust positions the pet window and computes its corner anchor from the FULL
// monitor center (`pos + size/2`). JS must use the SAME center, otherwise the
// CSS renders the sprite in a different corner than Rust placed the window for,
// and the sprite jumps / the panel flips. The macOS menu bar makes the work
// area center differ from the full-monitor center on the Y axis, so a window
// dropped in that band is exactly where the two used to disagree.
function monitorWithMenuBar(): Monitor {
  // 1440x900 logical @2x. Menu bar (25pt) shifts the work area down 50px.
  return {
    name: 'test',
    scaleFactor: 2,
    position: { x: 0, y: 0 },
    size: { width: 2880, height: 1800 },
    workArea: { position: { x: 0, y: 50 }, size: { width: 2880, height: 1750 } },
  } as unknown as Monitor
}

describe('petStageAnchorFromWindow', () => {
  it('uses the full-monitor center for the Y anchor, not the work-area center', () => {
    const scale = 0.72
    // Chosen so the default-anchor pet center Y = 912px:
    //   full-monitor center Y = 900  -> 912 >= 900 -> 'bottom'
    //   work-area center Y    = 925  -> 912 <  925 -> 'top'   (the old, wrong result)
    const windowY = 395.2
    const anchor = petStageAnchorFromWindow(0, windowY, monitorWithMenuBar(), scale)
    expect(anchor.y).toBe('bottom')
  })

  it('still flips to top above the full-monitor center', () => {
    const scale = 0.72
    // pet center Y = 700, clearly above both midpoints -> 'top'
    const windowY = 700 - (360 - 44 - 160 * scale / 2) * 2
    const anchor = petStageAnchorFromWindow(0, windowY, monitorWithMenuBar(), scale)
    expect(anchor.y).toBe('top')
  })
})
