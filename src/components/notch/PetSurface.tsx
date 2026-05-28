import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import type { OverlayItem, SessionState } from '../../types/agent'
import { PRIORITY, computePriority, type Priority } from '../../types/priority'
import { useSessionStore, selectActiveOverlay } from '../../stores/sessionStore'
import {
  endPetDrag,
  isCursorInWindowZones,
  isTauri,
  jumpToTerminal,
  openSettingsWindow,
  respondAutoApprove,
  respondPermission,
  respondPlan,
  respondQuestion,
  sendMessage,
  setNotchIgnoreCursorEvents,
  startPetDrag,
} from '../../services/tauriApi'
import { useConfigStore } from '../../stores/configStore'
import { selectActivePet, usePetStore } from '../../stores/petStore'
import { getSessionTitle } from '../../utils/sessionDisplay'
import { isBlockingOverlay, isNonBlockingOverlay } from '../../utils/islandInteraction'
import { MascotRouter } from './mascots'
import { SpriteCanvas } from './SpriteCanvas'
import { PetVitals } from './PetVitals'
import { PetEmote } from './PetEmote'
import { HoverList } from './HoverList'
import { ChatView } from './ChatView'
import { PermissionCard } from '../overlay/PermissionCard'
import { PlanApprovalCard } from '../overlay/PlanApprovalCard'
import { QuestionCard } from '../overlay/QuestionCard'
import { OverlayResponseCard } from '../overlay/OverlayResponseCard'
import { OverlayCompletionCard } from '../overlay/OverlayCompletionCard'
import { OverlayCompactingCard } from '../overlay/OverlayCompactingCard'
import { usePetSummon } from './usePetSummon'
import './PetSurface.css'

type DragDirection = 'left' | 'right' | 'running' | null
type PetPanelHoverHandlers = {
  onPointerEnter: () => void
  onPointerLeave: () => void
}

interface PetSurfaceProps {
  sessions: SessionState[]
  scale: number
  hidden: boolean
  activeOverlay?: OverlayItem | null
  expanded?: boolean
  onCollapse?: () => void
  onDismissOverlay?: (overlayId: string) => void
}

const PET_DRAG_THRESHOLD = 4
const CODEX_PET_DONE_ANIMATION_MS = 1800
const PET_PANEL_AUTO_HIDE_DELAY_MS = 650
const PET_STAGE_WIDTH = 820
const PET_STAGE_HEIGHT = 360
const PET_SLOT_SIZE = 160
const PET_ANCHOR_RIGHT = 132
const PET_ANCHOR_BOTTOM = 44
const PET_MESSAGE_TOAST_WIDTH = 480
const PET_MESSAGE_TOAST_HEIGHT = 316
const PET_MESSAGE_TOAST_GAP = 14
const PET_MESSAGE_TOAST_MARGIN = 8

function clearPermissionAfter(sessionId: string, work: Promise<void>) {
  work
    .then(() => useSessionStore.getState().clearPermission(sessionId))
    .catch((error) => console.warn('[PetSurface] permission response failed:', error))
}

/**
 * Evolab-style pet companion for AgentBro's dedicated transparent Tauri window.
 * The pet remains a draggable desktop sprite, while short HUD surfaces bloom
 * around it for sessions, blocking actions, and lightweight completion notices.
 */
