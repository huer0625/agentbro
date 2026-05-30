// Pet asset discovery — Codex-compatible sprite atlas loading in pure Rust.
//
// Sources, in order of precedence:
//   1. ~/.agentbro/pets/<id>/pet.json + <spritesheetPath>   (AgentBro user-defined)
//   2. AgentBro bundled resources: <resources>/pets/<id>/pet.json + spritesheet
//   3. /Applications/Codex.app/Contents/Resources/webview/assets/<id>-spritesheet-*.webp
//   4. /Applications/Codex.app/Contents/Resources/app.asar  (handwritten asar parser)
//   5. ~/.codex/pets/<id>/pet.json + <spritesheetPath>      (Codex user-defined)
//   6. ~/Applications/Codex.app/...                         (per-user install fallback)

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

const MAX_SPRITESHEET_BYTES: u64 = 10 * 1024 * 1024;
// asar v1: content starts at 8 + u32@4 (aligned pickle size). Using 16 + u32@12
// (unpadded JSON length) silently shifts every read back by Pickle's 1–3 byte pad.
const ASAR_HEADER_JSON_LEN_OFFSET: usize = 12;
const ASAR_JSON_START: usize = 16;
const ASAR_PICKLE_PAYLOAD_OFFSET: usize = 4;
const ASAR_PICKLE_PAYLOAD_BASE: usize = 8;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameSize {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnimationDef {
    pub row: u32,
    pub frames: u32,
    pub fps: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetMetadata {
    pub id: String,
    pub display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub provider: String, // "agentbro" | "codex" | "user"
    pub builtin: bool,
    pub spritesheet_data_url: String,
    pub frame_size: FrameSize,
    pub animations: HashMap<String, AnimationDef>,
    pub state_mapping: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetDiscoveryResult {
    pub pets: Vec<PetMetadata>,
    pub warnings: Vec<String>,
}

struct BuiltInCodexPet {
    id: &'static str,
    display_name: &'static str,
    description: &'static str,
}

struct BuiltInAgentBroPet {
    id: &'static str,
    display_name: &'static str,
    description: &'static str,
}

const BUILT_IN_AGENTBRO_PETS: &[BuiltInAgentBroPet] = &[BuiltInAgentBroPet {
    id: "a-bro",
    display_name: "A-Bro(阿布)",
    description: "AgentBro's default pet: two cute collaborator halves, charcoal A-side and teal B-side, clasping hands as a living AB handshake mascot.",
}];

const BUILT_IN_CODEX_PETS: &[BuiltInCodexPet] = &[
    BuiltInCodexPet {
        id: "codex",
        display_name: "Codex",
        description: "The original Codex companion.",
    },
    BuiltInCodexPet {
        id: "dewey",
        display_name: "Dewey",
        description: "A tidy duck for calm workspace days.",
    },
    BuiltInCodexPet {
        id: "fireball",
        display_name: "Fireball",
        description: "Hot path energy for fast iteration.",
    },
    BuiltInCodexPet {
        id: "rocky",
        display_name: "Rocky",
        description: "A steady rock when the diff gets large.",
    },
    BuiltInCodexPet {
        id: "seedy",
        display_name: "Seedy",
        description: "Small green shoots for new ideas.",
    },
    BuiltInCodexPet {
        id: "stacky",
        display_name: "Stacky",
        description: "A balanced stack for deep work.",
    },
    BuiltInCodexPet {
        id: "bsod",
        display_name: "BSOD",
        description: "A tiny blue-screen gremlin.",
    },
    BuiltInCodexPet {
        id: "null-signal",
        display_name: "Null Signal",
        description: "Quiet signal from the void.",
    },
];

/// Discover all available pets from AgentBro resources, Codex.app, and user-defined pet directories.
pub fn discover_all_pets() -> PetDiscoveryResult {
    discover_all_pets_with_resource_dir(None)
}

pub fn discover_all_pets_with_resource_dir(
    agentbro_resources_dir: Option<&Path>,
) -> PetDiscoveryResult {
    let mut pets = Vec::new();
    let mut warnings = Vec::new();

    if let Some(user_dir) = find_agentbro_user_pets_dir() {
        pets.extend(discover_user_pets(&user_dir, "agentbro"));
    }

    let agentbro_resource_dirs = find_agentbro_resource_dirs(agentbro_resources_dir);
    for builtin in BUILT_IN_AGENTBRO_PETS {
        let mut loaded = None;
        for resources_dir in &agentbro_resource_dirs {
            loaded = read_agentbro_pet(&resources_dir.join("pets").join(builtin.id), builtin);
            if loaded.is_some() {
                break;
            }
        }
        match loaded {
            Some(pet) => pets.push(pet),
            None => {
                warnings.push(format!(
                    "Failed to load AgentBro built-in pet '{}'",
                    builtin.id
                ));
            }
        }
    }

    if let Some(resources_dir) = find_codex_resources_dir() {
        for builtin in BUILT_IN_CODEX_PETS {
            match read_builtin_spritesheet_data_url(&resources_dir, builtin.id) {
                Some(data_url) => pets.push(make_codex_builtin_pet(builtin, data_url)),
                None => warnings.push(format!(
                    "Failed to load spritesheet for built-in pet '{}'",
                    builtin.id
                )),
            }
        }
    } else {
        warnings.push("Codex.app not found — built-in pets unavailable".into());
    }

    if let Some(user_dir) = find_codex_user_pets_dir() {
        pets.extend(discover_user_pets(&user_dir, "user"));
    }

    let pets = dedupe_pets_by_raw_id(pets);

    PetDiscoveryResult { pets, warnings }
}

#[tauri::command]
pub fn discover_pets(app: tauri::AppHandle) -> PetDiscoveryResult {
    let resource_dir = app.path().resource_dir().ok();
    discover_all_pets_with_resource_dir(resource_dir.as_deref())
}

// ── Resource discovery ───────────────────────────────────────────────────────

fn find_agentbro_resource_dirs(runtime_resource_dir: Option<&Path>) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(path) = runtime_resource_dir {
        candidates.push(path.to_path_buf());
    }

    candidates.push(Path::new(env!("CARGO_MANIFEST_DIR")).join("../src"));

    let mut result = Vec::new();
    for candidate in candidates {
        if candidate.join("pets").is_dir() && !result.contains(&candidate) {
            result.push(candidate);
        }
    }
    result
}

fn find_codex_resources_dir() -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> =
        vec![PathBuf::from("/Applications/Codex.app/Contents/Resources")];
    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join("Applications/Codex.app/Contents/Resources"));
    }
    candidates
        .into_iter()
        .find(|c| c.join("app.asar").exists() || c.join("webview").join("assets").is_dir())
}

