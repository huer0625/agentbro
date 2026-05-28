import { create } from 'zustand'

interface PetVitalsDebugState {
  enabled: boolean
  contextPressure: number
  energyLevel: number
  phaseOverride: string | null
  setEnabled: (enabled: boolean) => void
  setValues: (pressure: number, energy: number) => void
  setPhaseOverride: (phase: string | null) => void
}

const baseState = {
  enabled: false,
  contextPressure: 0,
  energyLevel: 0,
  phaseOverride: null,
}

export const usePetVitalsDebug = create<PetVitalsDebugState>((set) => ({
  ...baseState,
  setEnabled: (enabled) => set({ enabled }),
  setValues: (contextPressure, energyLevel) => set({ contextPressure, energyLevel }),
  setPhaseOverride: (phaseOverride) => set({ phaseOverride }),
}))

if (!import.meta.env.DEV) {
  usePetVitalsDebug.setState({
    ...baseState,
    setEnabled: () => undefined,
    setValues: () => undefined,
    setPhaseOverride: () => undefined,
  })
}
