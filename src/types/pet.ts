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
  spritesheetDataUrl: string
  frameSize: PetFrameSize
  animations: Record<string, PetAnimation>
  stateMapping: Record<string, string>
}

/**
 * In-memory pet option used by the renderer. `PetMetadata` is the wire format;
 * `PetOption` adds optional fallback metadata used for the auto-pick mapping.
 */
export interface PetOption extends PetMetadata {
  /** Agent types this pet should auto-attach to in 'auto' mode. */
  agentTypes?: string[]
}