export function PetSurface({ sessions, scale, hidden }: PetSurfaceProps) {
  const [dragging, setDragging] = useState(false)
  const [dragDirection, setDragDirection] = useState<DragDirection>(null)
  const [hudOpen, setHudOpen] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [codexPetDoneUntil, setCodexPetDoneUntil] = useState(0)
  const [hasInputDraft, setHasInputDraft] = useState(false)
  const dragCandidateRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null)
  const dragPointerIdRef = useRef<number | null>(null)
  const dragLastScreenXRef = useRef<number | null>(null)
  const draggingRef = useRef(false)
  const suppressClickRef = useRef(false)
  const lastNoticeKeyRef = useRef<string | null>(null)
  const panelLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasInputDraftRef = useRef(false)
  const messageToastInsideRef = useRef(false)
  const messageDismissPendingRef = useRef<string | null>(null)

  const updateConfig = useConfigStore((s) => s.updateConfig)
  const taskCompleteDwellSeconds = useConfigStore((s) => s.taskCompleteDwellSeconds)
  const petVitalsEnabled = useConfigStore((s) => s.petVitalsEnabled)
  const petRegistry = usePetStore((s) => s.registry)
  const activePetId = usePetStore((s) => s.activePetId)
  const loadPetRegistry = usePetStore((s) => s.loadRegistry)
  const petLoading = usePetStore((s) => s.loading)
  const petError = usePetStore((s) => s.error)
  const activeOverlay = useSessionStore(selectActiveOverlay)
  const dismissOverlay = useSessionStore((s) => s.dismissOverlay)

  useDefensiveRegistryLoad(petRegistry.length, petLoading, petError, loadPetRegistry)

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => computePriority(b) - computePriority(a)),
    [sessions],
  )
  const visibleSessions = useMemo(() => sortedSessions.slice(0, 4), [sortedSessions])
  const selectedSession = useMemo(
    () => sortedSessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sortedSessions],
  )
  const topSession = sortedSessions[0]
  const activePet = useMemo(
    () => selectActivePet(petRegistry, activePetId, sessions),
    [petRegistry, activePetId, sessions],
  )
  const displayScale = Math.min(1.2, Math.max(0.5, scale / 100))
  const actionCount = useMemo(() => getPetActionCount(sessions, activeOverlay), [sessions, activeOverlay])
  const activeSessionCount = useMemo(
    () => sessions.filter((session) => session.phase !== 'idle' && session.phase !== 'done').length,
    [sessions],
  )
  const actionSession = useMemo(
    () => sortedSessions.find(sessionNeedsPetPrompt) ?? (isBlockingOverlay(activeOverlay) ? getOverlaySession(activeOverlay, sessions) : null),
    [activeOverlay, sessions, sortedSessions],
  )
  const blockingOverlaySession = useMemo(
    () => (activeOverlay && isBlockingOverlay(activeOverlay) ? getOverlaySession(activeOverlay, sessions) : null),
    [activeOverlay, sessions],
  )
  const showBlockingOverlay = !hidden && !hudOpen && Boolean(activeOverlay && isBlockingOverlay(activeOverlay) && blockingOverlaySession)
  const showActionToast = !hidden && !hudOpen && Boolean(actionSession || (activeOverlay && isBlockingOverlay(activeOverlay)))
  const showMessageToast = !hidden && !hudOpen && shouldShowPetMessageToast(activeOverlay, taskCompleteDwellSeconds)
  const messageToastPlacement = useMemo(
    () => getPetMessageToastPlacement(displayScale),
    [displayScale],
  )
  const showHud = !hidden && hudOpen

  useEffect(() => {
    hasInputDraftRef.current = hasInputDraft
  }, [hasInputDraft])

  useEffect(() => {
    if (hidden) {
      if (panelLeaveTimerRef.current) {
        window.clearTimeout(panelLeaveTimerRef.current)
        panelLeaveTimerRef.current = null
      }
      setHudOpen(false)
      setSelectedSessionId(null)
      setHasInputDraft(false)
      useSessionStore.getState().setActiveSession(null)
    }
  }, [hidden])

  useEffect(() => {
    if (selectedSessionId && !sortedSessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(null)
      useSessionStore.getState().setActiveSession(null)
    }
  }, [selectedSessionId, sortedSessions])

  const releaseMessageDismissHold = useCallback(() => {
    const overlayId = messageDismissPendingRef.current
    if (!overlayId) return
    if (messageToastInsideRef.current || hasInputDraftRef.current || petMessageToastHasFocusedEditable()) return

    messageDismissPendingRef.current = null
    const currentOverlay = useSessionStore.getState().activeOverlay
    if (currentOverlay?.id === overlayId && isNonBlockingOverlay(currentOverlay)) {
      dismissOverlay(overlayId)
    }
  }, [dismissOverlay])

  useEffect(() => {
    messageDismissPendingRef.current = null
    messageToastInsideRef.current = false
    if (!activeOverlay || !isNonBlockingOverlay(activeOverlay)) return
    const overlayId = activeOverlay.id
    const deadline = activeOverlay.createdAt + Math.max(1, taskCompleteDwellSeconds) * 1000
    const delay = Math.max(0, deadline - Date.now())
    const timer = window.setTimeout(() => {
      const currentOverlay = useSessionStore.getState().activeOverlay
      if (currentOverlay?.id === overlayId && isNonBlockingOverlay(currentOverlay)) {
        if (messageToastInsideRef.current || hasInputDraftRef.current || petMessageToastHasFocusedEditable()) {
          messageDismissPendingRef.current = overlayId
          return
        }
        useSessionStore.getState().dismissOverlay(overlayId)
      }
    }, delay)
    return () => window.clearTimeout(timer)
  }, [activeOverlay, dismissOverlay, taskCompleteDwellSeconds])

  useEffect(() => {
    const noticeKey = activeOverlay && isNonBlockingOverlay(activeOverlay)
      ? `${activeOverlay.type}:${activeOverlay.id}:${activeOverlay.createdAt}`
      : topSession?.phase === 'done'
        ? `done:${topSession.id}:${topSession.taskCompletedAt ?? topSession.duration}`
        : null
    if (!noticeKey || noticeKey === lastNoticeKeyRef.current) return
    lastNoticeKeyRef.current = noticeKey
    setCodexPetDoneUntil(Date.now() + CODEX_PET_DONE_ANIMATION_MS)
    const timer = window.setTimeout(() => {
      setCodexPetDoneUntil((current) => (current <= Date.now() ? 0 : current))
    }, CODEX_PET_DONE_ANIMATION_MS)
    return () => window.clearTimeout(timer)
  }, [activeOverlay, topSession?.duration, topSession?.id, topSession?.phase, topSession?.taskCompletedAt])

  useEffect(() => {
    if (!isTauri()) return
    if (hidden) {
      void setNotchIgnoreCursorEvents(true, 'pet').catch(() => {})
      return
    }

    let cancelled = false
    let inFlight = false
    let lastApplied: boolean | null = null
    let probeFailed = false

    const apply = (ignore: boolean) => {
      if (lastApplied === ignore) return
      lastApplied = ignore
      void setNotchIgnoreCursorEvents(ignore, 'pet').catch(() => {})
    }

    apply(false)

    const tick = async () => {
      if (cancelled || inFlight) return
      inFlight = true
      try {
        if (draggingRef.current) {
          apply(false)
          return
        }
        const zones = Array.from(document.querySelectorAll<HTMLElement>('.pet-surface__interactive'))
          .map((node) => node.getBoundingClientRect())
          .filter((rect) => rect.width > 0 && rect.height > 0)
          .map((rect) => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }))
        if (zones.length === 0) {
          apply(true)
          return
        }
        const isOver = await isCursorInWindowZones(zones, 'pet')
        probeFailed = false
        apply(!isOver)
      } catch (err) {
        if (!probeFailed) {
          probeFailed = true
          console.warn('[PetSurface] click-through probe failed, staying interactive:', err)
        }
        apply(false)
      } finally {
        inFlight = false
      }
    }

    const id = window.setInterval(tick, 250)
    void tick()
    return () => {
      cancelled = true
      window.clearInterval(id)
      void setNotchIgnoreCursorEvents(false, 'pet').catch(() => {})
    }
  }, [hidden, hudOpen, showActionToast, showBlockingOverlay, showMessageToast])

  const summon = usePetSummon({ activeOverlay, topSession })
  const dragAnimationOverride = useMemo(() => {
    switch (dragDirection) {
      case 'left':
        return ['running-left', 'runningLeft', 'running'] as const
      case 'right':
        return ['running-right', 'runningRight', 'running'] as const
      case 'running':
        return ['running', 'running-right', 'runningRight', 'running-left', 'runningLeft'] as const
      default:
        return null
    }
  }, [dragDirection])
  const animationOverride = dragAnimationOverride ?? summon.summonAnimationOverride ?? null
  const petPriority = getPetPriority({
    actionCount,
    activePetProvider: activePet?.provider,
    doneUntil: codexPetDoneUntil,
    topSession,
  })
  const contextPressure = topSession?.contextWindow?.usedPercentage ?? 0
  const energyLevel = useMemo(() => {
    const limits = sessions.map((s) => s.rateLimits?.fiveHourUsage ?? 0)
    return limits.length > 0 ? Math.max(...limits) : 0
  }, [sessions])
  const isWorking = topSession?.phase === 'processing'
  const isSessionIdle = !topSession || topSession.phase === 'idle' || topSession.phase === 'done'

  const finishDrag = useCallback(
    async (pointerId?: number) => {
      if (dragPointerIdRef.current == null) {
        dragCandidateRef.current = null
        return
      }
      if (pointerId != null && dragPointerIdRef.current !== pointerId) return
      dragPointerIdRef.current = null
      dragCandidateRef.current = null
      dragLastScreenXRef.current = null
      setDragging(false)
      draggingRef.current = false
      setDragDirection(null)
      try {
        const origin = await endPetDrag()
        if (origin) updateConfig('islandPetWindowOrigin', origin)
      } catch (err) {
        console.warn('[PetSurface] endPetDrag:', err)
      }
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
    },
    [updateConfig],
  )

  useEffect(() => {
    const finish = () => void finishDrag()
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    window.addEventListener('blur', finish)
    return () => {
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      window.removeEventListener('blur', finish)
    }
  }, [finishDrag])

  useEffect(() => {
    return () => {
      if (panelLeaveTimerRef.current) {
        window.clearTimeout(panelLeaveTimerRef.current)
        panelLeaveTimerRef.current = null
      }
    }
  }, [])

  const clearPanelLeaveTimer = useCallback(() => {
    if (!panelLeaveTimerRef.current) return
    window.clearTimeout(panelLeaveTimerRef.current)
    panelLeaveTimerRef.current = null
  }, [])

  const closeSessionPanel = useCallback(() => {
    if (draggingRef.current || hasInputDraftRef.current || petPanelHasFocusedEditable()) return
    setHudOpen(false)
    setSelectedSessionId(null)
    setHasInputDraft(false)
    useSessionStore.getState().setActiveSession(null)
  }, [])

  const panelHoverHandlers = useMemo<PetPanelHoverHandlers>(() => ({
    onPointerEnter: clearPanelLeaveTimer,
    onPointerLeave: () => {
      clearPanelLeaveTimer()
      panelLeaveTimerRef.current = window.setTimeout(() => {
        panelLeaveTimerRef.current = null
        closeSessionPanel()
      }, PET_PANEL_AUTO_HIDE_DELAY_MS)
    },
  }), [clearPanelLeaveTimer, closeSessionPanel])

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    dragCandidateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture can throw on synthetic events in tests.
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragPointerIdRef.current === event.pointerId) {
      const lastScreenX = dragLastScreenXRef.current
      if (lastScreenX != null) {
        updateDragDirection(event.screenX - lastScreenX, setDragDirection)
      }
      dragLastScreenXRef.current = event.screenX
      return
    }
    const candidate = dragCandidateRef.current
    if (!candidate || candidate.pointerId !== event.pointerId) return
    const signedDx = event.clientX - candidate.startX
    if (Math.hypot(signedDx, event.clientY - candidate.startY) < PET_DRAG_THRESHOLD) return
    suppressClickRef.current = true
    dragPointerIdRef.current = event.pointerId
    dragLastScreenXRef.current = event.screenX
    setDragging(true)
    draggingRef.current = true
    updateDragDirection(signedDx, setDragDirection)
    startPetDrag()
      .then((started) => {
        if (!started) {
          console.warn('[PetSurface] startPetDrag returned false - Rust drag loop did not arm')
        }
        if (!started && dragPointerIdRef.current === event.pointerId) {
          dragPointerIdRef.current = null
          dragLastScreenXRef.current = null
          setDragging(false)
          draggingRef.current = false
          setDragDirection(null)
        }
      })
      .catch((err) => {
        console.warn('[PetSurface] startPetDrag failed:', err)
        if (dragPointerIdRef.current === event.pointerId) {
          dragPointerIdRef.current = null
          dragLastScreenXRef.current = null
          setDragging(false)
          draggingRef.current = false
          setDragDirection(null)
        }
      })
  }

  const handlePetClick = (event: MouseEvent<HTMLButtonElement>) => {
    clearPanelLeaveTimer()
    if (suppressClickRef.current || dragging) {
      event.preventDefault()
      suppressClickRef.current = false
      return
    }
    setHudOpen((current) => {
      const next = !current
      if (!next) {
        setSelectedSessionId(null)
        setHasInputDraft(false)
        useSessionStore.getState().setActiveSession(null)
      }
      return next
    })
  }

  const openSessionInTerminal = (sessionId: string) => {
    void jumpToTerminal(sessionId).catch((err) => console.warn('[PetSurface] jumpToTerminal:', err))
  }

  const openSessionDetail = (sessionId: string) => {
    clearPanelLeaveTimer()
    setSelectedSessionId(sessionId)
    useSessionStore.getState().setActiveSession(sessionId)
    setHudOpen(true)
  }

  return (
    <div
      className="pet-surface"
      data-hidden={hidden ? 'true' : 'false'}
      data-hud-open={showHud ? 'true' : 'false'}
      style={{ '--pet-scale': displayScale } as CSSProperties}
    >
      <div className="pet-surface__stage">
        {showHud && (
          <PetSessionPanel
            sessions={visibleSessions}
            selectedSession={selectedSession}
            onBack={() => {
              setSelectedSessionId(null)
              setHasInputDraft(false)
              useSessionStore.getState().setActiveSession(null)
            }}
            onClose={() => {
              clearPanelLeaveTimer()
              setHudOpen(false)
              setSelectedSessionId(null)
              setHasInputDraft(false)
              useSessionStore.getState().setActiveSession(null)
            }}
            onJumpToTerminal={openSessionInTerminal}
            onSelectSession={openSessionDetail}
            onInputDraftStateChange={setHasInputDraft}
            hoverHandlers={panelHoverHandlers}
          />
        )}

        {showBlockingOverlay && activeOverlay && blockingOverlaySession && (
          <PetBlockingOverlay
            overlay={activeOverlay}
            session={blockingOverlaySession}
            sessionCount={sessions.length}
            onClose={() => dismissOverlay(activeOverlay.id)}
            onShowSessions={() => setHudOpen(true)}
          />
        )}

        {!showBlockingOverlay && showActionToast && (
          <PetActionToast
            actionCount={actionCount}
            overlay={activeOverlay}
            session={actionSession}
            onOpen={() => {
              if (actionSession) openSessionDetail(actionSession.id)
              else setHudOpen(true)
            }}
          />
        )}

        {showMessageToast && activeOverlay && (
          <PetMessageToast
            overlay={activeOverlay}
            session={getOverlaySession(activeOverlay, sessions) ?? topSession}
            onDismiss={() => dismissOverlay(activeOverlay.id)}
            onInputDraftStateChange={setHasInputDraft}
            onPointerEnter={() => {
              messageToastInsideRef.current = true
            }}
            onPointerLeave={() => {
              messageToastInsideRef.current = false
              releaseMessageDismissHold()
            }}
            onShowSessions={() => setHudOpen(true)}
            placement={messageToastPlacement}
            sessionCount={sessions.length}
          />
        )}

        <button
          type="button"
          className="pet-surface__pet pet-surface__interactive"
          data-dragging={dragging ? 'true' : 'false'}
          aria-label="Pet companion"
          onClick={handlePetClick}
          onContextMenu={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setHudOpen(false)
            void openSettingsWindow().catch((err) => {
              console.warn('[PetSurface] openSettingsWindow:', err)
            })
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => void finishDrag(event.pointerId)}
          onPointerCancel={(event) => void finishDrag(event.pointerId)}
        >
          <span className="pet-surface__sprite-shell" style={{ position: 'relative' }}>
            {activePet ? (
              <>
                <SpriteCanvas
                  pet={activePet}
                  priority={petPriority}
                  size={112}
                  animationOverride={animationOverride}
                  contextPressure={petVitalsEnabled ? contextPressure : 0}
                  energyLevel={petVitalsEnabled ? energyLevel : 0}
                />
                {petVitalsEnabled && (
                  <PetVitals
                    contextPressure={contextPressure}
                    energyLevel={energyLevel}
                    isWorking={isWorking}
                    isIdle={isSessionIdle}
                    size={112}
                  />
                )}
              </>
            ) : petLoading ? (
              <span className="pet-surface__loading" aria-hidden="true">
                ...
              </span>
            ) : (
              <MascotRouter
                toolType={topSession?.agentType ?? 'claude-code'}
                phase={topSession?.phase ?? 'idle'}
                size={112}
              />
            )}
            <PetStatusBadges actionCount={actionCount} sessionCount={activeSessionCount} />
          </span>
        </button>

        <PetEmote
          emote={summon.summonEmote}
          anchorTop={154}
          anchorLeft={448}
          key={summon.summonNonce}
        />
      </div>
    </div>
  )
}

