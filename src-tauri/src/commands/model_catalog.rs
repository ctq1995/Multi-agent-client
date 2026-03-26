use std::collections::BTreeMap;
use std::time::Duration;

use reqwest::Url;
use serde::Serialize;
use serde_json::Value;

use crate::app_error::AppCommandError;

const MODEL_FETCH_TIMEOUT_SECS: u64 = 20;
const MAX_ERROR_DETAIL_CHARS: usize = 400;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct RemoteModelInfo {
    pub id: String,
    pub name: String,
    pub owned_by: Option<String>,
    pub context_window: Option<u64>,
    pub description: Option<String>,
}

/// Detected provider kind, used to select the correct endpoint path and auth method.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ProviderKind {
    Anthropic,
    Gemini,
    OpenAi, // OpenAI-compatible (default)
}

fn detect_provider(base_url: &Url) -> ProviderKind {
    let host = base_url.host_str().unwrap_or("").to_lowercase();
    if host.contains("anthropic.com") {
        return ProviderKind::Anthropic;
    }
    if host.contains("googleapis.com") || host.contains("generativelanguage") {
        return ProviderKind::Gemini;
    }
    ProviderKind::OpenAi
}

/// Normalise the base URL so it ends with `/v1/` for OpenAI-compatible providers
/// that don't already include it. Anthropic and Gemini keep their own paths.
fn build_models_endpoint(
    base_url: &str,
    provider: ProviderKind,
) -> Result<Url, AppCommandError> {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err(AppCommandError::invalid_input(
            "Provider base URL is required to fetch models",
        ));
    }

    match provider {
        ProviderKind::Anthropic => {
            // Ensure /v1 is in the path (respects custom Anthropic-compatible hosts).
            let with_v1 = ensure_v1_segment(trimmed);
            let rooted = format!("{}/", with_v1.trim_end_matches('/'));
            Url::parse(&rooted)
                .and_then(|u| u.join("models"))
                .map_err(|e| {
                    AppCommandError::configuration_invalid("Failed to build Anthropic model endpoint")
                        .with_detail(e.to_string())
                })
        }
        ProviderKind::Gemini => {
            // Gemini: https://generativelanguage.googleapis.com/v1beta/models
            let with_v1 = ensure_v1beta_segment(trimmed);
            let rooted = format!("{}/", with_v1.trim_end_matches('/'));
            Url::parse(&rooted)
                .and_then(|u| u.join("models"))
                .map_err(|e| {
                    AppCommandError::configuration_invalid("Failed to build Gemini model endpoint")
                        .with_detail(e.to_string())
                })
        }
        ProviderKind::OpenAi => {
            // Ensure /v1 segment present, then append /models.
            let with_v1 = ensure_v1_segment(trimmed);
            let rooted = format!("{}/", with_v1.trim_end_matches('/'));
            Url::parse(&rooted)
                .and_then(|u| u.join("models"))
                .map_err(|e| {
                    AppCommandError::configuration_invalid("Failed to build model list endpoint")
                        .with_detail(e.to_string())
                })
        }
    }
}

/// Ensure the URL path contains a `/v1` segment. If the path already ends with
/// `/v1` or `/v1/...` this is a no-op. Otherwise `/v1` is appended.
fn ensure_v1_segment(url: &str) -> String {
    let lower = url.to_lowercase();
    // Already has /v1 anywhere in the path → keep as-is.
    if lower.contains("/v1") {
        return url.to_owned();
    }
    format!("{}/v1", url.trim_end_matches('/'))
}

/// Like ensure_v1_segment but for Gemini's v1beta prefix.
fn ensure_v1beta_segment(url: &str) -> String {
    let lower = url.to_lowercase();
    if lower.contains("/v1beta") || lower.contains("/v1") {
        return url.to_owned();
    }
    format!("{}/v1beta", url.trim_end_matches('/'))
}