fn find_agentbro_user_pets_dir() -> Option<PathBuf> {
    find_home_pets_dir(".agentbro")
}

fn find_codex_user_pets_dir() -> Option<PathBuf> {
    find_home_pets_dir(".codex")
}

fn find_home_pets_dir(home_child: &str) -> Option<PathBuf> {
    let path = dirs::home_dir()?.join(home_child).join("pets");
    if path.is_dir() {
        Some(path)
    } else {
        None
    }
}

fn dedupe_pets_by_raw_id(pets: Vec<PetMetadata>) -> Vec<PetMetadata> {
    let mut seen = HashSet::new();
    let mut result = Vec::with_capacity(pets.len());
    for pet in pets {
        if seen.insert(raw_pet_id(&pet.id).to_string()) {
            result.push(pet);
        }
    }
    result
}

fn raw_pet_id(id: &str) -> &str {
    id.split_once(':').map(|(_, raw)| raw).unwrap_or(id)
}

// ── Spritesheet readers ──────────────────────────────────────────────────────

fn read_agentbro_pet(root: &Path, builtin: &BuiltInAgentBroPet) -> Option<PetMetadata> {
    let json_path = root.join("pet.json");
    let pet_json = if json_path.is_file() {
        let json_str = fs::read_to_string(&json_path).ok()?;
        serde_json::from_str::<JsonValue>(&json_str).ok()?
    } else {
        JsonValue::Object(Default::default())
    };

    let sprite_path_rel = pet_json
        .get("spritesheetPath")
        .and_then(|v| v.as_str())
        .unwrap_or("spritesheet.webp");
    let data_url = read_user_spritesheet(root, sprite_path_rel)?;

    let display_name = pet_json
        .get("displayName")
        .and_then(|v| v.as_str())
        .unwrap_or(builtin.display_name)
        .to_string();
    let description = pet_json
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or(builtin.description)
        .to_string();
    let frame_size = parse_frame_size(&pet_json).unwrap_or(FrameSize {
        width: 192,
        height: 208,
    });
    let animations = parse_animations(&pet_json).unwrap_or_else(default_codex_animations);
    let state_mapping = parse_state_mapping(&pet_json).unwrap_or_else(default_codex_state_mapping);

    Some(PetMetadata {
        id: format!("agentbro:{}", builtin.id),
        display_name,
        description: Some(description),
        provider: "agentbro".into(),
        builtin: true,
        spritesheet_data_url: data_url,
        frame_size,
        animations,
        state_mapping,
    })
}

