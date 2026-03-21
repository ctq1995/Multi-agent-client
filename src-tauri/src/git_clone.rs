use std::process::Stdio;

use tauri::Emitter;
use tokio::io::AsyncReadExt;

use crate::app_error::AppCommandError;

pub const GIT_CLONE_PROGRESS_EVENT: &str = "app://git-clone-progress";

const GIT_PROGRAM: &str = "git";
const IO_BUFFER_SIZE: usize = 8 * 1024;

#[derive(Debug, Clone, serde::Serialize)]
pub struct GitCloneProgressEvent {
    pub url: String,
    pub target_dir: String,
    pub stage: Option<String>,
    pub percent: Option<u8>,
    pub message: String,
}

pub async fn clone_repository_with_progress(
    app: &tauri::AppHandle,
    url: &str,
    target_dir: &str,
) -> Result<(), AppCommandError> {
    let url = url.trim();
    let target_dir = target_dir.trim();
    if url.is_empty() || target_dir.is_empty() {
        return Err(AppCommandError::invalid_input(
            "Repository URL and target directory are required",
        ));
    }

    emit_clone_progress(app, url, target_dir, "Cloning started");
    let (status, stderr) = run_git_clone(app, url, target_dir).await?;

    if status.success() {
        emit_clone_progress(app, url, target_dir, "Cloning completed");
        return Ok(());
    }

    let stderr = stderr.trim();
    Err(classify_git_clone_error(stderr))
}

async fn run_git_clone(
    app: &tauri::AppHandle,
    url: &str,
    target_dir: &str,
) -> Result<(std::process::ExitStatus, String), AppCommandError> {
    let mut command = crate::process::tokio_command(GIT_PROGRAM);
    command
        .args(["clone", "--progress", url, target_dir])
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    let mut child = command.spawn().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            AppCommandError::dependency_missing("Git is not installed. Please install Git first.")
                .with_detail("https://git-scm.com")
        } else {
            AppCommandError::external_command("Failed to run git clone", e.to_string())
        }
    })?;

    let stderr = child.stderr.take().ok_or_else(|| {
        AppCommandError::external_command("Failed to capture git clone stderr", "stderr missing")
    })?;

    let app_handle = app.clone();
    let url_owned = url.to_string();
    let target_owned = target_dir.to_string();
    let stderr_task = tokio::spawn(async move {
        read_git_progress_stream(&app_handle, &url_owned, &target_owned, stderr).await
    });

    let status = child.wait().await.map_err(AppCommandError::io)?;
    let stderr_output = stderr_task
        .await
        .map_err(|e| AppCommandError::task_execution_failed(e.to_string()))??;

    Ok((status, stderr_output))
}

async fn read_git_progress_stream(
    app: &tauri::AppHandle,
    url: &str,
    target_dir: &str,
    mut stderr: impl tokio::io::AsyncRead + Unpin,
) -> Result<String, AppCommandError> {
    let mut collector = GitCloneStderrCollector::new(app, url, target_dir);

    let mut buffer = vec![0u8; IO_BUFFER_SIZE];
    loop {
        let read = stderr.read(&mut buffer).await.map_err(AppCommandError::io)?;
        if read == 0 {
            break;
        }
        collector.push_chunk(&buffer[..read]);
    }

    collector.flush_pending();
    Ok(collector.into_output())
}

struct GitCloneStderrCollector<'a> {
    app: &'a tauri::AppHandle,
    url: &'a str,
    target_dir: &'a str,
    pending: Vec<u8>,
    collected: String,
    last_message: Option<String>,
}

impl<'a> GitCloneStderrCollector<'a> {
    fn new(app: &'a tauri::AppHandle, url: &'a str, target_dir: &'a str) -> Self {
        Self {
            app,
            url,
            target_dir,
            pending: Vec::new(),
            collected: String::new(),
            last_message: None,
        }
    }

    fn push_chunk(&mut self, chunk: &[u8]) {
        self.pending.extend_from_slice(chunk);
        self.drain_segments();
    }