function PetStatusBadges({ actionCount, sessionCount }: { actionCount: number; sessionCount: number }) {
  if (actionCount <= 0 && sessionCount <= 0) return null
  return (
    <span className="pet-surface__badges" aria-hidden="true">
      {sessionCount > 0 && <PetBadge count={sessionCount} tone="session" />}
      {actionCount > 0 && <PetBadge count={actionCount} tone="action" />}
    </span>
  )
}

function PetBadge({ count, tone }: { count: number; tone: 'action' | 'session' }) {
  return (
    <span className={`pet-surface__badge pet-surface__badge--${tone}`}>
      {count > 9 ? '9+' : count}
    </span>
  )
}

function PetSessionPanel({
  sessions,
  selectedSession,
  onBack,
  onClose,
  onJumpToTerminal,
  onSelectSession,
  onInputDraftStateChange,
  hoverHandlers,
}: {
  sessions: SessionState[]
  selectedSession: SessionState | null
  onBack: () => void
  onClose: () => void
  onJumpToTerminal: (sessionId: string) => void
  onSelectSession: (sessionId: string) => void
  onInputDraftStateChange: (hasDraft: boolean) => void
  hoverHandlers: PetPanelHoverHandlers
}) {
  if (selectedSession) {
    return (
      <PetSessionDetail
        onBack={onBack}
        onClose={onClose}
        onInputDraftStateChange={onInputDraftStateChange}
        hoverHandlers={hoverHandlers}
      />
    )
  }

  if (sessions.length === 0) {
    return (
      <button
        type="button"
        className="pet-surface__drawer pet-surface__drawer--empty pet-surface__interactive"
        onClick={onClose}
        {...hoverHandlers}
      >
        <span className="pet-surface__drawer-title">All quiet</span>
        <span className="pet-surface__drawer-preview">No active sessions.</span>
      </button>
    )
  }

  return (
    <section className="pet-surface__drawer pet-surface__drawer--sessions pet-surface__interactive" aria-label="Pet sessions" {...hoverHandlers}>
      <button type="button" className="pet-surface__icon-button pet-surface__icon-button--floating" aria-label="Close sessions" onClick={onClose}>
        x
      </button>
      <div className="pet-surface__hover-list">
        <HoverList
          sessions={sessions}
          onSessionClick={onSelectSession}
          onJumpToTerminal={onJumpToTerminal}
          onInputDraftStateChange={onInputDraftStateChange}
          hideBrandFooter
        />
      </div>
    </section>
  )
}