fn read_builtin_spritesheet_data_url(resources_dir: &Path, asset_ref: &str) -> Option<String> {
    if let Some(url) = read_unpacked_codex_asset(resources_dir, asset_ref) {
        return Some(url);
    }

    let asar = resources_dir.join("app.asar");
    if asar.is_file() {
        return read_asar_asset_data_url(&asar, asset_ref);
    }

    None
}

fn read_unpacked_codex_asset(resources_dir: &Path, asset_ref: &str) -> Option<String> {
    let assets = resources_dir.join("webview").join("assets");
    let prefix = format!("{}-spritesheet-", asset_ref);
    let entries = fs::read_dir(&assets).ok()?;
    for entry in entries.flatten() {
        let name_os = entry.file_name();
        let name = name_os.to_str()?;
        if !name.starts_with(&prefix) || !name.ends_with(".webp") {
            continue;
        }
        let path = entry.path();
        let meta = fs::metadata(&path).ok()?;
        if !meta.is_file() || meta.len() > MAX_SPRITESHEET_BYTES {
            continue;
        }
        let bytes = fs::read(&path).ok()?;
        return Some(format!(
            "data:image/webp;base64,{}",
            STANDARD.encode(&bytes)
        ));
    }
    None
}

fn read_asar_asset_data_url(asar_path: &Path, asset_ref: &str) -> Option<String> {
    let data = fs::read(asar_path).ok()?;
    if data.len() < ASAR_JSON_START + 4 {
        return None;
    }
    let json_len_bytes: [u8; 4] = data
        [ASAR_HEADER_JSON_LEN_OFFSET..ASAR_HEADER_JSON_LEN_OFFSET + 4]
        .try_into()
        .ok()?;
    let json_len = u32::from_le_bytes(json_len_bytes) as usize;

    let payload_size_bytes: [u8; 4] = data
        [ASAR_PICKLE_PAYLOAD_OFFSET..ASAR_PICKLE_PAYLOAD_OFFSET + 4]
        .try_into()
        .ok()?;
    let payload_size = u32::from_le_bytes(payload_size_bytes) as usize;

    let json_start = ASAR_JSON_START;
    let json_end = json_start.checked_add(json_len)?;
    let content_start = ASAR_PICKLE_PAYLOAD_BASE.checked_add(payload_size)?;
    if json_end > data.len() || content_start < json_end || content_start > data.len() {
        return None;
    }

    let header_str = std::str::from_utf8(&data[json_start..json_end]).ok()?;
    let header: JsonValue = serde_json::from_str(header_str).ok()?;

    let prefix = format!("{}-spritesheet-", asset_ref);
    let matcher = |path: &str| -> bool {
        path.starts_with("/webview/assets/")
            && path[16..].starts_with(&prefix)
            && path.ends_with(".webp")
    };

    let asset = find_asar_file(&header, &matcher, "")?;
    if asset.size > MAX_SPRITESHEET_BYTES as usize {
        return None;
    }

    let file_start = content_start.checked_add(asset.offset)?;
    let file_end = file_start.checked_add(asset.size)?;
    if file_end > data.len() {
        return None;
    }

    let bytes = &data[file_start..file_end];
    Some(format!("data:image/webp;base64,{}", STANDARD.encode(bytes)))
}

struct AsarFile {
    offset: usize,
    size: usize,
}

