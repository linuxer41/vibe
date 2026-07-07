use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_camera::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_vnidrop_share::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            if let (Some(splash), Some(main)) = (
                app.get_webview_window("splashscreen"),
                app.get_webview_window("main"),
            ) {
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                    let _ = splash.close();
                    let _ = main.show();
                    let _ = main.set_focus();
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
