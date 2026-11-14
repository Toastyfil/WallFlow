#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod apply;
mod sources;
mod store;

use std::sync::Mutex;

use serde_json::{Value, json};
use tauri::{AppHandle, Emitter, Manager, State};

use store::{CustomSource, Store, Wallpaper, now_ms, uuid};

struct AppState {
    store: Mutex<Store>,
}

fn active_from(store: &Store) -> Value {
    match store.meta("active") {
        Some(raw) => serde_json::from_str(&raw).unwrap_or(Value::Null),
        None => Value::Null,
    }
}

fn remember_active(store: &mut Store, wallpaper: &Wallpaper) {
    let active = json!({
        "wallpaperId": wallpaper.id,
        "kind": wallpaper.kind,
        "title": wallpaper.title,
        "source": wallpaper.source,
        "appliedAt": now_ms(),
        "thumbUrl": wallpaper.thumb_url,
    });
    store.set_meta("active", Some(active.to_string()));
}

/// Round-robin merge so one fast catalog cannot fill the whole grid.
fn merge_batches(batches: &[(String, Vec<Wallpaper>)], limit: usize) -> Vec<Wallpaper> {
    let longest = batches.iter().map(|(_, items)| items.len()).max().unwrap_or(0);
    let mut merged: Vec<Wallpaper> = Vec::with_capacity(limit);
    let mut seen_urls: Vec<&str> = Vec::new();

    for index in 0..longest {
        for (_, items) in batches {
            let Some(item) = items.get(index) else { continue };
            if merged.len() >= limit {
                return merged;
            }
            if seen_urls.contains(&item.full_url.as_str()) {
                continue;
            }
            seen_urls.push(item.full_url.as_str());
            merged.push(item.clone());
        }
    }

    merged
}

fn run_search(app: &AppHandle, params: Value) -> Result<Value, String> {
    let state = app.state::<AppState>();
    let (settings, custom) = {
        let store = state.store.lock().map_err(|error| error.to_string())?;
        (store.settings(), store.custom_sources())
    };

    let query = params["query"].as_str().unwrap_or("").to_string();
    let page = params["page"].as_u64().unwrap_or(1).max(1) as u32;
    let per_page = params["perPage"].as_u64().unwrap_or(24).clamp(1, 60) as usize;
    let request_id = params["requestId"].as_str().unwrap_or("").to_string();
    let orientation = params["orientation"]
        .as_str()
        .unwrap_or(settings.orientation.as_str())
        .to_string();
    let min_res = settings.min_resolution.clone();
    let single = params["source"]
        .as_str()
        .filter(|source| *source != "all")
        .map(|source| source.to_string());

    let wanted: Vec<String> = match &single {
        Some(source) => vec![source.clone()],
        None => settings.enabled_sources.clone(),
    };

    let mut queue: Vec<(String, Option<CustomSource>)> = Vec::new();
    for id in &wanted {
        match id.as_str() {
            // Local files are browsed on their own page, not in the search feed.
            "local" => {}
            "custom" => {
                if page == 1 {
                    for source in custom.iter().filter(|source| source.enabled) {
                        queue.push(("custom".to_string(), Some(source.clone())));
                    }
                }
            }
            // These catalogs have a single page, so repeating them would only
            // echo the first page back.
            "commons" | "bing" | "deviantart" | "openverse" if page > 1 => {}
            other => queue.push((other.to_string(), None)),
        }
    }

    let (tx, rx) = std::sync::mpsc::channel();
    for (id, custom_source) in queue {
        let tx = tx.clone();
        let query = query.clone();
        let orientation = orientation.clone();
        let min_res = min_res.clone();
        std::thread::spawn(move || {
            let result = sources::search_one(
                &id,
                &query,
                page,
                &orientation,
                &min_res,
                custom_source.as_ref(),
            );
            let _ = tx.send((id, result));
        });
    }
    drop(tx);

    let mut batches: Vec<(String, Vec<Wallpaper>)> = Vec::new();
    let mut errors: Vec<sources::SourceError> = Vec::new();

    for (id, result) in rx {
        match result {
            Ok((items, _)) => {
                batches.push((id, items));
                if !request_id.is_empty() && page == 1 {
                    let _ = app.emit(
                        "sources:partial",
                        json!({ "requestId": request_id, "items": merge_batches(&batches, per_page) }),
                    );
                }
            }
            Err(message) => errors.push(sources::SourceError {
                source: id,
                message,
            }),
        }
    }

    let has_more = batches.iter().any(|(_, items)| items.len() >= 24);

    Ok(json!({
        "items": merge_batches(&batches, per_page),
        "page": page,
        "hasMore": has_more,
        "errors": errors,
    }))
}