function PetSessionDetail({
  onBack,
  onClose,
  onInputDraftStateChange,
  hoverHandlers,
}: {
  onBack: () => void
  onClose: () => void
  onInputDraftStateChange: (hasDraft: boolean) => void
  hoverHandlers: PetPanelHoverHandlers
}) {
  return (
    <section className="pet-surface__drawer pet-surface__drawer--detail pet-surface__interactive" aria-label="Pet session detail" {...hoverHandlers}>
      <button type="button" className="pet-surface__icon-button pet-surface__icon-button--floating" aria-label="Close session detail" onClick={onClose}>
        x
      </button>
      <ChatView onBack={onBack} onInputDraftStateChange={onInputDraftStateChange} />
    </section>
  )
}

function PetBlockingOverlay({
  overlay,
  session,
  sessionCount,
  onClose,
  onShowSessions,
}: {
  overlay: OverlayItem
  session: SessionState
  sessionCount: number
  onClose: () => void
  onShowSessions: () => void
}) {
  const showSessions = sessionCount > 1 ? onShowSessions : undefined

  return (
    <section className="pet-surface__overlay pet-surface__interactive" aria-label="Pet action prompt" data-overlay-type={overlay.type}>
      {overlay.type === 'permission' && (
        <PermissionCard
          overlay={overlay}
          session={session}
          onAllow={() => { clearPermissionAfter(session.id, respondPermission(session.id, true)) }}
          onAllowAlways={() => { clearPermissionAfter(session.id, respondPermission(session.id, true, true)) }}
          onAutoApprove={() => { clearPermissionAfter(session.id, respondAutoApprove(session.id)) }}
          onDeny={(message?: string) => {
            if (message) void sendMessage(session.id, message).catch((error) => console.warn('[PetSurface] deny feedback:', error))
            clearPermissionAfter(session.id, respondPermission(session.id, false))
          }}
          onDismiss={onClose}
          onShowSessions={showSessions}
          sessionCount={sessionCount}
        />
      )}

      {overlay.type === 'question' && (
        <QuestionCard
          overlay={overlay}
          session={session}
          onAnswer={(answer) => {
            respondQuestion(session.id, answer)
              .then(() => useSessionStore.getState().clearQuestion(session.id))
              .catch((error) => console.warn('[PetSurface] respondQuestion:', error))
          }}
          onDismiss={onClose}
          onShowSessions={showSessions}
          sessionCount={sessionCount}
        />
      )}

      {overlay.type === 'plan' && (
        <PlanApprovalCard
          overlay={overlay}
          session={session}
          onSendFeedback={(message) => {
            respondPlan(session.id, 'feedback', message)
            useSessionStore.getState().clearPlan(session.id)
            onClose()
          }}
          onManualReview={() => {
            respondPlan(session.id, 'manual')
            useSessionStore.getState().clearPlan(session.id)
            onClose()
          }}
          onAcceptEdits={() => {
            respondPlan(session.id, 'acceptEdits')
            useSessionStore.getState().clearPlan(session.id)
            onClose()
          }}
          onAutoApprove={() => {
            respondPlan(session.id, 'bypassPermissions')
            useSessionStore.getState().clearPlan(session.id)
            onClose()
          }}
          onJumpToTerminal={() => jumpToTerminal(session.id).catch((error) => console.warn('[PetSurface] jumpToTerminal:', error))}
          onDismiss={onClose}
          onShowSessions={showSessions}
          sessionCount={sessionCount}
        />
      )}
    </section>
  )
}

