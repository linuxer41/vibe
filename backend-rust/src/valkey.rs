use redis::aio::ConnectionManager;
use tokio_stream::StreamExt;
use socketioxide::SocketIo;
use tracing::{error, info};

use crate::format;

pub async fn connect() -> Result<ConnectionManager, Box<dyn std::error::Error + Send + Sync>> {
    let url = std::env::var("VALKEY_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let client = redis::Client::open(url.as_str())?;
    let conn = ConnectionManager::new(client).await?;
    Ok(conn)
}

pub async fn publish(
    conn: &ConnectionManager,
    channel: &str,
    payload: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut conn = conn.clone();
    redis::cmd("PUBLISH")
        .arg(channel)
        .arg(payload)
        .query_async::<i32>(&mut conn)
        .await?;
    Ok(())
}

pub fn start_subscriber(
    io: SocketIo,
    channels: &[&str],
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let url = std::env::var("VALKEY_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let channels: Vec<String> = channels.iter().map(|s| s.to_string()).collect();

    tokio::spawn(async move {
        loop {
            match try_subscribe(&url, &channels, &io).await {
                Ok(_) => info!("Valkey subscriber finished (reconnecting...)"),
                Err(e) => error!("Valkey subscriber error: {} (reconnecting...)", e),
            }
            tokio::time::sleep(std::time::Duration::from_secs(3)).await;
        }
    });

    Ok(())
}

async fn try_subscribe(
    url: &str,
    channels: &[String],
    io: &SocketIo,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = redis::Client::open(url)?;
    let mut conn = client.get_async_connection().await?;

    let mut pubsub = conn.into_pubsub();
    for ch in channels {
        pubsub.subscribe(ch).await?;
        info!("Subscribed to Valkey channel: {}", ch);
    }

    let mut stream = pubsub.on_message();
    while let Some(msg) = stream.next().await {
        let payload: Vec<u8> = msg.get_payload()?;
        let (_, target_room, event, data) = format::decode_valkey(&payload);
        info!("Valkey message on {}: {}", msg.get_channel_name(), event);

        if let Some(room) = target_room {
            let _ = io.to(room).emit(&event, &data).await;
        } else {
            let _ = io.emit(&event, &data).await;
        }
    }
    Ok(())
}
