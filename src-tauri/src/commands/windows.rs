mod routes;
mod state;
mod style;

use std::collections::HashSet;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::app_error::AppCommandError;
use crate::db::AppDatabase;
use crate::models::FolderHistoryEntry;

pub use state::{restore_window_after_commit, restore_windows_after_settings};
pub use state::{CommitWindowState, SettingsWindowState};
pub(crate) use routes::to_tauri_app_path;
pub(crate) use style::apply_platform_window_style;

pub fn folder_window_label(folder_id: i32) -> String {
    format!("folder-{folder_id}")
}

fn get_folder_id_from_window(window: &tauri::WebviewWindow) -> Option<i32> {
    let url = window.url().ok()?;
    url.query_pairs()
        .find(|(key, _)| key == "id")
        .and_then(|(_, value)| value.parse::<i32>().ok())
}

#[tauri::command]
pub async fn list_open_folders(
    app: AppHandle,
    db: tauri::State<'_, AppDatabase>,
) -> Result<Vec<FolderHistoryEntry>, AppCommandError> {
    let windows = app.webview_windows();
    let mut folder_ids: Vec<i32> = Vec::new();

    for (label, window) in &windows {
        if label.starts_with("folder-") {
            if let Some(id) = get_folder_id_from_window(window) {
                folder_ids.push(id);
            }
        }
    }

    let all_folders = crate::db::service::folder_service::list_folders(&db.conn)
        .await
        .map_err(AppCommandError::from)?;

    let open_folders: Vec<FolderHistoryEntry> = all_folders
        .into_iter()
        .filter(|f| folder_ids.contains(&f.id))
        .collect();

    Ok(open_folders)
}

#[tauri::command]
pub async fn focus_folder_window(app: AppHandle, folder_id: i32) -> Result<(), AppCommandError> {
    let windows = app.webview_windows();
    for (label, window) in &windows {
        if label.starts_with("folder-") {
            if let Some(id) = get_folder_id_from_window(window) {
                if id == folder_id {
                    window.set_focus().map_err(|e| {
                        AppCommandError::window("Failed to focus folder window", e.to_string())
                    })?;
                    return Ok(());
                }
            }
        }
    }
    Err(
        AppCommandError::not_found(format!("No open window for folder {folder_id}"))
            .with_detail(format!("folder_id={folder_id}")),
    )
}