#[tauri::command]
async fn sources_search(app: AppHandle, params: Value) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || run_search(&app, params))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn sources_test(app: AppHandle, source: String) -> Value {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let settings = {
            let store = state.store.lock().unwrap();
            store.settings()
        };
        match sources::search_one(
            &source,
            "",
            1,
            &settings.orientation,
            &settings.min_resolution,
            None,
        ) {
            Ok((items, _)) => {
                json!({ "ok": true, "message": format!("{} wallpapers available", items.len()) })
            }
            Err(error) => json!({ "ok": false, "message": error }),
        }
    })
    .await
    .unwrap_or_else(|error| json!({ "ok": false, "message": error.to_string() }))
}

#[tauri::command]
fn settings_get(state: State<'_, AppState>) -> Value {
    state
        .store
        .lock()
        .map(|store| serde_json::to_value(store.settings()).unwrap_or(Value::Null))
        .unwrap_or(Value::Null)
}

#[tauri::command]
fn settings_update(state: State<'_, AppState>, patch: Value) -> Value {
    let mut store = state.store.lock().unwrap();
    store.update_settings(patch);
    serde_json::to_value(store.settings()).unwrap_or(Value::Null)
}

#[tauri::command]
fn collections_list(state: State<'_, AppState>) -> Value {
    json!(state.store.lock().unwrap().collections())
}

#[tauri::command]
fn collections_create(state: State<'_, AppState>, name: String) -> Value {
    let name = name.trim().chars().take(60).collect::<String>();
    json!(state.store.lock().unwrap().create_collection(name))
}

#[tauri::command]
fn collections_rename(state: State<'_, AppState>, id: String, name: String) -> Value {
    let mut store = state.store.lock().unwrap();
    store.rename_collection(&id, name.trim().chars().take(60).collect::<String>());
    json!(store.collections())
}

#[tauri::command]
fn collections_remove(state: State<'_, AppState>, id: String) -> Value {
    let mut store = state.store.lock().unwrap();
    store.delete_collection(&id);
    if store.settings().rotation.collection_id.as_deref() == Some(id.as_str()) {
        store.update_settings(json!({ "rotation": { "collectionId": null } }));
    }
    json!(store.collections())
}

#[tauri::command]
fn collections_items(state: State<'_, AppState>, id: String) -> Value {
    json!(state.store.lock().unwrap().collection_items(&id))
}

#[tauri::command]
fn collections_add(state: State<'_, AppState>, collection_id: String, wallpaper: Wallpaper) -> Value {
    let mut store = state.store.lock().unwrap();
    store.add_to_collection(&collection_id, wallpaper);
    json!(store.collections())
}

#[tauri::command]
fn collections_remove_item(
    state: State<'_, AppState>,
    collection_id: String,
    wallpaper_id: String,
) -> Value {
    let mut store = state.store.lock().unwrap();
    store.remove_from_collection(&collection_id, &wallpaper_id);
    json!(store.collections())
}

#[tauri::command]
fn favorites_list(state: State<'_, AppState>) -> Value {
    json!(state.store.lock().unwrap().favorites())
}

#[tauri::command]
fn favorites_toggle(state: State<'_, AppState>, wallpaper: Wallpaper) -> Value {
    let mut store = state.store.lock().unwrap();
    let favorite = store.toggle_favorite(wallpaper);
    json!({ "favorite": favorite, "favorites": store.favorites() })
}

#[tauri::command]
fn custom_list(state: State<'_, AppState>) -> Value {
    json!(state.store.lock().unwrap().custom_sources())
}