function PetActionToast({
  actionCount,
  overlay,
  session,
  onOpen,
}: {
  actionCount: number
  overlay: OverlayItem | null
  session: SessionState | null | undefined
  onOpen: () => void
}) {
  const kind = overlay && isBlockingOverlay(overlay) ? overlay.type : getSessionPendingKind(session)
  return (
    <button type="button" className="pet-surface__toast pet-surface__toast--action pet-surface__interactive" onClick={onOpen}>
      <span className="pet-surface__toast-kicker">{formatActionKind(kind)}{actionCount > 1 ? ` · ${actionCount}` : ''}</span>
      <span className="pet-surface__toast-title">{session ? getSessionTitle(session) : 'Needs attention'}</span>
      <span className="pet-surface__toast-preview">{session ? getSessionPreview(session) : getOverlayPreview(overlay)}</span>
    </button>
  )
}

function PetMessageToast({
  overlay,
  session,
  onDismiss,
  onInputDraftStateChange,
  onPointerEnter,
  onPointerLeave,
  onShowSessions,
  placement,
  sessionCount,
}: {
  overlay: OverlayItem
  session: SessionState | null | undefined
  onDismiss: () => void
  onInputDraftStateChange: (hasDraft: boolean) => void
  onPointerEnter: () => void
  onPointerLeave: () => void
  onShowSessions: () => void
  placement: PetMessageToastPlacement
  sessionCount: number
}) {
  if (!session) return null

  const showSessions = sessionCount > 1 ? onShowSessions : undefined
  const jumpToSessionTerminal = () => {
    void jumpToTerminal(session.id).catch((error) => console.warn('[PetSurface] jumpToTerminal:', error))
  }

  return (
    <section
      className="pet-surface__toast pet-surface__toast--message pet-surface__interactive"
      data-placement={placement.placement}
      style={{
        '--pet-toast-left': `${placement.left}px`,
        '--pet-toast-top': `${placement.top}px`,
      } as CSSProperties}
      aria-label="Pet message notification"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {overlay.type === 'response' && (
        <OverlayResponseCard
          overlay={overlay}
          session={session}
          onJumpToTerminal={jumpToSessionTerminal}
          onShowSessions={showSessions}
          onDismiss={onDismiss}
          onDraftStateChange={onInputDraftStateChange}
          sessionCount={sessionCount}
        />
      )}
      {overlay.type === 'completion' && (
        <OverlayCompletionCard
          overlay={overlay}
          session={session}
          onJumpToTerminal={jumpToSessionTerminal}
          onShowSessions={showSessions}
          onDismiss={onDismiss}
          onDraftStateChange={onInputDraftStateChange}
          sessionCount={sessionCount}
        />
      )}
      {overlay.type === 'compacting' && (
        <OverlayCompactingCard
          overlay={overlay}
          session={session}
          onJumpToTerminal={jumpToSessionTerminal}
          onShowSessions={showSessions}
          onDismiss={onDismiss}
          sessionCount={sessionCount}
        />
      )}
    </section>
  )
}

