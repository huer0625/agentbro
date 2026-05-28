// AgentAdapter trait — implemented by each supported AI coding tool

use super::{AdapterStatus, AgentEvent};
use std::path::PathBuf;

pub trait AgentAdapter: Send + Sync + 'static {
    fn name(&self) -> &str;
    fn display_name(&self) -> &str;
    fn icon(&self) -> &str;
    fn install_hooks(&self) -> Result<(), Box<dyn std::error::Error>>;
    fn remove_hooks(&self) -> Result<(), Box<dyn std::error::Error>>;
    fn status(&self) -> AdapterStatus;
    fn parse_event(
        &self,
        raw: &serde_json::Value,
    ) -> Result<AgentEvent, Box<dyn std::error::Error>>;
    fn hook_config_paths(&self) -> Vec<PathBuf>;
    fn hooks_installed(&self) -> bool {
        self.hook_config_paths()
            .iter()
            .any(|path| super::hook_manager::has_agentbro_hooks(path))
    }

    /// Re-check whether the underlying CLI / app is currently installed,
    /// bypassing the value cached in `status()` at adapter construction time.
    ///
    /// Used by install entry points to refuse writing hook configuration into
    /// the home directory of a tool the user has not actually installed. The
    /// default implementation falls back to the cached status; each adapter
    /// should override to re-run its own `which`/path probe.
    fn detect_status_now(&self) -> AdapterStatus {
        self.status()
    }
}