#[tauri::command]
fn custom_add(state: State<'_, AppState>, input: Value) -> Value {
    let name = input["name"]
        .as_str()
        .unwrap_or("")
        .trim()
        .chars()
        .take(60)
        .collect::<String>();
    let url = input["url"].as_str().unwrap_or("").trim().to_string();
    let kind = if input["kind"].as_str() == Some("direct") {
        "direct"
    } else {
        "rss"
    };

    let mut store = state.store.lock().unwrap();
    if !name.is_empty() && (url.starts_with("http://") || url.starts_with("https://")) {
        store.add_custom_source(CustomSource {
            id: uuid(),
            name,
            url,
            kind: kind.to_string(),
            enabled: true,
            created_at: now_ms(),
        });
    }
    json!(store.custom_sources())
}

#[tauri::command]
fn custom_remove(state: State<'_, AppState>, id: String) -> Value {
    let mut store = state.store.lock().unwrap();
    store.remove_custom_source(&id);
    json!(store.custom_sources())
}

#[tauri::command]
fn custom_toggle(state: State<'_, AppState>, id: String, enabled: bool) -> Value {
    let mut store = state.store.lock().unwrap();
    store.set_custom_source_enabled(&id, enabled);
    json!(store.custom_sources())
}

#[tauri::command]
async fn wallpaper_apply(app: AppHandle, wallpaper: Wallpaper) -> Value {
    let job = wallpaper.clone();
    let applied = tauri::async_runtime::spawn_blocking(move || {
        if job.id.is_empty() || job.full_url.is_empty() {
            return Err("This wallpaper is missing a download URL".to_string());
        }
        if job.kind == "video" {
            return Err("Video wallpapers are not available in the Rust build yet".to_string());
        }
        if job.source == "local" {
            apply::set_wallpaper(std::path::Path::new(&job.full_url))
        } else {
            apply::download(&job.full_url).and_then(|path| apply::set_wallpaper(&path))
        }
    })
    .await
    .unwrap_or_else(|error| Err(error.to_string()));

    match applied {
        Ok(()) => {
            let state = app.state::<AppState>();
            let active = {
                let mut store = state.store.lock().unwrap();
                remember_active(&mut store, &wallpaper);
                active_from(&store)
            };
            let _ = app.emit("wallpaper:changed", active);
            json!({ "ok": true, "message": "Wallpaper applied" })
        }
        Err(message) => json!({ "ok": false, "message": message }),
    }
}

#[tauri::command]
fn wallpaper_clear(state: State<'_, AppState>) -> Value {
    let mut store = state.store.lock().unwrap();
    store.set_meta("active", None);
    Value::Null
}

#[tauri::command]
fn wallpaper_active(state: State<'_, AppState>) -> Value {
    active_from(&state.store.lock().unwrap())
}

#[tauri::command]
fn rotation_state(state: State<'_, AppState>) -> Value {
    let store = state.store.lock().unwrap();
    let settings = store.settings();
    let next = store
        .meta("rotationNextRun")
        .and_then(|raw| raw.parse::<i64>().ok());
    json!({
        "enabled": settings.rotation.enabled,
        "intervalMinutes": settings.rotation.interval_minutes,
        "collectionId": settings.rotation.collection_id,
        "nextRunAt": next,
        "lastAppliedId": store.meta("rotationLastId"),
    })
}

#[tauri::command]
fn rotation_sync(state: State<'_, AppState>) -> Value {
    {
        let mut store = state.store.lock().unwrap();
        let settings = store.settings();
        let next = if settings.rotation.enabled {
            Some(now_ms() + (settings.rotation.interval_minutes as i64) * 60_000)
        } else {
            None
        };
        store.set_meta("rotationNextRun", next.map(|value| value.to_string()));
    }
    rotation_state(state)
}

#[tauri::command]
fn display_info() -> Value {
    let (width, height) = screen_size();
    json!({
        "current": { "width": width, "height": height, "refresh": 60 },
        "modes": [{ "width": width, "height": height, "refresh": 60 }],
    })
}

