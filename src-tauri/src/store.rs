use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

pub const SETTINGS_VERSION: u32 = 4;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Wallpaper {
    pub id: String,
    pub source: String,
    pub source_label: Option<String>,
    pub kind: String,
    pub title: String,
    pub author: Option<String>,
    pub page_url: Option<String>,
    pub thumb_url: String,
    pub preview_url: String,
    pub full_url: String,
    pub video_url: Option<String>,
    pub width: u32,
    pub height: u32,
    pub color: Option<String>,
    pub created_at: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Rotation {
    pub enabled: bool,
    pub interval_minutes: u32,
    pub collection_id: Option<String>,
    pub shuffle: bool,
}

impl Default for Rotation {
    fn default() -> Self {
        Self {
            enabled: false,
            interval_minutes: 30,
            collection_id: None,
            shuffle: true,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub version: u32,
    pub theme: String,
    pub enabled_sources: Vec<String>,
    pub orientation: String,
    pub min_resolution: String,
    pub video_muted: bool,
    pub rotation: Rotation,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            theme: "midnight".into(),
            enabled_sources: vec![
                "wallhaven".into(),
                "commons".into(),
                "bing".into(),
                "konachan".into(),
                "safebooru".into(),
                "deviantart".into(),
            ],
            orientation: "any".into(),
            min_resolution: "any".into(),
            video_muted: true,
            rotation: Rotation::default(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionSummary {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub item_count: usize,
    pub cover_url: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub items: Vec<Wallpaper>,
}

impl Default for Collection {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            created_at: 0,
            items: Vec::new(),
        }
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Favorite {
    pub wallpaper: Wallpaper,
    pub added_at: i64,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CustomSource {
    pub id: String,
    pub name: String,
    pub url: String,
    pub kind: String,
    pub enabled: bool,
    pub created_at: i64,
}

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct Data {
    settings: Settings,
    collections: Vec<Collection>,
    favorites: Vec<Favorite>,
    custom_sources: Vec<CustomSource>,
    local: Vec<Wallpaper>,
    meta: HashMap<String, Option<String>>,
}

pub struct Store {
    path: PathBuf,
    data: Data,
}

pub fn data_dir() -> PathBuf {
    let base = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
    let dir = PathBuf::from(base).join("WallFlow");
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn cache_dir() -> PathBuf {
    let dir = data_dir().join("wallpaper-cache");
    let _ = fs::create_dir_all(&dir);
    dir
}

impl Store {
    pub fn open() -> Self {
        let path = data_dir().join("wallflow-data.json");
        let data = fs::read_to_string(&path)
            .ok()
            .and_then(|raw| serde_json::from_str::<Data>(&raw).ok())
            .unwrap_or_default();
        let mut store = Self { path, data };
        store.data.settings = normalize(serde_json::to_value(&store.data.settings).unwrap_or(json!({})));
        store
    }

    fn save(&self) {
        if let Ok(raw) = serde_json::to_string_pretty(&self.data) {
            let tmp = self.path.with_extension("json.tmp");
            if fs::write(&tmp, raw).is_ok() {
                let _ = fs::rename(&tmp, &self.path);
            }
        }
    }

    pub fn settings(&self) -> Settings {
        self.data.settings.clone()
    }

    pub fn update_settings(&mut self, patch: Value) -> Settings {
        let current = serde_json::to_value(&self.data.settings).unwrap_or(json!({}));
        let merged = deep_merge(current, patch);
        self.data.settings = normalize(merged);
        self.save();
        self.settings()
    }

    pub fn collections(&self) -> Vec<CollectionSummary> {
        let mut list = self.data.collections.clone();
        list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        list.into_iter()
            .map(|collection| CollectionSummary {
                id: collection.id,
                name: collection.name,
                created_at: collection.created_at,
                item_count: collection.items.len(),
                cover_url: collection.items.first().map(|item| item.thumb_url.clone()),
            })
            .collect()
    }

    pub fn create_collection(&mut self, name: String) -> CollectionSummary {
        let created_at = now_ms();
        let collection = Collection {
            id: uuid(),
            name,
            created_at,
            items: Vec::new(),
        };
        let summary = CollectionSummary {
            id: collection.id.clone(),
            name: collection.name.clone(),
            created_at,
            item_count: 0,
            cover_url: None,
        };
        self.data.collections.push(collection);
        self.save();
        summary
    }

    pub fn rename_collection(&mut self, id: &str, name: String) {
        if let Some(collection) = self.data.collections.iter_mut().find(|c| c.id == id) {
            collection.name = name;
            self.save();
        }
    }

    pub fn delete_collection(&mut self, id: &str) {
        self.data.collections.retain(|c| c.id != id);
        self.save();
    }

    pub fn collection_items(&self, id: &str) -> Vec<Wallpaper> {
        self.data
            .collections
            .iter()
            .find(|c| c.id == id)
            .map(|c| c.items.clone())
            .unwrap_or_default()
    }

    pub fn add_to_collection(&mut self, id: &str, wallpaper: Wallpaper) {
        if let Some(collection) = self.data.collections.iter_mut().find(|c| c.id == id) {
            if !collection.items.iter().any(|item| item.id == wallpaper.id) {
                collection.items.insert(0, wallpaper);
                self.save();
            }
        }
    }

    pub fn remove_from_collection(&mut self, id: &str, wallpaper_id: &str) {
        if let Some(collection) = self.data.collections.iter_mut().find(|c| c.id == id) {
            collection.items.retain(|item| item.id != wallpaper_id);
            self.save();
        }
    }

    pub fn favorites(&self) -> Vec<Wallpaper> {
        self.data
            .favorites
            .iter()
            .map(|entry| entry.wallpaper.clone())
            .collect()
    }

    pub fn toggle_favorite(&mut self, wallpaper: Wallpaper) -> bool {
        if let Some(index) = self
            .data
            .favorites
            .iter()
            .position(|entry| entry.wallpaper.id == wallpaper.id)
        {
            self.data.favorites.remove(index);
            self.save();
            return false;
        }
        self.data.favorites.insert(
            0,
            Favorite {
                wallpaper,
                added_at: now_ms(),
            },
        );
        self.save();
        true
    }

    pub fn custom_sources(&self) -> Vec<CustomSource> {
        let mut list = self.data.custom_sources.clone();
        list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        list
    }

    pub fn add_custom_source(&mut self, source: CustomSource) {
        self.data.custom_sources.push(source);
        self.save();
    }

    pub fn remove_custom_source(&mut self, id: &str) {
        self.data.custom_sources.retain(|source| source.id != id);
        self.save();
    }

    pub fn set_custom_source_enabled(&mut self, id: &str, enabled: bool) {
        if let Some(source) = self.data.custom_sources.iter_mut().find(|s| s.id == id) {
            source.enabled = enabled;
            self.save();
        }
    }

    pub fn local(&self) -> Vec<Wallpaper> {
        self.data.local.clone()
    }

    pub fn set_local(&mut self, items: Vec<Wallpaper>) {
        self.data.local = items;
        self.save();
    }

    pub fn meta(&self, key: &str) -> Option<String> {
        self.data.meta.get(key).cloned().flatten()
    }

    pub fn set_meta(&mut self, key: &str, value: Option<String>) {
        self.data.meta.insert(key.to_string(), value);
        self.save();
    }
}

fn deep_merge(base: Value, patch: Value) -> Value {
    match (base, patch) {
        (Value::Object(mut base_map), Value::Object(patch_map)) => {
            for (key, value) in patch_map {
                let merged = match base_map.remove(&key) {
                    Some(existing) => deep_merge(existing, value),
                    None => value,
                };
                base_map.insert(key, merged);
            }
            Value::Object(base_map)
        }
        (_, patch) => patch,
    }
}

/// Mirrors normalizeSettings() in the Electron build so old data keeps working.
pub fn normalize(raw: Value) -> Settings {
    let input = raw.as_object().cloned().unwrap_or_default();
    let defaults = Settings::default();

    let version = input
        .get("version")
        .and_then(Value::as_u64)
        .unwrap_or(1) as u32;

    let known = [
        "wallhaven",
        "commons",
        "bing",
        "konachan",
        "safebooru",
        "deviantart",
        "openverse",
        "custom",
    ];

    let mut enabled: Vec<String> = input
        .get("enabledSources")
        .and_then(Value::as_array)
        .map(|rows| {
            rows.iter()
                .filter_map(|row| row.as_str())
                .filter(|id| known.contains(id))
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_else(|| defaults.enabled_sources.clone());

    if version < 3 {
        for extra in ["bing", "konachan"] {
            if !enabled.iter().any(|id| id == extra) {
                enabled.push(extra.to_string());
            }
        }
    }
    if version < 4 {
        for extra in ["safebooru", "deviantart"] {
            if !enabled.iter().any(|id| id == extra) {
                enabled.push(extra.to_string());
            }
        }
    }
    if enabled.is_empty() {
        enabled = defaults.enabled_sources.clone();
    }

    let string_field = |key: &str, allowed: &[&str], fallback: &str| -> String {
        input
            .get(key)
            .and_then(Value::as_str)
            .filter(|value| allowed.contains(value))
            .unwrap_or(fallback)
            .to_string()
    };

    let rotation = input.get("rotation").cloned().unwrap_or(json!({}));
    let rotation = rotation.as_object().cloned().unwrap_or_default();

    Settings {
        version: SETTINGS_VERSION,
        theme: string_field(
            "theme",
            &["midnight", "slate", "graphite", "plum", "moss", "ember"],
            &defaults.theme,
        ),
        enabled_sources: enabled,
        orientation: string_field(
            "orientation",
            &["any", "landscape", "portrait", "square"],
            &defaults.orientation,
        ),
        min_resolution: string_field(
            "minResolution",
            &["any", "1080p", "1440p", "4k"],
            &defaults.min_resolution,
        ),
        video_muted: input
            .get("videoMuted")
            .and_then(Value::as_bool)
            .unwrap_or(defaults.video_muted),
        rotation: Rotation {
            enabled: rotation
                .get("enabled")
                .and_then(Value::as_bool)
                .unwrap_or(false),
            interval_minutes: rotation
                .get("intervalMinutes")
                .and_then(Value::as_u64)
                .filter(|value| *value >= 1)
                .map(|value| value.min(1440) as u32)
                .unwrap_or(defaults.rotation.interval_minutes),
            collection_id: rotation
                .get("collectionId")
                .and_then(Value::as_str)
                .map(str::to_string),
            shuffle: rotation
                .get("shuffle")
                .and_then(Value::as_bool)
                .unwrap_or(true),
        },
    }
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|value| value.as_millis() as i64)
        .unwrap_or(0)
}

pub fn uuid() -> String {
    // Small dependency-free identifier: enough entropy for local records.
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|value| value.as_nanos())
        .unwrap_or(0);
    let pid = std::process::id() as u128;
    let mixed = nanos ^ (pid << 64) ^ (nanos.count_ones() as u128).rotate_left(31);
    format!(
        "{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
        (mixed >> 96) as u32,
        (mixed >> 80) as u16,
        (mixed >> 64) as u16 & 0x0fff,
        ((mixed >> 48) as u16 & 0x3fff) | 0x8000,
        (mixed & 0xffffffffffff) as u64
    )
}