#[tauri::command]
pub async fn fetch_remote_models(
    base_url: String,
    api_key: Option<String>,
) -> Result<Vec<RemoteModelInfo>, AppCommandError> {
    let trimmed_url = base_url.trim();
    // Parse base URL first to detect provider, before we mutate the path.
    let parsed_base = Url::parse(&format!("{}/", trimmed_url.trim_end_matches('/'))).map_err(|e| {
        AppCommandError::configuration_invalid("Provider base URL is invalid")
            .with_detail(e.to_string())
    })?;
    let provider = detect_provider(&parsed_base);
    let endpoint = build_models_endpoint(trimmed_url, provider)?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(MODEL_FETCH_TIMEOUT_SECS))
        .build()
        .map_err(|e| {
            AppCommandError::task_execution_failed("Failed to initialize model fetch client")
                .with_detail(e.to_string())
        })?;

    let key = api_key
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(ToOwned::to_owned);

    let mut request = client
        .get(endpoint.clone())
        .header(reqwest::header::ACCEPT, "application/json")
        .header(
            reqwest::header::USER_AGENT,
            format!("codeg/{}", env!("CARGO_PKG_VERSION")),
        );

    match provider {
        ProviderKind::Anthropic => {
            // Anthropic uses x-api-key header and requires anthropic-version.
            if let Some(ref k) = key {
                request = request
                    .header("x-api-key", k.as_str())
                    .header("anthropic-version", "2023-06-01");
            }
        }
        ProviderKind::Gemini => {
            // Gemini uses ?key= query parameter.
            if let Some(ref k) = key {
                let mut url_with_key = endpoint.clone();
                url_with_key.query_pairs_mut().append_pair("key", k);
                request = client
                    .get(url_with_key)
                    .header(reqwest::header::ACCEPT, "application/json")
                    .header(
                        reqwest::header::USER_AGENT,
                        format!("codeg/{}", env!("CARGO_PKG_VERSION")),
                    );
            }
        }
        ProviderKind::OpenAi => {
            if let Some(ref k) = key {
                request = request.bearer_auth(k);
            }
        }
    }

    let response = request.send().await.map_err(|e| {
        AppCommandError::network("Failed to fetch remote models").with_detail(e.to_string())
    })?;
    let status = response.status();
    let body = response.text().await.map_err(|e| {
        AppCommandError::network("Failed to read remote model response").with_detail(e.to_string())
    })?;

    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return Err(
            AppCommandError::authentication_failed("Remote model request was rejected")
                .with_detail(truncate_detail(&body)),
        );
    }

    if !status.is_success() {
        return Err(
            AppCommandError::network("Failed to fetch remote models").with_detail(format!(
                "HTTP {}: {}",
                status.as_u16(),
                truncate_detail(&body)
            )),
        );
    }

    let payload: Value = serde_json::from_str(&body).map_err(|e| {
        AppCommandError::configuration_invalid("Remote model response is not valid JSON")
            .with_detail(e.to_string())
    })?;

    let models = parse_remote_models(&payload);
    if models.is_empty() {
        return Err(
            AppCommandError::not_found("No models found in remote response")
                .with_detail(truncate_detail(&body)),
        );
    }

    Ok(models)
}

fn truncate_detail(detail: &str) -> String {
    let normalized = detail.trim();
    if normalized.chars().count() <= MAX_ERROR_DETAIL_CHARS {
        return normalized.to_string();
    }

    normalized.chars().take(MAX_ERROR_DETAIL_CHARS).collect()
}

fn parse_remote_models(payload: &Value) -> Vec<RemoteModelInfo> {
    let mut dedup = BTreeMap::<String, RemoteModelInfo>::new();
    collect_remote_models(payload, &mut dedup);
    dedup.into_values().collect()
}