#[tauri::command]
fn display_set(mode: Value) -> Value {
    let width = mode["width"].as_u64().unwrap_or(0);
    let height = mode["height"].as_u64().unwrap_or(0);
    let (current_width, current_height) = screen_size();
    if width as u32 == current_width && height as u32 == current_height {
        return json!({ "ok": true, "message": "Already using this resolution" });
    }
    json!({
        "ok": false,
        "message": "Changing the display resolution is not available in the Rust build yet",
    })
}

#[tauri::command]
fn app_info(app: AppHandle) -> Value {
    json!({
        "version": app.package_info().version.to_string(),
        "electron": "rust + tauri",
        "platform": "win32",
        "storage": "json",
    })
}

#[tauri::command]
fn app_open_external(url: String) -> Value {
    let _ = std::process::Command::new("cmd")
        .args(["/C", "start", "", &url])
        .spawn();
    Value::Null
}

#[tauri::command]
fn app_open_cache() -> Value {
    let _ = std::process::Command::new("explorer")
        .arg(store::cache_dir())
        .spawn();
    Value::Null
}

#[tauri::command]
fn local_list(state: State<'_, AppState>) -> Value {
    json!(state.store.lock().unwrap().local())
}

#[tauri::command]
async fn local_add(app: AppHandle, paths: Vec<String>) -> Value {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let mut store = state.store.lock().unwrap();
        let mut items = store.local();
        let mut added = 0;

        for path in paths {
            let path = std::path::PathBuf::from(path);
            let files = expand(&path);
            for file in files {
                let id = format!("local:{}", file.to_string_lossy());
                if items.iter().any(|item| item.id == id) {
                    continue;
                }
                let title = file
                    .file_stem()
                    .map(|stem| stem.to_string_lossy().to_string())
                    .unwrap_or_else(|| "Local wallpaper".to_string());
                items.push(Wallpaper {
                    id,
                    source: "local".into(),
                    source_label: Some("Local".into()),
                    kind: "image".into(),
                    title,
                    author: Some("Local file".into()),
                    page_url: None,
                    thumb_url: file.to_string_lossy().to_string(),
                    preview_url: file.to_string_lossy().to_string(),
                    full_url: file.to_string_lossy().to_string(),
                    video_url: None,
                    width: 0,
                    height: 0,
                    color: None,
                    created_at: None,
                });
                added += 1;
            }
        }

        items.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
        store.set_local(items.clone());
        json!({ "added": added, "items": items })
    })
    .await
    .unwrap_or_else(|error| json!({ "added": 0, "items": [], "error": error.to_string() }))
}

#[tauri::command]
fn local_remove(state: State<'_, AppState>, id: String) -> Value {
    let mut store = state.store.lock().unwrap();
    let mut items = store.local();
    items.retain(|item| item.id != id);
    store.set_local(items.clone());
    json!(items)
}

fn expand(path: &std::path::Path) -> Vec<std::path::PathBuf> {
    let mut out = Vec::new();
    if path.is_file() {
        if is_image(path) {
            out.push(path.to_path_buf());
        }
        return out;
    }
    let Ok(entries) = std::fs::read_dir(path) else {
        return out;
    };
    for entry in entries.flatten() {
        let child = entry.path();
        if child.is_dir() {
            out.extend(expand(&child));
        } else if is_image(&child) {
            out.push(child);
        }
    }
    out
}

fn is_image(path: &std::path::Path) -> bool {
    matches!(
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.to_lowercase())
            .as_deref(),
        Some("jpg" | "jpeg" | "png" | "webp" | "bmp" | "gif" | "avif")
    )
}

/// Windows' own dark title bar is dark grey; paint it the app's near-black.
fn paint_title_bar(app: &AppHandle) {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::Graphics::Dwm::{
            DWMWA_BORDER_COLOR, DWMWA_CAPTION_COLOR, DWMWA_TEXT_COLOR, DwmSetWindowAttribute,
        };

        let Some(window) = app.get_webview_window("main") else {
            return;
        };
        let Ok(hwnd) = window.hwnd() else { return };
        let hwnd = HWND(hwnd.0 as *mut core::ffi::c_void);

        // COLORREF is 0x00BBGGRR, so #0b0c0f becomes 0x000F0C0B.
        let caption: u32 = 0x000F_0C0B;
        let border: u32 = 0x000F_0C0B;
        let text: u32 = 0x00FF_FFFF;

        unsafe {
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_CAPTION_COLOR,
                &caption as *const u32 as *const core::ffi::c_void,
                4,
            );
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_BORDER_COLOR,
                &border as *const u32 as *const core::ffi::c_void,
                4,
            );
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_TEXT_COLOR,
                &text as *const u32 as *const core::ffi::c_void,
                4,
            );
        }
    }
}