type PetMessageToastPlacement = {
  placement: 'top' | 'left' | 'right'
  left: number
  top: number
}

function getPetMessageToastPlacement(scale: number): PetMessageToastPlacement {
  const petSize = PET_SLOT_SIZE * scale
  const petLeft = PET_STAGE_WIDTH - PET_ANCHOR_RIGHT - petSize
  const petRight = PET_STAGE_WIDTH - PET_ANCHOR_RIGHT
  const petTop = PET_STAGE_HEIGHT - PET_ANCHOR_BOTTOM - petSize
  const petCenterX = petLeft + petSize / 2
  const petCenterY = petTop + petSize / 2

  const topLeft = clamp(
    petCenterX - PET_MESSAGE_TOAST_WIDTH / 2,
    PET_MESSAGE_TOAST_MARGIN,
    PET_STAGE_WIDTH - PET_MESSAGE_TOAST_WIDTH - PET_MESSAGE_TOAST_MARGIN,
  )
  const topTop = petTop - PET_MESSAGE_TOAST_HEIGHT - PET_MESSAGE_TOAST_GAP
  if (topTop >= PET_MESSAGE_TOAST_MARGIN) {
    return { placement: 'top', left: topLeft, top: topTop }
  }

  const sideTop = clamp(
    petCenterY - PET_MESSAGE_TOAST_HEIGHT / 2,
    PET_MESSAGE_TOAST_MARGIN,
    PET_STAGE_HEIGHT - PET_MESSAGE_TOAST_HEIGHT - PET_MESSAGE_TOAST_MARGIN,
  )
  const leftLeft = petLeft - PET_MESSAGE_TOAST_WIDTH - PET_MESSAGE_TOAST_GAP
  if (leftLeft >= PET_MESSAGE_TOAST_MARGIN) {
    return { placement: 'left', left: leftLeft, top: sideTop }
  }

  const rightLeft = petRight + PET_MESSAGE_TOAST_GAP
  if (rightLeft + PET_MESSAGE_TOAST_WIDTH <= PET_STAGE_WIDTH - PET_MESSAGE_TOAST_MARGIN) {
    return { placement: 'right', left: rightLeft, top: sideTop }
  }

  return { placement: 'left', left: topLeft, top: sideTop }
}

