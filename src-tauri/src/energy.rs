use crate::hooks::session_store::{SessionPhase, SessionState};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EnergyMode {
    Active,
    IdleVisible,
    QuietBackground,
}

pub fn mode_for_sessions(sessions: &[SessionState]) -> EnergyMode {
    if sessions
        .iter()
        .any(|session| session.phase.needs_attention() || session.phase.is_active())
    {
        return EnergyMode::Active;
    }
    if sessions.iter().any(|session| {
        !matches!(
            session.phase,
            SessionPhase::Done | SessionPhase::Interrupted
        )
    }) {
        return EnergyMode::IdleVisible;
    }
    EnergyMode::QuietBackground
}

pub fn interval_seconds(
    mode: EnergyMode,
    configured_seconds: u32,
    active_min_seconds: u64,
    idle_min_seconds: u64,
    quiet_min_seconds: u64,
) -> u64 {
    let configured = configured_seconds.clamp(1, 3600) as u64;
    match mode {
        EnergyMode::Active => configured.max(active_min_seconds),
        EnergyMode::IdleVisible => configured.max(idle_min_seconds),
        EnergyMode::QuietBackground => configured.max(quiet_min_seconds),
    }
}

#[cfg(test)]
mod tests {
    use super::{interval_seconds, mode_for_sessions, EnergyMode};
    use crate::hooks::session_store::{SessionPhase, SessionState};

    fn session(phase: SessionPhase) -> SessionState {
        let mut session = SessionState::new(
            "s1".to_string(),
            "codex".to_string(),
            "proj".to_string(),
            "/tmp/proj".to_string(),
            "Terminal".to_string(),
        );
        session.phase = phase;
        session
    }

    #[test]
    fn classifies_active_attention_idle_and_quiet_sessions() {
        assert_eq!(
            mode_for_sessions(&[session(SessionPhase::WaitingInput)]),
            EnergyMode::Active
        );
        assert_eq!(
            mode_for_sessions(&[session(SessionPhase::Processing)]),
            EnergyMode::Active
        );
        assert_eq!(
            mode_for_sessions(&[session(SessionPhase::Idle)]),
            EnergyMode::IdleVisible
        );
        assert_eq!(
            mode_for_sessions(&[session(SessionPhase::Done)]),
            EnergyMode::QuietBackground
        );
    }

    #[test]
    fn applies_mode_specific_interval_floors() {
        assert_eq!(interval_seconds(EnergyMode::Active, 15, 15, 60, 300), 15);
        assert_eq!(
            interval_seconds(EnergyMode::IdleVisible, 15, 15, 60, 300),
            60
        );
        assert_eq!(
            interval_seconds(EnergyMode::QuietBackground, 15, 15, 60, 300),
            300
        );
    }
}
