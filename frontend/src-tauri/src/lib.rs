pub mod generated {
    #![allow(unused, dead_code, non_snake_case)]
    include!("generated/vibe_generated.rs");
}

mod protocol;
mod tcp_client;

use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;
use tcp_client::TauriTcpClient;

struct AppState {
    client: Arc<Mutex<TauriTcpClient>>,
}

#[tauri::command]
async fn connect_backend(
    addr: String,
    token: String,
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let client = state.client.lock().await;
    client.connect(&addr, &token, app_handle).await
}

#[tauri::command]
async fn send_raw_frame(
    raw: Vec<u8>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let Some((msg_type, flags, stream_id, payload)) = protocol::decode_frame(&raw) else {
        return Err("invalid frame".into());
    };
    let client = state.client.lock().await;
    client.send_frame(msg_type, flags, stream_id, payload).await
}

#[tauri::command]
async fn disconnect_backend(state: State<'_, AppState>) -> Result<(), String> {
    let client = state.client.lock().await;
    client.disconnect().await;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_camera::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_vnidrop_share::init())
        .manage(AppState {
            client: Arc::new(Mutex::new(TauriTcpClient::new())),
        })
        .invoke_handler(tauri::generate_handler![
            connect_backend,
            send_raw_frame,
            disconnect_backend,
        ]);

    #[cfg(mobile)]
    {
        builder = builder.plugin(tauri_plugin_system_bars_styles::init());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
