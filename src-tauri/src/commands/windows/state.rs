use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use tauri::{AppHandle, Manager};

pub struct SettingsWindowState {
    owner_window_label: Mutex<Option<String>>,
    disabled_windows: Mutex<HashSet<String>>,
}

pub struct CommitWindowState {
    owner_by_commit_label: Mutex<HashMap<String, String>>,
}

impl SettingsWindowState {
    pub fn new() -> Self {
        Self {
            owner_window_label: Mutex::new(None),
            disabled_windows: Mutex::new(HashSet::new()),
        }
    }

    pub(crate) fn set_owner(&self, label: String) {
        if let Ok(mut owner) = self.owner_window_label.lock() {
            *owner = Some(label);
        }
    }

    fn take_owner(&self) -> Option<String> {
        self.owner_window_label
            .lock()
            .ok()
            .and_then(|mut owner| owner.take())
    }

    pub(crate) fn set_disabled_windows(&self, labels: HashSet<String>) {
        if let Ok(mut disabled) = self.disabled_windows.lock() {
            *disabled = labels;
        }
    }

    fn take_disabled_windows(&self) -> HashSet<String> {
        self.disabled_windows
            .lock()
            .map(|mut disabled| std::mem::take(&mut *disabled))
            .unwrap_or_default()
    }
}

impl CommitWindowState {
    pub fn new() -> Self {
        Self {
            owner_by_commit_label: Mutex::new(HashMap::new()),
        }
    }

    pub(crate) fn set_owner(&self, commit_label: String, owner_label: String) {
        if let Ok(mut owners) = self.owner_by_commit_label.lock() {
            owners.insert(commit_label, owner_label);
        }
    }

    fn take_owner(&self, commit_label: &str) -> Option<String> {
        self.owner_by_commit_label
            .lock()
            .ok()
            .and_then(|mut owners| owners.remove(commit_label))
    }
}

pub fn restore_windows_after_settings(app: &AppHandle, state: &SettingsWindowState) {
    for label in state.take_disabled_windows() {
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.set_enabled(true);
        }
    }

    if let Some(owner_label) = state.take_owner() {
        if let Some(window) = app.get_webview_window(&owner_label) {
            let _ = window.set_focus();
        }
    }
}

pub fn restore_window_after_commit(
    app: &AppHandle,
    state: &CommitWindowState,
    commit_window_label: &str,
) {
    if let Some(owner_label) = state.take_owner(commit_window_label) {
        if let Some(window) = app.get_webview_window(&owner_label) {
            let _ = window.set_enabled(true);
            let _ = window.set_focus();
        }
    }
}
