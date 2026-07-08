use crate::protocol;
use serde::Serialize;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::Mutex;

#[derive(Clone, Serialize)]
pub struct BackendFrame {
    pub msg_type: u16,
    pub flags: u16,
    pub stream_id: u32,
    pub payload: Vec<u8>,
}

pub struct TauriTcpClient {
    pub stream: Arc<Mutex<Option<TcpStream>>>,
}

impl TauriTcpClient {
    pub fn new() -> Self {
        Self {
            stream: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn connect(
        &self,
        addr: &str,
        token: &str,
        app_handle: tauri::AppHandle,
    ) -> Result<(), String> {
        let stream = TcpStream::connect(addr)
            .await
            .map_err(|e| format!("TCP connect failed: {}", e))?;

        let auth_payload = serde_json::json!({ "token": token }).to_string().into_bytes();
        let auth_frame = protocol::encode_frame(
            protocol::msg_type::AUTH_RESTORE,
            protocol::flags::REQUEST,
            1,
            &auth_payload,
        );
        stream
            .writable()
            .await
            .map_err(|e| format!("wait writable: {}", e))?;
        stream
            .try_write(&auth_frame)
            .map_err(|e| format!("write auth: {}", e))?;

        *self.stream.lock().await = Some(stream.try_clone().await.map_err(|e| format!("clone: {}", e))?);

        let client = Self {
            stream: self.stream.clone(),
        };
        tokio::spawn(async move {
            client.read_loop(app_handle).await;
        });

        Ok(())
    }

    async fn read_loop(&self, app_handle: tauri::AppHandle) {
        let mut buffer = Vec::new();
        loop {
            let mut stream_opt = self.stream.lock().await;
            let stream = match stream_opt.as_mut() {
                Some(s) => s,
                None => break,
            };

            let mut chunk = vec![0u8; 4096];
            let n = match stream.read(&mut chunk).await {
                Ok(0) => break,
                Ok(n) => n,
                Err(_) => break,
            };
            drop(stream_opt);

            buffer.extend_from_slice(&chunk[..n]);
            loop {
                if buffer.len() < protocol::HEADER_SIZE {
                    break;
                }
                let payload_len =
                    u32::from_be_bytes([buffer[10], buffer[11], buffer[12], buffer[13]]) as usize;
                if buffer.len() < protocol::HEADER_SIZE + payload_len {
                    break;
                }
                let frame_data = buffer[..protocol::HEADER_SIZE + payload_len].to_vec();
                buffer.drain(..protocol::HEADER_SIZE + payload_len);

                if let Some((msg_type, flags, stream_id, payload)) =
                    protocol::decode_frame(&frame_data)
                {
                    let bf = BackendFrame {
                        msg_type,
                        flags,
                        stream_id,
                        payload,
                    };
                    let _ = app_handle.emit("backend-frame", bf);
                }
            }
        }
        let _ = app_handle.emit("backend-disconnected", ());
    }

    pub async fn send_frame(&self, msg_type: u16, flags: u16, stream_id: u32, payload: Vec<u8>) -> Result<(), String> {
        let frame = protocol::encode_frame(msg_type, flags, stream_id, &payload);
        let mut stream_opt = self.stream.lock().await;
        let stream = stream_opt.as_mut().ok_or("not connected")?;
        stream
            .write_all(&frame)
            .await
            .map_err(|e| format!("write: {}", e))
    }

    pub async fn disconnect(&self) {
        let mut stream_opt = self.stream.lock().await;
        *stream_opt = None;
    }
}
