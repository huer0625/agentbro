pub const HOOK_SOCKET_ENV: &str = "AGENTBRO_HOOK_SOCKET";
pub const HOOK_PORT_ENV: &str = "AGENTBRO_HOOK_PORT";

const RELEASE_TCP_PORT: u16 = 17894;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HookEndpoint {
    pub socket_path: String,
    pub tcp_port: u16,
}

impl HookEndpoint {
    pub fn tcp_addr(&self) -> String {
        format!("127.0.0.1:{}", self.tcp_port)
    }
}

pub fn current() -> HookEndpoint {
    HookEndpoint {
        socket_path: std::env::var(HOOK_SOCKET_ENV)
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(default_socket_path),
        tcp_port: std::env::var(HOOK_PORT_ENV)
            .ok()
            .and_then(|value| value.parse::<u16>().ok())
            .filter(|port| *port != 0)
            .unwrap_or_else(default_tcp_port),
    }
}

pub fn default_socket_path() -> String {
    format!("/tmp/agentbro-{}.sock", current_uid())
}

pub fn default_tcp_port() -> u16 {
    RELEASE_TCP_PORT
}

fn current_uid() -> u32 {
    #[cfg(unix)]
    {
        unsafe { libc::getuid() as u32 }
    }
    #[cfg(not(unix))]
    {
        0
    }
}
