fn main() {
    println!("cargo:rerun-if-env-changed=AGENTBRO_TELEMETRY_SLS_HOST");
    println!("cargo:rerun-if-env-changed=AGENTBRO_TELEMETRY_SLS_PROJECT");
    println!("cargo:rerun-if-env-changed=AGENTBRO_TELEMETRY_SLS_LOGSTORE");
    tauri_build::build()
}
