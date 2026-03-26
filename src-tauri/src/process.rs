use std::ffi::{OsStr, OsString};
use std::path::Path;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const GIT_CONFIG_ARGS: [&str; 4] = [
    "-c",
    "core.quotepath=false",
    "-c",
    "i18n.logOutputEncoding=utf-8",
];
const GIT_UTF8_ENV: [(&str, &str); 2] = [("LC_ALL", "C.UTF-8"), ("LANG", "C.UTF-8")];

pub fn configure_tokio_command(
    command: &mut tokio::process::Command,
) -> &mut tokio::process::Command {
    #[cfg(windows)]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
}

fn is_git_program(program: &OsStr) -> bool {
    let name = Path::new(program)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    name == "git" || name == "git.exe"
}

fn configure_tokio_git_command(command: &mut tokio::process::Command) {
    command.args(GIT_CONFIG_ARGS);
    for (key, value) in GIT_UTF8_ENV {
        command.env(key, value);
    }
}

fn configure_std_git_command(command: &mut std::process::Command) {
    command.args(GIT_CONFIG_ARGS);
    for (key, value) in GIT_UTF8_ENV {
        command.env(key, value);
    }
}

#[cfg(windows)]
fn maybe_windows_cmd_shim(program: &OsStr) -> Option<OsString> {
    let path = Path::new(program);
    if path.components().count() != 1 || path.extension().is_some() {
        return None;
    }

    let raw = program.to_string_lossy();
    let normalized = raw.to_ascii_lowercase();
    let needs_cmd_shim = matches!(
        normalized.as_str(),
        "npm" | "npx" | "pnpm" | "pnpx" | "yarn" | "yarnpkg" | "corepack"
    );

    if needs_cmd_shim {
        Some(OsString::from(format!("{raw}.cmd")))
    } else {
        None
    }
}

pub fn normalized_program<S>(program: S) -> OsString
where
    S: AsRef<OsStr>,
{
    let requested = program.as_ref();

    #[cfg(windows)]
    {
        let shimmed = maybe_windows_cmd_shim(requested);
        if let Ok(resolved) = which::which(requested) {
            return resolved.into_os_string();
        }
        if let Some(ref shimmed_program) = shimmed {
            if let Ok(resolved) = which::which(shimmed_program) {
                return resolved.into_os_string();
            }
            return shimmed_program.clone();
        }
    }

    #[cfg(not(windows))]
    {
        if let Ok(resolved) = which::which(requested) {
            return resolved.into_os_string();
        }
    }

    #[cfg(windows)]
    {
        if let Some(shimmed) = maybe_windows_cmd_shim(requested) {
            return shimmed;
        }
    }

    requested.to_os_string()
}

pub fn tokio_command<S>(program: S) -> tokio::process::Command
where
    S: AsRef<OsStr>,
{
    let normalized = normalized_program(program);
    let mut command = tokio::process::Command::new(&normalized);
    configure_tokio_command(&mut command);
    if is_git_program(&normalized) {
        configure_tokio_git_command(&mut command);
    }
    command
}

pub fn std_command<S>(program: S) -> std::process::Command
where
    S: AsRef<OsStr>,
{
    let normalized = normalized_program(program);
    let mut command = std::process::Command::new(&normalized);

    #[cfg(windows)]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    if is_git_program(&normalized) {
        configure_std_git_command(&mut command);
    }

    command
}
