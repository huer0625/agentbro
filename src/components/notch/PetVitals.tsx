import { useMemo } from 'react'
import './PetVitals.css'

interface PetVitalsProps {
  contextPressure: number
  energyLevel: number
  isWorking: boolean
  isIdle: boolean
  size: number
}

type PressureTier = 'none' | 'low' | 'medium' | 'high' | 'critical'
type EnergyTier = 'full' | 'good' | 'tired' | 'exhausted' | 'depleted'

function getPressureTier(pressure: number): PressureTier {
  if (pressure <= 50) return 'none'
  if (pressure <= 75) return 'low'
  if (pressure <= 85) return 'medium'
  if (pressure <= 92) return 'high'
  return 'critical'
}

function getEnergyTier(usage: number): EnergyTier {
  if (usage <= 20) return 'full'
  if (usage <= 50) return 'good'
  if (usage <= 75) return 'tired'
  if (usage <= 90) return 'exhausted'
  return 'depleted'
}

export function PetVitals({ contextPressure, energyLevel, isWorking, isIdle, size }: PetVitalsProps) {
  const pressureTier = useMemo(() => getPressureTier(contextPressure), [contextPressure])
  const energyTier = useMemo(() => getEnergyTier(energyLevel), [energyLevel])

  const showPressure = isWorking && pressureTier !== 'none'
  const showEnergy = isIdle && energyLevel > 0
  const showSweat = isWorking && (pressureTier === 'high' || pressureTier === 'critical')
  const showFlush = isWorking && (pressureTier === 'medium' || pressureTier === 'high' || pressureTier === 'critical')

  const flushIntensity = useMemo(() => {
    if (!showFlush) return 0
    if (pressureTier === 'medium') return 0.12
    if (pressureTier === 'high') return 0.22
    return 0.35
  }, [showFlush, pressureTier])

  const pressurePercent = Math.min(100, Math.max(0, contextPressure))
  const energyPercent = Math.min(100, Math.max(5, 100 - energyLevel))

  return (
    <div
      className="pet-vitals"
      style={{ width: size, height: size }}
      data-pressure={pressureTier}
      data-energy={energyTier}
    >
      {showFlush && (
        <div
          className="pet-vitals__flush"
          style={{ '--flush-intensity': flushIntensity } as React.CSSProperties}
        />
      )}

      {showPressure && (
        <div className="pet-vitals__pressure-bar" data-tier={pressureTier}>
          <div
            className="pet-vitals__pressure-fill"
            style={{ '--pressure-pct': pressurePercent } as React.CSSProperties}
          />
        </div>
      )}

      {showSweat && (
        <div className="pet-vitals__sweat" aria-hidden="true">
          <span className="pet-vitals__drop pet-vitals__drop--1" />
          <span className="pet-vitals__drop pet-vitals__drop--2" />
          {pressureTier === 'critical' && (
            <span className="pet-vitals__drop pet-vitals__drop--3" />
          )}
        </div>
      )}

      {showEnergy && (
        <div className="pet-vitals__energy" data-tier={energyTier}>
          <div
            className="pet-vitals__energy-fill"
            style={{ '--energy-pct': energyPercent } as React.CSSProperties}
          />
        </div>
      )}
    </div>
  )
}