fn find_asar_file<F: Fn(&str) -> bool>(
    node: &JsonValue,
    matcher: &F,
    prefix: &str,
) -> Option<AsarFile> {
    let files = node.get("files")?.as_object()?;
    for (name, child) in files {
        let next_path = format!("{}/{}", prefix, name);
        if let Some(size) = child.get("size").and_then(|v| v.as_u64()) {
            if matcher(&next_path) {
                let offset = child
                    .get("offset")
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(0);
                return Some(AsarFile {
                    size: size as usize,
                    offset: offset as usize,
                });
            }
        }
        if let Some(found) = find_asar_file(child, matcher, &next_path) {
            return Some(found);
        }
    }
    None
}

// ── User-defined pets ────────────────────────────────────────────────────────

fn discover_user_pets(dir: &Path, provider: &str) -> Vec<PetMetadata> {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    let mut pets = Vec::new();
    for entry in entries.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let path = entry.path();
        let json_path = path.join("pet.json");
        if !json_path.is_file() {
            continue;
        }

        let json_str = match fs::read_to_string(&json_path) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let pet_json: JsonValue = match serde_json::from_str(&json_str) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let id = pet_json
            .get("id")
            .and_then(|v| v.as_str())
            .map(String::from)
            .unwrap_or_else(|| {
                entry
                    .file_name()
                    .to_str()
                    .map(String::from)
                    .unwrap_or_default()
            });
        if id.is_empty() {
            continue;
        }

        let display_name = pet_json
            .get("displayName")
            .and_then(|v| v.as_str())
            .map(String::from)
            .unwrap_or_else(|| id.clone());
        let description = pet_json
            .get("description")
            .and_then(|v| v.as_str())
            .map(String::from);
        let sprite_path_rel = pet_json
            .get("spritesheetPath")
            .and_then(|v| v.as_str())
            .unwrap_or("spritesheet.webp");

        let data_url = match read_user_spritesheet(&path, sprite_path_rel) {
            Some(d) => d,
            None => continue,
        };

        let frame_size = parse_frame_size(&pet_json).unwrap_or(FrameSize {
            width: 192,
            height: 208,
        });
        let animations = parse_animations(&pet_json).unwrap_or_else(default_codex_animations);
        let state_mapping =
            parse_state_mapping(&pet_json).unwrap_or_else(default_codex_state_mapping);

        pets.push(PetMetadata {
            id: format!("{}:{}", provider, id),
            display_name,
            description,
            provider: provider.into(),
            builtin: false,
            spritesheet_data_url: data_url,
            frame_size,
            animations,
            state_mapping,
        });
    }

    pets
}

fn read_user_spritesheet(root: &Path, rel_path: &str) -> Option<String> {
    let absolute = root.join(rel_path);
    let canonical_root = fs::canonicalize(root).ok()?;
    let canonical = fs::canonicalize(&absolute).ok()?;
    if !canonical.starts_with(&canonical_root) {
        return None;
    }

    let meta = fs::metadata(&canonical).ok()?;
    if !meta.is_file() || meta.len() > MAX_SPRITESHEET_BYTES {
        return None;
    }

    let ext = canonical.extension()?.to_str()?.to_lowercase();
    let mime = match ext.as_str() {
        "webp" => "image/webp",
        "png" => "image/png",
        _ => return None,
    };

    let bytes = fs::read(&canonical).ok()?;
    Some(format!("data:{};base64,{}", mime, STANDARD.encode(&bytes)))
}

fn parse_frame_size(json: &JsonValue) -> Option<FrameSize> {
    let fs = json.get("frameSize")?;
    let width = fs.get("width")?.as_u64()? as u32;
    let height = fs.get("height")?.as_u64()? as u32;
    Some(FrameSize { width, height })
}

fn parse_animations(json: &JsonValue) -> Option<HashMap<String, AnimationDef>> {
    let anims = json.get("animations")?.as_object()?;
    let mut result = HashMap::new();
    for (k, v) in anims {
        let row = v.get("row")?.as_u64()? as u32;
        let frames = v.get("frames")?.as_u64()? as u32;
        let fps = v.get("fps")?.as_u64()? as u32;
        result.insert(k.clone(), AnimationDef { row, frames, fps });
    }
    Some(result)
}