fn screen_size() -> (u32, u32) {
    use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN};
    unsafe {
        (
            GetSystemMetrics(SM_CXSCREEN).max(0) as u32,
            GetSystemMetrics(SM_CYSCREEN).max(0) as u32,
        )
    }
}

fn start_rotation_loop(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(30));
        let state = app.state::<AppState>();
        let (settings, candidates) = {
            let store = match state.store.lock() {
                Ok(store) => store,
                Err(_) => continue,
            };
            let settings = store.settings();
            if !settings.rotation.enabled {
                continue;
            }
            let pool = match &settings.rotation.collection_id {
                Some(id) => store.collection_items(id),
                None => store.favorites(),
            };
            (settings, pool)
        };

        if candidates.is_empty() {
            continue;
        }

        let due = {
            let store = state.store.lock().unwrap();
            store
                .meta("rotationNextRun")
                .and_then(|raw| raw.parse::<i64>().ok())
                .map(|next| now_ms() >= next)
                .unwrap_or(true)
        };
        if !due {
            continue;
        }

        let index = if settings.rotation.shuffle {
            (now_ms() as usize) % candidates.len()
        } else {
            0
        };
        let wallpaper = candidates[index].clone();
        let applied = if wallpaper.source == "local" {
            apply::set_wallpaper(std::path::Path::new(&wallpaper.full_url))
        } else {
            apply::download(&wallpaper.full_url).and_then(|path| apply::set_wallpaper(&path))
        };

        let mut store = state.store.lock().unwrap();
        store.set_meta(
            "rotationNextRun",
            Some((now_ms() + settings.rotation.interval_minutes as i64 * 60_000).to_string()),
        );
        if applied.is_ok() {
            store.set_meta("rotationLastId", Some(wallpaper.id.clone()));
            remember_active(&mut store, &wallpaper);
            let active = active_from(&store);
            drop(store);
            let _ = app.emit("wallpaper:changed", active);
        }
    });
}

fn selftest() {
    let store = Store::open();
    println!("store ok · settings v{}", store.settings().version);
    let started = std::time::Instant::now();
    for source in ["bing", "wallhaven", "commons", "konachan", "safebooru", "deviantart"] {
        let watch = std::time::Instant::now();
        match sources::search_one(source, "", 1, "landscape", "any", None) {
            Ok((items, _)) => println!(
                "{source}: {} wallpapers in {}ms",
                items.len(),
                watch.elapsed().as_millis()
            ),
            Err(error) => println!("{source}: error {error}"),
        }
    }
    println!("total {}ms", started.elapsed().as_millis());
}

fn main() {
    if std::env::args().any(|arg| arg == "--selftest") {
        selftest();
        return;
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            store: Mutex::new(Store::open()),
        })
        .invoke_handler(tauri::generate_handler![
            sources_search,
            sources_test,
            settings_get,
            settings_update,
            collections_list,
            collections_create,
            collections_rename,
            collections_remove,
            collections_items,
            collections_add,
            collections_remove_item,
            favorites_list,
            favorites_toggle,
            custom_list,
            custom_add,
            custom_remove,
            custom_toggle,
            wallpaper_apply,
            wallpaper_clear,
            wallpaper_active,
            rotation_state,
            rotation_sync,
            display_info,
            display_set,
            app_info,
            app_open_external,
            app_open_cache,
            local_list,
            local_add,
            local_remove,
        ])
        .setup(|app| {
            start_rotation_loop(app.handle().clone());
            // The window chrome must be black too, not the system light grey.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_theme(Some(tauri::Theme::Dark));
                // The sidebar already shows the app name, so the caption keeps only
                // its window buttons instead of repeating "WallFlow".
                let _ = window.set_title("");
            }
            paint_title_bar(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running WallFlow");
}
