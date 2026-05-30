// Sound Engine — Synthesized 8-bit notification sounds via rodio
// Generates simple sine/square wave beeps for agent session events.

use chrono::Timelike;
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink, Source};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufReader, Cursor, Read};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const SPAM_THRESHOLD: usize = 3;
const SPAM_WINDOW: Duration = Duration::from_secs(10);
const LEGACY_CHIME_BUILTIN_ID: &str = concat!("p", "i", "n", "g");

/// Sound events that map to agent lifecycle phases
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SoundEvent {
    SessionStart,
    SessionEnd,
    TaskComplete,
    TaskError,
    NeedsApproval,
    TaskConfirmation,
    PlanApproval,
    ContextLimit,
    Boot,
}

impl SoundEvent {
    pub fn from_id(id: &str) -> Option<Self> {
        match id {
            "session-start" | "session_start" => Some(Self::SessionStart),
            "sessionStart" => Some(Self::SessionStart),
            "session-end" | "session_end" => Some(Self::SessionEnd),
            "session-error" | "session_error" | "error" => Some(Self::TaskError),
            "permission-request" | "permission_request" | "permission" => Some(Self::NeedsApproval),
            "question-asked" | "question_asked" | "question" => Some(Self::TaskConfirmation),
            "task-complete" | "task_complete" | "complete" => Some(Self::TaskComplete),
            "plan-approval" | "plan_approval" | "plan" => Some(Self::PlanApproval),
            "resource" => Some(Self::ContextLimit),
            "context-compact" | "context_compact" | "context-limit" | "context_limit" => {
                Some(Self::ContextLimit)
            }
            "token-limit" | "token_limit" => Some(Self::ContextLimit),
            "boot" => Some(Self::Boot),
            _ => None,
        }
    }

