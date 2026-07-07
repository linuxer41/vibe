use socketioxide::SocketIo;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tracing::{error, info, warn};

use crate::format;

fn get_valkey_url() -> String {
    std::env::var("VALKEY_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string())
}

/// Extract host, port, password from redis:// URL
fn parse_redis_url(url: &str) -> (String, u16, Option<String>) {
    let rest = url.strip_prefix("redis://").unwrap_or(url);
    let (userinfo, hostport) = if let Some(at) = rest.rfind('@') {
        (&rest[..at], &rest[at + 1..])
    } else {
        ("", rest)
    };
    let password = if userinfo.contains(':') {
        userinfo.split(':').nth(1).map(|s| s.to_string())
    } else if !userinfo.is_empty() {
        Some(userinfo.to_string())
    } else {
        None
    };
    let hostport = hostport.split('/').next().unwrap_or(hostport);
    let (host, port) = if let Some(col) = hostport.rfind(':') {
        let p: u16 = hostport[col + 1..].parse().unwrap_or(6379);
        (&hostport[..col], p)
    } else {
        (hostport, 6379)
    };
    (host.to_string(), port, password)
}

async fn write_resp(stream: &mut TcpStream, parts: &[&str]) -> std::io::Result<()> {
    let mut buf = format!("*{}\r\n", parts.len());
    for p in parts {
        buf.push_str(&format!("${}\r\n{}\r\n", p.len(), p));
    }
    stream.write_all(buf.as_bytes()).await
}

async fn read_resp_line(reader: &mut BufReader<&mut TcpStream>) -> std::io::Result<String> {
    let mut line = String::new();
    reader.read_line(&mut line).await?;
    Ok(line.trim_end().to_string())
}

/// Read a single RESP reply, returning a debug string.
/// Returns None when the connection is closed.
async fn read_reply(reader: &mut BufReader<&mut TcpStream>) -> Option<String> {
    let first = read_resp_line(reader).await.ok()?;
    if first.is_empty() {
        return None;
    }
    let first_byte = first.chars().next()?;
    match first_byte {
        '+' | '-' => Some(first[1..].to_string()),
        ':' => Some(first[1..].to_string()),
        '$' => {
            let len: i64 = first[1..].parse().ok()?;
            if len == -1 {
                Some("(nil)".to_string())
            } else if len == 0 {
                let _ = read_resp_line(reader).await.ok()?;
                Some("(empty)".to_string())
            } else {
                let len = len as usize;
                let mut bulk = vec![0u8; len + 2]; // + \r\n
                reader.read_exact(&mut bulk).await.ok()?;
                Some(String::from_utf8_lossy(&bulk[..len]).to_string())
            }
        }
        '*' | '>' => {
            let count: usize = first[1..].parse().ok()?;
            let mut parts = Vec::new();
            for _ in 0..count {
                if let Some(p) = read_reply(reader).await {
                    parts.push(p);
                }
            }
            Some(parts.join(" "))
        }
        _ => Some(first),
    }
}

async fn subscribe_and_listen(
    url: &str,
    channels: &[String],
    io: &SocketIo,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (host, port, password) = parse_redis_url(url);
    let addr = format!("{host}:{port}");
    let mut stream = TcpStream::connect(&addr).await?;
    // Disable Nagle for low-latency pub/sub
    stream.set_nodelay(true)?;
    let (reader, mut writer) = stream.split();
    let mut reader = BufReader::new(reader);

    // Authenticate if password is provided
    if let Some(pass) = &password {
        write_resp(&mut writer, &["AUTH", pass]).await?;
        let reply = read_reply(&mut reader).await.unwrap_or_default();
        if !reply.starts_with("OK") {
            warn!(action = "valkey_auth", "Valkey auth failed: {reply}");
            return Err("Valkey auth failed".into());
        }
    }

    // Subscribe to channels
    for ch in channels {
        write_resp(&mut writer, &["SUBSCRIBE", ch]).await?;
        // Read the subscribe confirmation: *3 subscribe channel num_sub
        let confirm = read_reply(&mut reader).await.unwrap_or_default();
        info!(action = "valkey_sub", channel = %ch, "Subscribed to Valkey channel");
        _ = confirm;
    }

    info!(action = "valkey_connect", "Valkey connected");

    // Read messages in a loop
    loop {
        let reply = read_reply(&mut reader).await;
        match reply {
            Some(msg) => {
                // msg is space-separated parts: "message channel payload"
                let parts: Vec<&str> = msg.splitn(3, ' ').collect();
                if parts.len() >= 3 && parts[0] == "message" {
                    let _channel = parts[1];
                    let payload: Vec<u8> = parts[2].as_bytes().to_vec();
                    let (_, target_room, event, data) = format::decode_valkey(&payload);
                    if let Some(room) = target_room {
                        let _ = io.to(room).emit(&event, &data).await;
                    } else {
                        let _ = io.emit(&event, &data).await;
                    }
                }
            }
            None => {
                return Err("Valkey connection closed".into());
            }
        }
    }
}

pub fn start_subscriber(
    io: SocketIo,
    channels: &[&str],
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let url = get_valkey_url();
    let channels: Vec<String> = channels.iter().map(|s| s.to_string()).collect();

    tokio::spawn(async move {
        loop {
            match subscribe_and_listen(&url, &channels, &io).await {
                Ok(_) => info!(action = "valkey_sub", "Valkey subscriber finished (reconnecting...)"),
                Err(e) => warn!(action = "valkey_sub", "Valkey not available - pub/sub disabled: {e} (reconnecting...)"),
            }
            tokio::time::sleep(std::time::Duration::from_secs(3)).await;
        }
    });

    Ok(())
}
