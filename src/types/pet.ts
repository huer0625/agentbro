// Pet types — independent of ThemeConfig.
// A Pet is a sprite character (animations + state mapping + spritesheet) that lives
// inside the Pet surface. It is orthogonal to the color theme.

export interface PetFrameSize {
  width: number
  height: number
}

export interface PetAnimation {
  row: number
  frames: number
  fps: number
}

export type PetProvider = 'codex' | 'user' | 'agentbro'

/**
 * Backend-provided shape from `discover_pets` Tauri command.
 * Mirrors src-tauri/src/pets/mod.rs::PetMetadata.
 */
export interface PetMetadata {
  id: string
  displayName: string
  description?: string
  provider: PetProvider
  builtin: boolean
  /**
   * Absolute filesystem path to the spritesheet image returned by the
   * backend. The frontend converts it to an `asset://` URL via
   * `convertFileSrc()` before assigning to `<img src>` / CSS
   * `background-image`. We deliberately avoid base64 data URLs so the JS
   * heap doesn't balloon with sprite bytes (a 1.5 MB sheet becomes ~4 MB
   * UTF-16 in JS and then ~12 MB once decoded; 17 pets = ~200 MB just for
   * the registry).
   */
  spritesheetPath: string
  frameSize: PetFrameSize
  animations: Record<string, PetAnimation>
  stateMapping: Record<string, string>
}

/**
 * In-memory pet option used by the renderer. `PetMetadata` is the wire format;
 * `PetOption` adds:
 * - the `spritesheetUrl` (an `asset://` URL the WebView can stream directly)
 *   derived from the backend path via `convertFileSrc`, so React effects can
 *   key off a short stable string instead of a giant base64 blob; and
 * - optional fallback metadata used for the auto-pick mapping.
 */
export interface PetOption extends PetMetadata {
  /** asset:// URL ready to drop into `<img src>` or CSS `background-image`. */
  spritesheetUrl: string
  /** Agent types this pet should auto-attach to in 'auto' mode. */
  agentTypes?: string[]
}
