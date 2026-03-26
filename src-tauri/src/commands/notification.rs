use tauri::AppHandle;

use crate::app_error::AppCommandError;

#[tauri::command]
pub async fn send_notification(
    #[allow(unused_variables)] app: AppHandle,
    title: String,
    body: String,
) -> Result<(), AppCommandError> {
    #[cfg(target_os = "macos")]
    {
        let app_id = if tauri::is_dev() {
            "com.apple.Terminal"
        } else {
            "app.multiagentclient"
        };
        mac_notification_sys::set_application(app_id).map_err(|e| {
            AppCommandError::task_execution_failed("Failed to set notification application")
                .with_detail(e.to_string())
        })?;

        mac_notification_sys::Notification::default()
            .title(&title)
            .message(&body)
            .send()
            .map(|_| ())
            .map_err(|e| {
                AppCommandError::task_execution_failed("Failed to send notification")
                    .with_detail(e.to_string())
            })?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        use tauri_plugin_notification::NotificationExt;
        app.notification()
            .builder()
            .title(title)
            .body(body)
            .show()
            .map_err(|e| {
                AppCommandError::task_execution_failed("Failed to send notification")
                    .with_detail(e.to_string())
            })?;
    }

    Ok(())
}