fn collect_remote_models(value: &Value, dedup: &mut BTreeMap<String, RemoteModelInfo>) {
    if let Some(models) = value.as_array() {
        for item in models {
            insert_remote_model(item, None, dedup);
        }
        return;
    }

    // OpenAI-compatible: { "data": [...] }
    if let Some(array) = value.get("data").and_then(Value::as_array) {
        for item in array {
            insert_remote_model(item, None, dedup);
        }
        return;
    }

    // Gemini: { "models": [ { "name": "models/gemini-...", "displayName": "..." } ] }
    // also catches other APIs that use { "models": [...] }
    if let Some(array) = value.get("models").and_then(Value::as_array) {
        for item in array {
            insert_remote_model(item, None, dedup);
        }
        return;
    }

    if let Some(object) = value.get("models").and_then(Value::as_object) {
        for (key, item) in object {
            insert_remote_model(item, Some(key.as_str()), dedup);
        }
        return;
    }

    if let Some(object) = value.as_object() {
        for (key, item) in object {
            if item.is_object() {
                insert_remote_model(item, Some(key.as_str()), dedup);
            }
        }
    }
}

fn insert_remote_model(
    value: &Value,
    fallback_id: Option<&str>,
    dedup: &mut BTreeMap<String, RemoteModelInfo>,
) {
    if let Some(model) = extract_remote_model(value, fallback_id) {
        dedup.entry(model.id.clone()).or_insert(model);
    }
}

fn extract_remote_model(value: &Value, fallback_id: Option<&str>) -> Option<RemoteModelInfo> {
    if let Some(raw) = value.as_str() {
        let id = raw.trim();
        if id.is_empty() {
            return None;
        }
        return Some(RemoteModelInfo {
            id: id.to_string(),
            name: id.to_string(),
            owned_by: None,
            context_window: None,
            description: None,
        });
    }

    let object = value.as_object()?;

    // Gemini returns "name" as "models/gemini-pro" — strip the prefix for the id.
    let raw_id = first_string(
        object,
        &["id", "model", "name", "slug", "key", "model_id"],
    )
    .or_else(|| fallback_id.map(str::trim))
    .filter(|v| !v.is_empty())?;

    // Strip "models/" prefix used by Gemini (e.g. "models/gemini-1.5-pro" → "gemini-1.5-pro").
    let id = raw_id
        .strip_prefix("models/")
        .unwrap_or(raw_id)
        .to_string();

    let display_name = first_string(
        object,
        &["display_name", "displayName", "name", "label", "title"],
    )
    .filter(|v| !v.is_empty())
    .map(|v| {
        // Also strip Gemini prefix from display_name if it slipped through.
        v.strip_prefix("models/").unwrap_or(v).to_string()
    });

    let name = display_name.unwrap_or_else(|| id.clone());

    Some(RemoteModelInfo {
        id,
        name,
        owned_by: first_string(object, &["owned_by", "provider", "organization", "vendor"])
            .map(ToOwned::to_owned),
        context_window: first_u64(
            object,
            &[
                "context_length",
                "context_window",
                "model_context_window",
                "max_context_length",
                "max_input_tokens",
                "inputTokenLimit",
            ],
        ),
        description: first_string(object, &["description", "summary", "architecture"])
            .map(ToOwned::to_owned),
    })
}

fn first_string<'a>(object: &'a serde_json::Map<String, Value>, keys: &[&str]) -> Option<&'a str> {
    for key in keys {
        let Some(value) = object.get(*key) else {
            continue;
        };
        if let Some(raw) = value.as_str() {
            let trimmed = raw.trim();
            if !trimmed.is_empty() {
                return Some(trimmed);
            }
        }
    }
    None
}

fn first_u64(object: &serde_json::Map<String, Value>, keys: &[&str]) -> Option<u64> {
    for key in keys {
        let Some(value) = object.get(*key) else {
            continue;
        };
        if let Some(raw) = value.as_u64() {
            return Some(raw);
        }
        if let Some(raw) = value.as_i64() {
            if raw >= 0 {
                return Some(raw as u64);
            }
        }
        if let Some(raw) = value.as_str() {
            if let Ok(parsed) = raw.trim().parse::<u64>() {
                return Some(parsed);
            }
        }
    }
    None
}
