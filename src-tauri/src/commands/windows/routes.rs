fn normalize_route(route: &str) -> (String, Option<String>) {
    let (path, query) = route.split_once('?').unwrap_or((route, ""));
    let normalized_path = path.trim_start_matches('/').trim_end_matches('/').to_string();
    let normalized_query = if query.is_empty() {
        None
    } else {
        Some(query.to_string())
    };
    (normalized_path, normalized_query)
}

fn to_static_export_app_path(route: &str) -> String {
    let (path, query) = normalize_route(route);
    let html_path = if path.is_empty() {
        "index.html".to_string()
    } else if path.ends_with(".html") {
        path
    } else {
        format!("{path}.html")
    };

    match query {
        Some(query) => format!("{html_path}?{query}"),
        None => html_path,
    }
}

pub(crate) fn to_tauri_app_path(route: &str) -> String {
    // Next dev server serves clean URLs, while `output: "export"` emits static `*.html` files.
    // Tauri's asset protocol does not rewrite clean URLs to `*.html`, so we map routes in release.
    if cfg!(debug_assertions) {
        let (path, query) = normalize_route(route);
        match query {
            Some(query) if !path.is_empty() => format!("{path}?{query}"),
            Some(query) => format!("?{query}"),
            None => path,
        }
    } else {
        to_static_export_app_path(route)
    }
}

pub(crate) fn to_tauri_nav_url(route: &str) -> String {
    let app_path = to_tauri_app_path(route);
    if app_path.is_empty() {
        "/".to_string()
    } else {
        format!("/{app_path}")
    }
}

fn resolve_settings_route(section: Option<&str>) -> &'static str {
    match section {
        Some("appearance") => "settings/appearance",
        Some("agents") => "settings/agents",
        Some("mcp") => "settings/mcp",
        Some("skills") => "settings/skills",
        Some("shortcuts") => "settings/shortcuts",
        Some("system") => "settings/system",
        _ => "settings/system",
    }
}

fn normalize_agent_query(agent_type: Option<&str>) -> Option<String> {
    let raw = agent_type?.trim();
    if raw.is_empty() {
        return None;
    }
    if raw
        .chars()
        .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_')
    {
        return Some(raw.to_string());
    }
    None
}

pub(crate) fn resolve_settings_target(section: Option<&str>, agent_type: Option<&str>) -> String {
    let route = resolve_settings_route(section);
    if route == "settings/agents" {
        if let Some(agent) = normalize_agent_query(agent_type) {
            return format!("{route}?agent={agent}");
        }
    }
    route.to_string()
}