function getPetPriority({
  actionCount,
  activePetProvider,
  doneUntil,
  topSession,
}: {
  actionCount: number
  activePetProvider: string | undefined
  doneUntil: number
  topSession: SessionState | undefined
}): Priority {
  const base = topSession ? computePriority(topSession) : PRIORITY.idle
  if (activePetProvider !== 'codex') return base
  if (actionCount > 0 || topSession?.phase === 'waiting_approval' || topSession?.phase === 'waiting_input') {
    return PRIORITY.attention
  }
  if (topSession?.phase === 'error') return PRIORITY.error
  if (doneUntil > Date.now()) return PRIORITY.done
  return PRIORITY.idle
}

function getPetActionCount(sessions: SessionState[], activeOverlay: OverlayItem | null): number {
  const sessionCount = sessions.filter(sessionNeedsPetPrompt).length
  const overlayAddsAction = Boolean(
    activeOverlay
    && isBlockingOverlay(activeOverlay)
    && !sessions.some((session) => session.id === activeOverlay.sessionId && sessionNeedsPetPrompt(session)),
  )
  return sessionCount + (overlayAddsAction ? 1 : 0)
}

function petPanelHasFocusedEditable(): boolean {
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return false
  const panel = active.closest('.pet-surface__drawer--sessions, .pet-surface__drawer--detail')
  return Boolean(panel && active.closest('input, textarea, select, [contenteditable="true"]'))
}