fn parse_state_mapping(json: &JsonValue) -> Option<HashMap<String, String>> {
    let m = json.get("stateMapping")?.as_object()?;
    let mut result = HashMap::new();
    for (k, v) in m {
        result.insert(k.clone(), v.as_str()?.to_string());
    }
    Some(result)
}

// ── Codex pet defaults (matches built-in spritesheet layout) ────────────────

fn default_codex_animations() -> HashMap<String, AnimationDef> {
    let mut m = HashMap::new();
    m.insert(
        "idle".into(),
        AnimationDef {
            row: 0,
            frames: 6,
            fps: 6,
        },
    );
    m.insert(
        "runningRight".into(),
        AnimationDef {
            row: 1,
            frames: 8,
            fps: 10,
        },
    );
    m.insert(
        "runningLeft".into(),
        AnimationDef {
            row: 2,
            frames: 8,
            fps: 10,
        },
    );
    m.insert(
        "waving".into(),
        AnimationDef {
            row: 3,
            frames: 4,
            fps: 6,
        },
    );
    m.insert(
        "jumping".into(),
        AnimationDef {
            row: 4,
            frames: 5,
            fps: 7,
        },
    );
    m.insert(
        "failed".into(),
        AnimationDef {
            row: 5,
            frames: 8,
            fps: 6,
        },
    );
    m.insert(
        "waiting".into(),
        AnimationDef {
            row: 6,
            frames: 6,
            fps: 5,
        },
    );
    m.insert(
        "running".into(),
        AnimationDef {
            row: 7,
            frames: 6,
            fps: 8,
        },
    );
    m.insert(
        "review".into(),
        AnimationDef {
            row: 8,
            frames: 6,
            fps: 5,
        },
    );
    m
}

fn default_codex_state_mapping() -> HashMap<String, String> {
    let mut m = HashMap::new();
    m.insert("idle".into(), "idle".into());
    m.insert("done".into(), "jumping".into());
    m.insert("thinking".into(), "review".into());
    m.insert("working".into(), "running".into());
    m.insert("compacting".into(), "failed".into());
    m.insert("attention".into(), "waiting".into());
    m.insert("error".into(), "failed".into());
    m.insert("needsYou".into(), "waiting".into());
    m
}