    pub fn id(&self) -> &'static str {
        match self {
            Self::SessionStart => "session-start",
            Self::SessionEnd => "session-end",
            Self::TaskComplete => "task-complete",
            Self::TaskError => "session-error",
            Self::NeedsApproval => "permission-request",
            Self::TaskConfirmation => "question-asked",
            Self::PlanApproval => "plan-approval",
            Self::ContextLimit => "context-compact",
            Self::Boot => "boot",
        }
    }

    fn cesp_categories(&self) -> &'static [&'static str] {
        match self {
            Self::SessionStart => &["task.acknowledge", "session.start"],
            Self::SessionEnd => &["task.complete", "session.end"],
            Self::TaskComplete => &["task.complete"],
            Self::TaskError => &["task.error"],
            Self::NeedsApproval => &["input.required"],
            Self::TaskConfirmation => &["input.required"],
            Self::PlanApproval => &["input.required"],
            Self::ContextLimit => &["resource.limit"],
            Self::Boot => &["session.start", "task.acknowledge"],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundPackImportedSound {
    pub id: String,
    pub name: String,
    pub path: String,
    pub event_id: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundPackAppliedRule {
    pub event_id: String,
    pub sound_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundPackImportResult {
    pub name: String,
    pub display_name: String,
    pub version: Option<String>,
    pub root_path: String,
    pub imported_sounds: Vec<SoundPackImportedSound>,
    pub applied_rules: Vec<SoundPackAppliedRule>,
}

#[derive(Debug, Deserialize)]
struct OpenPeonSoundEntry {
    file: String,
    label: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenPeonCategoryManifest {
    sounds: Vec<OpenPeonSoundEntry>,
}

#[derive(Debug, Deserialize)]
struct OpenPeonManifest {
    #[serde(rename = "cesp_version")]
    cesp_version: String,
    name: String,
    #[serde(rename = "display_name")]
    display_name: Option<String>,
    version: Option<String>,
    categories: HashMap<String, OpenPeonCategoryManifest>,
}

pub fn import_openpeon_sound_pack(
    root: &Path,
    destination_dir: &Path,
) -> Result<SoundPackImportResult, String> {
    let root = root
        .canonicalize()
        .map_err(|e| format!("Failed to read sound pack directory: {e}"))?;
    if !root.is_dir() {
        return Err("Sound pack path is not a directory".to_string());
    }

    let manifest_path = root.join("openpeon.json");
    let manifest_bytes =
        fs::read(&manifest_path).map_err(|e| format!("Failed to read openpeon.json: {e}"))?;
    let manifest: OpenPeonManifest = serde_json::from_slice(&manifest_bytes)
        .map_err(|e| format!("Invalid openpeon.json: {e}"))?;
    if !manifest.cesp_version.trim().starts_with("1.") {
        return Err("Unsupported CESP sound pack version".to_string());
    }

    fs::create_dir_all(destination_dir).map_err(|e| format!("Failed to create sounds dir: {e}"))?;

    let pack_label = manifest
        .display_name
        .as_deref()
        .unwrap_or(&manifest.name)
        .trim()
        .to_string();
    let pack_label = if pack_label.is_empty() {
        "Sound Pack".to_string()
    } else {
        pack_label
    };

    let events = [
        SoundEvent::SessionStart,
        SoundEvent::SessionEnd,
        SoundEvent::TaskComplete,
        SoundEvent::TaskError,
        SoundEvent::NeedsApproval,
        SoundEvent::TaskConfirmation,
        SoundEvent::PlanApproval,
        SoundEvent::ContextLimit,
        SoundEvent::Boot,
    ];
    let mut imported_sounds = Vec::new();
    let mut imported_by_category: HashMap<String, SoundPackImportedSound> = HashMap::new();

    for event in events {
        for category in event.cesp_categories() {
            if imported_by_category.contains_key(*category) {
                continue;
            }
            if let Some(sound) = import_category_sound(
                &root,
                destination_dir,
                &pack_label,
                event,
                category,
                &manifest,
            )? {
                imported_by_category.insert((*category).to_string(), sound.clone());
                imported_sounds.push(sound);
            }
        }
    }

    let mut applied_rules = Vec::new();
    for event in events {
        if let Some(sound) = event
            .cesp_categories()
            .iter()
            .find_map(|category| imported_by_category.get(*category))
        {
            applied_rules.push(SoundPackAppliedRule {
                event_id: event.id().to_string(),
                sound_id: sound.id.clone(),
            });
            if event == SoundEvent::ContextLimit {
                applied_rules.push(SoundPackAppliedRule {
                    event_id: "token-limit".to_string(),
                    sound_id: sound.id.clone(),
                });
            }
        }
    }

    if applied_rules.is_empty() {
        return Err("Sound pack does not contain supported event sounds".to_string());
    }

    Ok(SoundPackImportResult {
        name: manifest.name,
        display_name: pack_label,
        version: manifest.version,
        root_path: root.to_string_lossy().to_string(),
        imported_sounds,
        applied_rules,
    })
}

fn import_category_sound(
    root: &Path,
    destination_dir: &Path,
    pack_label: &str,
    event: SoundEvent,
    category: &str,
    manifest: &OpenPeonManifest,
) -> Result<Option<SoundPackImportedSound>, String> {
    let Some(category_manifest) = manifest.categories.get(category) else {
        return Ok(None);
    };

    for entry in &category_manifest.sounds {
        let Some(source) = resolve_pack_sound_path(root, &entry.file)? else {
            continue;
        };
        let Some(ext) = supported_pack_audio_extension(&source) else {
            continue;
        };
        if !has_valid_audio_magic(&source, ext) {
            continue;
        }

        let id = uuid::Uuid::new_v4().to_string();
        let dest = destination_dir.join(format!("{id}.{ext}"));
        fs::copy(&source, &dest).map_err(|e| format!("Failed to import sound: {e}"))?;

        let label = entry
            .label
            .as_deref()
            .map(str::trim)
            .filter(|label| !label.is_empty())
            .map(ToOwned::to_owned)
            .or_else(|| {
                source
                    .file_stem()
                    .and_then(|name| name.to_str())
                    .map(|name| name.replace(['-', '_'], " "))
            })
            .unwrap_or_else(|| category.to_string());

        return Ok(Some(SoundPackImportedSound {
            id,
            name: format!("{pack_label} - {label}"),
            path: dest.to_string_lossy().to_string(),
            event_id: event.id().to_string(),
            category: category.to_string(),
        }));
    }

    Ok(None)
}

fn resolve_pack_sound_path(root: &Path, file: &str) -> Result<Option<PathBuf>, String> {
    let Ok(resolved) = root.join(file).canonicalize() else {
        return Ok(None);
    };
    if resolved == root || resolved.starts_with(root) {
        Ok(Some(resolved))
    } else {
        Err("Sound pack file points outside the pack directory".to_string())
    }
}

fn supported_pack_audio_extension(path: &Path) -> Option<&'static str> {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("mp3") => Some("mp3"),
        Some("wav") => Some("wav"),
        Some("ogg") => Some("ogg"),
        Some("flac") => Some("flac"),
        _ => None,
    }
}

fn has_valid_audio_magic(path: &Path, ext: &str) -> bool {
    let Ok(mut file) = File::open(path) else {
        return false;
    };
    let mut bytes = [0_u8; 12];
    let Ok(count) = file.read(&mut bytes) else {
        return false;
    };
    let bytes = &bytes[..count];

    match ext {
        "wav" => bytes.starts_with(b"RIFF"),
        "ogg" => bytes.starts_with(b"OggS"),
        "flac" => bytes.starts_with(b"fLaC"),
        "mp3" => {
            bytes.starts_with(b"ID3")
                || bytes
                    .get(0..2)
                    .map(|pair| pair[0] == 0xFF && (pair[1] & 0xE0) == 0xE0)
                    .unwrap_or(false)
        }
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_test_dir(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("agentbro-{name}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&path).unwrap();
        path
    }

    fn write_wav(path: &Path) {
        fs::write(path, b"RIFF0000WAVEfmt ").unwrap();
    }

    #[test]
    fn normalizes_legacy_chime_builtin_choice() {
        let choice = concat!("builtin:", "p", "i", "n", "g");
        assert_eq!(builtin_sound_id(choice), Some("chime"));
    }

    #[test]
    fn imports_openpeon_pack_and_maps_events() {
        let root = temp_test_dir("sound-pack-root");
        let dest = temp_test_dir("sound-pack-dest");
        write_wav(&root.join("session-start.wav"));
        write_wav(&root.join("attention.wav"));
        write_wav(&root.join("complete.wav"));
        write_wav(&root.join("error.wav"));
        write_wav(&root.join("limit.wav"));
        fs::write(
            root.join("openpeon.json"),
            r#"{
              "cesp_version": "1.0",
              "name": "my-pack",
              "display_name": "My Pack",
              "version": "0.1.0",
              "categories": {
                "task.acknowledge": { "sounds": [{ "file": "session-start.wav", "label": "Session Start" }] },
                "input.required": { "sounds": [{ "file": "attention.wav", "label": "Attention" }] },
                "task.complete": { "sounds": [{ "file": "complete.wav", "label": "Complete" }] },
                "task.error": { "sounds": [{ "file": "error.wav", "label": "Error" }] },
                "resource.limit": { "sounds": [{ "file": "limit.wav", "label": "Limit" }] }
              }
            }"#,
        )
        .unwrap();

        let result = import_openpeon_sound_pack(&root, &dest).unwrap();

        assert_eq!(result.display_name, "My Pack");
        assert_eq!(result.imported_sounds.len(), 5);
        assert!(result
            .imported_sounds
            .iter()
            .all(|sound| Path::new(&sound.path).exists()));
        assert!(result
            .applied_rules
            .iter()
            .any(|rule| rule.event_id == "session-start"));
        assert!(result
            .applied_rules
            .iter()
            .any(|rule| rule.event_id == "token-limit"));

        let approval = result
            .applied_rules
            .iter()
            .find(|rule| rule.event_id == "permission-request")
            .unwrap()
            .sound_id
            .clone();
        let question = result
            .applied_rules
            .iter()
            .find(|rule| rule.event_id == "question-asked")
            .unwrap()
            .sound_id
            .clone();
        assert_eq!(approval, question);

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(dest);
    }

    #[test]
    fn rejects_pack_files_outside_root() {
        let root = temp_test_dir("sound-pack-root");
        let dest = temp_test_dir("sound-pack-dest");
        let outside = temp_test_dir("sound-pack-outside");
        write_wav(&outside.join("escape.wav"));
        fs::write(
            root.join("openpeon.json"),
            format!(
                r#"{{
                  "cesp_version": "1.0",
                  "name": "bad-pack",
                  "categories": {{
                    "task.acknowledge": {{ "sounds": [{{ "file": "../{}/escape.wav" }}] }}
                  }}
                }}"#,
                outside.file_name().unwrap().to_string_lossy()
            ),
        )
        .unwrap();

        let err = import_openpeon_sound_pack(&root, &dest).unwrap_err();
        assert!(err.contains("outside"));

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(dest);
        let _ = fs::remove_dir_all(outside);
    }
}

/// Sound pack presets with different audio characteristics
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum SoundPack {
    EightBit,
    Subtle,
    Synth,
    System,
    None,
}

impl SoundPack {
    pub fn from_id(id: &str) -> Option<Self> {
        match id {
            "eight-bit" | "8bit" => Some(Self::EightBit),
            "subtle" => Some(Self::Subtle),
            "synth" => Some(Self::Synth),
            "system" => Some(Self::System),
            "none" => Some(Self::None),
            // Custom per-event audio is not available in the Tauri backend yet;
            // keep playback enabled with the closest built-in pack.
            "custom" => Some(Self::Synth),
            _ => None,
        }
    }
}

impl std::fmt::Display for SoundPack {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let id = match self {
            Self::EightBit => "eight-bit",
            Self::Subtle => "subtle",
            Self::Synth => "synth",
            Self::System => "system",
            Self::None => "none",
        };
        f.write_str(id)
    }
}

/// Synthesized sound engine using rodio for audio output.
///
/// SAFETY: SoundEngine is created once on the main thread. The OutputStream and
/// OutputStreamHandle are !Send+!Sync due to cpal platform internals, but we only
/// ever use stream_handle to create Sink instances (which detach immediately).
/// All mutable state (volume, enabled) is behind Arc<Mutex>.
pub struct SoundEngine {
    /// Keep the stream alive for the lifetime of the engine
    _stream: OutputStream,
    stream_handle: OutputStreamHandle,
    volume: Arc<Mutex<f32>>,
    enabled: Arc<Mutex<bool>>,
    /// Per-event enable/disable (all enabled by default)
    event_enabled: Arc<Mutex<std::collections::HashMap<SoundEvent, bool>>>,
    /// Per-event sound choice (default/synth/eight-bit/system/off/builtin:*)
    event_sound: Arc<Mutex<std::collections::HashMap<SoundEvent, String>>>,
    /// Custom sound id to file path
    custom_sounds: Arc<Mutex<std::collections::HashMap<String, String>>>,
    /// Active sound pack
    sound_pack: Arc<Mutex<SoundPack>>,
    /// Filter out sounds for probe/health-check sessions
    probe_filter: Arc<Mutex<bool>>,
    /// Suppress sounds during quiet hours
    quiet_hours: Arc<Mutex<QuietHours>>,
    /// Recent play timestamps for rapid-repeat spam suppression.
    recent_play_times: Arc<Mutex<Vec<Instant>>>,
}

#[derive(Debug, Clone)]
struct QuietHours {
    enabled: bool,
    start: String,
    end: String,
}

// SAFETY: See doc comment on SoundEngine.
unsafe impl Send for SoundEngine {}
unsafe impl Sync for SoundEngine {}

impl SoundEngine {
    /// Create a new SoundEngine, initializing the audio output stream
    pub fn new() -> Option<Self> {
        match OutputStream::try_default() {
            Ok((stream, handle)) => Some(Self {
                _stream: stream,
                stream_handle: handle,
                volume: Arc::new(Mutex::new(0.7)),
                enabled: Arc::new(Mutex::new(true)),
                event_enabled: Arc::new(Mutex::new(std::collections::HashMap::new())),
                event_sound: Arc::new(Mutex::new(std::collections::HashMap::new())),
                custom_sounds: Arc::new(Mutex::new(std::collections::HashMap::new())),
                sound_pack: Arc::new(Mutex::new(SoundPack::Synth)),
                probe_filter: Arc::new(Mutex::new(false)),
                quiet_hours: Arc::new(Mutex::new(QuietHours {
                    enabled: false,
                    start: "22:00".to_string(),
                    end: "08:00".to_string(),
                })),
                recent_play_times: Arc::new(Mutex::new(Vec::new())),
            }),
            Err(e) => {
                log::warn!("Failed to initialize audio output: {}", e);
                None
            }
        }
    }

    /// Set the master volume (0.0 to 1.0)
    pub fn set_volume(&self, volume: f32) {
        let volume = volume.clamp(0.0, 1.0);
        if let Ok(mut v) = self.volume.lock() {
            *v = volume;
        }
    }

    /// Enable or disable sound playback
    pub fn set_enabled(&self, enabled: bool) {
        if let Ok(mut e) = self.enabled.lock() {
            *e = enabled;
        }
    }

    /// Get current enabled state
    pub fn is_enabled(&self) -> bool {
        self.enabled.lock().map(|e| *e).unwrap_or(false)
    }

    /// Enable or disable a specific sound event
    pub fn set_event_enabled(&self, event: SoundEvent, enabled: bool) {
        if let Ok(mut map) = self.event_enabled.lock() {
            map.insert(event, enabled);
        }
    }

    pub fn set_event_rule(&self, event: SoundEvent, enabled: bool, sound: String) {
        self.set_event_enabled(event, enabled);
        if let Ok(mut map) = self.event_sound.lock() {
            map.insert(event, sound);
        }
    }

    pub fn set_custom_sounds(&self, sounds: Vec<(String, String)>) {
        if let Ok(mut map) = self.custom_sounds.lock() {
            map.clear();
            for (id, path) in sounds {
                map.insert(id, path);
            }
        }
    }

    /// Check if a specific event is enabled (defaults to true)
    fn is_event_enabled(&self, event: SoundEvent) -> bool {
        self.event_enabled
            .lock()
            .map(|map| *map.get(&event).unwrap_or(&true))
            .unwrap_or(true)
    }

    /// Set the active sound pack
    pub fn set_sound_pack(&self, pack: SoundPack) {
        if let Ok(mut p) = self.sound_pack.lock() {
            *p = pack;
        }
    }

    /// Enable or disable probe session filtering
    pub fn set_probe_filter(&self, enabled: bool) {
        if let Ok(mut pf) = self.probe_filter.lock() {
            *pf = enabled;
        }
    }

    /// Check if probe filter is enabled
    pub fn is_probe_filter_enabled(&self) -> bool {
        self.probe_filter.lock().map(|pf| *pf).unwrap_or(false)
    }

    /// Configure quiet hours. Invalid times are ignored at playback time.
    pub fn set_quiet_hours(&self, enabled: bool, start: String, end: String) {
        if let Ok(mut quiet_hours) = self.quiet_hours.lock() {
            quiet_hours.enabled = enabled;
            quiet_hours.start = start;
            quiet_hours.end = end;
        }
    }

    fn is_quiet_hours_active(&self) -> bool {
        let quiet_hours = match self.quiet_hours.lock() {
            Ok(config) => config.clone(),
            Err(_) => return false,
        };
        if !quiet_hours.enabled {
            return false;
        }
        let Some(start) = parse_minutes(&quiet_hours.start) else {
            return false;
        };
        let Some(end) = parse_minutes(&quiet_hours.end) else {
            return false;
        };
        let now = chrono::Local::now();
        let current = now.hour() * 60 + now.minute();
        if start <= end {
            current >= start && current < end
        } else {
            current >= start || current < end
        }
    }

    fn is_spamming(&self) -> bool {
        let Ok(mut recent) = self.recent_play_times.lock() else {
            return false;
        };
        let now = Instant::now();
        recent.retain(|timestamp| now.duration_since(*timestamp) < SPAM_WINDOW);
        if recent.len() >= SPAM_THRESHOLD {
            return true;
        }
        recent.push(now);
        false
    }

    /// Play a sound event (non-blocking, spawns on a new sink)
    pub fn play(&self, event: SoundEvent) {
        if !self.is_enabled() || !self.is_event_enabled(event) || self.is_quiet_hours_active() {
            return;
        }
        self.play_resolved(event, None, true);
    }

    /// Preview a selected sound from settings. This is user-initiated, so it
    /// bypasses event toggles, quiet hours, and spam suppression.
    pub fn preview(&self, event: SoundEvent, choice: String) {
        if !self.is_enabled() {
            return;
        }
        self.play_resolved(event, Some(choice), false);
    }

    fn play_resolved(
        &self,
        event: SoundEvent,
        choice_override: Option<String>,
        suppress_spam: bool,
    ) {
        let volume = self.volume.lock().map(|v| *v).unwrap_or(0.7);
        let default_pack = self
            .sound_pack
            .lock()
            .map(|p| *p)
            .unwrap_or(SoundPack::EightBit);
        let choice = choice_override.unwrap_or_else(|| {
            self.event_sound
                .lock()
                .ok()
                .and_then(|map| map.get(&event).cloned())
                .unwrap_or_else(|| "default".to_string())
        });
        if choice == "off" || choice == "none" {
            return;
        }
        if suppress_spam && self.is_spamming() {
            return;
        }
        let pack = sound_choice_pack(&choice).unwrap_or(default_pack);
        let builtin = builtin_sound_id(&choice);
        let custom_path = custom_sound_id(&choice).and_then(|id| {
            self.custom_sounds
                .lock()
                .ok()
                .and_then(|map| map.get(id).cloned())
        });

        let sink = match Sink::try_new(&self.stream_handle) {
            Ok(s) => s,
            Err(e) => {
                log::warn!("Failed to create audio sink: {}", e);
                return;
            }
        };

        sink.set_volume(volume);

        if let Some(path) = custom_path {
            if !self.play_audio_file(&sink, &path) {
                self.play_synth(&sink, SoundEvent::TaskComplete);
            }
        } else if let Some(builtin) = builtin {
            self.play_builtin(&sink, builtin);
        } else {
            match pack {
                SoundPack::EightBit => self.play_eight_bit(&sink, event),
                SoundPack::Subtle => self.play_subtle(&sink, event),
                SoundPack::Synth => self.play_synth(&sink, event),
                SoundPack::System => self.play_system(&sink, event),
                SoundPack::None => return,
            }
        }

        // Detach so it plays in the background without blocking
        sink.detach();
    }

    /// Eight-bit sound pack: square waves, punchy retro sounds (default)
    fn play_eight_bit(&self, sink: &Sink, event: SoundEvent) {
        match event {
            SoundEvent::SessionStart => {
                sink.append(square_wave(800.0, Duration::from_millis(150)));
            }
            SoundEvent::SessionEnd => {
                sink.append(sine_wave(500.0, Duration::from_millis(70)));
            }
            SoundEvent::TaskComplete => {
                sink.append(sine_wave(600.0, Duration::from_millis(100)));
                sink.append(sine_wave(800.0, Duration::from_millis(100)));
            }
            SoundEvent::TaskError => {
                sink.append(sine_wave(400.0, Duration::from_millis(100)));
                sink.append(sine_wave(200.0, Duration::from_millis(100)));
            }
            SoundEvent::NeedsApproval => {
                sink.append(sine_wave(1000.0, Duration::from_millis(100)));
                sink.append(silence(Duration::from_millis(50)));
                sink.append(sine_wave(1000.0, Duration::from_millis(100)));
                sink.append(silence(Duration::from_millis(50)));
                sink.append(sine_wave(1000.0, Duration::from_millis(100)));
            }
            SoundEvent::TaskConfirmation => {
                sink.append(sine_wave(500.0, Duration::from_millis(60)));
                sink.append(sine_wave(700.0, Duration::from_millis(60)));
                sink.append(sine_wave(900.0, Duration::from_millis(60)));
            }
            SoundEvent::PlanApproval => {
                sink.append(square_wave(523.0, Duration::from_millis(100)));
                sink.append(square_wave(659.0, Duration::from_millis(100)));
                sink.append(square_wave(784.0, Duration::from_millis(100)));
            }
            SoundEvent::ContextLimit => {
                sink.append(square_wave(300.0, Duration::from_millis(200)));
            }
            SoundEvent::Boot => {
                sink.append(square_wave(660.0, Duration::from_millis(80)));
                sink.append(square_wave(880.0, Duration::from_millis(90)));
            }
        }
    }

    /// Subtle sound pack: sine waves at lower volume with shorter duration
    fn play_subtle(&self, sink: &Sink, event: SoundEvent) {
        // Reduce volume by 40% for the subtle pack
        sink.set_volume(sink.volume() * 0.6);

        match event {
            SoundEvent::SessionStart => {
                sink.append(sine_wave(600.0, Duration::from_millis(80)));
            }
            SoundEvent::SessionEnd => {
                sink.append(sine_wave(420.0, Duration::from_millis(60)));
            }
            SoundEvent::TaskComplete => {
                sink.append(sine_wave(500.0, Duration::from_millis(60)));
                sink.append(sine_wave(650.0, Duration::from_millis(60)));
            }
            SoundEvent::TaskError => {
                sink.append(sine_wave(350.0, Duration::from_millis(80)));
                sink.append(sine_wave(250.0, Duration::from_millis(80)));
            }
            SoundEvent::NeedsApproval => {
                sink.append(sine_wave(700.0, Duration::from_millis(60)));
                sink.append(silence(Duration::from_millis(40)));
                sink.append(sine_wave(700.0, Duration::from_millis(60)));
            }
            SoundEvent::TaskConfirmation => {
                sink.append(sine_wave(450.0, Duration::from_millis(40)));
                sink.append(sine_wave(600.0, Duration::from_millis(40)));
            }
            SoundEvent::PlanApproval => {
                sink.append(sine_wave(440.0, Duration::from_millis(70)));
                sink.append(sine_wave(554.0, Duration::from_millis(70)));
                sink.append(sine_wave(660.0, Duration::from_millis(70)));
            }
            SoundEvent::ContextLimit => {
                sink.append(sine_wave(280.0, Duration::from_millis(120)));
            }
            SoundEvent::Boot => {
                sink.append(sine_wave(520.0, Duration::from_millis(60)));
                sink.append(sine_wave(680.0, Duration::from_millis(70)));
            }
        }
    }

    /// Synth pack: brighter short tones matching AgentBro default island feel.
    fn play_synth(&self, sink: &Sink, event: SoundEvent) {
        match event {
            SoundEvent::SessionStart => {
                sink.append(sine_wave(660.0, Duration::from_millis(70)));
                sink.append(sine_wave(990.0, Duration::from_millis(90)));
            }
            SoundEvent::SessionEnd => {
                sink.append(sine_wave(740.0, Duration::from_millis(60)));
                sink.append(sine_wave(494.0, Duration::from_millis(90)));
            }
            SoundEvent::TaskComplete => {
                sink.append(sine_wave(523.25, Duration::from_millis(80)));
                sink.append(sine_wave(659.25, Duration::from_millis(80)));
                sink.append(sine_wave(783.99, Duration::from_millis(110)));
            }
            SoundEvent::TaskError => {
                sink.append(sine_wave(392.0, Duration::from_millis(90)));
                sink.append(sine_wave(196.0, Duration::from_millis(140)));
            }
            SoundEvent::NeedsApproval => {
                sink.append(sine_wave(880.0, Duration::from_millis(80)));
                sink.append(silence(Duration::from_millis(45)));
                sink.append(sine_wave(880.0, Duration::from_millis(80)));
            }
            SoundEvent::TaskConfirmation => {
                sink.append(sine_wave(740.0, Duration::from_millis(60)));
                sink.append(sine_wave(932.0, Duration::from_millis(75)));
            }
            SoundEvent::PlanApproval => {
                sink.append(sine_wave(440.0, Duration::from_millis(120)));
                sink.append(sine_wave(554.0, Duration::from_millis(120)));
                sink.append(sine_wave(660.0, Duration::from_millis(120)));
            }
            SoundEvent::ContextLimit => {
                sink.append(sine_wave(330.0, Duration::from_millis(160)));
                sink.append(sine_wave(277.0, Duration::from_millis(160)));
            }
            SoundEvent::Boot => {
                sink.append(sine_wave(587.0, Duration::from_millis(55)));
                sink.append(sine_wave(740.0, Duration::from_millis(65)));
                sink.append(sine_wave(988.0, Duration::from_millis(80)));
            }
        }
    }

    /// System pack: restrained tones for users who want less prominent audio.
    fn play_system(&self, sink: &Sink, event: SoundEvent) {
        sink.set_volume(sink.volume() * 0.75);
        self.play_subtle(sink, event);
    }

    fn play_audio_file(&self, sink: &Sink, path: &str) -> bool {
        let Ok(file) = File::open(path) else {
            return false;
        };
        let Ok(source) = Decoder::new(BufReader::new(file)) else {
            return false;
        };
        sink.append(source);
        true
    }

    fn play_audio_bytes(&self, sink: &Sink, bytes: &'static [u8]) -> bool {
        let Ok(source) = Decoder::new(Cursor::new(bytes)) else {
            return false;
        };
        sink.append(source);
        true
    }

    fn play_builtin(&self, sink: &Sink, id: &str) {
        match id {
            "hey-bro" => {
                if !self.play_audio_bytes(sink, include_bytes!("assets/hey-bro.wav")) {
                    self.play_synth(sink, SoundEvent::Boot);
                }
            }
            "hero" => {
                sink.append(sine_wave(392.0, Duration::from_millis(105)));
                sink.append(sine_wave(523.0, Duration::from_millis(105)));
                sink.append(sine_wave(659.0, Duration::from_millis(105)));
            }
            "glass" => {
                sink.append(sine_wave(659.0, Duration::from_millis(125)));
                sink.append(sine_wave(880.0, Duration::from_millis(125)));
            }
            "chime" => {
                sink.append(sine_wave(988.0, Duration::from_millis(150)));
            }
            "pop" => {
                sink.append(sine_wave(620.0, Duration::from_millis(70)));
                sink.append(sine_wave(760.0, Duration::from_millis(70)));
            }
            "submarine" => {
                sink.append(sine_wave(330.0, Duration::from_millis(115)));
                sink.append(sine_wave(294.0, Duration::from_millis(115)));
                sink.append(sine_wave(262.0, Duration::from_millis(115)));
            }
            "basso" => {
                sink.append(sine_wave(196.0, Duration::from_millis(155)));
                sink.append(sine_wave(147.0, Duration::from_millis(155)));
            }
            "sosumi" => {
                sink.append(sine_wave(698.0, Duration::from_millis(90)));
                sink.append(sine_wave(523.0, Duration::from_millis(90)));
                sink.append(sine_wave(392.0, Duration::from_millis(90)));
            }
            "bottle" => {
                sink.append(sine_wave(740.0, Duration::from_millis(75)));
                sink.append(sine_wave(880.0, Duration::from_millis(75)));
            }
            "tink" => {
                sink.append(sine_wave(1046.0, Duration::from_millis(60)));
                sink.append(sine_wave(1318.0, Duration::from_millis(60)));
            }
            "morse" => {
                sink.append(square_wave(880.0, Duration::from_millis(45)));
                sink.append(square_wave(880.0, Duration::from_millis(45)));
                sink.append(square_wave(880.0, Duration::from_millis(45)));
            }
            "funk" => {
                sink.append(square_wave(247.0, Duration::from_millis(85)));
                sink.append(square_wave(370.0, Duration::from_millis(85)));
                sink.append(square_wave(494.0, Duration::from_millis(85)));
            }
            "purr" => {
                sink.append(sine_wave(220.0, Duration::from_millis(120)));
                sink.append(sine_wave(247.0, Duration::from_millis(120)));
                sink.append(sine_wave(220.0, Duration::from_millis(120)));
            }
            "blow" => {
                sink.append(sine_wave(320.0, Duration::from_millis(140)));
                sink.append(sine_wave(260.0, Duration::from_millis(140)));
            }
            "frog" => {
                sink.append(square_wave(175.0, Duration::from_millis(120)));
                sink.append(square_wave(210.0, Duration::from_millis(120)));
            }
            _ => self.play_synth(sink, SoundEvent::TaskComplete),
        }
    }
}

// ── Waveform generators ──────────────────────────────────────────

fn sound_choice_pack(choice: &str) -> Option<SoundPack> {
    if choice == "default" || choice.starts_with("builtin:") || choice.starts_with("custom:") {
        return None;
    }
    SoundPack::from_id(choice)
}

fn builtin_sound_id(choice: &str) -> Option<&str> {
    let id = choice.strip_prefix("builtin:")?;
    if id == LEGACY_CHIME_BUILTIN_ID {
        Some("chime")
    } else {
        Some(id)
    }
}

fn custom_sound_id(choice: &str) -> Option<&str> {
    choice.strip_prefix("custom:")
}

fn parse_minutes(value: &str) -> Option<u32> {
    let (hours, minutes) = value.split_once(':')?;
    let hours: u32 = hours.parse().ok()?;
    let minutes: u32 = minutes.parse().ok()?;
    if hours < 24 && minutes < 60 {
        Some(hours * 60 + minutes)
    } else {
        None
    }
}

/// A sine wave source at a given frequency and duration
fn sine_wave(freq: f32, duration: Duration) -> SineWave {
    SineWave {
        freq,
        sample_rate: 44100,
        num_sample: 0,
        total_samples: (44100.0 * duration.as_secs_f32()) as usize,
    }
}

/// A square wave source at a given frequency and duration
fn square_wave(freq: f32, duration: Duration) -> SquareWave {
    SquareWave {
        freq,
        sample_rate: 44100,
        num_sample: 0,
        total_samples: (44100.0 * duration.as_secs_f32()) as usize,
    }
}

/// A silence source for gaps between beeps
fn silence(duration: Duration) -> Silence {
    Silence {
        sample_rate: 44100,
        num_sample: 0,
        total_samples: (44100.0 * duration.as_secs_f32()) as usize,
    }
}

// ── Sine wave iterator ───────────────────────────────────────────

struct SineWave {
    freq: f32,
    sample_rate: u32,
    num_sample: usize,
    total_samples: usize,
}

impl Iterator for SineWave {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        if self.num_sample >= self.total_samples {
            return None;
        }
        let t = self.num_sample as f32 / self.sample_rate as f32;
        self.num_sample += 1;

        // Apply a simple envelope to avoid clicks
        let envelope = self.envelope();
        Some((t * self.freq * 2.0 * std::f32::consts::PI).sin() * 0.3 * envelope)
    }
}