function petMessageToastHasFocusedEditable(): boolean {
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return false
  const toast = active.closest('.pet-surface__toast--message')
  return Boolean(toast && active.closest('input, textarea, select, [contenteditable="true"]'))
}

function sessionNeedsPetPrompt(session: SessionState): boolean {
  return session.phase === 'waiting_approval'
    || session.phase === 'waiting_input'
    || session.phase === 'error'
    || Boolean(session.pendingPermission)
    || Boolean(session.pendingQuestion)
    || Boolean(session.planTitle || session.planContent)
}

function shouldShowPetMessageToast(overlay: OverlayItem | null, dwellSeconds: number): boolean {
  if (!overlay || !isNonBlockingOverlay(overlay) || overlay.suppressed) return false
  return Date.now() - overlay.createdAt <= Math.max(1, dwellSeconds) * 1000
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getOverlaySession(overlay: OverlayItem | null, sessions: SessionState[]): SessionState | null {
  if (!overlay) return null
  return sessions.find((session) => session.id === overlay.sessionId) ?? null
}

function getSessionPendingKind(session: SessionState | null | undefined): 'permission' | 'question' | 'plan' | null {
  if (!session) return null
  if (session.pendingPermission) return 'permission'
  if (session.pendingQuestion) return 'question'
  if (session.planTitle || session.planContent) return 'plan'
  return null
}

function getSessionPreview(session: SessionState): string {
  if (session.pendingPermission?.toolName) return `${session.pendingPermission.toolName} approval`
  if (session.pendingQuestion?.question) return session.pendingQuestion.question
  if (session.planTitle) return session.planTitle
  if (session.lastToolName) return session.lastToolTarget ? `${session.lastToolName}: ${session.lastToolTarget}` : session.lastToolName
  if (session.description) return session.description.split('\n')[0]
  if (session.lastUserMessage) return session.lastUserMessage
  if (session.responseText) return session.responseText
  return formatPhase(session.phase)
}

function getOverlayPreview(overlay: OverlayItem | null): string {
  const data = overlay?.data as Record<string, unknown> | undefined
  const fields = ['summary', 'message', 'title', 'question', 'text', 'content']
  const value = fields.map((field) => data?.[field]).find((item): item is string => typeof item === 'string' && item.trim().length > 0)
  if (value) return value
  return overlay ? formatActionKind(overlay.type) : ''
}

function formatActionKind(kind: string | null | undefined): string {
  switch (kind) {
    case 'permission':
      return 'Approval'
    case 'question':
      return 'Question'
    case 'plan':
      return 'Plan'
    case 'completion':
      return 'Done'
    case 'response':
      return 'Response'
    case 'compacting':
      return 'Compacting'
    default:
      return 'Attention'
  }
}

function formatPhase(phase: SessionState['phase']): string {
  switch (phase) {
    case 'ready':
      return 'Ready'
    case 'idle':
      return 'Idle'
    case 'processing':
      return 'Working'
    case 'waiting_approval':
      return 'Needs approval'
    case 'waiting_input':
      return 'Waiting for input'
    case 'compacting':
      return 'Compacting'
    case 'done':
      return 'Done'
    case 'error':
      return 'Error'
    case 'interrupted':
      return 'Interrupted'
    default:
      return phase
  }
}

function updateDragDirection(deltaX: number, setDirection: (direction: DragDirection) => void): void {
  if (Math.abs(deltaX) < 2) {
    setDirection('running')
    return
  }
  setDirection(deltaX > 0 ? 'right' : 'left')
}

function useDefensiveRegistryLoad(
  registrySize: number,
  loading: boolean,
  error: string | null,
  loadRegistry: () => Promise<void>,
) {
  const triggered = useRef(false)
  useEffect(() => {
    if (triggered.current || registrySize !== 0 || loading || error) return
    triggered.current = true
    void loadRegistry()
  }, [error, loadRegistry, loading, registrySize])
}