#[tauri::command]
pub async fn open_folder_window(
    app: AppHandle,
    db: tauri::State<'_, AppDatabase>,
    path: String,
) -> Result<(), AppCommandError> {
    // Add to history via DB
    let entry = crate::db::service::folder_service::add_folder(&db.conn, &path)
        .await
        .map_err(AppCommandError::from)?;

    let label = folder_window_label(entry.id);
    if let Some(existing) = app.get_webview_window(&label) {
        style::ensure_windows_undecorated(&existing);
        let _ = existing.unminimize();
        existing
            .set_focus()
            .map_err(|e| AppCommandError::window("Failed to focus folder window", e.to_string()))?;
        if let Some(w) = app.get_webview_window("welcome") {
            let _ = w.close();
        }
        return Ok(());
    }

    let route = format!("folder?id={}", entry.id);
    let url = WebviewUrl::App(to_tauri_app_path(&route).into());
    let builder = WebviewWindowBuilder::new(&app, &label, url)
        .title(&entry.name)
        .inner_size(1260.0, 860.0)
        .min_inner_size(900.0, 600.0);
    let folder_window = apply_platform_window_style(builder)
        .build()
        .map_err(|e| AppCommandError::window("Failed to open folder window", e.to_string()))?;
    style::ensure_windows_undecorated(&folder_window);

    // Close welcome window
    if let Some(w) = app.get_webview_window("welcome") {
        w.close().map_err(|e| {
            AppCommandError::window("Failed to close welcome window", e.to_string())
        })?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_commit_window(
    app: AppHandle,
    window: tauri::WebviewWindow,
    db: tauri::State<'_, AppDatabase>,
    state: tauri::State<'_, CommitWindowState>,
    folder_id: i32,
) -> Result<(), AppCommandError> {
    let owner_label = window.label().to_string();
    let label = format!("commit-{folder_id}");

    if let Some(existing) = app.get_webview_window(&label) {
        if let Some(owner_window) = app.get_webview_window(&owner_label) {
            owner_window.set_enabled(false).map_err(|e| {
                AppCommandError::window("Failed to disable owner window", e.to_string())
            })?;
        }
        state.set_owner(label.clone(), owner_label);
        let _ = existing.unminimize();
        existing
            .set_focus()
            .map_err(|e| AppCommandError::window("Failed to focus commit window", e.to_string()))?;
        return Ok(());
    }

    let folder = crate::db::service::folder_service::get_folder_by_id(&db.conn, folder_id)
        .await
        .map_err(AppCommandError::from)?
        .ok_or_else(|| {
            AppCommandError::not_found(format!("Folder {folder_id} not found"))
                .with_detail(format!("folder_id={folder_id}"))
        })?;

    let route = format!("commit?folderId={folder_id}");
    let url = WebviewUrl::App(to_tauri_app_path(&route).into());
    let builder = WebviewWindowBuilder::new(&app, &label, url)
        .title(format!("提交代码 - {}", folder.name))
        .inner_size(1220.0, 820.0)
        .min_inner_size(980.0, 620.0);
    let builder = builder
        .parent(&window)
        .map_err(|e| AppCommandError::window("Failed to set commit window parent", e.to_string()))?
        .center();
    let commit_window = apply_platform_window_style(builder)
        .build()
        .map_err(|e| AppCommandError::window("Failed to open commit window", e.to_string()))?;
    style::ensure_windows_undecorated(&commit_window);
    if let Some(owner_window) = app.get_webview_window(&owner_label) {
        if let Err(err) = owner_window.set_enabled(false) {
            let _ = commit_window.close();
            return Err(AppCommandError::window(
                "Failed to disable owner window",
                err.to_string(),
            ));
        }
    }
    state.set_owner(label, owner_label);
    commit_window
        .set_focus()
        .map_err(|e| AppCommandError::window("Failed to focus commit window", e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub async fn open_settings_window(
    app: AppHandle,
    window: tauri::WebviewWindow,
    section: Option<String>,
    agent_type: Option<String>,
    state: tauri::State<'_, SettingsWindowState>,
) -> Result<(), AppCommandError> {
    let target_route = routes::resolve_settings_target(section.as_deref(), agent_type.as_deref());
    if let Some(existing) = app.get_webview_window("settings") {
        style::ensure_windows_undecorated(&existing);
        if section.is_some() || agent_type.is_some() {
            let target_path = routes::to_tauri_nav_url(&target_route);
            let target_json = serde_json::to_string(&target_path).map_err(|e| {
                AppCommandError::window("Failed to build settings navigation target", e.to_string())
            })?;
            let nav_script = format!("window.location.replace({target_json});");
            existing.eval(&nav_script).map_err(|e| {
                AppCommandError::window("Failed to navigate settings window", e.to_string())
            })?;
        }
        let _ = existing.unminimize();
        existing.set_focus().map_err(|e| {
            AppCommandError::window("Failed to focus settings window", e.to_string())
        })?;
        return Ok(());
    }

    let owner_label = window.label().to_string();
    let url = WebviewUrl::App(to_tauri_app_path(&target_route).into());
    let builder = WebviewWindowBuilder::new(&app, "settings", url)
        .title("Settings")
        .inner_size(1080.0, 700.0)
        .min_inner_size(1080.0, 600.0);
    let builder = builder
        .parent(&window)
        .map_err(|e| {
            AppCommandError::window("Failed to set settings window parent", e.to_string())
        })?
        .center();
    let settings_window = apply_platform_window_style(builder)
        .build()
        .map_err(|e| AppCommandError::window("Failed to open settings window", e.to_string()))?;
    style::ensure_windows_undecorated(&settings_window);

    let mut disabled = HashSet::new();
    for (label, webview) in app.webview_windows() {
        if label != "settings" {
            webview.set_enabled(false).map_err(|e| {
                AppCommandError::window("Failed to update window enabled state", e.to_string())
            })?;
            disabled.insert(label);
        }
    }

    state.set_owner(owner_label);
    state.set_disabled_windows(disabled);
    settings_window
        .set_focus()
        .map_err(|e| AppCommandError::window("Failed to focus settings window", e.to_string()))?;
    Ok(())
}

pub fn open_welcome_window(app: &AppHandle) -> Result<(), AppCommandError> {
    if let Some(existing) = app.get_webview_window("welcome") {
        style::ensure_windows_undecorated(&existing);
        return Ok(());
    }
    let url = WebviewUrl::App(to_tauri_app_path("welcome").into());
    let builder = WebviewWindowBuilder::new(app, "welcome", url)
        .title("Multi-agent-client")
        .inner_size(800.0, 520.0)
        .min_inner_size(600.0, 400.0)
        .center();
    let welcome_window = apply_platform_window_style(builder)
        .build()
        .map_err(|e| AppCommandError::window("Failed to open welcome window", e.to_string()))?;
    style::ensure_windows_undecorated(&welcome_window);
    Ok(())
}