impl SineWave {
    /// Simple attack/release envelope to avoid audio clicks
    fn envelope(&self) -> f32 {
        let attack_samples = (self.sample_rate as f32 * 0.005) as usize; // 5ms attack
        let release_samples = (self.sample_rate as f32 * 0.005) as usize; // 5ms release
        let release_start = self.total_samples.saturating_sub(release_samples);

        if self.num_sample < attack_samples {
            self.num_sample as f32 / attack_samples as f32
        } else if self.num_sample >= release_start {
            (self.total_samples - self.num_sample) as f32 / release_samples as f32
        } else {
            1.0
        }
    }
}

impl Source for SineWave {
    fn current_frame_len(&self) -> Option<usize> {
        Some(self.total_samples - self.num_sample)
    }

    fn channels(&self) -> u16 {
        1
    }

    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    fn total_duration(&self) -> Option<Duration> {
        Some(Duration::from_secs_f32(
            self.total_samples as f32 / self.sample_rate as f32,
        ))
    }
}

// ── Square wave iterator ─────────────────────────────────────────

struct SquareWave {
    freq: f32,
    sample_rate: u32,
    num_sample: usize,
    total_samples: usize,
}

impl Iterator for SquareWave {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        if self.num_sample >= self.total_samples {
            return None;
        }
        let t = self.num_sample as f32 / self.sample_rate as f32;
        self.num_sample += 1;