    fn drain_segments(&mut self) {
        let mut start = 0usize;
        let mut messages: Vec<String> = Vec::new();

        for (idx, byte) in self.pending.iter().copied().enumerate() {
            if byte == b'\n' || byte == b'\r' {
                messages.push(normalize_git_output_segment(&self.pending[start..idx]));
                start = idx + 1;
            }
        }

        if start > 0 {
            self.pending.drain(..start);
        }

        for message in messages {
            self.handle_message(message);
        }
    }

    fn flush_pending(&mut self) {
        if self.pending.is_empty() {
            return;
        }

        let pending = std::mem::take(&mut self.pending);
        self.handle_segment(&pending);
    }

    fn handle_segment(&mut self, segment: &[u8]) {
        let message = normalize_git_output_segment(segment);
        self.handle_message(message);
    }

    fn handle_message(&mut self, message: String) {
        if message.is_empty() {
            return;
        }

        if self.last_message.as_deref() == Some(message.as_str()) {
            return;
        }

        self.last_message = Some(message.clone());
        self.collected.push_str(&message);
        self.collected.push('\n');
        emit_clone_progress(self.app, self.url, self.target_dir, &message);
    }

    fn into_output(self) -> String {
        self.collected
    }
}

fn normalize_git_output_segment(segment: &[u8]) -> String {
    String::from_utf8_lossy(segment).trim().to_string()
}

fn emit_clone_progress(app: &tauri::AppHandle, url: &str, target_dir: &str, message: &str) {
    let percent = extract_git_progress_percent(message);
    let stage = parse_git_progress_stage(message);

    let payload = GitCloneProgressEvent {
        url: url.to_string(),
        target_dir: target_dir.to_string(),
        stage,
        percent,
        message: message.to_string(),
    };

    if let Err(err) = app.emit(GIT_CLONE_PROGRESS_EVENT, payload) {
        eprintln!("[GitClone] failed to emit progress: {err}");
    }
}

fn parse_git_progress_stage(message: &str) -> Option<String> {
    let (prefix, rest) = message.split_once(':')?;
    let prefix = prefix.trim();
    let rest = rest.trim();
    if prefix.is_empty() {
        return None;
    }

    if prefix.eq_ignore_ascii_case("remote") {
        let Some((nested, _)) = rest.split_once(':') else {
            return Some(prefix.to_string());
        };
        let nested = nested.trim();
        if nested.is_empty() {
            return Some(prefix.to_string());
        }
        return Some(nested.to_string());
    }

    Some(prefix.to_string())
}

fn extract_git_progress_percent(message: &str) -> Option<u8> {
    let (before, _) = message.rsplit_once('%')?;
    let digits = before
        .chars()
        .rev()
        .take_while(|ch| ch.is_ascii_digit())
        .collect::<String>();
    let digits = digits.chars().rev().collect::<String>();
    if digits.is_empty() {
        return None;
    }
    let value = digits.parse::<u8>().ok()?;
    if value > 100 {
        return None;
    }
    Some(value)
}

fn classify_git_clone_error(stderr: &str) -> AppCommandError {
    let normalized = stderr.to_lowercase();

    if normalized.contains("already exists and is not an empty directory") {
        return AppCommandError::already_exists("Target directory already exists and is not empty")
            .with_detail(stderr.to_string());
    }

    if normalized.contains("repository not found") {
        return AppCommandError::not_found("Repository not found. Check URL and access permissions.")
            .with_detail(stderr.to_string());
    }

    if normalized.contains("could not resolve host")
        || normalized.contains("network is unreachable")
        || normalized.contains("connection timed out")
        || normalized.contains("failed to connect")
    {
        return AppCommandError::network("Network is unavailable while cloning repository")
            .with_detail(stderr.to_string());
    }

    if normalized.contains("authentication failed")
        || normalized.contains("could not read username")
        || normalized.contains("permission denied (publickey)")
    {
        return AppCommandError::authentication_failed("Authentication failed while cloning repository")
            .with_detail(stderr.to_string());
    }

    if normalized.contains("permission denied") {
        return AppCommandError::permission_denied("Permission denied while cloning repository")
            .with_detail(stderr.to_string());
    }

    AppCommandError::external_command("Git clone failed", stderr.to_string())
}