fn make_codex_builtin_pet(builtin: &BuiltInCodexPet, data_url: String) -> PetMetadata {
    PetMetadata {
        id: format!("codex:{}", builtin.id),
        display_name: builtin.display_name.into(),
        description: Some(builtin.description.into()),
        provider: "codex".into(),
        builtin: true,
        spritesheet_data_url: data_url,
        frame_size: FrameSize {
            width: 192,
            height: 208,
        },
        animations: default_codex_animations(),
        state_mapping: default_codex_state_mapping(),
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

    fn write_test_pet(root: &Path, id: &str, display_name: &str) {
        let pet_dir = root.join(id);
        fs::create_dir_all(&pet_dir).unwrap();
        fs::write(pet_dir.join("spritesheet.webp"), b"WEBP").unwrap();
        fs::write(
            pet_dir.join("pet.json"),
            format!(
                r#"{{
                  "id": "{id}",
                  "displayName": "{display_name}",
                  "spritesheetPath": "spritesheet.webp"
                }}"#
            ),
        )
        .unwrap();
    }

    fn test_pet(id: &str, provider: &str) -> PetMetadata {
        PetMetadata {
            id: id.into(),
            display_name: id.into(),
            description: None,
            provider: provider.into(),
            builtin: false,
            spritesheet_data_url: "data:image/webp;base64,test".into(),
            frame_size: FrameSize {
                width: 192,
                height: 208,
            },
            animations: HashMap::new(),
            state_mapping: HashMap::new(),
        }
    }

    #[test]
    fn matches_codex_asset_path_pattern() {
        let prefix = "dewey-spritesheet-";
        let matcher = |path: &str| -> bool {
            path.starts_with("/webview/assets/")
                && path[16..].starts_with(prefix)
                && path.ends_with(".webp")
        };
        assert!(matcher("/webview/assets/dewey-spritesheet-abc123.webp"));
        assert!(!matcher("/webview/assets/dewey-spritesheet-abc123.png"));
        assert!(!matcher("/webview/dewey-spritesheet-abc.webp"));
        assert!(!matcher("/webview/assets/foo-spritesheet-abc.webp"));
    }

    #[test]
    fn parses_minimal_pet_json_overrides() {
        let json: JsonValue = serde_json::from_str(
            r#"{
              "id": "fish",
              "displayName": "Fish",
              "frameSize": { "width": 64, "height": 64 },
              "animations": { "idle": { "row": 0, "frames": 4, "fps": 8 } },
              "stateMapping": { "idle": "idle" }
            }"#,
        )
        .unwrap();

        let fs = parse_frame_size(&json).unwrap();
        assert_eq!(fs.width, 64);
        assert_eq!(fs.height, 64);

        let anims = parse_animations(&json).unwrap();
        assert_eq!(anims.get("idle").unwrap().frames, 4);

        let states = parse_state_mapping(&json).unwrap();
        assert_eq!(states.get("idle").unwrap(), "idle");
    }

    #[test]
    fn defaults_match_codex_spritesheet_layout() {
        let anims = default_codex_animations();
        assert_eq!(anims.get("idle").unwrap().row, 0);
        assert_eq!(anims.get("runningLeft").unwrap().row, 2);
        assert_eq!(anims.get("review").unwrap().row, 8);

        let states = default_codex_state_mapping();
        assert_eq!(states.get("done").unwrap(), "jumping");
        assert_eq!(states.get("error").unwrap(), "failed");
    }

    #[test]
    fn discovers_agentbro_user_pets_with_agentbro_provider() {
        let root = temp_test_dir("agentbro-user-pets");
        write_test_pet(&root, "luffy", "Luffy");

        let pets = discover_user_pets(&root, "agentbro");

        assert_eq!(pets.len(), 1);
        assert_eq!(pets[0].id, "agentbro:luffy");
        assert_eq!(pets[0].provider, "agentbro");
        assert!(!pets[0].builtin);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn dedupe_keeps_agentbro_priority_by_raw_id() {
        let pets = vec![
            test_pet("agentbro:luffy", "agentbro"),
            test_pet("codex:luffy", "codex"),
            test_pet("user:luffy", "user"),
            test_pet("codex:codex", "codex"),
        ];

        let result = dedupe_pets_by_raw_id(pets);
        let ids: Vec<&str> = result.iter().map(|pet| pet.id.as_str()).collect();

        assert_eq!(ids, vec!["agentbro:luffy", "codex:codex"]);
    }

    #[test]
    fn discovers_agentbro_builtin_pet_from_resources() {
        let resource_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../src");
        let pet = read_agentbro_pet(
            &resource_dir.join("pets").join("a-bro"),
            &BUILT_IN_AGENTBRO_PETS[0],
        )
        .expect("A-Bro built-in pet should be discoverable");

        assert_eq!(pet.provider, "agentbro");
        assert!(pet.builtin);
        assert_eq!(pet.display_name, "A-Bro(阿布)");
        assert_eq!(pet.frame_size.width, 192);
        assert_eq!(pet.frame_size.height, 208);
        assert!(pet
            .spritesheet_data_url
            .starts_with("data:image/webp;base64,"));
    }

    /// End-to-end smoke test against the local Codex.app and ~/.codex/pets.
    /// Run with: `cargo test --lib pets -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn smoke_discovers_local_pets() {
        let result = discover_all_pets();
        println!(
            "discovered {} pets, {} warnings",
            result.pets.len(),
            result.warnings.len()
        );
        for w in &result.warnings {
            println!("  WARN: {}", w);
        }
        for pet in &result.pets {
            println!(
                "  {:>22}  provider={}  builtin={}  data_url_len={}  frame={}x{}",
                pet.id,
                pet.provider,
                pet.builtin,
                pet.spritesheet_data_url.len(),
                pet.frame_size.width,
                pet.frame_size.height
            );
            assert!(pet.spritesheet_data_url.starts_with("data:image/"));
            assert!(
                pet.spritesheet_data_url.len() > 1000,
                "spritesheet too small for {}",
                pet.id
            );
        }
        assert!(
            !result.pets.is_empty(),
            "expected at least one pet on a machine with Codex.app or ~/.codex/pets"
        );
    }
}