        // Square wave: sign of sine
        let envelope = self.envelope();
        let value = if (t * self.freq * 2.0 * std::f32::consts::PI).sin() >= 0.0 {
            0.2
        } else {
            -0.2
        };
        Some(value * envelope)
    }
}

impl SquareWave {
    fn envelope(&self) -> f32 {
        let attack_samples = (self.sample_rate as f32 * 0.005) as usize;
        let release_samples = (self.sample_rate as f32 * 0.005) as usize;
        let release_start = self.total_samples.saturating_sub(release_samples);

        if self.num_sample < attack_samples {
            self.num_sample as f32 / attack_samples as f32
        } else if self.num_sample >= release_start {
            (self.total_samples - self.num_sample) as f32 / release_samples as f32
        } else {
            1.0
        }
    }
}

impl Source for SquareWave {
    fn current_frame_len(&self) -> Option<usize> {
        Some(self.total_samples - self.num_sample)
    }

    fn channels(&self) -> u16 {
        1
    }

    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    fn total_duration(&self) -> Option<Duration> {
        Some(Duration::from_secs_f32(
            self.total_samples as f32 / self.sample_rate as f32,
        ))
    }
}

// ── Silence source ───────────────────────────────────────────────

struct Silence {
    sample_rate: u32,
    num_sample: usize,
    total_samples: usize,
}

impl Iterator for Silence {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        if self.num_sample >= self.total_samples {
            return None;
        }
        self.num_sample += 1;
        Some(0.0)
    }
}

impl Source for Silence {
    fn current_frame_len(&self) -> Option<usize> {
        Some(self.total_samples - self.num_sample)
    }

    fn channels(&self) -> u16 {
        1
    }

    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    fn total_duration(&self) -> Option<Duration> {
        Some(Duration::from_secs_f32(
            self.total_samples as f32 / self.sample_rate as f32,
        ))
    }
}
