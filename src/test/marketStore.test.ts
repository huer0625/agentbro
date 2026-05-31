import { describe, expect, it } from 'vitest'
import { findInstalledMarketPet, isMarketPetInstalled, type MarketPet } from '../stores/marketStore'
import type { PetOption } from '../types/pet'

const ANIMS = { idle: { row: 0, frames: 1, fps: 1 } }
const STATE_MAP = { idle: 'idle' }

function makeMarketPet(slug: string): MarketPet {
  return {
    slug,
    fullSlug: `shirenchuang/${slug}`,
    displayName: slug,
    description: null,
    kind: 'Character',
    tags: [],
    spritesheetUrl: '',
    petJsonUrl: '',
    zipUrl: '',
    width: 1536,
    height: 1872,
    format: 'webp',
    status: 'approved',
    downloadCount: 0,
    priceCents: 0,
    currency: 'USD',
    version: 1,
    createdAt: '',
    updatedAt: '',
    authorHandle: 'shirenchuang',
    authorDisplayName: '石臻(Steven shi)',
    authorAvatarUrl: null,
  }
}

function makeLocalPet(id: string, directory: string): PetOption {
  return {
    id,
    displayName: id,
    provider: 'agentbro',
    builtin: false,
    spritesheetPath: `/Users/test/.agentbro/pets/${directory}/spritesheet.webp`,
    spritesheetUrl: `asset://localhost/Users/test/.agentbro/pets/${directory}/spritesheet.webp`,
    frameSize: { width: 192, height: 208 },
    animations: ANIMS,
    stateMapping: STATE_MAP,
  }
}

describe('isMarketPetInstalled', () => {
  it('matches market pets installed into a directory even when pet.json id differs', () => {
    const registry = [
      makeLocalPet('agentbro:astral-young-dragon-king', 'longwang'),
      makeLocalPet('agentbro:kunziji', 'kunkun'),
    ]

    expect(isMarketPetInstalled(makeMarketPet('longwang'), registry)).toBe(true)
    expect(isMarketPetInstalled(makeMarketPet('kunkun'), registry)).toBe(true)
    expect(findInstalledMarketPet(makeMarketPet('longwang'), registry)?.id).toBe('agentbro:astral-young-dragon-king')
  })

  it('does not match unrelated providers', () => {
    const registry = [
      { ...makeLocalPet('codex:longwang', 'longwang'), provider: 'codex' as const },
    ]

    expect(isMarketPetInstalled(makeMarketPet('longwang'), registry)).toBe(false)
  })
})
